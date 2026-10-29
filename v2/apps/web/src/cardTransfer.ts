import type { BoardCard } from "./types";

// Explicit allowlist: publication jobs and approval credentials belong to the source client.
export function cardTransferPayload(card: BoardCard, mode: "copy" | "move", columnId: string | null) {
  const zone = card.scheduledTimeZone;
  return {
    columnId, title: `${card.title}${mode === "copy" ? " (copia)" : ""}`,
    caption: card.subtitle ?? null, primaryMediaUrl: card.mediaUrl || null,
    externalLinkUrl: card.externalLinkUrl || null,
    mediaType: card.mediaType || "image", editorialBrief: card.editorialBrief ?? null,
    priorityLevel: card.priorityLevel ?? null, eventColor: card.eventColor ?? null, keepFiles: card.keepFiles ?? false,
    artType: card.typeLabel || "single_post", status: card.statusBadges ?? [],
    tags: card.tags ?? [], mediaUrls: card.mediaUrls ?? [], hashtags: card.hashtags ?? [],
    deadlineAt: card.deadlineAt || null,
    ...(typeof zone === "string" && zone.trim() && zone.length <= 64 ? { scheduledTimeZone: zone } : {}),
    clientLabel: card.clientLabel || "pendente",
  };
}

export class CardMovePartialError extends Error {}

export async function transferCard(create: () => Promise<unknown>, remove: () => Promise<unknown>, mode: "copy" | "move") {
  await create();
  if (mode === "move") {
    try { await remove(); }
    catch { throw new CardMovePartialError("O cartão foi criado no destino, mas não foi possível confirmar a exclusão do original. Confira os dois clientes antes de continuar. Não repita a transferência."); }
  }
}
