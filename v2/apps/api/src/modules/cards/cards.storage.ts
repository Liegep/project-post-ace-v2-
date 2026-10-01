import type { Pool, RowDataPacket } from "mysql2/promise";

async function ensureColumn(
  db: Pool,
  table: "kanban_cards" | "card_calendar_events",
  column: string,
  definition: string,
) {
  const [columns] = await db.query<RowDataPacket[]>(
    `SHOW COLUMNS FROM ${table} LIKE ?`,
    [column],
  );
  if (columns.length === 0) {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Production deployments do not run the local bootstrap script. Keep card
 * storage compatible with the running API before routes/background jobs query it.
 */
export async function ensureCardTimeZoneStorage(db: Pool, fallbackTimeZone: string) {
  await ensureColumn(
    db,
    "kanban_cards",
    "scheduled_timezone",
    "VARCHAR(64) NULL AFTER scheduled_at",
  );
  await ensureColumn(
    db,
    "card_calendar_events",
    "scheduled_timezone",
    "VARCHAR(64) NULL AFTER publish_time",
  );
  await ensureColumn(
    db,
    "kanban_cards",
    "approval_reset_at",
    "DATETIME NULL AFTER is_brief_approval",
  );

  await db.query(
    "UPDATE kanban_cards SET scheduled_timezone = ? WHERE scheduled_at IS NOT NULL AND (scheduled_timezone IS NULL OR TRIM(scheduled_timezone) = '')",
    [fallbackTimeZone],
  );
  await db.query(
    [
      "UPDATE card_calendar_events e",
      "LEFT JOIN kanban_cards c ON c.id = e.card_id",
      "SET e.scheduled_timezone = COALESCE(NULLIF(TRIM(c.scheduled_timezone), ''), ?)",
      "WHERE e.scheduled_timezone IS NULL OR TRIM(e.scheduled_timezone) = ''",
    ].join(" "),
    [fallbackTimeZone],
  );

  // Older archiver versions deleted calendar rows after publication. Restore
  // those persisted posts once, and keep any surviving row's state aligned.
  await db.query(
    [
      "INSERT IGNORE INTO card_calendar_events",
      "(id, client_account_id, card_id, title, caption, media_type, media_urls_json, publish_date, publish_time, scheduled_timezone, status, event_color, created_by_user_id)",
      "SELECT UUID(), c.client_account_id, c.id, c.title, c.caption, COALESCE(c.media_type, 'image'), c.media_urls_json, DATE(c.scheduled_at), TIME(c.scheduled_at), c.scheduled_timezone, 'published', c.event_color, c.created_by_user_id",
      "FROM kanban_cards c LEFT JOIN card_calendar_events e ON e.card_id = c.id",
      "WHERE e.id IS NULL AND c.published_at IS NOT NULL AND c.scheduled_at IS NOT NULL",
    ].join(" "),
  );
  await db.query(
    [
      "UPDATE card_calendar_events e INNER JOIN kanban_cards c ON c.id = e.card_id",
      "SET e.status = 'published'",
      "WHERE c.published_at IS NOT NULL AND e.status <> 'published'",
    ].join(" "),
  );
}
