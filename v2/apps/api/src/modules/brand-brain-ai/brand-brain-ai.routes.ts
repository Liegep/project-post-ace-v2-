import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { assertClientAccess, assertInternalAccess } from "../auth/auth.access.js";
import { BrandBrainAiRepository, type BrandBrainAiStore } from "./brand-brain-ai.repository.js";
import { BrandBrainAiService, type AiConfig } from "./brand-brain-ai.service.js";
import type { StructuredProvider } from "../../lib/openai-responses.js";
export const brandBrainAiRoutes: FastifyPluginAsync<{ store?: BrandBrainAiStore; provider?: StructuredProvider; config?: AiConfig }> = async (app, options) => {
  const service = new BrandBrainAiService(options.store ?? new BrandBrainAiRepository(app.db), options.config ?? app.appEnv, options.provider);
  function authorize(request: FastifyRequest) {
    assertInternalAccess(request);
    const params = z.object({ clientId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) throw app.httpErrors.badRequest("Cliente inválido.");
    assertClientAccess(request, params.data.clientId, ["admin", "colaborador"]);
    return params.data.clientId;
  }
  app.get("/clients/:clientId/brand-brain-ai/context", async request => service.capabilities(authorize(request)));
  app.post("/clients/:clientId/brand-brain-ai/analyze", async request => service.analyzePauta(authorize(request), request.body));
  app.post("/clients/:clientId/brand-brain-ai/generate", async request => service.generatePautas(authorize(request), request.body));
  app.post("/clients/:clientId/brand-brain-ai/refine", async request => service.refinePauta(authorize(request), request.body));
};
