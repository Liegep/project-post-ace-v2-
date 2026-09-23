export function normalizeMeetLink(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const embeddedUrl = trimmed.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  const embeddedMeetUrl = trimmed.match(/(?:https?:\/\/)?meet\.google\.com\/[a-z\d][a-z\d\-/?#=&._%]*/i)?.[0];
  const candidate = (embeddedMeetUrl ?? embeddedUrl ?? trimmed)
    .replace(/[),.;]+$/, "")
    .replace(/^(https?:\/\/)https?:\/\//i, "$1");

  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (candidate.startsWith("//")) return `https:${candidate}`;

  // Only HTTP(S) links can be opened from appointment cards.
  if (/^[a-z][a-z\d+.-]*:/i.test(candidate)) return null;

  return `https://${candidate.replace(/^\/+/, "")}`;
}
