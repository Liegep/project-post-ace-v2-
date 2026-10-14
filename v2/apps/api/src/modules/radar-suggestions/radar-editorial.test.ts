import assert from "node:assert/strict";
import test from "node:test";
import { RadarSuggestionsRepository } from "./radar-suggestions.repository.js";
import { radarSuggestionInputSchema } from "./radar-suggestions.schemas.js";
import { sample } from "./radar-suggestions.test-fixtures.js";
async function accept(summary:string|null) {
 let drawer:any={pautaIdeas:[{id:"old",title:"Approved original",status:"approved"}],links:["keep"]};
 const row:any={id:"suggestion",client_account_id:"client",status:"pending",title:"Title",concept:"Concept",hook:"Hook",description:"Description",content_type:"carousel",objective:"Objective",rationale:"Rationale",source_title:"Source",source_summary:summary,source_date:"2026-10-14",source_url:"https://example.invalid/news",based_on_json:'["INTERNAL"]',created_epoch:1,updated_epoch:1};
 const db={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},query:async(sql:string,params:any[])=>{
  if(sql.includes("SELECT workspace"))return [[{workspace_drawer_json:drawer}],[]];if(sql.startsWith("SELECT"))return [[row],[]];
  if(sql.startsWith("UPDATE client"))drawer=JSON.parse(params[0]);else {row.status="accepted";row.accepted_pauta_id=params[0];}return [{affectedRows:1},[]];
 }};
 const repo=new RadarSuggestionsRepository({getConnection:async()=>db} as never);
 const first=await repo.resolve("client","suggestion","actor","accept"),snapshot=JSON.stringify(first.pauta);
 const retry=await repo.resolve("client","suggestion","actor","accept");assert.equal(retry.created,false);assert.equal(JSON.stringify(retry.pauta),snapshot);
 assert.equal(drawer.pautaIdeas.length,2);assert.deepEqual(drawer.pautaIdeas[1],{id:"old",title:"Approved original",status:"approved"});
 return first.pauta!;
}
test("acceptance keeps concept, hook, rationale, objective, factual summary and publication date; replay preserves human content",async()=>{
 const pauta=await accept("Factual summary");for(const key of ["concept","hook","rationale","objective","sourceTitle","sourceUrl","sourceDate"] as const)assert.ok(pauta[key]);assert.equal(pauta.sourceSummary,"Factual summary");
});
test("old suggestions without source summary keep absence and retain known source metadata",async()=>{
 const pauta=await accept(null);assert.equal(pauta.sourceSummary,null);assert.equal(pauta.sourceDate,"2026-10-14");
 const old=radarSuggestionInputSchema.parse(sample());assert.equal(old.sourceSummary,null);
});
