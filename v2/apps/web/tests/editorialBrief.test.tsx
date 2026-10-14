import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorialBrief, clientEditorialBrief, sourcePublicationDate } from "../src/EditorialBrief";
const source = {concept:"Idea", hook:"Hook", description:"Description", rationale:"Editorial reason", objective:"Educate", sourceTitle:"Synthetic report", sourceSummary:"Original factual summary", sourceUrl:"https://example.invalid/news", sourceDate:"2026-10-14"};
test("one briefing standard preserves content and safe source links for any client", () => {
 const html=renderToStaticMarkup(<EditorialBrief brief={clientEditorialBrief({...source, ...{internalNotes:"SECRET", pillar:"STRATEGY", aiModel:"MODEL"}})} caption="Caption" />);
 for(const text of Object.values(source).filter(x=>!x.includes('2026'))) assert.ok(html.includes(text),text);
 assert.match(html,/target="_blank" rel="noopener noreferrer"/);assert.doesNotMatch(html,/SECRET|STRATEGY|MODEL/);
});
test("manual and old pautas omit missing fields, never reconstruct a factual summary", () => {
 assert.equal(renderToStaticMarkup(<EditorialBrief brief={null} />),"");
 const brief=clientEditorialBrief({description:"Manual text"})!;assert.equal(brief.sourceSummary,undefined);
 assert.equal(renderToStaticMarkup(<EditorialBrief brief={brief} caption="Manual text" />),"");
 assert.ok(!renderToStaticMarkup(<EditorialBrief brief={{concept:"Available"}} />).includes("Fonte da notícia"));
});
test("text duplicates are shown once, HTML is escaped and unsafe source URLs cannot be links", () => {
 const html=renderToStaticMarkup(<EditorialBrief brief={{concept:"Same",description:"Same",sourceSummary:"<script>danger()</script>",sourceUrl:"javascript:danger()"}} caption="Same" />);
 assert.doesNotMatch(html,/Same|href=|<script>/);assert.match(html,/&lt;script&gt;/);
});
test("publication dates preserve date precision and reject invalid dates", () => {
 assert.equal(sourcePublicationDate("2026-02-30"),null);assert.equal(sourcePublicationDate(null),null);
 assert.equal(sourcePublicationDate("2026-10-14","en-US"),"Oct 14, 2026");
});

test("approval history renders the frozen version instead of today's edited briefing",async()=>{
 const {ApprovalBriefSnapshot}=await import("../src/EditorialBrief");
 const snapshot=JSON.stringify({editorialBrief:{concept:"Original reviewed direction",sourceSummary:"Original source context"},caption:"Original caption"});
 const html=renderToStaticMarkup(<ApprovalBriefSnapshot snapshot={snapshot} />);
 assert.match(html,/Original reviewed direction/);assert.match(html,/Original source context/);assert.equal(renderToStaticMarkup(<ApprovalBriefSnapshot snapshot="invalid" />),"");
});
