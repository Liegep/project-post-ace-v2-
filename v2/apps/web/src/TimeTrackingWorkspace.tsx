import { useEffect, useMemo, useState } from "react";
import {
  listAdminClients,
  clearTimeEntries,
  listTimeEntries,
  loadActiveTimeEntry,
  resumeTimeEntry,
  startCardTimeEntryBySlug,
  startTimeEntry,
  stopTimeEntry,
  type AdminClientOption,
  type TimeEntry,
} from "./api";

const TIMER_EVENT = "design-hub:time-entry-changed";

function elapsedSeconds(entry: TimeEntry, now: number) {
  const accumulated = entry.durationSeconds ?? 0;
  if (entry.endedAt) return accumulated;
  return accumulated + Math.max(0, Math.floor((now - new Date(entry.lastStartedAt).getTime()) / 1000));
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
  const [period, setPeriod] = useState<Period>("week");
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
    if (!active && (!newClientId || !description.trim())) return;
    setWorking(true); setError("");
    try {
      if (active) {
        await stopTimeEntry(active.id);
        notifyTimerChange();
        await refresh();
        return;
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

  async function continueEntry(entry: TimeEntry) {
    setWorking(true); setError("");
    try {
      if (active) {
        const replace = window.confirm(`Encerrar “${active.description}” e continuar “${entry.description}”?`);
        if (!replace) return;
        await stopTimeEntry(active.id);
      }
      await resumeTimeEntry(entry.id);
      notifyTimerChange();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível continuar esta atividade.");
    } finally {
      setWorking(false);
    }
  }

  async function clearVisibleEntries() {
    const label = filterClientId ? clients.find((client) => client.id === filterClientId)?.name : "todos os clientes";
    if (!window.confirm(`Limpar da lista os registros encerrados deste período para ${label}? O cronômetro ativo será preservado.`)) return;
    setWorking(true); setError("");
    try {
      const result = await clearTimeEntries({ ...range, clientAccountId: filterClientId || undefined });
      await refresh();
      if (result.removed === 0) setError("Não havia registros encerrados para limpar neste período.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível limpar os registros.");
    } finally {
      setWorking(false);
    }
  }

  const totalSeconds = entries.reduce((sum, entry) => sum + elapsedSeconds(entry, now), 0);
  const groupedDays = entries.reduce<Map<string, TimeEntry[]>>((map, entry) => {
    const date = new Date(entry.startedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    map.set(key, [...(map.get(key) ?? []), entry]);
    return map;
  }, new Map());
  const dayLabel = (key: string) => {
    const date = new Date(`${key}T12:00:00`);
    const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    const sameDay = (candidate: Date) => candidate.getFullYear() === date.getFullYear() && candidate.getMonth() === date.getMonth() && candidate.getDate() === date.getDate();
    if (sameDay(today)) return "Hoje";
    if (sameDay(yesterday)) return "Ontem";
    return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).format(date).replace(/\./g, "");
  };

  const periodTitle = period === "today" ? "Hoje" : period === "week" ? "Esta semana" : "Este mês";
  const todayKey = new Date(now).toDateString();
  const todaySeconds = entries.filter((entry) => new Date(entry.startedAt).toDateString() === todayKey).reduce((sum, entry) => sum + elapsedSeconds(entry, now), 0);
  const clientTotals = entries.reduce<Map<string, { name: string; seconds: number }>>((totals, entry) => {
    const previous = totals.get(entry.clientAccountId);
    totals.set(entry.clientAccountId, { name: entry.clientName, seconds: (previous?.seconds ?? 0) + elapsedSeconds(entry, now) });
    return totals;
  }, new Map());
  const leadingClient = [...clientTotals.values()].sort((a, b) => b.seconds - a.seconds)[0];
  const recent = [...entries].filter((entry) => entry.endedAt).sort((a, b) => Date.parse(b.endedAt!) - Date.parse(a.endedAt!)).slice(0, 3);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(range.from); date.setDate(date.getDate() + index);
    const seconds = entries.filter((entry) => new Date(entry.startedAt).toDateString() === date.toDateString()).reduce((sum, entry) => sum + elapsedSeconds(entry, now), 0);
    return { date, seconds };
  });
  const weekMaximum = Math.max(1, ...weekDays.map((day) => day.seconds));

  return <section className="time-workspace">
    <header className="time-workspace-intro"><h2>Controle de tempo</h2><p>Acompanhe onde seu tempo está indo.</p></header>
    <form className={`clockify-start-bar${active ? " running" : ""}`} onSubmit={beginStandalone}>
      <label className="time-task-field"><span>Em que você está trabalhando?</span><input aria-label="Em que você está trabalhando?" className="clockify-task-input" value={active?.description ?? description} onChange={(event) => setDescription(event.target.value)} maxLength={255} placeholder="Em que você está trabalhando?" disabled={Boolean(active)} required={!active} /></label>
      <label className="clockify-project-picker"><span>Cliente</span><select aria-label="Cliente do timer" value={active?.clientAccountId ?? newClientId} onChange={(event) => setNewClientId(event.target.value)} disabled={Boolean(active)} required={!active}><option value="">Cliente / projeto</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      <div className="time-timer-display"><span className="time-timer-status">{active ? "● Em andamento" : "Pronto para começar"}</span><strong className="clockify-counter">{active ? formatDuration(elapsedSeconds(active, now)) : "00:00:00"}</strong></div>
      <button className={active ? "clockify-stop" : "clockify-start"} disabled={working || (!active && (!newClientId || !description.trim()))}>{working ? "AGUARDE" : active ? "PARAR" : "INICIAR"}</button>
    </form>

    {!loading && !error ? <>
      <section className="time-productivity-summary" aria-label="Resumo do período selecionado">
        <article><span>Hoje</span><strong>{formatDuration(todaySeconds)}</strong><small>{filterClientId ? "Cliente selecionado" : "Todos os clientes"}</small></article>
        {period !== "today" ? <article><span>{periodTitle}</span><strong>{formatDuration(totalSeconds)}</strong><small>{filterClientId ? "Cliente selecionado" : "Todos os clientes"}</small></article> : null}
        <article><span>Cliente com mais horas · {periodTitle.toLowerCase()}</span><strong>{leadingClient ? formatDuration(leadingClient.seconds) : "00:00:00"}</strong><small>{leadingClient?.name ?? "Sem registros no período"}</small></article>
      </section>
      {period === "week" ? <section className="time-week-chart" aria-label="Tempo registrado por dia nesta semana"><header><h3>Ritmo da semana</h3><span>{filterClientId ? "Cliente selecionado" : "Todos os clientes"}</span></header><div>{weekDays.map(({ date, seconds }) => <article key={date.toISOString()}><span>{new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "")}</span><div className="time-week-track"><i style={{ height: `${seconds / weekMaximum * 100}%` }} /></div><strong>{formatDuration(seconds).slice(0, -3)}</strong></article>)}</div></section> : null}
      {recent.length ? <section className="time-recent"><header><h3>Continuar tarefa</h3><span>Recentes neste período</span></header><div>{recent.map((entry) => <article key={entry.id}><div><strong>{entry.clientName}</strong><span>{entry.description}</span></div><button type="button" disabled={working} onClick={() => void continueEntry(entry)}>Continuar</button></article>)}</div></section> : null}
    </> : null}
    <header className="time-records-heading"><h2>Registros</h2><span>{loading ? "Carregando…" : `${entries.length} registros`}</span></header>
    <div className="clockify-report-toolbar">
      <div><strong>{period === "today" ? "Hoje" : period === "week" ? "Esta semana" : "Este mês"}</strong><span>{entries.length} {entries.length === 1 ? "registro" : "registros"}</span></div>
      <div className="time-period-tabs">{(["today", "week", "month"] as Period[]).map((value) => <button type="button" key={value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>{value === "today" ? "Hoje" : value === "week" ? "Esta semana" : "Este mês"}</button>)}</div>
      <div className="time-report-actions"><select aria-label="Filtrar por cliente" value={filterClientId} onChange={(event) => setFilterClientId(event.target.value)}><option value="">Todos os clientes</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select><details className="time-tools-menu"><summary aria-label="Mais ações dos registros">•••</summary><button type="button" disabled={working || entries.every((entry) => !entry.endedAt)} onClick={() => void clearVisibleEntries()}>Limpar encerrados</button></details></div>
      <p>Total do período <b>{formatDuration(totalSeconds)}</b></p>
    </div>

    <section className="clockify-day-list">
      {loading ? <p className="time-empty">Carregando apontamentos...</p> : groupedDays.size ? Array.from(groupedDays.entries()).map(([key, dayEntries]) => <section className="clockify-day-group" key={key}><header><strong>{dayLabel(key)}</strong><span>Total <b>{formatDuration(dayEntries.reduce((sum, entry) => sum + elapsedSeconds(entry, now), 0))}</b></span></header><div>{dayEntries.map((entry) => <article key={entry.id} className={entry.endedAt ? "" : "active"}><div className="clockify-entry-copy"><strong>{entry.description}</strong><span><i />{entry.clientName}{entry.cardTitle && entry.cardTitle !== entry.description ? ` · ${entry.cardTitle}` : ""}</span><small>{entry.userName}</small></div><time>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(entry.lastStartedAt))}{entry.endedAt ? ` – ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(entry.endedAt))}` : " – agora"}</time><b>{formatDuration(elapsedSeconds(entry, now))}</b>{entry.endedAt ? <button type="button" disabled={working} onClick={() => void continueEntry(entry)} title="Continuar esta atividade">▷ <span>Continuar</span></button> : <button type="button" className="is-stop" disabled={working} onClick={() => void stopActive()} title="Parar cronômetro">■ <span>Parar</span></button>}</article>)}</div></section>) : <p className="time-empty">Nenhum tempo registrado neste período.</p>}
    </section>
    {error ? <p className="time-error" role="alert">{error}</p> : null}
  </section>;
}
