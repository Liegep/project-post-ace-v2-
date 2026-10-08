import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";

type TimeEntryRow = RowDataPacket & {
  id: string;
  user_id: string;
  user_name: string;
  client_account_id: string;
  client_name: string;
  card_id: string | null;
  card_title: string | null;
  description: string;
  started_at: Date | string;
  ended_at: Date | string | null;
  started_at_ms: string | number;
  last_started_at_ms: string | number;
  ended_at_ms: string | number | null;
  duration_seconds: number | null;
  created_at: Date | string;
  created_at_ms: string | number;
};

const selection = `
  SELECT t.id, t.user_id, u.full_name AS user_name,
    t.client_account_id, a.name AS client_name,
    t.card_id, c.title AS card_title, t.description,
    t.started_at, t.ended_at,
    ROUND(UNIX_TIMESTAMP(t.started_at) * 1000) AS started_at_ms,
    ROUND(UNIX_TIMESTAMP(t.last_started_at) * 1000) AS last_started_at_ms,
    CASE WHEN t.ended_at IS NULL THEN NULL ELSE ROUND(UNIX_TIMESTAMP(t.ended_at) * 1000) END AS ended_at_ms,
    t.duration_seconds, t.created_at,
    ROUND(UNIX_TIMESTAMP(t.created_at) * 1000) AS created_at_ms
  FROM time_entries t
  INNER JOIN users u ON u.id = t.user_id
  INNER JOIN client_accounts a ON a.id = t.client_account_id
  LEFT JOIN kanban_cards c ON c.id = t.card_id`;

function mapEntry(row: TimeEntryRow) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    clientAccountId: row.client_account_id,
    clientName: row.client_name,
    cardId: row.card_id,
    cardTitle: row.card_title,
    description: row.description,
    startedAt: new Date(Number(row.started_at_ms)).toISOString(),
    lastStartedAt: new Date(Number(row.last_started_at_ms)).toISOString(),
    endedAt: row.ended_at_ms === null ? null : new Date(Number(row.ended_at_ms)).toISOString(),
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    createdAt: new Date(Number(row.created_at_ms)).toISOString(),
  };
}

export async function ensureTimeTrackingTable(db: Pool) {
  await db.query(`CREATE TABLE IF NOT EXISTS time_entries (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    client_account_id CHAR(36) NOT NULL,
    card_id CHAR(36) NULL,
    description VARCHAR(255) NOT NULL,
    started_at DATETIME(3) NOT NULL,
    last_started_at DATETIME(3) NOT NULL,
    ended_at DATETIME(3) NULL,
    duration_seconds INT UNSIGNED NULL,
    cleared_at DATETIME(3) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_time_entries_user_active (user_id, ended_at),
    KEY idx_time_entries_client_started (client_account_id, started_at),
    KEY idx_time_entries_card_started (card_id, started_at),
    CONSTRAINT fk_time_entries_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_time_entries_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_time_entries_card FOREIGN KEY (card_id) REFERENCES kanban_cards (id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  const [columns] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM time_entries LIKE 'last_started_at'");
  if (columns.length === 0) {
    await db.query("ALTER TABLE time_entries ADD COLUMN last_started_at DATETIME(3) NULL AFTER started_at");
    await db.query("UPDATE time_entries SET last_started_at = started_at WHERE last_started_at IS NULL");
    await db.query("ALTER TABLE time_entries MODIFY last_started_at DATETIME(3) NOT NULL");
  }
  const [clearedColumns] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM time_entries LIKE 'cleared_at'");
  if (clearedColumns.length === 0) await db.query("ALTER TABLE time_entries ADD COLUMN cleared_at DATETIME(3) NULL AFTER duration_seconds");
}

export async function findActiveTimeEntry(db: Pool, userId: string) {
  const [rows] = await db.query<TimeEntryRow[]>(`${selection} WHERE t.user_id = ? AND t.ended_at IS NULL ORDER BY t.started_at DESC LIMIT 1`, [userId]);
  return rows[0] ? mapEntry(rows[0]) : null;
}

export async function createTimeEntry(db: Pool, input: { userId: string; clientAccountId: string; cardId: string | null; description: string }) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("SELECT id FROM users WHERE id = ? FOR UPDATE", [input.userId]);
    const [active] = await connection.query<RowDataPacket[]>("SELECT id FROM time_entries WHERE user_id = ? AND ended_at IS NULL LIMIT 1", [input.userId]);
    if (active.length) {
      const error = new Error("Já existe um cronômetro em andamento.") as Error & { code?: string };
      error.code = "ACTIVE_TIMER_EXISTS";
      throw error;
    }
    const id = crypto.randomUUID();
    await connection.query("INSERT INTO time_entries (id, user_id, client_account_id, card_id, description, started_at, last_started_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))", [id, input.userId, input.clientAccountId, input.cardId, input.description]);
    await connection.commit();
    const [rows] = await db.query<TimeEntryRow[]>(`${selection} WHERE t.id = ? LIMIT 1`, [id]);
    return mapEntry(rows[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function stopTimeEntry(db: Pool, id: string, userId: string) {
  await db.query(`UPDATE time_entries
    SET ended_at = CURRENT_TIMESTAMP(3), duration_seconds = COALESCE(duration_seconds, 0) + GREATEST(0, TIMESTAMPDIFF(SECOND, last_started_at, CURRENT_TIMESTAMP(3)))
    WHERE id = ? AND user_id = ? AND ended_at IS NULL`, [id, userId]);
  const [rows] = await db.query<TimeEntryRow[]>(`${selection} WHERE t.id = ? AND t.user_id = ? LIMIT 1`, [id, userId]);
  return rows[0] ? mapEntry(rows[0]) : null;
}

export async function resumeTimeEntry(db: Pool, id: string, userId: string) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("SELECT id FROM users WHERE id = ? FOR UPDATE", [userId]);
    const [active] = await connection.query<RowDataPacket[]>("SELECT id FROM time_entries WHERE user_id = ? AND ended_at IS NULL LIMIT 1", [userId]);
    if (active.length) {
      const error = new Error("Já existe um cronômetro em andamento.") as Error & { code?: string };
      error.code = "ACTIVE_TIMER_EXISTS";
      throw error;
    }
    const [result] = await connection.query<import("mysql2/promise").ResultSetHeader>("UPDATE time_entries SET last_started_at = CURRENT_TIMESTAMP(3), ended_at = NULL WHERE id = ? AND user_id = ? AND ended_at IS NOT NULL", [id, userId]);
    if (result.affectedRows === 0) { await connection.rollback(); return null; }
    await connection.commit();
    const [rows] = await db.query<TimeEntryRow[]>(`${selection} WHERE t.id = ? LIMIT 1`, [id]);
    return rows[0] ? mapEntry(rows[0]) : null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function clearCompletedTimeEntries(db: Pool, input: { from: Date; to: Date; clientIds: string[] | null; clientAccountId?: string; userId?: string }) {
  if (input.clientIds && input.clientIds.length === 0) return 0;
  const where = ["cleared_at IS NULL", "ended_at IS NOT NULL", "started_at >= FROM_UNIXTIME(?)", "started_at < FROM_UNIXTIME(?)"];
  const values: unknown[] = [input.from.getTime() / 1000, input.to.getTime() / 1000];
  if (input.clientIds) { where.push(`client_account_id IN (${input.clientIds.map(() => "?").join(",")})`); values.push(...input.clientIds); }
  if (input.clientAccountId) { where.push("client_account_id = ?"); values.push(input.clientAccountId); }
  if (input.userId) { where.push("user_id = ?"); values.push(input.userId); }
  const [result] = await db.query<import("mysql2/promise").ResultSetHeader>(`UPDATE time_entries SET cleared_at = CURRENT_TIMESTAMP(3) WHERE ${where.join(" AND ")}`, values);
  return result.affectedRows;
}

export async function listTimeEntries(db: Pool, input: { from: Date; to: Date; clientIds: string[] | null; clientAccountId?: string; userId?: string }) {
  if (input.clientIds && input.clientIds.length === 0) return [];
  const where = ["t.cleared_at IS NULL", "t.started_at < FROM_UNIXTIME(?)", "COALESCE(t.ended_at, CURRENT_TIMESTAMP(3)) >= FROM_UNIXTIME(?)"];
  const values: unknown[] = [input.to.getTime() / 1000, input.from.getTime() / 1000];
  if (input.clientIds) {
    where.push(`t.client_account_id IN (${input.clientIds.map(() => "?").join(",")})`);
    values.push(...input.clientIds);
  }
  if (input.clientAccountId) {
    where.push("t.client_account_id = ?");
    values.push(input.clientAccountId);
  }
  if (input.userId) {
    where.push("t.user_id = ?");
    values.push(input.userId);
  }
  const [rows] = await db.query<TimeEntryRow[]>(`${selection} WHERE ${where.join(" AND ")} ORDER BY t.started_at DESC`, values);
  return rows.map(mapEntry);
}
