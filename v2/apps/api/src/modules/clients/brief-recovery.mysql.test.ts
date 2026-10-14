import assert from "node:assert/strict";
import { after,before,test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import mysql,{type RowDataPacket} from "mysql2/promise";
import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { ensureApprovalStorage } from "../approvals/approval-history.repository.js";
import { ensureCardActivityEventsTable } from "../cards/card-activity.service.js";
import { RadarSuggestionsService } from "../radar-suggestions/radar-suggestions.service.js";
import { RadarSuggestionsRepository } from "../radar-suggestions/radar-suggestions.repository.js";
import { sample } from "../radar-suggestions/radar-suggestions.test-fixtures.js";
import { findCardById } from "../cards/cards.repository.js";
import { decideCardApproval } from "../approvals/approval-workflow.service.js";
import { previewBriefRecovery,applyBriefRecovery } from "./brief-recovery.service.js";
import { approvalRoutes } from "../approvals/approvals.routes.js";
import { portalRoutes } from "../portal/portal.routes.js";
import { createApprovalLink } from "../approvals/approvals.repository.js";
import { clientRoutes } from "./clients.routes.js";

const socketPath=process.env.RADAR_TEST_SOCKET;
if(!socketPath||!/^\/(?:private\/)?tmp\/radar-mariadb-[^/]+\/server\.sock$/.test(socketPath))throw Error("Use apenas o socket temporário /tmp/radar-mariadb-*/server.sock.");
let server:mysql.Connection;
before(async()=>{server=await mysql.createConnection({socketPath,user:"root",multipleStatements:true,timezone:"Z"});});
after(async()=>{await server?.end();});
const secret="synthetic-recovery-test-secret-only";
async function fixture() {
 const database=`brief_recovery_${randomUUID().replace(/-/g,"")}`;await server.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
 const pool=mysql.createPool({socketPath,user:"root",database,connectionLimit:8,multipleStatements:true,timezone:"Z",jsonStrings:true});
 const app=Fastify();app.decorate("db",pool);app.decorate("appEnv",{JWT_SECRET:secret} as never);await app.register(httpErrorsPluginRegistered);
 const query=async(sql:string,params:unknown[]=[]) => (await pool.query<RowDataPacket[]>(sql,params))[0];
 const close=async()=>{await app.close();await pool.end();await server.query(`DROP DATABASE \`${database}\``);};
 try {
  await pool.query(readFileSync(new URL("../../../db/schema.sql",import.meta.url),"utf8").split("-- Additive foundation only.")[0]);
  for(const name of ["20261007_radar_suggestions_foundation.sql","20261014_radar_editorial_brief.sql"])await pool.query(readFileSync(new URL(`../../../../../database/migrations/${name}`,import.meta.url),"utf8"));
  await ensureApprovalStorage(pool);await ensureCardActivityEventsTable(pool);
  const userId=randomUUID(),clientId=randomUUID(),otherId=randomUUID(),cardId=randomUUID(),ideaId=randomUUID();
  await pool.query("INSERT INTO users(id,full_name,email,password_hash,global_role) VALUES(?,'Synthetic admin','synthetic@example.invalid','unused','super_admin')",[userId]);
  await pool.query("INSERT INTO client_accounts(id,name,slug,portal_title,workspace_drawer_json) VALUES(?,'Synthetic A','synthetic-a','Portal','{}'),(?,'Synthetic B','synthetic-b','Portal','{}')",[clientId,otherId]);
  const suggestion=(await new RadarSuggestionsService(new RadarSuggestionsRepository(pool)).createPending(clientId,userId,sample({concept:"Original concept",hook:"Original hook",rationale:"Original rationale",cta:"Original CTA",sourceSummary:null,description:"Original description",captionSuggestion:"Original caption"}))).suggestion;
  await pool.query("UPDATE radar_suggestions SET status='accepted',accepted_pauta_id=?,accepted_at=CURRENT_TIMESTAMP(3) WHERE id=?",[ideaId,suggestion.id]);
  const idea={id:ideaId,cardId,radarSuggestionId:suggestion.id,status:"sent",description:"Original description",caption:"Original caption",sourceUrl:suggestion.sourceUrl,title:suggestion.title,objective:suggestion.objective};
  await pool.query("UPDATE client_accounts SET workspace_drawer_json=? WHERE id=?",[JSON.stringify({pautaIdeas:[idea,{id:"untouched",status:"approved",title:"Keep"}],links:["Keep"]}),clientId]);
  const columnId=randomUUID();await pool.query("INSERT INTO kanban_columns(id,client_account_id,name,position,visible_to_client) VALUES(?,?,'Pauta aprovada',0,1)",[columnId,clientId]);
  await pool.query("INSERT INTO kanban_cards(id,client_account_id,title,caption,status_json,tags_json,media_urls_json,is_brief_approval) VALUES(?,?,?,'Independently edited caption','[\"Enviar para Cliente\"]','[]','[\"/api/uploads/synthetic.png\"]',1)",[cardId,clientId,idea.title]);
  await pool.query("INSERT INTO approval_links(id,client_account_id,card_id,token,expires_at,is_active) VALUES(?,?,?,'synthetic-public-token','2099-01-01',1)",[randomUUID(),clientId,cardId]);
  const actor={id:userId,fullName:"Synthetic admin",globalRole:"super_admin"};
  return {pool,app,query,close,actor,clientId,otherId,cardId,ideaId,suggestion,idea};
 }catch(error){await close();throw error;}
}
async function snapshot(f:Awaited<ReturnType<typeof fixture>>) {
 return {cards:await f.query("SELECT * FROM kanban_cards"),clients:await f.query("SELECT * FROM client_accounts ORDER BY id"),events:await f.query("SELECT * FROM card_approval_events ORDER BY revision"),links:await f.query("SELECT * FROM approval_links"),sources:await f.query("SELECT * FROM radar_suggestions")};
}
const preview=(f:Awaited<ReturnType<typeof fixture>>)=>previewBriefRecovery(f.app,f.clientId,f.cardId,f.actor);
const apply=(f:Awaited<ReturnType<typeof fixture>>,token:string)=>applyBriefRecovery(f.app,f.clientId,f.cardId,f.actor,token);

test("MariaDB preview writes nothing; authorized recovery preserves text/media/status/source and snapshots, closes links, renders client briefing",async()=>{
 const f=await fixture();try{
  const before=await snapshot(f),p=await preview(f);assert.equal(p.eligible,true);assert.equal(p.effects.activeLinksToInvalidate,1);assert.deepEqual(await snapshot(f),before);
  assert.equal(p.additions.concept,"Original concept");assert.equal(p.recoverableBrief!.sourceSummary,undefined);
  const result=await apply(f,p.previewToken!);assert.equal(result.applied,true);assert.equal(result.card.approvalRevision,1);
  const after=await snapshot(f);
  for(const field of ["title","caption","status_json","tags_json","media_urls_json","approval_state","column_id"])assert.equal(after.cards[0][field],before.cards[0][field]);
  assert.deepEqual(after.sources,before.sources);assert.equal(after.links[0].is_active,0);
  const bank=JSON.parse(after.clients.find(row=>row.id===f.clientId)!.workspace_drawer_json);assert.equal(bank.pautaIdeas[0].caption,f.idea.caption);assert.equal(bank.pautaIdeas[0].description,f.idea.description);assert.equal(bank.pautaIdeas[0].status,"sent");assert.equal(bank.pautaIdeas[0].concept,"Original concept");assert.equal(bank.pautaIdeas[1].title,"Keep");
  assert.deepEqual(after.events.map(row=>row.action),["legacy_snapshot","brief_restored"]);
  assert.equal(JSON.parse(after.events[0].after_json).editorialBrief,null);
  const frozen=after.events;
  await assert.rejects(decideCardApproval(f.app,f.clientId,f.cardId,{userId:null,name:"Synthetic",role:"guest"},{approved:true},"synthetic-public-token"),{statusCode:403});
  await assert.rejects(decideCardApproval(f.app,f.clientId,f.cardId,{userId:null,name:"Synthetic",role:"cliente"},{approved:true,expectedApprovalRevision:0}),{statusCode:409});
  await decideCardApproval(f.app,f.clientId,f.cardId,{userId:null,name:"Synthetic",role:"cliente"},{approved:true,expectedApprovalRevision:1});
  assert.deepEqual((await f.query("SELECT * FROM card_approval_events ORDER BY revision")).slice(0,2),frozen);
  const ui=await import(new URL("../../../../web/src/EditorialBrief.tsx",import.meta.url).href),React=await import("react"),{renderToStaticMarkup}=await import("react-dom/server");
  const html=renderToStaticMarkup(React.createElement(ui.EditorialBrief,{brief:result.card.editorialBrief,caption:result.card.caption}));assert.match(html,/Original concept|Original rationale/);assert.match(html,/example.org/);assert.doesNotMatch(html,/briefRecoveryOrigin|model|PRIVATE/);
 }finally{await f.close();}
});
test("MariaDB existing snapshots are never replaced when capturing a restored revision",async()=>{
 const f=await fixture();try{
  await f.pool.query("INSERT INTO card_approval_events(id,card_id,revision,action,source,actor_name,actor_role,before_json,after_json) VALUES(?,?,0,'legacy_snapshot','legacy','Synthetic','unknown',?,?)",[randomUUID(),f.cardId,JSON.stringify({caption:"Previously captured caption"}),JSON.stringify({caption:"Previously captured caption"})]);
  const before=await f.query("SELECT * FROM card_approval_events ORDER BY revision"),p=await preview(f);
  await apply(f,p.previewToken!);
  const after=await f.query("SELECT * FROM card_approval_events ORDER BY revision");assert.equal(after.length,2);assert.deepEqual(after[0],before[0]);
  const origin=JSON.parse(after[1].after_json).briefRecoveryOrigin;assert.equal(origin.previousStoredBrief,null);assert.equal(origin.previousPautaFields.concept.existed,false);assert.equal(origin.suggestionId,f.suggestion.id);
 }finally{await f.close();}
});
test("MariaDB concurrent identical and different previews apply once; replay remains safe after a later approval",async()=>{
 const f=await fixture();try{
  const p=await preview(f),other=await preview(f);
  const results=await Promise.all([apply(f,p.previewToken!),apply(f,p.previewToken!)]);assert.equal(results.filter(row=>row.applied).length,1);
  await assert.rejects(apply(f,other.previewToken!),{statusCode:409});
  await decideCardApproval(f.app,f.clientId,f.cardId,{userId:null,name:"Synthetic",role:"cliente"},{approved:true,expectedApprovalRevision:1});
  const before=await snapshot(f);assert.equal((await apply(f,p.previewToken!)).alreadyApplied,true);assert.deepEqual(await snapshot(f),before);
 }finally{await f.close();}
});
test("MariaDB audit failure rolls back bank/card/revision/history/links; commit acknowledgement loss replays once",async()=>{
 const f=await fixture();try{
  const p=await preview(f),before=await snapshot(f);
  await f.pool.query("CREATE TRIGGER fail_recovery BEFORE INSERT ON card_approval_events FOR EACH ROW BEGIN IF NEW.action='brief_restored' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic failure'; END IF; END");
  await assert.rejects(apply(f,p.previewToken!),{statusCode:503});assert.deepEqual(await snapshot(f),before);await f.pool.query("DROP TRIGGER fail_recovery");
  const original=f.pool.getConnection.bind(f.pool);let lose=true;
  f.pool.getConnection=async()=>{const db=await original(),commit=db.commit.bind(db);db.commit=async()=>{await commit();db.commit=commit;if(lose){lose=false;throw Error("Lost acknowledgement");}};return db;};
  await assert.rejects(apply(f,p.previewToken!),{statusCode:503});f.pool.getConnection=original;
  assert.equal((await apply(f,p.previewToken!)).alreadyApplied,true);assert.equal((await findCardById(f.pool,f.cardId))!.approvalRevision,1);
  assert.equal((await f.query("SELECT COUNT(*) AS total FROM card_approval_events WHERE action='brief_restored'"))[0].total,1);
 }finally{await f.close();}
});
test("MariaDB stale data, forged/expired preview and cross-client or user replay cannot write",async()=>{
 const f=await fixture();try{
  const p=await preview(f);
  for(const token of ["forged",jwt.sign({purpose:"brief-recovery",clientId:f.clientId,cardId:f.cardId,userId:f.actor.id,digest:"fake"},secret,{audience:"brief-recovery",jwtid:randomUUID(),expiresIn:-1})])await assert.rejects(apply(f,token),{statusCode:409});
  await assert.rejects(applyBriefRecovery(f.app,f.otherId,f.cardId,f.actor,p.previewToken!),{statusCode:409});
  await assert.rejects(applyBriefRecovery(f.app,f.clientId,f.cardId,{...f.actor,id:randomUUID()},p.previewToken!),{statusCode:409});
  await f.pool.query("UPDATE kanban_cards SET caption='Latest human edit' WHERE id=?",[f.cardId]);const before=await snapshot(f);await assert.rejects(apply(f,p.previewToken!),{statusCode:409});assert.deepEqual(await snapshot(f),before);
 }finally{await f.close();}
});
test("MariaDB approved/history-approved/requested/scheduled/archived/manual/unlinked states have no apply token or preview writes",async()=>{
 for(const change of ["INSERT INTO card_approval_events(id,card_id,revision,action,decision,source,actor_name,actor_role,before_json,after_json) SELECT UUID(),id,0,'approved','approved','legacy','Synthetic','unknown','{}','{}' FROM kanban_cards", "UPDATE kanban_cards SET approval_state='approved'","UPDATE approval_links SET approved_at=CURRENT_TIMESTAMP","UPDATE kanban_cards SET approval_state='changes_requested'","UPDATE kanban_cards SET scheduled_at='2099-01-01'","UPDATE kanban_cards SET archived=1","UPDATE kanban_cards SET is_brief_approval=0","UPDATE radar_suggestions SET accepted_pauta_id=NULL"]) {
  const f=await fixture();try{await f.pool.query(change);const before=await snapshot(f),p=await preview(f);assert.equal(p.eligible,false,change);assert.equal(p.previewToken,null);assert.deepEqual(await snapshot(f),before);}finally{await f.close();}
 }
});
test("MariaDB approval racing recovery never approves an unseen new revision or rewrites approved briefing",async()=>{
 const f=await fixture();try{
  const p=await preview(f);
  const results=await Promise.allSettled([apply(f,p.previewToken!),decideCardApproval(f.app,f.clientId,f.cardId,{userId:null,name:"Synthetic",role:"cliente"},{approved:true,expectedApprovalRevision:0})]);
  assert.equal(results.filter(row=>row.status==="fulfilled").length,1);
  const current=(await findCardById(f.pool,f.cardId))!;assert.equal(current.approvalRevision,1);
  if(current.approvalState==="approved")assert.equal(current.editorialBrief,null);else assert.equal(current.editorialBrief!.concept,"Original concept");
 }finally{await f.close();}
});
test("MariaDB portal and public routes expose restored briefing; old public links cannot read or decide",async()=>{
 const f=await fixture();f.app.addHook("onRequest",async request=>{request.auth={user:{...f.actor,globalRole:"super_admin",isActive:true},memberships:[]} as any;});
 await f.app.register(portalRoutes);await f.app.register(approvalRoutes);
 try {
  const p=await preview(f);await apply(f,p.previewToken!);
  const portal=await f.app.inject(`/portal/accounts/${f.clientId}/cards/${f.cardId}`);assert.equal(portal.statusCode,200);assert.equal(portal.json().card.editorialBrief.concept,"Original concept");
  const old=await f.app.inject("/portal/approval/synthetic-public-token");assert.ok(old.statusCode>=400);
  const denied=await f.app.inject({method:"POST",url:"/portal/approval/synthetic-public-token/decision",payload:{approved:true}});assert.ok(denied.statusCode>=400);
  const link=await createApprovalLink(f.pool,{clientAccountId:f.clientId,cardId:f.cardId,createdByUserId:f.actor.id,expiresAt:new Date("2099-01-01")});
  const fresh=await f.app.inject(`/portal/approval/${link!.token}`);assert.equal(fresh.statusCode,200);assert.equal(fresh.json().card.editorialBrief.concept,"Original concept");
  const approved=await f.app.inject({method:"POST",url:`/portal/approval/${link!.token}/decision`,payload:{approved:true}});assert.equal(approved.statusCode,200);
  assert.equal((await findCardById(f.pool,f.cardId))!.approvalState,"approved");
 }finally{await f.close();}
});
test("MariaDB route allows scoped active admin only; confirmation requires a real preview before writes",async()=>{
 const f=await fixture();let auth:any={user:{...f.actor,globalRole:"admin",isActive:true},memberships:[{clientAccountId:f.clientId,membershipRole:"admin"}]};
 f.app.addHook("onRequest",async request=>{request.auth=auth;});await f.app.register(clientRoutes);
 try{
  const url=`/clients/${f.clientId}/cards/${f.cardId}/editorial-brief-recovery`,p=await f.app.inject(`${url}/preview`);assert.equal(p.statusCode,200);assert.equal(p.headers["cache-control"],"no-store");
  auth={...auth,memberships:[]};assert.equal((await f.app.inject({method:"POST",url,payload:{previewToken:p.json().previewToken,confirm:true}})).statusCode,403);
  auth={...auth,memberships:[{clientAccountId:f.clientId,membershipRole:"admin"}]};
  assert.equal((await f.app.inject({method:"POST",url,payload:{previewToken:p.json().previewToken,confirm:true}})).statusCode,200);
 }finally{await f.close();}
});
