export function normalizeExternalHttpUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;

  // Do not turn javascript:, data:, or another non-web scheme into a clickable link.
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return "";

  return `https://${trimmed.replace(/^\/+/, "")}`;
}
