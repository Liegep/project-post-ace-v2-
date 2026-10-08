import assert from "node:assert/strict";
import test from "node:test";
import type { MetaScheduledPublication } from "../src/api";
import type { BoardCard } from "../src/types";
import { buildDashboardMetaScheduleRequest, canShowDashboardMetaAction, dashboardMetaDateTime, dashboardMetaMediaContext, mergeDashboardMetaPublications, scheduledMetaPlatformsAt } from "../src/dashboardMetaScheduling";

const card = (overrides: Partial<BoardCard> = {}): BoardCard => ({
  id: "card-1",
  title: "Post Primavera",
  subtitle: "Legenda original #primavera",
  mediaUrl: "https://cdn.example.com/post.jpg",
  mediaUrls: ["https://cdn.example.com/post.jpg"],
  mediaAspect: "square",
  typeLabel: "Post único",
  statusBadges: ["Aprovado"],
  tags: [],
  commentsCount: 0,
  clientLabel: "Aprovado",
  ...overrides,
});

const publication = (overrides: Partial<MetaScheduledPublication> = {}): MetaScheduledPublication => ({
  id: "publication-1",
  cardId: "card-1",
  cardTitle: "Post Primavera",
  destinationId: "destination-a",
  destinationName: "Marca A",
  platform: "instagram",
  scheduledAt: new Date("2026-09-30T16:00").toISOString(),
  timezone: "Europe/Stockholm",
  caption: "Legenda original #primavera",
  mediaUrl: "https://cdn.example.com/post.jpg",
  mediaUrls: ["https://cdn.example.com/post.jpg"],
  mediaType: "image",
  reelCoverUrl: null,
  locationId: null,
  locationName: null,
  instagramUserTags: [],
  status: "scheduled",
  attemptCount: 0,
  publishedMetaId: null,
  publishedPermalink: null,
  lastError: null,
  createdAt: "2026-09-30T10:00:00Z",
  updatedAt: "2026-09-30T10:00:00Z",
  publishedAt: null,
  ...overrides,
});

test("dashboard Meta action appears only for an authorized real card with media and linked assets", () => {
  assert.equal(canShowDashboardMetaAction({ canScheduleMeta: true, cardId: "card-1", mediaUrls: ["post.jpg"], hasLinkedPlatform: true }), true);
  assert.equal(canShowDashboardMetaAction({ canScheduleMeta: true, cardId: null, mediaUrls: ["post.jpg"], hasLinkedPlatform: true }), false);
  assert.equal(canShowDashboardMetaAction({ canScheduleMeta: true, cardId: "card-1", mediaUrls: [], hasLinkedPlatform: true }), false);
  assert.equal(canShowDashboardMetaAction({ canScheduleMeta: false, cardId: "card-1", mediaUrls: ["post.jpg"], hasLinkedPlatform: true }), false);
});

test("date and time are mandatory and become the prefilled local datetime", () => {
  assert.equal(dashboardMetaDateTime("", "16:00").error, "Escolha a data e o horário antes de agendar na Meta.");
  assert.equal(dashboardMetaDateTime("2026-09-30", "").value, null);
  assert.deepEqual(dashboardMetaDateTime("2026-09-30", "16:00"), { value: "2026-09-30T16:00", error: null });
});

test("feedback card context preserves card, media, caption and supported format", () => {
  const original = card({ mediaUrls: ["one.jpg", "two.jpg"], mediaUrl: "one.jpg", typeLabel: "Carrossel", scheduledAt: "2026-09-30T16:00" });
  const snapshot = structuredClone(original);
  const context = dashboardMetaMediaContext(original);
  assert.equal(context.cardId, "card-1");
  assert.equal(context.title, "Post Primavera");
  assert.equal(context.caption, "Legenda original #primavera");
  assert.deepEqual(context.mediaUrls, ["one.jpg", "two.jpg"]);
  assert.equal(context.mediaMode, "carousel");
  assert.deepEqual(original, snapshot, "the internal card schedule and content remain untouched");
});

test("Meta request keeps the feedback client, card and prefilled time", () => {
  const request = buildDashboardMetaScheduleRequest({
    clientSlug: "minas-home",
    cardId: "card-1",
    platforms: ["instagram", "facebook"],
    localDateTime: "2026-09-30T16:00",
    timezone: "Europe/Stockholm",
    options: { destinationId: "destination-a", publicationFormat: null, reelCoverUrl: null, locationId: null, locationName: null, instagramUserTags: [] },
  });
  assert.equal(request.clientSlug, "minas-home");
  assert.equal(request.publication.cardId, "card-1");
  assert.deepEqual(request.publication.platforms, ["instagram", "facebook"]);
  assert.equal(request.publication.destinationId, "destination-a");
  assert.equal(request.publication.scheduledAt, new Date("2026-09-30T16:00").toISOString());
});

test("Reel and Story use the same existing Meta modal media context", () => {
  assert.equal(dashboardMetaMediaContext(card({ mediaUrl: "video.mp4", mediaUrls: ["video.mp4"], typeLabel: "Reels" })).mediaMode, "reel");
  assert.equal(dashboardMetaMediaContext(card({ typeLabel: "Story" })).mediaMode, "story");
});

test("Instagram and Facebook duplicates are blocked only for the same card, destination and minute", () => {
  const publications = [
    publication(),
    publication({ id: "publication-2", platform: "facebook", scheduledAt: new Date("2026-09-30T16:00:45").toISOString() }),
    publication({ id: "publication-3", cardId: "card-2", platform: "facebook" }),
  ];
  assert.deepEqual(scheduledMetaPlatformsAt(publications, "card-1", "2026-09-30T16:00", "destination-a"), ["instagram", "facebook"]);
  assert.deepEqual(scheduledMetaPlatformsAt(publications, "card-1", "2026-09-30T16:00", "destination-b"), []);
  assert.deepEqual(scheduledMetaPlatformsAt(publications, "card-1", "2026-09-30T17:00", "destination-a"), []);
});

test("successful Meta scheduling updates local state without duplicating returned records", () => {
  const current = [publication()];
  const facebook = publication({ id: "publication-2", platform: "facebook" });
  const merged = mergeDashboardMetaPublications(current, [facebook, publication({ status: "published" })]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map((item) => item.id), ["publication-2", "publication-1"]);
  assert.equal(merged.find((item) => item.id === "publication-1")?.status, "published");
});
