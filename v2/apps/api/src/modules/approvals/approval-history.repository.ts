import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { ApprovalState } from "./approval-state.js";

export type ApprovalDb = Pick<Pool, "query">;
export const approvalHistoryTableSql = `CREATE TABLE IF NOT EXISTS card_approval_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  card_id CHAR(36) NOT NULL,
  revision INT UNSIGNED NOT NULL,
  action VARCHAR(32) NOT NULL,
  decision VARCHAR(32) NULL,
  source VARCHAR(32) NOT NULL,
  actor_user_id CHAR(36) NULL,
  actor_name VARCHAR(255) NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  comment_id CHAR(36) NULL,
  comment_text TEXT NULL,
  approval_link_id CHAR(36) NULL,
  before_json JSON NOT NULL,
  after_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_card_approval_revision (card_id, revision),
  KEY idx_card_approval_created (card_id, created_at),
  CONSTRAINT fk_card_approval_event_card FOREIGN KEY (card_id) REFERENCES kanban_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

export async function ensureApprovalStorage(db: ApprovalDb) {
  // Additive and idempotent, matching the existing startup schema preparation.
  for (const [column, definition] of [
    ["approval_revision", "INT UNSIGNED NOT NULL DEFAULT 0"],
    ["approval_state", "VARCHAR(32) NULL"],
  ]) {
    const [rows] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM kanban_cards LIKE ?", [column]);
    if (!rows.length) {
      try { await db.query(`ALTER TABLE kanban_cards ADD COLUMN ${column} ${definition}`); }
      catch (error) { if ((error as { code?: string }).code !== "ER_DUP_FIELDNAME") throw error; }
    }
  }
  await db.query(approvalHistoryTableSql);
}

export async function recordApprovalEvent(db: ApprovalDb, input: {
  cardId: string; revision: number; action: "approved" | "changes_requested" | "resubmitted" | "converted_to_post" | "legacy_snapshot";
  decision: ApprovalState | null; source: "portal" | "public_link" | "admin" | "legacy";
  actor: { userId: string | null; name: string; role: string };
  commentId?: string | null; commentText?: string; approvalLinkId?: string;
  before: unknown; after: unknown;
}) {
  await db.query(`INSERT INTO card_approval_events
    (id, card_id, revision, action, decision, source, actor_user_id, actor_name, actor_role,
     comment_id, comment_text, approval_link_id, before_json, after_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    crypto.randomUUID(), input.cardId, input.revision, input.action, input.decision, input.source,
    input.actor.userId, input.actor.name, input.actor.role, input.commentId ?? null,
    input.commentText ?? null, input.approvalLinkId ?? null, JSON.stringify(input.before), JSON.stringify(input.after),
  ]);
}

export async function listApprovalEvents(db: ApprovalDb, cardId: string) {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT id, revision, action, decision, source,
    actor_user_id AS actorUserId, actor_name AS actorName, actor_role AS actorRole,
    comment_text AS commentText, approval_link_id AS approvalLinkId, created_at AS createdAt,
    before_json AS beforeSnapshot, after_json AS afterSnapshot
    FROM card_approval_events WHERE card_id = ? ORDER BY revision DESC`, [cardId]);
  return rows;
}
