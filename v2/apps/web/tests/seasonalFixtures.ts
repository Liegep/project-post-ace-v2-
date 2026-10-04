// Local test/visual-review data; never imported by the production entry point.
import { ISO_COUNTRY_CODES } from '../../api/src/modules/seasonal/iso-countries';
import type { SeasonalOccurrence, SeasonalMonitor } from '../src/api';
export const previewToday='2026-10-04';
export const previewClients=[{id:'client-a',name:'Estúdio Aurora',slug:'estudio-aurora',locale:'it'},{id:'client-b',name:'Casa Lume',slug:'casa-lume',locale:'sv'}];
const timestamp='2026-10-04T09:00:00Z';
const monitor=(code:string,active=true):SeasonalMonitor=>({countryCode:code,active,createdAt:timestamp,updatedAt:timestamp});
export function seasonalFixture(scenario='populated'){
 const calls:Array<{path:string;method:string;body:any;query:string}>=[];
 const countries:SeasonalMonitor[]=scenario==='empty'||scenario==='global'?[]:[monitor('BR'),monitor('IT'),monitor('SE',false)];
 const markets:Record<string,string[]>={'client-a':scenario==='empty'?[]:['BR','IT'],'client-b':[]};
 const event=(id:string,title:string,date:string,categoryCode:string,countryCodes:string[],description=''):SeasonalOccurrence=>({id,opportunityId:id,occurrenceId:id,title,date,categoryCode,countryCodes,description,scope:countryCodes.length?'countries':'global',origin:'manual',year:Number(date.slice(0,4)),externalSource:null,externalReference:null,regionalScope:null,daysUntil:(Date.parse(date)-Date.parse(previewToday))/86400000,relatedClients:[]});
 const records=scenario==='empty'?[]:[event('coffee','Dia de celebrar o café','2026-10-05','cultural',['BR','IT'],'Histórias que aproximam: os rituais, as pessoas e as pequenas pausas do dia a dia.'),event('global','Dia Mundial da Saúde Mental','2026-10-10','cultural',[]),event('holiday','Nossa Senhora Aparecida','2026-10-12','feriado',['BR']),event('autumn','Sabores de outono','2026-10-18','sazonal',['IT']),event('commercial','Black Friday','2026-11-27','comercial',['BR','IT'])];
 if(scenario==='global')records.splice(0,records.length,event('global','Dia Mundial da Saúde Mental','2026-10-10','cultural',[],'Uma conversa sobre cuidado, bem-estar e acolhimento.'));
 if(scenario==='regional')records[0].regionalScope={nationwide:false,subdivisions:['BR-SP']};
 if(scenario==='many')for(let i=0;i<65;i++)records.push(event('extra-'+i,'Oportunidade '+i,'2026-12-01','cultural',['BR']));
 let fail=false;
 const fetcher:typeof fetch=async(input,init)=>{
  const url=new URL(String(input),'http://localhost'),path=url.pathname,method=init?.method??'GET',body=init?.body?JSON.parse(String(init.body)):null;
  if(!path.startsWith('/api/'))throw new Error('Preview refuses outgoing requests: '+url);
  calls.push({path,method,body,query:url.search});
  if(fail&&path==='/api/seasonal/radar')return new Response(JSON.stringify({message:'Falha controlada do radar'}),{status:503});
  let response:any={items:[]};
  if(path==='/api/auth/session')response={authenticated:true,user:{id:'preview-user',fullName:'Revisão visual',email:'preview@invalid.test',globalRole:'super_admin',locale:'pt'},memberships:[]};
  else if(path==='/api/clients')response={items:previewClients};
  else if(path==='/api/seasonal/countries')response={countryCodes:ISO_COUNTRY_CODES};
  else if(path==='/api/seasonal/categories')response={items:[{code:'feriado',label:'Feriado'},{code:'cultural',label:'Cultural'},{code:'comercial',label:'Comercial'},{code:'sazonal',label:'Sazonal'}]};
  else if(path.startsWith('/api/seasonal/monitored-countries')){if(method==='PUT'){const code=path.split('/').pop()!,row=countries.find(x=>x.countryCode===code);if(row)row.active=body.active;else countries.push(monitor(code,body.active));}response={items:countries,today:previewToday};}
  else if(path.endsWith('/editorial-markets')){const client=path.split('/')[3];if(method==='PUT')markets[client]=body.countryCodes;response={items:(markets[client]??[]).map(code=>({...monitor(code),confirmedByUserId:'preview-user'}))};}
  else if(path==='/api/seasonal/radar'){
   const from=url.searchParams.get('from')??'',to=url.searchParams.get('to')??'',country=url.searchParams.get('countryCode'),category=url.searchParams.get('categoryCode'),client=url.searchParams.get('clientId');
   const related=(item:SeasonalOccurrence)=>item.regionalScope&&!item.regionalScope.nationwide?[]:previewClients.filter(c=>markets[c.id].length>0&&(item.scope==='global'||item.countryCodes.some(code=>markets[c.id].includes(code))));
   const items=records.filter(x=>x.date>=from&&x.date<=to&&(x.scope==='global'||x.countryCodes.some(code=>countries.some(c=>c.active&&c.countryCode===code)))&&(!country||x.scope==='global'||x.countryCodes.includes(country))&&(!category||x.categoryCode===category)&&(!client||related(x).some(c=>c.id===client))).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(x=>({...x,relatedClients:related(x).map(({id,name,slug})=>({id,name,slug}))}));
   const offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??50);response={items:items.slice(offset,offset+limit),total:items.length,offset,limit,hasMore:offset+limit<items.length,today:previewToday,warnings:scenario==='warning'?[{countryCode:'IT',year:2026,message:'Provider unavailable'}]:[]};
  }else if(path==='/api/seasonal/opportunities'&&method==='POST')response={id:'preview-new'};
  else if(path.endsWith('/cards')&&method==='POST')response={card:{...body,id:'preview-pauta',mediaType:'image',mediaUrls:[],commentsCount:0}};
  return new Response(JSON.stringify(response),{headers:{'Content-Type':'application/json'}});
 };
 return {fetch:fetcher,calls,countries,markets,records,setFailure:(value:boolean)=>{fail=value;}};
}
