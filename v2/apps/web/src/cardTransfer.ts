import type { BoardCard } from "./types";

// Explicit allowlist: publication jobs and approval credentials belong to the source client.
export function cardTransferPayload(card: BoardCard, mode: "copy" | "move", columnId: string | null) {
  const zone = card.scheduledTimeZone;
  return {
    columnId, title: `${card.title}${mode === "copy" ? " (copia)" : ""}`,
    caption: card.subtitle ?? null, primaryMediaUrl: card.mediaUrl || null,
    externalLinkUrl: card.externalLinkUrl || null,
    artType: card.typeLabel || "single_post", status: card.statusBadges ?? [],
    tags: card.tags ?? [], mediaUrls: card.mediaUrls ?? [], hashtags: card.hashtags ?? [],
    deadlineAt: card.deadlineAt || null,
    ...(typeof zone === "string" && zone.trim() && zone.length <= 64 ? { scheduledTimeZone: zone } : {}),
    clientLabel: card.clientLabel || "pendente",
  };
}
