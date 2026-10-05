import type { SocialItem } from "./socialCalendar";
export const executionMarks: Record<string, string> = {
  not_scheduled: "—",
  scheduled: "◷",
  publishing: "↻",
  published: "✓",
  partial: "◐",
  failed: "!",
  cancelled: "×",
  unavailable: "?",
};
export const compactEditorial: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovado",
  scheduled: "Editorial agendado",
  published: "Interno concluído",
};
export type CalendarDisplayFilters = {
  origin: string;
  editorial: string;
  execution: string;
  platform: string;
};
/** Display-only filtering; never changes source composition or publication state. */
export function matchesCalendarDisplayFilters(
  item: SocialItem,
  filters: CalendarDisplayFilters,
  executionAvailable: boolean,
) {
  return (
    (filters.origin === "all" || item.source === filters.origin) &&
    (filters.editorial === "all" || item.editorial === filters.editorial) &&
    (filters.execution === "all" ||
      (item.kind === "post" &&
        (executionAvailable ? item.execution : "unavailable") ===
          filters.execution)) &&
    (filters.platform === "all" ||
      item.platforms.some((p) => p.platform === filters.platform))
  );
}

/** Friendly display only; the original IANA identifier remains the source of date/time calculations. */
export function calendarTimeZoneLabel(timeZone: string) {
  if (timeZone === "America/Sao_Paulo") return "São Paulo";
  return (timeZone.split("/").pop() || timeZone).replace(/_/g, " ");
}
