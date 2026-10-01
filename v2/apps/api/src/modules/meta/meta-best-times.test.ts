import assert from "node:assert/strict";
import test from "node:test";
import { instagramOnlineFollowersDateRange, INSTAGRAM_ONLINE_FOLLOWERS_LOOKBACK_DAYS, META_ONLINE_FOLLOWERS_SOURCE_TIME_ZONE, parseInstagramBestPublishingTimes, summarizeInstagramOnlineFollowersPayload } from "./meta-best-times.js";

const currentMetaFormatFixture = {
  data: [{
    id: "instagram-account/insights/online_followers/lifetime",
    name: "online_followers",
    period: "lifetime",
    values: [
      { value: {}, end_time: "2026-09-01T07:00:00+0000" },
      { value: { "9": 20, "12": 100, "13": 80 }, end_time: "2026-09-02T07:00:00+0000" },
      { value: { "9": 30, "12": 200, "13": 90 }, end_time: "2026-09-03T07:00:00+0000" },
    ],
    title: "Seguidores online",
  }],
};

test("parses the real Graph API v26 online_followers values/end_time format", () => {
  assert.deepEqual(parseInstagramBestPublishingTimes(currentMetaFormatFixture, "Europe/Stockholm"), [
    { weekday: 3, hour: 21, averageFollowers: 200, samples: 1 },
    { weekday: 2, hour: 21, averageFollowers: 100, samples: 1 },
    { weekday: 3, hour: 22, averageFollowers: 90, samples: 1 },
  ]);
});

test("converts a UTC-07 bucket without changing the source weekday", () => {
  const fixture = { data: [{ name: "online_followers", values: [{ value: { "10": 100 }, end_time: "2026-07-15T07:00:00+0000" }] }] };
  assert.deepEqual(parseInstagramBestPublishingTimes(fixture, "Europe/Stockholm"), [
    { weekday: 2, hour: 19, averageFollowers: 100, samples: 1 },
  ]);
});

test("moves hour and weekday together when conversion crosses midnight", () => {
  const fixture = { data: [{ name: "online_followers", values: [{ value: { "15": 100 }, end_time: "2026-07-15T07:00:00+0000" }] }] };
  assert.deepEqual(parseInstagramBestPublishingTimes(fixture, "Europe/Stockholm"), [
    { weekday: 3, hour: 0, averageFollowers: 100, samples: 1 },
  ]);
});

test("uses Europe/Stockholm daylight-saving rules in summer and winter", () => {
  const summer = { data: [{ name: "online_followers", values: [{ value: { "15": 100 }, end_time: "2026-07-15T07:00:00+0000" }] }] };
  const winter = { data: [{ name: "online_followers", values: [{ value: { "15": 100 }, end_time: "2026-01-15T07:00:00+0000" }] }] };
  assert.deepEqual(parseInstagramBestPublishingTimes(summer, "Europe/Stockholm")[0], { weekday: 3, hour: 0, averageFollowers: 100, samples: 1 });
  assert.deepEqual(parseInstagramBestPublishingTimes(winter, "Europe/Stockholm")[0], { weekday: 3, hour: 23, averageFollowers: 100, samples: 1 });
});

test("treats the production bucket source as fixed UTC-07 and combines hour with end_time", () => {
  assert.equal(META_ONLINE_FOLLOWERS_SOURCE_TIME_ZONE, "UTC-07:00");
  const fixture = { data: [{ name: "online_followers", period: "lifetime", values: [{ value: { "17": 284 }, end_time: "2026-09-22T07:00:00+0000" }] }] };
  assert.deepEqual(parseInstagramBestPublishingTimes(fixture, "Europe/Stockholm"), [
    { weekday: 2, hour: 2, averageFollowers: 284, samples: 1 },
  ]);
});

test("returns no recommendation when Meta returns no data", () => {
  assert.deepEqual(parseInstagramBestPublishingTimes({ data: [] }), []);
  assert.deepEqual(parseInstagramBestPublishingTimes({}), []);
});

test("ignores incomplete and invalid structures without inventing suggestions", () => {
  const incompleteFixture = {
    data: [
      { name: "online_followers", period: "lifetime", values: [{ value: null }, { value: { "24": 900, noon: 800, "12": "invalid" } }] },
      { name: "another_metric", values: [{ value: { "12": 9999 } }] },
    ],
  };
  assert.deepEqual(parseInstagramBestPublishingTimes(incompleteFixture), []);
});

test("returns the three best general hours when the response has no weekday", () => {
  const hourOnlyFixture = {
    data: [{
      name: "online_followers",
      period: "lifetime",
      values: [
        { value: [{ hour: 9, value: 100 }, { hour: 10, value: 150 }, { hour: 11, value: 50 }] },
        { value: [{ hour: 9, value: 300 }, { hour: 10, value: 100 }, { hour: 11, value: 100 }] },
      ],
    }],
  };
  assert.deepEqual(parseInstagramBestPublishingTimes(hourOnlyFixture), [
    { weekday: null, hour: 9, averageFollowers: 200, samples: 2 },
    { weekday: null, hour: 10, averageFollowers: 125, samples: 2 },
    { weekday: null, hour: 11, averageFollowers: 75, samples: 2 },
  ]);
});

test("parses combined weekday and hour breakdown results", () => {
  const dayAndHourFixture = {
    data: [{
      name: "online_followers",
      period: "lifetime",
      total_value: {
        breakdowns: [{
          dimension_keys: ["day_of_week", "hour"],
          results: [
            { dimension_values: ["monday", "18"], value: 300 },
            { dimension_values: ["friday", "12"], value: 500 },
            { dimension_values: ["friday", "18"], value: 450 },
            { dimension_values: ["sunday", "9"], value: 100 },
          ],
        }],
      },
    }],
  };
  assert.deepEqual(parseInstagramBestPublishingTimes(dayAndHourFixture), [
    { weekday: 5, hour: 12, averageFollowers: 500, samples: 1 },
    { weekday: 5, hour: 18, averageFollowers: 450, samples: 1 },
    { weekday: 1, hour: 18, averageFollowers: 300, samples: 1 },
  ]);
});

test("safe response logging exposes only bounded diagnostic data and no secrets or ids", () => {
  const summary = summarizeInstagramOnlineFollowersPayload(currentMetaFormatFixture, { since: "2026-09-23", until: "2026-09-30", targetTimeZone: "Europe/Stockholm" });
  const serialized = JSON.stringify(summary);
  assert.deepEqual(summary.query, { since: "2026-09-23", until: "2026-09-30", period: "lifetime" });
  assert.equal(summary.sourceTimeZone, "UTC-07:00");
  assert.equal(summary.targetTimeZone, "Europe/Stockholm");
  assert.equal(summary.metrics[0]?.values[0]?.endTime, "2026-09-01T07:00:00+0000");
  assert.deepEqual(summary.metrics[0]?.values[1]?.topHours, [
    { hour: 12, followers: 100 },
    { hour: 13, followers: 80 },
    { hour: 9, followers: 20 },
  ]);
  assert.match(serialized, /online_followers/);
  assert.match(serialized, /valuesCount/);
  assert.match(serialized, /valueShape/);
  assert.match(serialized, /topHours/);
  assert.match(serialized, /endTime/);
  assert.match(serialized, /UTC-07:00/);
  assert.doesNotMatch(serialized, /instagram-account/);
  assert.doesNotMatch(serialized, /access_token|appsecret_proof/i);
});

test("requests the explicit seven-day historical window", () => {
  assert.equal(INSTAGRAM_ONLINE_FOLLOWERS_LOOKBACK_DAYS, 7);
  assert.deepEqual(instagramOnlineFollowersDateRange(new Date("2026-09-30T22:00:00Z")), {
    since: "2026-09-23",
    until: "2026-09-30",
  });
});

test("uses UTC date boundaries independently of the caller offset", () => {
  assert.deepEqual(instagramOnlineFollowersDateRange(new Date("2026-10-01T00:30:00+14:00")), {
    since: "2026-09-23",
    until: "2026-09-30",
  });
  assert.deepEqual(instagramOnlineFollowersDateRange(new Date("2026-09-30T23:30:00-10:00")), {
    since: "2026-09-24",
    until: "2026-10-01",
  });
});
