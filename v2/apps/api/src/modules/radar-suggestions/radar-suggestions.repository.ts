import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { RadarSuggestion, RadarSuggestionInput, RadarSuggestionQuery } from "./radar-suggestions.schemas.js";
const fields = {
  title: "title", concept: "concept", hook: "hook", description: "description", contentType: "content_type",
  pillar: "pillar", objective: "objective", rationale: "rationale", cta: "cta", captionSuggestion: "caption_suggestion",
  alignmentScore: "alignment_score", sourceTitle: "source_title", sourceUrl: "source_url", sourceDate: "source_date",
  radarName: "radar_name", aiModel: "ai_model", brandBrainVersion: "brand_brain_version", brandBrainContextHash: "brand_brain_context_hash",
} as const;
// Read TIMESTAMP instants in SQL, independent of the mysql2/device timezone.
const selection = "*, UNIX_TIMESTAMP(created_at) AS created_epoch, UNIX_TIMESTAMP(updated_at) AS updated_epoch, UNIX_TIMESTAMP(accepted_at) AS accepted_epoch, UNIX_TIMESTAMP(dismissed_at) AS dismissed_epoch";
function suggestion(row: RowDataPacket): RadarSuggestion {
  const data = Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column]])) as Omit<RadarSuggestionInput, "basedOn">;
  const iso = (value: string | number | null) => value == null ? null : new Date(Number(value) * 1000).toISOString();
  return { ...data, basedOn: typeof row.based_on_json === "string" ? JSON.parse(row.based_on_json) : row.based_on_json,
    id: row.id, clientAccountId: row.client_account_id, status: row.status, sourceKey: row.source_key, dedupeHash: row.dedupe_hash,
    createdByUserId: row.created_by_user_id, acceptedPautaId: row.accepted_pauta_id, acceptedByUserId: row.accepted_by_user_id,
    dismissedByUserId: row.dismissed_by_user_id, createdAt: iso(row.created_epoch)!, updatedAt: iso(row.updated_epoch)!,
    acceptedAt: iso(row.accepted_epoch), dismissedAt: iso(row.dismissed_epoch) };
}
export class RadarSuggestionsRepository {
  constructor(private readonly db: Pool) {}
  async clientExists(clientId: string) {
    const [rows] = await this.db.query<RowDataPacket[]>("SELECT id FROM client_accounts WHERE id = ?", [clientId]);
    return rows.length > 0;
  }
  async createPending(clientId: string, userId: string, input: RadarSuggestionInput, keys: { sourceKey: string; dedupeHash: string }) {
    const id = randomUUID();
    const columns = Object.values(fields);
    try {
      // One atomic INSERT + unique constraint arbitrates concurrent requests. Never update on duplicate.
      await this.db.query(`INSERT INTO radar_suggestions (id, client_account_id, ${columns.join(", ")}, based_on_json, source_key, dedupe_hash, created_by_user_id)
        VALUES (${Array(columns.length + 6).fill("?").join(", ")})`,
      [id, clientId, ...Object.keys(fields).map((key) => input[key as keyof typeof fields]), JSON.stringify(input.basedOn), keys.sourceKey, keys.dedupeHash, userId]);
    } catch (error) {
      if ((error as { code?: string }).code !== "ER_DUP_ENTRY") throw error;
      const [rows] = await this.db.query<RowDataPacket[]>(`SELECT ${selection} FROM radar_suggestions WHERE client_account_id = ? AND dedupe_hash = ?`, [clientId, keys.dedupeHash]);
      if (!rows[0]) throw error;
      return { suggestion: suggestion(rows[0]), created: false, duplicatePrevented: true };
    }
    const [rows] = await this.db.query<RowDataPacket[]>(`SELECT ${selection} FROM radar_suggestions WHERE client_account_id = ? AND id = ?`, [clientId, id]);
    if (!rows[0]) throw new Error("Sugestão criada não encontrada.");
    return { suggestion: suggestion(rows[0]), created: true, duplicatePrevented: false };
  }
  async pendingDetail(clientId: string, id: string) {
    const [rows] = await this.db.query<RowDataPacket[]>(`SELECT ${selection} FROM radar_suggestions WHERE client_account_id = ? AND id = ? AND status = 'pending'`, [clientId, id]);
    return rows[0] ? suggestion(rows[0]) : null;
  }
  async listPending(clientIds: string[] | null, query: RadarSuggestionQuery) {
    if (clientIds?.length === 0) return { items: [], hasMore: false, ...query };
    const scope = clientIds ? ` AND client_account_id IN (${clientIds.map(() => "?").join(", ")})` : "";
    // Fetch one extra, rather than a separate count that could race with ingestion.
    const [rows] = await this.db.query<RowDataPacket[]>(`SELECT ${selection} FROM radar_suggestions WHERE status = 'pending'${scope}
      ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, [...(clientIds ?? []), query.limit + 1, query.offset]);
    return { items: rows.slice(0, query.limit).map(suggestion), hasMore: rows.length > query.limit, ...query };
  }
}
export type RadarSuggestionsStore = Pick<RadarSuggestionsRepository, keyof RadarSuggestionsRepository>;
