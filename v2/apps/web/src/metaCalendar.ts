import type { MetaScheduledPublication } from "./api";
import type { CalendarEvent } from "./types";

export type ClientMetaCalendarPlatform = {
  platform: "instagram" | "facebook";
  status: MetaScheduledPublication["status"];
  publication: MetaScheduledPublication;
};

export type ClientMetaCalendarEvent = {
  id: string;
  cardId: string | null;
  title: string;
  scheduledAt: string;
  source: "internal" | "meta" | "combined";
  color?: string;
  imageUrl?: string;
  details?: string;
  destinationId?: string | null;
  destinationName?: string | null;
  platforms: ClientMetaCalendarPlatform[];
  publications: MetaScheduledPublication[];
  published: boolean;
};

function validDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function internalPostDate(post: CalendarEvent) {
  const instant = validDate(post.scheduledAt);
  if (instant) return instant;
  return validDate(`${post.publishDate.slice(0, 10)}T${post.publishTime?.slice(0, 8) || "00:00:00"}`);
}

function minuteKey(cardId: string | null, instant: Date, fallbackId: string) {
  return `${cardId || `publication:${fallbackId}`}:${Math.floor(instant.getTime() / 60_000)}`;
}

function publicationPriority(status: MetaScheduledPublication["status"]) {
  return status === "publishing" ? 4 : status === "scheduled" ? 3 : status === "failed" ? 2 : status === "published" ? 1 : 0;
}

function platformSummary(publications: MetaScheduledPublication[]) {
  return (["instagram", "facebook"] as const).flatMap((platform) => {
    const candidates = publications.filter((item) => item.platform === platform);
    if (!candidates.length) return [];
    const publication = [...candidates].sort((left, right) => {
      const priority = publicationPriority(right.status) - publicationPriority(left.status);
      return priority || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    })[0];
    return [{ platform, status: publication.status, publication }];
  });
}

function metaTitle(publication: MetaScheduledPublication) {
  return publication.cardTitle?.trim()
    || publication.caption?.trim().split(/\r?\n/, 1)[0]?.slice(0, 90)
    || "Publicação Meta";
}

export function composeClientMetaCalendarEvents(internalPosts: CalendarEvent[], metaPublications: MetaScheduledPublication[]) {
  const events = new Map<string, ClientMetaCalendarEvent>();

  internalPosts.forEach((post) => {
    const instant = internalPostDate(post);
    if (!instant) return;
    const key = minuteKey(post.cardId ?? null, instant, post.id);
    events.set(key, {
      id: `internal:${post.id}:${Math.floor(instant.getTime() / 60_000)}`,
      cardId: post.cardId ?? null,
      title: post.title,
      scheduledAt: instant.toISOString(),
      source: "internal",
      color: post.color,
      imageUrl: post.mediaUrls?.[0],
      details: post.caption?.trim() || undefined,
      platforms: [],
      publications: [],
      published: post.status === "published",
    });
  });

  const groups = new Map<string, MetaScheduledPublication[]>();
  metaPublications.filter((publication) => publication.status !== "cancelled").forEach((publication) => {
    const instant = validDate(publication.scheduledAt);
    if (!instant) return;
    const key = minuteKey(publication.cardId, instant, publication.id);
    groups.set(key, [...(groups.get(key) ?? []), publication]);
  });

  groups.forEach((publications, key) => {
    const destinationGroups = new Map<string, MetaScheduledPublication[]>();
    publications.forEach((publication) => {
      const destinationKey = publication.destinationId ?? "legacy";
      destinationGroups.set(destinationKey, [...(destinationGroups.get(destinationKey) ?? []), publication]);
    });
    destinationGroups.forEach((destinationPublications, destinationKey) => {
      const first = destinationPublications[0];
      const platforms = platformSummary(destinationPublications);
      const eventKey = destinationGroups.size === 1 ? key : `${key}:destination:${destinationKey}`;
      const existing = destinationGroups.size === 1 ? events.get(key) : undefined;
      if (existing) {
        existing.source = "combined";
        existing.destinationId = first.destinationId;
        existing.destinationName = first.destinationName;
        existing.publications = destinationPublications;
        existing.platforms = platforms;
        existing.published ||= existing.platforms.some((item) => item.status === "published");
        existing.imageUrl ||= first.reelCoverUrl || first.mediaUrls[0] || first.mediaUrl || undefined;
        existing.details ||= first.caption?.trim() || undefined;
        return;
      }
      events.set(eventKey, {
        id: `meta:${eventKey}`,
        cardId: first.cardId,
        title: metaTitle(first),
        scheduledAt: first.scheduledAt,
        source: "meta",
        imageUrl: first.reelCoverUrl || first.mediaUrls[0] || first.mediaUrl || undefined,
        details: first.caption?.trim() || undefined,
        destinationId: first.destinationId,
        destinationName: first.destinationName,
        platforms,
        publications: destinationPublications,
        published: platforms.some((item) => item.status === "published"),
      });
    });
  });

  return [...events.values()].sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime());
}
