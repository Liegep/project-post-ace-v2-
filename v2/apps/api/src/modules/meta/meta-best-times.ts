export type MetaBestPublishingTime = {
  weekday: number | null;
  hour: number;
  averageFollowers: number;
  samples: number;
};

type SlotSample = { weekday: number | null; hour: number; followers: number };
type UnknownRecord = Record<string, unknown>;

const WEEKDAYS = new Map<string, number>([
  ["sun", 0], ["sunday", 0], ["domingo", 0],
  ["mon", 1], ["monday", 1], ["segunda", 1], ["segunda-feira", 1],
  ["tue", 2], ["tues", 2], ["tuesday", 2], ["terca", 2], ["terça", 2], ["terca-feira", 2], ["terça-feira", 2],
  ["wed", 3], ["wednesday", 3], ["quarta", 3], ["quarta-feira", 3],
  ["thu", 4], ["thur", 4], ["thurs", 4], ["thursday", 4], ["quinta", 4], ["quinta-feira", 4],
  ["fri", 5], ["friday", 5], ["sexta", 5], ["sexta-feira", 5],
  ["sat", 6], ["saturday", 6], ["sabado", 6], ["sábado", 6],
]);

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseHour(value: unknown) {
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : null;
}

function parseWeekday(value: unknown) {
  const numeric = finiteNumber(value);
  if (numeric !== null && Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) return numeric;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const named = WEEKDAYS.get(normalized);
  if (named !== undefined) return named;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getUTCDay();
}

function weekdayFromEntry(entry: UnknownRecord) {
  for (const key of ["weekday", "day_of_week", "dayOfWeek", "day"]) {
    const weekday = parseWeekday(entry[key]);
    if (weekday !== null) return weekday;
  }
  for (const key of ["start_time", "startTime"]) {
    const value = entry[key];
    if (typeof value !== "string") continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getUTCDay();
  }
  for (const key of ["end_time", "endTime"]) {
    const value = entry[key];
    if (typeof value !== "string") continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return new Date(date.getTime() - 60_000).getUTCDay();
  }
  return null;
}

function addSample(samples: SlotSample[], weekday: number | null, hourValue: unknown, followersValue: unknown) {
  const hour = parseHour(hourValue);
  const followers = finiteNumber(followersValue);
  if (hour === null || followers === null || followers <= 0) return;
  samples.push({ weekday, hour, followers });
}

function firstDefined(record: UnknownRecord, keys: string[]) {
  for (const key of keys) if (record[key] !== undefined) return record[key];
  return undefined;
}

function extractBreakdown(breakdown: UnknownRecord, inheritedWeekday: number | null, samples: SlotSample[]) {
  const dimensionKeysValue = breakdown.dimension_keys ?? breakdown.dimensionKeys;
  const dimensionKeys = Array.isArray(dimensionKeysValue) ? dimensionKeysValue.map(String) : [];
  const results = Array.isArray(breakdown.results) ? breakdown.results : [];
  for (const rawResult of results) {
    if (!isRecord(rawResult)) continue;
    const dimensionsValue = rawResult.dimension_values ?? rawResult.dimensionValues;
    const dimensions = Array.isArray(dimensionsValue) ? dimensionsValue : [];
    let hour: unknown;
    let weekday = inheritedWeekday;
    dimensionKeys.forEach((key, index) => {
      const normalized = key.toLowerCase();
      if (normalized.includes("hour")) hour = dimensions[index];
      if (normalized.includes("weekday") || normalized.includes("day_of_week")) weekday = parseWeekday(dimensions[index]);
    });
    addSample(samples, weekday, hour, firstDefined(rawResult, ["value", "count", "online_followers", "followers"]));
  }
}

function extractValue(value: unknown, inheritedWeekday: number | null, samples: SlotSample[], depth = 0) {
  if (depth > 5 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) extractValue(item, inheritedWeekday, samples, depth + 1);
    return;
  }
  if (!isRecord(value)) return;

  let foundHourlyMap = false;
  for (const [key, count] of Object.entries(value)) {
    const hour = parseHour(key);
    if (hour === null || finiteNumber(count) === null) continue;
    foundHourlyMap = true;
    addSample(samples, inheritedWeekday, hour, count);
  }
  if (foundHourlyMap) return;

  const weekday = weekdayFromEntry(value) ?? inheritedWeekday;
  const explicitHour = firstDefined(value, ["hour", "hour_of_day", "hourOfDay"]);
  const explicitCount = firstDefined(value, ["value", "count", "online_followers", "followers"]);
  if (explicitHour !== undefined && explicitCount !== undefined) addSample(samples, weekday, explicitHour, explicitCount);

  if (Array.isArray(value.breakdowns)) {
    for (const breakdown of value.breakdowns) if (isRecord(breakdown)) extractBreakdown(breakdown, weekday, samples);
  }
  for (const key of ["results", "data", "values", "value"]) {
    if (value[key] !== undefined) extractValue(value[key], weekday, samples, depth + 1);
  }
}

function metricRows(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
  return payload.data.filter((metric): metric is UnknownRecord => (
    isRecord(metric) && (metric.name === undefined || metric.name === "online_followers")
  ));
}

export function parseInstagramBestPublishingTimes(payload: unknown): MetaBestPublishingTime[] {
  const samples: SlotSample[] = [];
  for (const metric of metricRows(payload)) {
    if (Array.isArray(metric.values)) {
      for (const rawEntry of metric.values) {
        if (isRecord(rawEntry)) extractValue(rawEntry.value, weekdayFromEntry(rawEntry), samples);
      }
    }
    if (metric.total_value !== undefined) extractValue(metric.total_value, null, samples);
  }

  const withWeekday = samples.filter((sample) => sample.weekday !== null);
  const selected = withWeekday.length ? withWeekday : samples.map((sample) => ({ ...sample, weekday: null }));
  const aggregates = new Map<string, { weekday: number | null; hour: number; total: number; samples: number }>();
  for (const sample of selected) {
    const key = `${sample.weekday ?? "any"}:${sample.hour}`;
    const aggregate = aggregates.get(key) ?? { weekday: sample.weekday, hour: sample.hour, total: 0, samples: 0 };
    aggregate.total += sample.followers;
    aggregate.samples += 1;
    aggregates.set(key, aggregate);
  }

  return [...aggregates.values()]
    .map((slot) => ({ weekday: slot.weekday, hour: slot.hour, averageFollowers: Math.round(slot.total / slot.samples), samples: slot.samples }))
    .sort((left, right) => right.averageFollowers - left.averageFollowers || right.samples - left.samples || (left.weekday ?? 7) - (right.weekday ?? 7) || left.hour - right.hour)
    .slice(0, 3);
}

function valueShape(value: unknown, depth = 0): unknown {
  if (value === null) return "null";
  if (Array.isArray(value)) return { type: "array", length: value.length, sample: depth < 2 ? value.slice(0, 2).map((item) => valueShape(item, depth + 1)) : undefined };
  if (!isRecord(value)) return typeof value;
  const keys = Object.keys(value).slice(0, 24);
  return { type: "object", keys, sample: depth < 2 ? Object.fromEntries(keys.slice(0, 6).map((key) => [key, valueShape(value[key], depth + 1)])) : undefined };
}

export function summarizeInstagramOnlineFollowersPayload(payload: unknown) {
  return {
    metrics: metricRows(payload).slice(0, 4).map((metric) => {
      const values = Array.isArray(metric.values) ? metric.values : [];
      return {
        name: typeof metric.name === "string" ? metric.name : null,
        period: typeof metric.period === "string" ? metric.period : null,
        valuesCount: values.length,
        values: values.slice(0, 3).map((value) => isRecord(value) ? {
          keys: Object.keys(value).slice(0, 12),
          valueType: Array.isArray(value.value) ? "array" : value.value === null ? "null" : typeof value.value,
          valueShape: valueShape(value.value),
        } : { type: typeof value }),
        totalValueShape: metric.total_value === undefined ? null : valueShape(metric.total_value),
      };
    }),
  };
}

export function instagramOnlineFollowersDateRange(now = new Date()) {
  const untilDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sinceDate = new Date(untilDate.getTime() - 30 * 24 * 60 * 60_000);
  return { since: sinceDate.toISOString().slice(0, 10), until: untilDate.toISOString().slice(0, 10) };
}
