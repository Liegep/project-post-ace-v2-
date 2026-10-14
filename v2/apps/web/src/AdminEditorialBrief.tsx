import React, { useState } from "react";
import { EditorialBrief } from "./EditorialBrief";
import { applyAdminBriefRecovery, previewAdminBriefRecovery, type BriefRecoveryPreview } from "./api";
import type { BoardCard } from "./types";

const labels: Record<string,string> = { title:"Título",caption:"Legenda",concept:"Ideia central",hook:"Gancho",description:"Descrição",rationale:"Justificativa editorial",objective:"Objetivo",cta:"Chamada para ação",sourceSummary:"Resumo factual",sourceTitle:"Fonte",sourceUrl:"URL da fonte",sourceDate:"Data da fonte" };
export function RecoveryPreview({ preview }: { preview:BriefRecoveryPreview }) {
  return <section aria-label="Prévia da recuperação"><h4>Conteúdo recuperável — ainda não aplicado</h4>
    <p>Somente campos ausentes serão complementados. Descrição, legenda, mídias e status existentes serão preservados.</p>
    <EditorialBrief brief={preview.additions} />
    {Object.keys(preview.bankAdditions).length ? <p>Também serão complementados no Banco de Pautas: {Object.keys(preview.bankAdditions).map(field=>labels[field]||field).join(", ")}.</p> : null}
    {preview.divergences.length ? <details><summary>Divergências — valores existentes serão mantidos</summary>{preview.divergences.map(row=><div key={row.field}><strong>{labels[row.field]||row.field}</strong><p>Na pauta: {String(row.pauta??"Não disponível")}</p><p>No briefing atual: {String(row.current??"Não disponível")}</p><p>Na sugestão original: {row.original}</p></div>)}</details> : null}
    {preview.unavailable.includes("sourceSummary") ? <p>Resumo factual indisponível na sugestão original. Nenhum texto será reconstruído.</p> : null}
    {preview.blockers.map(reason=><p role="status" key={reason}>{reason}</p>)}
    {preview.eligible ? <p role="status"><strong>A recuperação cria uma nova revisão e exige nova aprovação do briefing. Os links públicos ativos ({preview.effects.activeLinksToInvalidate}) serão encerrados. Nenhum reenvio será feito automaticamente.</strong></p> : null}
  </section>;
}
export function AdminEditorialBrief({card,slug,onRecovered,disabledReason}:{card:BoardCard;slug:string;onRecovered:()=>void;disabledReason?:string}) {
  const [preview,setPreview]=useState<BriefRecoveryPreview|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function inspect() {
    setBusy(true);setMessage("");setConfirmed(false);setPreview(null);
    try {setPreview(await previewAdminBriefRecovery(slug,card.id));}
    catch(error){setMessage(error instanceof Error?error.message:"Não foi possível consultar a prévia.");}finally{setBusy(false);}
  }
  async function apply() {
    if(disabledReason||!confirmed||!preview?.eligible||!preview.previewToken)return;
    setBusy(true);setMessage("");
    try {await applyAdminBriefRecovery(slug,card.id,preview.previewToken);setPreview(null);setConfirmed(false);setMessage("Briefing recuperado. Confira a nova revisão antes de solicitar a aprovação.");onRecovered();}
    catch(error){setMessage(error instanceof Error?error.message:"Não foi possível concluir. Consulte o resultado antes de repetir.");}finally{setBusy(false);}
  }
  if (!card.isBriefApproval && !card.editorialBrief) return null;
  return <section className="portal-summary-card"><h4>Briefing editorial atual</h4>
    {card.editorialBrief?<EditorialBrief brief={card.editorialBrief} caption={card.subtitle}/>:<p>Este card ainda não possui briefing editorial salvo.</p>}
    {card.isBriefApproval?<><button className="drawer-secondary-action" type="button" disabled={busy||!!disabledReason} onClick={()=>void inspect()}>Consultar prévia de recuperação</button>
      {preview?<><RecoveryPreview preview={preview}/>{preview.eligible?<><label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/> Autorizo complementar os campos ausentes e encerrar os links antigos. Entendo que a nova revisão exige aprovação.</label><button className="gradient-button" type="button" disabled={busy||!confirmed||!!disabledReason} onClick={()=>void apply()}>{busy?"Processando...":"Confirmar recuperação desta pauta"}</button></>:null}</>:null}</>:null}
    {disabledReason?<p role="status">{disabledReason}</p>:null}
    {message?<p role="status">{message}</p>:null}
  </section>;
}
