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

export async function updateClientTag(db: Pool, clientAccountId: string, tagId: string, input: CreateClientTagInput) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [tagRows] = await connection.query<TagRow[]>("SELECT id, client_account_id, name, color, legacy_id, created_at, updated_at FROM client_tags WHERE id = ? AND client_account_id = ? LIMIT 1 FOR UPDATE", [tagId, clientAccountId]);
    const current = tagRows[0];
    if (!current) {
      await connection.rollback();
      return null;
    }
    const name = input.name.trim();
    const [duplicateRows] = await connection.query<TagRow[]>("SELECT id, client_account_id, name, color, legacy_id, created_at, updated_at FROM client_tags WHERE client_account_id = ? AND LOWER(name) = LOWER(?) AND id <> ? LIMIT 1", [clientAccountId, name, tagId]);
    if (duplicateRows[0]) throw new Error("TAG_NAME_ALREADY_EXISTS");

    await connection.query("UPDATE client_tags SET name = ?, color = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND client_account_id = ?", [name, input.color, tagId, clientAccountId]);

    if (current.name !== name) {
      const [cardRows] = await connection.query<Array<RowDataPacket & { id: string; tags_json: unknown }>>("SELECT id, tags_json FROM kanban_cards WHERE client_account_id = ?", [clientAccountId]);
      for (const card of cardRows) {
        let tags: unknown = card.tags_json;
        if (typeof tags === "string") {
          try { tags = JSON.parse(tags); } catch { tags = []; }
        }
        if (!Array.isArray(tags) || !tags.includes(current.name)) continue;
        const nextTags = tags.map((item) => item === current.name ? name : item);
        await connection.query("UPDATE kanban_cards SET tags_json = ? WHERE id = ?", [JSON.stringify(nextTags), card.id]);
      }

      const [accountRows] = await connection.query<Array<RowDataPacket & { kanban_automations_json: unknown }>>("SELECT kanban_automations_json FROM client_accounts WHERE id = ? LIMIT 1", [clientAccountId]);
      let automations: unknown = accountRows[0]?.kanban_automations_json;
      if (typeof automations === "string") {
        try { automations = JSON.parse(automations); } catch { automations = []; }
      }
      if (Array.isArray(automations)) {
        const nextAutomations = automations.map((item) => {
          if (!item || typeof item !== "object") return item;
          const rule = item as Record<string, unknown>;
          return {
            ...rule,
            triggerValue: rule.triggerType === "tag_added" && rule.triggerValue === current.name ? name : rule.triggerValue,
            actionValue: rule.actionType === "add_tag" && rule.actionValue === current.name ? name : rule.actionValue,
          };
        });
        await connection.query("UPDATE client_accounts SET kanban_automations_json = ? WHERE id = ?", [JSON.stringify(nextAutomations), clientAccountId]);
      }
    }

    const [updatedRows] = await connection.query<TagRow[]>("SELECT id, client_account_id, name, color, legacy_id, created_at, updated_at FROM client_tags WHERE id = ?", [tagId]);
    await connection.commit();
    return updatedRows[0] ? mapTag(updatedRows[0]) : null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
