export function adminCardRoute(clientSlug: string | null | undefined, cardId: string | null | undefined) {
  const slug = clientSlug?.trim();
  const card = cardId?.trim();
  if (!slug || !card) return null;
  return `/admin/${encodeURIComponent(slug)}?card=${encodeURIComponent(card)}`;
}
