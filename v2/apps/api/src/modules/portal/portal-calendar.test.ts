import assert from "node:assert/strict";
import test from "node:test";
import { composePortalMetaCalendarCards } from "./portal.service.js";

const card = {
  id: "card-1",
  title: "Post publicado",
  status: ["Agendado"],
  clientLabel: "Agendado",
};

const publication = (platform: "instagram" | "facebook") => ({
  id: `publication-${platform}`,
  cardId: "card-1",
  platform,
  scheduledAt: "2026-09-30T12:30:00.000Z",
  timezone: "Europe/Stockholm",
  status: "published",
  publishedAt: "2026-09-30T12:31:00.000Z",
});

test("published Meta platforms remain one published portal calendar card after reload", () => {
  const inputCards = [card] as Parameters<typeof composePortalMetaCalendarCards>[0];
  const inputPublications = [publication("instagram"), publication("facebook")] as Parameters<typeof composePortalMetaCalendarCards>[1];

  const firstLoad = composePortalMetaCalendarCards(inputCards, inputPublications);
  const refreshed = composePortalMetaCalendarCards(inputCards, inputPublications);

  assert.equal(firstLoad.length, 1, "IG and Facebook must represent the same content once");
  assert.equal(firstLoad[0]?.scheduledAt, "2026-09-30T12:30:00.000Z");
  assert.equal(firstLoad[0]?.publishedAt, "2026-09-30T12:31:00.000Z");
  assert.equal(firstLoad[0]?.status[0], "Publicado");
  assert.deepEqual(refreshed, firstLoad, "the persisted Meta state must survive a fresh composition");
});
