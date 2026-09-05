import { useEffect, useMemo, useState } from "react";
import {
  listAdminClients,
  listTimeEntries,
  loadActiveTimeEntry,
  startCardTimeEntryBySlug,
  startTimeEntry,
  stopTimeEntry,
  type AdminClientOption,
  type TimeEntry,
} from "./api";

const TIMER_EVENT = "design-hub:time-entry-changed";

function elapsedSeconds(entry: TimeEntry, now: number) {
  if (entry.durationSeconds !== null) return entry.durationSeconds;
  return Math.max(0, Math.floor((now - new Date(entry.startedAt).getTime()) / 1000));
}

export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  return [hours, minutes, rest].map((value) => String(value).padStart(2, "0")).join(":");
}

function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function notifyTimerChange() {
  window.dispatchEvent(new CustomEvent(TIMER_EVENT));
}

export function CardTimeTracker({ slug, cardId, cardTitle }: { slug: string; cardId: string; cardTitle: string }) {
  const [active, setActive] = useState<TimeEntry | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const now = useClock();
  const isThisCard = active?.cardId === cardId;

  const refresh = () => loadActiveTimeEntry().then((result) => setActive(result.entry)).catch(() => setActive(null));
  useEffect(() => {
    void refresh();
    window.addEventListener(TIMER_EVENT, refresh);
    return () => window.removeEventListener(TIMER_EVENT, refresh);
  }, []);

  async function toggle() {
    setWorking(true);
    setMessage("");
    try {
      if (isThisCard && active) {
        await stopTimeEntry(active.id);
        setMessage("Tempo registrado no relatório.");
      } else {
        if (active) {
          const replace = window.confirm(`O cronômetro de “${active.description}” está em andamento. Encerrar e iniciar este card?`);
          if (!replace) return;
          await stopTimeEntry(active.id);
        }
        await startCardTimeEntryBySlug(slug, cardId, cardTitle);
        setMessage("Cronômetro iniciado.");
      }
      await refresh();
      notifyTimerChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o cronômetro.");
    } finally {
      setWorking(false);
    }
  }

  return <section className={`card-time-tracker${isThisCard ? " running" : ""}`}>
    <div className="card-time-icon" aria-hidden="true">◷</div>
    <div><span>Tempo desta tarefa</span><strong>{isThisCard && active ? formatDuration(elapsedSeconds(active, now)) : "00:00:00"}</strong><small>{isThisCard ? "Cronômetro em andamento" : active ? `Em andamento: ${active.description}` : "Pronto para começar"}</small></div>
    <button type="button" disabled={working} onClick={() => void toggle()}>{working ? "Aguarde..." : isThisCard ? "■ Parar" : "▶ Iniciar"}</button>
    {message ? <p>{message}</p> : null}
  </section>;
}

type Period = "today" | "week" | "month";

function periodRange(period: Period) {
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (period === "week") {
    const mondayOffset = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - mondayOffset);
  } else if (period === "month") {
    from.setDate(1);
  }
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function TimeTrackingWorkspace() {
  const [clients, setClients] = useState<AdminClientOption[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [active, setActive] = useState<TimeEntry | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [filterClientId, setFilterClientId] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const now = useClock();
  const range = useMemo(() => periodRange(period), [period]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [clientResult, entryResult, activeResult] = await Promise.all([
        listAdminClients(),
        listTimeEntries({ ...range, clientAccountId: filterClientId || undefined }),
        loadActiveTimeEntry(),
      ]);
      setClients(clientResult.items);
      setEntries(entryResult.items);
      setActive(activeResult.entry);
      setNewClientId((current) => current || clientResult.items[0]?.id || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os apontamentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [period, filterClientId]);
  useEffect(() => {
    const listener = () => void refresh();
    window.addEventListener(TIMER_EVENT, listener);
    return () => window.removeEventListener(TIMER_EVENT, listener);
  }, [period, filterClientId]);

  async function beginStandalone(event: React.FormEvent) {
    event.preventDefault();
    if (!newClientId || !description.trim()) return;
    setWorking(true); setError("");
    try {
      if (active) {
        const replace = window.confirm(`Encerrar “${active.description}” e iniciar esta atividade?`);
        if (!replace) return;
        await stopTimeEntry(active.id);
      }
      await startTimeEntry({ clientAccountId: newClientId, description: description.trim() });
      setDescription("");
      notifyTimerChange();
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível iniciar."); }
    finally { setWorking(false); }
  }

  async function stopActive() {
    if (!active) return;
    setWorking(true);
    try { await stopTimeEntry(active.id); notifyTimerChange(); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível parar."); }
    finally { setWorking(false); }
  }

  const totalSeconds = entries.reduce((sum, entry) => sum + elapsedSeconds(entry, now), 0);
  const grouped = entries.reduce<Map<string, { name: string; seconds: number; count: number }>>((map, entry) => {
    const current = map.get(entry.clientAccountId) ?? { name: entry.clientName, seconds: 0, count: 0 };
    current.seconds += elapsedSeconds(entry, now); current.count += 1; map.set(entry.clientAccountId, current); return map;
  }, new Map());

  return <section className="time-workspace">
    <section className={`time-active-card${active ? " running" : ""}`}>
      <div className="time-active-symbol">{active ? "◷" : "◴"}</div>
      <div className="time-active-copy"><span>CRONÔMETRO ATUAL</span><h2>{active?.description ?? "Nenhuma atividade em andamento"}</h2><p>{active ? `${active.clientName}${active.cardTitle ? ` · Card: ${active.cardTitle}` : " · Atividade avulsa"}` : "Inicie por um card ou registre uma atividade abaixo."}</p></div>
      <strong className="time-active-duration">{active ? formatDuration(elapsedSeconds(active, now)) : "00:00:00"}</strong>
      {active ? <button type="button" disabled={working} onClick={() => void stopActive()}>■ Parar</button> : null}
    </section>

    <form className="time-quick-start" onSubmit={beginStandalone}>
      <div><span>NOVA ATIVIDADE AVULSA</span><h3>O que você vai fazer?</h3><p>O tempo será lançado diretamente no relatório do cliente.</p></div>
      <label>Cliente<select value={newClientId} onChange={(event) => setNewClientId(event.target.value)} required><option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      <label>Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={255} placeholder="Ex.: reunião, planejamento, pesquisa..." required /></label>
      <button className="gradient-button" disabled={working || !newClientId || !description.trim()}>▶ Iniciar</button>
    </form>

    <div className="time-report-toolbar">
      <div><span>RELATÓRIO DE TEMPO</span><h2>Horas por cliente</h2></div>
      <div className="time-period-tabs">{(["today", "week", "month"] as Period[]).map((value) => <button type="button" key={value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>{value === "today" ? "Hoje" : value === "week" ? "Esta semana" : "Este mês"}</button>)}</div>
      <select aria-label="Filtrar por cliente" value={filterClientId} onChange={(event) => setFilterClientId(event.target.value)}><option value="">Todos os clientes</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
    </div>

    <div className="time-summary-grid"><article><span>Tempo total</span><strong>{formatDuration(totalSeconds)}</strong><small>{entries.length} {entries.length === 1 ? "registro" : "registros"}</small></article>{Array.from(grouped.entries()).slice(0, 3).map(([id, item]) => <article key={id}><span>{item.name}</span><strong>{formatDuration(item.seconds)}</strong><small>{item.count} {item.count === 1 ? "atividade" : "atividades"}</small></article>)}</div>

    <section className="time-entry-list">
      {loading ? <p className="time-empty">Carregando apontamentos...</p> : entries.length ? entries.map((entry) => <article key={entry.id} className={entry.endedAt ? "" : "active"}><div className="time-entry-date"><strong>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(new Date(entry.startedAt))}</strong><span>{new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(entry.startedAt)).replace(".", "")}</span></div><div className="time-entry-main"><strong>{entry.description}</strong><span>{entry.clientName}{entry.cardTitle ? ` · ${entry.cardTitle}` : " · Atividade avulsa"}</span><small>{entry.userName} · {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(entry.startedAt))}{entry.endedAt ? `–${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(entry.endedAt))}` : " · em andamento"}</small></div><b>{formatDuration(elapsedSeconds(entry, now))}</b></article>) : <p className="time-empty">Nenhum tempo registrado neste período.</p>}
    </section>
    {error ? <p className="time-error" role="alert">{error}</p> : null}
  </section>;
}
