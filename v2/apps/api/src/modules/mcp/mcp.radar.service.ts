import { z } from "zod";
import { getClientScope, hasMembershipRole } from "../auth/auth.access.js";
import type { AuthContext } from "../auth/auth.types.js";
import { radarInput } from "../brand-brain-ai/brand-brain-ai.schemas.js";
import { BrandBrainAiService, BrandBrainAiError } from "../brand-brain-ai/brand-brain-ai.service.js";
import { AiProviderError } from "../../lib/openai-responses.js";
import { radarSourceKey } from "../radar-suggestions/radar-suggestions.service.js";
import { radarSuggestionInputSchema } from "../radar-suggestions/radar-suggestions.schemas.js";
import type { McpRadarStore } from "./mcp.radar.repository.js";
import { MCP_RADAR_SUGGEST_SCOPE } from "./mcp.security.js";
export const mcpRadarInput = radarInput.extend({ clientId: z.string().uuid() }).strict();
export type McpRadarOutcome = { outcome: "created" | "existing" | "no_op" | "processing"; suggestionId: string | null; status: string; sourceHash: string; suggestion?: Awaited<ReturnType<McpRadarStore["summary"]>> };
export class McpRadarService {
  constructor(private store: McpRadarStore, private ai: BrandBrainAiService, private model: string) {}
  async create(auth: AuthContext, scopes: string[], raw: unknown): Promise<McpRadarOutcome> {
    if (!scopes.includes(MCP_RADAR_SUGGEST_SCOPE)) throw new BrandBrainAiError(403, "missing_scope", "Consentimento radar:suggest obrigatório.");
    const parsed = mcpRadarInput.safeParse(raw);
    if (!parsed.success) throw new BrandBrainAiError(400, "invalid_input", "Verifique os dados da fonte.");
    const input = parsed.data;
    input.clientId = input.clientId.toLowerCase();
    const scope = getClientScope(auth.user.globalRole, auth.user.id, auth.memberships);
    if (!auth.user.isActive || auth.user.globalRole === "cliente" || (scope.mode !== "global" && (!scope.clientIds.includes(input.clientId) || !hasMembershipRole(auth.memberships, input.clientId, ["admin", "colaborador"])))) throw new BrandBrainAiError(403, "client_forbidden", "Cliente fora do seu acesso.");
    const availability = this.ai.availability();
    if (!availability.enabled) throw new BrandBrainAiError(503, "disabled", availability.reason!);
    if (input.sourceDate?.includes("T")) input.sourceDate = new Date(input.sourceDate).toISOString();
    const sourceHash = radarSourceKey(input);
    const existing = await this.store.existingSource(input.clientId, sourceHash);
    if (existing) return { outcome: "existing", suggestionId: existing.id, status: existing.status, sourceHash, suggestion: await this.store.summary(input.clientId, existing.id) };
    const context = await this.ai.context(input.clientId);
    const claim = await this.store.claim(input.clientId, sourceHash, context.contextHash);
    if (!claim.owned) {
      if (claim.run.status === "failed") throw new BrandBrainAiError(409, "source_failed", "Esta fonte já teve uma tentativa. Reanálise requer revisão explícita; nenhuma nova chamada foi feita.");
      return { outcome: claim.run.status === "no_op" ? "no_op" : claim.run.status === "processing" ? "processing" : "existing", suggestionId: claim.run.suggestionId, status: claim.run.status, sourceHash, ...(claim.run.suggestionId ? { suggestion: await this.store.summary(input.clientId, claim.run.suggestionId) } : {}) };
    }
    try {
      const result = await this.ai.generateRadarSuggestion(input, context);
      const { format, ...fields } = result.shouldCreate ? result.suggestion : { format: "" };
      const suggestion = result.shouldCreate ? radarSuggestionInputSchema.parse({ ...fields, contentType: format, sourceTitle: input.sourceTitle, sourceUrl: input.sourceUrl, sourceDate: input.sourceDate, radarName: input.radarName, aiModel: this.model, brandBrainVersion: context.brandBrainVersion, brandBrainContextHash: context.contextHash }) : null;
      const finished = await this.store.finish(claim.run.id, input.clientId, auth.user.id, suggestion);
      const summary = finished.suggestionId ? await this.store.summary(input.clientId, finished.suggestionId) : null;
      return { outcome: finished.status === "no_op" ? "no_op" : finished.created ? "created" : "existing", suggestionId: finished.suggestionId, status: summary?.status ?? finished.status, sourceHash, ...(summary ? { suggestion: summary } : {}) };
    } catch (error) {
      const code = error instanceof AiProviderError || error instanceof BrandBrainAiError ? error.code : "storage_unavailable";
      await this.store.fail(claim.run.id, code).catch(() => undefined);
      if (error instanceof AiProviderError || error instanceof BrandBrainAiError) throw error;
      throw new BrandBrainAiError(503, "storage_unavailable", "Não foi possível concluir a sugestão. Nenhuma nova chamada ocorrerá no retry.");
    }
  }
}
