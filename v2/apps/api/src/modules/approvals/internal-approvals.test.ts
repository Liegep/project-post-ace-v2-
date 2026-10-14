import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import Fastify from "fastify";
import type { Pool } from "mysql2/promise";
import type { AuthContext, AppRole } from "../auth/auth.types.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { internalApprovalRoutes } from "./internal-approvals.routes.js";
import { demoReviewer } from "./internal-reviewers.repository.js";

const aline = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const liege = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const carlos = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const otherAdmin = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const sameName = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const clientUser = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const client = "account";

async function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, full_name TEXT, email TEXT, global_role TEXT, is_active INTEGER, avatar_url TEXT);
    CREATE TABLE client_accounts (id TEXT PRIMARY KEY, slug TEXT, logo_url TEXT);
    CREATE TABLE client_memberships (user_id TEXT, client_account_id TEXT, membership_role TEXT);
    CREATE TABLE kanban_cards (id TEXT PRIMARY KEY, client_account_id TEXT, title TEXT, comments_count_cache INTEGER DEFAULT 0);
    CREATE TABLE card_comments (id TEXT PRIMARY KEY, card_id TEXT, user_id TEXT, author_name TEXT, author_role TEXT, comment_text TEXT, is_internal INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO client_accounts VALUES ('account', 'aurora', NULL), ('other', 'other', NULL);
    INSERT INTO kanban_cards (id,client_account_id,title) VALUES ('card','account','Card para revisar'), ('foreign-card','other','Privado');
  `);
  const migration = readFileSync(new URL("../../../../../database/migrations/20261014_internal_approval_requests.sql", import.meta.url), "utf8");
  const ddl = migration.slice(migration.indexOf("CREATE TABLE"));
  sql.exec(ddl.replace(/  KEY [^\n]*\n/g, "").replace(/\) ENGINE=[^;]*;/, ");"));
  const insert = sql.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, NULL)");
  for (const [id, name, email, role, active] of [
    [aline, "Aline", "aline@example.test", "admin", 1],
    [liege, "Liege Paschoalini", "hello@example.test", "super_admin", 1],
    [demoReviewer.id, "Liege Paschoalini", demoReviewer.email, "super_admin", 1],
    [carlos, "Carlos", "carlos@designhub.local", "colaborador", 1],
    [otherAdmin, "Admin de outra conta", "admin@example.test", "admin", 1],
    [sameName, "Liege Paschoalini", "another@example.test", "admin", 1],
    [clientUser, "Cliente", "client@example.test", "cliente", 1],
    ["inactive", "Inativo", "inactive@example.test", "super_admin", 0],
  ] as const) insert.run(id, name, email, role, active);
  for (const id of [aline, carlos, sameName, clientUser]) sql.prepare("INSERT INTO client_memberships VALUES (?, ?, ?)").run(id, client, id === clientUser ? "cliente" : "colaborador");
  sql.prepare("INSERT INTO client_memberships VALUES (?, 'other', 'admin')").run(otherAdmin);
  // Multiple memberships must not duplicate a reviewer; global Liege needs none.
  sql.prepare("INSERT INTO client_memberships VALUES (?, 'other', 'colaborador')").run(carlos);
  let auth: AuthContext | null = null;
  let failInsert = false;
  const query = async (statement: string, params: unknown[] = []) => {
    if (failInsert && statement.startsWith("INSERT INTO internal_approval_requests")) throw new Error("simulated storage failure");
    const prepared = sql.prepare(statement.replace(/ FOR UPDATE/g, ""));
    const args = params as Array<string | number | null>;
    return /^SELECT/.test(statement) ? [prepared.all(...args), []] : [{ affectedRows: Number(prepared.run(...args).changes) }, []];
  };
  const db = { query, getConnection: async () => ({ query, beginTransaction: async () => { sql.exec("BEGIN"); }, commit: async () => { sql.exec("COMMIT"); }, rollback: async () => { sql.exec("ROLLBACK"); }, release() {} }) } as unknown as Pool;
  const app = Fastify();
  app.decorate("db", db);
  await app.register(httpErrorsPluginRegistered);
  app.addHook("preHandler", async (request) => { request.auth = auth; });
  await app.register(internalApprovalRoutes, { prefix: "/api" });
  const session = (id: string, role: AppRole, accounts = [client]) => {
    auth = { user: { id, globalRole: role, fullName: id === aline ? "Aline" : "Liege", email: "session@example.test", isActive: true, avatarUrl: null, locale: "pt" },
      memberships: accounts.map((id) => ({ clientAccountId: id, membershipRole: "colaborador", portalAccessLevel: "admin", isPrimary: true, clientName: id, clientSlug: id, ownerUserId: null })) };
  };
  return { app, sql, session, logout() { auth = null; }, failStorage() { failInsert = true; }, async close() { await app.close(); sql.close(); } };
}

for (const [name, id, role, expected] of [
  ["Aline", aline, "admin", [carlos, liege, sameName]],
  ["Liege", liege, "super_admin", [aline, carlos, sameName]],
  ["colaborador", carlos, "colaborador", [aline, liege, sameName]],
] as const) {
  test(`sessão de ${name}: revisores corretos, sem próprio usuário nem identidade demo`, async () => {
    const f = await fixture();
    try {
      f.session(id, role);
      const response = await f.app.inject(`/api/clients/${client}/internal-approval-reviewers`);
      assert.equal(response.statusCode, 200);
      const items = response.json().items;
      assert.deepEqual(items.map((u: { id: string }) => u.id).sort(), [...expected].sort());
      assert.equal(items.filter((u: { email: string }) => u.email === "hello@example.test").length, id === liege ? 0 : 1);
      assert.equal(new Set(items.map((u: { id: string }) => u.id)).size, items.length);
    } finally { await f.close(); }
  });
}

test("only the exact bootstrap ID + email is excluded; no name or domain deduplication", async () => {
  const f = await fixture();
  try {
    f.session(aline, "admin");
    f.sql.prepare("UPDATE users SET email = 'human@example.test' WHERE id = ?").run(demoReviewer.id);
    assert.ok((await f.app.inject(`/api/clients/${client}/internal-approval-reviewers`)).json().items.some((u: { id: string }) => u.id === demoReviewer.id));
    f.sql.prepare("UPDATE users SET id = 'different-human-id', email = ? WHERE id = ?").run(demoReviewer.email, demoReviewer.id);
    assert.ok((await f.app.inject(`/api/clients/${client}/internal-approval-reviewers`)).json().items.some((u: { id: string }) => u.id === "different-human-id"));
  } finally { await f.close(); }
});

const sendUrl = `/api/clients/${client}/cards/card/internal-approvals`;
test("Aline sends to legitimate Liege: persisted history and inbox use the same real IDs across sessions", async () => {
  const f = await fixture();
  try {
    f.session(aline, "admin");
    const sent = await f.app.inject({ method: "POST", url: sendUrl, payload: { recipientIds: [liege, liege, carlos], message: "Revisar arte" } });
    assert.equal(sent.statusCode, 200, sent.body);
    assert.deepEqual(sent.json().recipientIds, [liege, carlos]);
    const rows = f.sql.prepare("SELECT * FROM internal_approval_requests ORDER BY assigned_to_user_id").all();
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.requested_by_user_id === aline && r.comment_id === sent.json().commentId));
    const comment = f.sql.prepare("SELECT * FROM card_comments").get()!;
    assert.equal(comment.user_id, aline); assert.equal(comment.is_internal, 1);
    assert.equal(f.sql.prepare("SELECT comments_count_cache FROM kanban_cards WHERE id='card'").get()!.comments_count_cache, 1);
    f.session(liege, "super_admin", []);
    const inbox = (await f.app.inject("/api/internal-approvals/inbox")).json().items;
    assert.equal(inbox.length, 1); assert.deepEqual(inbox[0].recipients, [liege]);
    assert.equal(inbox[0].requestedByUserId, aline); assert.equal(inbox[0].commentId, comment.id);
    f.session(demoReviewer.id, "super_admin", []);
    assert.deepEqual((await f.app.inject("/api/internal-approvals/inbox")).json().items, []);
    f.session(carlos, "colaborador");
    assert.deepEqual((await f.app.inject("/api/internal-approvals/inbox")).json().items[0].recipients, [carlos]);
    f.sql.prepare("DELETE FROM client_memberships WHERE user_id = ?").run(carlos);
    assert.deepEqual((await f.app.inject("/api/internal-approvals/inbox")).json().items, []);
  } finally { await f.close(); }
});

test("forged, self, demo, inactive, foreign-account and stale reviewers cannot write history or notifications", async () => {
  const f = await fixture();
  try {
    f.session(aline, "admin");
    for (const id of [aline, demoReviewer.id, otherAdmin, clientUser, "00000000-0000-4000-8000-000000000000"]) {
      const response = await f.app.inject({ method: "POST", url: sendUrl, payload: { recipientIds: [liege, id], message: "Revisar" } });
      assert.equal(response.statusCode, 400);
    }
    f.sql.prepare("UPDATE users SET is_active = 0 WHERE id = ?").run(liege);
    assert.equal((await f.app.inject({ method: "POST", url: sendUrl, payload: { recipientIds: [liege], message: "Revisar" } })).statusCode, 400);
    assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM card_comments").get()!.n, 0);
    assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM internal_approval_requests").get()!.n, 0);
  } finally { await f.close(); }
});

test("storage failure rolls back comment, counters and notifications", async () => {
  const f = await fixture();
  try {
    f.session(aline, "admin"); f.failStorage();
    assert.equal((await f.app.inject({ method: "POST", url: sendUrl, payload: { recipientIds: [liege], message: "Revisar" } })).statusCode, 500);
    assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM card_comments").get()!.n, 0);
    assert.equal(f.sql.prepare("SELECT comments_count_cache FROM kanban_cards WHERE id='card'").get()!.comments_count_cache, 0);
  } finally { await f.close(); }
});

test("route access: anonymous, client, foreign workspace and foreign card are denied", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.app.inject(`/api/clients/${client}/internal-approval-reviewers`)).statusCode, 401);
    f.session(clientUser, "cliente");
    assert.equal((await f.app.inject(`/api/clients/${client}/internal-approval-reviewers`)).statusCode, 403);
    assert.equal((await f.app.inject("/api/internal-approvals/inbox")).statusCode, 403);
    f.session(aline, "admin", ["other"]);
    assert.equal((await f.app.inject(`/api/clients/${client}/internal-approval-reviewers`)).statusCode, 403);
    assert.equal((await f.app.inject({ method: "POST", url: sendUrl, payload: { recipientIds: [liege], message: "Revisar" } })).statusCode, 403);
    f.session(aline, "admin");
    assert.equal((await f.app.inject({ method: "POST", url: sendUrl.replace('/card/', '/foreign-card/'), payload: { recipientIds: [liege], message: "Revisar" } })).statusCode, 404);
  } finally { await f.close(); }
});
