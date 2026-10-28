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
import { dashboardNotesRoutes } from "../dashboard-notes/dashboard-notes.routes.js";

const socketPath = process.env.BRIEF_TEST_SOCKET;
if (!socketPath || !/^\/(?:private\/)?tmp\/brief-mariadb-[^/]+\/server\.sock$/.test(socketPath)) throw Error("Only disposable /tmp/brief-mariadb-*/server.sock accepted; no .env or remote DB is loaded.");
const root = fileURLToPath(new URL("../../../../../../", import.meta.url));
const output = path.resolve(root, "docs/pr54-integrated-validation");
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
const title="PR54 — Pauta sintética integrada";
try {
  const [version] = await pool.query<RowDataPacket[]>("SELECT VERSION() AS version, @@socket AS socket, @@skip_networking AS skipNetworking, DATABASE() AS db");
  evidence.database=version[0];assert.equal(Number(version[0].skipNetworking),1);
  const schema=await readFile(path.join(root,"v2/apps/api/db/schema.sql"),"utf8");
  await pool.query(schema.replace("  brief_withdrawn_at DATETIME(3) NULL,\n", ""));
  await pool.query(await readFile(path.join(root,"v2/database/migrations/20261014_internal_approval_requests.sql"),"utf8"));
  await pool.query("ALTER TABLE client_texts ADD COLUMN cover_image_url VARCHAR(2048) NULL AFTER tags_json");
  const hash=await hashPassword(password);
  for (const [id,email,role] of [[userId,"admin@synthetic.invalid","super_admin"],[clientUserId,"client@synthetic.invalid","cliente"],[foreignUserId,"foreign@synthetic.invalid","colaborador"],[viewerId,"viewer@synthetic.invalid","cliente"]]) await pool.query("INSERT INTO users(id,full_name,email,password_hash,global_role,locale) VALUES (?, 'Teste sintético PR54', ?, ?, ?, 'pt-BR')",[id,email,hash,role]);
  for (const [id,slug] of [[clientId,"pr54-synthetic"],[otherId,"pr54-other"]]) {
    await pool.query("INSERT INTO client_accounts(id,name,slug,portal_title,locale,show_archived_to_client) VALUES (?, 'Cliente sintético PR54', ?, 'Portal de teste', 'pt', 1)",[id,slug]);
    await pool.query("INSERT INTO client_permissions(id,client_account_id,allow_client_search,allow_client_edit_caption,allow_client_create_tags,allow_client_view_invoices,allow_client_view_reports) VALUES (?,?,1,1,1,0,0)",[randomUUID(),id]);
  }
  for (const [id,account,role,level] of [[clientUserId,clientId,"cliente","approver"],[viewerId,clientId,"cliente","viewer"],[foreignUserId,otherId,"colaborador","approver"]]) await pool.query("INSERT INTO client_memberships(id,user_id,client_account_id,membership_role,portal_access_level) VALUES (?,?,?,?,?)",[randomUUID(),id,account,role,level]);
  const columnId=randomUUID();await pool.query("INSERT INTO kanban_columns(id,client_account_id,name,visible_to_client) VALUES (?,?,'Pautas para aprovação',1)",[columnId,clientId]);
  const regularId=randomUUID(), scheduledId=randomUUID();
  await pool.query("INSERT INTO kanban_cards(id,client_account_id,column_id,title,status_json) VALUES (?,?,?,'Card comum preservado',?)",[regularId,clientId,columnId,JSON.stringify(["Enviar para Cliente"])]);
  await pool.query("INSERT INTO meta_scheduled_publications(id,client_account_id,card_id,platform,meta_asset_id,scheduled_at,timezone,status,idempotency_key) VALUES (?,?,?,'instagram','synthetic-no-provider','2099-01-01 12:00:00','Europe/Stockholm','scheduled',?)",[scheduledId,clientId,regularId,"f".repeat(64)]);
  // Exercise the proposed DDL with existing synthetic data and a competing metadata lock.
  const [preMigration]=await pool.query<RowDataPacket[]>("SELECT id,title,status_json FROM kanban_cards ORDER BY id");
  const blockerDdl=await pool.getConnection(), ddl=await pool.getConnection();
  const migration=await readFile(path.join(root,"v2/database/migrations/20261028_brief_withdrawal.sql"),"utf8");
  try {
    await blockerDdl.beginTransaction();await blockerDdl.query("SELECT id FROM kanban_cards LIMIT 1");
    await assert.rejects(ddl.query(migration),(err:any)=>err.code==="ER_LOCK_WAIT_TIMEOUT");
    const [absent]=await ddl.query<RowDataPacket[]>("SHOW COLUMNS FROM kanban_cards LIKE 'brief_withdrawn_at'");assert.equal(absent.length,0);
    await blockerDdl.commit();await ddl.query(migration);
    const [postMigration]=await ddl.query<RowDataPacket[]>("SELECT id,title,status_json FROM kanban_cards ORDER BY id");assert.deepEqual(postMigration,preMigration);
    const [values]=await ddl.query<RowDataPacket[]>("SELECT brief_withdrawn_at FROM kanban_cards");assert.ok(values.every(row=>row.brief_withdrawn_at===null));
    check("proposed INSTANT/NONE migration preserves existing rows and fails safely on metadata-lock timeout");
  } finally {await blockerDdl.rollback();blockerDdl.release();ddl.release();}
  const snapshot=async()=>{const [cards]=await pool.query("SELECT * FROM kanban_cards WHERE id=?",[regularId]);const [meta]=await pool.query("SELECT * FROM meta_scheduled_publications WHERE id=?",[scheduledId]);return JSON.stringify({cards,meta});};
  const unaffected=await snapshot();
  app.decorate("appEnv",{NODE_ENV:"test",APP_NAME:"pr54-disposable",APP_TIMEZONE:"Europe/Stockholm",JWT_SECRET:randomUUID()+randomUUID(),JWT_EXPIRES_IN:"1h",UPLOAD_DIR:path.join(path.dirname(socketPath),"uploads"),DEMO_MODE:false,REPORT_AI_ENABLED:false,BRAND_BRAIN_AI_ENABLED:false} as never);
  await app.register(fp(async a=>{a.decorate("db",pool);},{name:"db-plugin"}));
  await app.register(httpErrorsPluginRegistered);await app.register(fastifyFormbody);await app.register(authPluginRegistered);
  // Actual application routes, without buildApp's workers, DB env loading or cloud providers.
  for (const routes of [authRoutes,clientRoutes,columnRoutes,cardRoutes,portalRoutes,commentRoutes,approvalRoutes,calendarRoutes,uploadRoutes,tagRoutes,hashtagRoutes,contractRoutes,textRoutes,reportRoutes,invoiceRoutes,dashboardNotesRoutes]) await app.register(routes,{prefix:"/api"});
  await app.register(fastifyStatic,{root:path.join(root,"v2/apps/web/dist"),prefix:"/",index:false});
  app.get("/",async (_r,reply)=>reply.sendFile("index.html"));
  app.setErrorHandler((error, request, reply) => { const err=error as Error & {statusCode?:number}; console.error("HTTP error",request.url,err.message); reply.code(err.statusCode ?? 500).send({message:err.message}); });
  const base=await app.listen({host:"127.0.0.1",port:0});evidence.httpOrigin=base;
  const sanity=await app.inject({method:"POST",url:"/api/auth/login",payload:{email:"admin@synthetic.invalid",password}});assert.equal(sanity.statusCode,200,sanity.body);console.log("Local API and login ready");
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
  await admin.goto(`${base}/#/admin/pr54-synthetic`);await admin.getByTitle("Ideias de Pauta",{exact:true}).click();await admin.getByRole("button",{name:"+ Nova ideia de pauta"}).click();
  const form=admin.locator(".drawer-ideas-form");await form.getByLabel("Título",{exact:true}).fill(title);await form.getByLabel("Descrição",{exact:true}).fill("Descrição sintética que deve permanecer integralmente salva.");await form.getByLabel("Legenda sugerida",{exact:true}).fill("Legenda sintética PR54");
  // Tiny generated PNG; no real client asset is read or copied.
  await form.locator('input[type="file"]').setInputFiles({name:"synthetic.png",mimeType:"image/png",buffer:await sharp({create:{width:64,height:64,channels:3,background:"#3b82f6"}}).png().toBuffer()});
  await form.getByRole("button",{name:"Enviar para Pautas",exact:true}).click();await admin.getByText("Pauta enviada para a aba Pautas.",{exact:true}).waitFor();
  await admin.getByRole("button",{name:"Fechar janela",exact:true}).click();
  await admin.getByRole("button",{name:/^Pautas\s/}).click();
  let row=admin.locator(".pautas-row").filter({hasText:title});await row.getByRole("button",{name:"Enviar",exact:true}).click();await row.locator(".pauta-status.sent").waitFor();
  const drawer=await api(`/api/clients/${clientId}/workspace-drawer`);const idea=drawer.data.pautaIdeas.find((i:any)=>i.title===title);assert.ok(idea.cardId);const id=idea.cardId;
  await api(`/api/clients/${clientId}/cards/${id}/comments`,"POST",{commentText:"Comentário interno preservado",isInternal:true});
  await api(`/api/clients/${clientId}/cards/${id}`,"PATCH",{tags:["Etiqueta PR54"],expectedApprovalRevision:0});
  const oldLink=(await api(`/api/clients/${clientId}/cards/${id}/approval-links`,"POST",{expectedApprovalRevision:0})).approvalLink;
  const before=await api(`/api/clients/${clientId}/cards/${id}`);
  const mediaUrl=before.card.mediaUrls[0];assert.ok(mediaUrl);const mediaPath=path.join(app.appEnv.UPLOAD_DIR,path.basename(mediaUrl));const fileHash=createHash("sha256").update(await readFile(mediaPath)).digest("hex");
  check("real browser login, create/upload synthetic pauta and explicit send");
  const login=async(email:string)=>{const res=await context.request.post(`${base}/api/auth/login`,{data:{email,password}});assert.equal(res.status(),200);return res.json();};
  const clientLogin=await login("client@synthetic.invalid");
  const clientContext=await browser.newContext({viewport:{width:1440,height:1000}});await clientContext.route("**/*",route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  clientContext.setDefaultTimeout(15000);
  clientContext.on("page",page=>page.on("pageerror",err=>evidence.browserErrors.push(err.message)));
  const portal=await clientContext.newPage();
  await portal.goto(`${base}/#/login`);await portal.locator(".login-intro").waitFor({state:"detached"});
  await portal.locator("#login-username").fill("client@synthetic.invalid");await portal.locator("#login-password").fill(password);await portal.locator(".login-submit").click();await portal.waitForURL("**/#/portal/pr54-synthetic");
  await portal.getByText(title,{exact:true}).first().waitFor();check("pauta visible in real client Portal before withdrawal");await portal.screenshot({path:path.join(output,"01-portal-sent.png"),fullPage:true,animations:"disabled"});
  const clientApi=async(url:string,method="GET",data?:unknown)=>context.request.fetch(`${base}${url}`,{method,headers:{Authorization:`Bearer ${clientLogin.accessToken}`},data});
  await clientApi(`/api/portal/accounts/${clientId}/cards/${id}/comments`,"POST",{commentText:"Comentário do cliente preservado",isInternal:false});
  await row.getByLabel("Menu da pauta").click();admin.once("dialog",dialog=>{assert.equal(dialog.message(),"Esta pauta deixará de aparecer para o cliente, mas continuará salva no seu banco de pautas. Deseja continuar?");void dialog.accept();});await row.getByRole("button",{name:"Retirar do cliente",exact:true}).click();await row.locator(".pauta-status.withdrawn").waitFor();
  await admin.screenshot({path:path.join(output,"02-admin-withdrawn.png"),fullPage:true,animations:"disabled"});
  await portal.reload();await portal.locator(".initial-data-shield").waitFor({state:"detached"});await portal.getByText(title,{exact:true}).waitFor({state:"detached"});
  await portal.locator("#portal-navigation").getByRole("button",{name:"Pesquisa",exact:true}).click();
  await portal.locator('.portal-search-field input').fill("PR54");await portal.getByText("Nenhum conteúdo encontrado",{exact:true}).waitFor();
  await portal.locator("#portal-navigation").getByRole("button",{name:"Arquivados",exact:true}).click();await portal.getByText("Nenhum conteúdo arquivado",{exact:true}).waitFor();assert.equal(await portal.getByText(title,{exact:true}).count(),0);
  await portal.locator("#portal-navigation").getByRole("button",{name:/^Aprovados/}).click();assert.equal(await portal.getByText(title,{exact:true}).count(),0);
  await portal.screenshot({path:path.join(output,"04-portal-withdrawn.png"),fullPage:true,animations:"disabled"});
  for (const url of [`/api/portal/accounts/${clientId}/board`,`/api/portal/accounts/${clientId}/board?archived=true`,`/api/portal/accounts/${clientId}/search?q=PR54`]) {const res=await clientApi(url);assert.equal(res.status(),200);assert.ok(!(await res.text()).includes(id),url);}
  for (const suffix of ["","/comments"]) assert.equal((await clientApi(`/api/portal/accounts/${clientId}/cards/${id}${suffix}`)).status(),404);
  assert.equal((await context.request.get(`${base}/api/portal/approval/${oldLink.token}`)).status(),403);
  const publicPage=await clientContext.newPage();await publicPage.goto(`${base}/#/approval/${oldLink.token}`);await publicPage.getByText(/expirou|encerrado/).first().waitFor();await publicPage.close();
  check("withdraw confirmation; Portal, search, archives, direct detail/comments and public link unavailable");
  const after=await api(`/api/clients/${clientId}/cards/${id}`);
  for(const key of ["title","caption","editorialBrief","mediaUrls","tags","clientAccountId"])assert.deepEqual(after.card[key],before.card[key]);
  assert.ok(after.comments.some((c:any)=>c.commentText==="Comentário interno preservado"));assert.ok(after.comments.some((c:any)=>c.commentText==="Comentário do cliente preservado"));assert.ok(after.approvalEvents.some((e:any)=>e.action==="withdrawn"));
  assert.equal(createHash("sha256").update(await readFile(mediaPath)).digest("hex"),fileHash);
  await admin.reload();await admin.getByRole("button",{name:/^Pautas\s/}).click();row=admin.locator(".pautas-row").filter({hasText:title});await row.locator(".pauta-status.withdrawn").waitFor();
  check("administrative content, image bytes, comments/history and withdrawal survive full browser reload");
  const foreign=await login("foreign@synthetic.invalid"),viewer=await login("viewer@synthetic.invalid");
  const authRequest=async(token:string,url:string,data:any)=>context.request.post(`${base}${url}`,{headers:{Authorization:`Bearer ${token}`},data});
  const withdrawUrl=`/api/clients/${clientId}/cards/${id}/brief-delivery/withdraw`;
  assert.equal((await authRequest(clientLogin.accessToken,withdrawUrl,{expectedApprovalRevision:1})).status(),403);assert.equal((await authRequest(foreign.accessToken,withdrawUrl,{expectedApprovalRevision:1})).status(),403);
  assert.equal((await authRequest(viewer.accessToken,`/api/portal/accounts/${clientId}/cards/${id}/decision`,{approved:true,expectedApprovalRevision:1})).status(),403);
  assert.equal((await context.request.post(`${base}${withdrawUrl}`,{data:{expectedApprovalRevision:1}})).status(),401);
  assert.equal((await clientApi(`/api/portal/accounts/${clientId}/cards/${id}/decision`,"POST",{approved:true,expectedApprovalRevision:0})).status(),404);
  assert.equal((await clientApi(`/api/portal/accounts/${clientId}/cards/${id}/caption`,"PATCH",{caption:"late client edit"})).status(),404);
  await api(`/api/clients/${clientId}/workspace-drawer/pauta-ideas/${idea.id}`,"PATCH",{patch:{caption:"Legenda atualizada internamente",expectedApprovalRevision:1}});
  assert.ok((await api(`/api/clients/${clientId}/cards/${id}`)).card.briefWithdrawnAt);
  check("real JWT user/client/foreign/viewer/anonymous permissions; editing withdrawn pauta never republishes it");
  await admin.reload();await admin.getByRole("button",{name:/^Pautas\s/}).click();row=admin.locator(".pautas-row").filter({hasText:title});await row.getByRole("button",{name:"Reenviar",exact:true}).click();await row.locator(".pauta-status.sent").waitFor();await portal.reload();await portal.getByText(title,{exact:true}).first().waitFor();
  assert.equal((await context.request.post(`${base}/api/portal/approval/${oldLink.token}/decision`,{data:{approved:true}})).status(),403);
  const resent=await api(`/api/clients/${clientId}/cards/${id}`);assert.equal(resent.card.id,id);assert.equal(resent.card.briefWithdrawnAt,null);assert.ok(resent.approvalLinks.some((link:any)=>link.isActive));
  await portal.screenshot({path:path.join(output,"03-portal-resent.png"),fullPage:true,animations:"disabled"});check("explicit resend reuses card and existing approval cycle; old links remain invalid");
  // An approval already made in the browser is retained when withdrawing an approved pauta.
  await portal.locator(".portal-pauta-card").filter({hasText:title}).click();
  const [approvedResponse]=await Promise.all([portal.waitForResponse(res=>res.url().endsWith(`/cards/${id}/decision`)),portal.getByRole("button",{name:"Aprovar",exact:true}).click()]);assert.equal(approvedResponse.status(),200);
  await admin.reload();await admin.getByRole("button",{name:/^Pautas\s/}).click();row=admin.locator(".pautas-row").filter({hasText:title});await row.locator(".pauta-status.approved").waitFor();
  await row.getByLabel("Menu da pauta").click();admin.once("dialog",dialog=>void dialog.accept());await row.getByRole("button",{name:"Retirar do cliente",exact:true}).click();await row.locator(".pauta-status.withdrawn").waitFor();
  const approvedHistory=await api(`/api/clients/${clientId}/cards/${id}`);assert.equal(approvedHistory.card.approvalState,"approved");assert.ok(approvedHistory.approvalEvents.some((event:any)=>event.action==="approved"));
  await portal.reload();assert.ok(!(await (await clientApi(`/api/portal/accounts/${clientId}/board`)).text()).includes(id));
  await row.getByRole("button",{name:"Reenviar",exact:true}).click();await row.locator(".pauta-status.sent").waitFor();
  check("browser approval → withdraw approved pauta → resend preserves the original approval event");
  // Queue both real HTTP actions behind an explicit fixture row lock.
  const current=await api(`/api/clients/${clientId}/cards/${id}`);
  const blocker=await pool.getConnection();await blocker.beginTransaction();await blocker.query("SELECT id FROM kanban_cards WHERE id=? FOR UPDATE",[id]);
  let settled=false;
  const withdrawal=request(admin,withdrawUrl,"POST",{expectedApprovalRevision:current.card.approvalRevision}).then(response=>{settled=true;return response;});
  await new Promise(resolve=>setTimeout(resolve,30));
  const decision=clientApi(`/api/portal/accounts/${clientId}/cards/${id}/decision`,"POST",{approved:true,commentText:"Concurrent decision",expectedApprovalRevision:current.card.approvalRevision});
  await new Promise(resolve=>setTimeout(resolve,70));assert.equal(settled,false);await blocker.commit();blocker.release();
  const [withdrawResult,decisionResult]=await Promise.all([withdrawal,decision]);evidence.concurrentStatuses={withdraw:withdrawResult.status(),decision:decisionResult.status()};
  if(withdrawResult.status()===200){assert.equal(decisionResult.status(),404);assert.ok(!(await api(`/api/clients/${clientId}/cards/${id}`)).comments.some((c:any)=>c.commentText==="Concurrent decision"));}
  else {assert.equal(withdrawResult.status(),409);assert.equal(decisionResult.status(),200);const changed=await api(`/api/clients/${clientId}/cards/${id}`);await api(withdrawUrl,"POST",{expectedApprovalRevision:changed.card.approvalRevision});}
  assert.ok((await api(`/api/clients/${clientId}/cards/${id}`)).card.briefWithdrawnAt);
  assert.equal((await request(admin,`/api/clients/${clientId}/cards/${regularId}/brief-delivery/withdraw`,"POST",{expectedApprovalRevision:0})).status(),400);
  assert.equal(await snapshot(),unaffected);check("concurrent client action serialized/rejected; ordinary card and synthetic Meta publication byte-for-byte unchanged");
  assert.equal(evidence.unexpectedApiResponses.length,0,JSON.stringify(evidence.unexpectedApiResponses));assert.equal(evidence.browserErrors.length,0,JSON.stringify(evidence.browserErrors));
  evidence.result="passed";
} catch(error) {
  evidence.result="failed";evidence.error=error instanceof Error?error.stack:String(error);console.error(error);if(browser)for(const ctx of browser.contexts())for(const page of ctx.pages()){ console.error("Page at failure",page.url(),(await page.locator("body").innerText()).slice(0,2000)); await page.screenshot({path:path.join(output,`failure-${page===admin?"admin":"portal"}.png`),fullPage:true,animations:"disabled"}).catch(()=>{}); }if(admin)await admin.screenshot({path:path.join(output,"failure.png"),fullPage:true,animations:"disabled"}).catch(()=>{});process.exitCode=1;
} finally {
  await browser?.close();await app.close();await pool.end();await server.query(`DROP DATABASE \`${database}\``);await server.end();evidence.finishedAt=new Date().toISOString();await writeFile(path.join(output,"results.json"),JSON.stringify(evidence,null,2)+"\n");
}
