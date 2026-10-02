import assert from "node:assert/strict";
import test from "node:test";
import { commemorativeAlerts, daysUntilDate } from "../src/commemorativeAlerts";

const today = new Date(2026, 9, 2, 18, 45);
for (const [offset, visible, badge] of [
  [5, false, null], [4, true, "Em 4 dias"], [3, true, "Em 3 dias"],
  [2, true, "Em 2 dias"], [1, true, "Amanhã"], [0, true, "Hoje"], [-1, false, null],
] as const) {
  test(`date ${offset} days away: visibility ${visible}, badge ${badge}`, () => {
    const item = { id: "holiday", date: `2026-10-${String(2 + offset).padStart(2, "0")}` };
    assert.equal(daysUntilDate(item.date, today), offset);
    const result = commemorativeAlerts([item], today);
    assert.deepEqual(result.holidays, visible ? [item] : []);
    assert.equal(result.badge, badge);
  });
}

test("keeps all monitored dates in the window, including multiple countries on the same day", () => {
  const items = [
    { id: "BR", date: "2026-10-06" }, { id: "SE", date: "2026-10-03" },
    { id: "PT", date: "2026-10-03" }, { id: "US", date: "2026-10-04" },
  ];
  const result = commemorativeAlerts(items, today);
  assert.deepEqual(result.holidays, items);
  assert.equal(result.badge, "Amanhã");
  assert.equal(commemorativeAlerts([...items, { id: "today", date: "2026-10-02" }], today).badge, "Hoje");
});

test("disappears only after the last eligible date has passed", () => {
  const items = [{ date: "2026-10-06" }];
  for (let day = 2; day <= 6; day++) {
    assert.equal(commemorativeAlerts(items, new Date(2026, 9, day)).holidays.length, 1);
  }
  assert.deepEqual(commemorativeAlerts(items, new Date(2026, 9, 7)), { holidays: [], badge: null });
  assert.deepEqual(commemorativeAlerts([], today), { holidays: [], badge: null });
  assert.equal(commemorativeAlerts([{ date: "2026-10-01" }, { date: "2026-10-07" }], today).badge, null);
});

test("calendar distance does not depend on time of day or daylight saving transitions", () => {
  for (const hour of [0, 12, 23]) {
    assert.equal(daysUntilDate("2026-10-02", new Date(2026, 9, 2, hour)), 0);
    assert.equal(daysUntilDate("2026-10-27", new Date(2026, 9, 23, hour)), 4);
    assert.equal(daysUntilDate("2026-03-31", new Date(2026, 2, 27, hour)), 4);
  }
});

test("window spans month and year boundaries", () => {
  assert.deepEqual(commemorativeAlerts([{ date: "2027-01-01" }], new Date(2026, 11, 28)).badge, "Em 4 dias");
  assert.equal(commemorativeAlerts([{ date: "2026-11-01" }], new Date(2026, 9, 31)).badge, "Amanhã");
});

test("malformed dates do not create an alert", () => {
  assert.deepEqual(commemorativeAlerts([{ date: "invalid" }], today), { holidays: [], badge: null });
});
