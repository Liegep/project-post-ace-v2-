import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { planBriefRecovery } from "./brief-recovery.service.js";
import { clientRoutes } from "./clients.routes.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";

test("recovery fills missing original fields only; preserves divergent description and existing briefing", () => {
  const plan = planBriefRecovery({ description:"Human description",caption:"Human caption",concept:"Human concept" }, { description:"Original description",concept:"Original concept",hook:"Original hook",rationale:"Original reason",source_summary:null,source_url:"javascript:alert(1)" }, { concept:"Card concept" });
  assert.deepEqual(plan.additions, { hook:"Original hook",rationale:"Original reason" });
  assert.deepEqual(plan.bankAdditions, { hook:"Original hook",rationale:"Original reason" });
  assert.equal(plan.recoveredBrief.concept,"Card concept");
  assert.equal(plan.divergences.length,2);
  assert.ok(plan.unavailable.includes("sourceSummary"));assert.ok(plan.unavailable.includes("sourceUrl"));
  assert.equal("description" in plan.bankAdditions,false);
  const protectedPlan=planBriefRecovery({caption:"Edited"},{caption_suggestion:"Original"},null,{title:"Title",caption:"Edited on card"});
  assert.equal(protectedPlan.divergences[0].field,"caption");
  assert.deepEqual(protectedPlan.additions,{});assert.equal("caption" in plan.additions,false);
});
test("recovery does not invent source data or copy internal fields; rejects invalid existing JSON",()=>{
  const plan=planBriefRecovery({description:"Original"},{description:"Original",ai_model:"PRIVATE",based_on_json:["PRIVATE"],source_title:"News",source_url:"https://example.invalid/news",source_date:"2026-10-14"},null);
  assert.equal(plan.additions.description,"Original");assert.equal(plan.additions.sourceDate,"2026-10-14");
  assert.doesNotMatch(JSON.stringify(plan),/PRIVATE|ai_model|based_on/);
  assert.throws(()=>planBriefRecovery({}, {},"invalid"));assert.throws(()=>planBriefRecovery({}, {},[]));
});
test("recovery routes enforce authentication, admin role, activity, client scope and explicit preview confirmation",async()=>{
  const app=Fastify();await app.register(httpErrorsPluginRegistered);
  let auth:any=null;app.decorate("db",{query:async()=>[[],[]]} as never);
  app.addHook("onRequest",async request=>{request.auth=auth;});await app.register(clientRoutes);
  const clientId=randomUUID(),cardId=randomUUID(),url=`/clients/${clientId}/cards/${cardId}/editorial-brief-recovery`;
  const user=(globalRole:string,isActive=true)=>({user:{id:randomUUID(),globalRole,isActive},memberships:[]});
  try {
    assert.equal((await app.inject(`${url}/preview`)).statusCode,401);
    for(const role of ["cliente","colaborador","admin"]) {auth=user(role);assert.equal((await app.inject(`${url}/preview`)).statusCode,403);}
    auth=user("super_admin",false);assert.equal((await app.inject(`${url}/preview`)).statusCode,403);
    auth=user("super_admin");
    for(const payload of [{},{confirm:true},{previewToken:"forged",confirm:false},{previewToken:"forged",confirm:true,sourceSummary:"PRIVATE"}]) assert.equal((await app.inject({method:"POST",url,payload})).statusCode,400);
  } finally {await app.close();}
});
