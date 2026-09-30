import assert from "node:assert/strict";
import test from "node:test";
import { instagramOnlineFollowersDateRange, parseInstagramBestPublishingTimes, summarizeInstagramOnlineFollowersPayload } from "./meta-best-times.js";

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
  assert.deepEqual(parseInstagramBestPublishingTimes(currentMetaFormatFixture), [
    { weekday: 4, hour: 12, averageFollowers: 200, samples: 1 },
    { weekday: 3, hour: 12, averageFollowers: 100, samples: 1 },
    { weekday: 4, hour: 13, averageFollowers: 90, samples: 1 },
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

test("safe response logging exposes shape but not ids or follower counts", () => {
  const summary = summarizeInstagramOnlineFollowersPayload(currentMetaFormatFixture);
  const serialized = JSON.stringify(summary);
  assert.match(serialized, /online_followers/);
  assert.match(serialized, /valuesCount/);
  assert.match(serialized, /valueShape/);
  assert.doesNotMatch(serialized, /instagram-account/);
  assert.doesNotMatch(serialized, /"followers":200/);
  assert.doesNotMatch(serialized, /100|200/);
});

test("requests the explicit 30-day historical window", () => {
  assert.deepEqual(instagramOnlineFollowersDateRange(new Date("2026-09-30T22:00:00Z")), {
    since: "2026-08-31",
    until: "2026-09-30",
  });
});
