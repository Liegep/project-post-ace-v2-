import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("Radar human review: pending-only widget, on-demand detail, decisions, errors and persisted sessions", async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost/#/dashboard" });
  const saved = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, localStorage: globalThis.localStorage, CustomEvent: globalThis.CustomEvent };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
  const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), server: { middlewareMode: true, hmr: false } });
  const { RadarSuggestionsWidget } = await server.ssrLoadModule("/src/RadarSuggestionsWidget.tsx");
  let root = createRoot(document.getElementById("root")!);
  const all: any[] = []; const calls: Array<{ method: string; url: string }> = [];
  let failure = false, detailFailure = false, allowed = ["client-a", "client-b"];
  let releaseDecision: (() => void) | null = null;
  globalThis.fetch = async (input, init) => {
    const url = String(input); const method = init?.method ?? "GET"; calls.push({ url, method });
    const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
    const pending = all.filter((item) => item.status === "pending" && allowed.includes(item.clientAccountId));
    if (url.startsWith("/api/radar-suggestions")) {
      const params = new URL(url, "http://localhost").searchParams; const offset = Number(params.get("offset"));
      const summaries = pending.slice(offset, offset + 3).map(({ concept, hook, description, objective, rationale, cta, captionSuggestion, sourceUrl, radarName, basedOn, ...item }) => item);
      return response({ items: summaries, total: pending.length, hasMore: offset + 3 < pending.length, offset, limit: 3 });
    }
    const match = url.match(/\/clients\/([^/]+)\/radar-suggestions\/([^/]+)(?:\/(accept|dismiss))?$/);
    if (!match) throw new Error(`Unexpected API: ${url}`);
    const item = all.find((item) => item.clientAccountId === match[1] && item.id === match[2]);
    if (!item || !allowed.includes(item.clientAccountId)) return response({ message: "Sem acesso" }, 403);
    if (method === "GET") return detailFailure ? response({ message: "Detalhe indisponível" }, 503) : response({ suggestion: item });
    if (failure) return response({ message: "Não foi possível salvar" }, 503);
    if (releaseDecision) await new Promise<void>((resolve) => { releaseDecision = resolve; });
    item.status = match[3] === "accept" ? "accepted" : "dismissed";
    return response({ status: item.status, created: match[3] === "accept", pauta: match[3] === "accept" ? { id: `pauta-${item.id}`, status: "draft" } : undefined });
  };
  const fill = (count = 1) => { all.length = 0; for (let i = 0; i < count; i++) all.push({ id: `suggestion-${i}`, clientAccountId: i % 2 ? "client-b" : "client-a", clientName: i % 2 ? "Cliente B" : "Cliente A", title: `Sugestão ${i}`, status: "pending", contentType: "Carrossel", pillar: i ? null : "Observação", alignmentScore: i ? null : 92, sourceTitle: "Estudo recente", sourceDate: "2026-10-07", createdAt: "2026-10-07T10:00:00Z", concept: "Conceito específico", hook: "Gancho", description: "Descrição completa", objective: "Educar", rationale: "Por que combina", cta: "Saiba mais", captionSuggestion: "Legenda sugerida", sourceUrl: "https://example.org/study", radarName: "Estudos", basedOn: ["Pilar Observação", "Tom humano", "Público tutores"] }); };
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); }); };
  const mount = async () => { await act(async () => root.unmount()); root = createRoot(document.getElementById("root")!); await act(async () => root.render(<React.StrictMode><RadarSuggestionsWidget /></React.StrictMode>)); await flush(); };
  const buttons = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].filter((button) => button.textContent?.trim() === label || button.getAttribute("aria-label") === label);
  const click = async (label: string) => { assert.ok(buttons(label)[0], label); await act(async () => buttons(label)[0].click()); await flush(); };
  const text = () => document.body.textContent!;
  try {
    await t.test("no pending suggestions means no permanent empty widget", async () => { await mount(); assert.equal(document.querySelector(".radar-suggestions-widget"), null); });
    await t.test("summaries identify client, count, available metadata; no detail request on dashboard", async () => { fill(2); calls.length = 0; await mount(); assert.match(text(), /2 novas sugestões/); assert.match(text(), /Cliente A/); assert.match(text(), /Cliente B/); assert.match(text(), /92%/); assert.doesNotMatch(text(), /Conceito específico/); assert.equal(calls.filter((call) => /clients/.test(call.url)).length, 0); });
    await t.test("Ler mais requests correct client/id and renders complete nontechnical evidence", async () => { await click("Ler mais"); assert.ok(document.querySelector('[role="dialog"]')); assert.match(text(), /Conceito específico/); assert.match(text(), /Legenda sugerida/); assert.match(text(), /Baseado em: Pilar Observação · Tom humano · Público tutores/); assert.ok(calls.some((call) => call.url === "/api/clients/client-a/radar-suggestions/suggestion-0")); assert.equal(document.querySelector('.radar-review-source a')!.getAttribute("href"), "https://example.org/study"); await click("Fechar sugestão"); assert.equal(document.body.style.overflow, ""); });
    await t.test("detail failure leaves summary visible and drawer closable", async () => { detailFailure = true; await click("Ler mais"); assert.match(text(), /Detalhe indisponível/); assert.equal(document.querySelectorAll(".radar-suggestions-list article").length, 2); await click("Fechar sugestão"); detailFailure = false; });
    await t.test("acceptance failure keeps item and shows an error; no optimistic removal", async () => { failure = true; await click("Adicionar ao banco"); assert.equal(all[0].status, "pending"); assert.equal(document.querySelectorAll(".radar-suggestions-list article").length, 2); assert.match(text(), /Não foi possível salvar/); failure = false; });
    await t.test("double-click issues one decision request and updates only after server confirmation", async () => { calls.length = 0; releaseDecision = () => {}; const button = buttons("Adicionar ao banco")[0]; await act(async () => { button.click(); button.click(); }); await flush(); assert.equal(calls.filter((call) => call.method === "POST").length, 1); assert.equal(document.querySelectorAll(".radar-suggestions-list article").length, 2); const release = releaseDecision; releaseDecision = null; await act(async () => release!()); await flush(); assert.equal(all[0].status, "accepted"); assert.equal(document.querySelectorAll(".radar-suggestions-list article").length, 1); });
    await t.test("reload/remount does not bring back accepted suggestions", async () => { await mount(); assert.equal(document.querySelectorAll(".radar-suggestions-list article").length, 1); assert.doesNotMatch(text(), /Sugestão 0/); });
    await t.test("dismissal failure keeps item; successful dismissal hides widget when all resolved", async () => { failure = true; await click("Descartar"); assert.ok(document.querySelector(".radar-suggestions-widget")); assert.equal(all[1].status, "pending"); failure = false; await click("Descartar"); assert.equal(all[1].status, "dismissed"); assert.equal(document.querySelector(".radar-suggestions-widget"), null); await mount(); assert.equal(document.querySelector(".radar-suggestions-widget"), null); });
    await t.test("new session displays only authorized pending clients", async () => { fill(2); allowed = ["client-b"]; await mount(); assert.doesNotMatch(text(), /Cliente A/); assert.match(text(), /Cliente B/); assert.equal(document.querySelectorAll(".radar-suggestions-list article").length, 1); allowed = ["client-a", "client-b"]; });
    await t.test("more suggestions are paginated without loading full content", async () => { fill(4); await mount(); assert.equal(document.querySelectorAll(".radar-suggestions-list article").length, 3); assert.match(text(), /4 novas sugestões/); await click("Ver mais sugestões"); assert.equal(document.querySelectorAll(".radar-suggestions-list article").length, 4); assert.equal(buttons("Ver mais sugestões").length, 0); });
    assert.ok(calls.every((call) => !/openai|brand-brain-ai|cards|send|publish/i.test(call.url)));
  } finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); Object.assign(globalThis, saved); }
});
