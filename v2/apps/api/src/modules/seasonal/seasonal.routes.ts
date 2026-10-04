import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { z } from "zod";
import { assertInternalAccess, assertClientAccess, getClientScope } from "../auth/auth.access.js";
import { ISO_COUNTRY_CODES } from "./iso-countries.js";
import { SeasonalRepository, type SeasonalStore } from "./seasonal.repository.js";
import { createNagerLoader, type ExternalLoader } from "./seasonal.nager.js";
import { countryCodeSchema, monitorSchema, marketSchema, opportunitySchema, radarQuerySchema, categorySchema } from "./seasonal.schemas.js";
import { todayInZone } from "./seasonal.dates.js";
import { loadRadar } from "./seasonal.service.js";

function parse<T>(request: FastifyRequest, schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw request.server.httpErrors.badRequest(result.error.issues.map((issue) => issue.message).join(" "));
  return result.data;
}
function assertManager(request: FastifyRequest) {
  assertInternalAccess(request);
  if (!["super_admin", "admin"].includes(request.auth!.user.globalRole)) throw request.server.httpErrors.forbidden("Somente administradores podem configurar o radar.");
}
function clientId(request: FastifyRequest) { return (request.params as { clientId: string }).clientId; }

export const seasonalRoutes: FastifyPluginAsync<{ store?: SeasonalStore; external?: ExternalLoader; today?: () => string }> = async (app, options) => {
  // Deliberately no runtime DDL. An operator must apply the additive migration after review.
  const store = options.store ?? new SeasonalRepository(app.db);
  const external = options.external ?? createNagerLoader();
  app.get("/seasonal/countries", async (request) => { assertInternalAccess(request); return { countryCodes: ISO_COUNTRY_CODES }; });
  app.get("/seasonal/monitored-countries", async (request) => { assertInternalAccess(request); return { items: await store.monitoredCountries(), today: options.today?.() ?? todayInZone(app.appEnv.APP_TIMEZONE) }; });
  app.put("/seasonal/monitored-countries/:countryCode", async (request) => {
    assertManager(request);
    const code = parse(request, countryCodeSchema, (request.params as { countryCode: string }).countryCode);
    const input = parse(request, monitorSchema, request.body);
    await store.setMonitoredCountry(code, input.active); return { ok: true };
  });
  app.get("/seasonal/categories", async (request) => { assertInternalAccess(request); return { items: await store.categories() }; });
  app.post("/seasonal/categories", async (request) => {
    assertManager(request); const input = parse(request, categorySchema, request.body);
    await store.addCategory(input.code, input.label); return { ok: true };
  });
  app.get("/clients/:clientId/editorial-markets", async (request) => {
    assertInternalAccess(request); assertClientAccess(request, clientId(request));
    if (!await store.clientExists(clientId(request))) throw app.httpErrors.notFound("Cliente não encontrado.");
    return { items: await store.markets(clientId(request)) };
  });
  app.put("/clients/:clientId/editorial-markets", async (request) => {
    assertManager(request); assertClientAccess(request, clientId(request), ["admin"]);
    if (!await store.clientExists(clientId(request))) throw app.httpErrors.notFound("Cliente não encontrado.");
    const input = parse(request, marketSchema, request.body);
    await store.confirmMarkets(clientId(request), input.countryCodes, request.auth!.user.id); return { ok: true };
  });
  app.post("/seasonal/opportunities", async (request, reply) => {
    assertManager(request); const input = parse(request, opportunitySchema, request.body);
    if (!(await store.categories()).some((category) => category.code === input.categoryCode)) throw app.httpErrors.badRequest("Categoria não cadastrada.");
    return reply.code(201).send({ id: await store.createOpportunity(input) });
  });
  app.get("/seasonal/radar", async (request) => {
    assertInternalAccess(request); const query = parse(request, radarQuerySchema, request.query);
    if (query.clientId) assertClientAccess(request, query.clientId);
    const scope = getClientScope(request.auth!.user.globalRole, request.auth!.user.id, request.auth!.memberships);
    return loadRadar(store, external, query, scope.mode === "global" ? null : scope.clientIds, options.today?.() ?? todayInZone(app.appEnv.APP_TIMEZONE));
  });
};
