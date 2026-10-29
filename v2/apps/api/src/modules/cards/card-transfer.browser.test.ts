/** Real browser + real HTTP API/auth + disposable socket-only MariaDB. No mocks. */
import sharp from "sharp";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import mysql, { type RowDataPacket } from "mysql2/promise";
import Fastify from "fastify";
import fp from "fastify-plugin";
import fastifyFormbody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";
import { chromium, type Page } from "playwright";
import { hashPassword } from "../auth/auth.crypto.js";
import { authPluginRegistered } from "../../plugins/auth.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { authRoutes } from "../auth/auth.routes.js";
import { clientRoutes } from "../clients/clients.routes.js";
import { columnRoutes } from "../columns/columns.routes.js";
import { cardRoutes } from "./cards.routes.js";
import { portalRoutes } from "../portal/portal.routes.js";
import { commentRoutes } from "../comments/comments.routes.js";
import { approvalRoutes } from "../approvals/approvals.routes.js";
import { calendarRoutes } from "../calendar/calendar.routes.js";
import { uploadRoutes } from "../uploads/uploads.routes.js";
import { tagRoutes } from "../tags/tags.routes.js";
import { hashtagRoutes } from "../hashtags/hashtags.routes.js";
import { contractRoutes } from "../contracts/contracts.routes.js";
import { textRoutes } from "../texts/texts.routes.js";
import { reportRoutes } from "../reports/reports.routes.js";
import { invoiceRoutes } from "../invoices/invoices.routes.js";
import { internalApprovalRoutes } from "../approvals/internal-approvals.routes.js";
import { dashboardNotesRoutes } from "../dashboard-notes/dashboard-notes.routes.js";

const socketPath = process.env.BRIEF_TEST_SOCKET;
if (!socketPath || !/^\/(?:private\/)?tmp\/brief-mariadb-[^/]+\/server\.sock$/.test(socketPath)) throw Error("Only disposable /tmp/brief-mariadb-*/server.sock accepted; no .env or remote DB is loaded.");
const root = fileURLToPath(new URL("../../../../../../", import.meta.url));
const output = path.resolve(root, "docs/pr55-integrated-validation");
await mkdir(output, {recursive:true});
const evidence: any = {environment:"local-disposable", nodeVersion:process.version, startedAt:new Date().toISOString(), socketPath, tcpDatabase:false, realClientData:false, externalServices:false, workersStarted:false, checks:[], browserErrors:[], unexpectedApiResponses:[], externalRequests:[]};
const check = (name:string) => { evidence.checks.push(name); console.log(`PASS ${name}`); };
const server = mysql.createPool({socketPath,user:"root",multipleStatements:true});
const database = `brief_browser_${randomUUID().replaceAll("-", "")}`;
await server.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
const pool = mysql.createPool({socketPath,user:"root",database,multipleStatements:true,connectionLimit:8,timezone:"Z"});
const app = Fastify({logger:false});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let admin: Page | undefined;
const clientId=randomUUID(), otherId=randomUUID(), userId=randomUUID(), clientUserId=randomUUID(), foreignUserId=randomUUID(), viewerId=randomUUID();
const password = "Synthetic-only-54!";
const title="PR55 — Pauta sintética integrada";
try {
  const [version] = await pool.query<RowDataPacket[]>("SELECT VERSION() AS version, @@socket AS socket, @@skip_networking AS skipNetworking, DATABASE() AS db");
  evidence.database=version[0];assert.equal(Number(version[0].skipNetworking),1);
  const schema=await readFile(path.join(root,"v2/apps/api/db/schema.sql"),"utf8");
  // Current fixture assembled before any requests; no existing deployment is migrated.
  const completeSchema=schema.replace("  tags_json JSON NULL,\n  planned_at DATE NULL,", "  tags_json JSON NULL,\n  cover_image_url VARCHAR(2048) NULL,\n  planned_at DATE NULL,");
  await pool.query(completeSchema);
  await pool.query(`CREATE TABLE internal_approval_requests (
    id CHAR(36) PRIMARY KEY, client_account_id CHAR(36) NOT NULL, card_id CHAR(36) NOT NULL,
    requested_by_user_id CHAR(36), assigned_to_user_id CHAR(36), comment_id CHAR(36), message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  // The new proposal is rehearsed only in this disposable database, before enabling the feature.
  await pool.query(await readFile(path.join(root,"v2/database/proposals/20261029_card_transfer_operations.sql"),"utf8"));
  const hash=await hashPassword(password);
  for (const [id,email,role] of [[userId,"admin@synthetic.invalid","super_admin"],[clientUserId,"client@synthetic.invalid","cliente"],[foreignUserId,"foreign@synthetic.invalid","colaborador"],[viewerId,"viewer@synthetic.invalid","cliente"]]) await pool.query("INSERT INTO users(id,full_name,email,password_hash,global_role,locale) VALUES (?, 'Teste sintético PR55', ?, ?, ?, 'pt-BR')",[id,email,hash,role]);
  for (const [id,slug] of [[clientId,"pr55-synthetic"],[otherId,"pr55-other"]]) {
    await pool.query("INSERT INTO client_accounts(id,name,slug,portal_title,locale,show_archived_to_client) VALUES (?, 'Cliente sintético PR55', ?, 'Portal de teste', 'pt', 1)",[id,slug]);
    await pool.query("INSERT INTO client_permissions(id,client_account_id,allow_client_search,allow_client_edit_caption,allow_client_create_tags,allow_client_view_invoices,allow_client_view_reports) VALUES (?,?,1,1,1,0,0)",[randomUUID(),id]);
  }
  for (const [id,account,role,level] of [[clientUserId,clientId,"cliente","approver"],[viewerId,clientId,"cliente","viewer"],[foreignUserId,otherId,"colaborador","approver"]]) await pool.query("INSERT INTO client_memberships(id,user_id,client_account_id,membership_role,portal_access_level) VALUES (?,?,?,?,?)",[randomUUID(),id,account,role,level]);
  const columnId=randomUUID();await pool.query("INSERT INTO kanban_columns(id,client_account_id,name,visible_to_client) VALUES (?,?,'Pautas para aprovação',1)",[columnId,clientId]);
  const regularId=randomUUID(), scheduledId=randomUUID();
  await pool.query("INSERT INTO kanban_cards(id,client_account_id,column_id,title,status_json) VALUES (?,?,?,'Card comum preservado',?)",[regularId,clientId,columnId,JSON.stringify(["Enviar para Cliente"])]);
  await pool.query("INSERT INTO meta_scheduled_publications(id,client_account_id,card_id,platform,meta_asset_id,scheduled_at,timezone,status,idempotency_key) VALUES (?,?,?,'instagram','synthetic-no-provider','2099-01-01 12:00:00','Europe/Stockholm','scheduled',?)",[scheduledId,clientId,regularId,"f".repeat(64)]);
  app.decorate("appEnv",{NODE_ENV:"test",APP_NAME:"pr55-disposable",CARD_TRANSFERS_ENABLED:true,APP_TIMEZONE:"Europe/Stockholm",JWT_SECRET:randomUUID()+randomUUID(),JWT_EXPIRES_IN:"1h",UPLOAD_DIR:path.join(path.dirname(socketPath),"uploads"),DEMO_MODE:false,REPORT_AI_ENABLED:false,BRAND_BRAIN_AI_ENABLED:false} as never);
  await app.register(fp(async a=>{a.decorate("db",pool);},{name:"db-plugin"}));
  await app.register(httpErrorsPluginRegistered);await app.register(fastifyFormbody);await app.register(authPluginRegistered);
  // Actual application routes, without buildApp's workers, DB env loading or cloud providers.
  for (const routes of [authRoutes,clientRoutes,columnRoutes,cardRoutes,portalRoutes,commentRoutes,approvalRoutes,calendarRoutes,uploadRoutes,tagRoutes,hashtagRoutes,contractRoutes,textRoutes,reportRoutes,invoiceRoutes,dashboardNotesRoutes]) await app.register(routes,{prefix:"/api"});
  await app.register(fastifyStatic,{root:path.join(root,"v2/apps/web/dist"),prefix:"/",index:false});
  app.get("/",async (_r,reply)=>reply.sendFile("index.html"));
  app.setErrorHandler((error, request, reply) => { const err=error as Error & {statusCode?:number}; console.error("HTTP error",request.url,err.message); reply.code(err.statusCode ?? 500).send({message:err.message}); });
  app.addHook("onError",async(request,_reply,error)=>{evidence.sqlErrors??=[];const err=error as any;evidence.sqlErrors.push({url:request.url,code:err.code??err.cause?.code,message:err.message});});
  const base=await app.listen({host:"127.0.0.1",port:0});evidence.httpOrigin=base;
  const sanity=await app.inject({method:"POST",url:"/api/auth/login",payload:{email:"admin@synthetic.invalid",password}});assert.equal(sanity.statusCode,200,sanity.body);console.log("Local API and login ready");
  // Reproduce the auxiliary errors against an independent, untouched historical base fixture.
  const diagnosticName=`${database}_base`;
  await server.query(`CREATE DATABASE \`${diagnosticName}\``);
  const diagnosticPool=mysql.createPool({socketPath,user:"root",database:diagnosticName,multipleStatements:true,connectionLimit:8});
  const diagnosticApp=Fastify();
  const diagnosticErrors:any[]=[];
  try {
    await diagnosticPool.query(schema);
    await diagnosticPool.query("INSERT INTO users(id,full_name,email,password_hash,global_role) VALUES (?,'Synthetic diagnostic','admin@synthetic.invalid',?,'super_admin')",[userId,hash]);
    await diagnosticPool.query("INSERT INTO client_accounts(id,name,slug,portal_title) VALUES (?,'Synthetic diagnostic','pr55-diagnostic','Test')",[clientId]);
    diagnosticApp.decorate("appEnv",app.appEnv);
    await diagnosticApp.register(fp(async a=>{a.decorate("db",diagnosticPool);},{name:"db-plugin"}));
    await diagnosticApp.register(httpErrorsPluginRegistered);await diagnosticApp.register(authPluginRegistered);
    for(const routes of [authRoutes,internalApprovalRoutes,textRoutes]) await diagnosticApp.register(routes,{prefix:"/api"});
    diagnosticApp.addHook("onError",async(req,_rep,error)=>{const e=error as any;diagnosticErrors.push({url:req.url,code:e.code,message:e.message});});
    const login=await diagnosticApp.inject({method:"POST",url:"/api/auth/login",payload:{email:"admin@synthetic.invalid",password}});
    assert.equal(login.statusCode,200,login.body);
    const headers={authorization:`Bearer ${login.json().accessToken}`};
    const inbox=await diagnosticApp.inject({url:"/api/internal-approvals/inbox",headers});
    const texts=await Promise.all(Array.from({length:8},()=>diagnosticApp.inject({url:`/api/clients/${clientId}/texts`,headers})));
    assert.ok(texts.every(res=>res.statusCode===200));
    evidence.auxiliaryDiagnosis={baseInboxStatus:inbox.statusCode,baseTextsStatuses:texts.map(res=>res.statusCode),errors:diagnosticErrors};
    assert.equal(inbox.statusCode,500);assert.ok(diagnosticErrors.some(e=>e.code==="ER_NO_SUCH_TABLE"&&e.message.includes("internal_approval_requests")));
  } finally {await diagnosticApp.close();await diagnosticPool.end();await server.query(`DROP DATABASE \`${diagnosticName}\``);}
  const diagnosticHeaders={authorization:`Bearer ${sanity.json().accessToken}`};
  assert.equal((await app.inject({url:"/api/internal-approvals/inbox",headers:diagnosticHeaders})).statusCode,200);
  const fixedTexts=await Promise.all(Array.from({length:8},()=>app.inject({url:`/api/clients/${clientId}/texts`,headers:diagnosticHeaders})));
  assert.ok(fixedTexts.every(res=>res.statusCode===200));evidence.auxiliaryDiagnosis.currentFixtureInboxStatus=200;evidence.auxiliaryDiagnosis.currentFixtureTextsStatuses=fixedTexts.map(res=>res.statusCode);
  check("auxiliary errors diagnosed on separate base schema; current fixture inbox and concurrent texts return 200");
  browser=await chromium.launch({headless:true});evidence.browserVersion=browser.version();
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route("**/*",async route=>{
    const url=new URL(route.request().url());
    if (url.origin===base || ["data:","blob:"].includes(url.protocol)) return route.continue();
    evidence.externalRequests.push(url.origin);await route.abort();
  });
  context.setDefaultTimeout(15000);
  context.on("page",page=>{page.on("pageerror",err=>evidence.browserErrors.push(err.message));page.on("response",res=>{if(res.url().includes("/api/")&&res.status()>=500)evidence.unexpectedApiResponses.push({url:res.url(),status:res.status()});});});
  admin=await context.newPage();
  await admin.goto(`${base}/#/login`);await admin.locator(".login-intro").waitFor({state:"detached"});await admin.locator("#login-username").fill("admin@synthetic.invalid");await admin.locator("#login-password").fill(password);await admin.locator(".login-submit").click();await admin.waitForURL("**/#/dashboard");
  const session=await admin.evaluate(()=>JSON.parse(localStorage.getItem("designhub-v2-session")!));assert.ok(session.accessToken);
  const request=async(page:Page,url:string,method="GET",data?:unknown)=>{
    const token=await page.evaluate(()=>JSON.parse(localStorage.getItem("designhub-v2-session")!).accessToken);
    return context.request.fetch(`${base}${url}`,{method,headers:{Authorization:`Bearer ${token}`},data});
  };
  const api=async(url:string,method="GET",data?:unknown)=>{const res=await request(admin!,url,method,data);assert.ok(res.ok(),`${method} ${url}: ${res.status()} ${await res.text()}`);return res.json();};

  await mkdir(app.appEnv.UPLOAD_DIR,{recursive:true});
  await writeFile(path.join(app.appEnv.UPLOAD_DIR,"abc.png"),await sharp({create:{width:64,height:64,channels:3,background:"#3b82f6"}}).png().toBuffer());
  await writeFile(path.join(app.appEnv.UPLOAD_DIR,"abc.pdf"),Buffer.from("%PDF-1.4\n% synthetic attachment only\n%%EOF"));
  const destinationColumn=randomUUID();
  await pool.query("INSERT INTO kanban_columns(id,client_account_id,name,visible_to_client) VALUES (?,?,'Coluna destino específica',1)",[destinationColumn,otherId]);
  const source = await api(`/api/clients/${clientId}/cards`,"POST",{columnId,title:"Cópia sintética sem fuso",caption:"Legenda completa",mediaUrls:["/api/uploads/abc.png","/api/uploads/abc.pdf"],primaryMediaUrl:"/api/uploads/abc.png",tags:["Teste"],hashtags:["#teste"],editorialBrief:{concept:"Conceito sintético"},priorityLevel:"high",deadlineAt:"2098-05-03 10:15:00",eventColor:"#123456",keepFiles:true});
  await pool.query("UPDATE kanban_cards SET scheduled_at='2099-01-01 12:00:00',published_at='2026-01-01 12:00:00' WHERE id=?",[source.card.id]);
  await pool.query("INSERT INTO approval_links(id,client_account_id,card_id,token,expires_at) VALUES (?,?,?,?,'2099-01-01')",[randomUUID(),clientId,source.card.id,"synthetic-secret-token"]);
  await pool.query("UPDATE meta_scheduled_publications SET card_id=? WHERE id=?",[source.card.id,scheduledId]);
  const [metaBefore]=await pool.query("SELECT * FROM meta_scheduled_publications WHERE id=?",[scheduledId]);
  const openTransfer=async(title:string)=>{
    await admin!.goto(`${base}/#/admin/pr55-synthetic`);await admin!.reload();
    await admin!.getByText(title,{exact:true}).first().click({button:"right"});
    await admin!.getByRole("button",{name:/Enviar para outro cliente/}).click();
    const modal=admin!.locator(".card-client-dialog");
    await modal.locator("select").nth(0).selectOption(otherId);
    await modal.locator("select").nth(1).selectOption(destinationColumn);
    return modal;
  };
  let modal=await openTransfer(source.card.title);
  await modal.getByRole("button",{name:"Copiar card",exact:true}).click();
  await modal.waitFor({state:"detached"});
  const [copies]=await pool.query<RowDataPacket[]>("SELECT * FROM kanban_cards WHERE client_account_id=? AND title=?",[otherId,source.card.title]);
  assert.equal(copies.length,1);assert.equal(copies[0].column_id,destinationColumn);assert.equal(copies[0].caption,"Legenda completa");
  assert.equal(copies[0].scheduled_at,null);
  await admin!.goto(`${base}/#/admin/pr55-other`);await admin!.reload();await admin!.getByText(source.card.title,{exact:true}).first().waitFor();
  check("copy without timezone: chosen column and persistence after reload");
  await admin!.screenshot({path:path.join(output,"01-copy.png"),fullPage:true});

  for (const field of ["title","caption","primary_media_url","media_type","media_urls_json","editorial_brief_json","tags_json","hashtags_json","priority_level","deadline_at","event_color","keep_files"]) {
    const [original]=await pool.query<RowDataPacket[]>("SELECT * FROM kanban_cards WHERE id=?",[source.card.id]);
    assert.deepEqual(copies[0][field],original[0][field],field);
  }
  for (const name of ["abc.png","abc.pdf"]) {
    const response=await context.request.get(`${base}/api/uploads/${name}`);assert.equal(response.status(),200);
    assert.deepEqual(await response.body(),await readFile(path.join(app.appEnv.UPLOAD_DIR,name)));
  }
  check("caption, image and attachment references and bytes, editorial brief, tags, hashtags and priority preserved");
  const zoned=await api(`/api/clients/${clientId}/cards`,"POST",{columnId,title:"Cartão com fuso",scheduledTimeZone:"Europe/Stockholm"});
  modal=await openTransfer(zoned.card.title);await modal.getByRole("button",{name:"Copiar card",exact:true}).click();await modal.waitFor({state:"detached"});
  const [zoneCopies]=await pool.query<RowDataPacket[]>("SELECT * FROM kanban_cards WHERE client_account_id=? AND title=?",[otherId,"Cartão com fuso"]);
  assert.equal(zoneCopies[0].scheduled_timezone,"Europe/Stockholm");
  check("valid timezone preserved");
  const transfers=`/api/clients/${clientId}/card-transfers`;
  const opBody=(cardId:string,mode:"copy"|"move"="copy",key=randomUUID())=>({operationKey:key,sourceCardId:cardId,targetClientId:otherId,columnId:destinationColumn,mode});
  const reserve=async(body:any)=>api(`${transfers}/reserve`,"POST",body);
  const execute=async(body:any)=>api(`${transfers}/execute`,"POST",body);
  const [ledgerRows]=await pool.query<RowDataPacket[]>("SELECT * FROM card_transfer_operations WHERE source_card_id=? ORDER BY created_at",[source.card.id]);
  const firstKey=ledgerRows[0].operation_key;
  const same=opBody(source.card.id,"copy",firstKey);
  const replay=await execute(same);assert.equal(replay.operation.destinationCardId,copies[0].id);
  const parallel=await Promise.all(Array.from({length:6},()=>execute(same)));assert.ok(parallel.every(op=>op.operation.destinationCardId===copies[0].id));
  const [sameCount]=await pool.query<RowDataPacket[]>("SELECT id FROM kanban_cards WHERE client_account_id=? AND title=?",[otherId,source.card.title]);assert.equal(sameCount.length,1);
  check("same persistent key replayed concurrently returns one destination");
  const fresh=opBody(source.card.id);await reserve(fresh);const freshResult=await execute(fresh);assert.notEqual(freshResult.operation.destinationCardId,copies[0].id);
  check("new key permits a legitimate second copy");
  const upperReplay=await execute({...same,operationKey:firstKey.toUpperCase()});assert.equal(upperReplay.operation.destinationCardId,copies[0].id);
  await api(`/api/clients/${otherId}/cards/${freshResult.operation.destinationCardId}`,"DELETE");
  const deletedReplay=await execute(fresh);assert.equal(deletedReplay.operation.destinationCardId,freshResult.operation.destinationCardId);
  const [deletedDest]=await pool.query<RowDataPacket[]>("SELECT id FROM kanban_cards WHERE id=?",[freshResult.operation.destinationCardId]);assert.equal(deletedDest.length,0);
  const longSource=await api(`/api/clients/${clientId}/cards`,"POST",{columnId,title:"T".repeat(255)});const longBody=opBody(longSource.card.id);await reserve(longBody);const longResult=await execute(longBody);const longDest=await api(`/api/clients/${otherId}/cards/${longResult.operation.destinationCardId}`);assert.equal(longDest.card.title,longSource.card.title);await api(`/api/clients/${clientId}/cards/${longSource.card.id}`,"DELETE");
  check("UUID case canonicalized; deleted destinations are not recreated; 255-character title preserved");

  const concurrentNew=opBody(zoned.card.id);await Promise.all(Array.from({length:6},()=>reserve(concurrentNew)));
  const competing=await Promise.all(Array.from({length:6},()=>execute(concurrentNew)));assert.equal(new Set(competing.map(item=>item.operation.destinationCardId)).size,1);
  const secondApi=Fastify();secondApi.decorate("appEnv",app.appEnv);await secondApi.register(fp(async a=>{a.decorate("db",pool);},{name:"db-plugin"}));await secondApi.register(httpErrorsPluginRegistered);await secondApi.register(authPluginRegistered);await secondApi.register(cardRoutes,{prefix:"/api"});
  try {const replayFromSecondInstance=await secondApi.inject({method:"POST",url:`${transfers}/execute`,headers:{authorization:`Bearer ${session.accessToken}`},payload:concurrentNew});assert.equal(replayFromSecondInstance.statusCode,200,replayFromSecondInstance.body);assert.equal(replayFromSecondInstance.json().operation.destinationCardId,competing[0].operation.destinationCardId);} finally {await secondApi.close();}
  check("concurrent first reservations and execution deduplicate across independent API instances");

  // A real HTTP response is discarded AFTER the API committed its transaction.
  let lostBody:any;let dropped=false;
  const executionRoute=`**/api/clients/${clientId}/card-transfers/execute`;
  await context.route(executionRoute,async route=>{lostBody=route.request().postDataJSON();const committed=await route.fetch();assert.equal(committed.status(),200);dropped=true;await route.abort("connectionclosed");});
  modal=await openTransfer(zoned.card.title);await modal.getByRole("button",{name:"Copiar card",exact:true}).click();await modal.getByRole("alert").waitFor();assert.equal(dropped,true);assert.ok(await modal.isVisible());
  await context.unroute(executionRoute);
  const [lostOperation]=await pool.query<RowDataPacket[]>("SELECT * FROM card_transfer_operations WHERE operation_key=?",[lostBody.operationKey]);assert.equal(lostOperation[0].status,"completed");
  await modal.getByRole("button",{name:"Fechar",exact:true}).first().click();await admin!.reload();
  // Fresh authenticated browser context, no shared local/session storage or operation key.
  const freshContext=await browser!.newContext({viewport:{width:1440,height:1000}});
  await freshContext.route("**/*",route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  const freshPage=await freshContext.newPage();freshPage.on("pageerror",error=>evidence.browserErrors.push(error.message));
  await freshPage.goto(`${base}/#/login`);await freshPage.locator(".login-intro").waitFor({state:"detached"});await freshPage.locator("#login-username").fill("admin@synthetic.invalid");await freshPage.locator("#login-password").fill(password);await freshPage.locator(".login-submit").click();await freshPage.waitForURL("**/#/dashboard");
  await freshPage.goto(`${base}/#/admin/pr55-synthetic`);await freshPage.getByRole("button",{name:"Transferências entre clientes",exact:true}).click();
  await freshPage.locator(`[data-operation-key="${lostBody.operationKey}"]`).filter({hasText:"Concluída"}).waitFor();
  await freshPage.screenshot({path:path.join(output,"03-recovered-session.png"),fullPage:true});await freshContext.close();
  const recovered=await execute(lostBody);assert.equal(recovered.operation.destinationCardId,lostOperation[0].destination_card_id);
  check("response lost after commit recovered after reload and fresh login, without local operation state");
  // Losing a reservation response also leaves a recoverable pending operation on the server.
  const pending=opBody(zoned.card.id);await reserve(pending);
  const listed=await api(transfers);assert.ok(listed.items.some((op:any)=>op.operationKey===pending.operationKey&&op.status==="pending"));
  await execute(pending);check("pending reservation discoverable and resumable from persistent history");
  const moveSource=await api(`/api/clients/${clientId}/cards`,"POST",{columnId,title:"Movimentação atômica"});
  const moveBody=opBody(moveSource.card.id,"move");await reserve(moveBody);
  await pool.query(`CREATE TRIGGER pr55_fail_delete BEFORE DELETE ON kanban_cards FOR EACH ROW BEGIN IF OLD.id='${moveSource.card.id}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic delete failure'; END IF; END`);
  const failedMove=await request(admin!,`${transfers}/execute`,"POST",moveBody);assert.equal(failedMove.status(),500);
  const [afterFailedMove]=await pool.query<RowDataPacket[]>("SELECT id,client_account_id FROM kanban_cards WHERE title=?",[moveSource.card.title]);assert.equal(afterFailedMove.length,1);assert.equal(afterFailedMove[0].id,moveSource.card.id);
  const [pendingMove]=await pool.query<RowDataPacket[]>("SELECT status,destination_card_id FROM card_transfer_operations WHERE operation_key=?",[moveBody.operationKey]);assert.equal(pendingMove[0].status,"pending");assert.equal(pendingMove[0].destination_card_id,null);
  await pool.query("DROP TRIGGER pr55_fail_delete");
  await pool.query(`CREATE TRIGGER pr55_fail_completion BEFORE UPDATE ON card_transfer_operations FOR EACH ROW BEGIN IF NEW.operation_key='${moveBody.operationKey}' AND NEW.status='completed' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic completion failure'; END IF; END`);
  assert.equal((await request(admin!,`${transfers}/execute`,"POST",moveBody)).status(),500);
  const [afterCompletionFailure]=await pool.query<RowDataPacket[]>("SELECT id FROM kanban_cards WHERE title=?",[moveSource.card.title]);assert.equal(afterCompletionFailure.length,1);assert.equal(afterCompletionFailure[0].id,moveSource.card.id);
  await pool.query("DROP TRIGGER pr55_fail_completion");

  let lostMove:any;
  await context.route(executionRoute,async route=>{lostMove=route.request().postDataJSON();const committed=await route.fetch();assert.equal(committed.status(),200);await route.abort("connectionclosed");});
  await admin!.goto(`${base}/#/admin/pr55-synthetic`);await admin!.reload();await admin!.getByRole("button",{name:"Transferências entre clientes",exact:true}).click();
  modal=admin!.locator(".card-client-dialog");await modal.locator(`[data-operation-key="${moveBody.operationKey}"]`).getByRole("button",{name:"Retomar esta operação"}).click();await modal.getByRole("alert").waitFor();await context.unroute(executionRoute);
  assert.equal(lostMove.operationKey,moveBody.operationKey);
  const moved=await execute(moveBody);assert.equal(moved.operation.status,"completed");
  const [movedRows]=await pool.query<RowDataPacket[]>("SELECT id,client_account_id,column_id FROM kanban_cards WHERE title=?",[moveSource.card.title]);assert.equal(movedRows.length,1);assert.equal(movedRows[0].id,moved.operation.destinationCardId);assert.equal(movedRows[0].client_account_id,otherId);assert.equal(movedRows[0].column_id,destinationColumn);
  await modal.getByRole("button",{name:"Consultar resultado"}).click();await modal.locator(`[data-operation-key="${moveBody.operationKey}"]`).filter({hasText:"Concluída"}).waitFor();
  await admin!.screenshot({path:path.join(output,"02-atomic-move.png"),fullPage:true});await modal.getByRole("button",{name:"Fechar",exact:true}).first().click();
  check("move deletion failure rolls back destination; same operation safely recovers and replays after lost successful response");
  // Failure of creation must neither delete the original nor complete the ledger.
  const failingSource=await api(`/api/clients/${clientId}/cards`,"POST",{columnId,title:"Falha de criação"});
  const failing=opBody(failingSource.card.id,"move");await reserve(failing);
  await pool.query(`CREATE TRIGGER pr55_fail_insert BEFORE INSERT ON kanban_cards FOR EACH ROW BEGIN IF NEW.client_account_id='${otherId}' AND NEW.title='Falha de criação' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic create failure'; END IF; END`);
  const failedCreation=await request(admin!,`${transfers}/execute`,"POST",failing);assert.equal(failedCreation.status(),500);
  assert.ok(await api(`/api/clients/${clientId}/cards/${failingSource.card.id}`));
  await pool.query("DROP TRIGGER pr55_fail_insert");await execute(failing);
  check("creation failure preserves source and same key is safely retried");
  // Binding, source changes, permissions, cancellation and absence of schema are tested explicitly.
  assert.equal((await request(admin!,`${transfers}/execute`,"POST",{...same,mode:"move"})).status(),409);
  assert.equal((await request(admin!,`${transfers}/execute`,"POST",{...same,columnId})).status(),400);
  const stale=opBody(zoned.card.id,"move");await reserve(stale);await pool.query("UPDATE kanban_cards SET caption='Changed after reserve' WHERE id=?",[zoned.card.id]);
  assert.equal((await request(admin!,`${transfers}/execute`,"POST",stale)).status(),409);
  await api(`${transfers}/cancel`,"POST",stale);assert.equal((await request(admin!,`${transfers}/execute`,"POST",stale)).status(),409);
  const removedColumn=randomUUID();await pool.query("INSERT INTO kanban_columns(id,client_account_id,name) VALUES (?,?,'Temporary destination')",[removedColumn,otherId]);
  const removedColumnOp={...opBody(zoned.card.id),columnId:removedColumn};await reserve(removedColumnOp);await pool.query("DELETE FROM kanban_columns WHERE id=?",[removedColumn]);
  const removedColumnCancel=await api(`${transfers}/cancel`,"POST",removedColumnOp);assert.equal(removedColumnCancel.operation.status,"cancelled");
  const raced=opBody(zoned.card.id);await reserve(raced);
  const [execution,cancellation]=await Promise.all([request(admin!,`${transfers}/execute`,"POST",raced),request(admin!,`${transfers}/cancel`,"POST",raced)]);
  assert.equal(cancellation.status(),200);assert.ok([200,409].includes(execution.status()));
  const [racedLedger]=await pool.query<RowDataPacket[]>("SELECT status,destination_card_id FROM card_transfer_operations WHERE operation_key=?",[raced.operationKey]);
  if(execution.status()===200)assert.equal(racedLedger[0].status,"completed");else {assert.equal(racedLedger[0].status,"cancelled");assert.equal(racedLedger[0].destination_card_id,null);}
  const linkedMove=opBody(source.card.id,"move");await reserve(linkedMove);assert.equal((await request(admin!,`${transfers}/execute`,"POST",linkedMove)).status(),409);await api(`${transfers}/cancel`,"POST",linkedMove);
  const foreignLogin=(await context.request.post(`${base}/api/auth/login`,{data:{email:"foreign@synthetic.invalid",password}}));const foreignToken=(await foreignLogin.json()).accessToken;
  assert.equal((await context.request.post(`${base}${transfers}/execute`,{headers:{Authorization:`Bearer ${foreignToken}`},data:same})).status(),403);
  // A second internal actor with both memberships may not reuse the first actor's operation key.
  await pool.query("INSERT INTO client_memberships(id,user_id,client_account_id,membership_role) VALUES (?,?,?,'colaborador')",[randomUUID(),foreignUserId,clientId]);
  assert.equal((await context.request.post(`${base}${transfers}/execute`,{headers:{Authorization:`Bearer ${foreignToken}`},data:same})).status(),404);
  const ownForeign=opBody(zoned.card.id);await context.request.post(`${base}${transfers}/reserve`,{headers:{Authorization:`Bearer ${foreignToken}`},data:ownForeign});
  await pool.query("DELETE FROM client_memberships WHERE user_id=? AND client_account_id=?",[foreignUserId,otherId]);
  assert.equal((await context.request.post(`${base}${transfers}/execute`,{headers:{Authorization:`Bearer ${foreignToken}`},data:ownForeign})).status(),403);
  app.appEnv.CARD_TRANSFERS_ENABLED=false;assert.equal((await request(admin!,`${transfers}/reserve`,"POST",opBody(source.card.id))).status(),503);app.appEnv.CARD_TRANSFERS_ENABLED=true;
  check("key binding, destination column, actor isolation, revoked access, changed source, linked move, cancellation and disabled feature enforced");
  const [links]=await pool.query<RowDataPacket[]>("SELECT id FROM approval_links WHERE client_account_id=?",[otherId]);assert.equal(links.length,0);
  const [publications]=await pool.query<RowDataPacket[]>("SELECT id FROM meta_scheduled_publications WHERE client_account_id=?",[otherId]);assert.equal(publications.length,0);
  const [schedules]=await pool.query<RowDataPacket[]>("SELECT scheduled_at,published_at FROM kanban_cards WHERE client_account_id=?",[otherId]);assert.ok(schedules.every(row=>row.scheduled_at===null&&row.published_at===null));
  const [metaAfter]=await pool.query("SELECT * FROM meta_scheduled_publications WHERE id=?",[scheduledId]);assert.deepEqual(metaAfter,metaBefore);
  assert.equal(evidence.browserErrors.length,0,JSON.stringify(evidence.browserErrors));
  const invalid=await request(admin!,`/api/clients/${otherId}/cards`,"POST",{title:"Invalid",scheduledTimeZone:null});assert.equal(invalid.status(),400);
  const auxiliaryErrors=evidence.unexpectedApiResponses.filter((res:any)=>/internal-approvals|\/texts/.test(res.url));assert.equal(auxiliaryErrors.length,0,JSON.stringify(auxiliaryErrors));
  check("no credentials, schedules or Meta copied; original publication preserved; auxiliary HTTP 500s absent with complete fixture; no browser rejections");
  evidence.result="passed";
} catch(error) {
  evidence.result="failed";evidence.error=error instanceof Error?error.stack:String(error);console.error(error);if(browser)for(const ctx of browser.contexts())for(const page of ctx.pages()){ console.error("Page at failure",page.url(),(await page.locator("body").innerText()).slice(0,2000)); await page.screenshot({path:path.join(output,`failure-${page===admin?"admin":"portal"}.png`),fullPage:true,animations:"disabled"}).catch(()=>{}); }if(admin)await admin.screenshot({path:path.join(output,"failure.png"),fullPage:true,animations:"disabled"}).catch(()=>{});process.exitCode=1;
} finally {
  await browser?.close();await app.close();await pool.end();await server.query(`DROP DATABASE \`${database}\``);await server.end();evidence.finishedAt=new Date().toISOString();await writeFile(path.join(output,"results.json"),JSON.stringify(evidence,null,2)+"\n");
}
