import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { RadarSuggestion, RadarSuggestionInput, RadarSuggestionQuery, RadarSuggestionSummary, RadarPauta } from "./radar-suggestions.schemas.js";
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
  async resolve(clientId: string, id: string, userId: string, action: "accept" | "dismiss") {
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      // All decisions lock client first, then suggestion: same order as drawer writers.
      const [clients] = await connection.query<RowDataPacket[]>("SELECT workspace_drawer_json FROM client_accounts WHERE id = ? FOR UPDATE", [clientId]);
      const [rows] = await connection.query<RowDataPacket[]>(`SELECT ${selection} FROM radar_suggestions WHERE client_account_id = ? AND id = ? FOR UPDATE`, [clientId, id]);
      if (!clients[0] || !rows[0]) throw Object.assign(new Error("Sugestão não encontrada."), { statusCode: 404 });
      const item = suggestion(rows[0]);
      const raw = clients[0].workspace_drawer_json;
      const drawer = (typeof raw === "string" ? JSON.parse(raw) : raw) ?? {};
      if (typeof drawer !== "object" || Array.isArray(drawer)) throw new Error("Dados do cliente inválidos.");
      if (drawer.pautaIdeas != null && !Array.isArray(drawer.pautaIdeas)) throw new Error("Banco de pautas inválido.");
      const ideas: Array<Record<string, unknown>> = drawer.pautaIdeas ?? [];
      if (action === "accept") {
        if (item.status === "dismissed") throw Object.assign(new Error("Uma sugestão descartada não pode ser adicionada ao banco."), { statusCode: 409 });
        if (item.status === "accepted") {
          const pauta = ideas.find((idea) => idea?.id === item.acceptedPautaId);
          if (!pauta) throw Object.assign(new Error("A pauta já foi criada, mas não está mais no banco do cliente."), { statusCode: 409 });
          await connection.commit(); return { status: "accepted" as const, pauta, created: false };
        }
        const now = new Date().toISOString();
        const pauta: RadarPauta = { id: randomUUID(), title: item.title, description: item.description, caption: item.captionSuggestion ?? "", contentType: item.contentType,
          status: "draft", createdAt: now, updatedAt: now, createdBy: "radar_ai", radarSuggestionId: item.id, radarSource: item.radarName,
          sourceTitle: item.sourceTitle, sourceUrl: item.sourceUrl, pillar: item.pillar, objective: item.objective };
        await connection.query("UPDATE client_accounts SET workspace_drawer_json = ? WHERE id = ?", [JSON.stringify({ ...drawer, pautaIdeas: [pauta, ...ideas] }), clientId]);
        await connection.query("UPDATE radar_suggestions SET status = 'accepted', accepted_pauta_id = ?, accepted_by_user_id = ?, accepted_at = CURRENT_TIMESTAMP(3) WHERE client_account_id = ? AND id = ?", [pauta.id, userId, clientId, id]);
        await connection.commit(); return { status: "accepted" as const, pauta, created: true };
      }
      if (item.status === "accepted") throw Object.assign(new Error("Esta sugestão já foi adicionada ao banco."), { statusCode: 409 });
      if (item.status === "pending") await connection.query("UPDATE radar_suggestions SET status = 'dismissed', dismissed_by_user_id = ?, dismissed_at = CURRENT_TIMESTAMP(3) WHERE client_account_id = ? AND id = ?", [userId, clientId, id]);
      await connection.commit(); return { status: "dismissed" as const, created: false };
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async listPending(clientIds: string[] | null, query: RadarSuggestionQuery) {
    if (clientIds?.length === 0) return { items: [], total: 0, hasMore: false, ...query };
    const scope = clientIds ? ` AND client_account_id IN (${clientIds.map(() => "?").join(", ")})` : "";
    const [counts] = await this.db.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM radar_suggestions WHERE status = 'pending'${scope}`, clientIds ?? []);
    const [rows] = await this.db.query<RowDataPacket[]>(`SELECT r.id, r.client_account_id, c.name AS client_name, r.title, r.content_type, r.pillar, r.alignment_score, r.source_title, r.source_date, UNIX_TIMESTAMP(r.created_at) AS created_epoch
      FROM radar_suggestions r JOIN client_accounts c ON c.id = r.client_account_id
      WHERE r.status = 'pending'${scope.replaceAll("client_account_id", "r.client_account_id")}
      ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`, [...(clientIds ?? []), query.limit + 1, query.offset]);
    const items: RadarSuggestionSummary[] = rows.slice(0, query.limit).map((row) => ({ id: row.id, clientAccountId: row.client_account_id, clientName: row.client_name,
      title: row.title, contentType: row.content_type, pillar: row.pillar, alignmentScore: row.alignment_score, sourceTitle: row.source_title, sourceDate: row.source_date, createdAt: new Date(Number(row.created_epoch) * 1000).toISOString() }));
    return { items, total: Number(counts[0].total), hasMore: rows.length > query.limit, ...query };

  }
}
export type RadarSuggestionsStore = Pick<RadarSuggestionsRepository, keyof RadarSuggestionsRepository>;
