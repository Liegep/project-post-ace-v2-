import type { Pool, RowDataPacket } from "mysql2/promise";
import { LEGACY_APP_TIME_ZONE, validTimeZone, zonedWallClockToIso } from "../../lib/zoned-date-time.js";

export type DashboardPost = {
  id: string;
  clientAccountId: string;
  isBriefApproval: boolean | number;
  artType?: string | null;
  mediaType?: string | null;
  archived: boolean | number;
  legacyId?: string | null;
  scheduledAt: string | null;
  scheduledTimeZone: string | null;
  publishedAt: string | null;
  deadlineAt: string | null;
  calendarDate: string | null;
  calendarTime: string | null;
  calendarTimeZone: string | null;
};
export type DashboardMetaPost = {
  cardId: string;
  clientAccountId: string;
  status: "scheduled" | "publishing" | "published" | "failed" | "cancelled";
  scheduledAt: string | null;
  publishedAt: string | null;
};
type PostState = "pending" | "scheduled" | "published";
export type ClassifiedDashboardPost = {
  id: string; state: PostState; operationalDate: string;
  source: "internal_published" | "internal_scheduled" | "meta_published" | "meta_scheduled" | "deadline" | "calendar" | "meta_previous_plan";
};
export type MonthlyStatistics = {
  timeZone: string; month: string; postsThisMonth: number; postsPreviousMonth: number;
  pending: number; scheduled: number; published: number; publishedPreviousMonth: number;
};

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
function dateInZone(instant: string, timeZone: string) {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) { formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }); dateFormatters.set(timeZone, formatter); }
  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function instant(value: string | null, storedZone: string) {
  if (!value || !plannedDay(value)) return null;
  const converted = zonedWallClockToIso(value, storedZone);
  return converted && Number.isFinite(Date.parse(converted)) ? converted : null;
}
function plannedDay(value: string | null) {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})(?:$|[T ])/);
  if (!match) return null;
  const date = new Date(`${match[1]}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === match[1] ? match[1] : null;
}
const nonPostTypes = new Set(["brief", "briefing", "design_brief", "pauta", "pautas"]);

/** Exactly one operational date and one mutually exclusive state per card. */
export function classifyDashboardPost(card: DashboardPost, publications: DashboardMetaPost[], timeZone: string): ClassifiedDashboardPost | null {
  if (Boolean(card.isBriefApproval) || nonPostTypes.has(card.artType?.toLowerCase() ?? "") || nonPostTypes.has(card.mediaType?.toLowerCase() ?? "")) return null;
  const zone = validTimeZone(card.scheduledTimeZone ?? card.calendarTimeZone, LEGACY_APP_TIME_ZONE);
  // Imported publication timestamps were normalized to UTC by the importer.
  const publishedZone = card.legacyId && !card.scheduledTimeZone && !card.calendarTimeZone ? "UTC" : zone;
  const internalPublished = instant(card.publishedAt, publishedZone);
  const internalScheduled = instant(card.scheduledAt, zone);
  const meta = publications.filter((item) => item.cardId === card.id && item.clientAccountId === card.clientAccountId);
  const dates = (items: DashboardMetaPost[], published = false) => items.flatMap((item) => {
    // Meta scheduled_at is an explicit UTC operational slot. Keep a delayed
    // channel execution attached to that planned post/month.
    const value = instant(item.scheduledAt, "UTC") ?? (published ? instant(item.publishedAt, "UTC") : null);
    return value ? [value] : [];
  }).sort();
  const metaPublished = dates(meta.filter((item) => item.status === "published"), true)[0] ?? null;
  const metaScheduled = dates(meta.filter((item) => item.status === "scheduled" || item.status === "publishing"))[0] ?? null;
  const state: PostState = internalPublished || metaPublished ? "published" : internalScheduled || metaScheduled ? "scheduled" : "pending";
  // Internal automatic archiving retains published_at. Other archived records
  // only remain operational when Meta still has an active schedule/publication.
  if (card.archived && !internalPublished && !metaPublished && !metaScheduled) return null;
  const asDay = (value: string | null) => value ? dateInZone(value, timeZone) : null;
  const timedCalendar = card.calendarDate && card.calendarTime
    ? instant(`${card.calendarDate} ${card.calendarTime}`, validTimeZone(card.calendarTimeZone, zone)) : null;
  const sources: [ClassifiedDashboardPost["source"], string | null][] = [
    ["internal_published", asDay(internalPublished)],
    ["internal_scheduled", asDay(internalScheduled)],
    ["meta_published", asDay(metaPublished)],
    ["meta_scheduled", asDay(metaScheduled)],
    // Deadlines and calendar entries without a time are planned calendar days,
    // not UTC instants: never shift these days across a month boundary.
    ["deadline", plannedDay(card.deadlineAt)],
    ["calendar", timedCalendar ? asDay(timedCalendar) : plannedDay(card.calendarDate)],
    ["meta_previous_plan", asDay(dates(meta.filter((item) => item.status === "failed" || item.status === "cancelled")).at(-1) ?? null)],
  ];
  const chosen = sources.find(([, value]) => value !== null);
  return chosen ? { id: card.id, state, source: chosen[0], operationalDate: chosen[1]! } : null;
}

export function calculateDashboardStatistics(cards: DashboardPost[], publications: DashboardMetaPost[], options: { now: Date; timeZone: string }): MonthlyStatistics {
  const timeZone = validTimeZone(options.timeZone);
  const month = dateInZone(options.now.toISOString(), timeZone)!.slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const previousMonth = new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
  const result: MonthlyStatistics = { timeZone, month, postsThisMonth: 0, postsPreviousMonth: 0, pending: 0, scheduled: 0, published: 0, publishedPreviousMonth: 0 };
  const byCard = new Map<string, DashboardMetaPost[]>();
  for (const publication of publications) {
    const rows = byCard.get(publication.cardId) ?? [];
    rows.push(publication); byCard.set(publication.cardId, rows);
  }
  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    const post = classifyDashboardPost(card, byCard.get(card.id) ?? [], timeZone);
    if (!post) continue;
    const postMonth = post.operationalDate.slice(0, 7);
    if (postMonth === month) { result.postsThisMonth++; result[post.state]++; }
    if (postMonth === previousMonth) { result.postsPreviousMonth++; if (post.state === "published") result.publishedPreviousMonth++; }
  }
  return result;
}

/** Read only operational fields. Separate queries avoid platform join fan-out. */
export async function loadDashboardStatistics(db: Pool, clientIds: string[] | null, options: { now: Date; timeZone: string }) {
  if (clientIds?.length === 0) return calculateDashboardStatistics([], [], options);
  const scopeSql = clientIds ? ` AND c.client_account_id IN (${clientIds.map(() => "?").join(", ")})` : "";
  const [year, month] = dateInZone(options.now.toISOString(), validTimeZone(options.timeZone))!.slice(0, 7).split("-").map(Number);
  // Broad wall-clock bounds only limit data transfer. Exact membership and
  // source precedence are decided afterwards in the user's timezone.
  const from = new Date(Date.UTC(year, month - 2, 1) - 2 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(year, month, 1) + 2 * 86_400_000).toISOString().slice(0, 10);
  const candidateSql = [
    " AND ((c.published_at >= ? AND c.published_at < ?) OR (c.scheduled_at >= ? AND c.scheduled_at < ?)",
    "OR (c.deadline_at >= ? AND c.deadline_at < ?) OR (e.publish_date >= ? AND e.publish_date < ?)",
    "OR EXISTS (SELECT 1 FROM meta_scheduled_publications mp WHERE mp.card_id = c.id AND mp.client_account_id = c.client_account_id AND mp.scheduled_at >= ? AND mp.scheduled_at < ?))",
  ].join(" ");
  const params = [...(clientIds ?? []), ...Array.from({ length: 5 }, () => [from, to]).flat()];
  const [ [cards], [publications] ] = await Promise.all([
    db.query<(RowDataPacket & DashboardPost)[]>([
      "SELECT c.id, c.client_account_id AS clientAccountId, c.is_brief_approval AS isBriefApproval, c.art_type AS artType, c.media_type AS mediaType, c.archived, c.legacy_id AS legacyId,",
      "DATE_FORMAT(c.scheduled_at, '%Y-%m-%d %H:%i:%s') AS scheduledAt, c.scheduled_timezone AS scheduledTimeZone,",
      "DATE_FORMAT(c.published_at, '%Y-%m-%d %H:%i:%s') AS publishedAt, DATE_FORMAT(c.deadline_at, '%Y-%m-%d %H:%i:%s') AS deadlineAt,",
      "DATE_FORMAT(e.publish_date, '%Y-%m-%d') AS calendarDate, TIME_FORMAT(e.publish_time, '%H:%i:%s') AS calendarTime, e.scheduled_timezone AS calendarTimeZone",
      "FROM kanban_cards c LEFT JOIN card_calendar_events e ON e.card_id = c.id AND e.client_account_id = c.client_account_id",
      "WHERE c.is_brief_approval = 0", scopeSql, candidateSql,
    ].join(" "), params),
    db.query<(RowDataPacket & DashboardMetaPost)[]>([
      "SELECT p.card_id AS cardId, p.client_account_id AS clientAccountId, p.status,",
      "DATE_FORMAT(p.scheduled_at, '%Y-%m-%dT%H:%i:%sZ') AS scheduledAt, DATE_FORMAT(p.published_at, '%Y-%m-%dT%H:%i:%sZ') AS publishedAt",
      "FROM meta_scheduled_publications p INNER JOIN kanban_cards c ON c.id = p.card_id AND c.client_account_id = p.client_account_id",
      "LEFT JOIN card_calendar_events e ON e.card_id = c.id AND e.client_account_id = c.client_account_id",
      "WHERE c.is_brief_approval = 0", scopeSql, candidateSql,
    ].join(" "), params),
  ]);
  return calculateDashboardStatistics(cards, publications, options);
}
