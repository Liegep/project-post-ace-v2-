import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import type { AuthContext } from "../auth/auth.types.js";
import { ensureBrandBrainTables } from "../clients/brand-brain.service.js";
import { BrandBrainAiRepository } from "../brand-brain-ai/brand-brain-ai.repository.js";
import { BrandBrainAiService, type AiConfig } from "../brand-brain-ai/brand-brain-ai.service.js";
import { AiProviderError } from "../../lib/openai-responses.js";
import { McpRadarRepository } from "../mcp/mcp.radar.repository.js";
import { radarSourceKey, radarSuggestionKeys } from "../radar-suggestions/radar-suggestions.service.js";
import { radarSuggestionInputSchema } from "../radar-suggestions/radar-suggestions.schemas.js";
import { RadarSuggestionsRepository } from "../radar-suggestions/radar-suggestions.repository.js";
import { RadarRecoveryRepository } from "./radar-recovery.repository.js";
import { RadarRecoveryService } from "./radar-recovery.service.js";

// No .env, host or TCP fallback: this suite cannot connect to a configured application database.
const socketPath = process.env.RADAR_TEST_SOCKET;
if (!socketPath || !/^\/(?:private\/)?tmp\/radar-mariadb-[^/]+\/server\.sock$/.test(socketPath)) throw Error("Use apenas o socket temporário /tmp/radar-mariadb-*/server.sock.");
const schema = readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8").split("-- Additive foundation only.")[0];
const migrations = ["20261007_radar_suggestions_foundation.sql", "20261007_brand_brain_ai_runs.sql", "20261007_radar_source_runs.sql", "20261014_radar_editorial_brief.sql"].map(name => readFileSync(new URL(`../../../../../database/migrations/${name}`, import.meta.url), "utf8"));
const migration = readFileSync(new URL("../../../../../database/migrations/20261012_radar_recovery_attempts.sql", import.meta.url), "utf8");
let server: mysql.Connection;
before(async () => { server = await mysql.createConnection({ socketPath, user: "root", multipleStatements: true }); });
after(async () => { await server?.end(); });
const config: AiConfig = { OPENAI_API_KEY: "mock", BRAND_BRAIN_AI_ENABLED: true, BRAND_BRAIN_AI_MODEL: "mock-model", BRAND_BRAIN_AI_TIMEOUT_MS: 1000, BRAND_BRAIN_AI_MAX_OUTPUT_TOKENS: 6000 };
const source = { sourceTitle: "Synthetic study", sourceSummary: "Synthetic educational evidence", sourceUrl: "https://example.invalid/study", sourceDate: "2026-10-07", radarName: "Synthetic Radar" };
const suggestion = { title: "Synthetic idea", concept: "Concept", hook: "Hook", description: "Description", format: "carousel", pillar: "Canonical", objective: "Education", rationale: "Published pillar", cta: null, captionSuggestion: null, alignmentScore: 90, basedOn: ["Canonical pillar"] };
async function fixture(apply = true) {
 const database = `radar_recovery_test_${randomUUID().replace(/-/g, "")}`;
 await server.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
 const pool = mysql.createPool({ socketPath, user: "root", database, multipleStatements: true, timezone: "Z", connectionLimit: 12 });
 const close = async () => { await pool.end(); await server.query(`DROP DATABASE \`${database}\``); };
 try {
  await pool.query(schema); await ensureBrandBrainTables(pool); for (const sql of migrations) await pool.query(sql);
  const clientId = randomUUID(), otherId = randomUUID(), userId = randomUUID();
  await pool.query("INSERT INTO users(id,full_name,email,password_hash,global_role) VALUES(?,'Synthetic','synthetic@invalid.test','unused','super_admin')", [userId]);
  await pool.query("INSERT INTO client_accounts(id,name,slug,locale,portal_title,workspace_drawer_json) VALUES(?,'A','a','pt-BR','Portal',?),(?,'B','b','pt-BR','Portal','{}')", [clientId, JSON.stringify({ brandBrain: { pillars: [{ name: "Canonical" }] } }), otherId]);
  const root = await new McpRadarRepository(pool).claim(clientId, radarSourceKey(source), "a".repeat(64));
  assert.ok(root.owned); await new McpRadarRepository(pool).fail(root.run.id, "invalid_response");
  await pool.query("INSERT INTO brand_brain_ai_runs(id,client_account_id,operation,model,context_hash,status,error_code) VALUES(?,?,'radar','historic-mock',?,'failed','invalid_response')", [randomUUID(), clientId, "a".repeat(64)]);
  const query = async (sql: string, params: unknown[] = []) => (await pool.query<RowDataPacket[]>(sql, params))[0];
  const history = async () => JSON.stringify({ roots: await query("SELECT * FROM radar_source_runs ORDER BY id"), ai: await query("SELECT * FROM brand_brain_ai_runs WHERE model='historic-mock' ORDER BY id"), clients: await query("SELECT * FROM client_accounts ORDER BY id") });
  const original = await history(); if (apply) await pool.query(migration);
  const auth: AuthContext = { user: { id: userId, fullName: "Synthetic", email: "synthetic@invalid.test", globalRole: "super_admin", avatarUrl: null, locale: "pt-BR", isActive: true }, memberships: [] };
  const params = { clientId, runId: root.run.id };
  const request = (expectedAttempts = 0) => ({ requestId: randomUUID(), expectedAttempts, aiConsent: true, sourceReviewed: true, source: { ...source } });
  let calls = 0, value: unknown = { shouldCreate: true, suggestion }, failure: Error | null = null, gate: Promise<void> | null = null;
  let started!: () => void; const providerStarted = new Promise<void>(r => { started = r; });
  const createService = (db: Pool = pool, enabled = true) => {
   const store = new RadarRecoveryRepository(db);
   const ai = new BrandBrainAiService(new BrandBrainAiRepository(pool, true), config, async () => { calls++; started(); if (gate) await gate; if (failure) throw failure; return { value, model: "mock-model", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }; });
   return { store, service: new RadarRecoveryService(store, ai, config.BRAND_BRAIN_AI_MODEL, enabled) };
  };
  return { database, pool, query, close, clientId, otherId, userId, params, request, auth, original, history, createService, providerStarted, calls: () => calls, gate: (p: Promise<void>) => { gate = p; }, value: (v: unknown) => { value = v; }, failure: (e: Error | null) => { failure = e; } };
 } catch (e) { await close(); throw e; }
}
// Inject a lost COMMIT acknowledgement after MariaDB has actually committed; all other SQL remains real.
function ambiguousCommit(pool: Pool, targetCommit: number): Pool {
 let commits = 0;
 return new Proxy(pool, { get(target, prop) {
  if (prop === "getConnection") return async () => {
   const connection = await target.getConnection();
   return new Proxy(connection, { get(c, p) {
    if (p === "commit") return async () => { await c.commit(); if (++commits === targetCommit) throw Error("Synthetic lost commit acknowledgement"); };
    const v = Reflect.get(c, p); return typeof v === "function" ? v.bind(c) : v;
   } });
  };
  const v = Reflect.get(target, prop); return typeof v === "function" ? v.bind(target) : v;
 } });
}

test("MariaDB: actual schema migration, five compatible FKs, CHECKs, UNIQUEs, indexes and unchanged history", async () => {
 const f = await fixture(false); try {
  await f.pool.query(migration); assert.equal(await f.history(), f.original);
  console.log("Isolated MariaDB", await f.query("SELECT VERSION() version, @@sql_mode sql_mode, @@time_zone time_zone, @@skip_networking skip_networking"));
  const fks = await f.query("SELECT REFERENCED_TABLE_NAME,DELETE_RULE,UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND TABLE_NAME='radar_recovery_attempts'", [f.database]);
  assert.equal(fks.length, 5); assert.equal(fks.find(r => r.REFERENCED_TABLE_NAME === "users")!.DELETE_RULE, "SET NULL"); assert.ok(fks.every(r => r.UPDATE_RULE === "RESTRICT"));
  const columns = await f.query("SELECT TABLE_NAME,COLUMN_TYPE,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND COLUMN_NAME='id' AND TABLE_NAME IN ('users','client_accounts','radar_source_runs','brand_brain_ai_runs','radar_suggestions','radar_recovery_attempts')", [f.database]);
  assert.equal(columns.length, 6); assert.ok(columns.every(c => c.COLUMN_TYPE === "char(36)" && c.COLLATION_NAME === "utf8mb4_unicode_ci"));
  const indexes = await f.query("SHOW INDEX FROM radar_recovery_attempts");
  for (const name of ["uq_radar_recovery_number", "uq_radar_recovery_request"]) assert.ok(indexes.some(i => i.Key_name === name && i.Non_unique === 0));
  for (const name of ["idx_radar_recovery_client_time", "idx_radar_recovery_client_status"]) assert.ok(indexes.some(i => i.Key_name === name));
  const claim = await f.createService().store.claim({ ...f.params, sourceHash: radarSourceKey(source), contextHash: "a".repeat(64), requestId: randomUUID(), inputHash: "b".repeat(64), expectedAttempts: 0, userId: f.userId }); assert.ok(claim.owned);
  for (const change of ["attempt_number=0", "attempt_number=3", "ai_consent=0", "source_reviewed=0", "status='unknown'", "source_run_id='missing'", "client_account_id='missing'", "created_by_user_id='missing'", "suggestion_id='missing'", "ai_run_id='missing'"]) await assert.rejects(f.pool.query(`UPDATE radar_recovery_attempts SET ${change} WHERE id=?`, [claim.attempt.id]));
  const copy = "INSERT INTO radar_recovery_attempts(id,source_run_id,client_account_id,request_id,attempt_number,input_hash,context_hash,ai_consent,source_reviewed) SELECT ?,source_run_id,client_account_id,?, ?,input_hash,context_hash,1,1 FROM radar_recovery_attempts WHERE id=?";
  await assert.rejects(f.pool.query(copy, [randomUUID(), randomUUID(), 1, claim.attempt.id]), { code: "ER_DUP_ENTRY" });
  await assert.rejects(f.pool.query(copy, [randomUUID(), claim.attempt.requestId, 2, claim.attempt.id]), { code: "ER_DUP_ENTRY" });
  await assert.rejects(f.pool.query("DELETE FROM radar_source_runs WHERE id=?", [f.params.runId]));
  await assert.rejects(f.pool.query(migration), { code: "ER_TABLE_EXISTS_ERROR" }); assert.equal(await f.history(), f.original);
  await f.pool.query("DELETE FROM users WHERE id=?", [f.userId]); assert.equal((await f.query("SELECT created_by_user_id FROM radar_recovery_attempts"))[0].created_by_user_id, null);
 } finally { await f.close(); }
});
test("MariaDB: simultaneous independent recoveries/replays have one provider owner and one pending suggestion", async () => {
 const f = await fixture(); let release!: () => void; f.gate(new Promise(r => { release = r; }));
 try {
  const request = f.request(), first = f.createService().service.recover(f.auth, f.params, request); await Promise.race([f.providerStarted, first.then(() => { throw Error("Expected the synthetic provider to be called"); })]);
  const repeat = await Promise.all(Array.from({ length: 6 }, () => f.createService().service.recover(f.auth, f.params, request)));
  assert.ok(repeat.every(r => r.outcome === "processing"));
  await assert.rejects(f.createService().service.recover(f.auth, f.params, f.request()), { code: "recovery_processing" });
  release(); const result = await first; assert.equal(result.outcome, "created");
  assert.equal((await f.createService().service.recover(f.auth, f.params, request)).suggestionId, result.suggestionId);
  assert.equal(f.calls(), 1); assert.equal((await f.query("SELECT COUNT(*) n FROM radar_recovery_attempts"))[0].n, 1);
  assert.deepEqual((await f.query("SELECT status FROM radar_suggestions")).map(r => r.status), ["pending"]); assert.equal(await f.history(), f.original);
 } finally { release(); await f.close(); }
});
test("MariaDB: two simultaneous fresh requests are serialized at reservation, including across instances", async () => {
 const f = await fixture(); try {
  const results = await Promise.allSettled([f.createService().service.recover(f.auth, f.params, f.request()), f.createService().service.recover(f.auth, f.params, f.request())]);
  assert.equal(results.filter(r => r.status === "fulfilled" && r.value.outcome === "created").length, 1); assert.equal(f.calls(), 1);
  assert.equal((await f.query("SELECT COUNT(*) n FROM radar_suggestions"))[0].n, 1); assert.equal((await f.query("SELECT COUNT(*) n FROM radar_recovery_attempts"))[0].n, 1);
 } finally { await f.close(); }
});
test("MariaDB: lost reservation commit acknowledgement remains reserved, no provider or automatic takeover", async () => {
 const f = await fixture(); try {
  const request = f.request(); await assert.rejects(f.createService(ambiguousCommit(f.pool, 1)).service.recover(f.auth, f.params, request), { code: "recovery_storage_unavailable" });
  assert.equal((await f.createService().service.recover(f.auth, f.params, request)).outcome, "processing");
  await assert.rejects(f.createService().service.recover(f.auth, f.params, f.request(1)), { code: "recovery_processing" }); assert.equal(f.calls(), 0); assert.equal(await f.history(), f.original);
 } finally { await f.close(); }
});
test("MariaDB: lost final commit acknowledgement reconciles success and retry never calls provider again", async () => {
 const f = await fixture(); try {
  const request = f.request(), result = await f.createService(ambiguousCommit(f.pool, 2)).service.recover(f.auth, f.params, request);
  assert.equal(result.outcome, "created"); assert.equal((await f.createService().service.recover(f.auth, f.params, request)).attemptId, result.attemptId); assert.equal(f.calls(), 1);
  assert.equal((await f.query("SELECT COUNT(*) n FROM radar_suggestions"))[0].n, 1); assert.equal(await f.history(), f.original);
 } finally { await f.close(); }
});
test("MariaDB: transaction failure rolls suggestion back, preserves failure and durable retry identity", async () => {
 const f = await fixture(); try {
  await f.pool.query("CREATE TRIGGER fail_recovery_finish BEFORE UPDATE ON radar_recovery_attempts FOR EACH ROW BEGIN IF NEW.status='completed' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic failure'; END IF; END");
  const request = f.request(), result = await f.createService().service.recover(f.auth, f.params, request); assert.equal(result.outcome, "failed"); assert.equal(result.errorCode, "storage_unavailable");
  assert.equal((await f.query("SELECT COUNT(*) n FROM radar_suggestions"))[0].n, 0); await f.pool.query("DROP TRIGGER fail_recovery_finish");
  assert.equal((await f.createService().service.recover(f.auth, f.params, request)).outcome, "failed"); assert.equal(f.calls(), 1); assert.equal(await f.history(), f.original);
 } finally { await f.close(); }
});
test("MariaDB: provider timeout replay, cooldown, two-attempt limit and metadata-only history", async () => {
 const f = await fixture(); try {
  f.failure(new AiProviderError("timeout")); const request = f.request(); assert.equal((await f.createService().service.recover(f.auth, f.params, request)).outcome, "failed");
  assert.equal((await f.createService().service.recover(f.auth, f.params, request)).outcome, "failed"); assert.equal(f.calls(), 1);
  await assert.rejects(f.createService().service.recover(f.auth, f.params, f.request(1)), { code: "recovery_cooldown" });
  await f.pool.query("UPDATE radar_recovery_attempts SET created_at=CURRENT_TIMESTAMP-INTERVAL 16 MINUTE,finished_at=CURRENT_TIMESTAMP-INTERVAL 16 MINUTE");
  assert.equal((await f.createService().service.recover(f.auth, f.params, f.request(1))).outcome, "failed");
  await assert.rejects(f.createService().service.recover(f.auth, f.params, f.request(2)), { code: "recovery_limit" }); assert.equal(f.calls(), 2);
  assert.equal(await f.history(), f.original); const journal = await f.query("SELECT * FROM radar_recovery_attempts"); assert.equal(journal.length, 2); assert.ok(journal.every(r => r.ai_run_id)); assert.doesNotMatch(JSON.stringify(journal), /Synthetic educational|Concept|mock-model/);
 } finally { await f.close(); }
});
test("MariaDB: no-op terminal, completed/processing roots, client isolation, payload binding and disabled gate", async () => {
 const f = await fixture(); try {
  const disabled = f.createService(f.pool, false).service; assert.equal((await disabled.list(f.auth, f.clientId)).enabled, false);
  await assert.rejects(disabled.recover(f.auth, f.params, f.request()), { code: "recovery_disabled" }); assert.equal((await f.query("SELECT COUNT(*) n FROM radar_recovery_attempts"))[0].n, 0); assert.equal(f.calls(), 0);
  await assert.rejects(f.createService().service.recover(f.auth, { ...f.params, clientId: f.otherId }, f.request()), { code: "source_not_found" });
  for (const status of ["completed", "processing"]) { await f.pool.query("UPDATE radar_source_runs SET status=?,updated_at=updated_at WHERE id=?", [status, f.params.runId]); await assert.rejects(f.createService().service.recover(f.auth, f.params, f.request()), { code: "source_not_failed" }); }
  await f.pool.query("UPDATE radar_source_runs SET status='failed',updated_at=updated_at WHERE id=?", [f.params.runId]);
  f.value({ shouldCreate: false, suggestion: null }); const request = f.request(); assert.equal((await f.createService().service.recover(f.auth, f.params, request)).outcome, "no_op");
  await assert.rejects(f.createService().service.recover(f.auth, f.params, { ...request, source: { ...source, sourceSummary: "Changed" } }), { code: "recovery_request_conflict" });
  await assert.rejects(f.createService().service.recover(f.auth, f.params, f.request(1)), { code: "recovery_resolved" }); assert.equal(f.calls(), 1); assert.equal(await f.history(), f.original);
 } finally { await f.close(); }
});
test("MariaDB: existing suggestion inserted while provider runs is reused, including after dismissal", async () => {
 const f = await fixture(); let release!: () => void; f.gate(new Promise(r => { release = r; }));
 try {
  const first = f.createService().service.recover(f.auth, f.params, f.request()); await Promise.race([f.providerStarted, first.then(() => { throw Error("Expected the synthetic provider to be called"); })]);
  const { format, ...fields } = suggestion; const { sourceSummary, ...metadata } = source;
  const input = radarSuggestionInputSchema.parse({ ...fields, ...metadata, contentType: format });
  const existing = await new RadarSuggestionsRepository(f.pool).createPending(f.clientId, f.userId, input, radarSuggestionKeys(input));
  await new RadarSuggestionsRepository(f.pool).resolve(f.clientId, existing.suggestion.id, f.userId, "dismiss");
  release(); assert.equal((await first).outcome, "existing"); assert.equal((await f.createService().service.recover(f.auth, f.params, f.request(1))).outcome, "existing");
  assert.equal(f.calls(), 1); assert.equal((await f.query("SELECT COUNT(*) n FROM radar_suggestions"))[0].n, 1); assert.equal(await f.history(), f.original);
 } finally { release(); await f.close(); }
});

test("MariaDB: AI linkage failure occurs before provider; missing failure acknowledgement stays reserved", async () => {
 const f = await fixture(); try {
  await f.pool.query("CREATE TRIGGER fail_ai_link BEFORE UPDATE ON radar_recovery_attempts FOR EACH ROW BEGIN IF NEW.ai_run_id IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic link failure'; END IF; END");
  const request = f.request(); assert.equal((await f.createService().service.recover(f.auth, f.params, request)).outcome, "failed"); assert.equal(f.calls(), 0);
  assert.deepEqual((await f.query("SELECT status,error_code FROM brand_brain_ai_runs WHERE model<>'historic-mock'")).map(r => [r.status, r.error_code]), [["failed", "storage_unavailable"]]);
  await f.pool.query("DROP TRIGGER fail_ai_link"); await f.pool.query("UPDATE radar_recovery_attempts SET created_at=CURRENT_TIMESTAMP-INTERVAL 16 MINUTE,finished_at=CURRENT_TIMESTAMP-INTERVAL 16 MINUTE");
  await f.pool.query("CREATE TRIGGER fail_failure_record BEFORE UPDATE ON radar_recovery_attempts FOR EACH ROW BEGIN IF NEW.status='failed' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic storage failure'; END IF; END");
  f.failure(new AiProviderError("timeout")); const second = f.request(1); await assert.rejects(f.createService().service.recover(f.auth, f.params, second), { code: "recovery_storage_unavailable" });
  assert.equal((await f.createService().service.recover(f.auth, f.params, second)).outcome, "processing");
  await assert.rejects(f.createService().service.recover(f.auth, f.params, f.request(2)), { code: "recovery_processing" }); assert.equal(f.calls(), 1); assert.equal(await f.history(), f.original);
 } finally { await f.close(); }
});
test("MariaDB: feature disabled rejects before storage even without the recovery migration", async () => {
 const f = await fixture(false); try {
  await assert.rejects(f.createService(f.pool, false).service.recover(f.auth, f.params, f.request()), { code: "recovery_disabled" });
  assert.equal(f.calls(), 0); assert.equal(await f.history(), f.original);
  assert.equal((await f.query("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME='radar_recovery_attempts'", [f.database]))[0].n, 0);
 } finally { await f.close(); }
});
