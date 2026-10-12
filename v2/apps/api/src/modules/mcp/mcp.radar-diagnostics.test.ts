import assert from "node:assert/strict";
import test from "node:test";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js";
import type {FastifyInstance} from "fastify";
import type {AuthContext} from "../auth/auth.types.js";
import {createPlanningMcpServer} from "./mcp.server.js";
const minas="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
const auth:AuthContext={user:{id:other,fullName:"Synthetic",email:"test@invalid.test",globalRole:"super_admin",avatarUrl:null,locale:"pt",isActive:true},memberships:[]};
async function connected(scopes:string[],consent:boolean,enabled=true,allowed=true,key=true,storage=true,failStorage=false) {
 const audits:any[]=[];const brain={pillars:Array.from({length:6},(_,i)=>({name:`Synthetic pillar ${i} `+"x".repeat(130)})),avoidWords:Array.from({length:68},(_,i)=>`PRIVATE_RULE_${i}`)};
 const app={db:{query:async(sql:string)=>{if(failStorage)throw Error("PRIVATE_DATABASE_USER PRIVATE_DATABASE_NAME");return sql.includes("information_schema") ? [["radar_source_runs","radar_suggestions","brand_brain_versions",...(storage?["brand_brain_ai_runs"]:[])].map(TABLE_NAME=>({TABLE_NAME}))] : [allowed?[{id:minas,name:"Minas Home synthetic",slug:"synthetic",locale:"pt",workspace_drawer_json:JSON.stringify({brandBrain:brain})}]:[]];}},appEnv:{BRAND_BRAIN_AI_ENABLED:enabled,OPENAI_API_KEY:key?"PRIVATE_API_KEY":undefined}} as unknown as FastifyInstance;
 const server=createPlanningMcpServer(app,auth,"synthetic-oauth",scopes,{radarAiAuthorized:consent,audit:async(_db,input)=>{audits.push(input);}});
 const client=new Client({name:"Synthetic Radar",version:"1"}),[ct,st]=InMemoryTransport.createLinkedPair();await server.connect(st);await client.connect(ct);
 return {client,audits,close:async()=>{await client.close();await server.close();}};
}
test("Minas Home diagnostics separates scope, consent, tool registration and configured AI availability",async()=>{
 for(const [scopes,consent,enabled,key,expected] of [
 [["planning:read"],false,true,true,false],
 [["planning:read","radar:suggest"],true,true,true,false],
 [["planning:read","pauta:create"],false,true,true,false],
 [["planning:read","pauta:create"],true,false,true,false],
 [["planning:read","pauta:create"],true,true,false,false],
 [["planning:read","pauta:create"],true,true,true,true],
 ] as [string[],boolean,boolean,boolean,boolean][]){const c=await connected(scopes,consent,enabled,true,key);
 try{const tools=await c.client.listTools();assert.ok(tools.tools.some(t=>t.name==="get_radar_connection_status"));assert.equal(tools.tools.some(t=>t.name==="create_radar_suggestion"),scopes.includes("pauta:create")&&consent);
 const response=await c.client.callTool({name:"get_radar_connection_status",arguments:{clientId:minas}});const value=JSON.parse((response.content as any)[0].text);
 assert.equal(value.canSubmit,expected);assert.equal(value.radarAiConsent,consent);assert.equal(value.pautaCreateGranted,scopes.includes("pauta:create"));assert.equal(value.providerTested,false);assert.equal(value.sourceSubmitted,false);assert.equal(value.publishedPillarCount,6);assert.equal(value.longPillarCount,6);assert.equal(value.editorialRuleCount,68);
 assert.doesNotMatch(JSON.stringify(response)+JSON.stringify(c.audits),/PRIVATE_RULE|PRIVATE_API_KEY|xxxxxxxx/);
 assert.ok(!tools.tools.some(t=>/recover/.test(t.name)));
 }finally{await c.close();}}
});
test("unknown/unavailable client does not become an AI failure or leak another brand",async()=>{
 const c=await connected(["planning:read","pauta:create"],true,true,false);try{const response=await c.client.callTool({name:"get_radar_connection_status",arguments:{clientId:minas}});assert.equal(response.isError,true);assert.doesNotMatch(JSON.stringify(response),/PRIVATE_RULE|PRIVATE_API_KEY/);}finally{await c.close();}
});

test("Radar can validate an original source without invoking AI or creating any source/suggestion",async()=>{
 const c=await connected(["planning:read","pauta:create"],true);
 try{
 const response=await c.client.callTool({name:"validate_radar_source",arguments:{clientId:minas,source:{sourceTitle:"PRIVATE_SOURCE_TITLE",sourceSummary:"PRIVATE_SUMMARY",sourceUrl:"https://example.invalid/private-news"}}});
 const data=JSON.parse((response.content as any)[0].text);assert.equal(data.mode,"validation_only");assert.equal(data.sourceValid,true);assert.equal(data.sourceSubmitted,false);assert.equal(data.providerTested,false);assert.match(data.sourceHash,/^[a-f0-9]{64}$/);
 assert.doesNotMatch(JSON.stringify(response)+JSON.stringify(c.audits),/PRIVATE_SUMMARY|PRIVATE_SOURCE_TITLE|private-news|PRIVATE_API_KEY/);
 assert.equal(c.audits[0].toolName,"validate_radar_source");
 const bad=await c.client.callTool({name:"validate_radar_source",arguments:{clientId:minas,source:{sourceTitle:"PRIVATE_SOURCE_TITLE",sourceSummary:null}}});assert.equal(bad.isError,true);assert.equal(c.audits[1].args.errorCode,"invalid_input");assert.doesNotMatch(JSON.stringify(c.audits),/PRIVATE_SOURCE_TITLE/);
 }finally{await c.close();}
});
test("preflight audit sanitizer rejects payloads, private errors and unknown outcomes",async()=>{
 const {sanitizeRadarValidationAudit,recordMcpAudit}=await import("./mcp.repository.js");
 const args={clientId:minas,sourceHash:"a".repeat(64),result:"validated",sourceSummary:"PRIVATE",errorCode:"PRIVATE_ERROR",source:{title:"PRIVATE"}};
 const sanitized=sanitizeRadarValidationAudit(args);assert.equal(sanitized.errorCode,null);assert.equal(sanitized.result,"validated");assert.doesNotMatch(JSON.stringify(sanitized),/PRIVATE/);
 let params:unknown[]=[];await recordMcpAudit({query:async(_sql:unknown,p:unknown[])=>{params=p;}} as never,{userId:other,clientId:"synthetic-oauth",toolName:"validate_radar_source",success:true,args});assert.doesNotMatch(JSON.stringify(params),/PRIVATE/);
});


test("missing storage is identified before execution, without assuming a model failure",async()=>{
 const c=await connected(["planning:read","pauta:create"],true,true,true,true,false);
 try{const r=await c.client.callTool({name:"get_radar_connection_status",arguments:{clientId:minas}});const data=JSON.parse((r.content as any)[0].text);
 assert.equal(data.aiEnabled,true);assert.equal(data.creationToolAvailable,true);assert.equal(data.canSubmit,false);assert.deepEqual(data.missingStorage,["brand_brain_ai_runs"]);assert.equal(data.databaseWritesTested,false);
 }finally{await c.close();}
});


test("diagnostic storage errors never expose raw database identities or provider secrets",async()=>{
 const c=await connected(["planning:read","pauta:create"],true,true,true,true,true,true);
 try{const r=await c.client.callTool({name:"get_radar_connection_status",arguments:{clientId:minas}});assert.equal(r.isError,true);assert.doesNotMatch(JSON.stringify(r)+JSON.stringify(c.audits),/PRIVATE_DATABASE|PRIVATE_API_KEY/);}finally{await c.close();}
});
