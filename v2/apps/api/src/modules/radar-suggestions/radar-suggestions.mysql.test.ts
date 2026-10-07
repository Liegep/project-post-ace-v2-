import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { RadarSuggestionsRepository } from "./radar-suggestions.repository.js";
import { RadarSuggestionsService } from "./radar-suggestions.service.js";
import { clientA, clientB, actorId, sample } from "./radar-suggestions.test-fixtures.js";

// Only an isolated local socket is accepted. Never reads .env or application DB credentials.
const socketPath = process.env.RADAR_TEST_SOCKET;
if (!socketPath || !/^\/(?:private\/)?tmp\/radar-mariadb-[^/]+\/server\.sock$/.test(socketPath)) {
  throw new Error("RADAR_TEST_SOCKET deve apontar à instância temporária /tmp/radar-mariadb-*/server.sock.");
}
const migration = readFileSync(new URL("../../../../../database/migrations/20261007_radar_suggestions_foundation.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8").split("-- Additive foundation only.")[0];
let server: mysql.Connection;
before(async () => { server = await mysql.createConnection({ socketPath, user: "root", multipleStatements: true, timezone: "Z" }); });
after(async () => { await server?.end(); });
async function fixture() {
  const database = `radar_test_${randomUUID().replace(/-/g, "")}`;
  await server.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const pool = mysql.createPool({ socketPath, user: "root", database, multipleStatements: true, connectionLimit: 8, timezone: "Z", charset: "utf8mb4" });
  const close = async () => { await pool.end(); await server.query(`DROP DATABASE \`${database}\``); };
  try {
    await pool.query(schema);
    await pool.query("INSERT INTO users (id, full_name, email, password_hash, global_role) VALUES (?, 'Equipe', 'test@invalid.test', 'unused', 'super_admin')", [actorId]);
    const drawer = JSON.stringify({ brandBrain: { positioning: "Oficial" }, pautaIdeas: [{ id: "legacy", title: "Observe o contexto", status: "approved", cardId: "legacy-card" }], links: ["keep"], custom: { nested: true } });
    await pool.query("INSERT INTO client_accounts (id, name, slug, portal_title, workspace_drawer_json) VALUES (?, 'A', 'a', 'Portal A', ?), (?, 'B', 'b', 'Portal B', ?)", [clientA, drawer, clientB, drawer]);
    await pool.query(migration);
    const repository = new RadarSuggestionsRepository(pool);
    return { database, pool, repository, service: new RadarSuggestionsService(repository), drawer, close };
  } catch (error) { await close(); throw error; }
}
async function rows(pool: Pool, sql: string, values: unknown[] = []) { return (await pool.query<RowDataPacket[]>(sql, values))[0]; }

test("MariaDB migration is additive/repeatable, with PK, FKs, indexes, checks, defaults and preserved drawer", async () => {
  const f = await fixture();
  try {
    const version = (await rows(f.pool, "SELECT VERSION() AS version"))[0].version;
    console.log(`Temporary database: MariaDB ${version}`);
    await f.pool.query(migration);
    const columns = await rows(f.pool, "SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'radar_suggestions'", [f.database]);
    assert.equal(columns.length, 32);
    assert.equal(columns.find((column) => column.COLUMN_NAME === "created_at")!.COLUMN_TYPE, "timestamp(3)");
    const foreignKeys = await rows(f.pool, "SELECT DELETE_RULE, UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = 'radar_suggestions'", [f.database]);
    assert.equal(foreignKeys.length, 4); assert.equal(foreignKeys.filter((fk) => fk.DELETE_RULE === "SET NULL").length, 3);
    assert.ok(foreignKeys.every((fk) => fk.UPDATE_RULE === "RESTRICT"));
    const indexes = await rows(f.pool, "SHOW INDEX FROM radar_suggestions");
    assert.ok(indexes.some((index) => index.Key_name === "uq_radar_suggestion_client_dedupe" && index.Non_unique === 0));
    const result = await f.service.createPending(clientA, actorId, sample({ title: "Observação 🐕", basedOn: ["Pilar oficial"], sourceUrl: "https://example.org/" + "x".repeat(2200) }));
    assert.equal(result.suggestion.title, "Observação 🐕"); assert.equal(result.suggestion.status, "pending");
    assert.equal(result.suggestion.sourceUrl!.length, 2220); assert.deepEqual(result.suggestion.basedOn, ["Pilar oficial"]);
    assert.equal(result.suggestion.aiModel, null); assert.equal(result.suggestion.acceptedAt, null);
    await assert.rejects(f.pool.query("UPDATE radar_suggestions SET status = 'published' WHERE id = ?", [result.suggestion.id]));
    await assert.rejects(f.pool.query("UPDATE radar_suggestions SET alignment_score = 101 WHERE id = ?", [result.suggestion.id]));
    await assert.rejects(f.pool.query("DELETE FROM client_accounts WHERE id = ?", [clientA]));
    await assert.rejects(f.service.createPending(randomUUID(), actorId, sample()));
    const drawers = await rows(f.pool, "SELECT CAST(workspace_drawer_json AS CHAR) AS workspace_drawer_json FROM client_accounts ORDER BY id");
    assert.ok(drawers.every((row) => row.workspace_drawer_json === f.drawer));
  } finally { await f.close(); }
});
test("MariaDB concurrent ingestion across connections inserts once, keeps content and isolates clients", async () => {
  const f = await fixture();
  try {
    const results = await Promise.all(Array.from({ length: 20 }, () => f.service.createPending(clientA, actorId, sample())));
    assert.equal(results.filter((result) => result.created).length, 1);
    assert.equal(new Set(results.map((result) => result.suggestion.id)).size, 1);
    const original = results[0].suggestion;
    const retry = await f.service.createPending(clientA, actorId, sample({ description: "Tentativa de sobrescrever", alignmentScore: 90 }));
    assert.equal(retry.created, false); assert.equal(retry.suggestion.description, original.description); assert.equal(retry.suggestion.alignmentScore, null);
    assert.equal((await f.service.createPending(clientB, actorId, sample())).created, true);
    assert.equal((await rows(f.pool, "SELECT COUNT(*) AS total FROM radar_suggestions"))[0].total, 2);
    assert.equal(await f.repository.pendingDetail(clientB, original.id), null);
    assert.equal((await f.repository.listPending([clientA], { limit: 25, offset: 0 })).items.length, 1);
    assert.deepEqual((await f.repository.listPending([], { limit: 25, offset: 0 })).items, []);
  } finally { await f.close(); }
});
test("MariaDB pending pagination exceeds 24 and retries never revive accepted/dismissed history", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 30; i++) await f.service.createPending(clientA, actorId, sample({ title: `Ângulo ${i}` }));
    const first = await f.repository.listPending(null, { limit: 25, offset: 0 });
    const next = await f.repository.listPending(null, { limit: 25, offset: 25 });
    assert.equal(first.items.length, 25); assert.equal(first.hasMore, true); assert.equal(next.items.length, 5); assert.equal(next.hasMore, false);
    assert.equal(new Set([...first.items, ...next.items].map((item) => item.id)).size, 30);
    for (const status of ["accepted", "dismissed"]) {
      const title = `Resolvida ${status}`;
      const created = await f.service.createPending(clientA, actorId, sample({ title }));
      await f.pool.query("UPDATE radar_suggestions SET status = ? WHERE id = ?", [status, created.suggestion.id]);
      const result = await f.service.createPending(clientA, actorId, sample({ title }));
      assert.equal(result.created, false); assert.equal(result.suggestion.status, status);
      assert.equal(await f.repository.pendingDetail(clientA, result.suggestion.id), null);
    }
    assert.equal((await f.repository.listPending([clientA], { limit: 100, offset: 0 })).items.length, 30);
    const fresh = new RadarSuggestionsRepository(f.pool);
    assert.equal((await fresh.listPending([clientA], { limit: 100, offset: 0 })).items.length, 30);
  } finally { await f.close(); }
});
test("MariaDB storage errors do not create incomplete suggestions; user removal preserves audit record", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.service.createPending(clientA, randomUUID(), sample()));
    assert.equal((await rows(f.pool, "SELECT COUNT(*) AS total FROM radar_suggestions"))[0].total, 0);
    const created = await f.service.createPending(clientA, actorId, sample());
    await f.pool.query("DELETE FROM users WHERE id = ?", [actorId]);
    const detail = await f.repository.pendingDetail(clientA, created.suggestion.id);
    assert.ok(detail); assert.equal(detail.createdByUserId, null);
  } finally { await f.close(); }
});

test("MariaDB timestamps preserve milliseconds regardless of driver timezone", async () => {
  const f = await fixture();
  const alternate = mysql.createPool({ socketPath, user: "root", database: f.database, timezone: "+09:00" });
  try {
    const created = await f.service.createPending(clientA, actorId, sample());
    await f.pool.query("UPDATE radar_suggestions SET created_at = '2026-10-07 12:30:00.123', updated_at = '2026-10-07 12:31:00.456' WHERE id = ?", [created.suggestion.id]);
    const detail = await new RadarSuggestionsRepository(alternate).pendingDetail(clientA, created.suggestion.id);
    assert.equal(detail!.createdAt, "2026-10-07T12:30:00.123Z");
    assert.equal(detail!.updatedAt, "2026-10-07T12:31:00.456Z");
  } finally { await alternate.end(); await f.close(); }
});
