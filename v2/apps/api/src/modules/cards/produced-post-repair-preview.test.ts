import assert from "node:assert/strict";
import test from "node:test";
import { buildProducedPostRepairPreview as preview, readProducedPostRepairSnapshot, repairTarget as target, type RepairSnapshot } from "./produced-post-repair-preview.js";
function fixture(): RepairSnapshot {
 const card={id:target.cardId,client_account_id:target.clientId,title:"Synthetic Kynagogi",column_id:"waiting",status_json:"[]",is_brief_approval:1,approval_state:"pending",approval_revision:2,caption:"Preserved",media_urls_json:'["/api/uploads/synthetic.png"]',archived:0};
 const before={id:card.id,isBriefApproval:true,caption:"Original"},after={id:card.id,isBriefApproval:false,approvalState:"pending",approvalRevision:2,caption:"Original"};
 return {card,client:{id:target.clientId,slug:"kynagogi",workspace_drawer_json:JSON.stringify({pautaIdeas:[{id:target.ideaId,cardId:card.id,status:"approved"}]})},columns:[{id:"waiting",client_account_id:target.clientId,name:"Waiting approval",visible_to_client:1}],duplicates:[],preserved:{card_comments:[{id:"comment",card_id:card.id,comment_text:"Keep"}],approval_links:[{id:"link",card_id:card.id,token:"MUST_NOT_LEAK"}],card_caption_versions:[],card_calendar_events:[],internal_approval_requests:[],card_approval_events:[{id:"conversion",card_id:card.id,revision:2,action:"converted_to_post",before_json:JSON.stringify(before),after_json:JSON.stringify(after)}]}};
}
test("targeted preview preserves the exact snapshot, proposes visibility with classification, exposes no private payloads",()=>{
 const data=fixture(),original=JSON.stringify(data),result=preview(data);
 assert.equal(result.eligibleForReview,true);assert.deepEqual(result.proposedPatch,{isBriefApproval:false,status:["Enviar para Cliente"]});
 assert.equal(JSON.stringify(data),original);assert.doesNotMatch(JSON.stringify(result),/MUST_NOT_LEAK|synthetic.png|Original|comment_text/);
 assert.equal(result.mode,"preview-only");assert.equal(result.snapshotFingerprint,preview(structuredClone(data)).snapshotFingerprint);
 const modified=structuredClone(data);modified.card!.caption="New edit";assert.notEqual(preview(modified).snapshotFingerprint,result.snapshotFingerprint);
});
test("preview fails closed for changed decisions, columns, links and snapshots",async t=>{
 for(const [name,change] of Object.entries({
  "wrong client":(d:RepairSnapshot)=>{d.card!.client_account_id="other";},
  "approved post":(d:RepairSnapshot)=>{d.card!.approval_state="approved";},
  "terminal column":(d:RepairSnapshot)=>{d.columns[0].name="Agendados";},
  "terminal status":(d:RepairSnapshot)=>{d.card!.status_json='["Publicado"]';},
  "historical decision mismatch":(d:RepairSnapshot)=>{d.preserved.card_approval_events[0].decision="approved";},
  "hidden column":(d:RepairSnapshot)=>{d.columns[0].visible_to_client=0;},
  "unknown column":(d:RepairSnapshot)=>{d.card!.column_id=null;},
  "duplicate":(d:RepairSnapshot)=>{d.duplicates.push({id:"other"});},
  "missing media":(d:RepairSnapshot)=>{d.card!.media_urls_json="[]";},
  "invalid status":(d:RepairSnapshot)=>{d.card!.status_json="broken";},
  "scheduled":(d:RepairSnapshot)=>{d.card!.scheduled_at="2026-12-01";},
  "broken snapshot":(d:RepairSnapshot)=>{d.preserved.card_approval_events[0].after_json="{}";},
  "future event":(d:RepairSnapshot)=>{d.preserved.card_approval_events[0].revision=3;},
  "unknown comments":(d:RepairSnapshot)=>{delete d.preserved.card_comments;},
  "foreign reference":(d:RepairSnapshot)=>{d.preserved.approval_links[0].card_id="other";},
  "ambiguous bank":(d:RepairSnapshot)=>{d.client!.workspace_drawer_json={pautaIdeas:[{id:target.ideaId,cardId:target.cardId,status:"approved"},{cardId:target.cardId}]};},
 })) await t.test(name,()=>{const data=fixture();change(data);const result=preview(data);assert.equal(result.eligibleForReview,false);assert.equal(result.proposedPatch,null);assert.ok(result.blockers.length);});
});
test("preview reader only issues scoped SELECTs, never invokes startup/schema or mutation",async()=>{
 const calls:Array<{sql:string,args:unknown[]}>=[],data=fixture();
 await readProducedPostRepairSnapshot({query:async(sql:string,args:unknown[])=>{
  calls.push({sql,args});assert.match(sql,/^SELECT /);assert.ok(args.includes(target.cardId)||args.includes(target.clientId));
  return [sql.includes("FROM kanban_cards WHERE id")?[data.card]:sql.includes("FROM client_accounts")?[data.client]:sql.includes("FROM kanban_columns")?data.columns:[],[]];
 }});
 assert.equal(calls.length,10);assert.ok(calls.some(x=>x.sql.includes("internal_approval_requests")));
});
