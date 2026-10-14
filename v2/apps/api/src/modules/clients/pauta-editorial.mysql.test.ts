import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import mysql, { type RowDataPacket } from "mysql2/promise";
import Fastify from "fastify";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { ensureApprovalStorage } from "../approvals/approval-history.repository.js";
import { decideCardApproval, resubmitCardApproval } from "../approvals/approval-workflow.service.js";
import { RadarSuggestionsRepository } from "../radar-suggestions/radar-suggestions.repository.js";
import { RadarSuggestionsService } from "../radar-suggestions/radar-suggestions.service.js";
import { sample } from "../radar-suggestions/radar-suggestions.test-fixtures.js";
import { ensureCardActivityEventsTable } from "../cards/card-activity.service.js";
import { findCardById } from "../cards/cards.repository.js";
import { editPautaIdea } from "./pauta-edit.service.js";
import { sendPautaForApproval } from "./pauta-send.service.js";

// No .env, TCP, application credentials or real AI provider can be used here.
const socketPath = process.env.RADAR_TEST_SOCKET;
if (!socketPath || !/^\/(?:private\/)?tmp\/radar-mariadb-[^/]+\/server\.sock$/.test(socketPath)) {
  throw Error("Use apenas o socket temporário /tmp/radar-mariadb-*/server.sock.");
}
const schema = readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8")
  .split("-- Additive foundation only.")[0].replace("  editorial_brief_json JSON NULL,\n", "");
assert.ok(!schema.includes("editorial_brief_json"), "fixture must represent the pre-migration schema");
const migration = readFileSync(new URL("../../../../../database/migrations/20261014_radar_editorial_brief.sql", import.meta.url), "utf8");
const foundation = readFileSync(new URL("../../../../../database/migrations/20261007_radar_suggestions_foundation.sql", import.meta.url), "utf8");
let server: mysql.Connection;
before(async () => { server = await mysql.createConnection({ socketPath, user: "root", multipleStatements: true, timezone: "Z" }); });
after(async () => { await server?.end(); });

async function fixture(migrate = true) {
  const database = `editorial_test_${randomUUID().replace(/-/g, "")}`;
  await server.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const pool = mysql.createPool({ socketPath, user: "root", database, connectionLimit: 12, jsonStrings: true, multipleStatements: true, timezone: "Z", charset: "utf8mb4" });
  const app = Fastify();
  app.decorate("db", pool);
  await app.register(httpErrorsPluginRegistered);
  const close = async () => { await app.close(); await pool.end(); await server.query(`DROP DATABASE \`${database}\``); };
  try {
    await pool.query(schema); await pool.query(foundation); await ensureApprovalStorage(pool); await ensureCardActivityEventsTable(pool);
    const userId = randomUUID(), clientIds = [randomUUID(), randomUUID(), randomUUID()];
    await pool.query("INSERT INTO users(id,full_name,email,password_hash,global_role) VALUES(?,'Synthetic team','synthetic@example.invalid','unused','super_admin')", [userId]);
    for (const [i, id] of clientIds.entries()) {
      await pool.query("INSERT INTO client_accounts(id,name,slug,portal_title,workspace_drawer_json) VALUES(?,?,?,?,?)", [id, `Synthetic ${i}`, `synthetic-${i}`, "Portal", JSON.stringify({ pautaIdeas: [{ id: "old-approved", title: "Historic approved text", status: "approved" }, { id: "manual", title: "Manual pauta", description: "Human-written context", status: "draft" }], links: ["keep"], internalStrategy: "PRIVATE_STRATEGY" })]);
      await pool.query("INSERT INTO kanban_columns(id,client_account_id,name,position,visible_to_client) VALUES(?,?,'Pautas para aprovação',0,1)", [randomUUID(), id]);
    }
    const oldCardId = randomUUID();
    await pool.query("INSERT INTO kanban_cards(id,client_account_id,title,caption,status_json,tags_json,media_urls_json,approval_state) VALUES(?,?,'Historic title','Historic caption 🐕','[\"Aprovado\"]','[]','[]','approved')", [oldCardId, clientIds[0]]);
    await pool.query("INSERT INTO card_approval_events(id,card_id,revision,action,source,actor_name,actor_role,before_json,after_json) VALUES(?,?,0,'legacy_snapshot','legacy','Unknown','unknown',?,?)", [randomUUID(), oldCardId, JSON.stringify({ caption: "Historic caption 🐕" }), JSON.stringify({ caption: "Historic caption 🐕" })]);
    await pool.query("INSERT INTO radar_suggestions(id,client_account_id,title,concept,hook,description,content_type,objective,rationale,status,source_title,radar_name,source_key,dedupe_hash,based_on_json) VALUES(?,?,'Historic suggestion','Concept','Hook','Description','Carrossel','Educate','Reason','dismissed','Original source','Synthetic radar','historic-key','historic-hash','[]')", [randomUUID(), clientIds[0]]);
    if (migrate) await pool.query(migration);
    const query = async (sql: string, values: unknown[] = []) => (await pool.query<RowDataPacket[]>(sql, values))[0];
    const actor = { id: userId, fullName: "Synthetic team", globalRole: "super_admin" };
    const clientActor = { userId: null, name: "Synthetic client", role: "cliente" as const };
    return { database, pool, app, query, userId, clientIds, oldCardId, actor, clientActor, repository: new RadarSuggestionsRepository(pool), service: new RadarSuggestionsService(new RadarSuggestionsRepository(pool)), close };
  } catch (error) { await close(); throw error; }
}
async function historical(f: Awaited<ReturnType<typeof fixture>>) {
  // Exact pre-existing values and timestamps, excluding only the two new columns.
  const cards = (await f.query("SELECT * FROM kanban_cards ORDER BY id")).map(({ editorial_brief_json, ...row }) => row);
  const suggestions = (await f.query("SELECT * FROM radar_suggestions ORDER BY id")).map(({ source_summary, ...row }) => row);
  return { cards, suggestions, clients: await f.query("SELECT * FROM client_accounts ORDER BY id"), events: await f.query("SELECT * FROM card_approval_events ORDER BY id") };
}
async function sent(f: Awaited<ReturnType<typeof fixture>>, clientId = f.clientIds[0]) {
  const created = await f.service.createPending(clientId, f.userId, sample({ title: `Synthetic ${clientId}`, sourceSummary: "Original factual context 🐕", sourceTitle: "Original news", sourceUrl: "https://example.invalid/news", sourceDate: "2026-10-14", basedOn: ["PRIVATE_PILLAR"], aiModel: "PRIVATE_MODEL" }));
  const accepted = await f.repository.resolve(clientId, created.suggestion.id, f.userId, "accept");
  await editPautaIdea(f.app, clientId, String(accepted.pauta!.id), { hook: "Human-edited draft hook" }, f.actor);
  return { idea: accepted.pauta!, result: await sendPautaForApproval(f.app, clientId, String(accepted.pauta!.id), f.userId) };
}

test("native MariaDB: migration adds nullable fields, preserves every historic value, repeats, validates JSON and long Unicode", async () => {
  const f = await fixture(false);
  try {
    console.log(`Isolated engine: ${(await f.query("SELECT VERSION() AS version"))[0].version}`);
    const before = await historical(f);
    const indexes = await f.query("SHOW INDEX FROM radar_suggestions");
    const foreignKeys = await f.query("SELECT * FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? ORDER BY CONSTRAINT_NAME", [f.database]);
    await f.pool.query(migration);
    assert.deepEqual(await f.query("SHOW INDEX FROM radar_suggestions"), indexes);
    assert.deepEqual(await f.query("SELECT * FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? ORDER BY CONSTRAINT_NAME", [f.database]), foreignKeys);
    assert.deepEqual(await historical(f), before);
    const columns = await f.query("SELECT TABLE_NAME,COLUMN_NAME,DATA_TYPE,IS_NULLABLE,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND COLUMN_NAME IN ('source_summary','editorial_brief_json')", [f.database]);
    assert.equal(columns.length, 2);
    assert.ok(columns.every(column => column.IS_NULLABLE === "YES"));
    assert.equal(columns.find(column => column.COLUMN_NAME === "source_summary")!.DATA_TYPE, "mediumtext");
    assert.equal(columns.find(column => column.COLUMN_NAME === "editorial_brief_json")!.DATA_TYPE, "longtext");
    assert.equal(columns.find(column => column.COLUMN_NAME === "editorial_brief_json")!.COLLATION_NAME, "utf8mb4_bin");
    assert.equal((await f.query("SELECT editorial_brief_json FROM kanban_cards"))[0].editorial_brief_json, null);
    assert.equal((await f.query("SELECT source_summary FROM radar_suggestions"))[0].source_summary, null);
    await f.pool.query(migration); assert.deepEqual(await historical(f), before);
    await assert.rejects(f.pool.query("UPDATE kanban_cards SET editorial_brief_json='invalid JSON' WHERE id=?", [f.oldCardId]), (error: unknown) => (error as { errno: number }).errno === 4025);
    const summary = "Factual 🐕 contexto. ".repeat(900).trim();
    const result = await f.service.createPending(f.clientIds[0], f.userId, sample({ title: "Long source", sourceSummary: summary }));
    assert.equal(result.suggestion.sourceSummary, summary);
    await f.pool.query("UPDATE kanban_cards SET editorial_brief_json=? WHERE id=?", [JSON.stringify({ sourceSummary: summary }), f.oldCardId]);
    assert.equal((await findCardById(f.pool, f.oldCardId))!.editorialBrief!.sourceSummary, summary);
    const saved = await historical(f), json = (await f.query("SELECT editorial_brief_json FROM kanban_cards"))[0].editorial_brief_json;
    await f.pool.query(migration); assert.deepEqual(await historical(f), saved);
    assert.equal((await f.query("SELECT editorial_brief_json FROM kanban_cards"))[0].editorial_brief_json, json);
  } finally { await f.close(); }
});

test("native MariaDB: failure at second ALTER leaves resumable additive DDL and no historical changes", async () => {
  const f = await fixture(false);
  try {
    const before = await historical(f);
    await f.pool.query("RENAME TABLE kanban_cards TO temporarily_unavailable_cards");
    await assert.rejects(f.pool.query(migration), (error: unknown) => (error as { code: string }).code === "ER_NO_SUCH_TABLE");
    assert.equal((await f.query("SHOW COLUMNS FROM radar_suggestions LIKE 'source_summary'")).length, 1);
    await f.pool.query("RENAME TABLE temporarily_unavailable_cards TO kanban_cards");
    assert.deepEqual(await historical(f), before);
    await f.pool.query(migration); await f.pool.query(migration);
    assert.deepEqual(await historical(f), before);
    assert.equal((await f.query("SELECT COUNT(*) AS total FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND REFERENCED_TABLE_NAME='kanban_cards'", [f.database]))[0].total > 0, true);
  } finally { await f.close(); }
});

test("native MariaDB: three synthetic clients retain briefing through draft, send, review, edit, resubmit and approval", async () => {
  const f = await fixture();
  try {
    const ui = await import(new URL("../../../../web/src/EditorialBrief.tsx", import.meta.url).href);
    const React = await import("react"), { renderToStaticMarkup } = await import("react-dom/server");
    for (const clientId of f.clientIds) {
      const { idea, result } = await sent(f, clientId); const card = result.card!;
      assert.equal(card.editorialBrief!.sourceSummary, "Original factual context 🐕");
      assert.equal(card.editorialBrief!.sourceDate, "2026-10-14");
      const html = renderToStaticMarkup(React.createElement(ui.EditorialBrief, { brief: card.editorialBrief, caption: card.caption }));
      assert.match(html, /Original factual context/); assert.match(html, /href="https:\/\/example.invalid\/news"/); assert.match(html, /2026-10-14/);
      assert.doesNotMatch(html, /PRIVATE_|alignmentScore|basedOn|aiModel/);
      await decideCardApproval(f.app, clientId, card.id, f.clientActor, { approved: false, commentText: "Synthetic change request", expectedApprovalRevision: 0 });
      const previous = await f.query("SELECT * FROM card_approval_events WHERE card_id=? ORDER BY revision", [card.id]);
      const updated = await editPautaIdea(f.app, clientId, String(idea.id), { description: "Revised editorial direction", expectedApprovalRevision: 1 }, f.actor);
      assert.equal(updated.card!.approvalState, "changes_requested"); assert.equal(updated.card!.approvalRevision, 2);
      assert.equal(updated.card!.editorialBrief!.sourceSummary, card.editorialBrief!.sourceSummary);
      const revisedHtml = renderToStaticMarkup(React.createElement(ui.EditorialBrief, { brief: updated.card!.editorialBrief }));
      assert.match(revisedHtml, /Revised editorial direction/);
      const snapshotHtml = renderToStaticMarkup(React.createElement(ui.ApprovalBriefSnapshot, { snapshot: previous[1].after_json }));
      assert.match(snapshotHtml, /Original factual context/); assert.doesNotMatch(snapshotHtml, /Revised editorial direction|PRIVATE_/);
      await resubmitCardApproval(f.app, clientId, card.id, { userId: f.userId, name: f.actor.fullName, role: "super_admin" }, 2);
      const approved = await decideCardApproval(f.app, clientId, card.id, f.clientActor, { approved: true, expectedApprovalRevision: 3 });
      assert.equal(approved.card.approvalState, "approved");
      const events = await f.query("SELECT * FROM card_approval_events WHERE card_id=? ORDER BY revision", [card.id]);
      assert.deepEqual(events.slice(0, 2), previous);
      assert.deepEqual(events.map(event => event.action), ["legacy_snapshot", "changes_requested", "brief_updated", "resubmitted", "approved"]);
      assert.equal(JSON.parse(events[4].after_json).editorialBrief.description, "Revised editorial direction");
      await assert.rejects(editPautaIdea(f.app, clientId, String(idea.id), { description: "Forbidden approved replacement", expectedApprovalRevision: 4 }, f.actor), { statusCode: 409 });
      const drawer = JSON.parse((await f.query("SELECT workspace_drawer_json FROM client_accounts WHERE id=?", [clientId]))[0].workspace_drawer_json);
      assert.equal(drawer.pautaIdeas.find((item: { id: string }) => item.id === "old-approved").title, "Historic approved text");
    }
    const manual = await sendPautaForApproval(f.app, f.clientIds[1], "manual", f.userId);
    assert.deepEqual(manual.card!.editorialBrief, { description: "Human-written context" });
    assert.equal((await findCardById(f.pool, f.oldCardId))!.editorialBrief, null);
  } finally { await f.close(); }
});

test("native MariaDB: simultaneous sends insert once; simultaneous edits fence stale revisions and isolate clients", async () => {
  const f = await fixture();
  try {
    const sends = await Promise.all(Array.from({ length: 8 }, () => sendPautaForApproval(f.app, f.clientIds[0], "manual", f.userId)));
    assert.equal(sends.filter(result => result.created).length, 1);
    assert.equal(new Set(sends.map(result => result.card!.id)).size, 1);
    const edits = await Promise.allSettled(["First", "Second"].map(description => editPautaIdea(f.app, f.clientIds[0], "manual", { description, expectedApprovalRevision: 0 }, f.actor)));
    assert.equal(edits.filter(result => result.status === "fulfilled").length, 1);
    assert.equal((edits.find(result => result.status === "rejected") as PromiseRejectedResult).reason.statusCode, 409);
    assert.equal((await findCardById(f.pool, sends[0].card!.id))!.approvalRevision, 1);
    await assert.rejects(editPautaIdea(f.app, f.clientIds[2], "foreign-idea", { description: "Foreign" }, f.actor), { statusCode: 404 });
    assert.equal((await f.query("SELECT COUNT(*) AS total FROM card_approval_events WHERE action='brief_updated'"))[0].total, 1);
  } finally { await f.close(); }
});

test("native MariaDB: lost commit acknowledgements replay safely; audit failure rolls back card, bank, history and link", async () => {
  const f = await fixture();
  try {
    const { idea, result } = await sent(f); const card = result.card!;
    await f.pool.query("INSERT INTO approval_links(id,client_account_id,card_id,token,expires_at,is_active) VALUES(?,?,?,'synthetic-token','2099-01-01',1)", [randomUUID(), f.clientIds[0], card.id]);
    const before = await historical(f);
    await f.pool.query("CREATE TRIGGER fail_editorial_audit BEFORE INSERT ON card_approval_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic audit failure'");
    await assert.rejects(editPautaIdea(f.app, f.clientIds[0], String(idea.id), { caption: "Uncommitted caption", expectedApprovalRevision: 0 }, f.actor), /synthetic audit failure/);
    assert.deepEqual(await historical(f), before);
    assert.equal((await f.query("SELECT COUNT(*) AS total FROM card_caption_versions"))[0].total, 0);
    assert.equal((await f.query("SELECT is_active FROM approval_links"))[0].is_active, 1);
    await f.pool.query("DROP TRIGGER fail_editorial_audit");
    const originalGetConnection = f.pool.getConnection.bind(f.pool);
    let loseAcknowledgement = true;
    f.pool.getConnection = async () => {
      const db = await originalGetConnection(), commit = db.commit.bind(db);
      db.commit = async () => { await commit(); db.commit = commit; if (loseAcknowledgement) { loseAcknowledgement = false; throw Error("Lost commit acknowledgement"); } };
      return db;
    };
    await assert.rejects(sendPautaForApproval(f.app, f.clientIds[1], "manual", f.userId), /Lost commit acknowledgement/);
    const replayedSend = await sendPautaForApproval(f.app, f.clientIds[1], "manual", f.userId);
    assert.equal(replayedSend.created, false);
    assert.equal((await f.query("SELECT COUNT(*) AS total FROM kanban_cards WHERE client_account_id=?", [f.clientIds[1]]))[0].total, 1);
    loseAcknowledgement = true;
    const patch = { description: "Committed revision", expectedApprovalRevision: 0 };
    await assert.rejects(editPautaIdea(f.app, f.clientIds[0], String(idea.id), patch, f.actor), /Lost commit acknowledgement/);
    f.pool.getConnection = originalGetConnection;
    const replay = await editPautaIdea(f.app, f.clientIds[0], String(idea.id), patch, f.actor);
    assert.equal(replay.card!.approvalRevision, 1);
    assert.equal((await f.query("SELECT COUNT(*) AS total FROM card_approval_events WHERE card_id=?", [card.id]))[0].total, 1);
  } finally { await f.close(); }
});
