import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
test("Brand Brain AI manual UI: explicit calls, readonly analysis, previews, refinement and safe draft addition", async t => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost/" });
  const saved = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, localStorage: globalThis.localStorage, CustomEvent: globalThis.CustomEvent };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
  const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), server: { middlewareMode: true, hmr: false } });
  const { BrandBrainGenerateAction, BrandBrainAnalyzePanel } = await server.ssrLoadModule("/src/BrandBrainAiWorkspace.tsx");
  let root = createRoot(document.getElementById("root")!); const calls: { url: string; method: string; body: any }[] = []; const drafts: any[] = [];
  let fail = false, enabled = true;
  const idea = (id: string) => ({ temporaryId: id, title: `Ideia ${id}`, concept: "Conceito", hook: "Gancho", description: "Descrição", format: "carousel", pillar: "Observação", objective: "Educar", rationale: "Conecta ao pilar", cta: "Observe", contentSuggestion: "Legenda", alignmentScore: 92, basedOn: ["Pilar Observação"] });
  globalThis.fetch = async (input, init) => {
    const url = String(input), method = init?.method || "GET", body = init?.body ? JSON.parse(String(init.body)) : null; calls.push({ url, method, body });
    const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
    if (url === "/api/clients") return response({ items: [{ id: "client-a", slug: "kynagogi", name: "Kynagogi" }] });
    if (url.endsWith("/brand-brain-ai/context")) return response({ enabled, reason: enabled ? null : "O Brand Brain AI está desativado.", completion: 10, contextHash: "hash", contextVersion: "compact-v1" });
    if (fail) return response({ message: "Falha simulada" }, 503);
    if (url.endsWith("/generate")) return response({ ideas: [idea("one"), idea("two"), idea("three")] });
    if (url.endsWith("/refine")) return response({ ...body.idea, title: "Ideia refinada" });
    if (url.endsWith("/analyze")) return response({ alignmentScore: 92, approvalPrediction: "high", mainPillar: "Observação", tone: "aligned", toneReason: "Tom humano", audienceFit: "Tutores", strengths: ["Clara"], warnings: ["Revisar gancho"], recommendation: "Observar contexto", basedOn: ["Pilar Observação"] });
    if (url.endsWith("/pauta-ideas")) { if (!drafts.some(i => i.id === body.idea.id)) drafts.push(body.idea); return response({ ok: true, idea: drafts.find(i => i.id === body.idea.id) }); }
    throw Error(`Unexpected ${url}`);
  };
  const flush = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); }); };
  const mount = async (analyze = false, title = "Título original") => { await act(async () => root.unmount()); root = createRoot(document.getElementById("root")!); await act(async () => root.render(analyze ? <BrandBrainAnalyzePanel slug="kynagogi" pauta={{ title, description: "Descrição original" }} /> : <BrandBrainGenerateAction slug="kynagogi" onAdded={(draft: any) => { assert.equal(draft.status, "draft"); }} />)); await flush(); };
  const buttons = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].filter(b => b.textContent?.trim() === label || b.getAttribute("aria-label") === label);
  const click = async (label: string) => { assert.ok(buttons(label)[0], label); await act(async () => buttons(label)[0].click()); await flush(); };
  const text = () => document.body.textContent!;
  try {
    await t.test("loading Pautas or opening generator performs no AI request", async () => { await mount(); assert.equal(calls.filter(c => c.method === "POST").length, 0); await click("✦ Gerar com Brand Brain"); assert.equal(calls.filter(c => c.method === "POST").length, 0); assert.match(text(), /10% preenchido/); assert.match(text(), /poucas informações/); assert.ok(document.querySelector('[role="dialog"]')); });
    await t.test("generate sends explicit form and displays only preview cards", async () => { await act(async () => document.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))); await flush(); assert.equal(document.querySelectorAll(".bb-ai-idea").length, 3); const call = calls.find(c => c.url.endsWith("/generate"))!; assert.deepEqual(call.body, { objective: "education", quantity: 3, format: "free", topic: "", notes: "" }); assert.equal(drafts.length, 0); assert.match(text(), /Conceito|Conecta ao pilar|Baseado em/); });
    await t.test("refine is explicit, preserves preview identity, saves nothing", async () => { await click("Refinar"); await click("Refinar ideia"); assert.match(text(), /Ideia refinada/); assert.equal(calls.filter(c => c.url.endsWith("/refine")).length, 1); assert.equal(drafts.length, 0); });
    await t.test("failed addition preserves preview, successful retry adds one draft without AI/cards/send", async () => { const aiCalls = calls.filter(c => /\/(generate|refine)$/.test(c.url)).length; fail = true; await click("Adicionar às pautas"); assert.match(text(), /Falha simulada/); assert.equal(drafts.length, 0); fail = false; const button = buttons("Adicionar às pautas")[0]; await act(async () => { button.click(); button.click(); }); await flush(); assert.equal(drafts.length, 1); assert.equal(drafts[0].createdBy, "ai_brand_brain"); assert.equal(drafts[0].id, "one"); assert.equal(drafts[0].caption, "Legenda"); assert.equal(drafts[0].rationale, "Conecta ao pilar"); assert.equal(drafts[0].status, "draft"); assert.equal(drafts[0].cardId, undefined); assert.equal(calls.filter(c => /\/(generate|refine)$/.test(c.url)).length, aiCalls); assert.ok(buttons("✓ Adicionada")[0].disabled); assert.ok(calls.every(c => !/cards|send|publish|openai\.com/.test(c.url))); });
    await t.test("multi-selection adds remaining previews, no repeated AI", async () => { const checks = [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].filter(c => !c.disabled); await act(async () => checks.forEach(c => c.click())); await flush(); await click("Adicionar selecionadas"); assert.equal(drafts.length, 3); assert.equal(new Set(drafts.map(i => i.id)).size, 3); await click("Fechar geração"); assert.equal(document.body.style.overflow, ""); });
    await t.test("analysis only on click, readonly and clearly an estimate", async () => { await mount(true); const before = calls.filter(c => c.url.endsWith("/analyze")).length; assert.equal(document.querySelector(".bb-ai-result"), null); await click("✦ Analisar com Brand Brain"); assert.equal(calls.filter(c => c.url.endsWith("/analyze")).length, before + 1); assert.match(text(), /92% de alinhamento/); assert.match(text(), /Estimativa Alta/); assert.match(text(), /Não garante aprovação/); assert.match(text(), /Revisar gancho/); assert.equal(document.querySelectorAll(".bb-ai-result input,.bb-ai-result textarea").length, 0); assert.equal(calls.filter(c => c.url.endsWith("/analyze")).at(-1)!.body.title, "Título original"); });
    await t.test("disabled service keeps rest of UI operational and makes no AI call", async () => { enabled = false; await mount(); await click("✦ Gerar com Brand Brain"); assert.match(text(), /desativado/); assert.ok(buttons("Gerar ideias")[0].disabled); await click("Fechar geração"); });
  } finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); Object.assign(globalThis, saved); }
});
test("AI preview title never auto-links cards; manual addition uses existing endpoint", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8"); assert.equal((app.match(/idea\.createdBy === "ai_brand_brain"\) \? undefined/g) || []).length, 2); assert.match(app, /brain-check.*Brand Brain/);
  const ui = readFileSync(new URL("../src/BrandBrainAiWorkspace.tsx", import.meta.url), "utf8"); assert.doesNotMatch(ui, /createAdminCard|send.*Client|api\.openai|OPENAI_API_KEY/); assert.match(ui, /createAdminPautaIdeaBySlug\(slug, draft\)/);
});
