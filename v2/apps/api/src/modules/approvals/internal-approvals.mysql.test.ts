import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import mysql, { type RowDataPacket } from "mysql2/promise";
import Fastify from "fastify";
import type { AuthContext } from "../auth/auth.types.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { internalApprovalRoutes } from "./internal-approvals.routes.js";
import { demoReviewer } from "./internal-reviewers.repository.js";

// No .env or TCP fallback. Only a disposable server created for this task.
const socketPath = process.env.INTERNAL_APPROVAL_TEST_SOCKET;
if (!socketPath || !/^\/(?:private\/)?tmp\/internal-approval-mariadb-[^/]+\/server\.sock$/.test(socketPath)) throw Error("Use a disposable /tmp/internal-approval-mariadb-*/server.sock socket.");

test("MariaDB: actual migration, both sessions, real recipient IDs, cross-connection inbox and rollback", async () => {
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
    // Use the application's unmodified base DDL, including native FK types.
    const schema = readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8").split("-- Additive foundation only.")[0];
    await db.query(schema);
    const migration = readFileSync(new URL("../../../../../database/migrations/20261014_internal_approval_requests.sql", import.meta.url), "utf8");
    for (const [id, name, email, role] of [
      [ids.aline, "Aline", "aline@invalid.test", "admin"], [ids.liege, "Liege", "hello@invalid.test", "super_admin"],
      [ids.carlos, "Carlos", "carlos@invalid.test", "colaborador"], [demoReviewer.id, "Liege", demoReviewer.email, "super_admin"],
    ]) await db.query("INSERT INTO users (id, full_name, email, password_hash, global_role) VALUES (?, ?, ?, 'synthetic-not-a-login', ?)", [id, name, email, role]);
    await db.query("INSERT INTO client_accounts (id,name,slug,portal_title) VALUES (?, 'Synthetic', 'synthetic', 'Synthetic')", [ids.client]);
    for (const id of [ids.aline, ids.carlos]) await db.query("INSERT INTO client_memberships (id,user_id,client_account_id,membership_role) VALUES (?, ?, ?, 'colaborador')", [randomUUID(), id, ids.client]);
    await db.query("INSERT INTO kanban_cards (id,client_account_id,title) VALUES (?, ?, 'Synthetic card')", [ids.card, ids.client]);
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
    // Force a native failure after the comment is inserted, to verify rollback.
    await db.query("CREATE TRIGGER fail_synthetic_request BEFORE INSERT ON internal_approval_requests FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic failure'");
    session(ids.aline, "admin");
    assert.equal((await app.inject({ method: "POST", url, payload: { recipientIds: [ids.liege], message: "Must roll back" } })).statusCode, 500);
    const [counts] = await db.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM card_comments) AS comments, (SELECT COUNT(*) FROM internal_approval_requests) AS requests, comments_count_cache FROM kanban_cards WHERE id = ?", [ids.card]);
    assert.equal(counts[0].comments, 1); assert.equal(counts[0].requests, 2); assert.equal(counts[0].comments_count_cache, 1);
    const [version] = await server.query<RowDataPacket[]>("SELECT VERSION() AS version, @@skip_networking AS skipNetworking");
    console.log(version[0]);
  } finally {
    await app.close(); await db.end(); await server.query(`DROP DATABASE \`${database}\``); await server.end();
  }
});
