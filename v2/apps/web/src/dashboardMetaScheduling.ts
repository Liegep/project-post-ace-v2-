import type { MetaScheduledPublication } from "./api";
import type { BoardCard } from "./types";

export type DashboardMetaMediaMode = "image" | "carousel" | "reel" | "story";

export function canShowDashboardMetaAction(input: { canScheduleMeta: boolean; cardId: string | null; mediaUrls: string[]; hasLinkedPlatform: boolean }) {
  return input.canScheduleMeta && Boolean(input.cardId) && input.mediaUrls.length > 0 && input.hasLinkedPlatform;
}

export function dashboardMetaMediaContext(card: BoardCard | null) {
  const mediaUrls = card ? card.mediaUrls?.length ? card.mediaUrls : card.mediaUrl ? [card.mediaUrl] : [] : [];
  const videoUrls = mediaUrls.filter((url) => /\.(mp4|mov)(?:$|[?#])/i.test(url));
  const declaredReel = /reel/i.test(card?.typeLabel ?? "");
  const declaredStory = /stor(?:y|ies)/i.test(card?.typeLabel ?? "");
  const mediaMode: DashboardMetaMediaMode = declaredStory
    ? "story"
    : mediaUrls.length === 1 && (videoUrls.length === 1 || declaredReel)
      ? "reel"
      : mediaUrls.length > 1 ? "carousel" : "image";
  const unavailableReason = mediaUrls.length === 0
    ? "Este card não possui mídia para publicação na Meta."
    : mediaMode === "story" && mediaUrls.length !== 1
      ? "Stories aceita exatamente uma imagem ou um vídeo nesta etapa."
      : videoUrls.length > 1 || (mediaUrls.length > 1 && (videoUrls.length > 0 || declaredReel))
        ? "Reels aceita somente um vídeo, sem imagens adicionais."
        : mediaUrls.length > 10
          ? "O carrossel aceita no máximo 10 imagens."
          : null;
  return {
    cardId: card?.id ?? null,
    title: card?.title ?? "",
    caption: card?.subtitle ?? "",
    mediaUrls,
    mediaMode,
    unavailableReason,
  };
}

export function dashboardMetaDateTime(scheduleDate: string, scheduleTime: string) {
  if (!scheduleDate || !scheduleTime) return { value: null, error: "Escolha a data e o horário antes de agendar na Meta." };
  const value = `${scheduleDate}T${scheduleTime}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? { value: null, error: "Escolha uma data e um horário válidos antes de agendar na Meta." }
    : { value, error: null };
}

export type DashboardMetaScheduleOptions = {
  destinationId: string;
  publicationFormat: "story" | null;
  reelCoverUrl: string | null;
  locationId: string | null;
  locationName: string | null;
  instagramUserTags: Array<{ username: string; x: number; y: number }>;
};

export function buildDashboardMetaScheduleRequest(input: {
  clientSlug: string;
  cardId: string;
  platforms: ("instagram" | "facebook")[];
  localDateTime: string;
  timezone: string;
  options: DashboardMetaScheduleOptions;
}) {
  const scheduledAt = new Date(input.localDateTime);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error("Escolha uma data e um horário válidos antes de agendar na Meta.");
  return {
    clientSlug: input.clientSlug,
    publication: {
      cardId: input.cardId,
      platforms: input.platforms,
      scheduledAt: scheduledAt.toISOString(),
      timezone: input.timezone,
      ...input.options,
    },
  };
}

function minute(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : Math.floor(parsed.getTime() / 60_000);
}

export function scheduledMetaPlatformsAt(
  publications: MetaScheduledPublication[],
  cardId: string,
  localDateTime: string,
  destinationId?: string | null,
) {
  const targetMinute = minute(localDateTime);
  if (targetMinute === null) return [];
  return (["instagram", "facebook"] as const).filter((platform) => publications.some((publication) =>
    (publication.status === "scheduled" || publication.status === "publishing" || publication.status === "published")
    && publication.cardId === cardId
    && publication.platform === platform
    && (publication.destinationId ?? null) === (destinationId ?? null)
    && minute(publication.scheduledAt) === targetMinute
  ));
}

export function mergeDashboardMetaPublications(current: MetaScheduledPublication[], incoming: MetaScheduledPublication[]) {
  return [...incoming, ...current.filter((item) => !incoming.some((publication) => publication.id === item.id))];
}
