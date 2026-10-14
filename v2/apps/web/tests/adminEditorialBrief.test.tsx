import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminEditorialBrief, RecoveryPreview } from "../src/AdminEditorialBrief";
import { ApprovalBriefSnapshot } from "../src/EditorialBrief";
test("administrator sees current briefing, without applying or displaying recoverable data as current",()=>{
 const html=renderToStaticMarkup(<AdminEditorialBrief card={{id:"synthetic",isBriefApproval:true,editorialBrief:{description:"Current briefing",sourceUrl:"https://example.invalid/news"}} as any} slug="synthetic" onRecovered={()=>{}}/>);
 assert.match(html,/Current briefing/);assert.match(html,/href="https:\/\/example.invalid\/news"/);
 assert.equal(renderToStaticMarkup(<AdminEditorialBrief card={{id:"manual"} as any} slug="synthetic" onRecovered={()=>{}}/>),"");
 assert.match(html,/Consultar prévia/);assert.doesNotMatch(html,/Confirmar recuperação|Conteúdo recuperável/);
});
test("recovery preview labels unapplied data, divergences, missing facts and explicit approval/link effects",()=>{
 const html=renderToStaticMarkup(<RecoveryPreview preview={{eligible:true,blockers:[],additions:{concept:"Original concept"},bankAdditions:{hook:"Hook"},divergences:[{field:"description",pauta:"Human description",current:null,original:"Original description"}],unavailable:["sourceSummary"],effects:{activeLinksToInvalidate:2}} as any}/>);
 assert.match(html,/ainda não aplicado/);assert.match(html,/Original concept/);assert.match(html,/Human description/);
 assert.match(html,/nova aprovação/);assert.match(html,/links públicos ativos \(2\)/);assert.match(html,/Nenhum texto será reconstruído/);
});
test("historic briefing remains distinct and does not expose technical recovery provenance",()=>{
 const snapshot={editorialBrief:{description:"Before"},briefRecoveryOrigin:{suggestionId:"PRIVATE_ID"}};
 const html=renderToStaticMarkup(<ApprovalBriefSnapshot snapshot={snapshot}/>);
 assert.match(html,/Before/);assert.doesNotMatch(html,/PRIVATE_ID|briefRecoveryOrigin/);
});

test("unsaved edits disable recovery without sending or changing current content",()=>{
 const html=renderToStaticMarkup(<AdminEditorialBrief card={{id:"synthetic",isBriefApproval:true} as any} slug="synthetic" onRecovered={()=>{}} disabledReason="Save first"/>);
 assert.match(html,/disabled=""/);assert.match(html,/Save first/);assert.doesNotMatch(html,/Confirmar recuperação/);
});
