import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { ProposalPaymentText, ProposalPaymentBlock } from "../src/ProposalPaymentText";
test("payment text preserves amounts and paragraphs while displaying lists and bold headings", () => {
  const value =
    "50% upon acceptance: US$225.\n\n**Additional Terms**\n- USD only\n- **No source files**\n\nBalance: US$350.";
  const dom = new JSDOM(
    renderToStaticMarkup(<ProposalPaymentText value={value} />),
  );
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll("p").length, 2);
  assert.equal(doc.querySelector("h4")!.textContent, "Additional Terms");
  assert.equal(doc.querySelectorAll("li").length, 2);
  assert.equal(doc.querySelector("strong")!.textContent, "No source files");
  assert.ok(doc.body.textContent!.includes("US$225."));
  assert.ok(doc.body.textContent!.includes("US$350."));
  assert.equal(value.includes("**Additional Terms**"), true);
  dom.window.close();
});
test("payment text escapes HTML and hides empty content", () => {
  const html = renderToStaticMarkup(
    <ProposalPaymentText
      value={"<script>alert(1)</script>\n- <img src=x onerror=alert(1)>"}
    />,
  );
  const dom = new JSDOM(html);
  assert.equal(dom.window.document.querySelectorAll("script,img").length, 0);
  assert.ok(dom.window.document.body.textContent!.includes("<script>"));
  assert.equal(renderToStaticMarkup(<ProposalPaymentText value={"  "} />), "");
  dom.window.close();
});

test("payment disclosure starts compact and retains the full conditions",()=>{const value="50% upon acceptance.\n\nBalance: US$350.\n- Source files are excluded.";const dom=new JSDOM(renderToStaticMarkup(<ProposalPaymentBlock title="Payment schedule" value={value}/>));const details=dom.window.document.querySelector("details")!;assert.equal(details.open,false);assert.equal(details.querySelector("summary strong")!.textContent,"Payment schedule");assert.equal(details.querySelector("summary small")!.textContent,"50% upon acceptance.");assert.ok(details.querySelector(".proposal-payment-text")!.textContent!.includes("US$350"));assert.equal(details.querySelectorAll("li").length,1);dom.window.close();});
