import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("pauta menu confirms withdrawal, survives remount and explicitly resends the same card", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost/" });
  const saved = {window:globalThis.window, document:globalThis.document, localStorage:globalThis.localStorage, fetch:globalThis.fetch,CustomEvent:globalThis.CustomEvent};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
  const vite = await createServer({root:fileURLToPath(new URL("..",import.meta.url)),server:{middlewareMode:true,hmr:false}});
  let root = createRoot(document.getElementById("root")!);
  const card = {id:"card",title:"Pauta preservada",mediaUrls:["/photo.png"],status:["Enviar para Cliente"],tags:["Etiqueta"],clientLabel:"Pauta para aprovação",isBriefApproval:true,approvalRevision:0,briefWithdrawnAt:null as string|null};
  const calls: string[] = []; let confirmed = false;
  window.confirm = text => {assert.equal(text,"Esta pauta deixará de aparecer para o cliente, mas continuará salva no seu banco de pautas. Deseja continuar?");return confirmed;};
  globalThis.fetch = async (input,init) => {
    const url=String(input);const method=init?.method??"GET"; calls.push(`${method} ${url}`);
    let data:unknown;
    if(url==="/api/clients") data={items:[{id:"client",name:"Cliente",slug:"a"}]};
    else if(url.endsWith("/workspace-drawer")) data={data:{pautaIdeas:[{id:"idea",title:card.title,description:"Descrição",caption:"Texto",cardId:"card",status:"sent",createdAt:"2026-10-28"}]}};
    else if(url.endsWith("/board")) data={client:{name:"Cliente",slug:"a"},board:{columns:[],withoutColumn:{cards:[card]}}};
    else if(url.endsWith("/brand-brain")) data={data:{}};
    else if(url.includes("/brief-delivery/")) {
      assert.equal(method,"POST");assert.equal(JSON.parse(String(init?.body)).expectedApprovalRevision,card.approvalRevision);
      card.approvalRevision++;card.briefWithdrawnAt=url.endsWith("/withdraw")?"2026-10-28T10:00:00Z":null;data={card};
    } else throw Error(`Unexpected request ${method} ${url}`);
    return new Response(JSON.stringify(data),{headers:{"content-type":"application/json"}});
  };
  const flush=async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,40));});};
  const click=async(label:string)=>{const button=[...document.querySelectorAll("button")].find(b=>b.textContent===label);assert.ok(button,label);await act(async()=>button.click());await flush();};
  try {
    const {PautasWorkspace}=await vite.ssrLoadModule("/src/App.tsx");
    const mount=async()=>{await act(async()=>root.render(<PautasWorkspace slug="a" clientName="Cliente" columns={[]} onSent={()=>{}}/>));await flush();};
    await mount();
    await click("Retirar do cliente");assert.equal(card.briefWithdrawnAt,null);
    confirmed=true;await click("Retirar do cliente");assert.match(document.body.textContent!,/Retirada do cliente/);assert.match(document.body.textContent!,/Pauta preservada/);
    await act(async()=>root.unmount());root=createRoot(document.getElementById("root")!);await mount();
    assert.match(document.body.textContent!,/Retirada do cliente/);await click("Reenviar");assert.equal(card.briefWithdrawnAt,null);
    assert.equal(calls.filter(c=>c.includes("brief-delivery/withdraw")).length,1);assert.equal(calls.filter(c=>c.includes("brief-delivery/resend")).length,1);
    assert.ok(!calls.some(c=>/DELETE|PATCH|PUT/.test(c)));
  } finally {await act(async()=>root.unmount());await vite.close();dom.window.close();Object.assign(globalThis,saved);}
});
