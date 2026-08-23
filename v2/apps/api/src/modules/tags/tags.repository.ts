import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { CreateClientTagInput } from "./tags.schemas.js";

type TagRow = RowDataPacket & { id: string; client_account_id: string; name: string; color: string; legacy_id: string | null; created_at: Date | string; updated_at: Date | string };

function mapTag(row: TagRow) {
  return { id: row.id, clientAccountId: row.client_account_id, name: row.name, color: row.color, legacyId: row.legacy_id, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listClientTags(db: Pool, clientAccountId: string) {
  const [rows] = await db.query<TagRow[]>("SELECT id, client_account_id, name, color, legacy_id, created_at, updated_at FROM client_tags WHERE client_account_id = ? ORDER BY name ASC", [clientAccountId]);
  return rows.map(mapTag);
}

export async function createClientTag(db: Pool, clientAccountId: string, input: CreateClientTagInput) {
  const id = crypto.randomUUID();
  await db.query("INSERT INTO client_tags (id, client_account_id, name, color) VALUES (?, ?, ?, ?)", [id, clientAccountId, input.name.trim(), input.color]);
  const [rows] = await db.query<TagRow[]>("SELECT id, client_account_id, name, color, legacy_id, created_at, updated_at FROM client_tags WHERE id = ?", [id]);
  return rows[0] ? mapTag(rows[0]) : null;
}
