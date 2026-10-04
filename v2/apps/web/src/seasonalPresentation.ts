import type { SeasonalOccurrence } from "./api";
export function monthPeriod(month: string, today: string) {
  const start = `${month}-01`;
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return { from: month === today.slice(0, 7) ? today : start, to: date.toISOString().slice(0, 10) };
}
export function validateSeasonalPeriod(from: string, to: string) {
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  return !Number.isFinite(days) ? "Selecione um período válido." : days < 0 ? "A data final deve ser igual ou posterior à inicial." : days > 366 ? "Selecione um intervalo de até 367 dias." : "";
}
export function orderSeasonalOccurrences(items: SeasonalOccurrence[]) {
  return [...items].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
