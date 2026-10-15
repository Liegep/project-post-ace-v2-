import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const baselineCommit = 'fa8f6d9ed67c9fc97a9e70fbfc21b968580472b8'; // main immediately before #41
const oldFile = file => execFileSync('git', ['show', `${baselineCommit}:v2/apps/web/src/${file}`], {cwd:root,encoding:'utf8'});

// Load the actual pre-#41 reader/CSS in memory. No old product source is restored
// to the checkout or bundle. Every API response and all media are synthetic.
function baselinePlugin(fixture, videos) {
 const appId=path.join(root,'src/.media-baseline-App.tsx'), cssId=path.join(root,'src/.media-baseline.css'), fixtureId=path.join(root,'tests/.media-baseline.fixture.tsx');
 return {name:'synthetic-pre41-reference', enforce:'pre',
  resolveId(id){if(id==='/src/.media-baseline-App.tsx')return appId;if(id==='/src/.media-baseline.css')return cssId;if(id==='/tests/.media-baseline.fixture.tsx')return fixtureId;},
  load(id){if(id===appId)return oldFile('App.tsx').replace('function CardDetailModal(', 'export function CardDetailModal(').replace('function PublicApprovalPage(', 'export function PublicApprovalPage(').replace('function PautasWorkspace(', 'export function PautasWorkspace(');
   if(id===cssId)return oldFile('styles.css');
   if(id===fixtureId)return fixture.replace('"../src/App"','"/src/.media-baseline-App.tsx"').replace('"../src/styles.css"','"/src/.media-baseline.css"');},
  configureServer(server){server.middlewares.use((req,res,next)=>{
   if(req.url?.startsWith('/tests/media-baseline.fixture.html')){res.setHeader('Content-Type','text/html');res.end('<html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/.media-baseline.fixture.tsx"></script></body></html>');return;}
   const video=videos.get(req.url);if(video){res.setHeader('Content-Type','video/webm');res.end(video);return;}next();
  });}
 };
}

async function recordVideo(browser,width,height){
 const page=await browser.newPage();
 try{return Buffer.from(await page.evaluate(async({width,height})=>{
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#e7bf9b';ctx.fillRect(0,0,width,height);ctx.fillStyle='#154653';ctx.fillRect(20,20,width-40,height-40);ctx.fillStyle='#fff';ctx.font='40px sans-serif';ctx.fillText(`${width} × ${height}`,40,90);
  const stream=canvas.captureStream(10),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}),chunks=[];
  recorder.ondataavailable=e=>chunks.push(e.data);const complete=new Promise(resolve=>{recorder.onstop=resolve;});recorder.start();await new Promise(resolve=>setTimeout(resolve,250));recorder.stop();await complete;stream.getTracks().forEach(track=>track.stop());
  return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
 },{width,height}));}finally{await page.close();}
}

async function geometry(page){
 return page.locator('.artwork-carousel-slide.active').evaluate(frame=>{
  const media=frame.querySelector('img,video'),r=frame.getBoundingClientRect(),m=media.getBoundingClientRect(),s=getComputedStyle(frame),style=getComputedStyle(media);
  const width=media.naturalWidth||media.videoWidth,height=media.naturalHeight||media.videoHeight,reader=frame.closest(".modal-grid");
  return {withinReader:!reader||r.bottom<=reader.getBoundingClientRect().bottom+1,width:r.width,height:r.height,ratio:width/height,frameRatio:r.width/r.height,mediaWidth:m.width,mediaHeight:m.height,radius:parseFloat(s.borderRadius),fit:style.objectFit,maxHeight:style.maxHeight,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1};
 });
}
async function loaded(page){await page.waitForFunction(()=>{const m=document.querySelector('.artwork-carousel-slide.active img,.artwork-carousel-slide.active video');return m&&(m.naturalWidth||m.videoWidth)>0;});await page.waitForTimeout(80);}
function assertFrame(m){
 assert.equal(m.withinReader,true,JSON.stringify(m));assert.ok(Math.abs(m.frameRatio-m.ratio)<.012,JSON.stringify(m));assert.ok(m.radius>=10);assert.equal(m.fit,'contain');assert.equal(m.overflow,false);assert.ok(m.width<=m.viewport);
 assert.ok(m.mediaWidth>=m.width-3&&m.mediaHeight>=m.height-3,JSON.stringify(m));
}

test('produced media keeps its intrinsic rounded frame; compare the actual pre-41 reader',async t=>{
 const artifacts=process.env.MEDIA_LAYOUT_ARTIFACT_DIR||await mkdtemp(path.join(tmpdir(),'produced-media-'));await mkdir(artifacts,{recursive:true});
 const fixture=await readFile(path.join(root,'tests/editorial-pauta.fixture.tsx'),'utf8'),videos=new Map();
 const server=await createServer({root,plugins:[baselinePlugin(fixture,videos)],server:{host:'127.0.0.1',port:0,hmr:false}});
 let browser;const evidence=[];
 try{
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;browser=await chromium.launch({headless:true});
  videos.set('/tests/synthetic-video-story.webm',await recordVideo(browser,360,640));videos.set('/tests/synthetic-video-landscape.webm',await recordVideo(browser,640,360));
  const open=async(shape,width,height,scheme,view='portal',baseline=false,extra='')=>{
   const p=await browser.newPage({viewport:{width,height},colorScheme:scheme});p.setDefaultTimeout(20000);p.errors=[];p.on('pageerror',e=>p.errors.push(e.message));
   await p.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
   await p.goto(`${base}/tests/${baseline?'media-baseline':'editorial-pauta'}.fixture.html?view=${view}&shape=${shape}${extra}`);
   if(view==='authenticated')await p.getByText('Uma pausa para observar o cotidiano',{exact:true}).first().click();
   await p.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});try { await loaded(p); } catch (error) { await p.close();throw new Error(`Media failed to load: ${shape} / ${view} / baseline=${baseline}; ${p.errors.join("; ")}`, {cause:error}); } return p;
  };
  for(const [size,width,height] of [['desktop',1440,1100],['mobile',390,844],['small-mobile',320,740]])for(const scheme of ['light','dark'])await t.test(`${size} ${scheme}: images, mixed carousel and actual videos`,async()=>{
   for(const shape of ['square','portrait','story','landscape','carousel','video-story','video-landscape']){
    const p=await open(shape,width,height,scheme);
    try{
     assert.equal(await p.locator('.editorial-pauta-modal').count(),0);const m=await geometry(p);assertFrame(m);assert.equal(m.maxHeight,'none');assert.ok(m.width>=Math.min(width-60,200));
     if(shape==='story'&&size==='desktop')assert.ok(m.height>600&&m.height<=642,'vertical art fits inside the reader without the pauta 320px cap');
     const before=await p.evaluate(()=>JSON.stringify(window.fixtureDetail));
     if(shape==='carousel')for(let i=1;i<4;i++){await p.getByRole('button',{name:'Próxima arte',exact:true}).click();await loaded(p);assertFrame(await geometry(p));}
     if(shape==='video-story'){await p.getByRole('button',{name:'Reproduzir vídeo',exact:true}).click();await p.locator('.portal-video-player-backdrop').waitFor();await p.keyboard.press('Escape');}
     assert.equal(await p.evaluate(()=>JSON.stringify(window.fixtureDetail)),before);assert.equal(await p.evaluate(()=>window.fixtureCalls.some(x=>x.method!=='GET')),false);assert.deepEqual(p.errors,[]);
     if(size!=='small-mobile'){if(shape==='carousel')for(let i=0;i<3;i++)await p.getByRole('button',{name:'Arte anterior',exact:true}).click();const file=`after-${shape}-${size}-${scheme}.jpg`;await p.screenshot({type:'jpeg',quality:80,path:path.join(artifacts,file)});evidence.push({file,shape,size,scheme,current:m});}
    }finally{await p.close();}
   }
  });
  await t.test('pre-41 comparison: same traditional two-column reader; improved intrinsic frames',async()=>{
   for(const shape of ['square','portrait','story','landscape','carousel','video-story']){
    const old=await open(shape,1440,1100,'light','portal',true),current=await open(shape,1440,1100,'light');
    try{
     const oldMetric=await geometry(old),newMetric=await geometry(current);assertFrame(newMetric);
     const columns=p=>p.locator('.modal-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat));
     assert.deepEqual(await columns(current),await columns(old));
     const file=`before-${shape}-desktop-light.jpg`;await old.screenshot({type:'jpeg',quality:80,path:path.join(artifacts,file)});evidence.push({file,shape,baselineCommit,before:oldMetric,current:newMetric});assert.deepEqual(old.errors,[]);
    }finally{await old.close();await current.close();}
   }
  });
  await t.test('authenticated portal, public media, pauta with media and feedback stay separate',async()=>{
   const p=await open('portrait',390,844,'dark','authenticated');try{assert.equal(await p.locator('.editorial-pauta-modal').count(),0);assertFrame(await geometry(p));assert.ok((await p.evaluate(()=>window.fixtureCalls)).some(x=>x.url==='/api/auth/session'));}finally{await p.close();}
   for(const shape of ['square','portrait','story','landscape','carousel','video-story','video-landscape']){
    const p=await open(shape,390,844,'dark','public');try{await p.locator('.produced-post-public').waitFor();assertFrame(await geometry(p));if(shape==='carousel'){await p.getByRole('button',{name:'Próxima arte',exact:true}).click();await loaded(p);assertFrame(await geometry(p));}
     await p.getByLabel('Seu nome').fill('Marina');await p.getByLabel('Comentário',{exact:true}).fill('Revisar a abertura.');await p.getByRole('button',{name:'Solicitar alteração'}).click();await p.getByRole('status').waitFor();assert.deepEqual((await p.evaluate(()=>window.fixtureCalls.filter(x=>x.method!=='GET'))).map(x=>x.body),[{approved:false,commentText:'Revisar a abertura.',requesterName:'Marina'}]);await p.screenshot({type:'jpeg',quality:80,path:path.join(artifacts,`public-${shape}-mobile-dark.jpg`),fullPage:true});
    }finally{await p.close();}
   }
   const primary=await open('carousel',390,844,'light','public',false,'&primary');try{const m=await geometry(primary);assertFrame(m);assert.equal(m.ratio,.8);assert.equal(await primary.locator('.artwork-carousel-slide').count(),4);}finally{await primary.close();}
   const pauta=await open('square',390,844,'dark','portal',false,'&pauta');try{assert.equal(await pauta.locator('.editorial-pauta-modal').count(),1);assert.equal(await pauta.locator('.modal-media img').evaluate(el=>getComputedStyle(el).maxHeight),'320px');}finally{await pauta.close();}
   const post=await open('portrait',1440,1100,'light');try{const original=await post.evaluate(()=>JSON.stringify(window.fixtureDetail));const comment=post.getByRole('textbox',{name:'Comentário',exact:true});await comment.fill('Revisar a abertura.');await post.getByRole('button',{name:'Comentar',exact:true}).click();await comment.fill('Ajustar o exemplo.');await post.getByRole('button',{name:'Pedir alteração',exact:true}).click();await post.getByRole('button',{name:'Aprovar',exact:true}).click();assert.deepEqual((await post.evaluate(()=>window.fixtureActions)).map(x=>x.kind),['comment','changes','approve']);assert.equal(await post.evaluate(()=>JSON.stringify(window.fixtureDetail)),original);}finally{await post.close();}
  });
  await writeFile(path.join(artifacts,'evidence.json'),JSON.stringify({baselineCommit,evidence},null,2));console.log(`Visual evidence: ${artifacts}`);
 }finally{await browser?.close();await server.close();}
});
