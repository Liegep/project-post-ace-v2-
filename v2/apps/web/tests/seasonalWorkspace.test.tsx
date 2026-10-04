import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seasonalFixture } from './seasonalFixtures';
import { monthPeriod, validateSeasonalPeriod } from '../src/seasonalPresentation';

test('periods preserve today, leap years and December/January', () => {
 assert.deepEqual(monthPeriod('2026-10','2026-10-04'),{from:'2026-10-04',to:'2026-10-31'});
 assert.deepEqual(monthPeriod('2026-12','2026-10-04'),{from:'2026-12-01',to:'2026-12-31'});
 assert.deepEqual(monthPeriod('2027-01','2026-10-04'),{from:'2027-01-01',to:'2027-01-31'});
 assert.equal(monthPeriod('2028-02','2026-10-04').to,'2028-02-29');
 assert.equal(validateSeasonalPeriod('2026-12-31','2027-01-01'),'');
 assert.equal(validateSeasonalPeriod('2026-10-04','2026-10-04'),'');
 assert.match(validateSeasonalPeriod('2026-10-05','2026-10-04'),/posterior/);
 assert.match(validateSeasonalPeriod('','2026-10-04'),/válido/);
 assert.match(validateSeasonalPeriod('2026-01-01','2028-01-01'),/367/);
});

test('seasonal radar uses existing APIs and explicit editorial markets', async(t)=>{
 const dom=new JSDOM('<body><div id="root"></div></body>',{url:'http://localhost'});
 const saved={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,localStorage:globalThis.localStorage,CustomEvent:globalThis.CustomEvent};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
 const server=await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),server:{middlewareMode:true,hmr:false}});
 let root=createRoot(document.getElementById('root')!);
 let fixture=seasonalFixture();globalThis.fetch=fixture.fetch;
 const {SeasonalWorkspace,SeasonalDashboardWidget}=await server.ssrLoadModule('/src/SeasonalWorkspace.tsx');
 const session={id:'preview-user',role:'super_admin',name:'Revisão visual'};
 const flush=async()=>{await act(async()=>{await new Promise(r=>setTimeout(r,25));});};
 const text=()=>document.body.textContent!;
 const button=(name:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(x=>x.textContent?.trim()===name||x.getAttribute('aria-label')===name)!;
 const click=async(name:string)=>{assert.ok(button(name),name);await act(async()=>button(name).click());await flush();};
 const change=async(selector:string,value:string)=>{const el=document.querySelector<HTMLInputElement>(selector)!;assert.ok(el,selector);await act(async()=>{el.value=value;Simulate.change(el);});await flush();};
 const mount=async(scenario='populated',role='super_admin')=>{await act(async()=>root.unmount());root=createRoot(document.getElementById('root')!);fixture=seasonalFixture(scenario);globalThis.fetch=fixture.fetch;await act(async()=>root.render(<React.StrictMode><SeasonalWorkspace session={{...session,role}}/></React.StrictMode>));await flush();};
 try{
  await t.test('chronological highlight, global once, multiple countries and reliable clients',async()=>{
   await mount();assert.equal(document.querySelector('.radar-feature h2')!.textContent,'Dia de celebrar o café');
   assert.equal(document.querySelector('.radar-countdown')!.textContent,'Amanhã');
   assert.match(document.querySelector('.radar-feature')!.textContent!,/Brasil · Itália/);
   assert.equal(document.querySelectorAll('.radar-timeline-item').length,4);
   assert.equal(text().split('Dia Mundial da Saúde Mental').length-1,1);
   assert.equal(document.querySelectorAll('.radar-client-chip').length,5);
   assert.doesNotMatch(document.querySelector('.radar-feature')!.textContent!,/Casa Lume/);
   assert.equal(fixture.calls.filter(x=>x.method!=='GET').length,0);
  });
  await t.test('empty onboarding opens complete ISO directory; no inferred geography',async()=>{
   await mount('empty');assert.match(text(),/Nenhuma oportunidade neste período/);await click('Adicionar primeiro país ↗');
   assert.match(text(),/Nenhum país monitorado/);await change('.radar-drawer input','JP');assert.ok(button('Adicionar Japão'));
   await click('Adicionar Japão');assert.equal(fixture.countries.find(x=>x.countryCode==='JP')?.active,true);
   assert.deepEqual(fixture.markets['client-b'],[]);
   assert.equal(fixture.calls.filter(x=>x.method==='PUT').length,1);
  });
  await t.test('deactivate and reactivate preserves record identity and client markets',async()=>{
   await mount();await click('◎ Gerenciar países');const row=fixture.countries.find(x=>x.countryCode==='BR')!;
   await click('Desativar Brasil');assert.equal(row.active,false);assert.ok(fixture.countries.includes(row));assert.deepEqual(fixture.markets['client-a'],['BR','IT']);
   await click('Reativar monitoramento de Brasil');assert.equal(row.active,true);assert.equal(fixture.countries.filter(x=>x.countryCode==='BR').length,1);
   assert.equal(fixture.calls.filter(x=>x.method==='DELETE').length,0);
  });
  await t.test('markets load multiple confirmed countries and save only after confirmation',async()=>{
   await mount();await click('Mercados editoriais ↗');await change('.radar-drawer select','client-a');
   assert.match(document.querySelector('.radar-management-section')!.textContent!,/Brasil · Itália/);
   await change('.radar-drawer select','client-b');assert.match(text(),/ainda não possui mercados editoriais confirmados/);
   assert.equal(document.querySelectorAll('.radar-country-chips>span').length,0);
   await change('.radar-country-picker input','JP');await click('Adicionar Japão');await change('.radar-country-picker input','SE');await click('Adicionar Suécia');
   assert.deepEqual(fixture.markets['client-b'],[]);assert.equal(fixture.calls.filter(x=>x.method==='PUT').length,0);
   await click('Confirmar mercados');assert.deepEqual(fixture.markets['client-b'],['JP','SE']);
   assert.equal(fixture.calls.find(x=>x.method==='PUT')!.body.confirmed,true);
   assert.equal(fixture.countries.find(x=>x.countryCode==='SE')!.active,false);assert.ok(!fixture.countries.some(x=>x.countryCode==='JP'));
   await change('.radar-drawer select','client-a');await change('.radar-drawer select','client-b');assert.equal(document.querySelectorAll('.radar-country-chips>span').length,2);
  });
  await t.test('client without markets has helpful empty results; filters reach API',async()=>{
   await mount();await change('.radar-toolbar>label:nth-of-type(4) select','client-b');assert.match(text(),/ainda não possui mercados editoriais confirmados/);assert.match(text(),/Nenhuma oportunidade/);
   await click('Limpar filtros');await change('.radar-toolbar>label:nth-of-type(2) select','IT');await change('.radar-toolbar>label:nth-of-type(3) select','sazonal');
   assert.equal(document.querySelector('.radar-feature h2')!.textContent,'Sabores de outono');
   const last=fixture.calls.filter(x=>x.path==='/api/seasonal/radar').at(-1)!;assert.match(last.query,/countryCode=IT/);assert.match(last.query,/categoryCode=sazonal/);
  });
  await t.test('global opportunity appears once without monitored countries',async()=>{
   await mount('global');assert.equal(text().split('Dia Mundial da Saúde Mental').length-1,1);assert.match(document.querySelector('.radar-feature')!.textContent!,/Global/);assert.equal(document.querySelectorAll('.radar-timeline-item').length,0);
  });
  await t.test('regional information is preserved and does not invent related clients',async()=>{
   await mount('regional');assert.match(document.querySelector('.radar-feature')!.textContent!,/Abrangência regional · BR-SP/);assert.equal(document.querySelectorAll('.radar-feature .radar-client-chip').length,0);
  });
  await t.test('pagination passes 24 and retains the chronological highlight on later pages',async()=>{
   await mount('many');assert.equal(document.querySelectorAll('.radar-timeline-item').length,49);await click('Próxima →');assert.equal(document.querySelectorAll('.radar-timeline-item').length,20);assert.match(text(),/Página 2/);assert.equal(document.querySelector('.radar-feature h2')!.textContent,'Dia de celebrar o café');await click('← Anterior');assert.equal(document.querySelectorAll('.radar-timeline-item').length,49);
  });
  await t.test('pauta requires choosing a client and uses pending approval flow',async()=>{
   await mount();await click('Criar pauta ↗');assert.equal(document.querySelector<HTMLSelectElement>('.radar-dialog select')!.value,'');assert.equal(button('Criar pauta pendente').disabled,true);
   await change('.radar-dialog select','estudio-aurora');await act(async()=>{button('Criar pauta pendente').click();button('Criar pauta pendente').click();});await flush();
   const posts=fixture.calls.filter(x=>x.method==='POST');assert.equal(posts.length,1);assert.equal(posts[0].path,'/api/clients/client-a/cards');assert.equal(posts[0].body.isBriefApproval,true);assert.equal(posts[0].body.clientLabel,'Pendente');assert.equal(posts[0].body.deadlineAt,'2026-10-05');assert.match(text(),/Pauta criada/);assert.equal(button('Criar pauta pendente'),undefined);
  });
  await t.test('API error is recoverable and is not shown as no results',async()=>{
   await mount();fixture.setFailure(true);await change('.radar-toolbar>label:first-child select','30');assert.match(text(),/Falha controlada/);assert.doesNotMatch(text(),/Nenhuma oportunidade neste período/);fixture.setFailure(false);await click('Tentar novamente');assert.ok(document.querySelector('.radar-feature'));
  });
  await t.test('today appears as Hoje and provider warnings preserve other results',async()=>{
   await mount();fixture.records[0].date='2026-10-04';fixture.records[0].daysUntil=0;await change('.radar-toolbar>label:first-child select','30');assert.equal(document.querySelector('.radar-countdown')!.textContent,'Hoje');
   await mount('warning');assert.match(document.querySelector('.radar-source-note')!.textContent!,/Itália \(2026\)/);assert.ok(document.querySelector('.radar-feature'));assert.equal(document.querySelectorAll('.radar-timeline-item').length,4);
  });
  await t.test('highlight can find upcoming occurrence after a page of historical results',async()=>{
   await mount();const template=fixture.records[0];for(let i=0;i<60;i++)fixture.records.push({...template,id:'past-'+i,date:'2026-09-30',daysUntil:-4});
   await change('.radar-toolbar>label:first-child select','custom');await change('.radar-custom-period input','2026-09-01');assert.equal(document.querySelector('.radar-feature h2')!.textContent,'Dia de celebrar o café');assert.ok(fixture.calls.some(x=>x.query.includes('from=2026-10-04')&&x.query.includes('limit=1')));
  });
  await t.test('manual opportunity country selection never submits the form; global uses one record',async()=>{
   await mount();await click('+ Cadastrar oportunidade');await change('.radar-dialog input','Nova data editorial');await change('.radar-country-picker input','JP');await click('Adicionar Japão');assert.equal(fixture.calls.filter(x=>x.method==='POST').length,0);
   // The scope select is the last select in the dialog, regardless of nested labels.
   const selects=document.querySelectorAll<HTMLSelectElement>('.radar-dialog select');await act(async()=>{selects[selects.length-1].value='global';Simulate.change(selects[selects.length-1]);});await flush();await click('Salvar oportunidade');
   const posts=fixture.calls.filter(x=>x.method==='POST');assert.equal(posts.length,1);assert.equal(posts[0].body.scope,'global');assert.deepEqual(posts[0].body.countryCodes,[]);assert.equal(posts[0].body.occurrences.length,1);
  });
  await t.test('invalid custom dates do not show stale results',async()=>{
   await mount();await change('.radar-toolbar>label:first-child select','custom');await change('.radar-custom-period input','2027-01-02');assert.match(text(),/posterior/);assert.equal(document.querySelector('.radar-feature'),null);
  });
  await t.test('drawer traps keyboard focus, restores background and can close with Escape',async()=>{
   await mount();const opener=button('◎ Gerenciar países');opener.focus();await click('◎ Gerenciar países');assert.equal(document.body.style.overflow,'hidden');assert.ok(document.getElementById('root')!.hasAttribute('inert'));
   const dialog=document.querySelector<HTMLElement>('[role=dialog]')!;assert.equal(document.activeElement,dialog);
   await act(async()=>dialog.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));assert.equal(document.activeElement,button('Fechar Gerenciar países'));
   await act(async()=>dialog.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(document.querySelector('[role=dialog]'),null);assert.equal(document.body.style.overflow,'');assert.ok(!document.getElementById('root')!.hasAttribute('inert'));assert.equal(document.activeElement,opener);
  });
  await t.test('dashboard caps same-day opportunities at three with stable dates, scope and existing pauta flow',async()=>{
   await act(async()=>root.unmount());root=createRoot(document.getElementById('root')!);fixture=seasonalFixture('widget');globalThis.fetch=fixture.fetch;
   await act(async()=>root.render(<MemoryRouter><SeasonalDashboardWidget clients={[{id:'client-a',slug:'estudio-aurora',name:'Estúdio Aurora'}]}/></MemoryRouter>));await flush();
   assert.equal(document.querySelectorAll('.seasonal-widget-row').length,3);
   assert.equal(document.querySelector('.seasonal-widget-period')!.textContent,'Hoje');
   assert.match(document.querySelector('.seasonal-widget-date')!.textContent!,/04out/i);
   assert.match(text(),/Itália/);assert.match(text(),/Feriado/);assert.match(text(),/Global/);
   assert.equal([...document.querySelectorAll('a')].find(x=>x.textContent==='Ver todas →')?.getAttribute('href'),'/area/datas-comemorativas');
   assert.match(text(),/Gerenciar monitoramento →/);
   await click('Criar pauta');assert.ok(document.querySelector('[role=dialog]'));assert.equal(button('Criar pauta pendente').disabled,true);
   await change('.radar-dialog select','estudio-aurora');await click('Criar pauta pendente');
   const post=fixture.calls.find(x=>x.method==='POST')!;assert.equal(post.path,'/api/clients/client-a/cards');assert.equal(post.body.isBriefApproval,true);assert.equal(post.body.clientLabel,'Pendente');assert.equal(post.body.deadlineAt,'2026-10-04');
   await act(async()=>root.unmount());root=createRoot(document.getElementById('root')!);fixture.records.splice(1);fixture.records[0].date='2026-10-05';fixture.records[0].daysUntil=1;
   await act(async()=>root.render(<MemoryRouter><SeasonalDashboardWidget clients={[]}/></MemoryRouter>));await flush();
   assert.equal(document.querySelector('.seasonal-widget-period')!.textContent,'Amanhã');assert.equal(document.querySelectorAll('.seasonal-widget-row').length,1);assert.equal(button('Criar pauta').disabled,true);assert.ok(![...document.querySelectorAll('a')].some(x=>x.textContent==='Ver todas →'));
   await mount('populated');
  });
  await t.test('read-only collaborator cannot change management settings',async()=>{
   await mount('populated','colaborador');assert.equal(button('◎ Gerenciar países'),undefined);assert.equal(button('+ Cadastrar oportunidade'),undefined);assert.equal(fixture.calls.filter(x=>x.method!=='GET').length,0);
  });
 }finally{await act(async()=>root.unmount());await server.close();dom.window.close();Object.assign(globalThis,saved);}
});
