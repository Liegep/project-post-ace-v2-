export function normalizeMeetLink(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;

  // Only HTTP(S) links can be opened from appointment cards.
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return null;

  return `https://${trimmed.replace(/^\/+/, "")}`;
}
