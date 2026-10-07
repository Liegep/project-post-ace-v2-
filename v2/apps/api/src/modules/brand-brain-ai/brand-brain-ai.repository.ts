import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { OfficialClientData } from "./brand-brain-ai.context.js";
import type { AiUsage } from "../../lib/openai-responses.js";
export type AiRunEnd = { status: "success" | "failed"; durationMs: number; errorCode: string | null; usage: AiUsage; model: string };
export class BrandBrainAiRepository {
  constructor(private readonly db: Pool) {}
  async officialClient(clientId: string): Promise<OfficialClientData | null> {
    const paths = Array.from({ length: 30 }, (_, i) => `'$.pautaIdeas[${i}]'`).join(", ");
    const [rows] = await this.db.query<RowDataPacket[]>(`SELECT id, name, locale, JSON_EXTRACT(workspace_drawer_json, '$.brandBrain') AS brain, JSON_EXTRACT(workspace_drawer_json, ${paths}) AS ideas FROM client_accounts WHERE id = ?`, [clientId]);
    if (!rows[0]) return null;
    const parse = (value: unknown) => typeof value === "string" ? JSON.parse(value) : value;
    const brain = parse(rows[0].brain); const ideas = parse(rows[0].ideas);
    return { id: rows[0].id, name: rows[0].name, locale: rows[0].locale, brain: brain && typeof brain === "object" && !Array.isArray(brain) ? brain : {}, recentPautas: Array.isArray(ideas) ? ideas : [] };
  }
  async beginRun(clientId: string, operation: string, model: string, contextHash: string) {
    const id = randomUUID();
    await this.db.query("INSERT INTO brand_brain_ai_runs (id, client_account_id, operation, model, context_hash) VALUES (?, ?, ?, ?, ?)", [id, clientId, operation, model, contextHash]);
    return id;
  }
  async endRun(id: string, result: AiRunEnd) {
    await this.db.query("UPDATE brand_brain_ai_runs SET status = ?, duration_ms = ?, error_code = ?, model = ?, input_tokens = ?, output_tokens = ?, total_tokens = ? WHERE id = ?", [result.status, result.durationMs, result.errorCode, result.model, result.usage.inputTokens, result.usage.outputTokens, result.usage.totalTokens, id]);
  }
}
export type BrandBrainAiStore = Pick<BrandBrainAiRepository, keyof BrandBrainAiRepository>;
