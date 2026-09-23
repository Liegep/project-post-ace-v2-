export function normalizeExternalHttpUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  const embeddedUrl = trimmed.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  const embeddedMeetUrl = trimmed.match(/(?:https?:\/\/)?meet\.google\.com\/[a-z\d][a-z\d\-/?#=&._%]*/i)?.[0];
  const candidate = (embeddedMeetUrl ?? embeddedUrl ?? trimmed)
    .replace(/[),.;]+$/, "")
    .replace(/^(https?:\/\/)https?:\/\//i, "$1");

  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (candidate.startsWith("//")) return `https:${candidate}`;

  // Do not turn javascript:, data:, or another non-web scheme into a clickable link.
  if (/^[a-z][a-z\d+.-]*:/i.test(candidate)) return "";

  return `https://${candidate.replace(/^\/+/, "")}`;
}
