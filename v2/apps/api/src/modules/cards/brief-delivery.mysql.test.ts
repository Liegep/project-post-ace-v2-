import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import Fastify from "fastify";
import { cardRoutes } from "./cards.routes.js";
import { portalRoutes } from "../portal/portal.routes.js";
import { commentRoutes } from "../comments/comments.routes.js";
import { approvalRoutes } from "../approvals/approvals.routes.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { withLockedCard } from "./brief-delivery.service.js";
import { findCardById, updateCard } from "./cards.repository.js";
import { getPortalBoard, getPortalHome } from "../portal/portal.service.js";
import { getInternalCardDetail } from "./card-detail.service.js";
import { reconcileApprovedCardColumns } from "../approvals/approvals.service.js";

// Never load .env or connect over TCP. Only our disposable local server is accepted.
const socketPath = process.env.BRIEF_TEST_SOCKET;
if (!socketPath || !/^\/(?:private\/)?tmp\/brief-mariadb-[^/]+\/server\.sock$/.test(socketPath)) throw new Error("Use the disposable /tmp/brief-mariadb-*/server.sock instance.");

test("withdrawal, persistence, resend, permissions and serialized client actions (MariaDB)", async (t) => {
  const server = mysql.createPool({ socketPath, user: "root", multipleStatements: true });
  const database = `brief_test_${randomUUID().replaceAll("-", "")}`;
  await server.query(`CREATE DATABASE \`${database}\``);
  const pool = mysql.createPool({ socketPath, user: "root", database, multipleStatements: true, connectionLimit: 8, timezone: "Z" });
  const app = Fastify();
  const clientId = randomUUID(), otherClientId = randomUUID(), userId = randomUUID();
  const actor = { id: userId, fullName: "Equipe", globalRole: "super_admin" as const };
  try {
    const schema = readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8").split("-- Additive foundation only.")[0];
    // Exercise the proposed migration against an existing schema, not just a fresh table.
    await pool.query(schema.replace("  brief_withdrawn_at DATETIME(3) NULL,\n", ""));
    await pool.query(readFileSync(new URL("../../../../../database/migrations/20261028_brief_withdrawal.sql", import.meta.url), "utf8"));
    await pool.query("INSERT INTO users (id,full_name,email,password_hash,global_role) VALUES (?, 'Equipe', 'test@invalid.test', 'unused', 'super_admin')", [userId]);
    await pool.query("INSERT INTO client_accounts (id,name,slug,portal_title) VALUES (?, 'Cliente A', 'a', 'Portal'), (?, 'Cliente B', 'b', 'Portal')", [clientId, otherClientId]);
    await pool.query("INSERT INTO client_permissions (id,client_account_id) VALUES (?,?), (?,?)", [randomUUID(), clientId, randomUUID(), otherClientId]);
    app.decorate("db", pool);
    app.decorate("appEnv", { APP_TIMEZONE: "Europe/Stockholm" } as never);
    await app.register(httpErrorsPluginRegistered);
    app.addHook("preHandler", async (request) => {
      const role = request.headers["x-test-role"] ?? "super_admin";
      request.auth = { user: { ...actor, globalRole: role }, memberships: role === "super_admin" ? [] : [{ clientAccountId: clientId, membershipRole: role === "cliente" ? "cliente" : "colaborador", portalAccessLevel: "approver" }] } as never;
    });
    await app.register(cardRoutes); await app.register(portalRoutes); await app.register(commentRoutes); await app.register(approvalRoutes);
    await app.ready();
    const create = async (brief = true, approved = false) => {
      const id = randomUUID();
      await pool.query("INSERT INTO kanban_cards (id,client_account_id,title,caption,media_urls_json,tags_json,status_json,is_brief_approval,client_label) VALUES (?,?,'Pauta','Conteúdo',?,?,?, ?,?)", [id,clientId,JSON.stringify(["/uploads/preserved.png"]),JSON.stringify(["Etiqueta"]),JSON.stringify(["Enviar para Cliente", ...(approved ? ["Aprovado"] : [])]),brief ? 1 : 0,approved ? "Aprovado pelo cliente" : "Pauta para aprovação"]);
      await pool.query("INSERT INTO card_comments (id,card_id,author_name,author_role,comment_text,is_internal) VALUES (?,?,'Cliente','cliente','Comentário original',0)",[randomUUID(),id]);
      return id;
    };
    const route = (id: string, action: string) => `/clients/${clientId}/cards/${id}/brief-delivery/${action}`;
    const portal = (id: string, suffix = "") => `/portal/accounts/${clientId}/cards/${id}${suffix}`;
    const ids = (board: Awaited<ReturnType<typeof getPortalBoard>>) => [...board.board.columns.flatMap((c) => c.cards), ...board.board.withoutColumn.cards].map((c) => c.id);
    const untouched = await create(); const regular = await create(false);
    for (const approved of [false,true]) {
      const id = await create(true,approved);
      const token = randomUUID();
      await pool.query("INSERT INTO approval_links (id,client_account_id,card_id,token,expires_at,is_active,approved_at) VALUES (?,?,?,?,DATE_ADD(NOW(),INTERVAL 7 DAY),1,?)",[randomUUID(),clientId,id,token,approved ? new Date() : null]);
      const before = (await getInternalCardDetail(app,clientId,id));
      await t.test(`${approved ? "approved" : "pending"}: sent → withdraw → reload → explicit resend`, async () => {
        assert.ok(ids(await getPortalBoard(app,clientId,{}, {canUseSearch:true})).includes(id));
        assert.equal((await app.inject({method:"POST",url:route(id,"withdraw")})).statusCode,200);
        assert.ok(!ids(await getPortalBoard(app,clientId,{}, {canUseSearch:true})).includes(id));
        const after = await getInternalCardDetail(app,clientId,id);
        for (const key of ["title","caption","mediaUrls","tags","clientAccountId","status"] as const) assert.deepEqual(after.card[key], before.card[key]);
        assert.ok(after.comments.some((comment) => comment.commentText === "Comentário original"));
        assert.equal(after.approvalLinks[0].isActive,false);
        assert.deepEqual(after.approvalLinks[0].approvedAt,before.approvalLinks[0].approvedAt);
        assert.ok(after.card.briefWithdrawnAt);
        await updateCard(pool,id,{title:"Atualizada",isBriefApproval:false,status:["Enviar para Cliente"]});
        assert.ok((await findCardById(pool,id))?.briefWithdrawnAt);
        await updateCard(pool,id,{isBriefApproval:true});
        for (const suffix of ["","/comments"]) assert.equal((await app.inject({method:"GET",url:portal(id,suffix),headers:{"x-test-role":"cliente"}})).statusCode,404);
        for (const [suffix,body] of [["/decision",{approved:true}],["/comments",{commentText:"Ação atrasada",isInternal:false}]] as const) assert.equal((await app.inject({method:"POST",url:portal(id,suffix),payload:body})).statusCode,404);
        assert.equal((await app.inject({method:"GET",url:`/portal/approval/${token}`})).statusCode,403);
        assert.equal((await app.inject({method:"POST",url:`/portal/approval/${token}/decision`,payload:{approved:true}})).statusCode,403);
        assert.equal((await app.inject({method:"POST",url:`/clients/${clientId}/cards/${id}/approval-links`,payload:{}})).statusCode,404);
        assert.ok(!(await getPortalHome(app,clientId)).calendarPosts.some((c) => c.id === id));
        await reconcileApprovedCardColumns(app);
        assert.ok((await findCardById(pool,id))?.briefWithdrawnAt);
        assert.equal((await app.inject({method:"POST",url:route(id,"resend")})).statusCode,200);
        await reconcileApprovedCardColumns(app);
        assert.ok(ids(await getPortalBoard(app,clientId,{}, {canUseSearch:true})).includes(id));
        assert.equal((await findCardById(pool,id))?.clientLabel,"Pauta para aprovação");
        assert.equal((await app.inject({method:"GET",url:`/portal/approval/${token}`})).statusCode,403);
        const decision = await app.inject({method:"POST",url:portal(id,"/decision"),payload:{approved:true}});
        assert.equal(decision.statusCode,200,decision.body);
        assert.equal((await app.inject({method:"POST",url:route(id,"withdraw")})).statusCode,200);
      });
    }
    await t.test("client and unrelated staff cannot withdraw; ordinary cards unaffected", async () => {
      assert.equal((await app.inject({method:"POST",url:route(untouched,"withdraw"),headers:{"x-test-role":"cliente"}})).statusCode,403);
      assert.equal((await app.inject({method:"POST",url:route(untouched,"withdraw").replace(clientId,otherClientId),headers:{"x-test-role":"colaborador"}})).statusCode,403);
      assert.equal((await app.inject({method:"POST",url:route(regular,"withdraw")})).statusCode,400);
      assert.equal((await findCardById(pool,untouched))?.briefWithdrawnAt,null);
      assert.equal((await findCardById(pool,regular))?.briefWithdrawnAt,null);
    });
    await t.test("concurrent action waits for withdrawal then rejects, without side effects", async () => {
      const id = await create(); let acquired!: () => void, release!: () => void;
      const locked = new Promise<void>((resolve) => acquired = resolve);
      const wait = new Promise<void>((resolve) => release = resolve);
      const withdrawal = withLockedCard(app,clientId,id,false,async (scoped) => {
        await scoped.db.query("UPDATE kanban_cards SET brief_withdrawn_at = NOW(3) WHERE id = ?",[id]); acquired(); await wait;
      });
      await locked;
      const action = app.inject({method:"POST",url:portal(id,"/decision"),payload:{approved:true,commentText:"Race"}});
      release(); await withdrawal;
      assert.equal((await action).statusCode,404);
      const detail = await getInternalCardDetail(app,clientId,id);
      assert.ok(!detail.comments.some((c) => c.commentText === "Race"));
    });
  } finally { await app.close(); await pool.end(); await server.query(`DROP DATABASE \`${database}\``); await server.end(); }
});
