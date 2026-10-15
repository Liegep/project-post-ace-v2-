import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { App, CardDetailModal, PublicApprovalPage, PautasWorkspace } from "../src/App";
import type { CardDetail } from "../src/types";
import "../src/styles.css";
const params = new URLSearchParams(location.search), scenario = params.get("view") ?? "portal";
const title = "Uma pausa para observar o cotidiano", caption = "Antes de mudar a rotina, observe os pequenos sinais.\n\nQual momento do seu dia merece mais atenção?";
const brief = { concept: "Transformar a observação em um cuidado cotidiano.", hook: "O que os pequenos sinais podem nos ensinar?", description: "Um carrossel com três situações simples para reconhecer mudanças na rotina.", objective: "Ajudar o público a observar com mais atenção.", rationale: "Aproxima informação e experiência, com uma abordagem acolhedora.", sourceSummary: "A publicação apresenta exemplos de observação no dia a dia.", sourceTitle: "Observação e rotina", sourceUrl: "https://example.invalid/observacao", sourceDate: "2026-10-15" };
const injected = { ...brief, internalNotes: "PRIVATE_STRATEGY", alignmentScore: 99, aiModel: "TECHNICAL_MODEL", pillar: "PRIVATE_PILLAR" };
const detail: CardDetail = { card: { id: "synthetic-card", title, subtitle: params.has("empty") ? undefined : caption, editorialBrief: params.has("empty") ? null : injected, mediaAspect: "square", mediaUrls: [], typeLabel: "Carrossel", statusBadges: params.has("approved") ? ["Aprovado"] : ["Enviar para Cliente", "Design pronto"], tags: ["PRIVATE_TAG"], commentsCount: 1, clientLabel: params.has("approved") ? "Aprovado pelo cliente" : "Pendente", approvalRevision: 2, approvalState: params.has("approved") ? "approved" : "pending", isBriefApproval: true }, comments: [{ id: "comment", authorName: "Marina", authorRole: "cliente", commentText: "Podemos trazer um exemplo da rotina na primeira imagem?", isInternal: false, createdAt: "2026-10-15T09:00:00Z" }], approvalLinks: [], approvalEvents: [] };
if (params.has("media")) detail.card.mediaUrls = ['data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#efecf7"/><circle cx="400" cy="250" r="100" fill="#c9c1e0"/></svg>')];
// Synthetic produced media retain a briefing, as real posts do after production.
const shape = params.get("shape");
if (shape) {
 detail.card.isBriefApproval = params.has("pauta");
 detail.card.typeLabel = shape.startsWith("video") ? "Reels" : "Post";
 detail.card.mediaType = shape.startsWith("video") ? "video" : "image";
 const image = (width: number, height: number) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#154653"/><rect x="12" y="12" width="${width-24}" height="${height-24}" rx="24" fill="#e7bf9b"/><circle cx="${width/2}" cy="${height/2}" r="${Math.min(width,height)/4}" fill="#507d85"/><text x="50%" y="18%" text-anchor="middle" font-family="sans-serif" font-size="${Math.min(width,height)/14}" fill="#154653">${width} × ${height}</text></svg>`);
 const dimensions: Record<string, [number,number]> = { square: [800,800], landscape: [1280,720], portrait: [800,1000], story: [720,1280] };
 detail.card.mediaUrls = shape.startsWith("video") ? [`/tests/synthetic-${shape}.webm`] : shape === "carousel" ? [image(800,800),image(800,1000),image(1280,720),image(720,1280)] : [image(...(dimensions[shape] ?? dimensions.square))];
}
const apiCard = { ...detail.card, caption: detail.card.subtitle ?? null, mediaType: detail.card.mediaType ?? "image", primaryMediaUrl: params.has("primary") ? detail.card.mediaUrls?.[1] ?? null : null, mediaUrls: detail.card.mediaUrls ?? [], artType: "carousel", status: detail.card.statusBadges, commentsCount: 1, scheduledAt: null };
if (scenario === "authenticated") {
 localStorage.setItem("designhub-v2-access-token", "synthetic-access-token");
 localStorage.setItem("designhub-v2-session", JSON.stringify({id:"synthetic-user",name:"Marina",email:"marina@invalid.test",role:"client",locale:"pt",assignedAdminSlugs:[],assignedPortalSlugs:["synthetic"],source:"api",accessToken:"synthetic-access-token"}));
}
const preview = { eligible: !params.has("blocked"), blockers: params.has("blocked") ? ["Existe aprovação anterior; recuperação exige um fluxo separado de revisão."] : [], previewToken: "synthetic-preview-token", revision: 2, currentTitle: title, currentCaption: caption, currentBrief: detail.card.editorialBrief, recoverableBrief: brief, additions: { hook: brief.hook }, bankAdditions: { hook: brief.hook }, divergences: [], unavailable: [], effects: { activeLinksToInvalidate: 1, newRevision: 3, requiresNewApproval: true, preservesDescriptionCaptionMediaStatus: true } };
const fixture = window as typeof window & { fixtureCalls: Array<{ url: string; method: string; body?: unknown }>; fixtureActions: unknown[]; fixtureDetail: CardDetail };
fixture.fixtureCalls = []; fixture.fixtureActions = []; fixture.fixtureDetail = detail;
window.fetch = async (input, init) => {
 const url = String(input), method = init?.method ?? "GET", body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
 fixture.fixtureCalls.push({ url, method, body }); let data: unknown;
 if (method !== "GET") {
  if (url.endsWith("editorial-brief-recovery") && body?.confirm === true && body?.previewToken === "synthetic-preview-token") data = { applied: true, card: detail.card };
  else if (url === "/api/portal/approval/synthetic/decision") data = { ok: true };
  else throw Error(`Unexpected fixture write ${method} ${url}`);
 } else if (url === "/api/auth/session") data = { authenticated: true, user: { id:"synthetic-user", fullName:"Marina", email:"marina@invalid.test", globalRole:"cliente", locale:"pt", isActive:true }, memberships: [{clientAccountId:"synthetic-client",clientSlug:"synthetic",clientName:"Cliente de demonstração",membershipRole:"cliente"}] };
 else if (url === "/api/portal/accounts") data = { items:[{clientAccountId:"synthetic-client",clientSlug:"synthetic",clientName:"Cliente de demonstração"}] };
 else if (url.endsWith("/home")) data = {account:{name:"Cliente de demonstração",locale:"pt",trackingEnabled:false,showArchivedToClient:false},accessLevel:"approver",permissions:{allowClientEditCaption:false,allowClientCreatePost:false,allowClientCreateTags:false,allowClientViewTexts:false,allowClientViewReports:false,allowClientViewInvoices:false,allowClientViewBrandBrain:false},widgets:{showCalendar:false,showUpcomingPosts:false,showReports:false,showInvoices:false,showTexts:false,showStats:false},postCreationColumns:[],upcomingItems:[],calendarPosts:[]};
 else if (url === "/api/portal/accounts/synthetic-client/board") data = {board:{columns:[{id:"column",name:"Pautas para aprovação",color:"#6953bd",visibleToClient:true,cards:[apiCard]}],withoutColumn:{cards:[]}}};
 else if (url === "/api/portal/accounts/synthetic-client/cards/synthetic-card") data = {card:apiCard,comments:detail.comments,approvalLinks:[]};
 else if (url.endsWith("/contracts/pending")) data = {contract:null};
 else if (/\/(briefs|texts|reports|invoices)(\?|$)/.test(url)) data = {items:[]};
 else if (url === "/api/clients") data = { items: [{ id: "synthetic-client", slug: "synthetic", name: "Cliente de demonstração" }] };
 else if (url.endsWith("/workspace-drawer")) data = { data: { pautaIdeas: [{ id: "idea", title, caption, ...brief, status: "draft", createdAt: "2026-10-15", createdBy: "radar" }] } };
 else if (url.endsWith("/board")) data = { client: { id: "synthetic-client", name: "Cliente de demonstração", slug: "synthetic" }, board: { columns: [], withoutColumn: { cards: [] } } };
 else if (url.endsWith("/brand-brain")) data = { data: {}, revisions: [], history: [], comments: [], meta: {} };
 else if (url.endsWith("editorial-brief-recovery/preview")) data = preview;
 else if (url === "/api/portal/approval/synthetic") data = { account: { name: "Cliente de demonstração", locale: "pt-BR" }, card: apiCard };
 else if (url.includes("time-entries")) data = { items: [], active: null, totalSeconds: 0 };
 else if (url.includes("tags") || url.includes("hashtag") || url.includes("reviewers")) data = { items: [] };
 else throw Error(`Unexpected fixture read ${url}`);
 return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
};
const action = (kind: string) => async (...args: unknown[]) => { fixture.fixtureActions.push({ kind, args }); };
const portal = <CardDetailModal mode={scenario === "kanban" ? "admin" : "portal"} titlePrefix="Card do cliente" detail={detail} loading={false} source="backend" onAddComment={action("comment")} onApprove={action("approve")} onRequestChanges={action("changes")} canRespond={!params.has("readonly")} allowManageTags onRefresh={()=>{}} onClose={()=>fixture.fixtureActions.push({kind:"close"})} adminContext={scenario === "kanban" ? { slug: "synthetic", columns: [], canScheduleMeta: false } : undefined}/>;
createRoot(document.getElementById("root")!).render(<MemoryRouter initialEntries={[scenario === "authenticated" ? "/portal/synthetic" : "/approval/synthetic"]}>{scenario === "authenticated" ? <App/> : scenario === "reference" ? <PautasWorkspace slug="synthetic" clientName="Cliente de demonstração" columns={[]} onSent={()=>{}}/> : scenario === "public" ? <Routes><Route path="/approval/:token" element={<PublicApprovalPage/>}/></Routes> : portal}</MemoryRouter>);
