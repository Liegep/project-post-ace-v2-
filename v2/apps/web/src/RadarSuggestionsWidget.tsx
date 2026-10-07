import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadRadarSuggestions, loadRadarSuggestion, resolveRadarSuggestion, type RadarSuggestionSummary, type RadarSuggestionDetail } from "./api";
import "./RadarSuggestionsWidget.css";
const message = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir a ação. Tente novamente.";
const date = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)) : "";
function ReviewDrawer({ item, summary, error, busy, onClose, onResolve }: { item: RadarSuggestionDetail | null; summary: RadarSuggestionSummary; error: string; busy: boolean; onClose: () => void; onResolve: (action: "accept" | "dismiss") => void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; panel.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return createPortal(<div className="radar-review-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={panel} tabIndex={-1} className="radar-review-drawer" role="dialog" aria-modal="true" aria-labelledby="radar-review-title" onKeyDown={(event) => {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key === "Tab") {
        const controls = [...(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]") ?? [])];
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
      }
    }}>
      <header><span>✦ RADAR DE PAUTAS</span><button aria-label="Fechar sugestão" disabled={busy} onClick={onClose}>×</button></header>
      <div className="radar-review-content"><p className="radar-review-client">{summary.clientName}</p><h2 id="radar-review-title">{summary.title}</h2>
        {!item && !error ? <p role="status">Carregando sugestão…</p> : null}
        {item ? <><div className="radar-review-meta"><span>{item.contentType}</span>{item.pillar ? <span>{item.pillar}</span> : null}{item.alignmentScore != null ? <span>Alinhamento estimado · {item.alignmentScore}%</span> : null}</div>
          <dl>{[["Conceito", item.concept], ["Gancho", item.hook], ["Descrição", item.description], ["Objetivo", item.objective], ["Por que combina com a marca", item.rationale], ["CTA", item.cta], ["Legenda / estrutura sugerida", item.captionSuggestion]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {item.basedOn.length ? <p className="radar-review-based">Baseado em: {item.basedOn.join(" · ")}</p> : null}
          <section className="radar-review-source"><h3>Fonte</h3>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceTitle} ↗</a> : <p>{item.sourceTitle}</p>}{item.sourceDate ? <p>Fonte · {date(item.sourceDate)}</p> : null}<p>Encontrada em {date(item.createdAt)}</p></section></> : null}
        {error ? <p role="alert" className="radar-review-error">{error}</p> : null}
      </div>
      {item ? <footer><button className="radar-review-secondary" disabled={busy} onClick={() => onResolve("dismiss")}>Descartar</button><button className="radar-review-primary" disabled={busy} onClick={() => onResolve("accept")}>{busy ? "Salvando…" : "Adicionar ao banco"}</button></footer> : null}
    </section>
  </div>, document.body);
}
export function RadarSuggestionsWidget() {
  const [items, setItems] = useState<RadarSuggestionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<RadarSuggestionSummary | null>(null);
  const [detail, setDetail] = useState<RadarSuggestionDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const active = useRef(true), decision = useRef(false), detailRequest = useRef(0), listRequest = useRef(0);
  const refresh = async () => {
    const request = ++listRequest.current;
    try { const result = await loadRadarSuggestions(); if (!active.current || request !== listRequest.current) return; setItems(result.items); setTotal(result.total); setHasMore(result.hasMore); setError(""); }
    catch (caught) { if (active.current && request === listRequest.current) setError(message(caught)); }
  };
  useEffect(() => {
    active.current = true; void refresh();
    const focus = () => { if (!decision.current) void refresh(); };
    window.addEventListener("focus", focus);
    return () => { active.current = false; ++listRequest.current; ++detailRequest.current; window.removeEventListener("focus", focus); };
  }, []);
  const close = () => { ++detailRequest.current; setSelected(null); setDetail(null); setDetailError(""); };
  const open = async (summary: RadarSuggestionSummary) => {
    const request = ++detailRequest.current;
    setSelected(summary); setDetail(null); setDetailError("");
    try { const result = await loadRadarSuggestion(summary.clientAccountId, summary.id); if (active.current && request === detailRequest.current) setDetail(result.suggestion); }
    catch (caught) { if (active.current && request === detailRequest.current) setDetailError(message(caught)); }
  };
  const resolve = async (summary: RadarSuggestionSummary, action: "accept" | "dismiss") => {
    if (decision.current) return;
    decision.current = true; setBusy(true); setError(""); setDetailError(""); ++listRequest.current;
    try {
      await resolveRadarSuggestion(summary.clientAccountId, summary.id, action);
      if (!active.current) return;
      setItems((current) => current.filter((item) => item.id !== summary.id)); setTotal((current) => Math.max(0, current - 1));
      close();
      // Refetch remaining summaries, including any not shown on the first page.
      await refresh();
      if (action === "accept") window.dispatchEvent(new CustomEvent("design-hub:pautas-updated", { detail: { clientId: summary.clientAccountId } }));
    } catch (caught) { if (active.current) { setError(message(caught)); if (selected?.id === summary.id) setDetailError(message(caught)); } }
    finally { decision.current = false; if (active.current) setBusy(false); }
  };
  const more = async () => {
    if (loadingMore || decision.current) return;
    setLoadingMore(true); const request = ++listRequest.current;
    try { const result = await loadRadarSuggestions(items.length); if (active.current && request === listRequest.current) { setItems((current) => [...current, ...result.items.filter((next) => !current.some((item) => item.id === next.id))]); setTotal(result.total); setHasMore(result.hasMore); } }
    catch (caught) { if (active.current) setError(message(caught)); }
    finally { if (active.current) setLoadingMore(false); }
  };
  if (!items.length) return error ? <p className="radar-review-error" role="alert">Radar de Pautas · {error}</p> : null;
  return <><section className="dashboard-tasks-widget radar-suggestions-widget" aria-label="Radar de Pautas"><header><h3>✦ Radar de Pautas</h3><span>{total} {total === 1 ? "nova sugestão" : "novas sugestões"}</span></header>
    <p className="radar-suggestions-subtitle">Sugestões encontradas pelos seus monitoramentos e alinhadas ao Brand Brain.</p>
    <div className="radar-suggestions-list">{items.map((item) => <article key={item.id}><p className="radar-review-client">{item.clientName}</p><h4>{item.title}</h4><div className="radar-review-meta"><span>{item.contentType}</span>{item.pillar ? <span>Pilar · {item.pillar}</span> : null}{item.alignmentScore != null ? <span>Alinhamento estimado · {item.alignmentScore}%</span> : null}</div><p className="radar-suggestions-source">{item.sourceTitle}{item.sourceDate ? ` · ${date(item.sourceDate)}` : ""}</p>
      <div className="radar-suggestions-actions"><button disabled={busy} onClick={() => void open(item)}>Ler mais</button><button className="radar-review-primary" disabled={busy} onClick={() => void resolve(item, "accept")}>Adicionar ao banco</button><button disabled={busy} onClick={() => void resolve(item, "dismiss")}>Descartar</button></div></article>)}</div>
    {error ? <p role="alert" className="radar-review-error">{error}</p> : null}{hasMore ? <button className="radar-suggestions-more" disabled={busy || loadingMore} onClick={() => void more()}>{loadingMore ? "Carregando…" : "Ver mais sugestões"}</button> : null}
  </section>{selected ? <ReviewDrawer item={detail} summary={selected} error={detailError} busy={busy} onClose={close} onResolve={(action) => void resolve(selected, action)} /> : null}</>;
}
