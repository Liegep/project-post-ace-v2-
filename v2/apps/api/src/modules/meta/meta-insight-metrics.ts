/** Pure parsers: never interpret missing observations as zero. */
export type MetricStatus = "available" | "empty" | "invalid_metric" | "permission_error" | "api_error";
export type MetricMetadata = { status: MetricStatus; reason?: "period_too_long"; value?: number | null; source: string; aggregation: string; code: number | null; structure: { entries: number; dailyValues: number; totalValue: boolean; breakdowns: number } };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const metricNumber = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const entries = (payload: unknown, metric: string) => array(record(payload).data).map(record).filter((item) => item.name === metric);
export function parseInsightNumber(payload: unknown, metric: string, aggregation: "sum" | "last" = "sum") {
  const rows = entries(payload, metric);
  if (rows.length !== 1) return null;
  const total = metricNumber(record(rows[0].total_value).value);
  if (total !== null) return total;
  const observations = array(rows[0].values).map(record);
  if (!observations.length || observations.some((item) => metricNumber(item.value) === null)) return null;
  const values = observations.map((item) => metricNumber(item.value)!);
  return aggregation === "last" ? values[values.length - 1] : values.reduce((sum, value) => sum + value, 0);
}
export function followerGrowth(gained: number | null, lost: number | null) {
  return { followersGained: gained, followersLost: lost, followersNet: gained === null || lost === null ? null : gained - lost };
}
export function parseInstagramFollowerGrowth(payload: unknown) {
  const rows = entries(payload, "follows_and_unfollows");
  let gained: number | null = null, lost: number | null = null;
  if (rows.length !== 1) return followerGrowth(null, null);
  const parse = (value: unknown) => {
    const object = record(value);
    let follows: number | null = null, unfollows: number | null = null;
    // Some daily responses expose the two named values directly.
    if ("follows" in object || "unfollows" in object) return { follows: metricNumber(object.follows), unfollows: metricNumber(object.unfollows) };
    for (const rawBreakdown of array(object.breakdowns)) {
      const breakdown = record(rawBreakdown);
      const keys = array(breakdown.dimension_keys);
      // Refuse multidimensional/duplicate breakdowns: summing them can double-count.
      if (keys.length !== 1 || keys[0] !== "follow_type") continue;
      const seen = new Set<string>();
      for (const rawResult of array(breakdown.results)) {
        const result = record(rawResult);
        const label = String(array(result.dimension_values)[0] ?? "").toLowerCase();
        if (!["follow", "follows", "follower", "unfollow", "unfollows", "non_follower"].includes(label)) continue;
        const kind = label.startsWith("un") || label === "non_follower" ? "unfollows" : "follows";
        if (seen.has(kind)) return { follows: null, unfollows: null };
        seen.add(kind);
        if (kind === "follows") follows = metricNumber(result.value); else unfollows = metricNumber(result.value);
      }
      return { follows, unfollows };
    }
    return { follows, unfollows };
  };
  if (rows[0].total_value !== undefined) {
    const result = parse(rows[0].total_value); gained = result.follows; lost = result.unfollows;
  } else {
    const daily = array(rows[0].values).map((raw) => { const item = record(raw); return parse(typeof item.value === "object" ? item.value : item); });
    if (daily.length && daily.every((item) => item.follows !== null)) gained = daily.reduce((sum, item) => sum + item.follows!, 0);
    if (daily.length && daily.every((item) => item.unfollows !== null)) lost = daily.reduce((sum, item) => sum + item.unfollows!, 0);
  }
  return followerGrowth(gained, lost);
}
export function metricStatus(warning: { code?: number | null; message?: string } | null | undefined, value: number | null): MetricStatus {
  if (warning) {
    if ([10, 190, 200, 294].includes(warning.code ?? -1)) return "permission_error";
    if (warning.code === 100 && /invalid.*metric|metric.*invalid|deprecated|valid insights metric|not.*valid.*insights.*metric/i.test(warning.message ?? "")) return "invalid_metric";
    return "api_error";
  }
  return value === null ? "empty" : "available";
}
export function metricFailureDetails(warning: { code?: number | null; message?: string } | null | undefined): { reason?: "period_too_long" } {
  const message = warning?.message ?? "";
  return warning?.code === 100 && /30\s*days?|2592000\s*seconds?/i.test(message)
    && /exceed|longer|greater|more than|at most|maximum|less than|no more than/i.test(message)
    && /since|until|period|range|interval|window/i.test(message)
    ? { reason: "period_too_long" } : {};
}
export function summarizeMetricPayload(payload: unknown, metric: string): MetricMetadata["structure"] {
  const rows = entries(payload, metric);
  return { entries: rows.length, dailyValues: rows.reduce((sum, row) => sum + array(row.values).length, 0), totalValue: rows.some((row) => row.total_value !== undefined), breakdowns: rows.reduce((sum, row) => sum + array(record(row.total_value).breakdowns).length + array(row.values).reduce<number>((count, value) => count + array(record(record(value).value).breakdowns).length, 0), 0) };
}
/** Allowlist only. No payload strings, error messages, IDs, paging URLs or secrets. */
export function safeInsightsDiagnostics(result: { instagram: { metricMetadata: Record<string, MetricMetadata>; metricDiagnostics?: Record<string, MetricMetadata>; metrics: Record<string, number | null> } | null; facebook: { metricMetadata: Record<string, MetricMetadata>; metricDiagnostics?: Record<string, MetricMetadata>; metrics: Record<string, number | null> } | null }) {
  return (["instagram", "facebook"] as const).flatMap((platform) => {
    const channel = result[platform];
    if (!channel) return [];
    const probes = { ...channel.metricDiagnostics };
    for (const [key, metadata] of Object.entries(channel.metricMetadata)) {
      if (metadata.aggregation !== "not_queried" && metadata.aggregation !== "unsupported" && !probes[metadata.source]) probes[metadata.source] = { ...metadata, value: channel.metrics[key] ?? null };
    }
    return Object.entries(probes).map(([metric, metadata]) => ({ platform, metric, status: metadata.status, ...(metadata.reason ? { reason: metadata.reason } : {}), value: metadata.value ?? null,
      aggregation: metadata.aggregation, code: metadata.code, ...(metric === "follows_and_unfollows" ? { values: { follows: channel.metrics.followersGained ?? null, unfollows: channel.metrics.followersLost ?? null } } : {}), structure: { entries: metadata.structure.entries, dailyValues: metadata.structure.dailyValues, totalValue: metadata.structure.totalValue, breakdowns: metadata.structure.breakdowns } }));
  });
}
