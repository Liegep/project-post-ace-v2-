import assert from "node:assert/strict";
import test from "node:test";
import {RadarRecoveryRepository} from "./radar-recovery.repository.js";
const client="11111111-1111-4111-8111-111111111111",run="22222222-2222-4222-8222-222222222222";
const input={clientId:client,runId:run,sourceHash:"a".repeat(64),contextHash:"b".repeat(64),inputHash:"c".repeat(64),requestId:"33333333-3333-4333-8333-333333333333",expectedAttempts:0,userId:client};
function fixture() {
 let rows:any[]=[],daily=0,active=0,rootStatus="failed",existing:any=null,rollback=0,commit=0,failInsert=false;
 const queries:{sql:string;params:unknown[]}[]=[];
 const query=async(sql:string,params:unknown[]=[])=>{
  queries.push({sql,params});
  if(sql.includes("FROM client_accounts"))return [[{id:client}]];
  if(sql.includes("FROM radar_source_runs"))return [[{id:run,status:rootStatus,error_code:"invalid_response",source_key:input.sourceHash}]];
  if(sql.includes("FROM radar_suggestions"))return [existing?[existing]:[]];
  if(sql.includes("SUM(status="))return [[{daily,active,now_ms:1000000}]];
  if(sql.startsWith("INSERT INTO radar_recovery_attempts")){
   if(failInsert)throw Error("PRIVATE DATABASE DETAILS");
   rows.push({id:params[0],source_run_id:params[1],client_account_id:params[2],request_id:params[3],attempt_number:params[4],input_hash:params[5],status:"processing",error_code:null,suggestion_id:null,suggestion_created:0,ai_run_id:null,created_ms:1000000,finished_ms:null});return [{affectedRows:1}];
  }
  if(sql.startsWith("UPDATE radar_recovery_attempts a")){rows[0].ai_run_id=params[0];return [{affectedRows:1}];}
  if(sql.startsWith("UPDATE radar_recovery_attempts SET status='failed'")){if(rows[0].status==="processing"){rows[0].status="failed";rows[0].error_code=params[0];rows[0].finished_ms=1000000;}return [{affectedRows:1}];}
  if(sql.startsWith("UPDATE radar_recovery_attempts SET status=?")){rows[0].status=params[0];rows[0].suggestion_id=params[1];rows[0].suggestion_created=params[2];rows[0].finished_ms=1000000;return [{affectedRows:1}];}
  if(sql.includes("FROM radar_recovery_attempts"))return [rows.filter(r=>sql.includes("source_run_id=?") ? r.source_run_id===params[0] && r.client_account_id===params[1] : r.id===params[0] && r.client_account_id===params[1])];
  throw Error("Unexpected fixture query");
 };
 let snapshot:any[]=[];
 const connection={query,beginTransaction:async()=>{snapshot=structuredClone(rows);},commit:async()=>{commit++;},rollback:async()=>{rollback++;rows=snapshot;},release:()=>{}};
 const db={query,getConnection:async()=>connection};
 return {repository:new RadarRecoveryRepository(db as never),queries,rows:()=>rows,setBudget:(n:number,busy=0)=>{daily=n;active=busy;},setStatus:(s:string)=>{rootStatus=s;},existing:(r:any)=>{existing=r;},breakInsert:()=>{failInsert=true;},commits:()=>commit,rollbacks:()=>rollback};
}
test("claim locks client/source, reserves durable metadata and never updates original failures",async()=>{
 const f=fixture(),claim=await f.repository.claim(input);assert.equal(claim.owned,true);assert.equal(f.rows().length,1);
 const locks=f.queries.filter(q=>q.sql.includes("FOR UPDATE"));assert.match(locks[0].sql,/client_accounts/);assert.match(locks[1].sql,/radar_source_runs/);assert.deepEqual(locks[1].params,[run,client]);
 assert.ok(!f.queries.some(q=>/^(UPDATE radar_source_runs|DELETE|ALTER|CREATE)\b/i.test(q.sql)));assert.equal(f.commits(),1);assert.equal(f.rollbacks(),0);
 assert.equal((await f.repository.claim(input)).owned,false);assert.equal(f.rows().length,1);
 await assert.rejects(f.repository.claim({...input,inputHash:"d".repeat(64)}),{code:"recovery_request_conflict"});
});
test("source mismatch, current status, budget and busy client roll back before attempt insertion",async()=>{
 for(const change of ["hash","completed","budget","busy"]){const f=fixture();let request={...input};if(change==="hash")request.sourceHash="d".repeat(64);if(change==="completed")f.setStatus("completed");if(change==="budget")f.setBudget(10);if(change==="busy")f.setBudget(1,1);
 await assert.rejects(f.repository.claim(request));assert.equal(f.rows().length,0);assert.equal(f.rollbacks(),1);assert.equal(f.commits(),0);}
});
test("reservation storage failure rolls back; existing suggestions return without reserving",async()=>{
 const f=fixture();f.breakInsert();await assert.rejects(f.repository.claim(input));assert.equal(f.rows().length,0);assert.equal(f.rollbacks(),1);
 const g=fixture();g.existing({id:client,status:"accepted"});const result=await g.repository.claim(input);assert.ok("existing" in result);assert.equal(g.rows().length,0);
});
test("AI link is client-bound and finalization reconciles existing suggestions even on no-op",async()=>{
 const f=fixture(),claim=await f.repository.claim(input);assert.ok("attempt" in claim);const id=claim.attempt.id;
 await f.repository.linkAi(client,id,run);assert.match(f.queries.at(-1)!.sql,/b.client_account_id=a.client_account_id/);
 f.existing({id:client,status:"dismissed"});const result=await f.repository.finish(client,id,client,input.sourceHash,null);assert.equal(result.status,"completed");assert.equal(result.suggestionId,client);assert.equal(result.createdSuggestion,false);
 await assert.rejects(f.repository.finish(client,id,client,input.sourceHash,null),{code:"recovery_processing"});
});
test("failure is fenced by attempt/client/state and cannot overwrite a resolved outcome",async()=>{
 const f=fixture(),claim=await f.repository.claim(input);assert.ok("attempt" in claim);const id=claim.attempt.id;
 assert.equal((await f.repository.finish(client,id,client,input.sourceHash,null)).status,"no_op");
 assert.equal((await f.repository.fail(client,id,"timeout")).status,"no_op");
 const last=[...f.queries].reverse().find(q=>q.sql.startsWith("UPDATE radar_recovery_attempts SET status='failed'"))!;assert.deepEqual(last.params,["timeout",id,client]);assert.match(last.sql,/status='processing'/);
});

test("proposed migration is additive, bounded and contains no historical execution/backfill",async()=>{
 const {readFileSync}=await import("node:fs");
 const sql=readFileSync(new URL("../../../../../database/migrations/20261012_radar_recovery_attempts.sql",import.meta.url),"utf8");
 assert.match(sql,/UNIQUE KEY uq_radar_recovery_number \(source_run_id, attempt_number\)/);assert.match(sql,/UNIQUE KEY uq_radar_recovery_request \(source_run_id, request_id\)/);
 assert.match(sql,/CHECK \(attempt_number BETWEEN 1 AND 2\)/);assert.match(sql,/ai_consent=1 AND source_reviewed=1/);assert.match(sql,/REFERENCES brand_brain_ai_runs\(id\)/);
 assert.ok(!/^(INSERT|UPDATE|DELETE|ALTER|DROP)\b/im.test(sql));assert.ok(!/source_summary|source_url|prompt|response_json/i.test(sql.replace(/^--.*$/gm,"")));
});
