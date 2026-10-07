import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import type { AuthContext } from "../auth/auth.types.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { radarSuggestionsRoutes } from "./radar-suggestions.routes.js";
import { RadarSuggestionsService, radarSuggestionKeys } from "./radar-suggestions.service.js";
import { radarSuggestionInputSchema, radarSuggestionQuerySchema, type RadarSuggestion } from "./radar-suggestions.schemas.js";
import type { RadarSuggestionsStore } from "./radar-suggestions.repository.js";
import { clientA, clientB, actorId, sample } from "./radar-suggestions.test-fixtures.js";
function fixture() {
  const items: RadarSuggestion[] = [];
  const store: RadarSuggestionsStore = {
    clientExists: async (id) => [clientA, clientB].includes(id),
    createPending: async (clientId, userId, input, keys) => {
      const existing = items.find((item) => item.clientAccountId === clientId && item.dedupeHash === keys.dedupeHash);
      if (existing) return { suggestion: existing, created: false, duplicatePrevented: true };
      const now = new Date().toISOString();
      const suggestion: RadarSuggestion = { ...input, ...keys, id: randomUUID(), clientAccountId: clientId, createdByUserId: userId,
        status: "pending", acceptedPautaId: null, acceptedByUserId: null, dismissedByUserId: null, createdAt: now, updatedAt: now, acceptedAt: null, dismissedAt: null };
      items.unshift(suggestion); return { suggestion, created: true, duplicatePrevented: false };
    },
    pendingDetail: async (clientId, id) => items.find((item) => item.clientAccountId === clientId && item.id === id && item.status === "pending") ?? null,
    listPending: async (ids, query) => {
      const visible = items.filter((item) => item.status === "pending" && (!ids || ids.includes(item.clientAccountId)));
      return { items: visible.slice(query.offset, query.offset + query.limit), hasMore: visible.length > query.offset + query.limit, ...query };
    },
  };
  return { items, store, service: new RadarSuggestionsService(store) };
}
function auth(role: AuthContext["user"]["globalRole"], ids = [clientA]): AuthContext {
  return { user: { id: actorId, fullName: "Equipe", email: "test@example.invalid", globalRole: role, avatarUrl: null, locale: "pt", isActive: true },
    memberships: ids.map((id) => ({ clientAccountId: id, membershipRole: "colaborador", portalAccessLevel: "viewer", isPrimary: true, clientName: "Cliente", clientSlug: id, ownerUserId: null })) };
}
test("schema validates required fields, bounds, dates, links, and rejects caller-controlled status/identity", () => {
  const input = radarSuggestionInputSchema.parse(sample());
  assert.equal(input.aiModel, null); assert.equal(input.alignmentScore, null); assert.deepEqual(input.basedOn, []);
  for (const patch of [{ title: " " }, { alignmentScore: 101 }, { alignmentScore: 1.5 }, { sourceDate: "2026-02-30" }, { sourceUrl: "javascript:alert(1)" }, { sourceUrl: "https://user:pass@example.org" }, { status: "accepted" }, { id: randomUUID() }, { clientAccountId: clientB }, { basedOn: [""] }, { brandBrainVersion: -1 }]) {
    assert.equal(radarSuggestionInputSchema.safeParse(sample(patch)).success, false, JSON.stringify(patch));
  }
  assert.ok(radarSuggestionInputSchema.safeParse(sample({ sourceDate: "2026-10-07T12:30:00+02:00" })).success);
  assert.ok(radarSuggestionInputSchema.safeParse(sample({ sourceUrl: null })).success);
});
test("dedupe normalizes tracking parameters, fragments, query order, whitespace and Unicode", () => {
  const keys = radarSuggestionKeys(radarSuggestionInputSchema.parse(sample()));
  const other = radarSuggestionKeys(radarSuggestionInputSchema.parse(sample({ title: "  OBSERVE   O CONTEXTO  ", sourceUrl: "https://example.org/study?a=1&utm_source=radar&b=2#section" })));
  assert.deepEqual(other, keys);
});
test("different editorial angles or meaningful URLs remain independent, including sources without URL", () => {
  const keys = (patch: Record<string, unknown>) => radarSuggestionKeys(radarSuggestionInputSchema.parse(sample(patch)));
  assert.notEqual(keys({}).dedupeHash, keys({ concept: "Outro ângulo" }).dedupeHash);
  assert.notEqual(keys({}).sourceKey, keys({ sourceUrl: "https://example.org/study?a=2&b=2" }).sourceKey);
  assert.notEqual(keys({ sourceUrl: null }).sourceKey, keys({ sourceUrl: null, sourceDate: "2026-10-08" }).sourceKey);
});
test("service creates only pending, isolates duplicates by client and never resurrects resolved suggestions", async () => {
  const f = fixture(); const one = await f.service.createPending(clientA, actorId, sample());
  assert.equal(one.suggestion.status, "pending"); assert.equal(one.suggestion.createdByUserId, actorId);
  assert.equal((await f.service.createPending(clientA, actorId, sample())).created, false);
  assert.equal((await f.service.createPending(clientB, actorId, sample())).created, true);
  one.suggestion.status = "dismissed";
  assert.equal((await f.service.createPending(clientA, actorId, sample())).suggestion.status, "dismissed");
  assert.equal(f.items.length, 2);
});
test("service propagates storage failure without a fallback or incomplete success", async () => {
  const f = fixture(); f.store.createPending = async () => { throw new Error("Database unavailable"); };
  await assert.rejects(f.service.createPending(clientA, actorId, sample()), /Database unavailable/);
  assert.equal(f.items.length, 0);
  await assert.rejects(f.service.createPending(clientA, actorId, sample({ status: "accepted" })));
});
test("pagination rejects invalid and unbounded input", () => {
  assert.deepEqual(radarSuggestionQuerySchema.parse({}), { limit: 25, offset: 0 });
  for (const query of [{ limit: 0 }, { limit: 101 }, { offset: -1 }, { limit: "NaN" }, { status: "accepted" }]) assert.equal(radarSuggestionQuerySchema.safeParse(query).success, false);
});
test("HTTP authorization, scoped lists/details, pending-only reads, retry semantics and unavailable mutations", async () => {
  const f = fixture(); const app = Fastify(); let current: AuthContext | null = null;
  await app.register(httpErrorsPluginRegistered);
  app.addHook("onRequest", async (request) => { request.auth = current; });
  await app.register(radarSuggestionsRoutes, { prefix: "/api", store: f.store });
  const url = `/api/clients/${clientA}/radar-suggestions`;
  try {
    assert.equal((await app.inject(url)).statusCode, 401);
    current = auth("cliente"); assert.equal((await app.inject(url)).statusCode, 403);
    current = auth("colaborador", []); assert.equal((await app.inject({ method: "POST", url, payload: sample() })).statusCode, 403);
    assert.deepEqual((await app.inject("/api/radar-suggestions")).json().items, []);
    for (const role of ["colaborador", "admin"] as const) {
      current = auth(role); assert.equal((await app.inject(`/api/clients/${clientB}/radar-suggestions`)).statusCode, 403);
      assert.equal((await app.inject(url)).statusCode, 200);
    }
    current = auth("super_admin");
    const first = await app.inject({ method: "POST", url, payload: sample() }); assert.equal(first.statusCode, 201);
    const id = first.json().suggestion.id;
    assert.equal((await app.inject({ method: "POST", url, payload: sample() })).statusCode, 200);
    assert.equal((await app.inject({ method: "POST", url, payload: sample({ status: "accepted" }) })).statusCode, 400);
    await f.service.createPending(clientB, actorId, sample());
    assert.equal((await app.inject("/api/radar-suggestions")).json().items.length, 2);
    current = auth("colaborador");
    assert.equal((await app.inject("/api/radar-suggestions")).json().items.length, 1);
    assert.equal((await app.inject(`${url}/${id}`)).json().suggestion.clientAccountId, clientA);
    assert.equal((await app.inject(`/api/clients/${clientB}/radar-suggestions/${id}`)).statusCode, 403);
    current = auth("super_admin");
    assert.equal((await app.inject(`/api/clients/${clientB}/radar-suggestions/${id}`)).statusCode, 404);
    assert.equal((await app.inject(`/api/clients/${randomUUID()}/radar-suggestions`)).statusCode, 404);
    assert.equal((await app.inject(`${url}/invalid`)).statusCode, 400);
    assert.equal((await app.inject(`${url}?limit=101`)).statusCode, 400);
    const page = (await app.inject("/api/radar-suggestions?limit=1")).json(); assert.equal(page.items.length, 1); assert.equal(page.hasMore, true);
    for (const action of ["accept", "dismiss"]) assert.equal((await app.inject({ method: "POST", url: `${url}/${id}/${action}` })).statusCode, 404);
    assert.equal((await app.inject({ method: "DELETE", url: `${url}/${id}` })).statusCode, 404);
    f.items.forEach((item) => { item.status = "accepted"; });
    assert.equal((await app.inject(url)).json().items.length, 0);
    assert.equal((await app.inject(`${url}/${id}`)).statusCode, 404);
    current = auth("admin"); current.memberships[0].membershipRole = "cliente";
    assert.equal((await app.inject(url)).statusCode, 403);
    assert.equal((await app.inject("/api/radar-suggestions")).json().items.length, 0);
  } finally { await app.close(); }
});
