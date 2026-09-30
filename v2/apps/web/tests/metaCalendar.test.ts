import assert from "node:assert/strict";
import test from "node:test";
import type { MetaScheduledPublication } from "../src/api";
import type { CalendarEvent } from "../src/types";
import { composeClientMetaCalendarEvents } from "../src/metaCalendar";

const internal = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "card-1",
  title: "Post Primavera",
  publishDate: "2026-09-30",
  publishTime: "14:30:00",
  scheduledAt: "2026-09-30T12:30:20.000Z",
  status: "scheduled",
  ...overrides,
});

const publication = (overrides: Partial<MetaScheduledPublication> = {}): MetaScheduledPublication => ({
  id: "publication-1",
  cardId: "card-1",
  cardTitle: "Post Primavera",
  platform: "instagram",
  scheduledAt: "2026-09-30T12:30:45.000Z",
  timezone: "Europe/Stockholm",
  caption: "Legenda",
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
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
  publishedAt: null,
  ...overrides,
});

test("Meta-only appears and internal-only remains available when Meta is empty or failed", () => {
  const metaOnly = composeClientMetaCalendarEvents([], [publication()]);
  assert.equal(metaOnly.length, 1);
  assert.equal(metaOnly[0]?.source, "meta");
  const internalOnly = composeClientMetaCalendarEvents([internal()], []);
  assert.equal(internalOnly.length, 1);
  assert.equal(internalOnly[0]?.source, "internal");
});

test("same card and normalized minute deduplicates internal and Meta", () => {
  const events = composeClientMetaCalendarEvents([internal()], [publication()]);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.source, "combined");
  assert.deepEqual(events[0]?.platforms.map((item) => item.platform), ["instagram"]);
});

test("same card at different times remains two calendar events", () => {
  const events = composeClientMetaCalendarEvents([internal()], [publication({ scheduledAt: "2026-09-30T13:30:00.000Z" })]);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.source), ["internal", "meta"]);
});

test("Instagram and Facebook group once while preserving individual status", () => {
  const events = composeClientMetaCalendarEvents([], [
    publication({ status: "published" }),
    publication({ id: "publication-2", platform: "facebook", status: "failed" }),
  ]);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0]?.platforms.map((item) => [item.platform, item.status]), [["instagram", "published"], ["facebook", "failed"]]);
});

test("cancelled publications do not pollute the client calendar", () => {
  assert.deepEqual(composeClientMetaCalendarEvents([], [publication({ status: "cancelled" })]), []);
});
