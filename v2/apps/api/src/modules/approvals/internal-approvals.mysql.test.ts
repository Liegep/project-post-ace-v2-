import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import mysql, { type RowDataPacket } from "mysql2/promise";
import Fastify from "fastify";
import type { AuthContext } from "../auth/auth.types.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { internalApprovalRoutes } from "./internal-approvals.routes.js";
import { ensureApprovalStorage, recordApprovalEvent } from "./approval-history.repository.js";
import { clientRoutes } from "../clients/clients.routes.js";
import { RadarSuggestionsService } from "../radar-suggestions/radar-suggestions.service.js";
import { RadarSuggestionsRepository } from "../radar-suggestions/radar-suggestions.repository.js";
import { sample } from "../radar-suggestions/radar-suggestions.test-fixtures.js";
import { demoReviewer } from "./internal-reviewers.repository.js";

// No .env or TCP fallback. Only a disposable server created for this task.
const socketPath = process.env.INTERNAL_APPROVAL_TEST_SOCKET;
if (!socketPath || !/^\/(?:private\/)?tmp\/internal-approval-mariadb-[^/]+\/server\.sock$/.test(socketPath)) throw Error("Use a disposable /tmp/internal-approval-mariadb-*/server.sock socket.");

test("MariaDB: actual migration, both sessions, real recipient IDs, cross-connection inbox, preserved editorial brief and rollback", async () => {
  const server = await mysql.createConnection({ socketPath, user: "root", multipleStatements: true });
  const database = `internal_approval_test_${randomUUID().replace(/-/g, "")}`;
  await server.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const db = mysql.createPool({ socketPath, user: "root", database, multipleStatements: true, timezone: "Z" });
  const app = Fastify();
  const ids = { aline: randomUUID(), liege: randomUUID(), carlos: randomUUID(), client: randomUUID(), card: randomUUID() };
  let auth: AuthContext;
  const session = (id: string, globalRole: "admin" | "super_admin") => {
    auth = { user: { id, fullName: id === ids.aline ? "Aline" : "Liege", email: "test@invalid.test", globalRole, isActive: true, locale: "pt", avatarUrl: null }, memberships: globalRole === "super_admin" ? [] : [{ clientAccountId: ids.client, membershipRole: "admin", portalAccessLevel: "admin", isPrimary: true, clientSlug: "synthetic", clientName: "Synthetic", ownerUserId: null }] };
  };
  try {
    // Reconstruct the pre-editorial schema and apply both PR migrations together.
    const schema = readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8").split("-- Additive foundation only.")[0].replace("  editorial_brief_json JSON NULL,\n", "");
    await db.query(schema);
    await db.query(readFileSync(new URL("../../../../../database/migrations/20261007_radar_suggestions_foundation.sql", import.meta.url), "utf8"));
    await db.query(readFileSync(new URL("../../../../../database/migrations/20261014_radar_editorial_brief.sql", import.meta.url), "utf8"));
    await ensureApprovalStorage(db);
    const migration = readFileSync(new URL("../../../../../database/migrations/20261014_internal_approval_requests.sql", import.meta.url), "utf8");
    for (const [id, name, email, role] of [
      [ids.aline, "Aline", "aline@invalid.test", "admin"], [ids.liege, "Liege", "hello@invalid.test", "super_admin"],
      [ids.carlos, "Carlos", "carlos@invalid.test", "colaborador"], [demoReviewer.id, "Liege", demoReviewer.email, "super_admin"],
    ]) await db.query("INSERT INTO users (id, full_name, email, password_hash, global_role) VALUES (?, ?, ?, 'synthetic-not-a-login', ?)", [id, name, email, role]);
    await db.query("INSERT INTO client_accounts (id,name,slug,portal_title) VALUES (?, 'Synthetic', 'synthetic', 'Synthetic')", [ids.client]);
    for (const id of [ids.aline, ids.carlos]) await db.query("INSERT INTO client_memberships (id,user_id,client_account_id,membership_role) VALUES (?, ?, ?, 'colaborador')", [randomUUID(), id, ids.client]);
    await db.query("INSERT INTO kanban_cards (id,client_account_id,title) VALUES (?, ?, 'Synthetic card')", [ids.card, ids.client]);
    const brief = { concept: "Conceito editorial preservado", hook: "Gancho", description: "Descrição 🎨", rationale: "Justificativa", objective: "Educar", sourceSummary: "Resumo factual da fonte", sourceUrl: "https://example.invalid/source", sourceDate: "2026-10-14" };
    await db.query("UPDATE kanban_cards SET caption = 'Legenda preservada', editorial_brief_json = ?, approval_revision = 2, approval_state = 'pending' WHERE id = ?", [JSON.stringify(brief), ids.card]);
    await recordApprovalEvent(db, { cardId: ids.card, revision: 2, action: "brief_updated", decision: "pending", source: "admin", actor: { userId: ids.aline, name: "Aline", role: "admin" }, before: { editorialBrief: { description: "Versão anterior" } }, after: { editorialBrief: brief } });
    const editorialState = async () => ({
      card: (await db.query<RowDataPacket[]>("SELECT title, caption, editorial_brief_json, approval_revision, approval_state FROM kanban_cards WHERE id = ?", [ids.card]))[0],
      history: (await db.query<RowDataPacket[]>("SELECT * FROM card_approval_events WHERE card_id = ? ORDER BY revision", [ids.card]))[0],
    });
    const editorialBefore = await editorialState();
    const [before] = await db.query<RowDataPacket[]>("SELECT id,email,is_active FROM users ORDER BY id");
    await db.query(migration);
    await db.query(migration);
    const [after] = await db.query<RowDataPacket[]>("SELECT id,email,is_active FROM users ORDER BY id");
    assert.deepEqual(after, before);
    const [fks] = await db.query<RowDataPacket[]>("SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = 'internal_approval_requests'", [database]);
    assert.equal(fks.length, 5); assert.equal(fks.filter((fk) => fk.DELETE_RULE === "CASCADE").length, 2); assert.equal(fks.filter((fk) => fk.DELETE_RULE === "SET NULL").length, 3);
    app.decorate("db", db);
    await app.register(httpErrorsPluginRegistered);
    app.addHook("preHandler", async (request) => { request.auth = auth; });
    await app.register(internalApprovalRoutes, { prefix: "/api" });
    const reviewersUrl = `/api/clients/${ids.client}/internal-approval-reviewers`;
    session(ids.aline, "admin");
    assert.deepEqual((await app.inject(reviewersUrl)).json().items.map((u: { id: string }) => u.id).sort(), [ids.liege, ids.carlos].sort());
    session(ids.liege, "super_admin");
    assert.deepEqual((await app.inject(reviewersUrl)).json().items.map((u: { id: string }) => u.id).sort(), [ids.aline, ids.carlos].sort());
    session(ids.aline, "admin");
    const url = `/api/clients/${ids.client}/cards/${ids.card}/internal-approvals`;
    const sent = await app.inject({ method: "POST", url, payload: { recipientIds: [ids.liege, ids.carlos], message: "Revisão com acentos 🎨" } });
    assert.equal(sent.statusCode, 200, sent.body);
    // Reading after commit through the pool verifies persistence outside the writer.
    const [records] = await db.query<RowDataPacket[]>("SELECT * FROM internal_approval_requests ORDER BY assigned_to_user_id");
    assert.equal(records.length, 2);
    assert.deepEqual(records.map((r) => r.assigned_to_user_id).sort(), [ids.liege, ids.carlos].sort());
    assert.ok(records.every((r) => r.requested_by_user_id === ids.aline && r.comment_id === sent.json().commentId));
    session(ids.liege, "super_admin");
    const inbox = (await app.inject("/api/internal-approvals/inbox")).json().items;
    assert.equal(inbox.length, 1); assert.deepEqual(inbox[0].recipients, [ids.liege]);
    assert.equal(inbox[0].message, "Revisão com acentos 🎨");
    assert.equal(inbox[0].requestedByUserId, ids.aline);
    assert.equal(inbox[0].commentId, sent.json().commentId);
    assert.deepEqual(await editorialState(), editorialBefore);
    session(demoReviewer.id, "super_admin");
    assert.deepEqual((await app.inject("/api/internal-approvals/inbox")).json().items, []);
    // Force a native failure after the comment is inserted, to verify rollback.
    await db.query("CREATE TRIGGER fail_synthetic_request BEFORE INSERT ON internal_approval_requests FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic failure'");
    session(ids.aline, "admin");
    assert.equal((await app.inject({ method: "POST", url, payload: { recipientIds: [ids.liege], message: "Must roll back" } })).statusCode, 500);
    const [counts] = await db.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM card_comments) AS comments, (SELECT COUNT(*) FROM internal_approval_requests) AS requests, comments_count_cache FROM kanban_cards WHERE id = ?", [ids.card]);
    assert.deepEqual(await editorialState(), editorialBefore);
    assert.equal(counts[0].comments, 1); assert.equal(counts[0].requests, 2); assert.equal(counts[0].comments_count_cache, 1);
    const [version] = await server.query<RowDataPacket[]>("SELECT VERSION() AS version, @@skip_networking AS skipNetworking");
    console.log(version[0]);
  } finally {
    await app.close(); await db.end(); await server.query(`DROP DATABASE \`${database}\``); await server.end();
  }
});

test("MariaDB: administrative recovery and internal approvals cooperate without losing requests or rewriting editorial history", async () => {
  const server = await mysql.createConnection({ socketPath, user: "root", multipleStatements: true });
  const database = `internal_recovery_test_${randomUUID().replace(/-/g, "")}`;
  await server.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const db = mysql.createPool({ socketPath, user: "root", database, multipleStatements: true, timezone: "Z", jsonStrings: true });
  const app = Fastify();
  const ids = { aline: randomUUID(), liege: randomUUID(), client: randomUUID(), card: randomUUID(), idea: randomUUID() };
  let auth: AuthContext;
  const session = (id: string, globalRole: "admin" | "super_admin") => {
    auth = { user: { id, fullName: id === ids.aline ? "Aline" : "Liege", email: "session@invalid.test", globalRole, isActive: true, locale: "pt", avatarUrl: null }, memberships: globalRole === "super_admin" ? [] : [{ clientAccountId: ids.client, membershipRole: "admin", portalAccessLevel: "admin", isPrimary: true, clientSlug: "synthetic", clientName: "Synthetic", ownerUserId: null }] };
  };
  const query = async (sql: string, params: unknown[] = []) => (await db.query<RowDataPacket[]>(sql, params))[0];
  try {
    await db.query(readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8").split("-- Additive foundation only.")[0]);
    for (const name of ["20261007_radar_suggestions_foundation.sql", "20261014_radar_editorial_brief.sql", "20261014_internal_approval_requests.sql"]) {
      await db.query(readFileSync(new URL(`../../../../../database/migrations/${name}`, import.meta.url), "utf8"));
    }
    await ensureApprovalStorage(db);
    for (const [id, name, email, role] of [[ids.aline, "Aline", "aline@invalid.test", "admin"], [ids.liege, "Liege", "hello@invalid.test", "super_admin"], [demoReviewer.id, "Liege", demoReviewer.email, "super_admin"]]) {
      await db.query("INSERT INTO users(id,full_name,email,password_hash,global_role) VALUES(?,?,?,'synthetic-not-a-login',?)", [id, name, email, role]);
    }
    await db.query("INSERT INTO client_accounts(id,name,slug,portal_title,workspace_drawer_json) VALUES(?,'Synthetic','synthetic','Portal','{}')", [ids.client]);
    await db.query("INSERT INTO client_memberships(id,user_id,client_account_id,membership_role) VALUES(?,?,?,'admin')", [randomUUID(), ids.aline, ids.client]);
    const suggestion = (await new RadarSuggestionsService(new RadarSuggestionsRepository(db)).createPending(ids.client, ids.aline, sample({ sourceSummary: "Resumo factual preservado", concept: "Conceito original recuperável" }))).suggestion;
    await db.query("UPDATE radar_suggestions SET status='accepted',accepted_pauta_id=? WHERE id=?", [ids.idea, suggestion.id]);
    const idea = { id: ids.idea, cardId: ids.card, radarSuggestionId: suggestion.id, status: "sent", title: suggestion.title, description: suggestion.description, caption: "Legenda humana preservada" };
    await db.query("UPDATE client_accounts SET workspace_drawer_json=? WHERE id=?", [JSON.stringify({ pautaIdeas: [idea], links: ["preservar"] }), ids.client]);
    await db.query("INSERT INTO kanban_cards(id,client_account_id,title,caption,is_brief_approval,status_json,tags_json,media_urls_json) VALUES(?,?,?,'Legenda humana preservada',1,'[\"Enviar para Cliente\"]','[]','[\"/synthetic.png\"]')", [ids.card, ids.client, idea.title]);
    await db.query("INSERT INTO approval_links(id,client_account_id,card_id,token,expires_at,is_active) VALUES(?,?,?,'synthetic-old-link','2099-01-01',1)", [randomUUID(), ids.client, ids.card]);
    app.decorate("db", db); app.decorate("appEnv", { JWT_SECRET: "synthetic-internal-recovery-test-secret" } as never);
    await app.register(httpErrorsPluginRegistered);
    app.addHook("preHandler", async (request) => { request.auth = auth; });
    await app.register(clientRoutes, { prefix: "/api" });
    await app.register(internalApprovalRoutes, { prefix: "/api" });
    session(ids.aline, "admin");
    const base = `/api/clients/${ids.client}/cards/${ids.card}`;
    const state = async () => ({
      card: await query("SELECT title,caption,editorial_brief_json,approval_revision,approval_state,status_json,tags_json,media_urls_json FROM kanban_cards WHERE id=?", [ids.card]),
      bank: await query("SELECT workspace_drawer_json FROM client_accounts WHERE id=?", [ids.client]),
      events: await query("SELECT * FROM card_approval_events WHERE card_id=? ORDER BY revision", [ids.card]),
      links: await query("SELECT * FROM approval_links WHERE card_id=?", [ids.card]),
      source: await query("SELECT * FROM radar_suggestions WHERE id=?", [suggestion.id]),
    });
    const preview = async () => {
      const response = await app.inject(`${base}/editorial-brief-recovery/preview`);
      assert.equal(response.statusCode, 200, response.body); assert.equal(response.json().eligible, true);
      return response.json().previewToken as string;
    };
    const before = await state(), staleToken = await preview();
    assert.deepEqual(await state(), before);
    const reviewers = (await app.inject(`/api/clients/${ids.client}/internal-approval-reviewers`)).json().items;
    assert.deepEqual(reviewers.map((u: { id: string }) => u.id), [ids.liege]);
    const send = () => app.inject({ method: "POST", url: `${base}/internal-approvals`, payload: { recipientIds: [ids.liege], message: "Revisar briefing" } });
    const first = await send(); assert.equal(first.statusCode, 200, first.body);
    assert.deepEqual(await state(), before);
    // Internal comments change the inspected card: an older recovery preview must be refreshed.
    const stale = await app.inject({ method: "POST", url: `${base}/editorial-brief-recovery`, payload: { previewToken: staleToken, confirm: true } });
    assert.equal(stale.statusCode, 409, stale.body); assert.deepEqual(await state(), before);
    const token = await preview();
    const restored = await app.inject({ method: "POST", url: `${base}/editorial-brief-recovery`, payload: { previewToken: token, confirm: true } });
    assert.equal(restored.statusCode, 200, restored.body);
    const recovered = await state();
    assert.equal(JSON.parse(recovered.card[0].editorial_brief_json).concept, "Conceito original recuperável");
    assert.equal(recovered.card[0].caption, "Legenda humana preservada"); assert.equal(recovered.card[0].approval_revision, 1);
    assert.deepEqual(recovered.events.map((event) => event.action), ["legacy_snapshot", "brief_restored"]);
    assert.equal(recovered.links[0].is_active, 0); assert.deepEqual(recovered.source, before.source);
    const second = await send(); assert.equal(second.statusCode, 200, second.body); assert.deepEqual(await state(), recovered);
    const replay = await app.inject({ method: "POST", url: `${base}/editorial-brief-recovery`, payload: { previewToken: token, confirm: true } });
    assert.equal(replay.statusCode, 200, replay.body); assert.equal(replay.json().alreadyApplied, true); assert.deepEqual(await state(), recovered);
    session(ids.liege, "super_admin");
    const inbox = (await app.inject("/api/internal-approvals/inbox")).json().items;
    assert.equal(inbox.length, 2);
    assert.ok(inbox.every((item: { recipients: string[]; requestedByUserId: string; cardId: string }) => item.recipients[0] === ids.liege && item.requestedByUserId === ids.aline && item.cardId === ids.card));
    assert.deepEqual(inbox.map((item: { commentId: string }) => item.commentId).sort(), [first.json().commentId, second.json().commentId].sort());
    session(demoReviewer.id, "super_admin"); assert.deepEqual((await app.inject("/api/internal-approvals/inbox")).json().items, []);
  } finally { await app.close(); await db.end(); await server.query(`DROP DATABASE \`${database}\``); await server.end(); }
});
