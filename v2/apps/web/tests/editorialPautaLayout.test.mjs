import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const root = fileURLToPath(new URL('..', import.meta.url));
// Real UI components and API clients; synthetic responses only. No request may
// leave this temporary localhost server. Writes fail unless explicitly tested.
test('pauta reference, portal, public link and Kanban share editorial design and retain behavior', async t => {
 const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, hmr: false } });
 let browser; const evidence = [], artifacts = process.env.PAUTA_LAYOUT_ARTIFACT_DIR || await mkdtemp(path.join(tmpdir(), 'pauta-layout-'));
 try {
  await mkdir(artifacts,{recursive:true}); await server.listen(); const base=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({headless:true});
  const open=async(view,width=1440,height=1100,scheme='light',extra='')=>{
   const p=await browser.newPage({viewport:{width,height},colorScheme:scheme}); p.setDefaultTimeout(5000); p.errors=[];p.on('pageerror',e=>p.errors.push(e.message));
   await p.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
   await p.goto(`${base}/tests/editorial-pauta.fixture.html?view=${view}${extra}`);
   await p.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});await p.evaluate(()=>document.fonts.ready);return p;
  };
  for(const [size,width,height] of [['desktop',1440,1100],['mobile',390,844],['small-mobile',320,740]])for(const scheme of ['light','dark'])await t.test(`${size} ${scheme}`,async()=>{
   let reference;
   for(const view of ['reference','portal','public','kanban']){
    const p=await open(view,width,height,scheme);
    try{
     if(view==='reference')await p.getByRole('button',{name:'Editar pauta',exact:true}).click();
     if(view==='kanban'){
      const section=p.locator('.admin-editorial-brief');await section.waitFor();assert.equal(await section.getAttribute('open'),null);
      assert.equal(await section.locator('.editorial-brief').isVisible(),false);assert.equal(await p.evaluate(()=>window.fixtureCalls.some(x=>x.url.includes('recovery'))),false);
      if(size==='desktop'&&scheme==='dark'){await section.locator('> summary').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(artifacts,'kanban-collapsed-desktop-dark.png'),fullPage:false});}
      await section.locator('> summary').click();await section.locator('.editorial-brief').scrollIntoViewIfNeeded();
     }
     const panel=p.locator(view==='reference'?'.pauta-modal':view==='portal'?'.editorial-pauta-modal':view==='public'?'.editorial-pauta-public':'.admin-editorial-brief');
     await panel.locator('.editorial-brief').waitFor();
     const style=await panel.locator('.editorial-brief').evaluate(el=>{const s=getComputedStyle(el),d=getComputedStyle(el.querySelector('dd'));return{background:s.backgroundImage,font:s.fontFamily,padding:s.padding,label:getComputedStyle(el.querySelector('dt')).color,body:d.color,size:d.fontSize,gap:getComputedStyle(el.querySelector('dl')).gap};});
     if(view==='reference')reference=style;else assert.deepEqual(style,reference);
     if(view==='portal'){assert.equal(await panel.locator('.mini-badge,.portal-tag-manager,.portal-card-meta-grid').count(),0);assert.equal(await p.getByRole('button',{name:'Comentar',exact:true}).isVisible(),true);assert.equal(await panel.getAttribute('role'),'dialog');}
     const contrasts=await panel.locator('.editorial-brief').evaluate(el=>{const lum=rgb=>rgb.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);const bg=lum([250,249,255]);return [...el.querySelectorAll('dt,dd,header span,h4,footer a,footer small')].map(node=>{const rgb=getComputedStyle(node).color.match(/[\d.]+/g).slice(0,3).map(Number),fg=lum(rgb);return {text:node.textContent,ratio:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};});});
     assert.ok(contrasts.every(x=>x.ratio>=4.5),JSON.stringify(contrasts));
     const metrics=await panel.evaluate(el=>({right:el.getBoundingClientRect().right,windowWidth:innerWidth,overflow:el.scrollWidth>el.clientWidth+1}));assert.equal(metrics.overflow,false);assert.ok(metrics.right<=metrics.windowWidth+1);
     assert.doesNotMatch(await panel.innerText(),/PRIVATE_|TECHNICAL_MODEL|alignmentScore/);assert.deepEqual(p.errors,[]);
     assert.equal(await p.evaluate(()=>window.fixtureCalls.filter(x=>x.method!=='GET').length),0);
     if(view==='portal'&&size==='mobile'&&scheme==='light'){await panel.locator('.portal-feedback-card').scrollIntoViewIfNeeded();assert.equal(await panel.locator('.modal-head').evaluate(el=>el.getBoundingClientRect().top>=0),true);assert.equal(await panel.locator('.portal-card-sticky-actions').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),true);await p.screenshot({path:path.join(artifacts,'portal-mobile-feedback.png'),fullPage:false});await panel.locator('.editorial-brief').scrollIntoViewIfNeeded();}
     if(view==='portal')await panel.locator('.modal-grid').evaluate(el=>{el.scrollTop=0;});
     if(size!=='small-mobile'){const file=`${view}-${size}-${scheme}.png`;await p.screenshot({path:path.join(artifacts,file),fullPage:view==='public'});evidence.push({file,view,size,scheme,metrics,style,contrasts});}
    }finally{await p.close();}
   }
  });
  await t.test('portal feedback payloads, focus loop and Escape preserve content',async()=>{
   const p=await open('portal',390,844);
   try{await p.getByRole('dialog').waitFor();const original=await p.evaluate(()=>JSON.stringify(window.fixtureDetail));const comment=p.getByRole('textbox',{name:'Comentário',exact:true});
    await comment.fill('Revisar a abertura.');await p.getByRole('button',{name:'Comentar',exact:true}).click();await comment.fill('Ajustar o exemplo.');await p.getByRole('button',{name:'Pedir alteração',exact:true}).click();await p.getByRole('button',{name:'Aprovar',exact:true}).click();
    assert.deepEqual((await p.evaluate(()=>window.fixtureActions)).map(x=>x.kind),['comment','changes','approve']);assert.equal(await p.evaluate(()=>JSON.stringify(window.fixtureDetail)),original);
    await p.getByRole('button',{name:'Aprovar',exact:true}).focus();await p.keyboard.press('Tab');assert.equal(await p.getByRole('button',{name:'Fechar',exact:true}).evaluate(el=>el===document.activeElement),true);await p.keyboard.press('Escape');assert.equal((await p.evaluate(()=>window.fixtureActions)).at(-1).kind,'close');
   }finally{await p.close();}
  });
  await t.test('public decision contract and read-only/absent content remain intact',async()=>{
   const p=await open('public',390,844);
   try{await p.getByLabel('Seu nome').fill('Marina');await p.getByLabel('Comentário',{exact:true}).fill('Revisar a abertura.');await p.getByRole('button',{name:'Solicitar alteração'}).click();await p.getByRole('status').waitFor();
    assert.deepEqual((await p.evaluate(()=>window.fixtureCalls.filter(x=>x.method!=='GET'))).map(x=>[x.url,x.body]),[['/api/portal/approval/synthetic/decision',{approved:false,commentText:'Revisar a abertura.',requesterName:'Marina'}]]);
   }finally{await p.close();}
   const p2=await open('portal',390,844,'dark','&readonly&empty');try{await p2.getByRole('dialog').waitFor();assert.equal(await p2.getByRole('button',{name:'Aprovar',exact:true}).count(),0);assert.equal(await p2.locator('.editorial-brief').count(),0);assert.doesNotMatch(await p2.getByRole('dialog').innerText(),/Legenda sugerida|Fonte da notícia/);}finally{await p2.close();}
  });
  await t.test('recovery stays explicit in separate native dialog; approved and blocked cases cannot apply',async()=>{
   const p=await open('kanban',1440,1100,'dark');
   try{await p.locator('.admin-editorial-brief > summary').click();await p.getByRole('button',{name:'Consultar prévia de recuperação'}).click();const dialog=p.getByRole('dialog',{name:'Recuperar briefing'});await dialog.waitFor();const apply=p.getByRole('button',{name:'Confirmar recuperação desta pauta'});assert.equal(await apply.isDisabled(),true);assert.equal(await p.evaluate(()=>window.fixtureCalls.filter(x=>x.method!=='GET').length),0);
    await p.screenshot({path:path.join(artifacts,'recovery-desktop-dark.png'),fullPage:false});await dialog.getByRole('checkbox').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(artifacts,'recovery-confirmation-desktop-dark.png'),fullPage:false});await dialog.getByRole('checkbox').check();await apply.click();await dialog.waitFor({state:'detached'});assert.deepEqual((await p.evaluate(()=>window.fixtureCalls.filter(x=>x.method!=='GET'))).map(x=>x.body),[{previewToken:'synthetic-preview-token',confirm:true}]);
   }finally{await p.close();}
   for(const extra of ['&approved','&blocked']){const p=await open('kanban',390,844,'dark',extra);try{await p.locator('.admin-editorial-brief > summary').click();if(extra==='&approved')assert.equal(await p.getByRole('button',{name:'Consultar prévia de recuperação'}).count(),0);else{await p.getByRole('button',{name:'Consultar prévia de recuperação'}).click();await p.getByText('Recuperação indisponível').waitFor();assert.equal(await p.getByRole('checkbox').count(),0);await p.keyboard.press('Escape');await p.getByRole('dialog',{name:'Recuperar briefing'}).waitFor({state:'detached'});}}finally{await p.close();}}
  });
  await t.test('authenticated application route restores session and opens the same pauta reader',async()=>{
   const p=await open('authenticated',1440,1100);
   try{await p.getByText('Uma pausa para observar o cotidiano',{exact:true}).first().click();const dialog=p.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.locator('.editorial-brief').count(),1);assert.equal(await dialog.locator('.portal-card-meta-grid,.mini-badge').count(),0);assert.ok((await p.evaluate(()=>window.fixtureCalls)).some(x=>x.url==='/api/auth/session'));assert.deepEqual(p.errors,[]);await p.screenshot({path:path.join(artifacts,'authenticated-portal-desktop.png'),fullPage:false});}finally{await p.close();}
  });
  await t.test('media and long recovery remain contained on mobile',async()=>{
   const p=await open('portal',390,844,'dark','&media');
   try{await p.getByRole('dialog').waitFor();await p.locator('.modal-media img').waitFor();assert.equal(await p.getByRole('dialog').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);}finally{await p.close();}
   const p2=await open('kanban',390,844,'dark');
   try{await p2.locator('.admin-editorial-brief > summary').click();await p2.getByRole('button',{name:'Consultar prévia de recuperação'}).click();const dialog=p2.getByRole('dialog',{name:'Recuperar briefing'});await dialog.waitFor();assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);await p2.screenshot({path:path.join(artifacts,'recovery-mobile-dark.png'),fullPage:false});await dialog.getByRole('checkbox').scrollIntoViewIfNeeded();await p2.screenshot({path:path.join(artifacts,'recovery-confirmation-mobile-dark.png'),fullPage:false});await p2.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await p2.getByRole('button',{name:'Consultar prévia de recuperação'}).evaluate(el=>el===document.activeElement),true);assert.equal(await p2.evaluate(()=>window.fixtureCalls.filter(x=>x.method!=='GET').length),0);}finally{await p2.close();}
  });
  await writeFile(path.join(artifacts,'evidence.json'),JSON.stringify(evidence,null,2));console.log(`Visual evidence: ${artifacts}`);
 }finally{await browser?.close();await server.close();}
});
