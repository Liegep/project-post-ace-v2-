export function addCalendarDays(date: string, days: number) {
  const target = new Date(`${date}T00:00:00Z`);
  target.setUTCDate(target.getUTCDate() + days);
  return target.toISOString().slice(0, 10);
}
export function seasonalDaysLabel(days: number) {
  return days === 0 ? "Hoje" : days === 1 ? "Amanhã" : days > 1 ? `Em ${days} dias` : days === -1 ? "Ontem" : `Há ${Math.abs(days)} dias`;
}
export function countryName(code: string, locale = "pt-BR") {
  return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
}
export function formatSeasonalDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
