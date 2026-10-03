import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
test("proposal workspace persistence and existing commercial flows", async (t) => {
 const dom = new JSDOM('<body><div id="root"></div></body>', { url: "http://localhost" });
 const saved = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, CustomEvent: globalThis.CustomEvent, localStorage: globalThis.localStorage, IntersectionObserver: globalThis.IntersectionObserver };
 Object.assign(globalThis, { window: dom.window, CustomEvent: dom.window.CustomEvent, document: dom.window.document, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true, IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} } });
 const server = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false } });
 let root = createRoot(document.getElementById("root")!);
 const calls: Array<{ method: string; body: any }> = []; let records: any[] = []; let fail = false; let hold: (() => void) | undefined; let delay = false;
 globalThis.fetch = async (_url, init) => {
  const method = init?.method || "GET", body = init?.body ? JSON.parse(String(init.body)) : null; calls.push({ method, body });
  if (method === "GET") return new Response(JSON.stringify({ items: records }));
  if (fail) return new Response(JSON.stringify({ message: "Falha simulada" }), { status: 500 });
  if (method === "PATCH" && delay) { delay = false; await new Promise<void>((resolve) => { hold = resolve; }); }
  return new Response(JSON.stringify({ proposal: { ...body, id: method === "POST" ? "new-1" : "existing", token: "local-token" } }));
 };
 const flush = async (ms = 15) => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); }); };
 const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === label)!;
 const change = async (label: string, value: string) => {
  const input = [...document.querySelectorAll<HTMLLabelElement>("label")].find((item) => item.textContent?.startsWith(label))!.querySelector<HTMLInputElement>("input,textarea")!;
  await act(async () => { input.value = value; Simulate.change(input); });
 };
 try {
  const { ProposalsWorkspace, emptyProposal } = await server.ssrLoadModule("/src/ProposalsWorkspace.tsx");
  const render = async (signal = 0) => { await act(async () => root.render(<React.StrictMode><ProposalsWorkspace brandLogo="local-logo" newProposalSignal={signal} /></React.StrictMode>)); await flush(); };
  const remount = async () => { await act(async () => root.unmount()); root = createRoot(document.getElementById("root")!); await render(); };
  await t.test("StrictMode and repeated opening only GET; blank local editor never joins history", async () => {
   await render(); await remount(); assert.ok(document.querySelector(".proposal-editor")); assert.equal(calls.filter((c) => c.method !== "GET").length, 0); assert.equal(document.querySelectorAll(".proposal-library>button").length, 0);
  });
  await t.test("typing a new proposal does not autosave or create", async () => {
   await change("Nome do cliente", "Cliente Exemplo"); await change("Escopo do projeto", "Conteúdo mensal"); await flush(550); assert.equal(calls.filter((c) => c.method !== "GET").length, 0);
  });
  await t.test("unsaved confirmation protects a draft; new proposal clears locally without POST", async () => {
   dom.window.confirm = () => false; await render(1); assert.equal(document.querySelector<HTMLInputElement>("input")!.value, "Cliente Exemplo"); dom.window.confirm = () => true; await render(2); assert.equal(document.querySelector<HTMLInputElement>("input")!.value, ""); assert.equal(calls.filter((c) => c.method === "POST").length, 0);
  });
  await t.test("explicit double-click save creates one draft preserving fields and services", async () => {
   await change("Nome do cliente", "Cliente Exemplo"); await change("Plano", "Plano editorial"); await change("Escopo do projeto", "Conteúdo mensal"); await change("Serviço", "Design"); await change("Valor", "1250");
   await act(async () => { button("Salvar rascunho").click(); button("Salvar rascunho").click(); }); await flush();
   const posts = calls.filter((c) => c.method === "POST"); assert.equal(posts.length, 1); assert.equal(posts[0].body.status, "draft"); assert.equal(posts[0].body.scope, "Conteúdo mensal"); assert.equal(posts[0].body.services[0].value, 1250); assert.equal(document.querySelectorAll(".proposal-library>button").length, 1);
  });
  await t.test("failed creation retains local data and does not join history", async () => {
   await render(3); await change("Nome do cliente", "Não perder"); fail = true; await act(async () => button("Salvar rascunho").click()); await flush(); assert.equal(document.querySelector<HTMLInputElement>("input")!.value, "Não perder"); assert.match(document.querySelector('[role="status"]')!.textContent!, /Falha simulada/); assert.equal(document.querySelectorAll(".proposal-library>button").length, 1); fail = false;
  });
  await t.test("send unsaved proposal uses one POST, sent status, seven-day validity and preview", async () => {
   const before = calls.filter((c) => c.method === "POST").length; await act(async () => button("Enviar proposta").click()); await flush(); const posts = calls.filter((c) => c.method === "POST"); assert.equal(posts.length, before + 1); assert.equal(posts.at(-1)!.body.status, "sent"); assert.equal(posts.at(-1)!.body.clientName, "Não perder"); assert.ok(Math.abs(new Date(posts.at(-1)!.body.expiresAt).getTime() - Date.now() - 7 * 86400000) < 3000); assert.ok(document.querySelector(".proposal-preview-shell"));
  });
  await t.test("select existing is read-only; autosave retained; send wins over in-flight autosave", async () => {
   records = [{ ...emptyProposal(), id: "existing", token: "existing-token", clientName: "Cliente salvo" }]; await remount(); const before = calls.length; await act(async () => (document.querySelector(".proposal-library>button") as HTMLButtonElement).click()); await flush(); assert.equal(calls.length, before);
   delay = true; await change("Escopo do projeto", "Escopo revisado"); await flush(550); assert.ok(hold); await act(async () => button("Enviar proposta").click()); await act(async () => hold!()); await flush(); const patches = calls.filter((c) => c.method === "PATCH"); assert.equal(patches.at(-1)!.body.status, "sent"); assert.equal(patches.at(-1)!.body.scope, "Escopo revisado"); assert.ok(document.querySelector(".proposal-preview-shell"));
  });
  await t.test("library shows all six real statuses, client, existing title, value and validity", async () => {
   records = ["draft", "sent", "viewed", "accepted", "refused", "expired"].map((status) => ({ ...emptyProposal(), id: status, status, clientName: "Estúdio Exemplo", plan: "Plano editorial", services: [{ name: "Design", value: 2300, description: "" }] })); await remount(); assert.equal(document.querySelectorAll(".proposal-library>button").length, 6); const text = document.querySelector(".proposal-library")!.textContent!; for (const label of ["Rascunho", "Enviada", "Visualizada", "Aceita", "Recusada", "Expirada", "Plano editorial", "2.300,00", "Válida até"]) assert.ok(text.includes(label));
  });
 } finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); Object.assign(globalThis, saved); }
});
