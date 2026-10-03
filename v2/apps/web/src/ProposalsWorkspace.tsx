import React, { useEffect, useRef, useState } from "react";
import { createAdminProposal, deleteAdminProposal, listAdminProposals, updateAdminProposal, type ProposalRecord } from "./api";
import { getProposalLocale, proposalLocales, ProposalClientPreview } from "./proposalPresentation";

type ProposalInput = Parameters<typeof createAdminProposal>[0];
const statuses: Record<ProposalRecord["status"], string> = {
  draft: "Rascunho", sent: "Enviada", viewed: "Visualizada", accepted: "Aceita", refused: "Recusada", expired: "Expirada",
};
export const emptyProposal = (): ProposalRecord => ({
  id: "", token: "", clientName: "", email: "", locale: "Português", proposalType: "Projeto", plan: "", pieces: 0,
  scope: "", investment: "", currency: "R$", expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  status: "draft", services: [{ name: "", value: 0, description: "" }],
});
function editable(proposal: ProposalRecord): ProposalInput {
  const { id: _id, token: _token, acceptedAt: _acceptedAt, viewedAt: _viewedAt, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = proposal;
  return input;
}
const amount = (proposal: ProposalRecord) => `${proposal.currency} ${proposal.services.reduce((sum, item) => sum + Number(item.value || 0), 0).toLocaleString(getProposalLocale(proposal.locale).code, { minimumFractionDigits: 2 })}`;

export function ProposalsWorkspace({ newProposalSignal = 0, brandLogo }: { newProposalSignal?: number; brandLogo: string }) {
  const [proposals, setProposals] = useState<ProposalRecord[]>([]);
  const [draft, setDraft] = useState(emptyProposal);
  const [view, setView] = useState<"editor" | "preview">("editor");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const timer = useRef<number | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const busy = useRef(false);
  const lastSignal = useRef(newProposalSignal);
  const mounted = useRef(true);
  const cancelTimer = () => { if (timer.current !== null) window.clearTimeout(timer.current); timer.current = null; };
  const replaceDraft = (value: ProposalRecord, changed = false) => {
    draftRef.current = value; dirtyRef.current = changed; setDraft(value); setDirty(changed);
  };
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void listAdminProposals().then((result) => { if (active) setProposals(result.items); })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Não foi possível carregar as propostas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; cancelTimer(); };
  }, []);

  // Serialize existing autosaves with explicit actions: a delayed draft PATCH must never undo sending.
  const persist = (snapshot: ProposalRecord) => {
    const operation = queue.current.catch(() => {}).then(async () => {
      const result = snapshot.id ? await updateAdminProposal(snapshot.id, editable(snapshot)) : await createAdminProposal(editable(snapshot));
      if (mounted.current) {
        setProposals((current) => [result.proposal, ...current.filter((item) => item.id !== result.proposal.id)]);
        if (draftRef.current === snapshot) replaceDraft(result.proposal);
      }
      return result.proposal;
    });
    queue.current = operation;
    return operation;
  };
  const update = (patch: Partial<ProposalRecord>) => {
    const next = { ...draftRef.current, ...patch };
    replaceDraft(next, true); setMessage(""); cancelTimer();
    // A new proposal has no ID. Only existing proposals retain their 500ms autosave.
    if (next.id) timer.current = window.setTimeout(() => {
      timer.current = null;
      void persist(next).catch((error) => { if (mounted.current) setMessage(error instanceof Error ? error.message : "Não foi possível salvar a proposta."); });
    }, 500);
  };
  const mayLeave = () => !busy.current && (!dirtyRef.current || window.confirm("Há alterações não salvas. Deseja descartá-las?"));
  const startNew = () => { if (!mayLeave()) return; cancelTimer(); replaceDraft(emptyProposal()); setView("editor"); setMessage(""); };
  const select = (proposal: ProposalRecord) => { if (proposal.id === draftRef.current.id || !mayLeave()) return; cancelTimer(); replaceDraft(proposal); setView("editor"); setMessage(""); };
  useEffect(() => { if (newProposalSignal !== lastSignal.current) { lastSignal.current = newProposalSignal; startNew(); } }, [newProposalSignal]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = async (send = false) => {
    if (busy.current) return;
    busy.current = true; setSaving(true); cancelTimer(); setMessage("");
    const snapshot = send ? { ...draftRef.current, status: "sent" as const, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() } : draftRef.current;
    try {
      const result = await persist(snapshot);
      if (mounted.current) { replaceDraft(result); setMessage(send ? "Proposta enviada. O link está disponível para compartilhar." : "Proposta salva."); if (send) setView("preview"); }
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : "Não foi possível salvar a proposta."); }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  };
  const remove = async () => {
    if (!draft.id || busy.current || !window.confirm("Excluir esta proposta?")) return;
    busy.current = true; setSaving(true); cancelTimer();
    try { await queue.current.catch(() => {}); await deleteAdminProposal(draft.id); setProposals((current) => current.filter((item) => item.id !== draft.id)); replaceDraft(emptyProposal()); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível excluir a proposta."); }
    finally { busy.current = false; setSaving(false); }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/#/proposta/${draft.token}`); setMessage("Link copiado."); }
    catch { setMessage("Não foi possível copiar o link."); }
  };
  useEffect(() => {
    if (view !== "preview") return;
    const elements = Array.from(document.querySelectorAll(".proposal-preview-shell .proposal-client-content > section, .proposal-preview-shell .public-proposal-decision"));
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("in-view"); observer.unobserve(entry.target); } }), { threshold: 0.18 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [view]);
  if (view === "preview") return <section className="public-proposal-page proposal-preview-shell">
    <button className="proposal-preview-back" onClick={() => setView("editor")}>← Voltar ao editor</button>
    <header className="public-proposal-brand"><img src={brandLogo} alt="Liege Paschoalini Studio" /><div><b>LIEGE PASCHOALINI STUDIO</b></div></header>
    <ProposalClientPreview proposal={draft} /><section className="public-proposal-decision"><p>{getProposalLocale(draft.locale).until} {new Date(draft.expiresAt).toLocaleDateString(getProposalLocale(draft.locale).code)}.</p><h2>{getProposalLocale(draft.locale).continueTogether}</h2><div><button className="gradient-button">{getProposalLocale(draft.locale).accept}</button><button className="public-proposal-refuse">{getProposalLocale(draft.locale).refuse}</button></div></section>
  </section>;
  return <section className="proposals-workspace commercial-proposals">
    <div className="proposals-layout">
      <aside className="proposal-library" aria-label="Histórico de propostas">
        <div><div><small>WORKSPACE COMERCIAL</small><h2>Propostas</h2></div><span>{proposals.length}</span></div>
        {loading ? <p className="proposal-library-empty">Carregando propostas…</p> : !proposals.length ? <p className="proposal-library-empty">Suas propostas salvas aparecerão aqui.</p> : proposals.map((proposal) => <button key={proposal.id} disabled={saving} aria-pressed={draft.id === proposal.id} onClick={() => select(proposal)} className={draft.id === proposal.id ? "active" : ""}>
          <strong>{proposal.clientName || "Cliente não informado"}</strong><span className="proposal-list-title">{proposal.plan || proposal.proposalType || "Proposta"}</span>
          <span className="proposal-list-detail"><b>{amount(proposal)}</b><span className={`proposal-status ${proposal.status}`}>{statuses[proposal.status]}</span></span>
          <small>Válida até {new Date(proposal.expiresAt).toLocaleDateString("pt-BR")}</small>
        </button>)}
      </aside>
      <main className="proposal-stage">
        <header className="proposal-editor-heading"><div><small>{draft.id ? "PROPOSTA COMERCIAL" : "COMECE UMA NOVA CONVERSA"}</small><h2>{draft.id ? draft.clientName || "Proposta sem cliente" : "Nova proposta"}</h2><p>{draft.id ? dirty ? "Alterações aguardando salvamento" : "Alterações salvas automaticamente" : "Organize o escopo, as entregas e o investimento."}</p></div><span className={`proposal-status ${draft.status}`}>{draft.id ? statuses[draft.status] : "Ainda não salva"}</span></header>
        <fieldset className="proposal-editor" disabled={saving}>
          <section className="proposal-editor-section"><header><h3>Cliente e proposta</h3><p>Para quem estamos preparando esta proposta?</p></header>
            <div className="proposal-fields two"><label>Nome do cliente *<input value={draft.clientName} onChange={(event) => update({ clientName: event.target.value })} placeholder="Ex: Empresa ABC" /></label><label>E-mail<input type="email" value={draft.email} onChange={(event) => update({ email: event.target.value })} placeholder="email@cliente.com" /></label></div>
            <div className="proposal-fields three"><label>Idioma<select value={draft.locale} onChange={(event) => update({ locale: event.target.value })}>{Object.values(proposalLocales).map((locale) => <option key={locale.label}>{locale.label}</option>)}</select></label><label>Tipo de proposta<select value={draft.proposalType} onChange={(event) => update({ proposalType: event.target.value })}>{!["Projeto", "Mensalidade", "Consultoria"].includes(draft.proposalType) ? <option>{draft.proposalType}</option> : null}<option>Projeto</option><option>Mensalidade</option><option>Consultoria</option></select></label><label>Plano<input value={draft.plan} onChange={(event) => update({ plan: event.target.value })} placeholder="Ex: Conteúdo mensal" /></label></div>
          </section>
          <section className="proposal-editor-section"><header><h3>Escopo e entregas</h3><p>Defina o que faz parte do trabalho.</p></header><label className="proposal-pieces">Qtd. de peças<input type="number" min="0" value={draft.pieces} onChange={(event) => update({ pieces: Number(event.target.value) })} /></label><label className="proposal-rich-field"><span>Escopo do projeto</span><textarea value={draft.scope} onChange={(event) => update({ scope: event.target.value })} placeholder="Descreva objetivos, serviços e entregas…" /></label></section>
          <section className="proposal-editor-section proposal-services"><header><div><h3>Serviços e investimento</h3><p>Monte os itens e as condições comerciais.</p></div><button onClick={() => update({ services: [...draft.services, { name: "", value: 0, description: "" }] })}>+ Adicionar</button></header>
            {draft.services.map((service, index) => <div className="proposal-service-edit" key={index}>
              <label>Serviço<input value={service.name} onChange={(event) => update({ services: draft.services.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} placeholder="Nome do serviço" /></label>
              <label>Valor ({draft.currency})<input type="number" value={service.value} onChange={(event) => update({ services: draft.services.map((item, itemIndex) => itemIndex === index ? { ...item, value: Number(event.target.value) } : item) })} /></label>
              <label>Descrição<input value={service.description} onChange={(event) => update({ services: draft.services.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) })} placeholder="Descrição (opcional)" /></label><button aria-label={`Remover serviço ${index + 1}`} onClick={() => update({ services: draft.services.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
            </div>)}
            <div className="proposal-editor-total"><span>Investimento total</span><strong>{amount(draft)}</strong></div><label className="proposal-rich-field"><span>Descrição do investimento</span><textarea value={draft.investment} onChange={(event) => update({ investment: event.target.value })} placeholder="Condições de pagamento, observações e próximos passos…" /></label>
          </section>
        </fieldset>
        <footer className="proposal-editor-actions"><div><button disabled={saving} onClick={() => setView("preview")}>Ver prévia</button>{draft.id ? <><button disabled={saving} onClick={() => void copyLink()}>Copiar link</button><button className="proposal-delete" disabled={saving} onClick={() => void remove()}>Excluir</button></> : null}</div><div><button disabled={saving} onClick={() => void save()}>{saving ? "Salvando…" : draft.id && draft.status !== "draft" ? "Salvar alterações" : "Salvar rascunho"}</button><button className="gradient-button" disabled={saving} onClick={() => void save(true)}>Enviar proposta</button></div></footer>
        <p className="proposal-save-note">{draft.id ? `Válida até ${new Date(draft.expiresAt).toLocaleDateString("pt-BR")}. O envio renova a validade por 7 dias.` : "A proposta só entra no histórico quando você salva ou envia."}</p>
        {message ? <p className="time-error" role="status">{message}</p> : null}
      </main>
    </div>
  </section>;
}
