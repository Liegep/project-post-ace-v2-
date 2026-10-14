import assert from "node:assert/strict";
import test from "node:test";
import { readEditorialBrief, editorialBriefSchema } from "./editorial-brief.js";
import { createCardSchema } from "./cards.schemas.js";
import { findCardById, updateCard } from "./cards.repository.js";
import { recordApprovalEvent } from "../approvals/approval-history.repository.js";
test("client brief is an explicit whitelist; legacy/manual null stays null",()=>{
 const brief=readEditorialBrief(JSON.stringify({concept:"Idea",sourceSummary:"Factual input",sourceUrl:"https://example.invalid",internalNotes:"SECRET",aiModel:"MODEL",alignmentScore:90}));
 assert.deepEqual(brief,{concept:"Idea",sourceSummary:"Factual input",sourceUrl:"https://example.invalid"});
 assert.equal(readEditorialBrief(null),null);assert.equal(readEditorialBrief("not JSON"),null);
 assert.equal(editorialBriefSchema.safeParse({internalNotes:"secret"}).success,false);
 for(const sourceUrl of ["javascript:alert(1)","https://user:password@example.invalid"])assert.equal(editorialBriefSchema.safeParse({sourceUrl}).success,false);
 assert.equal(createCardSchema.parse({title:"Manual"}).editorialBrief,undefined);
});
test("card reads and approval event snapshots carry the same client-safe brief",async()=>{
 const brief={concept:"Concept",sourceSummary:"Original factual input",sourceDate:"2026-10-14"};let recorded:unknown[]=[];
 const db={query:async(sql:string,params:unknown[])=>{if(sql.startsWith("INSERT")){recorded=params;return [{affectedRows:1},[]];}return [[{id:"card",caption:"Caption",editorial_brief_json:{...brief,internalNotes:"SECRET"}}],[]];}};
 const card=await findCardById(db as never,"card");assert.deepEqual(card!.editorialBrief,brief);
 await recordApprovalEvent(db as never,{cardId:"card",revision:1,action:"approved",decision:"approved",source:"portal",actor:{userId:null,name:"Synthetic",role:"cliente"},before:card,after:card});
 assert.deepEqual(JSON.parse(recorded[13] as string).editorialBrief,brief);assert.doesNotMatch(recorded[13] as string,/SECRET/);
});
test("updating briefing guards against concurrent approval and does not silently overwrite it",async()=>{
 let sql="";const db={query:async(statement:string)=>{sql=statement;return [{affectedRows:0},[]];}};
 await assert.rejects(updateCard(db as never,"card",{editorialBrief:{concept:"New"},expectedApprovalRevision:2}),{statusCode:409});
 assert.match(sql,/approval_revision = \?/);assert.match(sql,/approval_state <> 'approved'/);
});

test("approved bank content cannot be overwritten or reset to draft; maintenance preserves existing content",async()=>{
 const {preservesApprovedPauta}=await import("../clients/pauta-edit.policy.js");
 const old={status:"approved",title:"Reviewed",sourceSummary:"Reviewed source"};
 assert.equal(preservesApprovedPauta(old,{title:"Replacement"}),false);assert.equal(preservesApprovedPauta(old,{status:"draft"}),false);
 assert.equal(preservesApprovedPauta(old,{sourceSummary:"Replacement"}),false);assert.equal(preservesApprovedPauta(old,{cardId:"existing",title:"Reviewed"}),true);
 assert.equal(preservesApprovedPauta({status:"draft"},{title:"Human edit"}),true);
});
test("invalid legacy source metadata does not hide other valid editorial content",()=>{
 assert.deepEqual(readEditorialBrief({concept:"Keep this",sourceUrl:"javascript:alert(1)",sourceDate:"2026-02-30"}),{concept:"Keep this"});
});
