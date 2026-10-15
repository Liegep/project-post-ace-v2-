import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import mysql,{type RowDataPacket,type Pool} from "mysql2/promise";
import Fastify from "fastify";
import {httpErrorsPluginRegistered} from "../../plugins/http-errors.js";
import {ensureApprovalStorage,recordApprovalEvent} from "./approval-history.repository.js";
import {ensureCardActivityEventsTable} from "../cards/card-activity.service.js";
import {ensureCaptionHistoryTable} from "../cards/caption-history.repository.js";
import {findCardById,updateCard} from "../cards/cards.repository.js";
import {moveKanbanCard,updateKanbanCard} from "../cards/cards.service.js";
import {reconcileApprovedCardColumns} from "./approvals.service.js";
import {portalRoutes} from "../portal/portal.routes.js";
import {buildProducedPostRepairPreview,readProducedPostRepairSnapshot,repairTarget} from "../cards/produced-post-repair-preview.js";

const socketPath=process.env.PAUTA_STATE_TEST_SOCKET;
if(!socketPath||!/^\/(?:private\/)?tmp\/pauta-state-mariadb-[^/]+\/server\.sock$/.test(socketPath))throw Error("Only an isolated /tmp/pauta-state-mariadb-*/server.sock is permitted. No .env/TCP fallback.");
const actor={id:"synthetic-admin",fullName:"Synthetic admin",globalRole:"super_admin"};
async function fixture(){
 const admin=await mysql.createConnection({socketPath,user:"root",multipleStatements:true});
 const database=`pauta_state_test_${randomUUID().replace(/-/g,"")}`;await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
 const pool=mysql.createPool({socketPath,user:"root",database,connectionLimit:8,multipleStatements:true,timezone:"Z",jsonStrings:true});
 const app=Fastify();app.decorate("db",pool);app.decorate("appEnv",{APP_TIMEZONE:"Europe/Stockholm"} as never);await app.register(httpErrorsPluginRegistered);
 app.decorateRequest("auth",null);app.addHook("preHandler",async request=>{request.auth={user:{id:actor.id,fullName:actor.fullName,email:"synthetic@invalid.test",globalRole:"super_admin",isActive:true,locale:"pt",avatarUrl:null},memberships:[]};});
 const close=async()=>{await app.close();await pool.end();await admin.query(`DROP DATABASE \`${database}\``);await admin.end();};
 try{
  await pool.query(readFileSync(new URL("../../../db/schema.sql",import.meta.url),"utf8").split("-- Additive foundation only.")[0]);
  await ensureApprovalStorage(pool);await ensureCardActivityEventsTable(pool);await ensureCaptionHistoryTable(pool);
  await pool.query(readFileSync(new URL("../../../../../database/migrations/20261014_internal_approval_requests.sql",import.meta.url),"utf8"));
  await pool.query("INSERT INTO users(id,full_name,email,password_hash,global_role) VALUES(?,'Synthetic admin','synthetic@invalid.test','unused','super_admin')",[actor.id]);
  await pool.query("INSERT INTO client_accounts(id,name,slug,portal_title,workspace_drawer_json) VALUES(?,'Synthetic Kynagogi','kynagogi','Synthetic',?)",[repairTarget.clientId,JSON.stringify({pautaIdeas:[{id:repairTarget.ideaId,cardId:repairTarget.cardId,status:"approved"}]})]);
  await pool.query("INSERT INTO client_permissions(id,client_account_id) VALUES('synthetic-permissions',?)",[repairTarget.clientId]);
  for(const [id,name,visible] of [["pauta","Pauta aprovada",0],["work","Waiting approval",1]])await pool.query("INSERT INTO kanban_columns(id,client_account_id,name,visible_to_client,position) VALUES(?,?,?,?,0)",[id,repairTarget.clientId,name,visible]);
  await pool.query("INSERT INTO kanban_cards(id,client_account_id,column_id,title,caption,status_json,media_urls_json,primary_media_url,is_brief_approval,approval_state,approval_revision,client_label) VALUES(?,?,'pauta','Synthetic target','Preserved caption','[\"Enviar para Cliente\",\"Aprovado\"]','[\"/api/uploads/synthetic.png\"]','/api/uploads/synthetic.png',1,'approved',1,'Aprovado pelo cliente')",[repairTarget.cardId,repairTarget.clientId]);
  await pool.query("INSERT INTO card_comments(id,card_id,author_name,author_role,comment_text,is_internal) VALUES('comment',?,'Synthetic client','cliente','Preserved comment',0)",[repairTarget.cardId]);
  await pool.query("INSERT INTO approval_links(id,client_account_id,card_id,token,expires_at,is_active,approved_at) VALUES('link',?,?,'synthetic-token','2099-01-01',1,'2026-10-01')",[repairTarget.clientId,repairTarget.cardId]);
  const original=(await findCardById(pool,repairTarget.cardId))!;
  await recordApprovalEvent(pool,{cardId:repairTarget.cardId,revision:1,action:"approved",decision:"approved",source:"portal",actor:{userId:null,name:"Synthetic client",role:"cliente"},before:original,after:original});
  await app.register(portalRoutes,{prefix:"/api"});await app.ready();
  const query=async(sql:string,args:unknown[]=[]) =>(await pool.query<RowDataPacket[]>(sql,args))[0];
  const move=()=>moveKanbanCard(app,repairTarget.clientId,repairTarget.cardId,{columnId:"work"},actor);
  return {admin,pool,app,query,move,close,original};
 }catch(error){await close();throw error;}
}

test("MariaDB: real conversion, rejected stale writes, concurrent reader, portal visibility and read-only repair preview",async t=>{
 await t.test("conversion preserves assets/decisions and remains visible; SQL flag guard is atomic",async()=>{
  const f=await fixture();try{
   const converted=await f.move();assert.equal(converted.isBriefApproval,false);assert.equal(converted.approvalRevision,2);
   const preserved=await f.query("SELECT * FROM card_approval_events ORDER BY revision");
   for(const revision of [undefined,1,2]){
    await assert.rejects(updateKanbanCard(f.app,repairTarget.clientId,repairTarget.cardId,{isBriefApproval:true,expectedApprovalRevision:revision,caption:"Must not save",mediaUrls:[]},actor),{statusCode:409});
    await assert.rejects(updateCard(f.pool,repairTarget.cardId,{isBriefApproval:true,expectedApprovalRevision:revision,caption:"Must not save",mediaUrls:[]}),{statusCode:409});
   }
   assert.deepEqual(await findCardById(f.pool,repairTarget.cardId),converted);
   assert.equal((await f.query("SELECT COUNT(*) n FROM card_caption_versions"))[0].n,0);
   const edited=await updateKanbanCard(f.app,repairTarget.clientId,repairTarget.cardId,{caption:"Intended caption",expectedApprovalRevision:2},actor);
   assert.equal(edited.isBriefApproval,false);assert.deepEqual(edited.mediaUrls,f.original.mediaUrls);assert.equal(edited.approvalState,"pending");
   assert.deepEqual(await f.query("SELECT * FROM card_approval_events ORDER BY revision"),preserved);
   assert.equal((await f.query("SELECT approved_at FROM approval_links"))[0].approved_at.toISOString().slice(0,10),"2026-10-01");
   assert.equal((await f.query("SELECT comment_text FROM card_comments"))[0].comment_text,"Preserved comment");
   await reconcileApprovedCardColumns(f.app);assert.equal((await findCardById(f.pool,repairTarget.cardId))!.isBriefApproval,false);
   const response=await f.app.inject({method:"GET",url:`/api/portal/accounts/${repairTarget.clientId}/board`});assert.equal(response.statusCode,200,response.body);
   const board=response.json().board,cards=[...board.columns.flatMap((c:any)=>c.cards),...board.withoutColumn.cards];
   assert.equal(cards.length,1);assert.equal(cards[0].id,repairTarget.cardId);assert.equal(cards[0].isBriefApproval,false);
  }finally{await f.close();}
 });
 await t.test("conversion committed after service read rejects the entire stale edit including caption history",async()=>{
  const f=await fixture();try{
   let reached!:()=>void,release!:()=>void;const readReached=new Promise<void>(resolve=>reached=resolve),resume=new Promise<void>(resolve=>release=resolve);let paused=false;
   const staleDb=new Proxy(f.pool,{get(target,key){if(key==="query")return async(sql:string,args:unknown[])=>{const result=await target.query(sql,args);if(!paused&&sql.startsWith("SELECT id, client_account_id")&&sql.includes("FROM kanban_cards")){paused=true;reached();await resume;}return result;};const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;}}) as Pool;
   const staleApp=Object.create(f.app);Object.defineProperty(staleApp,"db",{value:staleDb});
   const stale=updateKanbanCard(staleApp,repairTarget.clientId,repairTarget.cardId,{isBriefApproval:true,expectedApprovalRevision:1,caption:"Stale race",mediaUrls:[]},actor);
   const rejection=assert.rejects(stale,{statusCode:409});await readReached;const converted=await f.move();release();await rejection;
   assert.deepEqual(await findCardById(f.pool,repairTarget.cardId),converted);assert.equal((await f.query("SELECT COUNT(*) n FROM card_caption_versions"))[0].n,0);
   assert.equal((await f.query("SELECT COUNT(*) n FROM card_approval_events WHERE action='converted_to_post'"))[0].n,1);
  }finally{await f.close();}
 });
 await t.test("failed conversion rolls back changed caption, caption versions, token invalidation and approval history together",async()=>{
  const f=await fixture();try{
   const before={card:await findCardById(f.pool,repairTarget.cardId),events:await f.query("SELECT * FROM card_approval_events ORDER BY revision"),links:await f.query("SELECT * FROM approval_links")};
   await f.pool.query("CREATE TRIGGER synthetic_reject_conversion BEFORE INSERT ON card_approval_events FOR EACH ROW BEGIN IF NEW.action = 'converted_to_post' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic audit failure'; END IF; END");
   await assert.rejects(updateKanbanCard(f.app,repairTarget.clientId,repairTarget.cardId,{isBriefApproval:false,expectedApprovalRevision:1,caption:"Must roll back"},actor));
   assert.deepEqual(await findCardById(f.pool,repairTarget.cardId),before.card);
   assert.deepEqual(await f.query("SELECT * FROM card_approval_events ORDER BY revision"),before.events);
   assert.deepEqual(await f.query("SELECT * FROM approval_links"),before.links);
   assert.equal((await f.query("SELECT COUNT(*) n FROM card_caption_versions"))[0].n,0);
  }finally{await f.close();}
 });
 await t.test("preview verifies real SQL snapshots under READ ONLY and proposes no writes; legacy reconciliation cannot reassert a converted flag",async()=>{
  const f=await fixture();try{
   await f.move();
   // Synthetic reproduction of the existing corrupt row; never a production operation.
   await f.pool.query("UPDATE kanban_cards SET is_brief_approval=1,status_json='[]' WHERE id=?",[repairTarget.cardId]);
   const read=await f.pool.getConnection();try{
    await read.query("SET SESSION TRANSACTION READ ONLY");await read.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");
    const before=await readProducedPostRepairSnapshot(read),preview=buildProducedPostRepairPreview(before);
    assert.equal(preview.eligibleForReview,true,JSON.stringify(preview.blockers));assert.deepEqual(preview.proposedPatch,{isBriefApproval:false,status:["Enviar para Cliente"]});
    assert.deepEqual(await readProducedPostRepairSnapshot(read),before);await read.rollback();
   }finally{read.destroy();}
   // Even corrupted legacy revision/reset metadata cannot defeat the conversion ledger.
   await f.pool.query("UPDATE kanban_cards SET is_brief_approval=0,approval_revision=0,approval_reset_at=NULL,client_label='Aprovado pelo cliente' WHERE id=?",[repairTarget.cardId]);
   await reconcileApprovedCardColumns(f.app);assert.equal((await findCardById(f.pool,repairTarget.cardId))!.isBriefApproval,false);
  }finally{await f.close();}
 });
});
