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
import "./SocialCalendarWorkspace.css";
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
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) close.current();
      }}
    >
      <section
        className="agenda-detail-modal social-agenda-detail-modal social-calendar-dialog"
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
  const periodItems =
    context && range
      ? items.filter((item) =>
          inPeriod(item, range.start, range.end, context.timeZone),
        )
      : [];
  const byDay = new Map<string, SocialItem[]>();
  for (const item of items) {
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
  const metaUnavailable =
    !canMeta || warnings.some((w) => w.startsWith("Meta indisponível"));
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
  const itemButton = (item: SocialItem, mobile = false) => (
    <button
      key={item.id}
      type="button"
      className={
        mobile
          ? "social-agenda-item"
          : `social-calendar-event execution-${item.execution}`
      }
      style={
        { "--calendar-event-color": item.color ?? "#6861e8" } as CSSProperties
      }
      onClick={() => setSelected(item)}
    >
      <span>
        {time(item)} · {item.title}
      </span>
      <small>
        {item.clientName ?? "Sem cliente"} · {sourceLabel[item.source]}
        {item.destination ? " · " + item.destination : ""}
      </small>
      <small>{status(item)}</small>
      {item.platforms.length ? (
        <small>
          {item.platforms
            .map(
              (p) =>
                `${p.platform === "instagram" ? "Instagram" : "Facebook"}: ${executionLabels[p.status]}`,
            )
            .join(" · ")}
        </small>
      ) : null}
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
    <section className="social-calendar-workspace glass social-calendar-foundation">
      <header className="social-calendar-toolbar">
        <div className="social-calendar-month-nav">
          <button
            aria-label="Período anterior"
            onClick={() => saveState({ date: moveAnchor(anchor, view, -1) })}
          >
            ‹
          </button>
          <h2>{periodTitle}</h2>
          <button
            aria-label="Próximo período"
            onClick={() => saveState({ date: moveAnchor(anchor, view, 1) })}
          >
            ›
          </button>
        </div>
        <div className="social-calendar-filters">
          <label>
            Cliente
            <select
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
            className="ghost-button"
            onClick={() => saveState({ date: context.today })}
          >
            Hoje
          </button>
        </div>
      </header>
      <nav
        className="social-calendar-view-switch"
        aria-label="Visualização do calendário"
      >
        {(["day", "week", "month", "year"] as CalendarView[]).map((v) => (
          <button
            key={v}
            className={view === v ? "active" : ""}
            onClick={() => saveState({ view: v })}
          >
            {{ day: "Dia", week: "Semana", month: "Mês", year: "Ano" }[v]}
          </button>
        ))}
      </nav>
      <div className="social-calendar-summary">
        <span>Horários: {context.timeZone}</span>
        <strong>
          {loading
            ? "Carregando…"
            : `${periodItems.length} itens ${view === "month" ? "no mês selecionado" : "no período"}`}
        </strong>
      </div>
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
      <div className="social-calendar-content-controls">
        <label>
          Mostrar
          <select
            value={content}
            onChange={(e) => saveState({ content: e.target.value })}
          >
            <option value="all">Tudo</option>
            <option value="post">Posts</option>
            <option value="appointment">Compromissos</option>
          </select>
        </label>
        <button className="gradient-button" onClick={() => openCreate()}>
          ＋ Compromisso
        </button>
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
              className={`social-calendar-day${day < range!.start || day >= range!.end ? " muted" : ""}`}
            >
              <time dateTime={day}>{Number(day.slice(8))}</time>
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
            (day) =>
              day >= range!.start &&
              day < range!.end &&
              (view !== "year" || byDay.has(day)),
          )
          .map((day) => (
            <article
              className={`social-agenda-day${day === context.today ? " today" : ""}`}
              key={day}
            >
              <header>
                <strong>{formattedDay(day)}</strong>
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
        <p>Nenhum item neste período com os filtros selecionados.</p>
      ) : null}
      {selected || selectedDay ? (
        <CalendarDialog
          title={selected?.title ?? formattedDay(selectedDay!)}
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
                <button onClick={() => setSelected(null)}>
                  ← Itens do dia
                </button>
              ) : null}
              {selected.image ? (
                <img
                  className="social-agenda-detail-image"
                  src={selected.image}
                  alt=""
                />
              ) : null}
              <p>{selected.description}</p>
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
              {selected.publications.map((p) => (
                <p key={p.id}>
                  {p.platform === "instagram" ? "Instagram" : "Facebook"} ·{" "}
                  {executionLabels[p.status]}
                  {p.lastError ? " · " + p.lastError : ""}
                  {p.publishedPermalink ? (
                    <a
                      href={p.publishedPermalink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {" "}
                      Abrir publicação
                    </a>
                  ) : null}
                </p>
              ))}
              {adminCardRoute(selected.clientSlug, selected.cardId) ? (
                <button className="gradient-button" onClick={openCard}>
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
