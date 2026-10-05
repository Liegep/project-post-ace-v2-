import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  loadCalendarContext,
  loadCalendarOverview,
  loadAgendaEvents,
  listAdminClients,
  loadAgendaLabels,
  loadGlobalMetaPublications,
  createAgendaEvent,
  type AgendaEvent,
  type AgendaLabel,
  type AdminClientOption,
  type GlobalMetaScheduledPublication,
} from "./api";
import type { CalendarEvent } from "./types";
import { adminCardRoute } from "./metaCenterNavigation";
import {
  calendarRange,
  compareItems,
  composeSocialPosts,
  dayKey,
  editorialLabels,
  executionLabels,
  expandAppointments,
  independentSources,
  inPeriod,
  loadAllMetaPages,
  moveAnchor,
  shiftDay,
  validCalendarDay,
  type CalendarView,
  type SocialItem,
} from "./socialCalendar";
import {
  executionMarks,
  compactEditorial,
  matchesCalendarDisplayFilters,
} from "./socialCalendarPresentation";
import "./SocialCalendarWorkspace.css";
function CalendarIcon({
  name,
}: {
  name: "calendar" | "list" | "filter" | "plus" | "clock";
}) {
  const paths = {
    calendar:
      "M6 3v4M18 3v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
    list: "M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1",
    filter: "M4 6h16M7 12h10M10 18h4",
    plus: "M12 5v14M5 12h14",
    clock: "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
function CalendarDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const backgrounds = [...document.body.children].filter(
      (el) => el instanceof HTMLElement && !el.contains(ref.current),
    ) as HTMLElement[];
    const previousInert = backgrounds.map((el) => el.inert);
    backgrounds.forEach((el) => {
      el.inert = true;
    });
    ref.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      backgrounds.forEach((el, i) => {
        el.inert = previousInert[i];
      });
      previous?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [title]);
  return createPortal(
    <div
      className="modal-backdrop social-calendar-overlay"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) close.current();
      }}
    >
      <section
        className="agenda-detail-modal social-agenda-detail-modal social-calendar-dialog sc-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close.current();
          }
          if (e.key !== "Tab") return;
          const items = [
            ...ref.current!.querySelectorAll<HTMLElement>(
              "button:not(:disabled),a[href],input,select,textarea",
            ),
          ];
          const first = items[0],
            last = items[items.length - 1];
          if (!first) {
            e.preventDefault();
            return;
          }
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === ref.current)
          ) {
            e.preventDefault();
            last.focus();
          } else if (
            !e.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === ref.current)
          ) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <header>
          <h3>{title}</h3>
          <button className="icon-close" aria-label="Fechar" onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
const sourceLabel = {
  internal: "Agendamento interno",
  meta: "Meta",
  combined: "Interno + Meta",
  agenda: "Agenda",
};
export function SocialCalendarWorkspace({
  session,
}: {
  session: {
    role: string;
    source?: string;
  };
}) {
  const location = useLocation(),
    navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const [context, setContext] = useState<{
    timeZone: string;
    today: string;
  } | null>(null);
  const [contextError, setContextError] = useState(false);
  const [internal, setInternal] = useState<CalendarEvent[]>([]),
    [agenda, setAgenda] = useState<AgendaEvent[]>([]),
    [meta, setMeta] = useState<GlobalMetaScheduledPublication[]>([]);
  const [clients, setClients] = useState<AdminClientOption[]>([]),
    [labels, setLabels] = useState<AgendaLabel[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]),
    [loading, setLoading] = useState(false),
    [readyRange, setReadyRange] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<SocialItem | null>(null),
    [selectedDay, setSelectedDay] = useState<string | null>(null),
    [createDay, setCreateDay] = useState<string | null>(null);
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [startsAt, setStartsAt] = useState(""),
    [clientId, setClientId] = useState(""),
    [labelId, setLabelId] = useState(""),
    [saving, setSaving] = useState(false),
    [createError, setCreateError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 820px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const update = () => setCompact(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  const displayFilters = {
    origin: query.get("origin") ?? "all",
    editorial: query.get("editorial") ?? "all",
    execution: query.get("execution") ?? "all",
    platform: query.get("platform") ?? "all",
  };
  const anchor = validCalendarDay(query.get("date"))
    ? query.get("date")!
    : (context?.today ?? "");
  const rawView = query.get("view");
  const view: CalendarView =
    rawView && ["day", "week", "month", "year"].includes(rawView)
      ? (rawView as CalendarView)
      : window.matchMedia("(max-width: 820px)").matches
        ? "week"
        : "month";
  const client = query.get("client") ?? "all",
    content = query.get("content") ?? "all";
  const activeFilterCount = [
    client,
    content,
    ...Object.values(displayFilters),
  ].filter((v) => v !== "all").length;
  const agendaLayout =
    compact || view !== "month" || query.get("layout") === "agenda";
  const range = useMemo(
    () => (context ? calendarRange(anchor, view, context.timeZone) : null),
    [context, anchor, view],
  );
  const canMeta = session.role === "super_admin";
  const requestedScope = useRef("");
  const saveState = (updates: Record<string, string>) => {
    const next = new URLSearchParams(location.search);
    next.set("date", anchor);
    next.set("view", view);
    for (const [key, value] of Object.entries(updates)) next.set(key, value);
    navigate(
      { pathname: location.pathname, search: next.toString() },
      { replace: true, preventScrollReset: true },
    );
  };
  useEffect(() => {
    if (context && (!validCalendarDay(query.get("date")) || !query.has("view")))
      saveState({});
  }, [context, anchor, view, location.search]);
  useEffect(() => {
    let active = true;
    loadCalendarContext()
      .then((data) => {
        if (active) {
          setContext(data);
          setContextError(false);
        }
      })
      .catch(() => {
        if (active) setContextError(true);
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (!range || !context) return;
    let active = true;
    setLoading(true);
    const scopeKey = range.from + range.to + session.role;
    if (requestedScope.current !== scopeKey) {
      setWarnings([]);
      setInternal([]);
      setAgenda([]);
      setMeta([]);
      requestedScope.current = scopeKey;
    }
    independentSources({
      internal: loadCalendarOverview(
        shiftDay(range.gridStart, -2),
        shiftDay(range.gridEnd, 2),
      ),
      agenda: loadAgendaEvents(range.from, range.to),
      meta: canMeta
        ? loadAllMetaPages((offset) =>
            loadGlobalMetaPublications({
              from: range.from,
              to: range.to,
              offset,
              limit: 200,
            }),
          )
        : Promise.resolve([]),
      clients: listAdminClients(),
      labels: loadAgendaLabels(),
    })
      .then((result) => {
        if (!active) return;
        setReadyRange(range.from + range.to);
        setInternal(
          result.internal.status === "fulfilled"
            ? result.internal.value.events
            : [],
        );
        setAgenda(
          result.agenda.status === "fulfilled" ? result.agenda.value.items : [],
        );
        setMeta(result.meta.status === "fulfilled" ? result.meta.value : []);
        setClients(
          result.clients.status === "fulfilled"
            ? result.clients.value.items
            : [],
        );
        setLabels(
          result.labels.status === "fulfilled" ? result.labels.value.items : [],
        );
        const names = {
          internal: "Calendário interno",
          agenda: "Agenda",
          meta: "Meta",
          clients: "Clientes",
          labels: "Etiquetas",
        };
        setWarnings(
          (Object.keys(names) as Array<keyof typeof names>)
            .filter((key) => result[key].status === "rejected")
            .map(
              (key) =>
                `${names[key]} indisponível. Os dados das outras fontes continuam disponíveis.`,
            ),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range?.from, range?.to, canMeta, session.role, refresh]);
  useEffect(() => {
    let last = Date.now();
    const update = () => {
      if (document.visibilityState === "hidden" || Date.now() - last < 60000)
        return;
      last = Date.now();
      setRefresh((v) => v + 1);
    };
    const timer = window.setInterval(update, 120000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    if (loading || !context || !range || readyRange !== range.from + range.to)
      return;
    const value = sessionStorage.getItem(
      `social-calendar-scroll:${location.search}`,
    );
    if (value !== null) {
      sessionStorage.removeItem(`social-calendar-scroll:${location.search}`);
      requestAnimationFrame(() => window.scrollTo(0, Number(value)));
    }
  }, [loading, context, location.search, readyRange, range?.from, range?.to]);
  const items = useMemo(() => {
    if (!context || !range) return [];
    return [
      ...composeSocialPosts(internal, meta, context.timeZone),
      ...expandAppointments(agenda, range.from, range.to, context.timeZone),
    ]
      .filter(
        (item) =>
          inPeriod(item, range.gridStart, range.gridEnd, context.timeZone) &&
          (client === "all" || item.clientId === client) &&
          (content === "all" || content === item.kind),
      )
      .sort(compareItems);
  }, [internal, meta, agenda, context, range, client, content]);
  const metaUnavailable =
    !canMeta || warnings.some((w) => w.startsWith("Meta indisponível"));
  const visibleItems = items.filter((item) =>
    matchesCalendarDisplayFilters(item, displayFilters, !metaUnavailable),
  );
  const periodItems =
    context && range
      ? visibleItems.filter((item) =>
          inPeriod(item, range.start, range.end, context.timeZone),
        )
      : [];
  const byDay = new Map<string, SocialItem[]>();
  for (const item of visibleItems) {
    const key = dayKey(item.at, context!.timeZone);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }
  const formattedDay = (day: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full",
      timeZone: "UTC",
    }).format(new Date(day + "T12:00:00Z"));
  const time = (item: SocialItem) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: context!.timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(item.at));
  const executionText = (item: SocialItem) => {
    if (metaUnavailable) return "Não disponível";
    if (item.execution === "published") {
      return (
        "Publicado no " +
        item.platforms
          .map((p) => (p.platform === "instagram" ? "Instagram" : "Facebook"))
          .join(" e no ")
      );
    }
    return executionLabels[item.execution];
  };
  useEffect(() => {
    if (selected) {
      const updated = items.find((i) => i.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [items, selected?.id]);
  const status = (item: SocialItem) =>
    item.kind === "appointment"
      ? item.appointment?.isCompleted
        ? "Compromisso concluído"
        : "Compromisso"
      : `${item.editorial ? (editorialLabels[item.editorial] ?? item.editorial) : "Sem estado editorial interno"} · Meta: ${executionText(item)}`;
  const itemBadges = (item: SocialItem) => (
    <div className="sc-badges">
      <span
        className={`sc-badge sc-source-${item.source}`}
        title={sourceLabel[item.source]}
      >
        {item.kind === "appointment"
          ? "◷"
          : item.source === "meta"
            ? "↗"
            : "◇"}{" "}
        {item.source === "internal"
          ? "Interno"
          : item.source === "combined"
            ? "Interno + Meta"
            : item.source === "agenda"
              ? "Compromisso"
              : "Meta"}
      </span>
      {item.kind === "post" && item.editorial ? (
        <span
          className="sc-badge sc-editorial"
          title={editorialLabels[item.editorial]}
        >
          {compactEditorial[item.editorial] ?? item.editorial}
        </span>
      ) : null}
      {item.kind === "post" &&
      (item.execution === "partial" ||
        item.execution === "failed" ||
        item.execution === "publishing" ||
        item.execution === "cancelled") ? (
        <span
          className={`sc-badge sc-execution sc-state-${item.execution}`}
          title={executionText(item)}
        >
          {executionMarks[item.execution]} {executionText(item)}
        </span>
      ) : null}
      {item.platforms.map((p) => (
        <span
          key={p.platform}
          className={`sc-badge sc-platform sc-state-${p.status}`}
          title={`${p.platform === "instagram" ? "Instagram" : "Facebook"}: ${executionLabels[p.status]}`}
          aria-label={`${p.platform === "instagram" ? "Instagram" : "Facebook"}: ${executionLabels[p.status]}`}
        >
          {p.platform === "instagram" ? "IG" : "FB"}{" "}
          <b aria-hidden="true">{executionMarks[p.status]}</b>
        </span>
      ))}
      {item.kind === "post" && !item.platforms.length ? (
        <span className="sc-badge sc-unconfirmed" title={executionText(item)}>
          {metaUnavailable ? "?" : "—"}{" "}
          {metaUnavailable ? "Meta indisponível" : "Sem agenda Meta"}
        </span>
      ) : null}
      {item.appointment?.isCompleted ? (
        <span className="sc-badge sc-state-published">✓ Concluído</span>
      ) : null}
    </div>
  );
  const itemButton = (item: SocialItem, mobile = false) => (
    <button
      key={item.id}
      type="button"
      className={`${mobile ? "social-agenda-item" : "social-calendar-event"} sc-item execution-${item.execution} sc-kind-${item.kind}`}
      style={
        { "--calendar-event-color": item.color ?? "#6861e8" } as CSSProperties
      }
      aria-label={`${time(item)} · ${item.title}. ${item.clientName ?? "Sem cliente"}. ${status(item)}`}
      onClick={() => setSelected(item)}
    >
      <span className="sc-item-heading">
        <time className="sc-item-time">{time(item)}</time>
        <span className="sc-sr-only"> · </span>
        <strong className="sc-item-title">{item.title}</strong>
      </span>
      <small className="sc-item-client">
        {item.clientName ?? "Sem cliente"}
        {item.destination ? (
          <span className="sc-item-destination"> · {item.destination}</span>
        ) : null}
      </small>
      {itemBadges(item)}
    </button>
  );
  function openCreate(day = context!.today) {
    setCreateDay(day);
    setTitle("");
    setDescription("");
    setStartsAt(day + "T09:00");
    setClientId(client === "all" ? "" : client);
    setLabelId("");
    setCreateError("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !context) return;
    setSaving(true);
    setCreateError("");
    try {
      await createAgendaEvent({
        title: title.trim(),
        taskDescription: description.trim() || null,
        startsAt,
        timeZone: context.timeZone,
        color: labels.find((l) => l.id === labelId)?.color ?? "#c9f7df",
        clientAccountId: clientId || null,
        labelId: labelId || null,
        recurrenceType: "none",
      });
      setCreateDay(null);
      setRefresh((v) => v + 1);
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : "Não foi possível criar o compromisso.",
      );
    } finally {
      setSaving(false);
    }
  }
  function openCard() {
    if (!selected) return;
    const route = adminCardRoute(selected.clientSlug, selected.cardId);
    if (!route) return;
    const next = new URLSearchParams(location.search);
    next.set("date", anchor);
    next.set("view", view);
    const search = "?" + next.toString();
    sessionStorage.setItem(
      `social-calendar-scroll:${search}`,
      String(window.scrollY),
    );
    navigate(route, { state: { calendarReturn: location.pathname + search } });
  }
  if (!context)
    return (
      <section className="social-calendar-workspace glass">
        {contextError ? (
          <>
            <p role="alert">Não foi possível carregar o fuso da operação.</p>
            <button onClick={() => setRefresh((v) => v + 1)}>
              Tentar novamente
            </button>
          </>
        ) : (
          <p role="status">Carregando calendário…</p>
        )}
      </section>
    );
  const periodTitle =
    view === "month"
      ? new Intl.DateTimeFormat("pt-BR", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(anchor + "T12:00:00Z"))
      : view === "year"
        ? anchor.slice(0, 4)
        : `${formattedDay(range!.start)}${view === "week" ? " — " + formattedDay(shiftDay(range!.end, -1)) : ""}`;
  return (
    <section
      className={`social-calendar-workspace glass social-calendar-foundation social-calendar-editorial ${agendaLayout ? "sc-layout-agenda" : "sc-layout-month"}`}
    >
      <header className="social-calendar-toolbar sc-toolbar">
        <div className="sc-toolbar-period">
          <div className="social-calendar-month-nav">
            <h2>{periodTitle}</h2>
            <div className="sc-period-arrows">
              <button
                aria-label="Período anterior"
                onClick={() =>
                  saveState({ date: moveAnchor(anchor, view, -1) })
                }
              >
                ‹
              </button>
              <button
                aria-label="Próximo período"
                onClick={() => saveState({ date: moveAnchor(anchor, view, 1) })}
              >
                ›
              </button>
            </div>
          </div>
          <button
            className="sc-button sc-today"
            onClick={() => saveState({ date: context.today })}
          >
            Hoje
          </button>
          <span className="social-calendar-summary sc-count" role="status">
            {loading
              ? "Atualizando…"
              : `${periodItems.length} ${periodItems.length === 1 ? "item" : "itens"} ${view === "month" ? "no mês selecionado" : "no período"}`}
          </span>
        </div>
        <div className="sc-toolbar-actions">
          <nav
            className="sc-layout-switch"
            aria-label="Visualização do calendário"
          >
            <button
              aria-pressed={!agendaLayout}
              onClick={() => saveState({ view: "month", layout: "month" })}
            >
              <CalendarIcon name="calendar" />
              Mês
            </button>
            <button
              aria-pressed={agendaLayout}
              onClick={() => saveState({ layout: "agenda" })}
            >
              <CalendarIcon name="list" />
              Agenda
            </button>
          </nav>
          <label className="social-calendar-filters sc-client-filter">
            <span className="sc-sr-only">Cliente</span>
            <select
              aria-label="Cliente"
              value={client}
              onChange={(e) => saveState({ client: e.target.value })}
            >
              <option value="all">Todos os clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className={`sc-button sc-filter-button${activeFilterCount ? " has-filters" : ""}`}
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
          >
            <CalendarIcon name="filter" />
            Filtros
            {activeFilterCount ? (
              <span className="sc-filter-count">{activeFilterCount}</span>
            ) : null}
          </button>
          <button
            className="gradient-button sc-create"
            onClick={() => openCreate()}
            aria-label="＋ Compromisso"
          >
            <CalendarIcon name="plus" />
            Compromisso
          </button>
        </div>
        <div className="sc-toolbar-secondary">
          <span>
            <CalendarIcon name="clock" />
            Horários · {context.timeZone}
          </span>
          <label>
            Período
            <select
              aria-label="Período"
              value={view}
              onChange={(e) => saveState({ view: e.target.value })}
            >
              <option value="month">Mês</option>
              <option value="day">Dia</option>
              <option value="week">Semana</option>
              <option value="year">Ano</option>
            </select>
          </label>
          {activeFilterCount ? (
            <button
              className="sc-text-button"
              onClick={() =>
                saveState({
                  client: "all",
                  content: "all",
                  origin: "all",
                  editorial: "all",
                  execution: "all",
                  platform: "all",
                })
              }
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      </header>
      <div className="social-calendar-source-warnings">
        {!canMeta ? (
          <p>
            Publicações Meta disponíveis apenas para superadmin. Este calendário
            mostra os dados internos e da Agenda autorizados para você.
          </p>
        ) : null}
        {warnings.map((w) => (
          <p role="status" key={w}>
            {w}
          </p>
        ))}
        {warnings.length ? (
          <button onClick={() => setRefresh((v) => v + 1)}>
            Tentar novamente
          </button>
        ) : null}
      </div>
      <div className="social-calendar-desktop">
        <div className="social-calendar-weekdays">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="social-calendar-grid">
          {range!.days.map((day) => (
            <article
              key={day}
              className={`social-calendar-day${day < range!.start || day >= range!.end ? " muted" : ""}${day === context.today ? " is-today" : ""}`}
            >
              <div className="sc-day-header">
                <time dateTime={day}>{Number(day.slice(8))}</time>
                {day === context.today ? <span>Hoje</span> : null}
              </div>
              {(byDay.get(day) ?? []).slice(0, 3).map((i) => itemButton(i))}
              {(byDay.get(day)?.length ?? 0) > 3 ? (
                <button
                  className="social-calendar-more"
                  onClick={() => {
                    setSelected(null);
                    setSelectedDay(day);
                  }}
                >
                  +{byDay.get(day)!.length - 3} mais
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </div>
      <div className="social-calendar-mobile">
        {range!.days
          .filter(
            (day) => day >= range!.start && day < range!.end && byDay.has(day),
          )
          .map((day) => (
            <article
              className={`social-agenda-day${day === context.today ? " today" : ""}`}
              key={day}
            >
              <header className="sc-agenda-date">
                <div className="sc-agenda-date-number">
                  {Number(day.slice(8))}
                  <small>
                    {new Intl.DateTimeFormat("pt-BR", {
                      month: "short",
                      timeZone: "UTC",
                    })
                      .format(new Date(day + "T12:00:00Z"))
                      .replace(".", "")}
                  </small>
                </div>
                <div>
                  <strong>{formattedDay(day)}</strong>
                  <span>
                    {day === context.today ? "Hoje · " : ""}
                    {byDay.get(day)?.length ?? 0}{" "}
                    {byDay.get(day)?.length === 1 ? "item" : "itens"}
                  </span>
                </div>
                <button
                  aria-label={`Adicionar compromisso em ${day}`}
                  onClick={() => openCreate(day)}
                >
                  ＋
                </button>
              </header>
              <div className="social-agenda-items">
                {(byDay.get(day) ?? []).map((i) => itemButton(i, true))}
                {!byDay.has(day) ? (
                  <span className="social-calendar-empty-day">Nenhum item</span>
                ) : null}
              </div>
            </article>
          ))}
      </div>
      {!loading && !periodItems.length ? (
        <div className="sc-empty">
          <CalendarIcon name="calendar" />
          <h3>O calendário está livre por aqui</h3>
          <p>Nenhum item neste período com os filtros selecionados.</p>
          <button className="sc-button" onClick={() => openCreate()}>
            Adicionar compromisso
          </button>
        </div>
      ) : null}
      {selected || selectedDay ? (
        <CalendarDialog
          title={selected ? "Detalhes do conteúdo" : formattedDay(selectedDay!)}
          onClose={() => {
            setSelected(null);
            setSelectedDay(null);
          }}
        >
          {selected ? (
            <>
              {metaUnavailable && selected.kind === "post" ? (
                <p role="status">
                  {canMeta
                    ? "A fonte Meta não pôde ser atualizada."
                    : "Este perfil não possui acesso à execução Meta global."}{" "}
                  Nenhuma confirmação de publicação foi inferida.
                </p>
              ) : null}
              {selectedDay ? (
                <button
                  className="sc-text-button"
                  onClick={() => setSelected(null)}
                >
                  ← Itens do dia
                </button>
              ) : null}
              <div className="sc-detail-preview">
                {selected.image ? (
                  <img
                    className="social-agenda-detail-image"
                    src={selected.image}
                    alt=""
                  />
                ) : (
                  <div
                    className={`sc-preview-placeholder sc-source-${selected.source}`}
                  >
                    <CalendarIcon
                      name={
                        selected.kind === "appointment" ? "clock" : "calendar"
                      }
                    />
                    <span>
                      {selected.kind === "appointment"
                        ? "Compromisso editorial"
                        : sourceLabel[selected.source]}
                    </span>
                  </div>
                )}
              </div>
              <div className="sc-detail-heading">
                <span className="sc-eyebrow">
                  {selected.clientName ?? "Sem cliente"}
                </span>
                <h2>{selected.title}</h2>
                {itemBadges(selected)}
              </div>
              <dl>
                <div>
                  <dt>Cliente</dt>
                  <dd>{selected.clientName ?? "Sem cliente"}</dd>
                </div>
                <div>
                  <dt>Quando</dt>
                  <dd>
                    {new Intl.DateTimeFormat("pt-BR", {
                      timeZone: context.timeZone,
                      dateStyle: "full",
                      timeStyle: "short",
                    }).format(new Date(selected.at))}{" "}
                    · {context.timeZone}
                  </dd>
                </div>
                {selected.zone !== context.timeZone ? (
                  <div>
                    <dt>Fuso original</dt>
                    <dd>{selected.zone}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Origem</dt>
                  <dd>
                    {sourceLabel[selected.source]}
                    {selected.destination ? " · " + selected.destination : ""}
                  </dd>
                </div>
                {selected.kind === "appointment" ? (
                  <div>
                    <dt>Etiqueta</dt>
                    <dd>{selected.appointment?.labelName || "Sem etiqueta"}</dd>
                  </div>
                ) : null}
                {selected.kind === "post" ? (
                  <>
                    <div>
                      <dt>Estado editorial interno</dt>
                      <dd>
                        {selected.editorial
                          ? (editorialLabels[selected.editorial] ??
                            selected.editorial)
                          : "Não informado"}
                      </dd>
                    </div>
                    <div>
                      <dt>Execução Meta</dt>
                      <dd>{executionText(selected)}</dd>
                    </div>
                  </>
                ) : null}
              </dl>
              {selected.editorial === "published" ? (
                <p>
                  Conclusão interna pelo fluxo do aplicativo; não confirma
                  publicação nas redes.
                </p>
              ) : null}
              {selected.kind === "post" ? (
                <section className="sc-platform-section">
                  <h4>Execução por plataforma</h4>
                  {selected.publications.length ? (
                    selected.publications.map((p) => (
                      <article
                        className={`sc-platform-row sc-state-${p.status}`}
                        key={p.id}
                      >
                        <span className="sc-platform-logo">
                          {p.platform === "instagram" ? "IG" : "FB"}
                        </span>
                        <div>
                          <strong>
                            {p.platform === "instagram"
                              ? "Instagram"
                              : "Facebook"}
                          </strong>
                          <span>
                            {p.destinationName ??
                              selected.destination ??
                              "Destino Meta"}
                          </span>
                          {p.lastError ? <p>{p.lastError}</p> : null}
                          {p.publishedPermalink ? (
                            <a
                              href={p.publishedPermalink}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir publicação ↗
                            </a>
                          ) : null}
                        </div>
                        <span className={`sc-badge sc-state-${p.status}`}>
                          <b aria-hidden="true">{executionMarks[p.status]}</b>
                          {executionLabels[p.status]}
                        </span>
                        <span className="sc-sr-only">
                          {p.platform === "instagram"
                            ? "Instagram"
                            : "Facebook"}{" "}
                          · {executionLabels[p.status]}
                        </span>
                      </article>
                    ))
                  ) : (
                    <p className="sc-detail-note">
                      {metaUnavailable
                        ? "Execução Meta não disponível."
                        : "Nenhuma publicação Meta associada a este agendamento."}
                    </p>
                  )}
                </section>
              ) : null}
              <section className="sc-caption">
                <h4>{selected.kind === "post" ? "Legenda" : "Descrição"}</h4>
                <p>{selected.description || "Sem descrição."}</p>
              </section>
              {adminCardRoute(selected.clientSlug, selected.cardId) ? (
                <button
                  className="gradient-button sc-open-card"
                  onClick={openCard}
                >
                  Abrir card
                </button>
              ) : null}
            </>
          ) : (
            <div className="social-calendar-day-list">
              {(byDay.get(selectedDay!) ?? []).map((i) => itemButton(i, true))}
            </div>
          )}
        </CalendarDialog>
      ) : null}
      {filtersOpen ? (
        <CalendarDialog
          title="Filtros do calendário"
          onClose={() => setFiltersOpen(false)}
        >
          <p className="sc-detail-note">
            Encontre o conteúdo certo sem perder o contexto do calendário.
          </p>
          <div className="sc-filter-fields">
            <label className="field-stack">
              Cliente
              <select
                aria-label="Cliente nos filtros"
                value={client}
                onChange={(e) => saveState({ client: e.target.value })}
              >
                <option value="all">Todos os clientes</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-stack social-calendar-content-controls">
              Tipo
              <select
                value={content}
                onChange={(e) => saveState({ content: e.target.value })}
              >
                <option value="all">Tudo</option>
                <option value="post">Posts</option>
                <option value="appointment">Compromissos</option>
              </select>
            </label>
            <label className="field-stack">
              Origem
              <select
                value={displayFilters.origin}
                onChange={(e) => saveState({ origin: e.target.value })}
              >
                <option value="all">Todas as origens</option>
                <option value="internal">Somente interno</option>
                <option value="meta">Somente Meta</option>
                <option value="combined">Interno + Meta</option>
                <option value="agenda">Agenda</option>
              </select>
            </label>
            <label className="field-stack">
              Estado editorial
              <select
                value={displayFilters.editorial}
                onChange={(e) => saveState({ editorial: e.target.value })}
              >
                <option value="all">Todos os estados</option>
                {Object.entries(editorialLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-stack">
              Execução Meta
              <select
                value={displayFilters.execution}
                onChange={(e) => saveState({ execution: e.target.value })}
              >
                <option value="all">Todas as execuções</option>
                {Object.entries(executionLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
                <option value="unavailable">Não disponível</option>
              </select>
            </label>
            <label className="field-stack">
              Plataforma
              <select
                value={displayFilters.platform}
                onChange={(e) => saveState({ platform: e.target.value })}
              >
                <option value="all">Todas as plataformas</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
              </select>
            </label>
          </div>
          <div className="sc-filter-footer">
            <button
              className="sc-button"
              onClick={() =>
                saveState({
                  client: "all",
                  content: "all",
                  origin: "all",
                  editorial: "all",
                  execution: "all",
                  platform: "all",
                })
              }
            >
              Limpar filtros
            </button>
            <button
              className="gradient-button"
              onClick={() => setFiltersOpen(false)}
            >
              Ver resultados
            </button>
          </div>
        </CalendarDialog>
      ) : null}
      {createDay ? (
        <CalendarDialog
          title="Novo compromisso"
          onClose={() => {
            if (!saving) setCreateDay(null);
          }}
        >
          <form onSubmit={submit}>
            <label className="field-stack">
              Nome
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="field-stack">
              Descrição
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="field-stack">
              Data e horário · {context.timeZone}
              <input
                required
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>
            <label className="field-stack">
              Cliente
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Sem cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-stack">
              Etiqueta
              <select
                value={labelId}
                onChange={(e) => setLabelId(e.target.value)}
              >
                <option value="">Sem etiqueta</option>
                {labels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            {createError ? <p role="alert">{createError}</p> : null}
            <button
              className="gradient-button"
              disabled={saving || !title.trim()}
            >
              Adicionar compromisso
            </button>
          </form>
        </CalendarDialog>
      ) : null}
    </section>
  );
}
