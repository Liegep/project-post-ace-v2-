import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  loadCalendarContext,
  loadAgendaEvents,
  loadAgendaLabels,
  listAdminClients,
  createAgendaEvent,
  updateAgendaEvent,
  deleteAgendaEvent,
  createAgendaLabel,
  deleteAgendaLabel,
  type AgendaEvent,
  type AgendaLabel,
  type AdminClientOption,
  type AgendaRecurrence,
} from "./api";
import {
  agendaItemsByDay,
  agendaPeriodCount,
  agendaVisualState,
  agendaWallInput,
  agendaEditDate,
  calendarRange,
  chooseAgendaColor,
  chooseAgendaLabel,
  dayKey,
  emptyAgendaFilters,
  expandAgendaOccurrences,
  filterAgenda,
  moveAnchor,
  agendaTextColor,
  validTimeZone,
  type AgendaView,
} from "./agendaFoundation";
import { instantToWallClock } from "../../api/src/lib/zoned-date-time";
import { normalizeExternalHttpUrl } from "./externalUrl";
import { AgendaDayDialog } from "./AgendaDayDialog";
function AgendaModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => previous?.focus();
  }, []);
  return createPortal(
    <div className="modal-backdrop agenda-modal-backdrop" onMouseDown={onClose}>
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="agenda-create-modal agenda-foundation-modal"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const nodes = [
              ...ref.current!.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled),textarea,select,a",
              ),
            ];
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === ref.current)
            ) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="column-editor-head">
          <h3>{title}</h3>
          <button
            type="button"
            className="icon-close"
            aria-label={`Fechar ${title}`}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
type EventForm = {
  title: string;
  taskDescription: string;
  startsAt: string;
  clientAccountId: string;
  labelId: string;
  color: string;
  meetLink: string;
  isCompleted: boolean;
  recurrenceType: AgendaRecurrence;
  repeatUntil: string;
};
const blankForm: EventForm = {
  title: "",
  taskDescription: "",
  startsAt: "",
  clientAccountId: "",
  labelId: "",
  color: "#c9f7df",
  meetLink: "",
  isCompleted: false,
  recurrenceType: "none",
  repeatUntil: "",
};
export function AgendaWorkspace({ canSave = true }: { canSave?: boolean }) {
  const [zone, setZone] = useState<string | null>(null),
    [contextError, setContextError] = useState("");
  const [anchor, setAnchor] = useState(""),
    [view, setView] = useState<AgendaView>("month");
  const [events, setEvents] = useState<AgendaEvent[]>([]),
    [labels, setLabels] = useState<AgendaLabel[]>([]),
    [clients, setClients] = useState<AdminClientOption[]>([]);
  const [eventsError, setEventsError] = useState(""),
    [labelsError, setLabelsError] = useState(""),
    [clientsError, setClientsError] = useState("");
  const [loading, setLoading] = useState(false),
    [refresh, setRefresh] = useState(0),
    [filters, setFilters] = useState({ ...emptyAgendaFilters });
  const [form, setForm] = useState({ ...blankForm }),
    [editing, setEditing] = useState<AgendaEvent | null>(null),
    [formOpen, setFormOpen] = useState(false);
  const [moreDay, setMoreDay] = useState<string | null>(null),
    [labelsOpen, setLabelsOpen] = useState(false),
    [labelName, setLabelName] = useState(""),
    [labelColor, setLabelColor] = useState("#4285f4");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dragged, setDragged] = useState<AgendaEvent | null>(null);
  const range = useMemo(
    () => (zone && anchor ? calendarRange(anchor, view, zone) : null),
    [anchor, view, zone],
  );
  useEffect(() => {
    let live = true;
    void loadCalendarContext()
      .then((c) => {
        if (!live) return;
        setZone(validTimeZone(c.timeZone));
        setAnchor((a) => a || dayKey(new Date(), c.timeZone));
        setContextError("");
      })
      .catch(() => {
        if (live)
          setContextError(
            "Não foi possível carregar o fuso da operação. Tente novamente.",
          );
      });
    return () => {
      live = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (!range) return;
    let live = true;
    setLoading(true);
    void loadAgendaEvents(range.from, range.to)
      .then((r) => {
        if (live) {
          setEvents(r.items);
          setEventsError("");
        }
      })
      .catch(() => {
        if (live)
          setEventsError(
            "Não foi possível atualizar os compromissos. Os dados já carregados foram mantidos.",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    void loadAgendaLabels()
      .then((r) => {
        if (live) {
          setLabels(r.items);
          setLabelsError("");
        }
      })
      .catch(() => {
        if (live)
          setLabelsError(
            "Não foi possível atualizar as etiquetas. Os compromissos continuam disponíveis.",
          );
      });
    void listAdminClients()
      .then((r) => {
        if (live) {
          setClients(r.items);
          setClientsError("");
        }
      })
      .catch(() => {
        if (live)
          setClientsError("Não foi possível atualizar a lista de clientes.");
      });
    return () => {
      live = false;
    };
  }, [range?.from, range?.to, refresh]);
  const occurrences = useMemo(
    () =>
      range && zone
        ? expandAgendaOccurrences(events, range.from, range.to, zone)
        : [],
    [events, range, zone],
  );
  const visible = useMemo(
    () => filterAgenda(occurrences, filters),
    [occurrences, filters],
  );
  const byDay = useMemo(
    () => agendaItemsByDay(visible, zone ?? "UTC"),
    [visible, zone],
  );
  const count = range && zone ? agendaPeriodCount(visible, range, zone) : 0;
  const dateText = (day: string, full = false) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "UTC",
      ...(full
        ? {
            weekday: "long" as const,
            day: "numeric" as const,
            month: "long" as const,
            year: "numeric" as const,
          }
        : { month: "long" as const, year: "numeric" as const }),
    }).format(new Date(day + "T12:00:00Z"));
  const time = (value: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: zone ?? "UTC",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  function openCreate(day?: string) {
    setEditing(null);
    setForm({
      ...blankForm,
      startsAt: (day ?? (zone ? dayKey(new Date(), zone) : anchor)) + "T09:00",
    });
    setError("");
    setFormOpen(true);
  }
  function openEdit(item: AgendaEvent) {
    if (!zone) return;
    const source =
      events.find((e) => e.id === (item.sourceEventId ?? item.id)) ?? item;
    setEditing(source);
    setForm({
      title: source.title,
      taskDescription: source.taskDescription ?? "",
      startsAt: agendaWallInput(source.startsAt, zone),
      clientAccountId: source.clientAccountId ?? "",
      labelId: source.labelId ?? "",
      color: source.color,
      meetLink: source.meetLink ?? "",
      isCompleted: Boolean(source.isCompleted),
      recurrenceType: source.recurrenceType ?? "none",
      repeatUntil: source.repeatUntil?.slice(0, 10) ?? "",
    });
    setMoreDay(null);
    setError("");
    setFormOpen(true);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!zone || busy) return;
    if (!canSave) {
      setError("Entre com sua conta para salvar no banco.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const originalZone = validTimeZone(editing?.timeZone, zone);
      const date = agendaEditDate(form.startsAt, zone, originalZone);
      const payload = {
        title: form.title.trim(),
        taskDescription: form.taskDescription.trim() || null,
        clientAccountId: form.clientAccountId || null,
        labelId: form.labelId || null,
        color: form.color,
        meetLink: form.meetLink.trim() || null,
      };
      if (!payload.title) throw new Error("Informe o título do compromisso.");
      if (
        !editing &&
        form.recurrenceType !== "none" &&
        form.repeatUntil &&
        form.repeatUntil < date.startsAt.slice(0, 10)
      )
        throw new Error("O término da série não pode ser anterior ao início.");
      if (editing) {
        const changed =
          form.startsAt !== agendaWallInput(editing.startsAt, zone);
        const dates = changed
          ? {
              ...date,
              ...(editing.endsAt
                ? {
                    endsAt: instantToWallClock(
                      new Date(
                        Date.parse(dateToInstant(date.startsAt, originalZone)) +
                          Date.parse(editing.endsAt) -
                          Date.parse(editing.startsAt),
                      ),
                      originalZone,
                    ).replace(" ", "T"),
                  }
                : {}),
            }
          : {};
        await updateAgendaEvent(editing.id, {
          ...payload,
          ...dates,
          isCompleted: form.isCompleted,
        });
      } else
        await createAgendaEvent({
          ...payload,
          ...date,
          recurrenceType: form.recurrenceType,
          repeatUntil: form.repeatUntil || null,
        });
      setFormOpen(false);
      setRefresh((n) => n + 1);
    } catch (c) {
      setError(
        c instanceof Error
          ? c.message
          : "Não foi possível salvar o compromisso.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !editing ||
      busy ||
      !window.confirm(
        editing.recurrenceType && editing.recurrenceType !== "none"
          ? "Excluir a série inteira?"
          : "Excluir este compromisso?",
      )
    )
      return;
    setBusy(true);
    try {
      await deleteAgendaEvent(editing.id);
      setFormOpen(false);
      setRefresh((n) => n + 1);
    } catch (c) {
      setError(c instanceof Error ? c.message : "Não foi possível excluir.");
    } finally {
      setBusy(false);
    }
  }
  async function drop(day: string) {
    const item = dragged;
    setDragged(null);
    if (!item || !zone) return;
    if (
      item.recurrenceType &&
      item.recurrenceType !== "none" &&
      !window.confirm(
        "Esta alteração será aplicada à série inteira. Continuar?",
      )
    )
      return;
    try {
      const target = day + "T" + agendaWallInput(item.startsAt, zone).slice(11);
      const originalZone = validTimeZone(item.timeZone, zone);
      const date = agendaEditDate(target, zone, originalZone);
      await updateAgendaEvent(item.sourceEventId ?? item.id, {
        ...date,
        ...(item.endsAt
          ? {
              endsAt: instantToWallClock(
                new Date(
                  Date.parse(dateToInstant(date.startsAt, originalZone)) +
                    Date.parse(item.endsAt) -
                    Date.parse(item.startsAt),
                ),
                originalZone,
              ).replace(" ", "T"),
            }
          : {}),
      });
      setRefresh((n) => n + 1);
    } catch (c) {
      setError(
        c instanceof Error
          ? c.message
          : "Não foi possível mover o compromisso.",
      );
    }
  }
  const labelOptions = [
    ...labels,
    ...events
      .filter((e) => e.labelId && !labels.some((l) => l.id === e.labelId))
      .map((e) => ({
        id: e.labelId!,
        name: e.labelName ?? "Etiqueta",
        color: e.color,
      })),
  ].filter((l, i, list) => list.findIndex((x) => x.id === l.id) === i);
  const clientOptions = [
    ...clients.map((c) => ({ id: c.id, name: c.name })),
    ...events
      .filter(
        (e) =>
          e.clientAccountId && !clients.some((c) => c.id === e.clientAccountId),
      )
      .map((e) => ({
        id: e.clientAccountId!,
        name: e.clientName ?? "Cliente",
      })),
  ].filter((c, i, list) => list.findIndex((x) => x.id === c.id) === i);
  const fields = (
    <>
      <label className="field-stack">
        Compromisso
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </label>
      <label className="field-stack">
        Tarefa a realizar
        <textarea
          value={form.taskDescription}
          onChange={(e) =>
            setForm({ ...form, taskDescription: e.target.value })
          }
        />
      </label>
      <label className="field-stack">
        Data e horário
        <input
          required
          type="datetime-local"
          value={form.startsAt}
          onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
        />
      </label>
      <small>
        Horários · {zone}
        {editing?.timeZone && editing.timeZone !== zone
          ? ` · Fuso original preservado: ${editing.timeZone}`
          : ""}
      </small>
      <label className="field-stack">
        Cliente
        <select
          value={form.clientAccountId}
          onChange={(e) =>
            setForm({ ...form, clientAccountId: e.target.value })
          }
        >
          <option value="">Sem cliente específico</option>
          {clientOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field-stack">
        Etiqueta
        <select
          value={form.labelId}
          onChange={(e) =>
            setForm(chooseAgendaLabel(form, e.target.value, labelOptions))
          }
        >
          <option value="">Sem etiqueta</option>
          {labelOptions.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field-stack">
        Cor
        <input
          type="color"
          value={form.color}
          onChange={(e) => setForm(chooseAgendaColor(form, e.target.value))}
        />
      </label>
      <label className="field-stack">
        Link do Google Meet
        <input
          value={form.meetLink}
          onChange={(e) => setForm({ ...form, meetLink: e.target.value })}
        />
      </label>
      {editing ? (
        <>
          <label>
            <input
              type="checkbox"
              checked={form.isCompleted}
              onChange={(e) =>
                setForm({ ...form, isCompleted: e.target.checked })
              }
            />{" "}
            Concluído
          </label>
          <p>
            {editing.recurrenceType && editing.recurrenceType !== "none"
              ? `Série recorrente · ${editing.repeatUntil ? "Até " + editing.repeatUntil.slice(0, 10) : "Sem data de término"}`
              : "Uma vez"}
          </p>
          {normalizeExternalHttpUrl(editing.meetLink) ? (
            <a
              href={normalizeExternalHttpUrl(editing.meetLink)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Entrar no Google Meet
            </a>
          ) : null}
        </>
      ) : (
        <>
          <label className="field-stack">
            Repetição
            <select
              value={form.recurrenceType}
              onChange={(e) =>
                setForm({
                  ...form,
                  recurrenceType: e.target.value as AgendaRecurrence,
                })
              }
            >
              <option value="none">Uma vez</option>
              <option value="weekdays">De segunda a sexta</option>
              <option value="weekly">Toda semana</option>
              <option value="monthly_nth_weekday">
                Mensal, no mesmo dia da semana
              </option>
            </select>
          </label>
          {form.recurrenceType !== "none" ? (
            <>
              <label className="field-stack">
                Repetir até (opcional)
                <input
                  type="date"
                  value={form.repeatUntil}
                  onChange={(e) =>
                    setForm({ ...form, repeatUntil: e.target.value })
                  }
                />
              </label>
              {!form.repeatUntil ? <small>Sem data de término</small> : null}
            </>
          ) : null}
        </>
      )}
    </>
  );
  return (
    <section className="agenda-page">
      <header className="agenda-toolbar">
        <button
          className="ghost-button"
          disabled={!zone}
          onClick={() => setAnchor(dayKey(new Date(), zone!))}
        >
          Hoje
        </button>
        <div className="agenda-month-nav">
          <button
            aria-label="Período anterior"
            disabled={!range}
            onClick={() => setAnchor(moveAnchor(anchor, view, -1))}
          >
            ‹
          </button>
          <strong>
            {range
              ? view === "month"
                ? dateText(anchor)
                : view === "day"
                  ? dateText(anchor, true)
                  : `${dateText(range.start, true)} - ${dateText(range.days[6], true)}`
              : "Carregando período…"}
          </strong>
          <button
            aria-label="Próximo período"
            disabled={!range}
            onClick={() => setAnchor(moveAnchor(anchor, view, 1))}
          >
            ›
          </button>
        </div>
        <div className="agenda-view-switch">
          {(["day", "week", "month"] as const).map((v, i) => (
            <button
              key={v}
              aria-pressed={view === v}
              className={view === v ? "active" : ""}
              onClick={() => setView(v)}
            >
              {["Dia", "Semana", "Mês"][i]}
            </button>
          ))}
        </div>
        <button
          className="ghost-button agenda-labels-button"
          onClick={() => {
            setLabelsOpen(true);
            setError("");
          }}
        >
          Etiquetas
        </button>
        <button
          className="gradient-button"
          disabled={!zone}
          onClick={() => openCreate()}
        >
          ＋ Novo compromisso
        </button>
      </header>
      <div className="agenda-foundation-controls">
        <span>
          {count} {count === 1 ? "compromisso" : "compromissos"}{" "}
          {view === "month"
            ? "no mês selecionado"
            : view === "week"
              ? "na semana selecionada"
              : "no dia selecionado"}
        </span>
        <small>Horários · {zone ?? "Carregando"}</small>
        <label>
          Cliente
          <select
            aria-label="Filtrar por cliente"
            value={filters.client}
            onChange={(e) => setFilters({ ...filters, client: e.target.value })}
          >
            <option value="">Todos</option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Etiqueta
          <select
            aria-label="Filtrar por etiqueta"
            value={filters.label}
            onChange={(e) => setFilters({ ...filters, label: e.target.value })}
          >
            <option value="">Todas</option>
            {labelOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Conclusão
          <select
            aria-label="Filtrar por conclusão"
            value={filters.completion}
            onChange={(e) =>
              setFilters({ ...filters, completion: e.target.value })
            }
          >
            <option value="">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="completed">Concluídos</option>
          </select>
        </label>
      </div>
      {[contextError, eventsError, labelsError, clientsError]
        .filter(Boolean)
        .map((message) => (
          <p role="status" key={message} className="form-feedback error-text">
            {message}{" "}
            <button
              type="button"
              className="ghost-button"
              onClick={() => setRefresh((n) => n + 1)}
            >
              Tentar novamente
            </button>
          </p>
        ))}
      {loading ? <p role="status">Atualizando compromissos…</p> : null}
      {error && !formOpen && !labelsOpen ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}
      {range ? (
        <>
          <section className={`agenda-calendar agenda-calendar-${view}`}>
            {view !== "day" ? (
              <div className="agenda-weekdays">
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                  <strong key={d}>{d}</strong>
                ))}
              </div>
            ) : null}
            <div className="agenda-month-grid">
              {range.days.map((day) => {
                const items = byDay.get(day) ?? [];
                return (
                  <article
                    key={day}
                    className={`agenda-day${view === "month" && day.slice(0, 7) !== anchor.slice(0, 7) ? " muted" : ""}`}
                    onClick={() => openCreate(day)}
                    onDragOver={(e) => {
                      if (dragged && view !== "day") e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void drop(day);
                    }}
                  >
                    <time>{Number(day.slice(8))}</time>
                    {items
                      .slice(0, view === "day" ? items.length : 3)
                      .map((item) => {
                        const visual = agendaVisualState(item);
                        return (
                          <button
                            type="button"
                            key={item.id}
                            className={`agenda-event-pill${visual.className}`}
                            style={{
                              backgroundColor: visual.color,
                              color: agendaTextColor(visual.color),
                            }}
                            draggable={view !== "day"}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.dataTransfer.setData(
                                "text/plain",
                                item.sourceEventId ?? item.id,
                              );
                              setDragged(item);
                            }}
                            onDragEnd={() => setDragged(null)}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(item);
                            }}
                            aria-label={`${time(item.startsAt)} ${item.title} · ${visual.label}`}
                          >
                            <span>{time(item.startsAt)}</span> {item.title}
                            <small> · {visual.label}</small>
                          </button>
                        );
                      })}
                    {view !== "day" && items.length > 3 ? (
                      <button
                        type="button"
                        className="agenda-more"
                        aria-label={`Ver todos os ${items.length} compromissos de ${day}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMoreDay(day);
                        }}
                      >
                        +{items.length - 3} mais
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
          <div className="social-calendar-mobile agenda-mobile-list">
            {range.days
              .filter((day) => day >= range.start && day < range.end)
              .map((day) => (
                <article
                  className={`social-agenda-day${day === dayKey(new Date(), zone!) ? " today" : ""}`}
                  key={day}
                >
                  <header>
                    <div>
                      <time>{Number(day.slice(8))}</time>
                      <span>
                        <strong>{dateText(day, true)}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Adicionar compromisso em ${day}`}
                      onClick={() => openCreate(day)}
                    >
                      ＋
                    </button>
                  </header>
                  <div className="social-agenda-items">
                    {(byDay.get(day) ?? []).map((item) => {
                      const visual = agendaVisualState(item);
                      return (
                        <button
                          type="button"
                          key={item.id}
                          className={`social-agenda-item appointment${visual.className}`}
                          onClick={() => openEdit(item)}
                          style={
                            {
                              "--calendar-event-color": visual.color,
                            } as React.CSSProperties
                          }
                        >
                          <span className="social-agenda-time">
                            {time(item.startsAt)}
                          </span>
                          <i>◷</i>
                          <span>
                            <strong>{item.title}</strong>
                            <small>
                              {[item.clientName, item.labelName, visual.label]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          </span>
                          <b>›</b>
                        </button>
                      );
                    })}
                    {!byDay.get(day)?.length ? (
                      <button
                        className="social-agenda-empty"
                        onClick={() => openCreate(day)}
                      >
                        ＋ Adicionar compromisso
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
          </div>
        </>
      ) : null}
      {moreDay ? (
        <AgendaDayDialog
          day={dateText(moreDay, true)}
          items={byDay.get(moreDay) ?? []}
          time={time}
          onSelect={openEdit}
          onClose={() => setMoreDay(null)}
        />
      ) : null}
      {formOpen ? (
        <AgendaModal
          title={editing ? "Editar compromisso" : "Novo compromisso"}
          onClose={() => {
            if (!busy) setFormOpen(false);
          }}
        >
          <form onSubmit={submit}>
            {editing?.recurrenceType && editing.recurrenceType !== "none" ? (
              <p className="agenda-series-note">
                Esta alteração será aplicada à série inteira. A data abaixo é o
                início da série.
              </p>
            ) : null}
            {fields}
            {error ? (
              <p role="alert" className="error-text">
                {error}
              </p>
            ) : null}
            <footer className="agenda-detail-actions">
              {editing ? (
                <button
                  type="button"
                  disabled={busy}
                  className="danger-button"
                  onClick={() => void remove()}
                >
                  Excluir
                </button>
              ) : null}
              <button type="submit" disabled={busy} className="gradient-button">
                {busy
                  ? "Salvando…"
                  : editing
                    ? "Salvar alterações"
                    : "Criar compromisso"}
              </button>
            </footer>
          </form>
        </AgendaModal>
      ) : null}
      {labelsOpen ? (
        <AgendaModal
          title="Gerenciar etiquetas"
          onClose={() => {
            if (!busy) setLabelsOpen(false);
          }}
        >
          <form
            className="agenda-label-create"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!labelName.trim() || busy) return;
              setBusy(true);
              try {
                const r = await createAgendaLabel({
                  name: labelName.trim(),
                  color: labelColor,
                });
                setLabels([...labels, r.label]);
                setLabelName("");
                setError("");
              } catch (c) {
                setError(
                  c instanceof Error
                    ? c.message
                    : "Não foi possível criar etiqueta.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              aria-label="Nome da etiqueta"
              required
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
            />
            <input
              aria-label="Cor da etiqueta"
              type="color"
              value={labelColor}
              onChange={(e) => setLabelColor(e.target.value)}
            />
            <button className="gradient-button" disabled={busy}>
              Criar
            </button>
          </form>
          <div className="agenda-label-list">
            {labels.map((l) => (
              <article key={l.id}>
                <span style={{ background: l.color }} />
                <strong>{l.name}</strong>
                <button
                  type="button"
                  aria-label={`Excluir etiqueta ${l.name}`}
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Excluir esta etiqueta? Os compromissos e suas cores serão preservados.",
                      )
                    )
                      return;
                    setBusy(true);
                    try {
                      await deleteAgendaLabel(l.id);
                      setLabels(labels.filter((x) => x.id !== l.id));
                      setRefresh((n) => n + 1);
                      setError("");
                    } catch (c) {
                      setError(
                        c instanceof Error
                          ? c.message
                          : "Não foi possível excluir etiqueta.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  ×
                </button>
              </article>
            ))}
          </div>
          {error ? (
            <p role="alert" className="error-text">
              {error}
            </p>
          ) : null}
        </AgendaModal>
      ) : null}
    </section>
  );
}
import { zonedWallClockToIso } from "../../api/src/lib/zoned-date-time";
function dateToInstant(wall: string, zone: string) {
  return zonedWallClockToIso(wall, zone)!;
}
