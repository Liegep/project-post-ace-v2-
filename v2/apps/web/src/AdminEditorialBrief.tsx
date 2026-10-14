import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorialBrief } from "./EditorialBrief";
import { applyAdminBriefRecovery, previewAdminBriefRecovery, type BriefRecoveryPreview } from "./api";
import type { BoardCard } from "./types";

const labels: Record<string,string> = { title:"Título",caption:"Legenda",concept:"Ideia central",hook:"Gancho",description:"Descrição",rationale:"Justificativa editorial",objective:"Objetivo",cta:"Chamada para ação",sourceSummary:"Resumo factual",sourceTitle:"Fonte",sourceUrl:"URL da fonte",sourceDate:"Data da fonte" };

// Only hide impossible actions here. Eligibility, permissions and the signed
// preview are still checked by the existing server before every application.
export function canOfferBriefRecovery(card: BoardCard) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const approved = [card.clientLabel, ...(card.statusBadges ?? []), ...(card.tags ?? [])].filter(Boolean).some(value => /^(aprovad[oa]|aprovado pelo cliente|pautas? aprovad[ao]s?)$/.test(normalize(value)));
  return Boolean(card.isBriefApproval && card.approvalState !== "approved" && card.approvalState !== "changes_requested" && card.latestApprovalAction !== "approved" && !approved && !card.archived && !card.archivedAt && !card.scheduledAt && !card.publishedAt);
}

export function RecoveryPreview({ preview }: { preview:BriefRecoveryPreview }) {
  if (!preview.eligible) return <section className="brief-recovery-preview" aria-label="Prévia da recuperação"><h3>Recuperação indisponível</h3>{preview.blockers.map(reason => <p role="status" key={reason}>{reason}</p>)}</section>;
  return <section className="brief-recovery-preview" aria-label="Prévia da recuperação"><h3>Prévia completa após recuperação — ainda não aplicada</h3>
    <h4>{preview.currentTitle}</h4>
    <EditorialBrief brief={preview.recoverableBrief} caption={preview.currentCaption}/>
    {preview.currentCaption?<div className="brief-recovery-caption"><strong>Legenda atual — será preservada</strong><p>{preview.currentCaption}</p></div>:null}
    <details><summary>Conferir os campos da recuperação</summary>
      <details><summary>Conteúdo atual salvo — sem recuperação</summary><EditorialBrief brief={preview.currentBrief} caption={preview.currentCaption}/>{!preview.currentBrief?<p>Sem briefing editorial salvo.</p>:null}</details>
      <details><summary>Conteúdo recuperável — ainda não aplicado</summary><EditorialBrief brief={preview.additions}/></details>
      {Object.keys(preview.bankAdditions).length ? <p>Também serão complementados no Banco de Pautas: {Object.keys(preview.bankAdditions).map(field=>labels[field]).filter(Boolean).join(", ")}.</p> : null}
      {preview.divergences.length ? <details><summary>Divergências — valores existentes serão mantidos</summary>{preview.divergences.map(row=><div key={row.field}><strong>{labels[row.field]||"Campo editorial"}</strong><p>Na pauta: {String(row.pauta??"Não disponível")}</p><p>No briefing atual: {String(row.current??"Não disponível")}</p><p>Na sugestão original: {row.original}</p></div>)}</details> : null}
      {preview.unavailable.includes("sourceSummary") ? <p>Resumo factual indisponível na sugestão original. Nenhum texto será reconstruído.</p> : null}
    </details>
    <p>Somente campos ausentes serão complementados. Descrição, legenda, mídias e status existentes serão preservados.</p>
    <p className="brief-recovery-effects" role="status"><strong>A recuperação cria uma nova revisão e exige nova aprovação do briefing. Os links públicos ativos ({preview.effects.activeLinksToInvalidate}) serão encerrados. Nenhum reenvio será feito automaticamente.</strong></p>
  </section>;
}

function RecoveryDialog({ children, busy, onClose, returnFocusTo }: { children: React.ReactNode; busy: boolean; onClose: () => void; returnFocusTo: HTMLElement | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = returnFocusTo ?? document.activeElement as HTMLElement | null;
    element.showModal();
    return () => { element.close(); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  return createPortal(<dialog ref={dialog} className="pauta-modal brief-recovery-dialog" aria-labelledby={headingId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><h2 id={headingId}>Recuperar briefing</h2><button type="button" aria-label="Fechar prévia da recuperação" disabled={busy} onClick={onClose}>×</button></header>
    {children}
  </dialog>, document.body);
}

export function AdminEditorialBrief({card,slug,onRecovered,disabledReason,hasPreviousApproval = false}:{card:BoardCard;slug:string;onRecovered:()=>void;disabledReason?:string;hasPreviousApproval?:boolean}) {
  const [preview,setPreview]=useState<BriefRecoveryPreview|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const recoveryTrigger = useRef<HTMLButtonElement>(null);
  const offerRecovery = !hasPreviousApproval && canOfferBriefRecovery(card);
  useEffect(() => { setPreview(null); setConfirmed(false); setRecoveryOpen(false); }, [card.id, card.approvalRevision]);
  async function inspect() {
    if (disabledReason || !offerRecovery || busy) return;
    setRecoveryOpen(true);setBusy(true);setMessage("");setConfirmed(false);setPreview(null);
    try {setPreview(await previewAdminBriefRecovery(slug,card.id));}
    catch(error){setMessage(error instanceof Error?error.message:"Não foi possível consultar a prévia.");}finally{setBusy(false);}
  }
  async function apply() {
    if(disabledReason||!offerRecovery||busy||!confirmed||!preview?.eligible||!preview.previewToken)return;
    setBusy(true);setMessage("");
    try {await applyAdminBriefRecovery(slug,card.id,preview.previewToken);setPreview(null);setConfirmed(false);setRecoveryOpen(false);setMessage("Briefing recuperado. Confira a nova revisão antes de solicitar a aprovação.");onRecovered();}
    catch(error){setMessage(error instanceof Error?error.message:"Não foi possível concluir. Consulte o resultado antes de repetir.");}finally{setBusy(false);}
  }
  if (!card.isBriefApproval && !card.editorialBrief) return null;
  return <details className="admin-editorial-brief">
    <summary><span>Briefing editorial atual</span><small>Direção editorial e fonte</small></summary>
    <div className="admin-editorial-brief-content">
      {card.editorialBrief?<EditorialBrief brief={card.editorialBrief} caption={card.subtitle}/>:<p>Este card ainda não possui briefing editorial salvo.</p>}
      {offerRecovery?<button ref={recoveryTrigger} className="drawer-secondary-action" type="button" disabled={busy||!!disabledReason} onClick={()=>void inspect()}>Consultar prévia de recuperação</button>:null}
      {disabledReason && offerRecovery?<p role="status">{disabledReason}</p>:null}
      {message && !recoveryOpen?<p role="status">{message}</p>:null}
    </div>
    {recoveryOpen && offerRecovery?<RecoveryDialog busy={busy} returnFocusTo={recoveryTrigger.current} onClose={()=>setRecoveryOpen(false)}>
      {busy && !preview?<p role="status">Consultando os campos disponíveis…</p>:null}
      {preview?<RecoveryPreview preview={preview}/>:null}
      {message?<p role="alert">{message}</p>:null}
      {disabledReason?<p role="status">{disabledReason}</p>:null}
      {preview?.eligible?<div className="brief-recovery-confirmation"><label><input type="checkbox" checked={confirmed} disabled={busy||!!disabledReason} onChange={event=>setConfirmed(event.target.checked)}/><span>Autorizo complementar os campos ausentes e encerrar os links antigos. Entendo que a nova revisão exige aprovação.</span></label><button className="gradient-button" type="button" disabled={busy||!confirmed||!!disabledReason} onClick={()=>void apply()}>{busy?"Processando...":"Confirmar recuperação desta pauta"}</button></div>:null}
    </RecoveryDialog>:null}
  </details>;
}
