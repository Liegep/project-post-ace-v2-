import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { CreateHashtagGroupInput } from "./hashtags.schemas.js";

type GroupRow = RowDataPacket & { id: string; client_account_id: string; name: string; hashtags_json: unknown; legacy_id: string | null; created_at: Date | string; updated_at: Date | string };

function parseHashtags(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  try { const parsed = JSON.parse(String(value)); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; }
}
function mapGroup(row: GroupRow) { return { id: row.id, clientAccountId: row.client_account_id, name: row.name, hashtags: parseHashtags(row.hashtags_json), legacyId: row.legacy_id, createdAt: row.created_at, updatedAt: row.updated_at }; }

export async function listHashtagGroups(db: Pool, clientAccountId: string) {
  const [rows] = await db.query<GroupRow[]>("SELECT id, client_account_id, name, hashtags_json, legacy_id, created_at, updated_at FROM hashtag_groups WHERE client_account_id = ? ORDER BY name ASC", [clientAccountId]);
  return rows.map(mapGroup);
}
export async function createHashtagGroup(db: Pool, clientAccountId: string, input: CreateHashtagGroupInput) {
  const id = crypto.randomUUID();
  await db.query("INSERT INTO hashtag_groups (id, client_account_id, name, hashtags_json) VALUES (?, ?, ?, ?)", [id, clientAccountId, input.name.trim(), JSON.stringify(input.hashtags)]);
  const [rows] = await db.query<GroupRow[]>("SELECT id, client_account_id, name, hashtags_json, legacy_id, created_at, updated_at FROM hashtag_groups WHERE id = ?", [id]);
  return rows[0] ? mapGroup(rows[0]) : null;
}
export async function deleteHashtagGroup(db: Pool, clientAccountId: string, id: string) { await db.query("DELETE FROM hashtag_groups WHERE id = ? AND client_account_id = ?", [id, clientAccountId]); }
