import type { Pool, RowDataPacket } from "mysql2/promise";

type CalendarEventRow = RowDataPacket & {
  id: string;
  client_account_id: string;
  client_name: string;
  client_slug: string;
  card_id: string | null;
  title: string;
  caption: string | null;
  media_type: string;
  media_urls_json: string | null;
  publish_date: string;
  publish_time: string | null;
  status: "draft" | "in_review" | "approved" | "scheduled" | "published";
  event_color: string | null;
  column_name: string | null;
  created_by_user_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function parseJsonArray(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapCalendarEventRow(row: CalendarEventRow) {
  return {
    id: row.id,
    clientAccountId: row.client_account_id,
    clientName: row.client_name,
    clientSlug: row.client_slug,
    cardId: row.card_id,
    title: row.title,
    caption: row.caption,
    mediaType: row.media_type,
    mediaUrls: parseJsonArray(row.media_urls_json),
    publishDate: row.publish_date,
    publishTime: row.publish_time,
    status: row.status,
    eventColor: row.event_color,
    columnName: row.column_name,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type CalendarListOptions = {
  from?: string;
  to?: string;
  status?: "draft" | "in_review" | "approved" | "scheduled" | "published";
  clientAccountIds?: string[];
};

export async function listCalendarEvents(
  db: Pool,
  options: CalendarListOptions,
) {
  let sql = [
    "SELECT",
    "e.id,",
    "e.client_account_id,",
    "ca.name AS client_name,",
    "ca.slug AS client_slug,",
    "e.card_id,",
    "e.title,",
    "e.caption,",
    "e.media_type,",
    "e.media_urls_json,",
    "e.publish_date,",
    "e.publish_time,",
    "e.status,",
    "COALESCE(col.color, e.event_color) AS event_color,",
    "col.name AS column_name,",
    "e.created_by_user_id,",
    "e.created_at,",
    "e.updated_at",
    "FROM card_calendar_events e",
    "INNER JOIN client_accounts ca ON ca.id = e.client_account_id",
    "LEFT JOIN kanban_cards kc ON kc.id = e.card_id",
    "LEFT JOIN kanban_columns col ON col.id = kc.column_id",
    "WHERE 1 = 1",
  ].join(" ");

  const params: Array<string> = [];

  if (options.clientAccountIds) {
    if (options.clientAccountIds.length === 0) {
      return [];
    }
    sql += ` AND e.client_account_id IN (${options.clientAccountIds.map(() => "?").join(", ")})`;
    params.push(...options.clientAccountIds);
  }

  if (options.from) {
    sql += " AND e.publish_date >= ?";
    params.push(options.from);
  }

  if (options.to) {
    sql += " AND e.publish_date <= ?";
    params.push(options.to);
  }

  if (options.status) {
    sql += " AND e.status = ?";
    params.push(options.status);
  }

  sql += " ORDER BY e.publish_date ASC, e.publish_time ASC, ca.name ASC";

  const [rows] = await db.query<CalendarEventRow[]>(sql, params);
  return rows.map(mapCalendarEventRow);
}
