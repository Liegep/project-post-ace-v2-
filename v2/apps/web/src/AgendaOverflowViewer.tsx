import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ACCESS_TOKEN_KEY } from "./authApi";
import type { AgendaEvent } from "./api";

const monthIndex: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function parsePtDate(value: string) {
  const normalized = normalize(value);
  const match = normalized.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (!match) return null;
  const month = monthIndex[match[2]];
  if (month === undefined) return null;
  return new Date(Number(match[3]), month, Number(match[1]));
}

function resolveClickedDay(more: Element) {
  const article = more.closest(".agenda-day");
  const grid = article?.parentElement;
  const calendar = more.closest(".agenda-calendar");
  const title = document.querySelector(".agenda-month-nav strong")?.textContent?.trim() ?? "";
  if (!article || !grid || !calendar || !title) return null;

  const dayCells = Array.from(grid.children).filter((item) => item.classList.contains("agenda-day"));
  const index = dayCells.indexOf(article);
  if (index < 0) return null;

  if (calendar.classList.contains("agenda-calendar-week")) {
    const start = parsePtDate(title.split(" - ")[0] ?? "");
    if (!start) return null;
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  }

  if (calendar.classList.contains("agenda-calendar-day")) {
    return parsePtDate(title);
  }

  const normalized = normalize(title);
  const monthMatch = normalized.match(/([a-z]+)\s+de\s+(\d{4})/);
  if (!monthMatch) return null;
  const month = monthIndex[monthMatch[1]];
  if (month === undefined) return null;
  const first = new Date(Number(monthMatch[2]), month, 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const day = new Date(gridStart);
  day.setDate(gridStart.getDate() + index);
  return day;
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function expandAgendaEvents(events: AgendaEvent[], from: Date, to: Date) {
  const items: AgendaEvent[] = [];
  for (const event of events) {
    const start = new Date(event.startsAt);
    const until = event.repeatUntil
      ? new Date(`${event.repeatUntil}T23:59:59`)
      : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
    const recurring = event.recurrenceType && event.recurrenceType !== "none";

    for (let day = new Date(start); day < to && day <= until; day.setDate(day.getDate() + 1)) {
      const eligible = !recurring
        ? day.getTime() === start.getTime()
        : event.recurrenceType === "weekdays"
          ? day.getDay() >= 1 && day.getDay() <= 5
          : event.recurrenceType === "weekly"
            ? day.getDay() === start.getDay()
            : day.getDay() === start.getDay() && Math.ceil(day.getDate() / 7) === Math.ceil(start.getDate() / 7);

      if (eligible && day >= from) {
        const occurrence = new Date(day);
        occurrence.setHours(start.getHours(), start.getMinutes(), 0, 0);
        items.push({
          ...event,
          id: `${event.id}:${localDateKey(day)}`,
          sourceEventId: event.id,
          startsAt: occurrence.toISOString(),
        });
      }
      if (!recurring) break;
    }
  }
  return items;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export function AgendaOverflowViewer() {
  const [day, setDay] = useState<Date | null>(null);
  const [items, setItems] = useState<AgendaEvent[]>([]);
  const [selected, setSelected] = useState<AgendaEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const more = target?.closest(".agenda-more");
      if (!more || !window.location.hash.startsWith("#/agenda")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const clickedDay = resolveClickedDay(more);
      if (!clickedDay) {
        setError("Não foi possível identificar o dia selecionado.");
        setItems([]);
        setDay(new Date());
        return;
      }

      setDay(clickedDay);
      setItems([]);
      setSelected(null);
      setError("");
      setLoading(true);

      const from = new Date(clickedDay);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);

      const token = window.localStorage.getItem(ACCESS_TOKEN_KEY)?.trim();
      const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      void fetch(`/api/agenda/events?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Não foi possível carregar os compromissos deste dia.");
          return response.json() as Promise<{ items: AgendaEvent[] }>;
        })
        .then((response) => {
          const expanded = expandAgendaEvents(response.items, from, to)
            .filter((item) => localDateKey(new Date(item.startsAt)) === localDateKey(clickedDay))
            .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
          setItems(expanded);
        })
        .catch((caught) => setError(caught instanceof Error ? caught.message : "Não foi possível carregar os compromissos deste dia."))
        .finally(() => setLoading(false));
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!day) return null;

  const overlayStyle: CSSProperties = {
    position: "fixed", inset: 0, zIndex: 9999, display: "grid", placeItems: "center",
    padding: 20, background: "rgba(24, 27, 43, .38)", backdropFilter: "blur(8px)",
  };
  const modalStyle: CSSProperties = {
    width: "min(620px, calc(100vw - 32px))", maxHeight: "min(720px, calc(100vh - 40px))", overflow: "auto",
    border: "1px solid rgba(145, 132, 194, .22)", borderRadius: 24,
    background: "rgba(255,255,255,.98)", boxShadow: "0 28px 80px rgba(49, 41, 86, .22)", padding: 22,
  };

  return createPortal(
    <div style={overlayStyle} onMouseDown={() => { setDay(null); setSelected(null); }}>
      <section style={modalStyle} onMouseDown={(event) => event.stopPropagation()}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
          <div>
            <p style={{ margin: "0 0 5px", color: "#7466d8", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Agenda</p>
            <h2 style={{ margin: 0, color: "#202a48", fontSize: 22 }}>
              {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(day)}
            </h2>
          </div>
          <button type="button" onClick={() => { setDay(null); setSelected(null); }} aria-label="Fechar" style={{ width: 38, height: 38, border: 0, borderRadius: 12, background: "#f0eef8", color: "#625a7a", fontSize: 23, cursor: "pointer" }}>×</button>
        </header>

        {loading ? <p style={{ color: "#747d91" }}>Carregando compromissos...</p> : null}
        {!loading && error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
        {!loading && !error && items.length === 0 ? <p style={{ color: "#747d91" }}>Nenhum compromisso encontrado neste dia.</p> : null}

        {!loading && !error && items.length > 0 ? <div style={{ display: "grid", gap: 9 }}>
          {items.map((item) => {
            const active = selected?.id === item.id;
            return <button key={item.id} type="button" onClick={() => setSelected(active ? null : item)} style={{ width: "100%", border: active ? "1px solid #8f82ef" : "1px solid #e3e5ee", borderRadius: 15, padding: "13px 15px", background: active ? "#f6f4ff" : "#f9faff", color: "#27304c", textAlign: "left", cursor: "pointer" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ minWidth: 50, color: "#6d7080", fontWeight: 700 }}>{formatTime(item.startsAt)}</span>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: item.color || "#8274e8", flex: "0 0 auto" }} />
                <strong style={{ flex: 1, fontSize: 15 }}>{item.title}</strong>
                <span style={{ color: "#8a8fa0" }}>{active ? "⌃" : "⌄"}</span>
              </div>
              {active ? <div style={{ marginTop: 11, paddingTop: 11, borderTop: "1px solid #e5e2f2", color: "#6d7384", fontSize: 13, lineHeight: 1.5 }}>
                {item.taskDescription ? <p style={{ margin: "0 0 7px" }}>{item.taskDescription}</p> : null}
                {item.clientName ? <div><strong>Cliente:</strong> {item.clientName}</div> : null}
                {item.labelName ? <div><strong>Etiqueta:</strong> {item.labelName}</div> : null}
                {item.meetLink ? <a href={item.meetLink} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, color: "#5f50d5", fontWeight: 700 }}>Abrir Google Meet</a> : null}
              </div> : null}
            </button>;
          })}
        </div> : null}
      </section>
    </div>,
    document.body,
  );
}
