import { zonedWallClockToIso } from "../../lib/zoned-date-time.js";
export function agendaInterval(from: string, to: string, timeZone: string) {
  const dateOnly = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  for (const value of [from, to]) {
    if (dateOnly(value)) {
      const date = new Date(value + "T12:00:00Z");
      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
      )
        throw new Error("Intervalo inválido.");
    }
  }
  const fromIso = zonedWallClockToIso(
    dateOnly(from) ? `${from}T00:00:00` : from,
    timeZone,
  );
  const next = dateOnly(to) ? new Date(`${to}T12:00:00Z`) : null;
  if (next) next.setUTCDate(next.getUTCDate() + 1);
  const toIso = zonedWallClockToIso(
    next ? `${next.toISOString().slice(0, 10)}T00:00:00` : to,
    timeZone,
  );
  if (!fromIso || !toIso || Date.parse(fromIso) >= Date.parse(toIso))
    throw new Error("Intervalo inválido.");
  return { from: fromIso, to: toIso };
}
export function agendaInInterval(
  start: string,
  interval: {
    from: string;
    to: string;
  },
) {
  return (
    Date.parse(start) >= Date.parse(interval.from) &&
    Date.parse(start) < Date.parse(interval.to)
  );
}
