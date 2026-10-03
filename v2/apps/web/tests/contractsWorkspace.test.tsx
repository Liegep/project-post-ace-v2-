import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const webRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const record={id:"original",clientAccountId:"00000000-0000-4000-8000-000000000001",clientName:"Cliente",clientSlug:"cliente",title:"Contrato histórico",bodyHtml:"<p>Conteúdo original</p>",language:"Português",contractType:"Mensalidade",startDate:null,endDate:null,contractValue:"€ 500",scope:"Escopo",notes:"SEGREDO INTERNO",status:"accepted",createdAt:"2026-06-01",updatedAt:"2026-06-01",acceptedAt:"2026-06-26",acceptedByUserId:"historical"};
test("contract drafts, publication and client acceptance workflow",async(t)=>{
 const dom=new JSDOM('<body><div id="root"></div></body>',{url:"http://localhost"});
 const saved={window:globalThis.window,document:globalThis.document,DOMParser:globalThis.DOMParser,CustomEvent:globalThis.CustomEvent,fetch:globalThis.fetch,localStorage:globalThis.localStorage};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,DOMParser:dom.window.DOMParser,CustomEvent:dom.window.CustomEvent,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 Object.assign(dom.window.HTMLElement.prototype,{attachEvent(){},detachEvent(){}});
 const server=await createServer({root:webRoot,server:{middlewareMode:true,hmr:false}});let root=createRoot(document.getElementById("root")!);
 const calls:Array<{url:string;method:string;body:any}>=[];let fail=false;
 globalThis.fetch=async(url,init)=>{
  const method=init?.method||"GET",body=init?.body?JSON.parse(String(init.body)):null;calls.push({url:String(url),method,body});
  if(method==="GET") return new Response(JSON.stringify({items:String(url).includes("contract-templates")?[{id:"custom",name:"Modelo IT",bodyHtml:"<p>Modello</p>",language:"Italiano",description:"Original",draft:{contractType:"Mensalidade",contractValue:"€ 500"}}]:String(url).includes("contracts")?[record]:[{id:record.clientAccountId,name:"Cliente",slug:"cliente"}]}));
  if(fail) return new Response(JSON.stringify({message:"Resposta perdida"}),{status:500});
  if(String(url).includes("contract-templates")) return new Response(JSON.stringify({template:{...body,id:"saved-template"}}));
  return new Response(JSON.stringify({contract:{...record,...body,id:body.publicationId,status:"pending"}}));
 };
 const flush=async(ms=15)=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,ms));});};
 const button=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>("button")].find(item=>item.textContent===label)!;
 const field=(label:string)=>[...document.querySelectorAll<HTMLLabelElement>("label")].find(item=>item.textContent?.startsWith(label))!.querySelector<HTMLInputElement>("input,textarea,select")!;
 const change=async(label:string,value:string)=>{await act(async()=>{const element=field(label);element.value=value;Simulate.change(element);});};
 try {
  const {ContractsWorkspace,ContractDocumentPreview,ContractAcceptanceGate}=await server.ssrLoadModule("/src/ContractsWorkspace.tsx");
  const render=async(signal=1)=>{await act(async()=>root.render(<React.StrictMode><ContractsWorkspace newContractSignal={signal}/></React.StrictMode>));await flush();};
  const remount=async()=>{await act(async()=>root.unmount());root=createRoot(document.getElementById("root")!);await render();};
  await t.test("opening does not publish and never auto-selects a client",async()=>{await render();assert.equal(field("Enviar para o cliente").value,"");assert.equal(calls.filter(item=>item.method!=="GET").length,0);assert.equal(button("Publicar contrato").disabled,true);});
  await t.test("Save draft protects local text without publishing and recovery survives initial new signal",async()=>{await change("Título do contrato","Rascunho local");await act(async()=>{const editor=document.querySelector<HTMLElement>(".contract-rich-editor")!;editor.innerHTML="<p>Texto personalizado</p>";Simulate.input(editor);});await act(async()=>button("Salvar rascunho").click());assert.equal(calls.filter(item=>item.method!=="GET").length,0);assert.match(document.body.textContent!,/Não foi publicado/);await remount();assert.equal(field("Título do contrato").value,"Rascunho local");assert.match(document.querySelector(".contract-rich-editor")!.innerHTML,/Texto personalizado/);assert.equal(button("Publicar contrato").disabled,true);});
  await t.test("dirty model switch can be cancelled; API type/value load without losing defaults",async()=>{await change("Título do contrato","Rascunho local alterado");dom.window.confirm=()=>false;await change("Usar um modelo pronto","custom");assert.equal(field("Título do contrato").value,"Rascunho local alterado");assert.equal(field("Usar um modelo pronto").value,"");dom.window.confirm=()=>true;await change("Usar um modelo pronto","custom");assert.equal(field("Tipo").value,"Mensalidade");assert.equal(field("Valor contratado").value,"€ 500");assert.equal(field("Início").value,"");assert.equal(field("Enviar para o cliente").value,"");});
  await t.test("saving a template normalizes empty dates and sends compatible type/value names",async()=>{await act(async()=>button("＋ Salvar formulário como modelo").click());await change("Nome do modelo","Modelo novo");await act(async()=>button("Salvar modelo").click());await flush();const post=calls.find(item=>item.method==="POST"&&item.url.includes("contract-templates"))!;assert.equal(post.body.draft.startDate,null);assert.equal(post.body.draft.endDate,null);assert.equal(post.body.draft.contractType,"Mensalidade");assert.equal(post.body.draft.contractValue,"€ 500");assert.equal("type" in post.body.draft,false);});
  await t.test("publication requires explicit client and double-click publishes just one document",async()=>{assert.equal(button("Publicar contrato").disabled,true);await change("Enviar para o cliente","cliente");await act(async()=>{button("Publicar contrato").click();button("Publicar contrato").click();});await flush();const posts=calls.filter(item=>item.method==="POST"&&!item.url.includes("contract-templates"));assert.equal(posts.length,1);assert.equal(posts[0].body.clientAccountId,record.clientAccountId);assert.equal(posts[0].body.status,"pending");assert.match(posts[0].body.publicationId,/^[a-f0-9-]{36}$/);assert.equal(button("Publicar contrato").disabled,true);});
  await t.test("failed publication retains text and retries the same publication ID",async()=>{await change("Título do contrato","Nova versão");fail=true;await act(async()=>button("Publicar contrato").click());await flush();const failed=calls.at(-1)!;assert.equal(field("Título do contrato").value,"Nova versão");fail=false;await act(async()=>button("Publicar contrato").click());await flush();assert.equal(calls.at(-1)!.body.publicationId,failed.body.publicationId);});
  await t.test("storage failure prevents publishing an unprotected draft",async()=>{
   await change("Título do contrato","Proteger antes de publicar");const original=dom.window.Storage.prototype.setItem;const before=calls.length;
   dom.window.Storage.prototype.setItem=()=>{throw new Error("Storage indisponível");};
   try {await act(async()=>button("Publicar contrato").click());await flush();assert.equal(calls.length,before);assert.match(document.body.textContent!,/Não foi possível proteger/);assert.equal(field("Título do contrato").value,"Proteger antes de publicar");}
   finally {dom.window.Storage.prototype.setItem=original;}
  });
  await t.test("new version copies accepted terms locally without modifying its original or acceptance",async()=>{dom.window.confirm=()=>true;const before=calls.length;await act(async()=>([...document.querySelectorAll<HTMLElement>(".contracts-library-record")].find(item=>item.querySelector("strong")?.textContent===record.title)!.querySelector("button") as HTMLButtonElement).click());assert.equal(calls.length,before);assert.equal(field("Título do contrato").value,record.title);assert.match(document.body.textContent!,/original e seu aceite serão preservados/);assert.equal(calls.some(item=>item.method==="PATCH"||item.method==="DELETE"),false);assert.equal(record.acceptedByUserId,"historical");assert.equal(field("Enviar para o cliente").value,"");assert.equal(button("Publicar contrato").disabled,true);});
  await t.test("new acceptance controls use existing portal languages",async()=>{
   const {portalText}=await server.ssrLoadModule("/src/portalI18n.ts");
   for(const locale of ["en","es","it","sv"])for(const label of ["Contrato pendente de aceite","Verificando contratos pendentes…","Sair da conta","Verificar novamente","Registrando aceite…"])assert.notEqual(portalText(locale,label),label);
  });
  await t.test("client document never includes internal notes with or without rich body",()=>{for(const bodyHtml of ["","<p>Texto público</p>"]){const html=renderToStaticMarkup(<ContractDocumentPreview contract={{title:"Título",client:"Cliente",bodyHtml,language:"Português",type:"Mensalidade",startDate:"",endDate:"",value:"€ 500",scope:"Escopo público",notes:"SEGREDO INTERNO"}}/>);assert.doesNotMatch(html,/SEGREDO INTERNO/);assert.doesNotMatch(html,/Observações internas/);assert.match(html,bodyHtml?/Texto público/:/Escopo público/);}});
  await act(async()=>root.unmount());root=createRoot(document.getElementById("root")!);
  let pending=[{...record,id:"one",status:"pending",title:"Primeiro"},{...record,id:"two",status:"pending",title:"Segundo"}];const accepted:string[]=[];let queryFail=false;let reads=0;
  const load=async()=>{reads++;if(queryFail)throw new Error("Falha de consulta");return pending[0]??null;};
  const accept=async(id:string)=>{accepted.push(id);pending=pending.filter(item=>item.id!==id);};
  const gate=async(canAccept=true)=>{await act(async()=>root.render(<ContractAcceptanceGate accountName="Cliente" onExit={()=>{}} canAccept={canAccept} load={load} accept={accept}/>));await flush();};
  await t.test("gate traps focus and keyboard, hides navigation, then fetches every pending contract",async()=>{await gate();assert.match(document.querySelector('[role="dialog"]')!.textContent!,/Primeiro/);assert.ok(document.getElementById("root")!.hasAttribute("inert"));assert.equal(document.getElementById("root")!.getAttribute("aria-hidden"),"true");assert.equal(document.activeElement?.getAttribute("role"),"dialog");const acceptButton=button("Li e aceito o contrato");await act(async()=>{acceptButton.focus();document.dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true}));});assert.equal(document.activeElement?.getAttribute("aria-label"),"Leitura do contrato");await act(async()=>{button("Li e aceito o contrato").click();button("Li e aceito o contrato").click();});await flush();assert.deepEqual(accepted,["one"]);assert.match(document.querySelector('[role="dialog"]')!.textContent!,/Segundo/);assert.ok(document.activeElement?.closest('[role="dialog"]'));assert.ok(document.getElementById("root")!.hasAttribute("inert"));await act(async()=>button("Li e aceito o contrato").click());await flush();assert.deepEqual(accepted,["one","two"]);assert.equal(document.querySelector('[role="dialog"]'),null);assert.equal(document.getElementById("root")!.hasAttribute("inert"),false);assert.equal(reads,3);});
  await t.test("lookup failure stays gated and retry recovers; viewer cannot accept or bypass",async()=>{await act(async()=>root.unmount());root=createRoot(document.getElementById("root")!);pending=[{...record,id:"three",status:"pending",title:"Terceiro"}];queryFail=true;await gate(false);assert.match(document.querySelector('[role="alert"]')!.textContent!,/Falha de consulta/);assert.ok(document.getElementById("root")!.hasAttribute("inert"));queryFail=false;await act(async()=>button("Verificar novamente").click());await flush();assert.equal(button("Li e aceito o contrato"),undefined);assert.ok(button("Sair da conta"));assert.match(document.querySelector('[role="dialog"]')!.textContent!,/responsável/);assert.deepEqual(accepted,["one","two"]);});
  await t.test("failure fetching the next pending document stays gated and never repeats an acceptance",async()=>{
   await act(async()=>root.unmount());root=createRoot(document.getElementById("root")!);queryFail=false;pending=[{...record,id:"last",status:"pending",title:"Último"}];await gate();queryFail=true;
   await act(async()=>button("Li e aceito o contrato").click());await flush();assert.match(document.querySelector('[role="alert"]')!.textContent!,/Falha de consulta/);assert.ok(document.getElementById("root")!.hasAttribute("inert"));assert.equal(button("Li e aceito o contrato"),undefined);
   queryFail=false;await act(async()=>button("Verificar novamente").click());await flush();assert.equal(document.querySelector('[role="dialog"]'),null);assert.equal(accepted.filter(id=>id==="last").length,1);
  });
  await t.test("StrictMode discards stale pending lookups arriving after the current result",async()=>{
   await act(async()=>root.unmount());root=createRoot(document.getElementById("root")!);const resolvers:Array<(value:any)=>void>=[];
   await act(async()=>root.render(<React.StrictMode><ContractAcceptanceGate accountName="Cliente" onExit={()=>{}} accept={accept} load={()=>new Promise(resolve=>resolvers.push(resolve))}/></React.StrictMode>));
   assert.equal(resolvers.length,2);await act(async()=>resolvers[1]({...record,status:"pending",title:"Resultado atual"}));await act(async()=>resolvers[0](null));assert.match(document.querySelector('[role="dialog"]')!.textContent!,/Resultado atual/);assert.ok(document.getElementById("root")!.hasAttribute("inert"));
  });
 } finally {await act(async()=>root.unmount());await server.close();dom.window.close();Object.assign(globalThis,saved);}
});
