export type MetaBestPublishingTime = {
  weekday: number | null;
  hour: number;
  averageFollowers: number;
  samples: number;
};

type SlotSample = { weekday: number | null; hour: number; followers: number };
type UnknownRecord = Record<string, unknown>;
type SlotContext = {
  weekday: number | null;
  startTimeMs: number | null;
  endTimeMs: number | null;
};

export const META_ONLINE_FOLLOWERS_SOURCE_TIME_ZONE = "UTC-07:00";

const EMPTY_CONTEXT: SlotContext = { weekday: null, startTimeMs: null, endTimeMs: null };

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

function contextFromEntry(entry: UnknownRecord, inherited: SlotContext = EMPTY_CONTEXT): SlotContext {
  let weekday = inherited.weekday;
  for (const key of ["weekday", "day_of_week", "dayOfWeek", "day"]) {
    const parsed = parseWeekday(entry[key]);
    if (parsed !== null) {
      weekday = parsed;
      break;
    }
  }
  let startTimeMs = inherited.startTimeMs;
  for (const key of ["start_time", "startTime"]) {
    const value = entry[key];
    if (typeof value !== "string") continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      startTimeMs = date.getTime();
      break;
    }
  }
  let endTimeMs = inherited.endTimeMs;
  for (const key of ["end_time", "endTime"]) {
    const value = entry[key];
    if (typeof value !== "string") continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      endTimeMs = date.getTime();
      break;
    }
  }
  return { weekday, startTimeMs, endTimeMs };
}

function slotInTimeZone(context: SlotContext, hour: number, timeZone: string) {
  // Graph API lifetime buckets are fixed to 24-hour periods ending at
  // UTC-07:00. `end_time` is the instant immediately after the bucket day,
  // so hour 17 is 7 hours before that boundary, not 17:00 in the viewer's
  // timezone. Deriving an instant first also moves the weekday correctly.
  const instantMs = context.startTimeMs !== null
    ? context.startTimeMs + hour * 60 * 60_000
    : context.endTimeMs !== null
      ? context.endTimeMs - (24 - hour) * 60 * 60_000
      : null;
  if (instantMs === null) return { weekday: context.weekday, hour };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instantMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return { weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), hour: part("hour") };
}

function addSample(samples: SlotSample[], context: SlotContext, hourValue: unknown, followersValue: unknown, timeZone: string) {
  const hour = parseHour(hourValue);
  const followers = finiteNumber(followersValue);
  if (hour === null || followers === null || followers <= 0) return;
  samples.push({ ...slotInTimeZone(context, hour, timeZone), followers });
}

function firstDefined(record: UnknownRecord, keys: string[]) {
  for (const key of keys) if (record[key] !== undefined) return record[key];
  return undefined;
}

function extractBreakdown(breakdown: UnknownRecord, inheritedContext: SlotContext, samples: SlotSample[], timeZone: string) {
  const dimensionKeysValue = breakdown.dimension_keys ?? breakdown.dimensionKeys;
  const dimensionKeys = Array.isArray(dimensionKeysValue) ? dimensionKeysValue.map(String) : [];
  const results = Array.isArray(breakdown.results) ? breakdown.results : [];
  for (const rawResult of results) {
    if (!isRecord(rawResult)) continue;
    const dimensionsValue = rawResult.dimension_values ?? rawResult.dimensionValues;
    const dimensions = Array.isArray(dimensionsValue) ? dimensionsValue : [];
    let hour: unknown;
    let weekday = inheritedContext.weekday;
    dimensionKeys.forEach((key, index) => {
      const normalized = key.toLowerCase();
      if (normalized.includes("hour")) hour = dimensions[index];
      if (normalized.includes("weekday") || normalized.includes("day_of_week")) weekday = parseWeekday(dimensions[index]);
    });
    addSample(samples, { ...inheritedContext, weekday }, hour, firstDefined(rawResult, ["value", "count", "online_followers", "followers"]), timeZone);
  }
}

function extractValue(value: unknown, inheritedContext: SlotContext, samples: SlotSample[], timeZone: string, depth = 0) {
  if (depth > 5 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) extractValue(item, inheritedContext, samples, timeZone, depth + 1);
    return;
  }
  if (!isRecord(value)) return;

  let foundHourlyMap = false;
  for (const [key, count] of Object.entries(value)) {
    const hour = parseHour(key);
    if (hour === null || finiteNumber(count) === null) continue;
    foundHourlyMap = true;
    addSample(samples, inheritedContext, hour, count, timeZone);
  }
  if (foundHourlyMap) return;

  const context = contextFromEntry(value, inheritedContext);
  const explicitHour = firstDefined(value, ["hour", "hour_of_day", "hourOfDay"]);
  const explicitCount = firstDefined(value, ["value", "count", "online_followers", "followers"]);
  if (explicitHour !== undefined && explicitCount !== undefined) addSample(samples, context, explicitHour, explicitCount, timeZone);

  if (Array.isArray(value.breakdowns)) {
    for (const breakdown of value.breakdowns) if (isRecord(breakdown)) extractBreakdown(breakdown, context, samples, timeZone);
  }
  for (const key of ["results", "data", "values", "value"]) {
    if (value[key] !== undefined) extractValue(value[key], context, samples, timeZone, depth + 1);
  }
}

function metricRows(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
  return payload.data.filter((metric): metric is UnknownRecord => (
    isRecord(metric) && (metric.name === undefined || metric.name === "online_followers")
  ));
}

export function parseInstagramBestPublishingTimes(payload: unknown, timeZone = "UTC"): MetaBestPublishingTime[] {
  const samples: SlotSample[] = [];
  for (const metric of metricRows(payload)) {
    if (Array.isArray(metric.values)) {
      for (const rawEntry of metric.values) {
        if (isRecord(rawEntry)) extractValue(rawEntry.value, contextFromEntry(rawEntry), samples, timeZone);
      }
    }
    if (metric.total_value !== undefined) extractValue(metric.total_value, EMPTY_CONTEXT, samples, timeZone);
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

export function summarizeInstagramOnlineFollowersPayload(payload: unknown, context?: { since: string; until: string; targetTimeZone: string }) {
  return {
    query: context ? { since: context.since, until: context.until, period: "lifetime" } : undefined,
    sourceTimeZone: META_ONLINE_FOLLOWERS_SOURCE_TIME_ZONE,
    targetTimeZone: context?.targetTimeZone,
    metrics: metricRows(payload).slice(0, 4).map((metric) => {
      const values = Array.isArray(metric.values) ? metric.values : [];
      return {
        name: typeof metric.name === "string" ? metric.name : null,
        period: typeof metric.period === "string" ? metric.period : null,
        valuesCount: values.length,
        values: values.slice(0, 3).map((value) => isRecord(value) ? {
          keys: Object.keys(value).slice(0, 12),
          endTime: typeof value.end_time === "string" ? value.end_time : null,
          valueType: Array.isArray(value.value) ? "array" : value.value === null ? "null" : typeof value.value,
          valueShape: valueShape(value.value),
          topHours: isRecord(value.value) ? Object.entries(value.value)
            .map(([hour, followers]) => ({ hour: parseHour(hour), followers: finiteNumber(followers) }))
            .filter((slot): slot is { hour: number; followers: number } => slot.hour !== null && slot.followers !== null)
            .sort((left, right) => right.followers - left.followers)
            .slice(0, 3) : [],
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
