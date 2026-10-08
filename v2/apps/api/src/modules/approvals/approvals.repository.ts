import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";

type ApprovalLinkRow = RowDataPacket & {
  id: string;
  client_account_id: string;
  card_id: string;
  token: string;
  expires_at: Date | string;
  is_active: number;
  viewed_at: Date | string | null;
  approved_at: Date | string | null;
  created_by_user_id: string | null;
  created_at: Date | string;
};

function mapApprovalLinkRow(row: ApprovalLinkRow) {
  return {
    id: row.id,
    clientAccountId: row.client_account_id,
    cardId: row.card_id,
    token: row.token,
    expiresAt: row.expires_at,
    isActive: Boolean(row.is_active),
    viewedAt: row.viewed_at,
    approvedAt: row.approved_at,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

export async function createApprovalLink(
  db: Pick<Pool, "query">,
  input: {
    clientAccountId: string;
    cardId: string;
    expiresAt: Date;
    createdByUserId: string;
  },
) {
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString("hex");

  await db.query(
    [
      "INSERT INTO approval_links",
      "(id, client_account_id, card_id, token, expires_at, is_active, created_by_user_id)",
      "VALUES (?, ?, ?, ?, ?, 1, ?)",
    ].join(" "),
    [id, input.clientAccountId, input.cardId, token, input.expiresAt, input.createdByUserId],
  );

  return findApprovalLinkByToken(db, token);
}

export async function findApprovalLinkByToken(db: Pick<Pool, "query">, token: string) {
  const [rows] = await db.query<ApprovalLinkRow[]>(
    [
      "SELECT id, client_account_id, card_id, token, expires_at, is_active, viewed_at, approved_at, created_by_user_id, created_at",
      "FROM approval_links",
      "WHERE token = ?",
      "LIMIT 1",
    ].join(" "),
    [token],
  );

  const row = rows[0];
  return row ? mapApprovalLinkRow(row) : null;
}

export async function listApprovalLinksByCardId(db: Pick<Pool, "query">, cardId: string) {
  const [rows] = await db.query<ApprovalLinkRow[]>(
    [
      "SELECT al.id, al.client_account_id, al.card_id, al.token, al.expires_at, al.is_active, al.viewed_at, al.approved_at, al.created_by_user_id, al.created_at",
      "FROM approval_links al",
      "INNER JOIN kanban_cards c ON c.id = al.card_id",
      "WHERE al.card_id = ?",
      "AND (c.approval_reset_at IS NULL OR al.created_at >= c.approval_reset_at)",
      "ORDER BY al.created_at DESC",
    ].join(" "),
    [cardId],
  );

  return rows.map(mapApprovalLinkRow);
}

export async function markApprovalLinkViewed(db: Pick<Pool, "query">, token: string) {
  await db.query(
    [
      "UPDATE approval_links",
      "SET viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)",
      "WHERE token = ?",
    ].join(" "),
    [token],
  );

  return findApprovalLinkByToken(db, token);
}

export async function submitApprovalDecision(
  db: Pick<Pool, "query">,
  token: string,
  input: { approved: boolean },
) {
  await db.query(
    [
      "UPDATE approval_links",
      "SET is_active = 0, approved_at = ?, viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)",
      "WHERE token = ?",
    ].join(" "),
    [input.approved ? new Date() : null, token],
  );

  return findApprovalLinkByToken(db, token);
}