import assert from "node:assert/strict";
import test from "node:test";
import { sendPautaForApproval } from "./pauta-send.service.js";
function fixture() {
 let drawer:any={pautaIdeas:[{id:"idea",title:"Title",description:"Description",caption:"Caption",concept:"Concept",hook:"Hook",rationale:"Reason",objective:"Educate",sourceSummary:"Original factual summary",sourceTitle:"Original news",sourceUrl:"https://example.invalid/news",sourceDate:"2026-10-14",internalNotes:"SECRET",pillar:"INTERNAL",aiModel:"TECH",status:"draft"},{id:"approved",title:"Untouched",status:"approved"}],links:["preserve"]};
 const cards:any[]=[];let rollback=0,commit=0,loseCommit=false,failLink=false,saved:any;
 const db={beginTransaction:async()=>{saved={drawer:structuredClone(drawer),cards:structuredClone(cards)};},commit:async()=>{commit++;if(loseCommit){loseCommit=false;throw Error("Lost acknowledgement");}},rollback:async()=>{rollback++;if(failLink){drawer=saved.drawer;cards.splice(0,cards.length,...saved.cards);}},release:()=>{},query:async(sql:string,params:any[]=[])=>{
  if(sql.includes("workspace_drawer_json FROM"))return [params[0]==="client"?[{workspace_drawer_json:JSON.stringify(drawer)}]:[],[]];
  if(sql.startsWith("SELECT id,name"))return [[{id:"column",name:"Pautas para aprovação"}],[]];
  if(sql.includes("MAX(position)"))return [[{max_position:-1}],[]];
  if(sql.startsWith("INSERT INTO kanban_cards")){const columns=sql.match(/\(([^)]+)\) VALUES/)![1].split(',').map(x=>x.trim());cards.push(Object.fromEntries(columns.map((key,i)=>[key,params[i]])));return [{affectedRows:1},[]];}
  if(sql.startsWith("SELECT")&&sql.includes("FROM kanban_cards"))return [cards.filter(c=>c.id===params[0]),[]];
  if(sql.startsWith("UPDATE client_accounts")){if(failLink)throw Error("Storage failure");drawer=JSON.parse(params[0]);return [{affectedRows:1},[]];}
  throw Error(sql);
 }};
 const app={db:{getConnection:async()=>db},httpErrors:{notFound:(s:string)=>Object.assign(Error(s),{statusCode:404}),conflict:(s:string)=>Object.assign(Error(s),{statusCode:409})}} as never;
 return {app,cards,drawer:()=>drawer,counts:()=>({rollback,commit}),lose:()=>{loseCommit=true;},fail:()=>{failLink=true;}};
}
test("global send snapshots only client-facing fields and commits card/link without changing existing pautas",async()=>{
 const f=fixture(),approved=structuredClone(f.drawer().pautaIdeas[1]);const result=await sendPautaForApproval(f.app,"client","idea","actor");
 assert.equal(result.created,true);assert.equal(result.card!.caption,"Caption");assert.equal(result.card!.isBriefApproval,true);
 assert.equal(result.card!.editorialBrief!.sourceSummary,"Original factual summary");assert.doesNotMatch(JSON.stringify(result.card!.editorialBrief),/SECRET|INTERNAL|TECH/);
 assert.deepEqual(f.drawer().pautaIdeas[1],approved);assert.deepEqual(f.drawer().links,["preserve"]);
 assert.equal(f.drawer().pautaIdeas[0].cardId,result.card!.id);
 const retry=await sendPautaForApproval(f.app,"client","idea","actor");assert.equal(retry.created,false);assert.equal(f.cards.length,1);
});
test("lost send acknowledgement returns the committed card on retry, without replacing its snapshot",async()=>{
 const f=fixture();f.lose();await assert.rejects(sendPautaForApproval(f.app,"client","idea","actor"));
 const first=JSON.stringify(f.cards[0]);const retry=await sendPautaForApproval(f.app,"client","idea","actor");assert.equal(retry.created,false);assert.equal(f.cards.length,1);assert.equal(JSON.stringify(f.cards[0]),first);
});
test("failure linking the bank rolls back the newly created card; other clients and approved pautas cannot send",async()=>{
 const f=fixture();f.fail();await assert.rejects(sendPautaForApproval(f.app,"client","idea","actor"));assert.equal(f.cards.length,0);assert.equal(f.drawer().pautaIdeas[0].status,"draft");
 await assert.rejects(sendPautaForApproval(f.app,"other","idea","actor"),{statusCode:404});
 await assert.rejects(sendPautaForApproval(f.app,"client","approved","actor"),{statusCode:409});
});
test("manual pauta snapshots available description, without invented Radar fields",async()=>{
 const f=fixture();f.drawer().pautaIdeas[0]={id:"idea",title:"Manual",description:"Human description",caption:"",status:"draft"};
 const result=await sendPautaForApproval(f.app,"client","idea","actor");assert.deepEqual(result.card!.editorialBrief,{description:"Human description"});assert.equal(result.card!.caption,"Human description");
});
