import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { RadarSuggestionsRepository } from "../radar-suggestions/radar-suggestions.repository.js";
import { radarSuggestionKeys } from "../radar-suggestions/radar-suggestions.service.js";
import type { RadarSuggestionInput } from "../radar-suggestions/radar-suggestions.schemas.js";
export type RadarSourceRun = { id: string; status: "processing" | "completed" | "no_op" | "failed"; suggestionId: string | null; errorCode: string | null };
const mapRun = (row: RowDataPacket): RadarSourceRun => ({ id: row.id, status: row.status, suggestionId: row.suggestion_id, errorCode: row.error_code });
export class McpRadarRepository {
  constructor(private db: Pool) {}
  async existingSource(clientId: string, sourceKey: string) {
    const [rows] = await this.db.query<RowDataPacket[]>("SELECT id, status FROM radar_suggestions WHERE client_account_id=? AND source_key=? ORDER BY created_at, id LIMIT 1", [clientId, sourceKey]);
    return rows[0] ? { id: String(rows[0].id), status: String(rows[0].status) } : null;
  }
  async summary(clientId: string, id: string) {
    const [rows] = await this.db.query<RowDataPacket[]>("SELECT id,title,content_type,status,alignment_score FROM radar_suggestions WHERE client_account_id=? AND id=?", [clientId,id]);
    return rows[0] ? { id: String(rows[0].id), clientAccountId: clientId, title: String(rows[0].title), contentType: String(rows[0].content_type), status: String(rows[0].status), alignmentScore: rows[0].alignment_score as number | null } : null;
  }
  async claim(clientId: string, sourceKey: string, contextHash: string) {
    const id = randomUUID();
    try {
      await this.db.query("INSERT INTO radar_source_runs (id,client_account_id,source_key,context_hash) VALUES (?,?,?,?)", [id, clientId, sourceKey, contextHash]);
      return { owned: true, run: { id, status: "processing" as const, suggestionId: null, errorCode: null } };
    } catch (error) {
      if ((error as { code?: string }).code !== "ER_DUP_ENTRY") throw error;
      const [rows] = await this.db.query<RowDataPacket[]>("SELECT id,status,suggestion_id,error_code FROM radar_source_runs WHERE client_account_id=? AND source_key=?", [clientId, sourceKey]);
      if (!rows[0]) throw error;
      return { owned: false, run: mapRun(rows[0]) };
    }
  }
  async finish(id: string, clientId: string, userId: string, suggestion: RadarSuggestionInput | null) {
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM radar_source_runs WHERE id=? AND client_account_id=? FOR UPDATE", [id, clientId]);
      if (!rows[0] || rows[0].status !== "processing") throw Error("Processamento já resolvido.");
      let suggestionId: string | null = null;
      let created = false;
      if (suggestion) {
        // Same source may have been inserted manually while the provider was running.
        const repo = new McpRadarRepository(connection as unknown as Pool);
        const existing = await repo.existingSource(clientId, rows[0].source_key);
        if (existing) suggestionId = existing.id;
        else {
          const result = await new RadarSuggestionsRepository(connection as unknown as Pool).createPending(clientId, userId, suggestion, radarSuggestionKeys(suggestion));
          suggestionId = result.suggestion.id; created = result.created;
        }
      }
      const status = suggestion ? "completed" as const : "no_op" as const;
      await connection.query("UPDATE radar_source_runs SET status=?,suggestion_id=? WHERE id=?", [status, suggestionId, id]);
      await connection.commit(); return { id, status, suggestionId, errorCode: null, created };
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  async fail(id: string, code: string) {
    await this.db.query("UPDATE radar_source_runs SET status='failed',error_code=? WHERE id=? AND status='processing'", [code, id]);
  }
}
export type McpRadarStore = Pick<McpRadarRepository, keyof McpRadarRepository>;
