import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { z } from "zod";
import { assertClientAccess, assertInternalAccess } from "../auth/auth.access.js";
import { RadarSuggestionsRepository, type RadarSuggestionsStore } from "./radar-suggestions.repository.js";
import { RadarSuggestionsService } from "./radar-suggestions.service.js";
import { radarSuggestionInputSchema, radarSuggestionParamsSchema, radarSuggestionDetailParamsSchema, radarSuggestionQuerySchema } from "./radar-suggestions.schemas.js";
function parse<T>(request: FastifyRequest, schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw request.server.httpErrors.badRequest(result.error.issues.map((issue) => issue.message).join(" "));
  return result.data;
}
export const radarSuggestionsRoutes: FastifyPluginAsync<{ store?: RadarSuggestionsStore }> = async (app, options) => {
  // Migration must be applied explicitly after review. No startup DDL or drawer writes.
  const store = options.store ?? new RadarSuggestionsRepository(app.db);
  const service = new RadarSuggestionsService(store);
  async function authorize(request: FastifyRequest, clientId: string) {
    assertClientAccess(request, clientId, ["admin", "colaborador"]);
    if (!await store.clientExists(clientId)) throw app.httpErrors.notFound("Cliente não encontrado.");
  }
  app.get("/radar-suggestions", async (request) => {
    assertInternalAccess(request);
    const query = parse(request, radarSuggestionQuerySchema, request.query);
    const auth = request.auth!;
    const ids = auth.user.globalRole === "super_admin" ? null : [...new Set(auth.memberships
      .filter((membership) => ["admin", "colaborador"].includes(membership.membershipRole)).map((membership) => membership.clientAccountId))];
    return store.listPending(ids, query);
  });
  app.get("/clients/:clientId/radar-suggestions", async (request) => {
    assertInternalAccess(request);
    const { clientId } = parse(request, radarSuggestionParamsSchema, request.params);
    await authorize(request, clientId);
    return store.listPending([clientId], parse(request, radarSuggestionQuerySchema, request.query));
  });
  app.get("/clients/:clientId/radar-suggestions/:id", async (request) => {
    assertInternalAccess(request);
    const { clientId, id } = parse(request, radarSuggestionDetailParamsSchema, request.params);
    await authorize(request, clientId);
    const item = await store.pendingDetail(clientId, id);
    if (!item) throw app.httpErrors.notFound("Sugestão pendente não encontrada.");
    return { suggestion: item };
  });
  app.post("/clients/:clientId/radar-suggestions", async (request, reply) => {
    assertInternalAccess(request);
    const { clientId } = parse(request, radarSuggestionParamsSchema, request.params);
    await authorize(request, clientId);
    const input = parse(request, radarSuggestionInputSchema, request.body);
    const result = await service.createPending(clientId, request.auth!.user.id, input);
    return reply.code(result.created ? 201 : 200).send(result);
  });
  for (const action of ["accept", "dismiss"] as const) app.post(`/clients/:clientId/radar-suggestions/:id/${action}`, async (request) => {
    assertInternalAccess(request);
    const { clientId, id } = parse(request, radarSuggestionDetailParamsSchema, request.params);
    await authorize(request, clientId);
    if (request.body != null && (typeof request.body !== "object" || Array.isArray(request.body) || Object.keys(request.body).length)) throw app.httpErrors.badRequest("Esta ação não recebe conteúdo.");
    return service.resolve(clientId, id, request.auth!.user.id, action);
  });

};
