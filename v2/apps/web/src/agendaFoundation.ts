import type { AgendaEvent, AgendaLabel } from "./api";
import {
  calendarRange,
  dayKey,
  expandAppointments,
  moveAnchor,
} from "./socialCalendar";
import {
  instantToWallClock,
  validTimeZone,
  zonedWallClockToIso,
} from "../../api/src/lib/zoned-date-time";
export { calendarRange, dayKey, moveAnchor, validTimeZone };
export type AgendaView = "day" | "week" | "month";
export type AgendaFilters = {
  client: string;
  label: string;
  completion: string;
};
export const emptyAgendaFilters: AgendaFilters = {
  client: "",
  label: "",
  completion: "",
};
export function expandAgendaOccurrences(
  events: AgendaEvent[],
  from: string,
  to: string,
  operationZone: string,
): AgendaEvent[] {
  // Keep the series' original wall clock/rule; expose every occurrence in the operational interval.
  return expandAppointments(events, from, to, operationZone).map((item) => {
    const event = item.appointment!;
    const duration = event.endsAt
      ? Date.parse(event.endsAt) - Date.parse(event.startsAt)
      : null;
    return {
      ...event,
      id: item.id,
      sourceEventId: event.id,
      startsAt: item.at,
      endsAt:
        duration !== null
          ? new Date(Date.parse(item.at) + duration).toISOString()
          : null,
    };
  });
}
export function filterAgenda(events: AgendaEvent[], filters: AgendaFilters) {
  return events.filter(
    (e) =>
      (!filters.client || e.clientAccountId === filters.client) &&
      (!filters.label || e.labelId === filters.label) &&
      (!filters.completion ||
        Boolean(e.isCompleted) === (filters.completion === "completed")),
  );
}
export function agendaItemsByDay(events: AgendaEvent[], zone: string) {
  const groups = new Map<string, AgendaEvent[]>();
  for (const event of [...events].sort(
    (a, b) =>
      Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
      a.id.localeCompare(b.id),
  )) {
    const key = dayKey(event.startsAt, zone);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return groups;
}
export function agendaPeriodCount(
  events: AgendaEvent[],
  range: { start: string; end: string },
  zone: string,
) {
  return events.filter((e) => {
    const day = dayKey(e.startsAt, zone);
    return day >= range.start && day < range.end;
  }).length;
}
export function agendaVisualState(event: AgendaEvent, now = Date.now()) {
  const past = Date.parse(event.endsAt ?? event.startsAt) < now;
  return {
    past,
    completed: Boolean(event.isCompleted),
    label: event.isCompleted
      ? "Concluído"
      : past
        ? "Passado · Pendente"
        : "Pendente",
    className: event.isCompleted
      ? " is-completed"
      : past
        ? " is-past-pending"
        : "",
    color: event.color || "#c9f7df",
  };
}
export function agendaWallInput(instant: string, zone: string) {
  return instantToWallClock(instant, zone).replace(" ", "T").slice(0, 16);
}
export function agendaEditDate(
  wall: string,
  operationZone: string,
  originalZone: string,
) {
  const iso = zonedWallClockToIso(wall, operationZone);
  if (!iso || agendaWallInput(iso, operationZone) !== wall.slice(0, 16))
    throw new Error("Data ou horário inválido neste fuso.");
  return {
    startsAt: instantToWallClock(iso, originalZone).replace(" ", "T"),
    timeZone: originalZone,
  };
}
export function chooseAgendaColor<T extends { color: string; labelId: string }>(
  form: T,
  color: string,
): T {
  return { ...form, color };
}
export function chooseAgendaLabel<T extends { color: string; labelId: string }>(
  form: T,
  labelId: string,
  labels: AgendaLabel[],
): T {
  return {
    ...form,
    labelId,
    color: labels.find((l) => l.id === labelId)?.color ?? form.color,
  };
}
export function agendaTextColor(color: string) {
  const hex = color.replace("#", "");
  if (!/^[a-f0-9]{6}$/i.test(hex)) return "#17213d";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b) >= 155
    ? "#111827"
    : "#ffffff";
}
