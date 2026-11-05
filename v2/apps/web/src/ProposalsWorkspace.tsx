import { ProposalPremiumEditor } from "./ProposalPremiumEditor";
import "./proposalPremium.css";
import {
  proposalCurrencies,
  proposalCurrency,
  formatProposalMoney,
} from "./proposalCurrency";
import React, { useEffect, useRef, useState } from "react";
import {
  createAdminProposal,
  deleteAdminProposal,
  listAdminProposals,
  updateAdminProposal,
  type ProposalRecord,
} from "./api";
import {
  getProposalLocale,
  proposalLocales,
  ProposalClientPreview,
} from "./proposalPresentation";

type ProposalInput = Parameters<typeof createAdminProposal>[0];
const statuses: Record<ProposalRecord["status"], string> = {
  draft: "Rascunho",
  sent: "Enviada",
  viewed: "Visualizada",
  accepted: "Aceita",
  refused: "Recusada",
  expired: "Expirada",
};
export const emptyProposal = (): ProposalRecord => ({
  id: "",
  token: "",
  clientName: "",
  email: "",
  locale: "Português",
  proposalType: "Projeto",
  plan: "",
  pieces: 0,
  scope: "",
  investment: "",
  currency: "BRL",
  expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  status: "draft",
  services: [{ name: "", value: 0, description: "" }],
});
function editable(proposal: ProposalRecord): ProposalInput {
  const {
    id: _id,
    token: _token,
    acceptedAt: _acceptedAt,
    viewedAt: _viewedAt,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    acceptance: _acceptance,
    ...input
  } = proposal;
  return input;
}
const amount = (proposal: ProposalRecord) =>
  proposal.acceptance
    ? formatProposalMoney(
        proposal.acceptance.value,
        proposal.acceptance.currency,
      )
    : proposal.document?.mode === "alternatives"
      ? `${proposal.document.options.length} alternativas`
      : formatProposalMoney(
          proposal.services.reduce(
            (sum, item) => sum + Number(item.value || 0),
            0,
          ),
          proposal.currency,
        );

export function ProposalsWorkspace({
  newProposalSignal = 0,
  brandLogo,
}: {
  newProposalSignal?: number;
  brandLogo: string;
}) {
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
  const revisions = useRef<Record<string, number>>({});
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const busy = useRef(false);
  const lastSignal = useRef(newProposalSignal);
  const mounted = useRef(true);
  const cancelTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const replaceDraft = (value: ProposalRecord, changed = false) => {
    draftRef.current = value;
    dirtyRef.current = changed;
    setDraft(value);
    setDirty(changed);
  };
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void listAdminProposals()
      .then((result) => {
        if (active) setProposals(result.items);
      })
      .catch((error) => {
        if (active)
          setMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar as propostas.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      mounted.current = false;
      cancelTimer();
    };
  }, []);

  // Serialize existing autosaves with explicit actions: a delayed draft PATCH must never undo sending.
  const persist = (snapshot: ProposalRecord) => {
    const operation = queue.current
      .catch(() => {})
      .then(async () => {
        const payload = editable(snapshot);
        if (snapshot.document)
          payload.revision =
            revisions.current[snapshot.id] ?? snapshot.revision ?? 0;
        const result = snapshot.id
          ? await updateAdminProposal(snapshot.id, payload)
          : await createAdminProposal(payload);
        revisions.current[result.proposal.id] = result.proposal.revision ?? 0;
        if (mounted.current) {
          setProposals((current) => [
            result.proposal,
            ...current.filter((item) => item.id !== result.proposal.id),
          ]);
          if (draftRef.current === snapshot) replaceDraft(result.proposal);
          else if (draftRef.current.id === result.proposal.id)
            replaceDraft(
              { ...draftRef.current, revision: result.proposal.revision },
              true,
            );
        }
        return result.proposal;
      });
    queue.current = operation;
    return operation;
  };
  const update = (patch: Partial<ProposalRecord>) => {
    const next = { ...draftRef.current, ...patch };
    replaceDraft(next, true);
    setMessage("");
    cancelTimer();
    // A new proposal has no ID. Only existing proposals retain their 500ms autosave.
    if (next.id)
      timer.current = window.setTimeout(() => {
        timer.current = null;
        void persist(next).catch((error) => {
          if (mounted.current)
            setMessage(
              error instanceof Error
                ? error.message
                : "Não foi possível salvar a proposta.",
            );
        });
      }, 500);
  };
  const mayLeave = () =>
    !busy.current &&
    (!dirtyRef.current ||
      window.confirm("Há alterações não salvas. Deseja descartá-las?"));
  const startNew = () => {
    if (!mayLeave()) return;
    cancelTimer();
    replaceDraft(emptyProposal());
    setView("editor");
    setMessage("");
  };
  const select = (proposal: ProposalRecord) => {
    if (proposal.id === draftRef.current.id || !mayLeave()) return;
    cancelTimer();
    replaceDraft(proposal);
    setView("editor");
    setMessage("");
  };
  useEffect(() => {
    if (newProposalSignal !== lastSignal.current) {
      lastSignal.current = newProposalSignal;
      startNew();
    }
  }, [newProposalSignal]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = async (send = false) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    cancelTimer();
    setMessage("");
    const snapshot = send
      ? { ...draftRef.current, status: "sent" as const }
      : draftRef.current;
    try {
      const result = await persist(snapshot);
      if (mounted.current) {
        replaceDraft(result);
        setMessage(
          send
            ? "Proposta enviada. O link está disponível para compartilhar."
            : "Proposta salva.",
        );
        if (send) setView("preview");
      }
    } catch (error) {
      if (mounted.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a proposta.",
        );
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const remove = async () => {
    if (!draft.id || busy.current || !window.confirm("Excluir esta proposta?"))
      return;
    busy.current = true;
    setSaving(true);
    cancelTimer();
    try {
      await queue.current.catch(() => {});
      await deleteAdminProposal(draft.id);
      setProposals((current) => current.filter((item) => item.id !== draft.id));
      replaceDraft(emptyProposal());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a proposta.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/#/proposta/${draft.token}`,
      );
      setMessage("Link copiado.");
    } catch {
      setMessage("Não foi possível copiar o link.");
    }
  };
  const preview = (
    <section
      className="proposal-preview-shell proposal-premium-page"
      aria-label="Prévia da proposta para o cliente"
    >
      <ProposalClientPreview proposal={draft} brandLogo={brandLogo} />
      <section className="public-proposal-decision">
        {draft.status === "accepted" || draft.status === "refused" ? (
          <>
            <span className={draft.status}>✓</span>
            <h2>
              {draft.status === "accepted"
                ? getProposalLocale(draft.locale).accepted
                : getProposalLocale(draft.locale).refused}
            </h2>
            <p>{getProposalLocale(draft.locale).answer}</p>
          </>
        ) : (
          <>
            <p>
              {getProposalLocale(draft.locale).until}{" "}
              {new Date(draft.expiresAt).toLocaleDateString(
                getProposalLocale(draft.locale).code,
              )}
              .
            </p>
            <h2>{getProposalLocale(draft.locale).continueTogether}</h2>
            <div>
              <button className="gradient-button" disabled>
                {getProposalLocale(draft.locale).accept}
              </button>
              <button className="public-proposal-refuse" disabled>
                {getProposalLocale(draft.locale).refuse}
              </button>
            </div>
          </>
        )}
      </section>
    </section>
  );
  const changeTabByKeyboard = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? "editor"
        : event.key === "End"
          ? "preview"
          : view === "editor"
            ? "preview"
            : "editor";
    setView(next);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)
      ?.focus();
  };
  return (
    <section className="proposals-workspace commercial-proposals">
      <div className="proposals-layout">
        <aside className="proposal-library" aria-label="Histórico de propostas">
          <div>
            <div>
              <small>WORKSPACE COMERCIAL</small>
              <h2>Propostas</h2>
            </div>
            <span>{proposals.length}</span>
          </div>
          {loading ? (
            <p className="proposal-library-empty">Carregando propostas…</p>
          ) : !proposals.length ? (
            <p className="proposal-library-empty">
              Suas propostas salvas aparecerão aqui.
            </p>
          ) : (
            proposals.map((proposal) => (
              <button
                key={proposal.id}
                disabled={saving}
                aria-pressed={draft.id === proposal.id}
                onClick={() => select(proposal)}
                className={draft.id === proposal.id ? "active" : ""}
              >
                <strong>
                  {proposal.clientName || "Cliente não informado"}
                </strong>
                <span className="proposal-list-title">
                  {proposal.document?.title ||
                    proposal.plan ||
                    proposal.proposalType ||
                    "Proposta"}
                </span>
                <span className="proposal-list-detail">
                  <b>{amount(proposal)}</b>
                  <span className={`proposal-status ${proposal.status}`}>
                    {statuses[proposal.status]}
                  </span>
                </span>
                <small>
                  Válida até{" "}
                  {new Date(proposal.expiresAt).toLocaleDateString("pt-BR")}
                </small>
              </button>
            ))
          )}
        </aside>
        <main
          className={`proposal-stage ${view === "preview" ? "proposal-stage-preview" : ""}`}
        >
          <div
            className="proposal-mode-switch"
            role="tablist"
            aria-label="Modo da proposta"
          >
            <button
              id="proposal-edit-tab"
              role="tab"
              data-mode="editor"
              aria-selected={view === "editor"}
              aria-controls="proposal-mode-panel"
              tabIndex={view === "editor" ? 0 : -1}
              onKeyDown={changeTabByKeyboard}
              onClick={() => setView("editor")}
            >
              Editar
            </button>
            <button
              id="proposal-preview-tab"
              role="tab"
              data-mode="preview"
              aria-selected={view === "preview"}
              aria-controls="proposal-mode-panel"
              tabIndex={view === "preview" ? 0 : -1}
              onKeyDown={changeTabByKeyboard}
              onClick={() => setView("preview")}
            >
              Prévia do cliente
            </button>
          </div>
          <div
            id="proposal-mode-panel"
            role="tabpanel"
            aria-labelledby={
              view === "editor" ? "proposal-edit-tab" : "proposal-preview-tab"
            }
          >
            {view === "preview" ? (
              preview
            ) : (
              <>
                <header className="proposal-editor-heading">
                  <div>
                    <small>
                      {draft.id
                        ? "PROPOSTA COMERCIAL"
                        : "COMECE UMA NOVA CONVERSA"}
                    </small>
                    <h2>
                      {draft.id
                        ? draft.clientName || "Proposta sem cliente"
                        : "Nova proposta"}
                    </h2>
                    <p>
                      {draft.id
                        ? dirty
                          ? "Alterações aguardando salvamento"
                          : "Alterações salvas automaticamente"
                        : "Organize o escopo, as entregas e o investimento."}
                    </p>
                  </div>
                  <span className={`proposal-status ${draft.status}`}>
                    {draft.id ? statuses[draft.status] : "Ainda não salva"}
                  </span>
                </header>
                <fieldset
                  className="proposal-editor"
                  disabled={saving || draft.status === "accepted"}
                >
                  <ProposalPremiumEditor draft={draft} update={update} />
                </fieldset>
                <footer className="proposal-editor-actions">
                  <div>
                    <button
                      disabled={saving}
                      onClick={() => setView("preview")}
                    >
                      Ver prévia
                    </button>
                    {draft.id ? (
                      <>
                        <button
                          disabled={saving}
                          onClick={() => void copyLink()}
                        >
                          Copiar link
                        </button>
                        <button
                          className="proposal-delete"
                          disabled={saving || draft.status === "accepted"}
                          onClick={() => void remove()}
                        >
                          Excluir
                        </button>
                      </>
                    ) : null}
                  </div>
                  <div>
                    <button
                      disabled={saving || draft.status === "accepted"}
                      onClick={() => void save()}
                    >
                      {saving
                        ? "Salvando…"
                        : draft.id && draft.status !== "draft"
                          ? "Salvar alterações"
                          : "Salvar rascunho"}
                    </button>
                    <button
                      className="gradient-button"
                      disabled={saving || draft.status === "accepted"}
                      onClick={() => void save(true)}
                    >
                      Enviar proposta
                    </button>
                  </div>
                </footer>
                <p className="proposal-save-note">
                  {draft.status === "accepted"
                    ? "Proposta aceita. As condições aprovadas estão preservadas; crie uma nova proposta para revisá-las."
                    : draft.id
                      ? `Válida até ${new Date(draft.expiresAt).toLocaleDateString("pt-BR")}. O envio mantém a validade escolhida.`
                      : "A proposta só entra no histórico quando você salva ou envia."}
                </p>
              </>
            )}
          </div>
          {message ? (
            <p className="time-error" role="status">
              {message}
            </p>
          ) : null}
        </main>
      </div>
    </section>
  );
}
