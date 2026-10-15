import assert from "node:assert/strict";
import test from "node:test";
import { NotificationSoundTracker } from "../src/notificationSound";

const event = (id: string, seconds = 0) => ({ id, createdAt: new Date(Date.UTC(2026, 9, 15, 12, 0, seconds)).toISOString() });
function storage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

test("baseline is silent, one batch notifies once, reorder/remove/reinsert never replays", () => {
  const tracker = new NotificationSoundTracker(storage(), "test");
  assert.equal(tracker.consume([event("old")]), false);
  assert.equal(tracker.consume([event("a", 1), event("b", 1), event("old")]), true);
  assert.equal(tracker.consume([event("b", 1), event("a", 1)]), false);
  assert.equal(tracker.consume([]), false);
  assert.equal(tracker.consume([event("old"), event("a", 1)]), false);
});
test("persistent history survives a new observer, refresh and another tab", () => {
  const store = storage();
  const first = new NotificationSoundTracker(store, "user:inbox");
  first.consume([event("old")]);
  assert.equal(first.consume([event("new", 2)]), true);
  const tab = new NotificationSoundTracker(store, "user:inbox");
  tab.consume([event("old")]);
  assert.equal(tab.consume([event("new", 2)]), false);
  assert.equal(tab.consume([event("next", 3)]), true);
  assert.equal(first.consume([event("next", 3)]), false);
});
test("historical backfill does not sound, and distinct events at the same timestamp do", () => {
  const tracker = new NotificationSoundTracker(storage(), "test");
  tracker.consume([event("old", 5)]);
  assert.equal(tracker.consume([event("backfill", 1), event("old", 5)]), false);
  assert.equal(tracker.consume([event("same-second", 5)]), true);
  assert.equal(tracker.consume([event("same-second", 5)]), false);
});
test("empty baseline ignores old backfill but accepts current events", () => {
  const tracker = new NotificationSoundTracker(storage(), "test");
  tracker.consume([]);
  assert.equal(tracker.consume([{ id: "historic", createdAt: "2000-01-01T00:00:00Z" }]), false);
  assert.equal(tracker.consume([{ id: "live", createdAt: new Date().toISOString() }]), true);
});
test("user and feed histories remain independent", () => {
  const store = storage();
  for (const key of ["a:inbox", "a:dashboard", "b:inbox"]) {
    const tracker = new NotificationSoundTracker(store, key);
    tracker.consume([event("old")]);
    assert.equal(tracker.consume([event("new", 1)]), true);
  }
});
test("invalid storage, unavailable storage and invalid dates never break notifications", () => {
  for (const store of [null, { getItem: () => "{invalid", setItem: () => { throw Error("quota"); } }, { getItem: () => '{"latestAt":0,"ids":[null,5,"old"]}', setItem: () => {} }]) {
    const tracker = new NotificationSoundTracker(store, "test");
    assert.equal(tracker.consume([event("old")]), false);
    assert.equal(tracker.consume([{ id: "invalid", createdAt: "invalid" }]), false);
    assert.equal(tracker.consume([event("new", 1)]), true);
    assert.equal(tracker.consume([event("new", 1)]), false);
  }
});
test("bounded history does not replay older events when IDs have been trimmed", () => {
  const store = storage();
  const tracker = new NotificationSoundTracker(store, "test");
  const events = Array.from({ length: 2500 }, (_, i) => ({ id: String(i), createdAt: new Date(Date.UTC(2026, 9, 15) + i * 1000).toISOString() }));
  tracker.consume(events);
  assert.equal(JSON.parse(store.getItem("test")!).ids.length, 2000);
  assert.equal(tracker.consume(events.slice(0, 10)), false);
});
