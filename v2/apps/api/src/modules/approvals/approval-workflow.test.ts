import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";
import Fastify from "fastify";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { approvalHistoryTableSql } from "./approval-history.repository.js";
import { convertBriefApprovalToPost, decideCardApproval, resubmitCardApproval } from "./approval-workflow.service.js";
import { approvalStatuses, inferredApprovalState, resendBlockedReason } from "./approval-state.js";
import { findCardById, updateCard } from "../cards/cards.repository.js";
import { reconcileApprovedCardColumns } from "./approvals.service.js";
import { approvalRoutes } from "./approvals.routes.js";
import { portalRoutes } from "../portal/portal.routes.js";

const admin = { userId: "admin", name: "Equipe", role: "admin" as const };
const client = { userId: "client-user", name: "Cliente", role: "cliente" as const };

// Execute the real repositories against an isolated SQL database. Only MySQL
// dialect details are translated; production migration/row locking still need MySQL.
async function fixture() {
  const sql = new DatabaseSync(":memory:");
  const schema = readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8");
  const create = (ddl: string) => {
    const name = ddl.match(/CREATE TABLE(?: IF NOT EXISTS)? (\w+)/)![1];
    const columns = ddl.split("\n").filter((line) => /^\s+\w+\s+(CHAR|VARCHAR|TEXT|LONGTEXT|JSON|TINYINT|INT|DATETIME|TIMESTAMP|ENUM)/.test(line))
      .map((line) => line.trim().replace(/,$/, "").replace(/ENUM\([^)]*\)/g, "TEXT").replace(/ ON UPDATE CURRENT_TIMESTAMP(?:\(3\))?/g, "").replace(/CURRENT_TIMESTAMP\(3\)/g, "CURRENT_TIMESTAMP").replace(/\bUNSIGNED\b/g, ""));
    sql.exec(`CREATE TABLE ${name} (${columns.join(", ")})`);
  };
  for (const name of ["kanban_cards", "kanban_columns", "card_comments", "approval_links"]) {
    create(schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${name} \\([\\s\\S]*?\\) ENGINE[^;]*;`))![0]);
  }
  create(approvalHistoryTableSql);
  sql.exec("CREATE UNIQUE INDEX approval_revision_unique ON card_approval_events(card_id, revision)");
  sql.exec("CREATE TABLE client_accounts (id TEXT, name TEXT, logo_url TEXT, workspace_drawer_json TEXT); CREATE TABLE users (id TEXT, avatar_url TEXT)");
  sql.exec("INSERT INTO client_accounts VALUES ('account', 'Conta', NULL, '{}'); INSERT INTO users VALUES ('client-user', NULL)");
  sql.exec(`INSERT INTO kanban_columns (id, client_account_id, name, position, visible_to_client, auto_created) VALUES ('work', 'account', 'Em criação', 0, 1, 0), ('approved', 'account', 'Aprovados', 1, 1, 0)`);
  sql.exec(`INSERT INTO kanban_cards (id, client_account_id, column_id, title, caption, status_json, tags_json, media_urls_json, client_label)
    VALUES ('post', 'account', 'work', 'Post de teste', 'Legenda original', '["Enviar para Cliente","Design Pronto"]', '["Campanha"]', '["/api/uploads/art.png"]', 'Pendente')`);
  sql.exec("CREATE TABLE card_activity_events (id TEXT, client_account_id TEXT, card_id TEXT, actor_user_id TEXT, actor_name TEXT, actor_role TEXT, activity_type TEXT, detail TEXT, occurred_at TEXT DEFAULT CURRENT_TIMESTAMP)");
  let failEvent = false;
  let queue: Promise<void> = Promise.resolve();
  const query = async (statement: string, values: unknown[] = []) => {
    if (failEvent && statement.includes("INSERT INTO card_approval_events")) throw new Error("simulated audit failure");
    // Legacy pauta recovery is unrelated to these fixtures; no fixture is in the pauta bank.
    if (statement.startsWith("UPDATE kanban_cards c INNER JOIN")) return [{ affectedRows: 0 }, []];
    const translated = statement.replace(/ FOR UPDATE/g, "").replace(/<=>/g, "IS")
      .replace(/DATE_FORMAT\((\w+), '[^']+'\)/g, "$1")
      .replace(/UPDATE kanban_cards c SET c.column_id/g, "UPDATE kanban_cards AS c SET column_id")
      .replace(/, c.client_label =/g, ", client_label =");
    const args = values.map((value) => value instanceof Date ? value.toISOString() : value) as Array<string | number | null>;
    const prepared = sql.prepare(translated);
    if (/^\s*SELECT/i.test(translated)) return [prepared.all(...args), []];
    return [{ affectedRows: Number(prepared.run(...args).changes) }, []];
  };
  const pool = { query, getConnection: async () => {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    return { query, beginTransaction: async () => { sql.exec("BEGIN"); }, commit: async () => { sql.exec("COMMIT"); }, rollback: async () => { sql.exec("ROLLBACK"); }, release };
  } } as unknown as Pool;
  const app = Fastify();
  app.decorate("db", pool);
  await app.register(httpErrorsPluginRegistered);
  await app.ready();
  return { app, sql, pool, failAudit: () => { failEvent = true; }, close: async () => { await app.close(); sql.close(); } };
}

test("complete cycle preserves comments, authors, timestamps, media and internal approvals", async () => {
  const f = await fixture();
  try {
    const requested = await decideCardApproval(f.app, "account", "post", client, { approved: false, commentText: "Trocar a cor", expectedApprovalRevision: 0 });
    assert.equal(requested.card.approvalState, "changes_requested");
    const originalComment = f.sql.prepare("SELECT * FROM card_comments").get();
    await updateCard(f.pool, "post", { caption: "Legenda corrigida", expectedApprovalRevision: 1 });
    const resent = await resubmitCardApproval(f.app, "account", "post", admin, 1);
    assert.equal(resent.card.id, "post");
    assert.equal(resent.card.columnId, "work");
    assert.equal(resent.card.approvalState, "pending");
    assert.deepEqual(resent.card.status, ["Enviar para Cliente", "Design Pronto"]);
    assert.deepEqual(resent.card.tags, ["Campanha"]);
    assert.deepEqual(resent.card.mediaUrls, ["/api/uploads/art.png"]);
    assert.deepEqual(f.sql.prepare("SELECT * FROM card_comments").get(), originalComment);
    const approved = await decideCardApproval(f.app, "account", "post", client, { approved: true, expectedApprovalRevision: 2 });
    assert.equal(approved.card.columnId, "approved");
    assert.equal(approved.card.approvalState, "approved");
    const events = f.sql.prepare("SELECT action, actor_user_id, before_json FROM card_approval_events ORDER BY revision").all();
    assert.deepEqual(events.map((event) => event.action), ["legacy_snapshot", "changes_requested", "resubmitted", "approved"]);
    assert.equal(events[1].actor_user_id, "client-user");
    assert.equal(events[2].actor_user_id, "admin");
    assert.equal(JSON.parse(String(events[1].before_json)).caption, "Legenda original");
    assert.deepEqual(approvalStatuses(["Aprovado", "Revisão solicitada", "Aprovado pela boss ❤️", "Design Pronto"], "pending"), ["Enviar para Cliente", "Aprovado pela boss ❤️", "Design Pronto"]);
    assert.equal(resendBlockedReason({ archived: false, publishedAt: null, scheduledAt: null, status: ["Finalizado"] }), null);
    assert.deepEqual(approvalStatuses(["Finalizado", "Revisão solicitada"], "pending"), ["Enviar para Cliente", "Finalizado"]);
  } finally { await f.close(); }
});

test("historical approval never revives a resent card; old links cannot decide again", async () => {
  const f = await fixture();
  try {
    f.sql.exec("INSERT INTO approval_links (id, client_account_id, card_id, token, expires_at, is_active, approved_at) VALUES ('old', 'account', 'post', 'old-token', '2099-01-01', 1, '2026-01-01')");
    f.sql.exec("UPDATE kanban_cards SET column_id = 'approved', client_label = 'Alteração solicitada', status_json = '[\"Aprovado\",\"Revisão solicitada\"]'");
    const result = await resubmitCardApproval(f.app, "account", "post", admin, 0);
    assert.notEqual(result.card.columnId, "approved");
    assert.ok(result.card.columnId);
    await reconcileApprovedCardColumns(f.app);
    assert.equal((await findCardById(f.pool, "post"))!.approvalState, "pending");
    assert.equal((await findCardById(f.pool, "post"))!.columnId, result.card.columnId);
    assert.equal(f.sql.prepare("SELECT approved_at FROM approval_links WHERE id = 'old'").get()!.approved_at, "2026-01-01");
    await assert.rejects(decideCardApproval(f.app, "account", "post", client, { approved: true }, "old-token"), { statusCode: 403 });
    const decision = await decideCardApproval(f.app, "account", "post", { userId: null, name: "Visitante", role: "guest" }, { approved: false, commentText: "Mais um ajuste" }, result.approvalLink.token);
    assert.equal(decision.card.approvalState, "changes_requested");
    assert.equal(decision.card.status.includes("Aprovado"), false);
    assert.equal(decision.approvalLink!.isActive, false);
    await assert.rejects(decideCardApproval(f.app, "account", "post", client, { approved: true }, result.approvalLink.token), { statusCode: 403 });
  } finally { await f.close(); }
});

test("legacy Alterado tag is recognized as a changes request that can be resent", async () => {
  const f = await fixture();
  try {
    f.sql.exec("UPDATE kanban_cards SET client_label = 'Pendente', status_json = '[\"Design Pronto\"]', tags_json = '[\"Alterado\"]'");
    const legacyCard = (await findCardById(f.pool, "post"))!;
    assert.equal(inferredApprovalState(legacyCard), "changes_requested");

    const resent = await resubmitCardApproval(f.app, "account", "post", admin, 0);
    assert.equal(resent.card.approvalState, "pending");
    assert.equal(resent.card.status.includes("Enviar para Cliente"), true);
    assert.deepEqual(resent.card.tags, ["Alterado"]);
  } finally { await f.close(); }
});

test("failed audit rolls back status, comments and token changes", async () => {
  const f = await fixture();
  try {
    await decideCardApproval(f.app, "account", "post", client, { approved: false });
    const before = await findCardById(f.pool, "post");
    f.failAudit();
    await assert.rejects(resubmitCardApproval(f.app, "account", "post", admin, 1), /simulated audit failure/);
    assert.deepEqual(await findCardById(f.pool, "post"), before);
    assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM approval_links").get()!.n, 0);
    await assert.rejects(decideCardApproval(f.app, "account", "post", client, { approved: true, commentText: "Não deve ficar salvo", expectedApprovalRevision: 1 }), /simulated audit failure/);
    assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM card_comments").get()!.n, 0);
    assert.deepEqual(await findCardById(f.pool, "post"), before);
  } finally { await f.close(); }
});

test("duplicate resend and stale decisions/edits cannot overwrite a new revision", async () => {
  const f = await fixture();
  try {
    await decideCardApproval(f.app, "account", "post", client, { approved: false });
    const attempts = await Promise.allSettled([resubmitCardApproval(f.app, "account", "post", admin, 1), resubmitCardApproval(f.app, "account", "post", admin, 1)]);
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
    await assert.rejects(updateCard(f.pool, "post", { caption: "stale", expectedApprovalRevision: 1 }), { statusCode: 409 });
    await assert.rejects(decideCardApproval(f.app, "account", "post", client, { approved: true, expectedApprovalRevision: 1 }), { statusCode: 409 });
    assert.equal((await findCardById(f.pool, "post"))!.caption, "Legenda original");
    assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM card_approval_events WHERE action = 'resubmitted'").get()!.n, 1);
  } finally { await f.close(); }
});

test("resend preserves scheduled, published and archived posts by refusing implicit resets", async () => {
  for (const field of ["scheduled_at = '2099-01-01 12:00:00'", "published_at = '2026-01-01'", "archived = 1"]) {
    const f = await fixture();
    try {
      f.sql.exec(`UPDATE kanban_cards SET client_label = 'Alteração solicitada', ${field}`);
      const before = await findCardById(f.pool, "post");
      await assert.rejects(resubmitCardApproval(f.app, "account", "post", admin, 0), { statusCode: 409 });
      assert.deepEqual(await findCardById(f.pool, "post"), before);
    } finally { await f.close(); }
  }
});

test("pautas keep their separate approved destination and approval flag", async () => {
  const f = await fixture();
  try {
    f.sql.exec("UPDATE kanban_cards SET is_brief_approval = 1");
    const approved = await decideCardApproval(f.app, "account", "post", client, { approved: true });
    assert.equal(approved.card.isBriefApproval, true);
    assert.equal(f.sql.prepare("SELECT name FROM kanban_columns WHERE id = ?").get(approved.card.columnId!)!.name, "Pauta aprovada");
    const resent = await resubmitCardApproval(f.app, "account", "post", admin, 1);
    assert.equal(resent.card.isBriefApproval, true);
    assert.equal(resent.card.approvalState, "pending");
  } finally { await f.close(); }
});

test("routes reject clients resending, unrelated accounts and viewer decisions", async () => {
  const app = Fastify();
  await app.register(httpErrorsPluginRegistered);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      user: { id: "user", fullName: "User", email: "test@example.invalid", globalRole: request.headers["x-test-admin"] ? "admin" : "cliente", avatarUrl: null, locale: "pt", isActive: true },
      memberships: [{ clientAccountId: "account", membershipRole: request.headers["x-test-admin"] ? "admin" : "cliente", portalAccessLevel: "viewer", isPrimary: true, clientName: "Conta", clientSlug: "conta", ownerUserId: null }],
    };
  });
  app.decorate("db", { query: async () => [[], []] } as unknown as Pool);
  await app.register(approvalRoutes);
  await app.register(portalRoutes);
  try {
    const clientResend = await app.inject({ method: "POST", url: "/clients/account/cards/post/resubmit-approval", payload: { expectedApprovalRevision: 0 } });
    assert.equal(clientResend.statusCode, 403);
    const otherAccount = await app.inject({ method: "POST", url: "/clients/other/cards/post/resubmit-approval", headers: { "x-test-admin": "1" }, payload: { expectedApprovalRevision: 0 } });
    assert.equal(otherAccount.statusCode, 403);
    const viewer = await app.inject({ method: "POST", url: "/portal/accounts/account/cards/post/decision", payload: { approved: true } });
    assert.equal(viewer.statusCode, 403);
  } finally { await app.close(); }
});


test("pauta conversion preserves its decision and old tokens but requires independent post approval", async () => {
  const f = await fixture();
  try {
    f.sql.exec("UPDATE kanban_cards SET is_brief_approval = 1");
    await decideCardApproval(f.app, "account", "post", client, { approved: true });
    f.sql.exec("INSERT INTO approval_links (id, client_account_id, card_id, token, expires_at, is_active, approved_at) VALUES ('brief-link', 'account', 'post', 'brief-token', '2099-01-01', 1, '2026-01-01')");
    const converted = await convertBriefApprovalToPost(f.app, "account", "post", { id: "admin", fullName: "Equipe", globalRole: "admin" }, {
      expectedApprovalRevision: 1, status: ["Enviar para Cliente", "Pauta aprovada", "Aprovado pela boss ❤️"],
    });
    assert.equal(converted.isBriefApproval, false);
    assert.equal(converted.approvalState, "pending");
    assert.equal(converted.approvalRevision, 2);
    assert.deepEqual(converted.status, ["Enviar para Cliente", "Aprovado pela boss ❤️"]);
    await reconcileApprovedCardColumns(f.app);
    assert.equal((await findCardById(f.pool, "post"))!.approvalState, "pending");
    assert.equal(f.sql.prepare("SELECT approved_at FROM approval_links WHERE id = 'brief-link'").get()!.approved_at, "2026-01-01");
    await assert.rejects(decideCardApproval(f.app, "account", "post", client, { approved: true }, "brief-token"), { statusCode: 403 });
    const result = await decideCardApproval(f.app, "account", "post", client, { approved: true, expectedApprovalRevision: 2 });
    assert.equal(result.card.columnId, "approved");
    assert.deepEqual(f.sql.prepare("SELECT action FROM card_approval_events ORDER BY revision").all().map((row) => row.action), ["legacy_snapshot", "approved", "converted_to_post", "approved"]);
    assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM card_activity_events").get()!.n, 2);
  } finally { await f.close(); }
});
