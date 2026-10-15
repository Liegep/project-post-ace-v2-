import { editPautaIdea } from "../clients/pauta-edit.service.js";
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
import { updateKanbanCard, moveKanbanCard, moveKanbanCardToScheduledColumn } from "../cards/cards.service.js";
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
  for (const name of ["kanban_cards", "kanban_columns", "card_comments", "approval_links", "card_calendar_events", "card_caption_versions"]) {
    create(schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${name} \\([\\s\\S]*?\\) ENGINE[^;]*;`))![0]);
  }
  create(approvalHistoryTableSql);
  sql.exec("CREATE UNIQUE INDEX approval_revision_unique ON card_approval_events(card_id, revision)");
  sql.exec("CREATE TABLE client_accounts (id TEXT, name TEXT, logo_url TEXT, workspace_drawer_json TEXT, kanban_automations_json TEXT); CREATE TABLE users (id TEXT, avatar_url TEXT)");
  sql.exec("INSERT INTO client_accounts VALUES ('account', 'Conta', NULL, '{}', '[]'); INSERT INTO users VALUES ('client-user', NULL)");
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
    if (statement.startsWith("CREATE TABLE IF NOT EXISTS card_caption_versions")) return [{affectedRows:0},[]];
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
  app.decorate("appEnv", { APP_TIMEZONE: "Europe/Stockholm" } as never);
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

test("a deliberate card move survives secondary updates and startup reconciliation", async () => {
  const f = await fixture();
  try {
    await decideCardApproval(f.app, "account", "post", client, { approved: true });
    const moved = await moveKanbanCard(f.app, "account", "post", { columnId: "work" }, { id: "admin", fullName: "Equipe", globalRole: "admin" });
    assert.equal(moved.columnId, "work");
    await updateCard(f.pool, "post", { caption: "Legenda depois da movimentação", status: ["Design Pronto"] });
    assert.equal((await findCardById(f.pool, "post"))!.columnId, "work");
    await reconcileApprovedCardColumns(f.app);
    assert.equal((await findCardById(f.pool, "post"))!.columnId, "work");
  } finally { await f.close(); }
});

test("Meta scheduling destination is reused, does not touch internal schedule and skips pending pautas", async () => {
  const f = await fixture();
  const actor = { id: "admin", fullName: "Equipe", globalRole: "admin" };
  try {
    const first = await moveKanbanCardToScheduledColumn(f.app, "account", "post", actor);
    assert.equal(f.sql.prepare("SELECT name FROM kanban_columns WHERE id = ?").get(first.columnId!)!.name, "Agendados");
    assert.equal(first.scheduledAt, null);
    await moveKanbanCardToScheduledColumn(f.app, "account", "post", actor);
    assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM kanban_columns WHERE LOWER(name) = 'agendados'").get()!.n, 1);
    f.sql.exec("INSERT INTO kanban_cards (id, client_account_id, column_id, title, status_json, tags_json, media_urls_json, client_label, is_brief_approval) VALUES ('pending-pauta', 'account', 'work', 'Pauta', '[\"Enviar para Cliente\"]', '[]', '[]', 'Pendente', 1)");
    const pending = await moveKanbanCardToScheduledColumn(f.app, "account", "pending-pauta", actor);
    assert.equal(pending.columnId, "work");
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

test("approval decisions and later revisions keep the client briefing snapshot immutable", async () => {
 const f=await fixture();try {
  const original={concept:"Original concept",sourceSummary:"Original factual context",sourceUrl:"https://example.invalid/news",sourceDate:"2026-10-14"};
  f.sql.prepare("UPDATE kanban_cards SET editorial_brief_json=?").run(JSON.stringify(original));
  await decideCardApproval(f.app,"account","post",client,{approved:true});
  const event=f.sql.prepare("SELECT after_json FROM card_approval_events WHERE revision=1").get()!;
  assert.deepEqual(JSON.parse(event.after_json as string).editorialBrief,original);
  await resubmitCardApproval(f.app,"account","post",admin,1);
  await updateCard(f.pool,"post",{editorialBrief:{concept:"Revised direction"},expectedApprovalRevision:2});
  assert.deepEqual(JSON.parse(f.sql.prepare("SELECT after_json FROM card_approval_events WHERE revision=1").get()!.after_json as string).editorialBrief,original);
 } finally {await f.close();}
});

function seedSentPauta(f: Awaited<ReturnType<typeof fixture>>) {
 const idea={id:"idea",cardId:"post",status:"sent",title:"Post de teste",caption:"Legenda original",description:"Original description",concept:"Original direction",sourceSummary:"Original factual source",sourceDate:"2026-10-14"};
 f.sql.prepare("UPDATE client_accounts SET workspace_drawer_json=?").run(JSON.stringify({pautaIdeas:[idea],links:["preserve"]}));
 f.sql.prepare("UPDATE kanban_cards SET is_brief_approval=1,approval_state='pending',editorial_brief_json=?").run(JSON.stringify({concept:idea.concept,description:idea.description,sourceSummary:idea.sourceSummary,sourceDate:idea.sourceDate}));
 f.sql.exec("INSERT INTO approval_links(id,client_account_id,card_id,token,expires_at,is_active) VALUES('active-link','account','post','old-token','2099-01-01',1)");
 return idea;
}
const editorialActor={id:"admin",fullName:"Equipe",globalRole:"admin"};

test("sent pauta editing updates bank, card and frozen history atomically and fences stale approvals",async()=>{
 const f=await fixture();try {
  seedSentPauta(f);
  const result=await editPautaIdea(f.app,"account","idea",{description:"Revised proposal",caption:"Revised caption",expectedApprovalRevision:0},editorialActor);
  assert.equal(result.card!.approvalRevision,1);assert.equal(result.card!.editorialBrief!.description,"Revised proposal");
  assert.equal(result.card!.editorialBrief!.sourceSummary,"Original factual source");
  const drawer=JSON.parse(f.sql.prepare("SELECT workspace_drawer_json FROM client_accounts").get()!.workspace_drawer_json as string);
  assert.equal(drawer.pautaIdeas[0].description,"Revised proposal");assert.equal(drawer.pautaIdeas[0].expectedApprovalRevision,undefined);assert.deepEqual(drawer.links,["preserve"]);
  const event=f.sql.prepare("SELECT action,before_json,after_json FROM card_approval_events WHERE revision=1").get()!;
  assert.equal(event.action,"brief_updated");assert.equal(JSON.parse(event.before_json as string).editorialBrief.description,"Original description");assert.equal(JSON.parse(event.after_json as string).editorialBrief.description,"Revised proposal");
  assert.equal(f.sql.prepare("SELECT caption FROM card_caption_versions").get()!.caption,"Legenda original");
  await assert.rejects(decideCardApproval(f.app,"account","post",client,{approved:true,expectedApprovalRevision:0}),{statusCode:409});
  await assert.rejects(decideCardApproval(f.app,"account","post",client,{approved:true},"old-token"),{statusCode:403});
  await assert.rejects(editPautaIdea(f.app,"account","idea",{caption:"Stale edit",expectedApprovalRevision:0},editorialActor),{statusCode:409});
  const replay=await editPautaIdea(f.app,"account","idea",{description:"Revised proposal",caption:"Revised caption",expectedApprovalRevision:0},editorialActor);
  assert.equal(replay.card!.approvalRevision,1);assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM card_approval_events").get()!.n,1);
 } finally {await f.close();}
});
test("real card approval blocks a stale bank edit without rewriting either record",async()=>{
 const f=await fixture();try {
  seedSentPauta(f);await decideCardApproval(f.app,"account","post",client,{approved:true,expectedApprovalRevision:0});
  const bank=f.sql.prepare("SELECT workspace_drawer_json FROM client_accounts").get()!.workspace_drawer_json;
  await assert.rejects(editPautaIdea(f.app,"account","idea",{caption:"Unapproved replacement",expectedApprovalRevision:1},editorialActor),{statusCode:409});
  assert.equal(f.sql.prepare("SELECT workspace_drawer_json FROM client_accounts").get()!.workspace_drawer_json,bank);
  assert.equal((await findCardById(f.pool,"post"))!.caption,"Legenda original");
 } finally {await f.close();}
});
test("sent edit audit failure rolls back card, bank, caption history and link invalidation together",async()=>{
 const f=await fixture();try {
  seedSentPauta(f);const before=f.sql.prepare("SELECT workspace_drawer_json FROM client_accounts").get()!.workspace_drawer_json;f.failAudit();
  await assert.rejects(editPautaIdea(f.app,"account","idea",{caption:"Uncommitted caption",expectedApprovalRevision:0},editorialActor),/audit failure/);
  assert.equal(f.sql.prepare("SELECT workspace_drawer_json FROM client_accounts").get()!.workspace_drawer_json,before);
  const card=(await findCardById(f.pool,"post"))!;assert.equal(card.approvalRevision,0);assert.equal(card.caption,"Legenda original");
  assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM card_caption_versions").get()!.n,0);assert.equal(f.sql.prepare("SELECT is_active FROM approval_links").get()!.is_active,1);
 } finally {await f.close();}
});

test("editing a requested change preserves the client's decision until explicit resubmission",async()=>{
 const f=await fixture();try {
  seedSentPauta(f);await decideCardApproval(f.app,"account","post",client,{approved:false,expectedApprovalRevision:0});
  const result=await editPautaIdea(f.app,"account","idea",{description:"Addressed requested change",expectedApprovalRevision:1},editorialActor);
  assert.equal(result.card!.approvalRevision,2);assert.equal(result.card!.approvalState,"changes_requested");
  const resent=await resubmitCardApproval(f.app,"account","post",admin,2);
  assert.equal(resent.card.approvalState,"pending");assert.equal(resent.card.approvalRevision,3);
  const old=f.sql.prepare("SELECT decision FROM card_approval_events WHERE revision=1").get()!;
  assert.equal(old.decision,"changes_requested");
 } finally {await f.close();}
});

test("a pauta context edit preserves caption and media independently edited on the card",async()=>{
 const f=await fixture();try {
  seedSentPauta(f);f.sql.prepare("UPDATE kanban_cards SET caption=?,media_urls_json=?,primary_media_url=?").run("Independently edited caption",'["/api/uploads/kept.png"]',"/api/uploads/kept.png");
  const result=await editPautaIdea(f.app,"account","idea",{description:"Revised contextual direction",mediaUrls:[],expectedApprovalRevision:0},editorialActor);
  assert.equal(result.card!.caption,"Independently edited caption");assert.deepEqual(result.card!.mediaUrls,["/api/uploads/kept.png"]);
  assert.equal(result.card!.editorialBrief!.description,"Revised contextual direction");assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM card_caption_versions").get()!.n,0);
 } finally {await f.close();}
});

test("invalid new source metadata is rejected without silently dropping the preserved briefing",async()=>{
 const f=await fixture();try {
  seedSentPauta(f);const original=f.sql.prepare("SELECT workspace_drawer_json FROM client_accounts").get()!.workspace_drawer_json;
  await assert.rejects(editPautaIdea(f.app,"account","idea",{sourceUrl:"javascript:alert(1)",expectedApprovalRevision:0},editorialActor),{statusCode:400});
  assert.equal(f.sql.prepare("SELECT workspace_drawer_json FROM client_accounts").get()!.workspace_drawer_json,original);assert.equal((await findCardById(f.pool,"post"))!.approvalRevision,0);
 } finally {await f.close();}
});

test("converted post rejects a stale pauta flag even after adopting the current revision; ordinary edits preserve its cycle", async () => {
 const f = await fixture(); const actor = {id:"admin",fullName:"Equipe",globalRole:"admin"};
 try {
  f.sql.exec("UPDATE kanban_cards SET is_brief_approval = 1");
  await decideCardApproval(f.app,"account","post",client,{approved:true});
  const converted = await moveKanbanCard(f.app,"account","post",{columnId:"work"},actor);
  const original = {card:converted, events:f.sql.prepare("SELECT * FROM card_approval_events ORDER BY revision").all(), comments:f.sql.prepare("SELECT * FROM card_comments").all()};
  for (const expectedApprovalRevision of [undefined,converted.approvalRevision-1,converted.approvalRevision]) {
   await assert.rejects(updateKanbanCard(f.app,"account","post",{expectedApprovalRevision,isBriefApproval:true,caption:"Must not be saved",status:[]},actor),{statusCode:409});
   assert.deepEqual(await findCardById(f.pool,"post"),original.card);
   assert.deepEqual(f.sql.prepare("SELECT * FROM card_approval_events ORDER BY revision").all(),original.events);
   assert.deepEqual(f.sql.prepare("SELECT * FROM card_comments").all(),original.comments);
  }
  const edited = await updateKanbanCard(f.app,"account","post",{expectedApprovalRevision:converted.approvalRevision,caption:"Intended edit"},actor);
  assert.equal(edited.isBriefApproval,false); assert.equal(edited.approvalRevision,converted.approvalRevision);
  assert.equal(edited.approvalState,"pending");assert.deepEqual(edited.mediaUrls,converted.mediaUrls);
  assert.ok(edited.status.includes("Enviar para Cliente"));
 } finally {await f.close();}
});

test("SQL flag guard rejects a late stale writer atomically, including without a revision",async()=>{
 const f=await fixture();try {
  f.sql.exec("UPDATE kanban_cards SET is_brief_approval=1");
  await decideCardApproval(f.app,"account","post",client,{approved:true});
  const converted=await moveKanbanCard(f.app,"account","post",{columnId:"work"},{id:"admin",fullName:"Equipe",globalRole:"admin"});
  for(const expectedApprovalRevision of [undefined,converted.approvalRevision]){
   await assert.rejects(updateCard(f.pool,"post",{isBriefApproval:true,expectedApprovalRevision,caption:"Stale",mediaUrls:[]}),{statusCode:409});
   assert.deepEqual(await findCardById(f.pool,"post"),converted);
  }
 }finally{await f.close();}
});

test("explicit pauta conversion still preserves content and history and stays a post through reconciliation",async()=>{
 const f=await fixture();try{
  f.sql.exec("UPDATE kanban_cards SET is_brief_approval=1");
  const original=await findCardById(f.pool,"post");
  const converted=await updateKanbanCard(f.app,"account","post",{isBriefApproval:false,expectedApprovalRevision:0},{id:"admin",fullName:"Equipe",globalRole:"admin"});
  assert.equal(converted.isBriefApproval,false);assert.equal(converted.approvalState,"pending");
  assert.equal(converted.caption,original!.caption);assert.deepEqual(converted.mediaUrls,original!.mediaUrls);
  await reconcileApprovedCardColumns(f.app);assert.equal((await findCardById(f.pool,"post"))!.isBriefApproval,false);
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM kanban_cards").get()!.n,1);
  assert.deepEqual(f.sql.prepare("SELECT action FROM card_approval_events ORDER BY revision").all().map(x=>x.action),["legacy_snapshot","converted_to_post"]);
 }finally{await f.close();}
});
