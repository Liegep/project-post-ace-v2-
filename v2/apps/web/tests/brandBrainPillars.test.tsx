import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { normalizeBrandBrainPillar, normalizeBrandBrainPillars, parseBrandBrainPillars, formatBrandBrainPillars } from "../../../shared/brand-brain-pillars.mjs";

test("canonical and legacy pillars preserve editorial weights without rescaling", () => {
  for (const input of ["Nome | Foco | 30", "Nome | Foco | 30%", "Nome | Foco — 30%", "Nome | Foco - 30%", "Nome | Foco 30%"])
    assert.deepEqual(parseBrandBrainPillars(input), [{ name: "Nome", focus: "Foco", weight: 30 }]);
  const legacy = Object.freeze({ name: "Nome", focus: "Foco importante — 30%", weight: 0 });
  assert.deepEqual(normalizeBrandBrainPillar(legacy), { name: "Nome", focus: "Foco importante", weight: 30 });
  assert.equal(legacy.focus, "Foco importante — 30%");
  assert.deepEqual(normalizeBrandBrainPillar({ ...legacy, weight: 25 }), { name: "Nome", focus: legacy.focus, weight: 25 });
  for (const focus of ["Ensinar 30 direitos", "Foco 30", "Crescimento de 30% no ano", "Foco30%", "ISO-30%"])
    assert.deepEqual(normalizeBrandBrainPillar({ name: "Nome", focus, weight: 0 }), { name: "Nome", focus, weight: 0 });
  assert.equal(parseBrandBrainPillars("Nome | Foco | 120%")[0].weight, 100);
  assert.equal(parseBrandBrainPillars("Nome | Foco | -20")[0].weight, 0);
  assert.equal(normalizeBrandBrainPillar({ focus: "Foco — -20%", weight: 0 }).weight, 0);
  assert.equal(normalizeBrandBrainPillar({ focus: "Foco -20%", weight: 0 }).weight, 0);
  assert.equal(normalizeBrandBrainPillar({ focus: "Foco — 120%", weight: 0 }).weight, 100);
  assert.equal(normalizeBrandBrainPillar({ focus: "Foco", weight: -20 }).weight, 0);
  assert.equal(normalizeBrandBrainPillar({ focus: "Foco", weight: Infinity }).weight, 0);
  assert.equal(parseBrandBrainPillars("Nome | Foco | 12,5%")[0].weight, 12.5);
  const pillars = normalizeBrandBrainPillars([legacy, { name: "Outro", focus: "Foco", weight: 25 }]);
  assert.deepEqual(pillars.map(p => p.weight), [30, 25]);
  assert.equal(formatBrandBrainPillars([legacy]), "Nome | Foco importante | 30");
  assert.deepEqual(normalizeBrandBrainPillars(null), []);
});

test("both editors and admin/portal recover overview, canonical textarea and save only explicitly", async t => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost/" });
  const saved = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, localStorage: globalThis.localStorage, CustomEvent: globalThis.CustomEvent };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
  const server = await createServer({ root: fileURLToPath(new URL("..", import.meta.url)), server: { middlewareMode: true, hmr: false } });
  let root = createRoot(document.getElementById("root")!);
  const original = { pillars: [{ name: "Educação Jurídica", focus: "Ensinar direitos com clareza — 30%", weight: 0 }, { name: "Prevenção", focus: "Orientar", weight: 25 }, { name: "Zero", focus: "Sem prioridade", weight: 0 }] };
  const before = JSON.stringify(original);
  const calls: { method: string; url: string; body: any }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input), method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    let data: unknown;
    if (url === "/api/clients") data = { items: [{ id: "client-a", slug: "patricia", name: "Patrícia" }] };
    else if (url === "/api/portal/accounts") data = { items: [{ clientAccountId: "client-a", clientSlug: "patricia" }] };
    else if (url === "/api/clients/client-a/brand-brain") data = method === "GET" ? { data: original, meta: { version: 1 }, revisions: [], history: [], comments: [] } : { ok: true, pending: false };
    else throw Error(`Unexpected request: ${url}`);
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  };
  const flush = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); }); };
  const click = async (label: string) => { const button = [...document.querySelectorAll("button")].find(b => b.textContent === label); assert.ok(button, label); await act(async () => button.click()); await flush(); };
  try {
    const { BrandBrainWorkspace, BrandBrainExperience } = await server.ssrLoadModule("/src/App.tsx");
    for (const mode of ["legacy", "admin", "portal"]) await t.test(mode, async () => {
      await act(async () => root.unmount()); root = createRoot(document.getElementById("root")!);
      calls.length = 0; localStorage.clear();
      await act(async () => root.render(mode === "legacy" ? <BrandBrainWorkspace slug="patricia" clientName="Patrícia" /> : <BrandBrainExperience slug="patricia" clientName="Patrícia" portal={mode === "portal"} />));
      await flush();
      const overview = document.querySelector(mode === "legacy" ? ".brand-pillars" : ".brand-v2-pillars-chart")!;
      assert.ok(overview); assert.match(overview.textContent!, /30%/); assert.match(overview.textContent!, /25%/);
      if (mode !== "legacy") {
        assert.doesNotMatch(overview.textContent!, /— 30%/);
        assert.equal(document.querySelector<HTMLElement>(".brand-v2-pillar-list em b")!.style.width, "30%");
        const segments = [...document.querySelectorAll<HTMLElement>(".brand-v2-segmented-bar i")];
        assert.equal(Number.parseFloat(segments[0].style.flex), 30); assert.equal(Number.parseFloat(segments[2].style.flex), 0);
      } else assert.equal(document.querySelector<HTMLElement>(".brand-pillar-bar i")!.style.width, "30%");
      await click(mode === "legacy" ? "Panorâmica" : "Conteúdo");
      const textarea = [...document.querySelectorAll<HTMLTextAreaElement>("textarea")].find(a => a.value.startsWith("Educação Jurídica |"))!;
      assert.ok(textarea); assert.equal(textarea.value.split("\n")[0], "Educação Jurídica | Ensinar direitos com clareza | 30");
      // Wait through autosave too: opening/normalizing must never publish or protect a spurious edit.
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)); });
      assert.ok(calls.every(c => c.method === "GET")); assert.equal(localStorage.length, 0); assert.equal(JSON.stringify(original), before);
      // Exercise the real React onChange with percent input and check the explicit save payload.
      const propsKey = Object.keys(textarea).find(k => k.startsWith("__reactProps$"))!;
      await act(async () => (textarea as any)[propsKey].onChange({ target: { value: "Educação Jurídica | Ensinar direitos | 30%" } }));
      assert.equal(textarea.value, "Educação Jurídica | Ensinar direitos | 30");
      await click(mode === "legacy" ? "Salvar" : mode === "portal" ? "Enviar sugestão" : "Publicar nova versão");
      const writes = calls.filter(c => c.method !== "GET"); assert.equal(writes.length, 1); assert.equal(writes[0].method, "PUT");
      assert.deepEqual(writes[0].body.data.pillars, [{ name: "Educação Jurídica", focus: "Ensinar direitos", weight: 30 }]);
      assert.equal(JSON.stringify(original), before);
    });
  } finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); Object.assign(globalThis, saved); }
});
