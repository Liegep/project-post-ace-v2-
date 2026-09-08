import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";

type DashboardNoteRow = RowDataPacket & {
  id: string;
  text: string;
  color: string;
  reminder_date: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const selection = `SELECT id, note_text AS text, color,
  CASE WHEN reminder_date IS NULL THEN NULL ELSE DATE_FORMAT(reminder_date, '%Y-%m-%d') END AS reminder_date,
  created_at, updated_at FROM dashboard_notes`;

function mapNote(row: DashboardNoteRow) {
  return {
    id: row.id,
    text: row.text,
    color: row.color,
    reminderDate: row.reminder_date,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function ensureDashboardNotesTable(db: Pool) {
  await db.query(`CREATE TABLE IF NOT EXISTS dashboard_notes (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    note_text VARCHAR(500) NOT NULL,
    color ENUM('yellow','pink','blue','green','lavender') NOT NULL DEFAULT 'yellow',
    reminder_date DATE NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_dashboard_notes_user_updated (user_id, updated_at),
    CONSTRAINT fk_dashboard_notes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

export async function listDashboardNotes(db: Pool, userId: string) {
  const [rows] = await db.query<DashboardNoteRow[]>(`${selection} WHERE user_id = ? ORDER BY reminder_date IS NULL, reminder_date ASC, updated_at DESC`, [userId]);
  return rows.map(mapNote);
}

export async function createDashboardNote(db: Pool, input: { userId: string; text: string; color: string; reminderDate?: string | null }) {
  const id = crypto.randomUUID();
  await db.query("INSERT INTO dashboard_notes (id, user_id, note_text, color, reminder_date) VALUES (?, ?, ?, ?, ?)", [id, input.userId, input.text, input.color, input.reminderDate ?? null]);
  const [rows] = await db.query<DashboardNoteRow[]>(`${selection} WHERE id = ? AND user_id = ?`, [id, input.userId]);
  return mapNote(rows[0]);
}

export async function updateDashboardNote(db: Pool, noteId: string, userId: string, input: { text?: string; color?: string; reminderDate?: string | null }) {
  const updates: string[] = [];
  const values: unknown[] = [];
  if (input.text !== undefined) { updates.push("note_text = ?"); values.push(input.text); }
  if (input.color !== undefined) { updates.push("color = ?"); values.push(input.color); }
  if (input.reminderDate !== undefined) { updates.push("reminder_date = ?"); values.push(input.reminderDate); }
  if (updates.length) await db.query(`UPDATE dashboard_notes SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`, [...values, noteId, userId]);
  const [rows] = await db.query<DashboardNoteRow[]>(`${selection} WHERE id = ? AND user_id = ?`, [noteId, userId]);
  return rows[0] ? mapNote(rows[0]) : null;
}

export async function deleteDashboardNote(db: Pool, noteId: string, userId: string) {
  const [result] = await db.query("DELETE FROM dashboard_notes WHERE id = ? AND user_id = ?", [noteId, userId]);
  return Number((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
}
