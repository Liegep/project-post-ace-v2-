// Calendar dates, never elapsed local milliseconds: stable across midnight, DST and time zones.
export function calendarDayNumber(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Data inválida.");
  const [year, month, day] = date.split("-").map(Number);
  if (year < 1900 || year > 9999) throw new Error("Ano inválido.");
  const time = Date.UTC(year, month - 1, day);
  if (new Date(time).toISOString().slice(0, 10) !== date) throw new Error("Data inválida.");
  return time / 86_400_000;
}
export function daysBetween(today: string, date: string) { return calendarDayNumber(date) - calendarDayNumber(today); }
export function yearsInPeriod(from: string, to: string) {
  calendarDayNumber(from); calendarDayNumber(to);
  return Array.from({ length: Number(to.slice(0, 4)) - Number(from.slice(0, 4)) + 1 }, (_, index) => Number(from.slice(0, 4)) + index);
}
export function todayInZone(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
