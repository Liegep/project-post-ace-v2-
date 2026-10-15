import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {MemoryRouter} from "react-router-dom";
import {CardDetailModal} from "../src/App";
import "../src/styles.css";
const media='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#ccad88"/></svg>');
let server:any={id:"card",clientAccountId:"client",title:"Synthetic pauta",caption:"Original caption",columnId:"pauta",isBriefApproval:true,approvalState:"approved",approvalRevision:1,clientLabel:"Aprovado pelo cliente",status:["Aprovado"],mediaUrls:[media],primaryMediaUrl:media,mediaType:"image",artType:"single_post",tags:["Campanha"],hashtags:[],commentsCount:1};
const calls:any[]=[],events:any[]=[{action:"approved",revision:1}];let refresh=()=>{};let gate:Promise<void>|undefined,release:()=>void;
const win=window as any;
const convert=()=>{server={...server,isBriefApproval:false,approvalState:"pending",approvalRevision:2,clientLabel:"Pendente",status:["Enviar para Cliente"],columnId:"work"};events.push({action:"converted_to_post",revision:2});};
win.stateFixture={calls,events,snapshot:()=>structuredClone(server),convert:()=>{convert();refresh();},hold:()=>{gate=new Promise(resolve=>release=resolve);},release:()=>{release?.();gate=undefined;}};
const board=()=>({...server,subtitle:server.caption,typeLabel:server.artType,statusBadges:server.status,mediaAspect:"portrait" as const,commentsCount:1});
if(new URLSearchParams(location.search).has("recovered"))localStorage.setItem("designhub-v2-card-draft:synthetic:card",JSON.stringify({approvalRevision:1,title:server.title,caption:"Recovered caption",artType:"single_post",columnId:"pauta",status:"Aprovado",clientLabel:"Aprovado pelo cliente",priorityLevel:"",tags:"Campanha",hashtags:"",scheduledAt:"",externalLinkUrl:"",mediaUrls:[media],isBriefApproval:true}));
if(new URLSearchParams(location.search).has("converted"))convert();
window.fetch=async(input,init)=>{
 const url=String(input),method=init?.method??"GET",body=typeof init?.body==="string"?JSON.parse(init.body):undefined;calls.push({url,method,body});let data:any;
 if(method==="PATCH"&&url.endsWith("/cards/card")){
  if(gate)await gate;
  if(body.expectedApprovalRevision!==server.approvalRevision)return new Response(JSON.stringify({message:"Revision changed"}),{status:409});
  if("isBriefApproval" in body)throw Error("Ordinary editor must not send classification");
  server={...server,...body};data={ok:true,card:server};
 }else if(method==="POST"&&url.endsWith("/move")){if(server.isBriefApproval&&server.approvalState==="approved")convert();server={...server,columnId:body.columnId};data={ok:true,card:server};}
 else if(method!=="GET")throw Error(`Unexpected write ${method} ${url}`);
 else if(url==="/api/clients")data={items:[{id:"client",slug:"synthetic",name:"Synthetic"}]};
 else if(url.includes("time-entries"))data={items:[],active:null,totalSeconds:0};
 else if(/tags|hashtag|reviewers/.test(url))data={items:[]};
 else throw Error(`Unexpected read ${url}`);
 return new Response(JSON.stringify(data),{headers:{"Content-Type":"application/json"}});
};
function Harness(){const [card,setCard]=useState(board),[open,setOpen]=useState(true);refresh=()=>setCard(board());
 const columns=[{id:"pauta",name:"Pauta aprovada",cards:[],color:"#7568dc",visibleToClient:false},{id:"work",name:"Waiting approval",cards:[],color:"#7568dc",visibleToClient:true}];
 return <><button onClick={()=>{setCard(board());setOpen(true);}}>Reabrir editor</button>{open?<CardDetailModal mode="admin" titlePrefix="Synthetic" detail={{card,comments:[{id:"comment",authorName:"Client",authorRole:"cliente",commentText:"Preserved comment",isInternal:false,createdAt:"2026-10-15"}],approvalLinks:[],approvalEvents:[]}} loading={false} source="backend" onAddComment={async()=>{}} onRefresh={refresh} onClose={()=>setOpen(false)} adminContext={{slug:"synthetic",columns,canScheduleMeta:false}}/>:null}</>;
}
createRoot(document.getElementById("root")!).render(<MemoryRouter><Harness/></MemoryRouter>);
