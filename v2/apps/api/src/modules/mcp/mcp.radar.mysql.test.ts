import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createPlanningMcpServer } from "./mcp.server.js";
import { radarSuggestionsRoutes } from "../radar-suggestions/radar-suggestions.routes.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import mysql, { type RowDataPacket } from "mysql2/promise";
import Fastify from "fastify";
import { BrandBrainAiRepository } from "../brand-brain-ai/brand-brain-ai.repository.js";
import { BrandBrainAiService, type AiConfig } from "../brand-brain-ai/brand-brain-ai.service.js";
import { ensureBrandBrainTables } from "../clients/brand-brain.service.js";
import { RadarSuggestionsRepository } from "../radar-suggestions/radar-suggestions.repository.js";
import { McpRadarRepository } from "./mcp.radar.repository.js";
import { McpRadarService } from "./mcp.radar.service.js";
import { ensureMcpStorage, createMcpClient, saveAuthorizationCode, saveRefreshToken } from "./mcp.repository.js";
import { mcpOAuthRoutes } from "./mcp.oauth.routes.js";
import { pkceChallenge, tokenHash, verifyMcpAccessToken } from "./mcp.security.js";
import { hashPassword } from "../auth/auth.crypto.js";
import type { AuthContext } from "../auth/auth.types.js";
const socketPath = process.env.RADAR_TEST_SOCKET;
if (!socketPath || !/^\/(?:private\/)?tmp\/radar-mariadb-[^/]+\/server\.sock$/.test(socketPath)) throw Error("Use apenas o socket temporário /tmp/radar-mariadb-*/server.sock.");
const schema = readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8").split("-- Additive foundation only.")[0];
const migrations = ["20261007_radar_suggestions_foundation.sql","20261007_brand_brain_ai_runs.sql","20261007_radar_source_runs.sql","20261008_mcp_radar_internal_consent.sql"].map(name=>readFileSync(new URL(`../../../../../database/migrations/${name}`,import.meta.url),"utf8"));
const consentMigration=readFileSync(new URL("../../../../../database/migrations/20261008_mcp_radar_internal_consent.sql",import.meta.url),"utf8");
let server: mysql.Connection;
before(async()=>{server=await mysql.createConnection({socketPath,user:"root",multipleStatements:true});});after(async()=>{await server?.end();});
const config: AiConfig={OPENAI_API_KEY:"mock",BRAND_BRAIN_AI_ENABLED:true,BRAND_BRAIN_AI_MODEL:"gpt-4.1-mini",BRAND_BRAIN_AI_TIMEOUT_MS:1000,BRAND_BRAIN_AI_MAX_OUTPUT_TOKENS:6000};
async function fixture() {
 const database=`mcp_radar_test_${randomUUID().replace(/-/g,"")}`;await server.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
 const pool=mysql.createPool({socketPath,user:"root",database,multipleStatements:true,timezone:"Z",connectionLimit:12});const close=async()=>{await pool.end();await server.query(`DROP DATABASE \`${database}\``);};
 try {
  await pool.query(schema);await ensureBrandBrainTables(pool);await ensureMcpStorage(pool);for(const migration of migrations)await pool.query(migration);
  const clientId=randomUUID(),otherId=randomUUID(),userId=randomUUID();const drawer={brandBrain:{voice:"Publicado",pillars:[{name:"Observação"}]},pautaIdeas:[{id:"legacy",title:"Antiga",status:"approved"}],links:["preservar"],future:{nested:true}};
  await pool.query("INSERT INTO users (id,full_name,email,password_hash,global_role) VALUES (?,'Equipe','test@invalid.test',?,'super_admin')",[userId,await hashPassword("mock-password-long")]);
  await pool.query("INSERT INTO client_accounts (id,name,slug,locale,portal_title,workspace_drawer_json) VALUES (?,'A','a','it-IT','Portal',?),(?,'B','b','sv-SE','Portal',?)",[clientId,JSON.stringify(drawer),otherId,JSON.stringify({...drawer,brandBrain:{voice:"Outro"}})]);
  await pool.query("INSERT INTO brand_brain_versions (id,client_account_id,version_number,data_json,created_by_user_id,author_name) VALUES (?,?,3,?,?, 'Equipe')",[randomUUID(),clientId,JSON.stringify(drawer.brandBrain),userId]);
  const auth:AuthContext={user:{id:userId,fullName:"Equipe",email:"test@invalid.test",globalRole:"super_admin",avatarUrl:null,locale:"pt-BR",isActive:true},memberships:[]};
  const repo=new McpRadarRepository(pool);const suggestions=new RadarSuggestionsRepository(pool);const input={clientId,sourceTitle:"Estudo",sourceSummary:"Descoberta",sourceUrl:"https://example.org/study",sourceDate:"2026-10-07",radarName:"Estudos"};
  let calls=0;let positive=true;const createService=()=>new McpRadarService(new McpRadarRepository(pool),new BrandBrainAiService(new BrandBrainAiRepository(pool,true),config,async request=>{calls++;assert.equal(JSON.parse((request.input[1] as any).content).context.client.locale,"it-IT");await new Promise(resolve=>setTimeout(resolve,20));return {model:request.model,usage:{inputTokens:100,outputTokens:50,totalTokens:150},value:positive?{shouldCreate:true,suggestion:{title:"Observe",concept:"Conceito",hook:"Gancho",description:"Descrição",format:"carousel",pillar:"Observação",objective:"Educar",rationale:"Pilar",cta:"Observe",captionSuggestion:"Legenda",alignmentScore:91,basedOn:["Pilar Observação"]}}:{shouldCreate:false,suggestion:null}};}),config.BRAND_BRAIN_AI_MODEL);
  return {pool,database,clientId,otherId,userId,drawer,auth,repo,suggestions,input,close,createService,calls:()=>calls,negative:()=>{positive=false;},query:async(sql:string,params:unknown[]=[]) => (await pool.query<RowDataPacket[]>(sql,params))[0]};
 }catch(error){await close();throw error;}
}
test("MariaDB: additive repeatable ledger, constraints/defaults/indices; no existing data modified",async()=>{
 const f=await fixture();try{await f.pool.query(migrations[2]);console.log(`Temporary MariaDB: ${(await f.query("SELECT VERSION() AS version"))[0].version}`);const cols=await f.query("SELECT COLUMN_NAME,COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='radar_source_runs'",[f.database]);assert.equal(cols.length,9);assert.equal(cols.find(c=>c.COLUMN_NAME==="created_at")!.COLUMN_TYPE,"timestamp(3)");const idx=await f.query("SHOW INDEX FROM radar_source_runs");assert.ok(idx.some(i=>i.Key_name==="uq_radar_source_client"&&i.Non_unique===0));const fk=await f.query("SELECT DELETE_RULE,UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND TABLE_NAME='radar_source_runs'",[f.database]);assert.equal(fk.length,2);assert.ok(fk.every(k=>k.DELETE_RULE==="RESTRICT"&&k.UPDATE_RULE==="RESTRICT"));await f.repo.claim(f.clientId,"a".repeat(64),"b".repeat(64));await assert.rejects(f.pool.query("UPDATE radar_source_runs SET status='unknown'"));const row=(await f.query("SELECT workspace_drawer_json FROM client_accounts WHERE id=?",[f.clientId]))[0];assert.deepEqual(typeof row.workspace_drawer_json==="string"?JSON.parse(row.workspace_drawer_json):row.workspace_drawer_json,f.drawer);
 }finally{await f.close();}
});
test("MariaDB: multi-instance concurrent same source calls AI once, persists one pending and Dashboard sees it",async()=>{
 const f=await fixture();try{const results=await Promise.all(Array.from({length:12},()=>f.createService().create(f.auth,["pauta:create"],f.input,true)));assert.equal(f.calls(),1);assert.equal(results.filter(r=>r.outcome==="created").length,1);const repeat=await f.createService().create(f.auth,["pauta:create"],{...f.input,sourceUrl:"https://EXAMPLE.org/study?utm_campaign=x#frag"},true);assert.equal(repeat.outcome,"existing");assert.equal(f.calls(),1);const list=await f.suggestions.listPending([f.clientId],{limit:25,offset:0});assert.equal(list.total,1);assert.equal(list.items[0].title,"Observe");const detail=await f.suggestions.pendingDetail(f.clientId,repeat.suggestionId!);assert.equal(detail!.brandBrainVersion,3);assert.equal(detail!.brandBrainContextHash!.length,64);assert.equal(detail!.aiModel,"gpt-4.1-mini");assert.equal(await f.suggestions.pendingDetail(f.otherId,repeat.suggestionId!),null);
 const accepted=await f.suggestions.resolve(f.clientId,repeat.suggestionId!,f.userId,"accept");assert.equal(accepted.pauta!.status,"draft");assert.equal(f.calls(),1);assert.equal((await f.suggestions.listPending([f.clientId],{limit:25,offset:0})).total,0);assert.equal((await f.query("SELECT COUNT(*) AS total FROM kanban_cards"))[0].total,0);const [run]=await f.query("SELECT * FROM brand_brain_ai_runs");assert.equal(run.operation,"radar");assert.equal(run.total_tokens,150);assert.equal(run.context_hash,(await f.query("SELECT context_hash FROM radar_source_runs"))[0].context_hash);assert.doesNotMatch(JSON.stringify(run),/Descoberta|Publicado|mock/);
 }finally{await f.close();}
});
test("MariaDB: negative source persists after new service/context change; no suggestion or repeated AI",async()=>{
 const f=await fixture();try{f.negative();assert.equal((await f.createService().create(f.auth,["pauta:create"],f.input,true)).outcome,"no_op");await f.pool.query("UPDATE client_accounts SET workspace_drawer_json=JSON_SET(workspace_drawer_json,'$.brandBrain.voice','Alterado') WHERE id=?",[f.clientId]);assert.equal((await f.createService().create(f.auth,["pauta:create"],f.input,true)).outcome,"no_op");assert.equal(f.calls(),1);assert.equal((await f.query("SELECT COUNT(*) AS total FROM radar_suggestions"))[0].total,0);assert.equal((await f.query("SELECT status FROM radar_source_runs"))[0].status,"no_op");
 }finally{await f.close();}
});
test("MariaDB: failed suggestion transaction rolls back, retry never pays again; dismiss is AI-free",async()=>{
 const f=await fixture();try{await f.pool.query("CREATE TRIGGER fail_source_finish BEFORE UPDATE ON radar_source_runs FOR EACH ROW BEGIN IF NEW.status='completed' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture failure'; END IF; END");await assert.rejects(f.createService().create(f.auth,["pauta:create"],f.input,true));assert.equal(f.calls(),1);assert.equal((await f.query("SELECT COUNT(*) AS total FROM radar_suggestions"))[0].total,0);await f.pool.query("DROP TRIGGER fail_source_finish");await assert.rejects(f.createService().create(f.auth,["pauta:create"],f.input,true),/tentativa|processada/).catch(error=>{throw error;});assert.equal(f.calls(),1);
 const second=await f.createService().create(f.auth,["pauta:create"],{...f.input,sourceUrl:"https://example.org/second"},true);await f.suggestions.resolve(f.clientId,second.suggestionId!,f.userId,"dismiss");assert.equal(f.calls(),2);assert.equal((await f.suggestions.listPending([f.clientId],{limit:25,offset:0})).total,0);
 }finally{await f.close();}
});
test("MariaDB OAuth: explicit new consent, new defaults, downscope, denied upgrade without consuming refresh",async()=>{
 const f=await fixture();const app=Fastify();try{app.decorate("db",f.pool);app.decorate("appEnv",{API_URL:"https://app.example.com",NODE_ENV:"test",JWT_SECRET:"a-long-mock-test-secret-with-no-production-use"} as never);await app.register(mcpOAuthRoutes);const client=await createMcpClient(f.pool,{name:"Test",redirectUris:["https://example.org/callback"]});const verifier="v".repeat(50);const body={client_id:client.clientId,redirect_uri:"https://example.org/callback",response_type:"code",code_challenge_method:"S256",code_challenge:pkceChallenge(verifier),scope:"planning:read pauta:create",email:"test@invalid.test",password:"mock-password-long"};
 const legacy=await app.inject(`/oauth/authorize?${new URLSearchParams({...body,scope:"planning:read pauta:create"})}`);assert.match(legacy.body,/name="radar_consent"/);const noScope={...body} as Record<string,string>;delete noScope.scope;const defaultPage=await app.inject(`/oauth/authorize?${new URLSearchParams(noScope)}`);assert.match(defaultPage.body,/name="radar_consent" value="yes"/);assert.doesNotMatch(defaultPage.body,/radar_consent[^>]*checked/);const page=await app.inject(`/oauth/authorize?${new URLSearchParams(body)}`);assert.match(page.body,/name="radar_consent" value="yes"/);assert.doesNotMatch(page.body,/radar_consent[^>]*checked/);assert.equal((await app.inject({method:"POST",url:"/oauth/authorize",payload:body})).statusCode,302);
 const authorization=await app.inject({method:"POST",url:"/oauth/authorize",payload:{...body,radar_consent:"yes"}});assert.equal(authorization.statusCode,302);const code=new URL(authorization.headers.location!).searchParams.get("code")!;const token=await app.inject({method:"POST",url:"/oauth/token",payload:{grant_type:"authorization_code",client_id:client.clientId,redirect_uri:body.redirect_uri,code,code_verifier:verifier}});assert.equal(token.statusCode,200);assert.equal(token.json().scope,body.scope);assert.equal(verifyMcpAccessToken(app,token.json().access_token).scope,body.scope);assert.equal(verifyMcpAccessToken(app,token.json().access_token).radar_ai_authorized,true);
 const down=await app.inject({method:"POST",url:"/oauth/token",payload:{grant_type:"refresh_token",client_id:client.clientId,refresh_token:token.json().refresh_token,scope:"planning:read"}});assert.equal(down.statusCode,200);assert.equal(down.json().scope,"planning:read");const denied=await app.inject({method:"POST",url:"/oauth/token",payload:{grant_type:"refresh_token",client_id:client.clientId,refresh_token:down.json().refresh_token,scope:"planning:read radar:suggest"}});assert.equal(denied.statusCode,400);assert.equal(denied.json().error,"invalid_scope");const next=await app.inject({method:"POST",url:"/oauth/token",payload:{grant_type:"refresh_token",client_id:client.clientId,refresh_token:down.json().refresh_token}});assert.equal(next.statusCode,200);assert.equal(next.json().scope,"planning:read");
 }finally{await app.close();await f.close();}
});

test("MariaDB consent migration: old rows denied; repeat application preserves grants",async()=>{
 const f=await fixture();const app=Fastify();
 try {
  // Reconstruct the pre-migration schema only inside this disposable test database.
  await f.pool.query("ALTER TABLE mcp_oauth_codes DROP COLUMN radar_ai_authorized");
  await f.pool.query("ALTER TABLE mcp_oauth_refresh_tokens DROP COLUMN radar_ai_authorized");
  const client=await createMcpClient(f.pool,{name:"Legacy",redirectUris:["https://example.org/callback"]});
  const scope="planning:read pauta:create radar:suggest",resource="https://app.example.com/mcp";
  const verifier="v".repeat(50),code="legacy-code",refresh="legacy-refresh";
  await f.pool.query("INSERT INTO mcp_oauth_codes (code_hash,client_id,user_id,redirect_uri,code_challenge,scope,resource,expires_at_ms) VALUES (?,?,?,?,?,?,?,?)",
   [tokenHash(code),client.clientId,f.userId,"https://example.org/callback",pkceChallenge(verifier),scope,resource,Date.now()+60_000]);
  await f.pool.query("INSERT INTO mcp_oauth_refresh_tokens (token_hash,client_id,user_id,scope,resource,expires_at_ms) VALUES (?,?,?,?,?,?)",
   [tokenHash(refresh),client.clientId,f.userId,scope,resource,Date.now()+60_000]);
  const oldCode=(await f.query("SELECT * FROM mcp_oauth_codes"))[0];
  const oldRefresh=(await f.query("SELECT * FROM mcp_oauth_refresh_tokens"))[0];
  await f.pool.query(consentMigration);
  for(const table of ["mcp_oauth_codes","mcp_oauth_refresh_tokens"]) {
   const [column]=await f.query("SELECT COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME='radar_ai_authorized'",[f.database,table]);
   assert.equal(column.COLUMN_TYPE,"tinyint(1)");assert.equal(column.IS_NULLABLE,"NO");assert.equal(String(column.COLUMN_DEFAULT),"0");
   const [row]=await f.query("SELECT * FROM "+table);
   const {radar_ai_authorized,...unchanged}=row;
   assert.equal(radar_ai_authorized,0);assert.deepEqual(unchanged,table==="mcp_oauth_codes"?oldCode:oldRefresh);
   await assert.rejects(f.pool.query("UPDATE "+table+" SET radar_ai_authorized=NULL"));
  }
  await saveAuthorizationCode(f.pool,{code:"new-consented-code",clientId:client.clientId,userId:f.userId,redirectUri:"https://example.org/callback",codeChallenge:pkceChallenge(verifier),scope,resource,radarAiAuthorized:true});
  await saveRefreshToken(f.pool,{token:"new-consented-refresh",clientId:client.clientId,userId:f.userId,scope,resource,expiresAtMs:Date.now()+60_000,radarAiAuthorized:true});
  await f.pool.query(consentMigration);
  assert.equal((await f.query("SELECT radar_ai_authorized FROM mcp_oauth_codes WHERE code_hash=?",[tokenHash("new-consented-code")]))[0].radar_ai_authorized,1);
  assert.equal((await f.query("SELECT radar_ai_authorized FROM mcp_oauth_refresh_tokens WHERE token_hash=?",[tokenHash("new-consented-refresh")]))[0].radar_ai_authorized,1);
  app.decorate("db",f.pool);app.decorate("appEnv",{API_URL:"https://app.example.com",NODE_ENV:"test",JWT_SECRET:"isolated-test-secret-only"} as never);
  await app.register(mcpOAuthRoutes);
  const fromCode=await app.inject({method:"POST",url:"/oauth/token",payload:{grant_type:"authorization_code",client_id:client.clientId,redirect_uri:"https://example.org/callback",code,code_verifier:verifier}});
  assert.equal(fromCode.statusCode,200);assert.equal(verifyMcpAccessToken(app,fromCode.json().access_token).radar_ai_authorized,false);
  const fromRefresh=await app.inject({method:"POST",url:"/oauth/token",payload:{grant_type:"refresh_token",client_id:client.clientId,refresh_token:refresh}});
  assert.equal(fromRefresh.statusCode,200);assert.equal(verifyMcpAccessToken(app,fromRefresh.json().access_token).radar_ai_authorized,false);
  assert.equal(fromRefresh.json().scope,scope);
 }finally{await app.close();await f.close();}
});

test("MariaDB OAuth → code → token → tools/list → pending Radar: persisted consent, refresh, revocation",async()=>{
 const f=await fixture();const app=Fastify();
 try {
  app.decorate("db",f.pool);app.decorate("appEnv",{...config,API_URL:"https://app.example.com",NODE_ENV:"test",JWT_SECRET:"isolated-test-secret-only"} as never);
  await app.register(mcpOAuthRoutes);
  const oauth=await createMcpClient(f.pool,{name:"ChatGPT-compatible",redirectUris:["https://example.org/callback"]});
  const verifier="v".repeat(50),scope="planning:read pauta:create";
  const authorization={client_id:oauth.clientId,redirect_uri:"https://example.org/callback",response_type:"code",code_challenge_method:"S256",code_challenge:pkceChallenge(verifier),scope};
  const page=await app.inject("/oauth/authorize?"+new URLSearchParams(authorization));
  assert.equal(page.statusCode,200);assert.match(page.body,/name="radar_consent" value="yes"/);
  assert.doesNotMatch(page.body,/radar_consent[^>]*(checked|required)/);
  for(const consent of [false,true]) {
   const authorized=await app.inject({method:"POST",url:"/oauth/authorize",payload:{...authorization,email:"test@invalid.test",password:"mock-password-long",...(consent?{radar_consent:"yes"}:{})}});
   assert.equal(authorized.statusCode,302);
   const code=new URL(authorized.headers.location!).searchParams.get("code")!;
   const [storedCode]=await f.query("SELECT scope,radar_ai_authorized FROM mcp_oauth_codes WHERE code_hash=?",[tokenHash(code)]);
   assert.equal(storedCode.scope,scope);assert.equal(storedCode.radar_ai_authorized,Number(consent));
   const exchanged=await app.inject({method:"POST",url:"/oauth/token",payload:{grant_type:"authorization_code",client_id:oauth.clientId,redirect_uri:authorization.redirect_uri,code,code_verifier:verifier}});
   assert.equal(exchanged.statusCode,200);
   const token=exchanged.json(),claims=verifyMcpAccessToken(app,token.access_token);
   assert.equal(token.scope,scope);assert.equal(claims.scope,scope);assert.equal(claims.radar_ai_authorized,consent);
   const [storedRefresh]=await f.query("SELECT scope,radar_ai_authorized FROM mcp_oauth_refresh_tokens WHERE token_hash=?",[tokenHash(token.refresh_token)]);
   assert.equal(storedRefresh.scope,scope);assert.equal(storedRefresh.radar_ai_authorized,Number(consent));
   const mcp=createPlanningMcpServer(app,f.auth,claims.client_id,claims.scope.split(/\s+/),{radar:f.createService(),radarAiAuthorized:claims.radar_ai_authorized===true});
   const client=new Client({name:"consent-review-test",version:"1"});const [ct,st]=InMemoryTransport.createLinkedPair();
   try {
    await mcp.connect(st);await client.connect(ct);
    const tools=(await client.listTools()).tools.map(t=>t.name);
    assert.equal(tools.includes("create_radar_suggestion"),consent);assert.ok(tools.includes("create_pauta_draft"));
    assert.ok(!(await client.callTool({name:"list_clients",arguments:{}})).isError);
    const called=await client.callTool({name:"create_radar_suggestion",arguments:f.input});
    if(consent) {
     assert.ok(!called.isError);const result=JSON.parse((called.content as {text:string}[])[0].text);
     assert.equal(result.status,"pending");assert.equal(result.outcome,"created");assert.equal(f.calls(),1);
    } else {assert.equal(called.isError,true);assert.equal(f.calls(),0);}
   }finally{await client.close();await mcp.close();}
   const refreshed=await app.inject({method:"POST",url:"/oauth/token",payload:{grant_type:"refresh_token",client_id:oauth.clientId,refresh_token:token.refresh_token,radar_consent:consent?"no":"yes",radar_ai_authorized:!consent}});
   assert.equal(refreshed.statusCode,200);
   const next=refreshed.json();assert.equal(next.scope,scope);assert.equal(verifyMcpAccessToken(app,next.access_token).radar_ai_authorized,consent);
   const [rotated]=await f.query("SELECT radar_ai_authorized FROM mcp_oauth_refresh_tokens WHERE token_hash=?",[tokenHash(next.refresh_token)]);
   assert.equal(rotated.radar_ai_authorized,Number(consent));
   const reused=await app.inject({method:"POST",url:"/oauth/token",payload:{grant_type:"refresh_token",client_id:oauth.clientId,refresh_token:token.refresh_token}});
   assert.equal(reused.statusCode,400);assert.equal(reused.json().error,"invalid_grant");
   const wrongClient=await app.inject({method:"POST",url:"/oauth/revoke",payload:{client_id:"other-client",token:next.refresh_token}});
   assert.equal(wrongClient.statusCode,200);
   assert.equal((await f.query("SELECT revoked_at_ms FROM mcp_oauth_refresh_tokens WHERE token_hash=?",[tokenHash(next.refresh_token)]))[0].revoked_at_ms,null);
   const revoked=await app.inject({method:"POST",url:"/oauth/revoke",payload:{client_id:oauth.clientId,token:next.refresh_token}});
   assert.equal(revoked.statusCode,200);
   const denied=await app.inject({method:"POST",url:"/oauth/token",payload:{grant_type:"refresh_token",client_id:oauth.clientId,refresh_token:next.refresh_token}});
   assert.equal(denied.statusCode,400);assert.equal(denied.json().error,"invalid_grant");
   // Revocation preserves existing behavior: stateless access tokens expire at their original TTL.
   assert.equal(verifyMcpAccessToken(app,next.access_token).radar_ai_authorized,consent);
  }
  assert.equal((await f.query("SELECT COUNT(*) AS total FROM radar_suggestions"))[0].total,1);
  assert.equal((await f.query("SELECT COUNT(*) AS total FROM kanban_cards"))[0].total,0);
  const [row]=await f.query("SELECT workspace_drawer_json FROM client_accounts WHERE id=?",[f.clientId]);
  assert.deepEqual(typeof row.workspace_drawer_json==="string"?JSON.parse(row.workspace_drawer_json):row.workspace_drawer_json,f.drawer);
 }finally{await app.close();await f.close();}
});

test("MariaDB: MCP tool → Dashboard API → read detail/accept/dismiss uses one AI call per source",async()=>{
 const f=await fixture();const app=Fastify();const client=new Client({name:"checkpoint4-test",version:"1"});let mcp:ReturnType<typeof createPlanningMcpServer>|undefined;
 try {
  app.decorate("db",f.pool);app.decorate("appEnv",config as never);app.decorateRequest("auth",null);await app.register(httpErrorsPluginRegistered);app.addHook("preHandler",async request=>{request.auth=f.auth;});await app.register(radarSuggestionsRoutes,{prefix:"/api"});
  mcp=createPlanningMcpServer(app,f.auth,"test-oauth",["planning:read","pauta:create"],{radar:f.createService(),radarAiAuthorized:true});const [ct,st]=InMemoryTransport.createLinkedPair();await mcp.connect(st);await client.connect(ct);
  const created=await client.callTool({name:"create_radar_suggestion",arguments:f.input});assert.ok(!created.isError);const payload=JSON.parse((created.content as {text:string}[])[0].text);assert.equal(payload.status,"pending");assert.equal(f.calls(),1);
  const pending=await app.inject("/api/radar-suggestions");assert.equal(pending.statusCode,200);assert.equal(pending.json().total,1);assert.equal(pending.json().items[0].id,payload.suggestionId);
  const url=`/api/clients/${f.clientId}/radar-suggestions/${payload.suggestionId}`;assert.equal((await app.inject(url)).statusCode,200);const accepted=await app.inject({method:"POST",url:`${url}/accept`});assert.equal(accepted.statusCode,200);assert.equal(accepted.json().pauta.status,"draft");assert.equal(f.calls(),1);
  const second=await client.callTool({name:"create_radar_suggestion",arguments:{...f.input,sourceUrl:"https://example.org/second"}});const id=JSON.parse((second.content as {text:string}[])[0].text).suggestionId;assert.equal(f.calls(),2);assert.equal((await app.inject({method:"POST",url:`/api/clients/${f.clientId}/radar-suggestions/${id}/dismiss`})).statusCode,200);assert.equal(f.calls(),2);assert.equal((await app.inject("/api/radar-suggestions")).json().total,0);
  const audit=await f.query("SELECT arguments_json FROM mcp_audit_log WHERE tool_name='create_radar_suggestion'");assert.equal(audit.length,2);assert.doesNotMatch(JSON.stringify(audit),/Descoberta|Publicado|Legenda|mock/);assert.equal((await f.query("SELECT COUNT(*) AS total FROM kanban_cards"))[0].total,0);
 }finally{await client.close();await mcp?.close();await app.close();await f.close();}
});
