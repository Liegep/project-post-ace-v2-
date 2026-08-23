import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";

type CommentRow = RowDataPacket & {
  id: string;
  card_id: string;
  user_id: string | null;
  author_name: string;
  author_role: "super_admin" | "admin" | "colaborador" | "cliente" | "guest";
  author_avatar_url: string | null;
  comment_text: string;
  is_internal: number;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapCommentRow(row: CommentRow) {
  return {
    id: row.id,
    cardId: row.card_id,
    userId: row.user_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    authorAvatarUrl: row.author_avatar_url,
    commentText: row.comment_text,
    isInternal: Boolean(row.is_internal),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCommentsByCardId(
  db: Pool,
  cardId: string,
  options: { includeInternal: boolean },
) {
  let sql = [
    "SELECT cc.id, cc.card_id, cc.user_id, cc.author_name, cc.author_role, cc.comment_text, cc.is_internal, cc.created_at, cc.updated_at, u.avatar_url AS author_avatar_url",
    "FROM card_comments cc",
    "LEFT JOIN users u ON u.id = cc.user_id",
    "WHERE cc.card_id = ?",
  ].join(" ");
  const params: Array<string | number> = [cardId];

  if (!options.includeInternal) {
    sql += " AND cc.is_internal = 0";
  }

  sql += " ORDER BY cc.created_at ASC";

  const [rows] = await db.query<CommentRow[]>(sql, params);
  return rows.map(mapCommentRow);
}

export async function createComment(
  db: Pool,
  input: {
    cardId: string;
    userId: string | null;
    authorName: string;
    authorRole: "super_admin" | "admin" | "colaborador" | "cliente" | "guest";
    commentText: string;
    isInternal: boolean;
  },
) {
  const id = crypto.randomUUID();

  await db.query(
    [
      "INSERT INTO card_comments",
      "(id, card_id, user_id, author_name, author_role, comment_text, is_internal)",
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
    ].join(" "),
    [
      id,
      input.cardId,
      input.userId,
      input.authorName,
      input.authorRole,
      input.commentText,
      input.isInternal ? 1 : 0,
    ],
  );

  await db.query(
    [
      "UPDATE kanban_cards",
      "SET comments_count_cache = (SELECT COUNT(*) FROM card_comments WHERE card_id = ?)",
      "WHERE id = ?",
    ].join(" "),
    [input.cardId, input.cardId],
  );

  const comments = await listCommentsByCardId(db, input.cardId, { includeInternal: true });
  return comments[comments.length - 1] ?? null;
}
