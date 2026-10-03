import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { JSDOM } from "jsdom";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateBillingStatistics } from "../src/billingStatistics";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("financial summary and both actions are integrated into one billing banner", async () => {
  const server = await createServer({ root, server: { middlewareMode: true, hmr: false } });
  try {
    const { BillingPageHeader } = await server.ssrLoadModule("/src/BillingPageHeader.tsx");
    const totals = calculateBillingStatistics([
      { status: "paid", currency: "BRL", lines: [{ quantity: 1, unitPrice: 14500 }] },
      { status: "open", currency: "EUR", lines: [{ quantity: 1, unitPrice: 2020.94 }] },
      { status: "cancelled", currency: "BRL", lines: [{ quantity: 1, unitPrice: 2900 }] },
    ]);
    const markup = renderToStaticMarkup(<BillingPageHeader totals={totals} onCreate={() => {}} onSettings={() => {}} settingsOpen={false} />);
    const dom = new JSDOM(markup);
    const header = dom.window.document.querySelector("header")!;
    assert.equal(header.querySelector("h1")?.textContent, "Faturamento");
    assert.equal(header.querySelectorAll(".billing-summary-metric").length, 4);
    assert.equal(header.querySelectorAll(".billing-summary-metric strong").length, 12);
    assert.match(header.textContent!, /14\.500,00/);
    assert.match(header.textContent!, /2\.020,94/);
    assert.doesNotMatch(header.textContent!, /17\.400,00/);
    assert.equal(header.querySelectorAll("button").length, 2);
    assert.equal(header.querySelector('[aria-haspopup="dialog"]')?.textContent, "Ajustes do faturamento");
    dom.window.close();
  } finally { await server.close(); }
});

test("drawer closes by X, backdrop and Escape, restores focus and preserves form state", async () => {
  const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', { url: "http://localhost" });
  const saved = { window: globalThis.window, document: globalThis.document, HTMLElement: globalThis.HTMLElement };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  const server = await createServer({ root, server: { middlewareMode: true, hmr: false } });
  const reactRoot = createRoot(document.getElementById("root")!);
  try {
    const { BillingSettingsDrawer } = await server.ssrLoadModule("/src/BillingSettingsDrawer.tsx");
    function Harness() {
      const [open, setOpen] = React.useState(false);
      const close = React.useCallback(() => setOpen(false), []);
      return <><button id="trigger" onClick={() => setOpen(true)}>Ajustes</button><BillingSettingsDrawer open={open} onClose={close}><input aria-label="Rascunho" defaultValue="inicial" /></BillingSettingsDrawer></>;
    }
    await act(async () => reactRoot.render(<Harness />));
    const trigger = document.getElementById("trigger") as HTMLButtonElement;
    const openDrawer = async () => { trigger.focus(); await act(async () => trigger.click()); };
    await openDrawer();
    assert.equal(document.querySelector('[role="dialog"]')?.getAttribute("aria-modal"), "true");
    assert.equal(document.activeElement?.getAttribute("aria-label"), "Fechar ajustes do faturamento");
    assert.equal(document.body.style.overflow, "hidden");
    const input = document.querySelector("input")!;
    input.value = "rascunho preservado";
    await act(async () => (document.querySelector('[aria-label="Fechar ajustes do faturamento"]') as HTMLButtonElement).click());
    assert.equal((document.querySelector(".billing-settings-backdrop") as HTMLElement).hidden, true);
    assert.equal(document.activeElement, trigger);
    assert.equal(document.body.style.overflow, "");
    await openDrawer();
    assert.equal(document.querySelector("input")!.value, "rascunho preservado");
    await act(async () => document.querySelector(".billing-settings-backdrop")!.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true })));
    assert.equal((document.querySelector(".billing-settings-backdrop") as HTMLElement).hidden, true);
    await openDrawer();
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    assert.equal((document.querySelector(".billing-settings-backdrop") as HTMLElement).hidden, true);
    assert.equal(document.activeElement, trigger);
  } finally {
    await act(async () => reactRoot.unmount());
    await server.close();
    dom.window.close();
    Object.assign(globalThis, saved);
  }
});
