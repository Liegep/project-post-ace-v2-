import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import Fastify from "fastify";
import {httpErrorsPluginRegistered} from "../../plugins/http-errors.js";
import {BrandBrainAiService,type AiConfig} from "../brand-brain-ai/brand-brain-ai.service.js";
import {AiProviderError} from "../../lib/openai-responses.js";
import type {BrandBrainAiStore} from "../brand-brain-ai/brand-brain-ai.repository.js";
import type {AuthContext} from "../auth/auth.types.js";
import {radarSourceKey} from "../radar-suggestions/radar-suggestions.service.js";
import {radarRecoveryRoutes} from "./radar-recovery.routes.js";
import {RadarRecoveryService} from "./radar-recovery.service.js";
import {assertRecoveryPolicy,RECOVERY_COOLDOWN_MS,recoveryError,type RecoveryAttempt} from "./radar-recovery.policy.js";
import type {RadarRecoveryStore} from "./radar-recovery.repository.js";
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222",runId="33333333-3333-4333-8333-333333333333";
const config:AiConfig={OPENAI_API_KEY:"mock",BRAND_BRAIN_AI_ENABLED:true,BRAND_BRAIN_AI_MODEL:"mock-model",BRAND_BRAIN_AI_TIMEOUT_MS:1000,BRAND_BRAIN_AI_MAX_OUTPUT_TOKENS:6000};
const auth:AuthContext={user:{id:a,fullName:"Synthetic",email:"synthetic@invalid.test",globalRole:"super_admin",avatarUrl:null,locale:"pt",isActive:true},memberships:[]};
const source={sourceTitle:"Synthetic source",sourceSummary:"Synthetic educational evidence",sourceUrl:"https://example.invalid/source",sourceDate:"2026-10-07",radarName:"Synthetic Radar"};
const params={clientId:a,runId};
const body=(expectedAttempts=0)=>({requestId:randomUUID(),expectedAttempts,aiConsent:true,sourceReviewed:true,source:{...source}});
const suggestion=()=>({title:"Synthetic idea",concept:"Concept",hook:"Hook",description:"Description",format:"carousel",pillar:"Canonical",objective:"Education",rationale:"Published pillar",cta:null,captionSuggestion:null,alignmentScore:90,basedOn:["Canonical pillar"]});
function fixture(enabled=true) {
 let now=1000000000000,gate:Promise<void>|null=null,value:unknown={shouldCreate:true,suggestion:suggestion()},failure:Error|null=null;
 const root={id:runId,clientId:a,status:"failed",errorCode:"invalid_response",sourceHash:radarSourceKey(source),createdAtMs:1};
 const original=JSON.stringify(root),attempts:RecoveryAttempt[]=[],suggestions:any[]=[],metrics:any[]=[],requests:any[]=[];
 const aiStore:BrandBrainAiStore={officialClient:async id=>({id,name:"Synthetic",locale:"pt",brain:{pillars:[{name:"Canonical"}],avoidWords:["private_forbidden"]},recentPautas:[]}),
 beginRun:async(clientId,operation,model,hash)=>{const id=randomUUID();metrics.push({id,clientId,operation,model,hash});return id;},endRun:async(id,end)=>{metrics.find(m=>m.id===id).end=end;}};
 const ai=new BrandBrainAiService(aiStore,config,async r=>{requests.push(r);if(gate)await gate;if(failure)throw failure;return {value,model:"mock-snapshot",usage:{inputTokens:null,outputTokens:null,totalTokens:null}};});
 const store:RadarRecoveryStore={list:async clientId=>clientId===a?[{runId,sourceHash:root.sourceHash,createdAtMs:root.createdAtMs,originalStatus:root.status,originalErrorCode:root.errorCode,attempts:[...attempts]}]:[],
 claim:async input=>{
  if(input.clientId!==root.clientId || input.runId!==runId)throw recoveryError("source_not_found",404);
  if(input.sourceHash!==root.sourceHash)throw recoveryError("source_mismatch",400);
  const replay=attempts.find(x=>x.requestId===input.requestId);if(replay){if(replay.inputHash!==input.inputHash)throw recoveryError("recovery_request_conflict");return {owned:false,attempt:replay};}
  if(root.status!=="failed")throw recoveryError("source_not_failed");
  const existing=suggestions.find(s=>s.clientId===input.clientId);if(existing)return {owned:false,existing:{id:existing.id,status:existing.status}};
  assertRecoveryPolicy({originalStatus:root.status,originalError:root.errorCode,attempts,expectedAttempts:input.expectedAttempts,nowMs:now,clientActive:attempts.some(x=>x.status==="processing"),clientDaily:attempts.filter(x=>x.createdAtMs>=now-86400000).length});
  const attempt:RecoveryAttempt={id:randomUUID(),sourceRunId:runId,clientId:a,requestId:input.requestId,inputHash:input.inputHash,number:attempts.length+1,status:"processing",createdSuggestion:false,errorCode:null,suggestionId:null,aiRunId:null,createdAtMs:now,finishedAtMs:null};attempts.push(attempt);return {owned:true,attempt};
 },result:async(clientId,id)=>{const attempt=attempts.find(x=>x.id===id && x.clientId===clientId);if(!attempt)throw recoveryError("source_not_found",404);return attempt;},
 linkAi:async(clientId,id,aiRunId)=>{const x=await store.result(clientId,id);if(x.status!=="processing")throw recoveryError("recovery_processing");x.aiRunId=aiRunId;},
 finish:async(clientId,id,_actor,sourceHash,input)=>{const x=await store.result(clientId,id);if(x.status!=="processing")throw recoveryError("recovery_processing");assert.equal(sourceHash,root.sourceHash);
  const existing=suggestions.find(s=>s.clientId===clientId);
  if(existing)x.suggestionId=existing.id;
  else if(input){assert.equal(radarSourceKey(input),root.sourceHash);const s={...input,id:randomUUID(),clientId,status:"pending"};suggestions.push(s);x.suggestionId=s.id;x.createdSuggestion=true;}
  x.status=x.suggestionId?"completed":"no_op";x.finishedAtMs=now;return x;
 },fail:async(clientId,id,code)=>{const x=await store.result(clientId,id);if(x.status==="processing"){x.status="failed";x.errorCode=code;x.finishedAtMs=now;}return x;}};
 return {service:new RadarRecoveryService(store,ai,config.BRAND_BRAIN_AI_MODEL,enabled),store,ai,root,attempts,suggestions,requests,metrics,original,advance:()=>{now+=RECOVERY_COOLDOWN_MS;},value:(v:unknown)=>{value=v;},failure:(e:Error|null)=>{failure=e;},gate:(p:Promise<void>)=>{gate=p;}};
}
test("manual recovery preserves the original failure, links AI and creates pending only",async()=>{
 const f=fixture(),request=body();const result=await f.service.recover(auth,params,request);
 assert.equal(result.outcome,"created");assert.equal(f.suggestions.length,1);assert.equal(f.suggestions[0].status,"pending");assert.equal(f.attempts[0].aiRunId,f.metrics[0].id);assert.equal(JSON.stringify(f.root),f.original);
 const again=await f.service.recover(auth,params,request);assert.equal(again.attemptId,result.attemptId);assert.equal(f.requests.length,1);assert.equal(f.attempts.length,1);
 assert.equal(f.suggestions[0].sourceSummary,source.sourceSummary);assert.doesNotMatch(JSON.stringify(f.attempts)+JSON.stringify(f.metrics),/Synthetic educational|private_forbidden|Concept|mock-snapshot.*Synthetic/);
});
test("concurrent fresh and repeated requests have one owner and no simultaneous provider calls",async()=>{
 const f=fixture();let release!:()=>void;f.gate(new Promise(r=>{release=r;}));const request=body(),first=f.service.recover(auth,params,request);
 while(!f.requests.length)await new Promise(r=>setTimeout(r,1));
 const results=await Promise.all(Array.from({length:10},()=>f.service.recover(auth,params,request)));assert.ok(results.every(x=>x.outcome==="processing"));
 await assert.rejects(f.service.recover(auth,params,body()),{code:"recovery_processing"});assert.equal(f.requests.length,1);release();await first;assert.equal(f.suggestions.length,1);
});
test("failed manual attempts require new review, cooldown, fresh request ID and stop after two",async()=>{
 const f=fixture(),request=body();f.failure(new AiProviderError("timeout"));assert.equal((await f.service.recover(auth,params,request)).outcome,"failed");
 assert.equal((await f.service.recover(auth,params,request)).outcome,"failed");assert.equal(f.requests.length,1);
 await assert.rejects(f.service.recover(auth,params,body()),{code:"recovery_stale_review"});
 await assert.rejects(f.service.recover(auth,params,body(1)),{code:"recovery_cooldown"});
 f.advance();assert.equal((await f.service.recover(auth,params,body(1))).outcome,"failed");f.advance();
 await assert.rejects(f.service.recover(auth,params,body(2)),{code:"recovery_limit"});assert.equal(f.requests.length,2);assert.equal(f.attempts.length,2);assert.equal(JSON.stringify(f.root),f.original);
});
test("no-op remains terminal; completed, processing and already-existing suggestions never pay again",async()=>{
 const f=fixture();f.value({shouldCreate:false,suggestion:null});const request=body();assert.equal((await f.service.recover(auth,params,request)).outcome,"no_op");
 await assert.rejects(f.service.recover(auth,params,body(1)),{code:"recovery_resolved"});assert.equal(f.requests.length,1);assert.equal(f.suggestions.length,0);
 for(const status of ["completed","processing","no_op"]){const g=fixture();g.root.status=status;await assert.rejects(g.service.recover(auth,params,body()),{code:"source_not_failed"});assert.equal(g.requests.length,0);}
 for(const status of ["pending","accepted","dismissed"]){const g=fixture();g.suggestions.push({id:a,clientId:a,status});assert.equal((await g.service.recover(auth,params,body())).outcome,"existing");assert.equal(g.requests.length,0);assert.equal(g.attempts.length,0);}
});
test("source identity, request payload binding, client isolation and raw retry flags cannot be bypassed",async()=>{
 const f=fixture();await assert.rejects(f.service.recover(auth,{clientId:b,runId},body()),{code:"source_not_found"});
 await assert.rejects(f.service.recover(auth,params,{...body(),source:{...source,sourceUrl:"https://example.invalid/other"}}),{code:"source_mismatch"});
 const request=body();f.failure(new AiProviderError("timeout"));await f.service.recover(auth,params,request);
 await assert.rejects(f.service.recover(auth,params,{...request,source:{...source,sourceSummary:"Changed summary"}}),{code:"recovery_request_conflict"});
 await assert.rejects(f.service.recover(auth,params,{...body(1),force:true}),{code:"invalid_input"});assert.equal(f.requests.length,1);
});
test("disabled feature, explicit consent, source review and administration are enforced before writes/AI",async()=>{
 const f=fixture(false);await assert.rejects(f.service.recover(auth,params,body()),{code:"recovery_disabled"});assert.equal(f.attempts.length,0);
 const g=fixture();for(const change of [{aiConsent:false},{sourceReviewed:false},{source:undefined}])await assert.rejects(g.service.recover(auth,params,{...body(),...change}),{code:"invalid_input"});
 for(const role of ["cliente","colaborador","admin"] as const)await assert.rejects(g.service.recover({...auth,user:{...auth.user,globalRole:role}},params,body()),{code:"recovery_forbidden"});
 await assert.rejects(g.service.recover(null,params,body()),{code:"unauthorized"});await assert.rejects(g.service.recover({...auth,user:{...auth.user,isActive:false}},params,body()),{code:"recovery_forbidden"});assert.equal(g.attempts.length,0);assert.equal(g.requests.length,0);
 const scoped={...auth,user:{...auth.user,globalRole:"admin" as const},memberships:[{clientAccountId:a,membershipRole:"admin",portalAccessLevel:"admin",isPrimary:true,clientName:"A",clientSlug:"a",ownerUserId:a}] } satisfies AuthContext;
 assert.equal((await g.service.recover(scoped,params,body())).outcome,"created");
});
test("new validation failures use current Brand Brain and retain safe history without suggestions",async()=>{
 for(const [value,code] of [[{shouldCreate:true,suggestion:{...suggestion(),alignmentScore:101}},"schema_invalid"],[{shouldCreate:true,suggestion:{...suggestion(),pillar:"not published"}},"pillar_not_published"],[{shouldCreate:true,suggestion:{...suggestion(),title:"private_forbidden"}},"editorial_term_violation"],[{shouldCreate:true,suggestion:null},"radar_output_inconsistent"]]){
  const f=fixture();f.value(value);const result=await f.service.recover(auth,params,body());assert.equal(result.outcome,"failed");assert.equal(result.errorCode,code);assert.equal(f.metrics[0].end.errorCode,code);assert.equal(f.suggestions.length,0);assert.equal(JSON.stringify(f.root),f.original);
 }
});
test("AI linkage is recorded before the provider; failure to link never pays",async()=>{
 const f=fixture();f.store.linkAi=async()=>{throw Error("PRIVATE SQL");};const result=await f.service.recover(auth,params,body());assert.equal(result.outcome,"failed");assert.equal(f.requests.length,0);assert.equal(f.metrics[0].end.errorCode,"storage_unavailable");assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
});
test("ambiguous post-commit errors reconcile a saved outcome without corrupting completion",async()=>{
 const f=fixture(),finish=f.store.finish;f.store.finish=async(...args)=>{await finish(...args);throw Error("PRIVATE post-commit");};
 const result=await f.service.recover(auth,params,body());assert.equal(result.outcome,"created");assert.equal(f.attempts[0].status,"completed");assert.equal(f.requests.length,1);
});
test("failed failure-recording leaves processing reserved; there is no timeout takeover",async()=>{
 const f=fixture();f.failure(new AiProviderError("timeout"));f.store.fail=async()=>{throw Error("PRIVATE storage");};
 await assert.rejects(f.service.recover(auth,params,body()),{code:"recovery_storage_unavailable"});
 f.advance();await assert.rejects(f.service.recover(auth,params,body(1)),{code:"recovery_processing"});assert.equal(f.requests.length,1);
});
test("empty memory permits limited personalization and no invented pillar",async()=>{
 const f=fixture();const context=await import("../brand-brain-ai/brand-brain-ai.context.js");
 f.ai.context=async id=>context.buildBrandBrainContext({id,name:"Synthetic",locale:"pt",brain:{},recentPautas:[]});f.value({shouldCreate:true,suggestion:{...suggestion(),pillar:null,basedOn:[]}});
 assert.equal((await f.service.recover(auth,params,body())).outcome,"created");assert.equal(f.suggestions[0].pillar,null);
});
test("client budget, irreversible original errors and stale expected counts are bounded",()=>{
 const base={originalStatus:"failed",originalError:"invalid_response",attempts:[],expectedAttempts:0,nowMs:1,clientActive:false,clientDaily:0};
 assert.throws(()=>assertRecoveryPolicy({...base,clientDaily:10}),{code:"recovery_budget"});assert.throws(()=>assertRecoveryPolicy({...base,originalError:"client_forbidden"}),{code:"source_not_recoverable"});assert.throws(()=>assertRecoveryPolicy({...base,expectedAttempts:1}),{code:"recovery_stale_review"});
});
test("HTTP administrative operations reject portal/read-only users and return clear metadata-only outcomes",async()=>{
 const f=fixture(),app=Fastify();let current:AuthContext|null=null;await app.register(httpErrorsPluginRegistered);app.decorateRequest("auth",null);app.addHook("preHandler",async r=>{r.auth=current;});await app.register(radarRecoveryRoutes,{prefix:"/api",service:f.service});
 const url=`/api/clients/${a}/radar-recovery`;
 try {assert.equal((await app.inject(url)).statusCode,401);current={...auth,user:{...auth.user,globalRole:"cliente"}};assert.equal((await app.inject(url)).statusCode,403);current=auth;
 const list=await app.inject(url);assert.equal(list.statusCode,200);assert.equal(list.json().requiresSourceResend,true);
 const request=body(),one=await app.inject({method:"POST",url:`${url}/${runId}`,payload:request});assert.equal(one.statusCode,200);assert.equal(one.json().outcome,"created");
 assert.equal((await app.inject({method:"POST",url:`${url}/${runId}`,payload:request})).json().attemptId,one.json().attemptId);assert.equal(f.requests.length,1);
 }finally{await app.close();}
});

test("a suggestion inserted during the provider call is reconciled without creating another",async()=>{
 const f=fixture();let release!:()=>void;f.gate(new Promise(r=>{release=r;}));const first=f.service.recover(auth,params,body());
 while(!f.requests.length)await new Promise(r=>setTimeout(r,1));f.suggestions.push({id:randomUUID(),clientId:a,status:"pending"});release();
 assert.equal((await first).outcome,"existing");assert.equal(f.suggestions.length,1);assert.equal(f.attempts[0].createdSuggestion,false);
});
test("resent source identity uses the same URL and date normalization as the original Radar",async()=>{
 const f=fixture();const request={...body(),source:{...source,sourceUrl:"https://EXAMPLE.invalid/source?utm_source=test#fragment"}};
 assert.equal((await f.service.recover(auth,params,request)).outcome,"created");
 const g=fixture();g.root.sourceHash=radarSourceKey({...source,sourceUrl:null});
 assert.equal((await g.service.recover(auth,params,{...body(),source:{...source,sourceUrl:null}})).outcome,"created");
});

test("history remains readable with recovery writes disabled and never starts an attempt",async()=>{
 const f=fixture(false);const result=await f.service.list(auth,a);assert.equal(result.enabled,false);assert.equal(result.sources[0].originalStatus,"failed");assert.equal(f.attempts.length,0);assert.equal(f.requests.length,0);
 await assert.rejects(f.service.recover(auth,params,body()),{code:"recovery_disabled"});
});
