/** Calendar-day distance in the user's local timezone, independent of DST. */
export function daysUntilDate(date: string, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return Number.NaN;
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return (target - start) / 86_400_000;
}

export function commemorativeAlerts<T extends { date: string }>(items: T[], today = new Date()) {
  const holidays = items.filter((item) => {
    const days = daysUntilDate(item.date, today);
    return days >= 0 && days <= 4;
  });
  const nearest = Math.min(...holidays.map((item) => daysUntilDate(item.date, today)));
  const badge = holidays.length === 0 ? null : nearest === 0 ? "Hoje" : nearest === 1 ? "Amanhã" : `Em ${nearest} dias`;
  return { holidays, badge };
}
