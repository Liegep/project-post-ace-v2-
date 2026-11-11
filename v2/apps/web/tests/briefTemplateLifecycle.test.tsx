import assert from "node:assert/strict";
import test from "node:test";
import React,{act} from "react";
import {createRoot} from "react-dom/client";
import {JSDOM} from "jsdom";
import {createServer} from "vite";

test("template tabs, archive, restore, preview and confirmed deletion preserve counts and errors",async(t)=>{
 const dom=new JSDOM('<body><div id="root"></div></body>',{url:"http://localhost"});
 const previous={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,CustomEvent:globalThis.CustomEvent};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
 Object.assign(dom.window.HTMLElement.prototype,{attachEvent(){},detachEvent(){}});dom.window.confirm=()=>true;
 const server=await createServer({root:new URL("..",import.meta.url).pathname,server:{middlewareMode:true,hmr:false,watch:null}});
 const {BriefsFoundationWorkspace}=await server.ssrLoadModule("/src/BriefFoundationWorkspace.tsx");
 const form={title:"Ativo",introduction:"Instructions",category:"branding",locale:"sv",fields:[{id:"name",type:"short",label:"Marca",help:"Help",required:true,options:[],validation:{maxLength:100}}]};
 let templates:any[]=[{id:"active",name:"Ativo",description:"Active",version:1,status:"active",form},{id:"archived",name:"Arquivado",description:"Archived",version:3,status:"archived",form:{...form,title:"Arquivado"}}];
 const calls:{url:string;method:string;body:any}[]=[];let blocked=false;
 globalThis.fetch=async(input:any,init:any={})=>{
  const url=String(input),method=init.method??"GET",body=init.body?JSON.parse(init.body):null;calls.push({url,method,body});let result:any={items:[]};
  if(url.endsWith("/briefs/templates")&&method==="GET")result={items:structuredClone(templates)};
  else if(url.endsWith("/archive")||url.endsWith("/restore")){
   const id=url.split("/").at(-2),item=templates.find(t=>t.id===id);assert.equal(body.expectedVersion,item.version);item.status=url.endsWith("/archive")?"archived":"active";item.version++;result={template:structuredClone(item)};
  }else if(method==="DELETE"){
   assert.equal(body.confirmation,"DELETE");const id=url.split("/").at(-1);assert.equal(body.expectedVersion,templates.find(t=>t.id===id).version);
   if(blocked)return new Response(JSON.stringify({message:"Este template possui briefs vinculados e não pode ser excluído."}),{status:409,headers:{"content-type":"application/json"}});
   templates=templates.filter(t=>t.id!==id);result={ok:true};
  }
  return new Response(JSON.stringify(result),{headers:{"content-type":"application/json"}});
 };
 const root=createRoot(document.getElementById("root")!);
 const flush=()=>act(async()=>{await new Promise(r=>setTimeout(r,15));});
 const click=async(el:Element|null)=>{assert.ok(el);await act(async()=>{(el as HTMLElement).click();});await flush();};
 const tab=(name:string)=>[...document.querySelectorAll('[role="tab"]')].find(el=>el.textContent?.startsWith(name))!;
 const action=(name:string)=>document.querySelector(`button[aria-label="${name}"]`);
 const count=(name:string)=>tab(name).querySelector("span")?.textContent;
 const card=()=>[...document.querySelectorAll(".brief-template-card h3")].map(e=>e.textContent);
 try{
  await act(async()=>root.render(<BriefsFoundationWorkspace/>));await flush();
  await t.test("active tab excludes archived templates; counts ignore search",async()=>{
   assert.deepEqual(card(),["Ativo"]);assert.equal(count("Templates"),"1");assert.equal(count("Arquivados"),"1");
   assert.equal(document.querySelectorAll(".brief-template-actions button").length,5);
   assert.ok(action("Excluir permanentemente template Ativo")?.getAttribute("title"));
  });
  await t.test("archive removes active card and updates archived counter",async()=>{
   await click(action("Arquivar template Ativo"));assert.deepEqual(card(),[]);assert.equal(count("Templates"),"0");assert.equal(count("Arquivados"),"2");
   await click(tab("Arquivados"));assert.deepEqual(card(),["Ativo","Arquivado"]);assert.equal(document.querySelectorAll(".brief-template-actions button").length,6);
   assert.equal(document.querySelector('[title="Duplicar"]'),null);
  });
  await t.test("preview is read only and restore preserves definitions",async()=>{
   const buttons=[...document.querySelectorAll("button")];await click(buttons.find(b=>b.textContent?.startsWith("Visualizar"))!);
   assert.ok(document.querySelector('[role="dialog"]')?.textContent?.includes("Marca"));assert.equal(document.querySelector('[role="dialog"] textarea'),null);
   await click(action("Fechar"));const before=structuredClone(templates[0].form);await click(action("Restaurar template Ativo"));
   assert.deepEqual(templates[0].form,before);assert.deepEqual(card(),["Arquivado"]);assert.equal(count("Templates"),"1");assert.equal(count("Arquivados"),"1");
  });
  await t.test("one click cannot delete; cancelled modal performs no request",async()=>{
   await click(action("Excluir permanentemente template Arquivado"));const dialog=document.querySelector('[role="dialog"]')!;
   assert.match(dialog.textContent!,/Arquivado/);assert.match(dialog.textContent!,/irreversível/);
   const confirm=dialog.querySelector<HTMLButtonElement>(".brief-template-delete-confirm")!;assert.ok(confirm.disabled);await click(confirm);
   assert.equal(calls.filter(c=>c.method==="DELETE").length,0);
   await click([...dialog.querySelectorAll("button")].find(b=>b.textContent==="Cancelar")!);assert.equal(document.querySelector('[role="dialog"]'),null);
  });
  await t.test("blocked delete retains template, counter and reason inside modal",async()=>{
   blocked=true;await click(action("Excluir permanentemente template Arquivado"));await click(document.querySelector('[role="dialog"] input[type="checkbox"]'));await click(document.querySelector(".brief-template-delete-confirm"));
   assert.match(document.querySelector('[role="alert"]')!.textContent!,/briefs vinculados/);assert.deepEqual(card(),["Arquivado"]);assert.equal(count("Arquivados"),"1");assert.ok(document.querySelector('[role="dialog"]'));
  });
  await t.test("confirmed permanent deletion removes the persisted list item and counter",async()=>{
   blocked=false;await click(document.querySelector(".brief-template-delete-confirm"));assert.equal(document.querySelector('[role="dialog"]'),null);assert.deepEqual(card(),[]);assert.equal(count("Arquivados"),"0");assert.match(document.body.textContent!,/Nenhum template arquivado/);
   await click(tab("Templates"));assert.deepEqual(card(),["Ativo"]);assert.equal(count("Templates"),"1");
  });
 }finally{await act(async()=>root.unmount());await server.close();dom.window.close();Object.assign(globalThis,previous);}
});
