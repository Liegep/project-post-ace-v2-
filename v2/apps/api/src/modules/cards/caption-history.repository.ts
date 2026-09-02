import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";

type CaptionVersionRow = RowDataPacket & {
  id: string;
  card_id: string;
  caption: string | null;
  author_user_id: string | null;
  author_name: string;
  author_role: string;
  created_at: Date | string;
};

let schemaPromise: Promise<void> | null = null;

export async function ensureCaptionHistoryTable(db: Pool) {
  if (!schemaPromise) {
    schemaPromise = db.query([
      "CREATE TABLE IF NOT EXISTS card_caption_versions (",
      "id CHAR(36) NOT NULL PRIMARY KEY,",
      "card_id CHAR(36) NOT NULL,",
      "caption TEXT NULL,",
      "author_user_id CHAR(36) NULL,",
      "author_name VARCHAR(255) NOT NULL DEFAULT 'Sistema',",
      "author_role VARCHAR(50) NOT NULL DEFAULT 'system',",
      "created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),",
      "KEY idx_caption_versions_card_created (card_id, created_at),",
      "CONSTRAINT fk_caption_versions_card FOREIGN KEY (card_id) REFERENCES kanban_cards (id) ON DELETE CASCADE ON UPDATE CASCADE,",
      "CONSTRAINT fk_caption_versions_author FOREIGN KEY (author_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE",
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ].join(" ")).then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

function mapCaptionVersion(row: CaptionVersionRow) {
  return {
    id: row.id,
    cardId: row.card_id,
    caption: row.caption,
    authorUserId: row.author_user_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    createdAt: row.created_at,
  };
}

export async function listCaptionVersions(db: Pool, cardId: string, limit = 50) {
  await ensureCaptionHistoryTable(db);
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const [rows] = await db.query<CaptionVersionRow[]>(
    `SELECT id, card_id, caption, author_user_id, author_name, author_role, created_at FROM card_caption_versions WHERE card_id = ? ORDER BY created_at DESC, id DESC LIMIT ${safeLimit}`,
    [cardId],
  );
  return rows.map(mapCaptionVersion);
}

export async function findCaptionVersion(db: Pool, cardId: string, versionId: string) {
  await ensureCaptionHistoryTable(db);
  const [rows] = await db.query<CaptionVersionRow[]>(
    "SELECT id, card_id, caption, author_user_id, author_name, author_role, created_at FROM card_caption_versions WHERE id = ? AND card_id = ? LIMIT 1",
    [versionId, cardId],
  );
  return rows[0] ? mapCaptionVersion(rows[0]) : null;
}

export async function recordCaptionVersion(
  db: Pool,
  input: { cardId: string; caption: string | null; authorUserId?: string | null; authorName: string; authorRole: string },
) {
  await ensureCaptionHistoryTable(db);
  const [latest] = await db.query<CaptionVersionRow[]>(
    "SELECT id, card_id, caption, author_user_id, author_name, author_role, created_at FROM card_caption_versions WHERE card_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
    [input.cardId],
  );
  if ((latest[0]?.caption ?? null) === (input.caption ?? null)) return latest[0] ? mapCaptionVersion(latest[0]) : null;
  const id = crypto.randomUUID();
  await db.query(
    "INSERT INTO card_caption_versions (id, card_id, caption, author_user_id, author_name, author_role) VALUES (?, ?, ?, ?, ?, ?)",
    [id, input.cardId, input.caption, input.authorUserId ?? null, input.authorName, input.authorRole],
  );
  return findCaptionVersion(db, input.cardId, id);
}
