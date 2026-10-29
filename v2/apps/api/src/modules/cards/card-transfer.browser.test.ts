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
  await pool.query(schema.replace("  brief_withdrawn_at DATETIME(3) NULL,\n", ""));
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
  app.decorate("appEnv",{NODE_ENV:"test",APP_NAME:"pr55-disposable",APP_TIMEZONE:"Europe/Stockholm",JWT_SECRET:randomUUID()+randomUUID(),JWT_EXPIRES_IN:"1h",UPLOAD_DIR:path.join(path.dirname(socketPath),"uploads"),DEMO_MODE:false,REPORT_AI_ENABLED:false,BRAND_BRAIN_AI_ENABLED:false} as never);
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

  await mkdir(app.appEnv.UPLOAD_DIR,{recursive:true});
  await writeFile(path.join(app.appEnv.UPLOAD_DIR,"abc.png"),await sharp({create:{width:64,height:64,channels:3,background:"#3b82f6"}}).png().toBuffer());
  await writeFile(path.join(app.appEnv.UPLOAD_DIR,"abc.pdf"),Buffer.from("%PDF-1.4\n% synthetic attachment only\n%%EOF"));
  const destinationColumn=randomUUID();
  await pool.query("INSERT INTO kanban_columns(id,client_account_id,name,visible_to_client) VALUES (?,?,'Coluna destino específica',1)",[destinationColumn,otherId]);
  const source = await api(`/api/clients/${clientId}/cards`,"POST",{columnId,title:"Cópia sintética sem fuso",caption:"Legenda completa",mediaUrls:["/api/uploads/abc.png","/api/uploads/abc.pdf"],primaryMediaUrl:"/api/uploads/abc.png",tags:["Teste"],hashtags:["#teste"],editorialBrief:{concept:"Conceito sintético"},priorityLevel:"high"});
  await pool.query("UPDATE kanban_cards SET scheduled_at='2099-01-01 12:00:00',published_at='2026-01-01 12:00:00' WHERE id=?",[source.card.id]);
  await pool.query("INSERT INTO approval_links(id,client_account_id,card_id,token,expires_at) VALUES (?,?,?,?,'2099-01-01')",[randomUUID(),clientId,source.card.id,"synthetic-secret-token"]);
  await pool.query("UPDATE meta_scheduled_publications SET card_id=? WHERE id=?",[source.card.id,scheduledId]);
  const [metaBefore]=await pool.query("SELECT * FROM meta_scheduled_publications WHERE id=?",[scheduledId]);
  const openTransfer=async(title:string)=>{
    await admin!.goto(`${base}/#/admin/pr55-synthetic`);await admin!.reload();
    await admin!.getByText(title,{exact:true}).first().click({button:"right"});
    await admin!.getByRole("button",{name:/Enviar para outro cliente/}).click();
    const modal=admin!.locator(".card-client-dialog");
    await modal.locator("select").nth(0).selectOption("pr55-other");
    await modal.locator("select").nth(1).selectOption(destinationColumn);
    return modal;
  };
  let modal=await openTransfer(source.card.title);
  await modal.getByRole("button",{name:"Copiar card",exact:true}).click();
  await modal.waitFor({state:"detached"});
  const [copies]=await pool.query<RowDataPacket[]>("SELECT * FROM kanban_cards WHERE client_account_id=? AND title=?",[otherId,source.card.title+" (copia)"]);
  assert.equal(copies.length,1);assert.equal(copies[0].column_id,destinationColumn);assert.equal(copies[0].caption,"Legenda completa");
  assert.equal(copies[0].scheduled_at,null);
  await admin!.goto(`${base}/#/admin/pr55-other`);await admin!.reload();await admin!.getByText(source.card.title+" (copia)",{exact:true}).first().waitFor();
  check("copy without timezone: chosen column and persistence after reload");
  await admin!.screenshot({path:path.join(output,"01-copy.png"),fullPage:true});

  for (const field of ["media_urls_json","editorial_brief_json","tags_json","hashtags_json","priority_level"]) {
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
  const [zoneCopies]=await pool.query<RowDataPacket[]>("SELECT * FROM kanban_cards WHERE client_account_id=? AND title=?",[otherId,"Cartão com fuso (copia)"]);
  assert.equal(zoneCopies[0].scheduled_timezone,"Europe/Stockholm");
  check("valid timezone preserved");
  const failingCreate=`**/api/clients/${otherId}/cards`;
  await context.route(failingCreate,route=>route.request().method()==="POST"?route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic creation failure"})}):route.continue());
  modal=await openTransfer(zoned.card.title);await modal.getByRole("button",{name:"Copiar card",exact:true}).click();await modal.getByRole("alert").waitFor();assert.ok(await modal.isVisible());
  await modal.getByRole("button",{name:"Fechar",exact:true}).click();
  check("creation API failure leaves modal open with clear message");
  modal=await openTransfer(zoned.card.title);await modal.getByLabel("Mover (transferir)").check();await modal.getByRole("button",{name:"Mover card",exact:true}).click();await modal.getByRole("alert").waitFor();
  const [stillThere]=await pool.query<RowDataPacket[]>("SELECT id FROM kanban_cards WHERE id=?",[zoned.card.id]);assert.equal(stillThere.length,1);
  await modal.getByRole("button",{name:"Fechar",exact:true}).click();await context.unroute(failingCreate);
  check("move creation failure preserves original");
  const deletion=`**/api/clients/${clientId}/cards/${zoned.card.id}`;
  await context.route(deletion,route=>route.request().method()==="DELETE"?route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Synthetic deletion failure"})}):route.continue());
  modal=await openTransfer(zoned.card.title);await modal.getByLabel("Mover (transferir)").check();await modal.getByRole("button",{name:"Mover card",exact:true}).click();
  await modal.getByRole("alert").filter({hasText:"criado no destino"}).waitFor();assert.equal(await modal.getByRole("button",{name:"Mover card",exact:true}).isDisabled(),true);
  const [partial]=await pool.query<RowDataPacket[]>("SELECT id FROM kanban_cards WHERE title=?",[zoned.card.title]);assert.equal(partial.length,2);
  await admin!.screenshot({path:path.join(output,"02-partial-move.png"),fullPage:true});
  await modal.getByRole("button",{name:"Fechar",exact:true}).click();await context.unroute(deletion);
  check("deletion failure reports partial move, keeps original and blocks repeat in same dialog");
  const moveSource=await api(`/api/clients/${clientId}/cards`,"POST",{columnId,title:"Mover com sucesso"});
  modal=await openTransfer(moveSource.card.title);await modal.getByLabel("Mover (transferir)").check();await modal.getByRole("button",{name:"Mover card",exact:true}).click();await modal.waitFor({state:"detached"});
  const [moved]=await pool.query<RowDataPacket[]>("SELECT client_account_id,column_id FROM kanban_cards WHERE title=?",[moveSource.card.title]);assert.equal(moved.length,1);assert.equal(moved[0].client_account_id,otherId);assert.equal(moved[0].column_id,destinationColumn);
  check("successful move removes original only after destination creation");
  const [links]=await pool.query<RowDataPacket[]>("SELECT id FROM approval_links WHERE client_account_id=?",[otherId]);assert.equal(links.length,0);
  const [publications]=await pool.query<RowDataPacket[]>("SELECT id FROM meta_scheduled_publications WHERE client_account_id=?",[otherId]);assert.equal(publications.length,0);
  const [schedules]=await pool.query<RowDataPacket[]>("SELECT scheduled_at,published_at FROM kanban_cards WHERE client_account_id=?",[otherId]);assert.ok(schedules.every(row=>row.scheduled_at===null&&row.published_at===null));
  const [metaAfter]=await pool.query("SELECT * FROM meta_scheduled_publications WHERE id=?",[scheduledId]);assert.deepEqual(metaAfter,metaBefore);
  assert.equal(evidence.browserErrors.length,0,JSON.stringify(evidence.browserErrors));
  const invalid=await request(admin!,`/api/clients/${otherId}/cards`,"POST",{title:"Invalid",scheduledTimeZone:null});assert.equal(invalid.status(),400);
  check("no approval credentials, Meta publications or schedules copied; invalid input is HTTP 400; no unhandled browser errors");
  evidence.result="passed";
} catch(error) {
  evidence.result="failed";evidence.error=error instanceof Error?error.stack:String(error);console.error(error);if(browser)for(const ctx of browser.contexts())for(const page of ctx.pages()){ console.error("Page at failure",page.url(),(await page.locator("body").innerText()).slice(0,2000)); await page.screenshot({path:path.join(output,`failure-${page===admin?"admin":"portal"}.png`),fullPage:true,animations:"disabled"}).catch(()=>{}); }if(admin)await admin.screenshot({path:path.join(output,"failure.png"),fullPage:true,animations:"disabled"}).catch(()=>{});process.exitCode=1;
} finally {
  await browser?.close();await app.close();await pool.end();await server.query(`DROP DATABASE \`${database}\``);await server.end();evidence.finishedAt=new Date().toISOString();await writeFile(path.join(output,"results.json"),JSON.stringify(evidence,null,2)+"\n");
}
