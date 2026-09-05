import type { Pool, RowDataPacket } from "mysql2/promise";
import { getClientScope } from "../auth/auth.access.js";
import type { AuthContext } from "../auth/auth.types.js";

type JsonRow = RowDataPacket & Record<string, unknown>;

function scopedAccounts(auth: AuthContext) {
  const scope = getClientScope(auth.user.globalRole, auth.user.id, auth.memberships);
  return scope.mode === "global" ? null : scope.clientIds;
}

function scopeSql(auth: AuthContext, accountExpression: string) {
  const ids = scopedAccounts(auth);
  if (ids === null) return { sql: "", params: [] as string[] };
  if (!ids.length) return { sql: " AND 1 = 0", params: [] as string[] };
  return { sql: ` AND ${accountExpression} IN (${ids.map(() => "?").join(",")})`, params: ids };
}

function parseJsonStrings(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function cleanRow(row: JsonRow) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (key === "status" || key === "tags") return [key, parseJsonStrings(value)];
    if (value instanceof Date) return [key, value.toISOString()];
    return [key, value];
  }));
}

export async function mcpListClients(db: Pool, auth: AuthContext) {
  const scope = scopeSql(auth, "a.id");
  const [rows] = await db.query<JsonRow[]>(
    `SELECT a.id, a.name, a.slug, a.locale FROM client_accounts a WHERE 1 = 1${scope.sql} ORDER BY a.name ASC LIMIT 300`,
    scope.params,
  );
  return rows.map(cleanRow);
}

export async function mcpListDueCards(db: Pool, auth: AuthContext, input: { dateFrom: string; dateTo: string; clientId?: string; limit: number }) {
  const scope = scopeSql(auth, "c.client_account_id");
  const params: Array<string | number> = [input.dateFrom, input.dateTo, ...scope.params];
  let clientFilter = "";
  if (input.clientId) {
    clientFilter = " AND c.client_account_id = ?";
    params.push(input.clientId);
  }
  params.push(input.limit);
  const [rows] = await db.query<JsonRow[]>([
    "SELECT c.id, a.name AS clientName, c.title, c.client_label AS clientStatus, c.status_json AS status, c.tags_json AS tags, c.priority_level AS priority,",
    "DATE_FORMAT(c.deadline_at, '%Y-%m-%d %H:%i:%s') AS deadlineAt, DATE_FORMAT(c.scheduled_at, '%Y-%m-%d %H:%i:%s') AS scheduledAt,",
    "DATE_FORMAT(c.published_at, '%Y-%m-%d %H:%i:%s') AS publishedAt, c.comments_count_cache AS commentsCount",
    "FROM kanban_cards c INNER JOIN client_accounts a ON a.id = c.client_account_id",
    "WHERE c.archived = 0 AND c.published_at IS NULL AND DATE(COALESCE(c.deadline_at, c.scheduled_at)) BETWEEN ? AND ?",
    scope.sql, clientFilter,
    "ORDER BY COALESCE(c.deadline_at, c.scheduled_at) ASC, a.name ASC LIMIT ?",
  ].join(" "), params);
  return rows.map(cleanRow);
}

export async function mcpListPendingApprovals(db: Pool, auth: AuthContext, input: { clientId?: string; limit: number }) {
  const scope = scopeSql(auth, "c.client_account_id");
  const params: Array<string | number> = [...scope.params];
  let clientFilter = "";
  if (input.clientId) {
    clientFilter = " AND c.client_account_id = ?";
    params.push(input.clientId);
  }
  params.push(input.limit);
  const [rows] = await db.query<JsonRow[]>([
    "SELECT c.id, a.name AS clientName, c.title, c.client_label AS clientStatus, c.status_json AS status, c.priority_level AS priority,",
    "DATE_FORMAT(c.deadline_at, '%Y-%m-%d %H:%i:%s') AS deadlineAt, DATE_FORMAT(c.scheduled_at, '%Y-%m-%d %H:%i:%s') AS scheduledAt,",
    "MAX(al.viewed_at) AS lastViewedAt, MAX(al.created_at) AS approvalRequestedAt",
    "FROM kanban_cards c INNER JOIN client_accounts a ON a.id = c.client_account_id",
    "LEFT JOIN approval_links al ON al.card_id = c.id AND al.approved_at IS NULL",
    "WHERE c.archived = 0 AND c.is_brief_approval = 1 AND NOT EXISTS (SELECT 1 FROM approval_links approved WHERE approved.card_id = c.id AND approved.approved_at IS NOT NULL)",
    scope.sql, clientFilter,
    "GROUP BY c.id, a.name, c.title, c.client_label, c.status_json, c.priority_level, c.deadline_at, c.scheduled_at",
    "ORDER BY COALESCE(c.deadline_at, c.scheduled_at, c.created_at) ASC LIMIT ?",
  ].join(" "), params);
  return rows.map(cleanRow);
}

export async function mcpListRecentClientComments(db: Pool, auth: AuthContext, input: { sinceDays: number; clientId?: string; limit: number }) {
  const scope = scopeSql(auth, "c.client_account_id");
  const params: Array<string | number> = [input.sinceDays, ...scope.params];
  let clientFilter = "";
  if (input.clientId) {
    clientFilter = " AND c.client_account_id = ?";
    params.push(input.clientId);
  }
  params.push(input.limit);
  const [rows] = await db.query<JsonRow[]>([
    "SELECT cc.id, c.id AS cardId, a.name AS clientName, c.title AS cardTitle, cc.author_name AS authorName,",
    "LEFT(cc.comment_text, 1200) AS comment, DATE_FORMAT(cc.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt",
    "FROM card_comments cc INNER JOIN kanban_cards c ON c.id = cc.card_id INNER JOIN client_accounts a ON a.id = c.client_account_id",
    "WHERE cc.author_role = 'cliente' AND cc.is_internal = 0 AND cc.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)",
    scope.sql, clientFilter,
    "ORDER BY cc.created_at DESC LIMIT ?",
  ].join(" "), params);
  return rows.map(cleanRow);
}

export async function mcpWeeklyWorkload(db: Pool, auth: AuthContext, input: { dateFrom: string; dateTo: string }) {
  const cards = await mcpListDueCards(db, auth, { ...input, limit: 300 });
  const scope = scopeSql(auth, "e.client_account_id");
  const [agendaRows] = await db.query<JsonRow[]>([
    "SELECT e.id, COALESCE(a.name, 'Interno') AS clientName, e.title, e.task_description AS taskDescription,",
    "DATE_FORMAT(e.starts_at, '%Y-%m-%d %H:%i:%s') AS startsAt, DATE_FORMAT(e.ends_at, '%Y-%m-%d %H:%i:%s') AS endsAt, e.is_completed AS completed",
    "FROM agenda_events e LEFT JOIN client_accounts a ON a.id = e.client_account_id",
    "WHERE e.is_completed = 0 AND DATE(e.starts_at) BETWEEN ? AND ?", scope.sql,
    "ORDER BY e.starts_at ASC LIMIT 300",
  ].join(" "), [input.dateFrom, input.dateTo, ...scope.params]);
  const agenda: Array<Record<string, unknown> & { completed: boolean }> = agendaRows.map((row) => ({ ...cleanRow(row), completed: Boolean(row.completed) }));
  const byDay: Record<string, { cards: number; agenda: number; highPriority: number; pendingApprovals: number }> = {};
  const day = (value: unknown) => String(value ?? "").slice(0, 10);
  for (const card of cards) {
    const date = day(card.deadlineAt ?? card.scheduledAt);
    if (!date) continue;
    byDay[date] ??= { cards: 0, agenda: 0, highPriority: 0, pendingApprovals: 0 };
    byDay[date].cards += 1;
    if (card.priority === "high") byDay[date].highPriority += 1;
  }
  for (const event of agenda) {
    const date = day(event.startsAt);
    if (!date) continue;
    byDay[date] ??= { cards: 0, agenda: 0, highPriority: 0, pendingApprovals: 0 };
    byDay[date].agenda += 1;
  }
  const pending = await mcpListPendingApprovals(db, auth, { limit: 300 });
  for (const card of pending) {
    const date = day(card.deadlineAt ?? card.scheduledAt);
    if (!date || date < input.dateFrom || date > input.dateTo) continue;
    byDay[date] ??= { cards: 0, agenda: 0, highPriority: 0, pendingApprovals: 0 };
    byDay[date].pendingApprovals += 1;
  }
  return { period: input, summaryByDay: byDay, cards, agenda };
}

export async function mcpCardSummary(db: Pool, auth: AuthContext, cardId: string) {
  const scope = scopeSql(auth, "c.client_account_id");
  const [cards] = await db.query<JsonRow[]>([
    "SELECT c.id, a.name AS clientName, c.title, c.client_label AS clientStatus, c.status_json AS status, c.tags_json AS tags, c.priority_level AS priority,",
    "DATE_FORMAT(c.deadline_at, '%Y-%m-%d %H:%i:%s') AS deadlineAt, DATE_FORMAT(c.scheduled_at, '%Y-%m-%d %H:%i:%s') AS scheduledAt, DATE_FORMAT(c.published_at, '%Y-%m-%d %H:%i:%s') AS publishedAt",
    "FROM kanban_cards c INNER JOIN client_accounts a ON a.id = c.client_account_id WHERE c.id = ?", scope.sql, "LIMIT 1",
  ].join(" "), [cardId, ...scope.params]);
  if (!cards[0]) return null;
  const [comments] = await db.query<JsonRow[]>([
    "SELECT cc.author_name AS authorName, cc.author_role AS authorRole, LEFT(cc.comment_text, 1200) AS comment, DATE_FORMAT(cc.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt",
    "FROM card_comments cc WHERE cc.card_id = ? AND cc.is_internal = 0 ORDER BY cc.created_at DESC LIMIT 30",
  ].join(" "), [cardId]);
  return { ...cleanRow(cards[0]), comments: comments.map(cleanRow) };
}
