import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarRange,
  moveAnchor,
  composeSocialPosts,
  executionState,
  expandAppointments,
  compareItems,
  inPeriod,
  loadAllMetaPages,
  independentSources,
  dayKey,
  validCalendarDay,
} from "../src/socialCalendar";
import {
  socialPost,
  socialPublication,
  socialAppointment,
} from "./socialCalendarFixtures";
const zone = "America/Sao_Paulo";
test("month navigation never carries an invalid day; leap years and year boundary", () => {
  for (const [from, to] of [
    ["2026-01-31", "2026-02-01"],
    ["2026-02-28", "2026-03-01"],
    ["2028-02-29", "2028-03-01"],
    ["2026-12-31", "2027-01-01"],
  ])
    assert.equal(moveAnchor(from, "month", 1), to);
  assert.equal(moveAnchor("2028-03-31", "month", -1), "2028-02-01");
  assert.equal(calendarRange("2028-02-29", "month", zone).end, "2028-03-01");
});
test("invalid date deep links cannot generate an invalid range", () => {
  assert.equal(validCalendarDay("2026-02-31"), false);
  assert.equal(validCalendarDay("2026-13-01"), false);
  assert.equal(validCalendarDay("2028-02-29"), true);
});
test("internal publication is editorial only; no proof of execution", () => {
  const [item] = composeSocialPosts([socialPost()], [], zone);
  assert.equal(item.editorial, "published");
  assert.equal(item.execution, "not_scheduled");
});
test("internal + Meta retain client identity, platform statuses and partial execution", () => {
  const result = composeSocialPosts(
    [socialPost()],
    [
      socialPublication(),
      socialPublication({ id: "fb", platform: "facebook", status: "failed" }),
    ],
    zone,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].source, "combined");
  assert.equal(result[0].execution, "partial");
  assert.equal(result[0].clientId, "client-a");
  assert.equal(result[0].platforms.length, 2);
  assert.equal(
    executionState([
      { platform: "instagram", status: "published" },
      { platform: "facebook", status: "published" },
    ]),
    "published",
  );
  for (const state of [
    "scheduled",
    "publishing",
    "failed",
    "cancelled",
  ] as const)
    assert.equal(
      executionState([{ platform: "instagram", status: state }]),
      state,
    );
});
test("titles and days never deduplicate; client and destination identities remain distinct", () => {
  const posts = [
    socialPost(),
    socialPost({ id: "other", cardId: "other" }),
    socialPost({ id: "client-b", clientAccountId: "client-b" }),
  ];
  assert.equal(
    composeSocialPosts(
      posts,
      [socialPublication({ scheduledAt: "2026-10-04T13:00:00Z" })],
      zone,
    ).length,
    4,
  );
  const destinations = composeSocialPosts(
    [socialPost()],
    [
      socialPublication(),
      socialPublication({
        id: "dest2",
        destinationId: "destination-b",
        destinationName: "Filial",
      }),
    ],
    zone,
  );
  assert.equal(destinations.length, 2);
  assert.ok(destinations.every((i) => i.source === "combined"));
  assert.ok(destinations.every((i) => i.editorial === "published"));
  assert.equal(
    composeSocialPosts(
      [socialPost({ id: "meta-1", cardId: null })],
      [socialPublication({ cardId: null })],
      zone,
    ).length,
    2,
  );
  assert.equal(
    composeSocialPosts(
      [],
      [
        socialPublication({ cardId: null }),
        socialPublication({ id: "another", cardId: null }),
      ],
      zone,
    ).length,
    2,
  );
});
test("appointments and posts interleave by instant and preserve original timezone", () => {
  const range = calendarRange("2026-10-04", "month", zone);
  const appointments = expandAppointments(
    [socialAppointment()],
    range.from,
    range.to,
    zone,
  );
  const items = [
    ...composeSocialPosts([socialPost()], [], zone),
    ...appointments,
  ].sort(compareItems);
  assert.deepEqual(
    items.map((i) => i.kind),
    ["appointment", "post"],
  );
  assert.equal(items[0].zone, "Europe/Stockholm");
  assert.equal(dayKey(items[0].at, zone), "2026-10-04");
});
test("monthly count excludes adjacent grid days, exact end and uses operation timezone", () => {
  const range = calendarRange("2026-10-31", "month", zone);
  assert.equal(range.days.length, 42);
  const items = composeSocialPosts(
    [
      socialPost({ id: "before", scheduledAt: "2026-10-01T02:59:59Z" }),
      socialPost({
        id: "start",
        cardId: "start",
        scheduledAt: "2026-10-01T03:00:00Z",
      }),
      socialPost({
        id: "end",
        cardId: "end",
        scheduledAt: "2026-11-01T03:00:00Z",
      }),
    ],
    [],
    zone,
  );
  assert.equal(
    items.filter((i) => inPeriod(i, range.start, range.end, zone)).length,
    1,
  );
});
test("recurring appointment keeps its local wall clock through DST, with no one-year ceiling", () => {
  const items = expandAppointments(
    [
      socialAppointment({
        startsAt: "2025-10-19T07:00:00Z",
        timeZone: "Europe/Stockholm",
        recurrenceType: "weekly",
      }),
    ],
    "2026-10-24T00:00:00Z",
    "2026-11-02T00:00:00Z",
    zone,
  );
  assert.deepEqual(
    items.map((i) => i.at),
    ["2026-10-25T08:00:00.000Z", "2026-11-01T08:00:00.000Z"],
  );
  assert.equal(
    expandAppointments(
      [socialAppointment({ startsAt: "2026-10-04T11:00:00Z" })],
      "2026-10-04T11:00:00Z",
      "2026-10-04T12:00:00Z",
      zone,
    ).length,
    1,
  );
  assert.equal(
    expandAppointments(
      [socialAppointment({ startsAt: "2026-10-04T12:00:00Z" })],
      "2026-10-04T11:00:00Z",
      "2026-10-04T12:00:00Z",
      zone,
    ).length,
    0,
  );
});
test("undated cards are excluded and explicit wall-clock schedule uses the operation timezone", () => {
  assert.equal(
    composeSocialPosts(
      [
        socialPost({
          scheduledAt: undefined,
          publishDate: "",
          publishTime: "",
        }),
      ],
      [],
      zone,
    ).length,
    0,
  );
  assert.equal(
    composeSocialPosts(
      [
        socialPost({
          scheduledAt: undefined,
          publishDate: "2026-10-04",
          publishTime: "09:00:00",
          scheduledTimeZone: undefined,
        }),
      ],
      [],
      zone,
    )[0].at,
    "2026-10-04T12:00:00.000Z",
  );
});
test("Meta pagination loads beyond the first page and fails safely on incomplete pages", async () => {
  const calls: number[] = [];
  const result = await loadAllMetaPages(async (offset) => {
    calls.push(offset);
    return {
      publications: Array.from({ length: offset === 0 ? 200 : 5 }, (_, i) =>
        socialPublication({ id: String(offset + i) }),
      ),
      total: 205,
    };
  });
  assert.equal(result.length, 205);
  assert.deepEqual(calls, [0, 200]);
  await assert.rejects(
    loadAllMetaPages(async () => ({ publications: [], total: 1 })),
    /paginação/,
  );
});
test("source failure never discards fulfilled sources", async () => {
  for (const failing of ["agenda", "meta"]) {
    const result = await independentSources({
      internal: Promise.resolve([socialPost()]),
      agenda:
        failing === "agenda"
          ? Promise.reject(new Error("offline"))
          : Promise.resolve([socialAppointment()]),
      meta:
        failing === "meta"
          ? Promise.reject(new Error("offline"))
          : Promise.resolve([socialPublication()]),
    });
    assert.equal(result.internal.status, "fulfilled");
    assert.equal(result[failing as "agenda" | "meta"].status, "rejected");
  }
});

import {matchesCalendarDisplayFilters} from '../src/socialCalendarPresentation';
test('presentation filters use actual source, editorial state and confirmed platform statuses',()=>{
 const item=composeSocialPosts([socialPost()],[socialPublication(),socialPublication({id:'fb',platform:'facebook',status:'failed'})],zone)[0];
 const filters={origin:'combined',editorial:'published',execution:'partial',platform:'facebook'};
 const snapshot=JSON.stringify(item);
 assert.equal(matchesCalendarDisplayFilters(item,filters,true),true);
 assert.equal(matchesCalendarDisplayFilters(item,{...filters,execution:'published'},true),false);
 assert.equal(matchesCalendarDisplayFilters(item,{...filters,execution:'unavailable'},false),true);
 assert.equal(matchesCalendarDisplayFilters(item,filters,false),false);
 assert.equal(JSON.stringify(item),snapshot);
});
