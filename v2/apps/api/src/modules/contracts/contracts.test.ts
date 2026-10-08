import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool } from "mysql2/promise";
import { acceptContract, createContract, deleteContract, findPendingContract, portalContract, updateContract } from "./contracts.repository.js";
import { createContractSchema, createContractTemplateSchema } from "./contracts.schemas.js";
import { contractRoutes } from "./contracts.routes.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
const account = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000002";
const input = () => createContractSchema.parse({clientAccountId:account,title:"Documento",bodyHtml:"<p>Termos originais</p>",notes:"SEGREDO",publicationId:id});
function database(status = "pending", historicalAcceptance = false) {
 const rows = new Map<string, any>(); const acceptances = new Map<string, any>(); const writes: string[] = [];
 let queue = Promise.resolve();
 const seed = (key:string, state="pending") => rows.set(key,{id:key,client_account_id:account,client_name:"Cliente",client_slug:"cliente",title:"Documento",body_html:"<p>Termos originais</p>",language:"Português",contract_type:"Prestação de serviços",start_date:null,end_date:null,contract_value:"",scope_text:"",notes:"SEGREDO",status:state,created_at:"2026-10-01",updated_at:"2026-10-01"});
 seed(id,status); if(historicalAcceptance) acceptances.set(id,{id:"old",user_id:"historical",accepted_at:"2026-06-26T10:30:00Z",ip_address:"original-ip"});
 const query = async (sql:string, values:any[] = []):Promise<any> => {
  if(sql.startsWith("CREATE TABLE")) return [[],[]];
  if(sql.includes("FOR UPDATE")) return [[rows.get(values[0])].filter(Boolean),[]];
  if(sql.startsWith("SELECT id FROM contract_acceptances")) return [[acceptances.get(values[0])].filter(Boolean),[]];
  if(sql.includes("FROM contracts c JOIN")) {
   const candidates = sql.includes("WHERE c.id=?") ? [rows.get(values[0])].filter(Boolean) : [...rows.values()].filter(row=>row.client_account_id===values[0] && row.status==="pending" && !acceptances.has(row.id)).slice(0,1);
   return [candidates.map(row=>({...row,accepted_at:acceptances.get(row.id)?.accepted_at??null,accepted_by_user_id:acceptances.get(row.id)?.user_id??null})),[]];
  }
  if(sql.startsWith("INSERT INTO contract_acceptances")) { writes.push(sql); acceptances.set(values[1],{id:values[0],user_id:values[2],ip_address:values[3],accepted_at:"2026-10-03T12:00:00Z"}); return [{affectedRows:1},[]]; }
  if(sql.startsWith("INSERT INTO contracts")) {
   if(rows.has(values[0])) throw Object.assign(new Error("Duplicate"),{code:"ER_DUP_ENTRY"});
   writes.push(sql); const columns=["id","client_account_id","title","body_html","language","contract_type","start_date","end_date","contract_value","scope_text","notes","status","created_by_user_id"];
   rows.set(values[0],{client_name:"Cliente",client_slug:"cliente",created_at:"2026-10-01",updated_at:"2026-10-01",...Object.fromEntries(columns.map((key,index)=>[key,values[index]]))}); return [{affectedRows:1},[]];
  }
  if(sql.startsWith("UPDATE contracts")) { writes.push(sql); const row=rows.get(values.at(-1)); sql.match(/SET (.*) WHERE/)![1].split(",").forEach((field,index)=>row[field.split("=")[0]]=values[index]); return [{affectedRows:1},[]]; }
  if(sql.startsWith("DELETE FROM contracts")) { writes.push(sql); return [{affectedRows:rows.delete(values[0])?1:0},[]]; }
  throw new Error(`Unexpected query: ${sql}`);
 };
 const db = {query,async getConnection(){let unlock:()=>void;return {async beginTransaction(){},async query(sql:string,values:any[]){ if(sql.includes("FOR UPDATE")){ const previous=queue;queue=new Promise<void>(resolve=>unlock=resolve);await previous;}return query(sql,values);},async commit(){unlock?.();},async rollback(){unlock?.();},release(){}};}} as unknown as Pool;
 return {db,rows,acceptances,writes,seed};
}
test("accepted historical documents cannot be edited or deleted and acceptance is preserved",async()=>{
 for(const [status,hasAcceptance] of [["pending",true],["accepted",false]] as const){const fixture=database(status,hasAcceptance);const before=JSON.stringify([...fixture.rows]);const old=JSON.stringify([...fixture.acceptances]);await assert.rejects(updateContract(fixture.db,id,{bodyHtml:"Change",notes:"Change"}),{statusCode:409});await assert.rejects(deleteContract(fixture.db,id),{statusCode:409});assert.equal(JSON.stringify([...fixture.rows]),before);assert.equal(JSON.stringify([...fixture.acceptances]),old);assert.equal(fixture.writes.length,0);}
});
test("acceptance requires pending status and the matching client and cannot be repeated",async()=>{
 for(const status of ["cancelled","accepted"]){const fixture=database(status);await assert.rejects(acceptContract(fixture.db,id,account,"user","ip"),{statusCode:409});assert.equal(fixture.writes.length,0);}
 const fixture=database();await assert.rejects(acceptContract(fixture.db,id,"other","user","ip"),{statusCode:404});const contract=await acceptContract(fixture.db,id,account,"user","192.0.2.1");assert.equal(contract?.acceptedByUserId,"user");assert.equal(contract?.acceptedAt,"2026-10-03T12:00:00Z");assert.equal(fixture.acceptances.get(id).ip_address,"192.0.2.1");await assert.rejects(acceptContract(fixture.db,id,account,"other-user","different-ip"),{statusCode:409});assert.equal(fixture.acceptances.get(id).user_id,"user");await assert.rejects(updateContract(fixture.db,id,{status:"cancelled"}),{statusCode:409});
});
test("concurrent acceptance and edit serialize on the document and preserve the accepted content",async()=>{
 const fixture=database();const results=await Promise.allSettled([acceptContract(fixture.db,id,account,"user","ip"),updateContract(fixture.db,id,{bodyHtml:"Changed after acceptance"}),acceptContract(fixture.db,id,account,"other","ip")]);assert.equal(results[0].status,"fulfilled");assert.equal(results[1].status,"rejected");assert.equal(results[2].status,"rejected");assert.equal(fixture.rows.get(id).body_html,"<p>Termos originais</p>");assert.equal(fixture.acceptances.size,1);
});
test("publication retries reuse the same document and never change the accepted document",async()=>{
 const fixture=database();fixture.rows.clear();const payload=input();await createContract(fixture.db,"admin",payload);await createContract(fixture.db,"admin",payload);await acceptContract(fixture.db,id,account,"user","ip");await createContract(fixture.db,"admin",payload);assert.equal(fixture.rows.size,1);assert.equal(fixture.acceptances.size,1);await assert.rejects(createContract(fixture.db,"admin",{...payload,title:"Changed"}),{statusCode:409});assert.equal(fixture.rows.get(id).title,"Documento");
});
test("pending query advances through all contracts and portal payload excludes internal notes",async()=>{
 const fixture=database();fixture.seed("next");const first=await findPendingContract(fixture.db,account);assert.equal(first?.id,id);assert.equal("notes" in portalContract(first)!,false);await acceptContract(fixture.db,id,account,"user","ip");assert.equal((await findPendingContract(fixture.db,account))?.id,"next");await acceptContract(fixture.db,"next",account,"user","ip");assert.equal(await findPendingContract(fixture.db,account),null);
});
test("template empty dates normalize to null and type/value remain compatible; creation cannot forge acceptance",()=>{
 const template=createContractTemplateSchema.parse({name:"Modelo",draft:{startDate:"",endDate:"",contractType:"Consultoria",contractValue:"€ 500"}});assert.equal(template.draft.startDate,null);assert.equal(template.draft.endDate,null);assert.equal(template.draft.contractType,"Consultoria");assert.equal(template.draft.contractValue,"€ 500");assert.equal(createContractSchema.safeParse({...input(),status:"accepted"}).success,false);
});
test("direct administrative status changes cannot forge an acceptance",async()=>{const fixture=database();await assert.rejects(updateContract(fixture.db,id,{status:"accepted"}),{statusCode:409});assert.equal(fixture.writes.length,0);});
test("accept API rejects foreign account, viewer and privileged non-client users; portal GET hides notes",async()=>{
 const fixture=database();const app=Fastify();app.decorate("db",fixture.db);await app.register(httpErrorsPluginRegistered);
 let auth:any={user:{id:"user",globalRole:"cliente"},memberships:[{clientAccountId:account,membershipRole:"cliente",portalAccessLevel:"full"}]};
 app.addHook("onRequest",async request=>{request.auth=auth;});await app.register(contractRoutes);
 try {
  const read=await app.inject({method:"GET",url:`/portal/accounts/${account}/contracts/pending`});assert.equal(read.statusCode,200);assert.equal("notes" in read.json().contract,false);
  for(const replacement of [
   {user:{id:"user",globalRole:"cliente"},memberships:[]},
   {user:{id:"user",globalRole:"cliente"},memberships:[{clientAccountId:account,membershipRole:"cliente",portalAccessLevel:"viewer"}]},
   {user:{id:"admin",globalRole:"super_admin"},memberships:[]},
   {user:{id:"admin",globalRole:"admin"},memberships:[{clientAccountId:account,membershipRole:"admin",portalAccessLevel:"full"}]}
  ]) {auth=replacement;const response=await app.inject({method:"POST",url:`/portal/accounts/${account}/contracts/${id}/accept`});assert.equal(response.statusCode,403);}
  assert.equal(fixture.writes.length,0);
 } finally {await app.close();}
});
test("HTTP edits and deletes of accepted historical documents return conflict without changing history",async()=>{
 const fixture=database("pending",true);const app=Fastify();app.decorate("db",fixture.db);await app.register(httpErrorsPluginRegistered);app.addHook("onRequest",async request=>{request.auth={user:{id:"admin",globalRole:"super_admin"},memberships:[]} as any;});await app.register(contractRoutes);
 try {const before=JSON.stringify([...fixture.rows,...fixture.acceptances]);for(const method of ["PATCH","DELETE"] as const){const response=await app.inject({method,url:`/contracts/${id}`,...(method==="PATCH"?{payload:{title:"Silently edited"}}:{})});assert.equal(response.statusCode,409);}assert.equal(JSON.stringify([...fixture.rows,...fixture.acceptances]),before);assert.equal(fixture.writes.length,0);}finally{await app.close();}
});
