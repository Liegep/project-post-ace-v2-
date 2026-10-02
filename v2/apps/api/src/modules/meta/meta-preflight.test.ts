import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { Pool } from "mysql2/promise";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { metaRoutes } from "./meta.routes.js";
import { getMetaPreflight } from "./meta-preflight.js";
import { scheduleMetaCardPublications } from "./meta.service.js";
import { validateMetaSchedulingRouting } from "./meta-routing.js";

const TOKEN = "secret-user-token";
const SECRET = "secret-app-secret";
const KEY = Buffer.alloc(32, 7);
const iv = Buffer.alloc(12, 8);
const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
const encrypted = Buffer.concat([cipher.update(TOKEN, "utf8"), cipher.final()]);
const encryptedToken = ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
const destinationRow = (overrides: Record<string, unknown> = {}) => ({
  id: "dest-a", client_account_id: "client-a", name: "Detection", facebook_page_id: "101", facebook_page_name: "Detection",
  instagram_account_id: "201", instagram_username: "detection", is_default: 1,
  created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z", ...overrides,
});
const cardRow = (overrides: Record<string, unknown> = {}) => ({
  id: "card-a", client_account_id: "client-a", column_id: "scheduled", title: "Card A", caption: "Texto", media_type: "image",
  primary_media_url: "https://cdn.example.com/image.jpg", media_urls_json: [], art_type: "post", created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z", ...overrides,
});

type Scenario = {
  destinations?: ReturnType<typeof destinationRow>[];
  cardClient?: string;
  missingCard?: boolean;
  connection?: boolean;
  expired?: boolean;
  collisions?: Record<string, unknown>[];
  meta?: (url: URL) => Response | Promise<Response>;
};
function harness(scenario: Scenario = {}) {
  const destinations = scenario.destinations ?? [destinationRow(), destinationRow({ id: "dest-second", name: "Comercial", facebook_page_id: "102", facebook_page_name: "Comercial", instagram_account_id: "202", instagram_username: "comercial" }), destinationRow({ id: "dest-b", client_account_id: "client-b" })];
  const sqlCalls: { sql: string; params: unknown[] }[] = [];
  const writes: { sql: string; params: unknown[] }[] = [];
  const requests: { url: URL; method: string }[] = [];
  const logs: unknown[] = [];
  const publications = new Map<string, Record<string, unknown>>();
  const query = async (sql: string, params: unknown[] = []) => {
    sqlCalls.push({ sql, params });
    if (sql.startsWith("INSERT INTO meta_scheduled_publications")) {
      writes.push({ sql, params });
      publications.set(String(params[0]), { id: params[0], client_account_id: params[1], card_id: params[2], destination_id: params[3], destination_name: params[4], platform: params[5], meta_asset_id: params[6], scheduled_at: "2026-12-01T12:00:00Z", timezone: params[8], caption: params[9], media_url: params[10], media_urls_json: params[11], media_type: params[12], instagram_user_tags_json: [], status: "scheduled", attempt_count: 0, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z" });
      return [{ affectedRows: 1 }, []];
    }
    assert.match(sql, /^SELECT/, "unexpected write or publishing side effect");
    if (sql.includes("UNION ALL")) return [scenario.collisions ?? [], []];
    if (sql.includes("FROM meta_publish_destinations")) {
      const rows = destinations.filter((d) => d.id === params[0] && (!params[1] || d.client_account_id === params[1]));
      return [rows, []];
    }
    if (sql.includes("FROM kanban_cards")) return [scenario.missingCard || params[0] !== "card-a" ? [] : [cardRow({ client_account_id: scenario.cardClient ?? "client-a" })], []];
    if (sql.includes("FROM meta_connections")) return [scenario.connection === false ? [] : [{ access_token_encrypted: encryptedToken, token_expires_at: scenario.expired ? "2020-01-01T00:00:00Z" : null, data_access_expires_at: null, meta_user_id: "meta-user", meta_account_name: "Test" }], []];
    if (sql.includes("LEFT JOIN client_meta_assets")) return [[{ facebook_page_id: "101", facebook_page_name: "Detection", instagram_account_id: "201", instagram_username: "detection", updated_at: "2026-10-01T12:00:00Z" }], []];
    if (sql.includes("FROM meta_scheduled_publications")) return [[publications.get(String(params[0]))], []];
    if (sql.includes("FROM kanban_columns")) return [[{ id: "scheduled", client_account_id: "client-a", name: "Agendados", position: 0, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z" }], []];
    if (sql.includes("FROM client_accounts")) return [[{ id: params[0], name: "Cliente A", slug: "cliente-a", created_at: "2026-10-01T12:00:00Z" }], []];
    throw new Error("Unexpected test query");
  };
  const connection = { query, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} };
  const db = { query, async getConnection() { return connection; } } as unknown as Pool;
  const app = {
    db, appEnv: { META_APP_ID: "test-app", META_APP_SECRET: SECRET, META_REDIRECT_URI: "https://app.example.com/api/meta/callback", META_TOKEN_ENCRYPTION_KEY: KEY.toString("base64") },
    log: { info(...args: unknown[]) { logs.push(args); } },
    httpErrors: { badRequest: (message: string) => Object.assign(new Error(message), { statusCode: 400 }) },
  } as unknown as FastifyInstance;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({ url, method: init?.method ?? "GET" });
    assert.equal(init?.method, "GET");
    assert.equal(url.origin, "https://graph.facebook.com");
    assert.match(url.pathname, /^\/v26\.0\/(me\/accounts|\d+)$/);
    assert.doesNotMatch(url.searchParams.get("fields") ?? "", /access_token/);
    if (scenario.meta) return scenario.meta(url);
    if (url.pathname.endsWith("/me/accounts")) return Response.json({ data: [{ id: "101", instagram_business_account: { id: "201" } }, { id: "102", instagram_business_account: { id: "202" } }] });
    if (url.pathname.endsWith("/101")) return Response.json({ id: "101", name: "Detection", instagram_business_account: { id: "201" } });
    if (url.pathname.endsWith("/102")) return Response.json({ id: "102", name: "Comercial", instagram_business_account: { id: "202" } });
    if (url.pathname.endsWith("/201")) return Response.json({ id: "201", username: "detection" });
    if (url.pathname.endsWith("/202")) return Response.json({ id: "202", username: "comercial" });
    throw new Error("Unexpected test Meta path");
  };
  return { app, fetchImpl, sqlCalls, writes, requests, logs };
}
async function withHarness<T>(scenario: Scenario, action: (h: ReturnType<typeof harness>) => Promise<T>) {
  const h = harness(scenario); const original = globalThis.fetch; globalThis.fetch = h.fetchImpl;
  try { return await action(h); } finally { globalThis.fetch = original; }
}
const preflight = (h: ReturnType<typeof harness>, overrides = {}) => getMetaPreflight(h.app, { userId: "user-a", clientAccountId: "client-a", destinationId: "dest-a", ...overrides });
const scheduleInput = (overrides = {}) => ({ userId: "user-a", actor: { id: "user-a", fullName: "Test", globalRole: "super_admin" }, clientAccountId: "client-a", destinationId: "dest-a", destinationName: "untrusted-name", card: { id: "card-a", clientAccountId: "client-a", caption: "Texto", mediaType: "image", primaryMediaUrl: "https://cdn.example.com/image.jpg", mediaUrls: [], artType: "post" }, platforms: [{ platform: "instagram" as const, metaAssetId: "201" }], scheduledAt: "2026-12-01T12:00:00Z", timezone: "Europe/Stockholm", ...overrides });
const defaultMeta = (url: URL) => url.pathname.endsWith("/me/accounts") ? Response.json({ data: [{ id: "101", instagram_business_account: { id: "201" } }] }) : url.pathname.endsWith("/101") ? Response.json({ id: "101", name: "Detection", instagram_business_account: { id: "201" } }) : Response.json({ id: "201", username: "detection" });

test("card A and destination A are safe; preflight only selects and GETs", async () => withHarness({}, async (h) => {
  const result = await preflight(h, { cardId: "card-a" });
  assert.equal(result.status, "safe"); assert.equal(result.checks.cardBelongsToClient, true);
  assert.equal(result.checks.instagramLinkedToFacebook, true);
  assert.equal(result.facebook.liveId, "101"); assert.equal(result.instagram.liveUsername, "detection");
  assert.equal(h.requests.length, 3); assert.equal(h.writes.length, 0);
  assert.ok(h.sqlCalls.every(({ sql }) => sql.startsWith("SELECT")));
  assert.equal((await validateMetaSchedulingRouting(h.app, scheduleInput())).destinationName, "Detection");
}));

for (const [name, scenario, overrides, message] of [
  ["destination belongs to client B", {}, { destinationId: "dest-b" }, /destino Meta/],
  ["destination does not exist", {}, { destinationId: "missing" }, /destino Meta/],
  ["card belongs to B in database", { cardClient: "client-b" }, {}, /card/],
  ["card does not exist", { missingCard: true }, {}, /card/],
  ["Facebook differs from saved ID", {}, { platforms: [{ platform: "facebook", metaAssetId: "999" }] }, /Facebook/],
  ["Instagram differs from saved ID", {}, { platforms: [{ platform: "instagram", metaAssetId: "999" }] }, /Instagram/],
  ["mixed platforms include one mismatch", {}, { platforms: [{ platform: "facebook", metaAssetId: "101" }, { platform: "instagram", metaAssetId: "999" }] }, /Instagram/],
] as const) {
  test(`scheduling blocks ${name} before any record, card movement or network request`, async () => withHarness(scenario, async (h) => {
    await assert.rejects(scheduleMetaCardPublications(h.app, scheduleInput(overrides)), message);
    assert.equal(h.writes.length, 0); assert.equal(h.requests.length, 0);
    assert.ok(h.sqlCalls.every(({ sql }) => sql.startsWith("SELECT")));
  }));
}

test("preflight hides another client's destination and skips Meta reads", async () => withHarness({}, async (h) => {
  const result = await preflight(h, { destinationId: "dest-b" });
  assert.equal(result.status, "blocked"); assert.equal(result.destinationName, null); assert.equal(result.facebook.savedId, null);
  assert.equal(h.requests.length, 0);
}));

test("preflight blocks another client's card before Meta reads", async () => withHarness({ cardClient: "client-b" }, async (h) => {
  assert.equal((await preflight(h, { cardId: "card-a" })).checks.cardBelongsToClient, false);
  assert.equal(h.requests.length, 0);
}));

test("multidestinations are verified independently", async () => withHarness({}, async (h) => {
  const a = await preflight(h); const b = await preflight(h, { destinationId: "dest-second" });
  assert.equal(a.status, "safe"); assert.equal(b.status, "safe");
  assert.equal(a.instagram.liveId, "201"); assert.equal(b.instagram.liveId, "202");
  assert.equal(a.destinationName, "Detection"); assert.equal(b.destinationName, "Comercial");
}));

test("removed assets block without raw Meta error exposure", async () => withHarness({ meta: () => Response.json({ error: { code: 100, message: `${TOKEN} ${SECRET} https://graph.facebook.com/?access_token=page-secret&appsecret_proof=proof-secret` } }, { status: 400 }) }, async (h) => {
  const result = await preflight(h); assert.equal(result.status, "blocked");
  const output = JSON.stringify([result, h.logs]);
  assert.doesNotMatch(output, /secret-user-token|secret-app-secret|page-secret|proof-secret|access_token|appsecret_proof|graph.facebook.com/);
  assert.ok(result.issues.some((x) => x.code === "asset_unavailable"));
}));

test("revoked access is blocked", async () => withHarness({ meta: () => Response.json({ error: { code: 190, message: TOKEN } }, { status: 401 }) }, async (h) => {
  const result = await preflight(h); assert.equal(result.status, "blocked"); assert.ok(result.issues.some((x) => x.code === "access_denied"));
}));

test("a readable public page is insufficient without access-list membership", async () => withHarness({ meta: (url) => url.pathname.endsWith("/me/accounts") ? Response.json({ data: [] }) : defaultMeta(url) }, async (h) => {
  const result = await preflight(h); assert.equal(result.status, "blocked"); assert.equal(result.checks.facebookAccessOk, false); assert.equal(result.checks.instagramAccessOk, false);
}));

test("individually accessible FB and IG with a different association block", async () => withHarness({ meta: (url) => url.pathname.endsWith("/101") ? Response.json({ id: "101", name: "Detection", instagram_business_account: { id: "202" } }) : defaultMeta(url) }, async (h) => {
  const result = await preflight(h); assert.equal(result.status, "blocked"); assert.equal(result.checks.instagramLinkedToFacebook, false);
}));

test("a renamed account is a warning while matching immutable IDs remain accessible", async () => withHarness({ meta: (url) => url.pathname.endsWith("/201") ? Response.json({ id: "201", username: "new.name" }) : defaultMeta(url) }, async (h) => {
  const result = await preflight(h); assert.equal(result.status, "warning"); assert.equal(result.checks.instagramAssetMatches, false);
  assert.equal(result.checks.instagramAccessOk, true); assert.ok(result.issues.some((x) => x.code === "asset_username_changed"));
}));

test("cross-client collisions warn and only expose allowed internal association fields", async () => withHarness({ collisions: [{ client_account_id: "client-b", client_name: "Cliente B", destination_id: "dest-b", destination_name: "Compartilhado", facebook_page_id: "101", instagram_account_id: "201", access_token: TOKEN }] }, async (h) => {
  const result = await preflight(h); assert.equal(result.status, "warning"); assert.equal(result.checks.noCrossClientCollision, false);
  assert.equal(result.collisions.length, 2); assert.ok(result.issues.some((x) => x.code === "asset_linked_to_multiple_clients"));
  assert.doesNotMatch(JSON.stringify(result), /access_token|secret-user-token/);
  const audit = h.sqlCalls.find(({ sql }) => sql.includes("UNION ALL"))!;
  assert.match(audit.sql, /client_meta_assets/); assert.match(audit.sql, /client_account_id <> \?/);
  assert.deepEqual(audit.params, ["client-a", "101", "101", "201", "201", "client-a", "101", "101", "201", "201"]);
}));

test("pagination reconstructs an allowed Graph GET without following sensitive next URLs", async () => withHarness({ meta: (url) => url.pathname.endsWith("/me/accounts") ? url.searchParams.get("after") ? Response.json({ data: [{ id: "101", instagram_business_account: { id: "201" } }] }) : Response.json({ data: [], paging: { next: `https://untrusted.invalid/publish?access_token=${TOKEN}`, cursors: { after: "page2" } } }) : defaultMeta(url) }, async (h) => {
  const result = await preflight(h); assert.equal(result.status, "safe");
  assert.equal(h.requests.filter(({ url }) => url.pathname.endsWith("/me/accounts")).length, 2);
}));

test("incomplete pagination never reports safe", async () => withHarness({ meta: (url) => url.pathname.endsWith("/me/accounts") ? Response.json({ data: [{ id: "101", instagram_business_account: { id: "201" } }], paging: { next: "anything" } }) : defaultMeta(url) }, async (h) => {
  const result = await preflight(h); assert.equal(result.status, "blocked"); assert.equal(result.checks.facebookAccessOk, null);
}));

for (const scenario of [{ connection: false }, { expired: true }]) test("missing or expired connection blocks with no network request", async () => withHarness(scenario, async (h) => {
  assert.equal((await preflight(h)).status, "blocked"); assert.equal(h.requests.length, 0);
}));

test("Facebook-only and Instagram-only destinations omit unconfigured checks", async () => {
  await withHarness({ destinations: [destinationRow({ instagram_account_id: null, instagram_username: null })] }, async (h) => { const r = await preflight(h); assert.equal(r.status, "safe"); assert.equal(r.checks.instagramAccessOk, null); });
  await withHarness({ destinations: [destinationRow({ facebook_page_id: null, facebook_page_name: null })] }, async (h) => { const r = await preflight(h); assert.equal(r.status, "safe"); assert.equal(r.checks.facebookAccessOk, null); });
});

test("correct scheduling persists the database destination name and exact asset IDs without publishing", async () => withHarness({}, async (h) => {
  const result = await scheduleMetaCardPublications(h.app, scheduleInput({ platforms: [{ platform: "instagram", metaAssetId: "201" }, { platform: "facebook", metaAssetId: "101" }] }));
  assert.equal(result.length, 2); assert.equal(h.writes.length, 2); assert.equal(h.requests.length, 0);
  assert.deepEqual(h.writes.map((x) => [x.params[1], x.params[3], x.params[4], x.params[5], x.params[6]]), [["client-a", "dest-a", "Detection", "instagram", "201"], ["client-a", "dest-a", "Detection", "facebook", "101"]]);
}));

test("legacy scheduling validates legacy saved IDs", async () => withHarness({}, async (h) => {
  assert.equal((await validateMetaSchedulingRouting(h.app, scheduleInput({ destinationId: null }))).destinationName, null);
  await assert.rejects(validateMetaSchedulingRouting(h.app, scheduleInput({ destinationId: null, platforms: [{ platform: "facebook", metaAssetId: "999" }] })), /Facebook/);
}));

test("endpoint requires super_admin, validates query, and only performs read operations", async () => withHarness({}, async (h) => {
  const app = Fastify(); app.decorate("db", h.app.db); app.decorate("appEnv", h.app.appEnv);
  await app.register(httpErrorsPluginRegistered); app.decorateRequest("auth", null);
  app.addHook("preHandler", async (request) => {
    const role = request.headers["x-test-role"];
    if (role) request.auth = { user: { id: "user-a", fullName: "Test", email: "test@example.invalid", globalRole: role as "super_admin", avatarUrl: null, locale: "pt", isActive: true }, memberships: [] };
  });
  await app.register(metaRoutes, { prefix: "/api" });
  try {
    const url = "/api/meta/preflight?clientAccountId=client-a&destinationId=dest-a&cardId=card-a";
    assert.equal((await app.inject({ method: "GET", url })).statusCode, 401);
    for (const role of ["admin", "colaborador", "cliente"]) assert.equal((await app.inject({ method: "GET", url, headers: { "x-test-role": role } })).statusCode, 403);
    assert.equal(h.sqlCalls.length, 0); assert.equal(h.requests.length, 0);
    assert.equal((await app.inject({ method: "GET", url: "/api/meta/preflight", headers: { "x-test-role": "super_admin" } })).statusCode, 400);
    const response = await app.inject({ method: "GET", url, headers: { "x-test-role": "super_admin" } });
    assert.equal(response.statusCode, 200); assert.equal(response.json().status, "safe");
    assert.equal(h.writes.length, 0); assert.ok(h.sqlCalls.every(({ sql }) => sql.startsWith("SELECT")));
    assert.doesNotMatch(response.body, /secret-user-token|secret-app-secret|access_token|appsecret_proof|graph.facebook.com/);
    assert.equal((await app.inject({ method: "POST", url, headers: { "x-test-role": "super_admin" } })).statusCode, 404);
  } finally { await app.close(); }
}));

test("network failures never leak thrown errors or credentials", async () => withHarness({ meta: () => { throw new Error(`${TOKEN} ${SECRET} appsecret_proof=secret-proof`); } }, async (h) => {
  const result = await preflight(h); assert.equal(result.status, "blocked");
  assert.ok(result.issues.some((x) => x.code === "meta_read_failed"));
  assert.doesNotMatch(JSON.stringify([result, h.logs]), /secret-user-token|secret-app-secret|secret-proof|appsecret_proof/);
}));

test("malformed JSON and null account-list entries cannot produce a safe result", async () => withHarness({ meta: (url) => url.pathname.endsWith("/me/accounts") ? Response.json({ data: [null] }) : new Response("invalid", { status: 200 }) }, async (h) => {
  assert.equal((await preflight(h)).status, "blocked");
}));

test("a returned asset ID differing from the saved ID blocks", async () => withHarness({ meta: (url) => url.pathname.endsWith("/201") ? Response.json({ id: "999", username: "detection" }) : defaultMeta(url) }, async (h) => {
  const result = await preflight(h); assert.equal(result.status, "blocked"); assert.equal(result.checks.instagramAssetMatches, false);
}));
