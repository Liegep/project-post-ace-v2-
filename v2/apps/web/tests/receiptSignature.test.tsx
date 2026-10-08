import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { printWhenImagesReady } from "../src/printDocument";

test("shared internal/portal/PDF receipt document renders only its persisted signature", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const server = await createServer({ root, server: { middlewareMode: true, hmr: false } });
  try {
    const { BillingReceiptDocument } = await server.ssrLoadModule("/src/BillingWorkspace.tsx");
    const invoice = { locale: "pt", receiptSnapshot: { receiptNumber: "REC-2026-1", invoiceNumber: 1, clientName: "Cliente", currency: "BRL", paidAt: "2026-10-02", title: "Design", total: 100, lines: [] } };
    const unsigned = renderToStaticMarkup(React.createElement(BillingReceiptDocument, { invoice }));
    assert.doesNotMatch(unsigned, /receipt-signature/);
    const signed = renderToStaticMarkup(React.createElement(BillingReceiptDocument, { invoice: { ...invoice, receiptSnapshot: { ...invoice.receiptSnapshot, signatureUrl: "/api/uploads/aaaa.webp" } } }));
    assert.match(signed, /<footer><div><img class="receipt-signature" src="\/api\/uploads\/aaaa.webp"/);
    assert.match(signed, /Assinatura da emissora/);
    assert.match(signed, /LIEGE PASCHOALINI STUDIO/);
  } finally { await server.close(); }
});

test("PDF print waits for images and prints once", async () => {
  const listeners = new Map<string, () => void>();
  let prints = 0;
  const image = { complete: false, addEventListener: (event: string, listener: () => void) => listeners.set(event, listener) };
  const target = { document: { readyState: "complete", images: [image] }, closed: false, focus: () => {}, print: () => { prints++; } } as unknown as Window;
  const pending = printWhenImagesReady(target);
  await Promise.resolve();
  assert.equal(prints, 0);
  listeners.get("load")!();
  await pending;
  assert.equal(prints, 1);
});
