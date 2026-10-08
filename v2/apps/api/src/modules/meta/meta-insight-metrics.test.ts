import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { Pool } from "mysql2/promise";
import { followerGrowth, metricFailureDetails, metricStatus, parseInsightNumber, parseInstagramFollowerGrowth, safeInsightsDiagnostics } from "./meta-insight-metrics.js";
import { getMetaInsights } from "./meta.service.js";
import { metaRoutes } from "./meta.routes.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { createReportSchema } from "../reports/reports.schemas.js";

const breakdown = (follows?: unknown, unfollows?: unknown) => ({ breakdowns: [{ dimension_keys: ["follow_type"], results: [...(follows === undefined ? [] : [{ dimension_values: ["follows"], value: follows }]), ...(unfollows === undefined ? [] : [{ dimension_values: ["unfollows"], value: unfollows }])] }] });
const ig = (total: unknown) => ({ data: [{ name: "follows_and_unfollows", total_value: total }] });
const scalar = (name: string, values: unknown[]) => ({ data: [{ name, values: values.map(value => ({ value })) }] });

test("IG aggregates follows and unfollows and calculates net", () => assert.deepEqual(parseInstagramFollowerGrowth(ig(breakdown(12, 3))), followerGrowth(12, 3)));
test("IG missing unfollows stays null including net", () => assert.deepEqual(parseInstagramFollowerGrowth(ig(breakdown(12))), followerGrowth(12, null)));
test("IG missing follows stays null including net", () => assert.deepEqual(parseInstagramFollowerGrowth(ig(breakdown(undefined, 3))), followerGrowth(null, 3)));
test("IG daily breakdowns sum each direction once", () => assert.deepEqual(parseInstagramFollowerGrowth({ data: [{ name: "follows_and_unfollows", values: [{ value: breakdown(4, 2) }, { value: breakdown(8, 1) }] }] }), followerGrowth(12, 3)));
test("IG daily named values and negative net", () => assert.deepEqual(parseInstagramFollowerGrowth({ data: [{ name: "follows_and_unfollows", values: [{ value: { follows: 1, unfollows: 3 } }] }] }), followerGrowth(1, 3)));
test("IG prefers aggregate over daily values without double counting", () => assert.deepEqual(parseInstagramFollowerGrowth({ data: [{ name: "follows_and_unfollows", total_value: breakdown(3, 1), values: [{ value: breakdown(3, 1) }] }] }), followerGrowth(3, 1)));
for (const [name, payload] of Object.entries({ empty: { data: [] }, unsupported: { error: { code: 100 } }, apiError: { error: { code: 2 } }, malformed: { data: {} }, unexpected: ig({ value: 10 }), string: ig(breakdown("12", 3)), infinite: ig(breakdown(Infinity, 3)) })) test(`IG ${name} does not invent missing follows`, () => assert.equal(parseInstagramFollowerGrowth(payload).followersGained, null));
test("IG partial daily observations cannot produce partial totals", () => assert.equal(parseInstagramFollowerGrowth({ data: [{ name: "follows_and_unfollows", values: [{ value: breakdown(2, 1) }, { value: breakdown(3) }] }] }).followersLost, null));
test("Facebook follows and unfollows use daily values", () => { assert.equal(parseInsightNumber(scalar("page_daily_follows_unique", [2, 4]), "page_daily_follows_unique"), 6); assert.equal(parseInsightNumber(scalar("page_daily_unfollows_unique", [1, 3]), "page_daily_unfollows_unique"), 4); });
test("Facebook follower total uses last snapshot rather than sum", () => assert.equal(parseInsightNumber(scalar("page_follows", [180, 184]), "page_follows", "last"), 184));
test("Facebook empty and malformed observations stay null", () => { for (const values of [[], [null], [2, undefined], ["3"]]) assert.equal(parseInsightNumber(scalar("x", values), "x"), null); });
test("semantic statuses distinguish invalid metrics, permissions, errors and empty", () => { assert.equal(metricStatus({ code: 100, message: "The value must be a valid insights metric" }, null), "invalid_metric"); assert.equal(metricStatus({ code: 100, message: "invalid date" }, null), "api_error"); assert.equal(metricStatus({ code: 200 }, null), "permission_error"); assert.equal(metricStatus(null, null), "empty"); assert.equal(metricStatus(null, 0), "available"); });

const TOKEN = "token-should-never-leak", SECRET = "secret-should-never-leak", KEY = Buffer.alloc(32, 7);
function encryptedToken() { const iv = Buffer.alloc(12, 8); const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv); const ciphertext = Buffer.concat([cipher.update(TOKEN), cipher.final()]); return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join("."); }
const env = { META_APP_ID: "app", META_APP_SECRET: SECRET, META_REDIRECT_URI: "https://example.invalid/callback", META_TOKEN_ENCRYPTION_KEY: KEY.toString("base64") };
function harness() {
  const logs: unknown[] = [], requests: URL[] = [];
  const db = { async query(sql: string) {
    if (sql.includes("FROM meta_connections")) return [[{ access_token_encrypted: encryptedToken(), token_expires_at: null, meta_user_id: "owner" }], []];
    if (sql.includes("LEFT JOIN client_meta_assets")) return [[{ facebook_page_id: "page", facebook_page_name: "Page", instagram_account_id: "ig", instagram_username: "test" }], []];
    if (sql.includes("FROM client_accounts")) return [[{ id: "client", name: "Test", slug: "test", is_active: 1 }], []];
    if (sql.includes("FROM meta_publish_destinations")) return [[], []];
    if (sql.includes("FROM client_meta_assets")) return [[{ facebook_page_id: "page", facebook_page_name: "Page", instagram_account_id: "ig", instagram_username: "test" }], []];
    throw Error("Unexpected SQL");
  } } as unknown as Pool;
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input)); requests.push(url);
    const metric = url.searchParams.get("metric");
    if (url.pathname === "/v26.0/page" && url.searchParams.get("fields") === "id,name,access_token") return Response.json({ id: "page", name: "Page", access_token: TOKEN });
    if (url.pathname === "/v26.0/page" && url.searchParams.get("fields") === "followers_count") return Response.json({ followers_count: 184 });
    if (url.pathname === "/v26.0/page") return Response.json({ fan_count: 99 });
    if (url.pathname === "/v26.0/ig") return Response.json({ followers_count: 100 });
    if (metric === "follows_and_unfollows") return Response.json(ig(breakdown(12, 3)));
    if (metric === "page_daily_unfollows_unique") return Response.json({ error: { code: 100, message: `invalid metric ${TOKEN} ${SECRET} https://graph.facebook.com/?access_token=${TOKEN}` } }, { status: 400 });
    if (metric === "page_follows") return Response.json(scalar(metric, [180, 182]));
    if (metric) return Response.json(scalar(metric, [2, 4]));
    return Response.json({ data: [] });
  };
  const log = { info(...args: unknown[]) { logs.push(args); }, warn(...args: unknown[]) { logs.push(args); }, error(...args: unknown[]) { logs.push(args); } };
  return { db, log, fetchImpl, requests, logs };
}
async function runInsights(change?: (url: URL) => Response | undefined, linked = { instagram: true, facebook: true }, period = { since: "2026-09-01", until: "2026-09-30" }) {
  const h = harness(), original = globalThis.fetch;
  globalThis.fetch = async (input, init) => change?.(new URL(String(input))) ?? h.fetchImpl(input, init);
  try { const result = await getMetaInsights({ db: h.db, log: h.log, appEnv: env } as unknown as FastifyInstance, "owner", { facebookPageId: linked.facebook ? "page" : null, facebookPageName: "Page", instagramAccountId: linked.instagram ? "ig" : null, instagramUsername: "test" }, period); return { h, result }; } finally { globalThis.fetch = original; }
}
test("report survives a failed Facebook metric and exposes safe diagnostics", async () => {
  const { h, result } = await runInsights();
  assert.equal(result.facebook?.metrics.followersGained, 6); assert.equal(result.facebook?.metrics.followersLost, null); assert.equal(result.facebook?.metrics.followersNet, null);
  assert.equal(result.facebook?.metrics.followers, 184); assert.equal(result.facebook?.metrics.views, 6); assert.equal(result.facebook?.metrics.engagement, 6);
  assert.equal(result.instagram?.metrics.followersNet, 9); assert.equal(result.sources.facebook, "partial");
  assert.equal(result.facebook?.metricMetadata.followersLost.status, "invalid_metric");
  assert.equal(h.requests.find(url => url.searchParams.get("metric") === "follows_and_unfollows")?.searchParams.get("breakdown"), "follow_type");
  const diagnostics = safeInsightsDiagnostics(result); assert.deepEqual(diagnostics.find(item => item.metric === "follows_and_unfollows")?.values, { follows: 12, unfollows: 3 });
  const safe = JSON.stringify(diagnostics); assert.doesNotMatch(safe, new RegExp(`${TOKEN}|${SECRET}|https:|access_token|appsecret_proof`)); assert.doesNotMatch(JSON.stringify(h.logs), new RegExp(`${TOKEN}|${SECRET}`));
});
test("Facebook falls back to latest follower snapshot, never fan count", async () => {
  const { result } = await runInsights(url => url.searchParams.get("fields") === "followers_count" ? Response.json({ error: { code: 200 } }, { status: 403 }) : undefined);
  assert.equal(result.facebook?.metrics.followers, 182); assert.equal(result.facebook?.metricMetadata.followers.source, "page_follows");
});
test("Facebook does not turn likes into followers when both follower sources fail", async () => {
  const { result } = await runInsights(url => url.searchParams.get("fields") === "followers_count" || url.searchParams.get("metric") === "page_follows" ? Response.json({ error: { code: 200 } }, { status: 403 }) : undefined);
  assert.equal(result.facebook?.metrics.followers, null); assert.equal(result.facebook?.metrics.fans, 99);
});
test("IG unsupported growth does not break remaining insights", async () => {
  const { result } = await runInsights(url => url.searchParams.get("metric") === "follows_and_unfollows" ? Response.json({ error: { code: 100, message: "invalid metric" } }, { status: 400 }) : undefined);
  assert.equal(result.instagram?.metrics.followersGained, null); assert.equal(result.instagram?.metrics.views, 6); assert.equal(result.instagram?.metricMetadata.followersGained.status, "invalid_metric");
});
test("IG API error is isolated", async () => {
  const { result } = await runInsights(url => url.searchParams.get("metric") === "follows_and_unfollows" ? Response.json({ error: { code: 2 } }, { status: 500 }) : undefined);
  assert.equal(result.instagram?.metrics.followersNet, null); assert.equal(result.instagram?.metricMetadata.followersNet.status, "api_error");
});
test("report schema persists growth/status and accepts legacy reports and negative net", () => {
  const channel = { reach: null, impressions: null, engagement: null, followers: 184, visits: null, clicks: null };
  const input = { title: "Report", periodStart: "2026-09-01", periodEnd: "2026-09-30", metrics: { instagram: channel, facebook: { ...channel, ...followerGrowth(1, 3) } } };
  assert.equal(createReportSchema.parse(input).metrics.facebook.followersNet, -2);
});
test("debug endpoint denies anonymous and non-super-admin before accessing data", async () => {
  const app = Fastify(); await app.register(httpErrorsPluginRegistered);
  app.addHook("preHandler", async request => { if (request.headers["x-role"]) request.auth = { user: { id: "user", globalRole: request.headers["x-role"] }, memberships: [] } as unknown as typeof request.auth; });
  await app.register(metaRoutes, { prefix: "/api" });
  try { for (const [role, expected] of [[undefined, 401], ["admin", 403], ["colaborador", 403], ["cliente", 403], ["super_admin", 400]] as const) assert.equal((await app.inject({ method: "GET", url: "/api/meta/insights/debug", headers: role ? { "x-role": role } : {} })).statusCode, expected); } finally { await app.close(); }
});
test("super-admin debug endpoint returns only safe metric metadata", async () => {
  const h = harness(), original = globalThis.fetch; globalThis.fetch = h.fetchImpl;
  const app = Fastify(); await app.register(httpErrorsPluginRegistered); app.decorate("db", h.db); app.decorate("appEnv", env as FastifyInstance["appEnv"]);
  app.addHook("preHandler", async request => { request.auth = { user: { id: "owner", globalRole: "super_admin" }, memberships: [] } as unknown as typeof request.auth; });
  await app.register(metaRoutes, { prefix: "/api" });
  try { const response = await app.inject({ method: "GET", url: "/api/meta/insights/debug?clientAccountId=client&since=2026-09-01&until=2026-09-30" }); assert.equal(response.statusCode, 200, response.body); assert.ok(response.json().metrics.length); assert.doesNotMatch(response.body, new RegExp(`${TOKEN}|${SECRET}|access_token|appsecret_proof|https:`)); } finally { globalThis.fetch = original; await app.close(); }
});

test("IG FOLLOWER/NON_FOLLOWER buckets are recognized only on growth metric", () => {
  assert.deepEqual(parseInstagramFollowerGrowth(ig({ breakdowns: [{ dimension_keys: ["follow_type"], results: [{ dimension_values: ["FOLLOWER"], value: 12 }, { dimension_values: ["NON_FOLLOWER"], value: 3 }] }] })), followerGrowth(12, 3));
});
test("IG wrong dimensions or duplicate buckets are not summed", () => {
  assert.equal(parseInstagramFollowerGrowth(ig({ breakdowns: [{ dimension_keys: ["audience"], results: [{ dimension_values: ["follows"], value: 12 }] }] })).followersGained, null);
  const duplicate = breakdown(2, 1); duplicate.breakdowns[0].results.push({ dimension_values: ["follows"], value: 3 });
  assert.equal(parseInstagramFollowerGrowth(ig(duplicate)).followersGained, null);
});
test("Facebook fallback current snapshot does not use historical report dates", async () => {
  const { h } = await runInsights(); const request = h.requests.find(url => url.searchParams.get("metric") === "page_follows")!;
  assert.notEqual(request.searchParams.get("since"), "2026-09-01");
});

test("unexpected error codes cannot leak strings into diagnostics or logs", async () => {
  const { result, h } = await runInsights(url => url.searchParams.get("metric") === "page_daily_follows_unique" ? Response.json({ error: { code: TOKEN, message: SECRET } }, { status: 400 }) : undefined);
  assert.equal(result.facebook?.metricMetadata.followersGained.code, null);
  assert.doesNotMatch(JSON.stringify(safeInsightsDiagnostics(result)), new RegExp(`${TOKEN}|${SECRET}`));
  assert.doesNotMatch(JSON.stringify(h.logs), new RegExp(`${TOKEN}|${SECRET}`));
});

test("Facebook rejected post metric does not hide supported post views", async () => {
  const { result } = await runInsights(url => url.pathname.endsWith("/posts") ? Response.json({ data: [{ id: "post", reactions: { summary: { total_count: 10 } } }] }) : url.searchParams.get("metric") === "post_clicks" ? Response.json({ error: { code: 100, message: "invalid metric" } }, { status: 400 }) : undefined);
  assert.equal(result.facebook?.topContent[0].views, 6);
  assert.equal(result.facebook?.topContent[0].clicks, null);
});

test("Instagram-only clients do not query Facebook", async () => {
  const { result, h } = await runInsights(undefined, { instagram: true, facebook: false });
  assert.equal(result.facebook, null); assert.equal(result.sources.facebook, "not_linked"); assert.equal(result.instagram?.metrics.followersNet, 9);
  assert.equal(h.requests.some(url => url.pathname.includes("/page")), false);
});
test("Facebook-only clients do not query Instagram", async () => {
  const { result, h } = await runInsights(undefined, { instagram: false, facebook: true });
  assert.equal(result.instagram, null); assert.equal(result.sources.instagram, "not_linked"); assert.equal(result.facebook?.metrics.followers, 184);
  assert.equal(h.requests.some(url => url.pathname.includes("/ig")), false);
});
test("empty growth periods remain null without hiding known current followers", async () => {
  const { result } = await runInsights(url => ["follows_and_unfollows", "page_daily_follows_unique", "page_daily_unfollows_unique"].includes(url.searchParams.get("metric") ?? "") ? Response.json({ data: [] }) : undefined);
  assert.equal(result.instagram?.metrics.followersNet, null); assert.equal(result.facebook?.metrics.followersNet, null); assert.equal(result.facebook?.metrics.followers, 184);
  assert.equal(result.instagram?.metricMetadata.followersGained.status, "empty"); assert.equal(result.facebook?.metricMetadata.followersLost.status, "empty");
});


test("Instagram accepts exactly 30 elapsed UTC days and imports insights normally", async () => {
  const { result, h } = await runInsights(undefined, { instagram: true, facebook: false }, { since: "2026-09-01", until: "2026-10-01" });
  assert.equal(result.instagram?.metrics.reach, 6);
  assert.equal(result.instagram?.metrics.followers, 100);
  assert.equal(result.instagram?.metrics.followersNet, 9);
  assert.equal(h.requests.filter(url => url.pathname === "/v26.0/ig/insights").length, 7);
});

test("Instagram over 30 days fails before any Meta request, including follower snapshot", async () => {
  const h = harness(), original = globalThis.fetch;
  globalThis.fetch = h.fetchImpl;
  try {
    for (const until of ["2026-10-02", "2026-10-07"]) await assert.rejects(getMetaInsights({ db: h.db, appEnv: env } as unknown as FastifyInstance, "owner", {
      instagramAccountId: "ig", instagramUsername: "test", facebookPageId: "page", facebookPageName: "Page",
    }, { since: "2026-09-01", until }), error => {
      assert.equal((error as { code: string }).code, "INSTAGRAM_INSIGHTS_PERIOD_TOO_LONG");
      assert.equal((error as { statusCode: number }).statusCode, 400);
      assert.match((error as Error).message, /até 30 dias.*Ajuste as datas/);
      return true;
    });
    assert.equal(h.requests.length, 0);
  } finally { globalThis.fetch = original; }
});

test("Facebook-only imports retain support for periods over 30 days", async () => {
  const { result, h } = await runInsights(undefined, { instagram: false, facebook: true }, { since: "2026-09-01", until: "2026-10-07" });
  assert.equal(result.instagram, null);
  assert.equal(result.facebook?.metrics.reach, 6);
  assert.ok(h.requests.some(url => url.pathname === "/v26.0/page/insights" && url.searchParams.get("until") === "2026-10-07"));
});

test("Meta #100 for a long period retains compatible status and safe structured reason", async () => {
  const warning = { code: 100, message: "The difference between since and until must not exceed 30 days" };
  assert.equal(metricStatus(warning, null), "api_error");
  assert.deepEqual(metricFailureDetails(warning), { reason: "period_too_long" });
  assert.deepEqual(metricFailureDetails({ code: 100, message: "The interval between since and until must be less than 2592000 seconds" }), { reason: "period_too_long" });
  assert.deepEqual(metricFailureDetails({ code: 100, message: "invalid metric" }), {});
  assert.deepEqual(metricFailureDetails({ code: 200, message: warning.message }), {});
  const { result } = await runInsights(url => url.searchParams.get("metric") === "reach" && url.pathname === "/v26.0/ig/insights" ? Response.json({ error: warning }, { status: 400 }) : undefined);
  assert.equal(safeInsightsDiagnostics(result).find(item => item.platform === "instagram" && item.metric === "reach")?.reason, "period_too_long");
});

test("import and debug endpoints return a structured 400 without Meta calls for a long Instagram period", async () => {
  const h = harness(), original = globalThis.fetch; globalThis.fetch = h.fetchImpl;
  const app = Fastify(); await app.register(httpErrorsPluginRegistered); app.decorate("db", h.db); app.decorate("appEnv", env as FastifyInstance["appEnv"]);
  app.addHook("preHandler", async request => { request.auth = { user: { id: "owner", globalRole: "super_admin" }, memberships: [] } as unknown as typeof request.auth; });
  await app.register(metaRoutes, { prefix: "/api" });
  try {
    for (const path of ["/api/meta/insights/debug?clientAccountId=client&", "/api/clients/client/meta-insights?"]) {
      const response = await app.inject({ method: "GET", url: path + "since=2026-09-01&until=2026-10-07" });
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().code, "INSTAGRAM_INSIGHTS_PERIOD_TOO_LONG");
      assert.match(response.json().message, /Ajuste as datas/);
    }
    assert.equal(h.requests.length, 0);
  } finally { globalThis.fetch = original; await app.close(); }
});

test("report storage accepts periods over 30 days and optional diagnostic reason", () => {
  const channel = { reach: null, impressions: null, engagement: null, followers: 830, visits: null, clicks: null,
    metricMetadata: { reach: { status: "api_error", reason: "period_too_long", source: "reach", aggregation: "period_total", code: 100, structure: { entries: 0, dailyValues: 0, totalValue: false, breakdowns: 0 } } } };
  const parsed = createReportSchema.parse({ title: "Long report", periodStart: "2026-09-01", periodEnd: "2026-10-07", metrics: { instagram: channel, facebook: channel } });
  assert.equal(parsed.periodEnd, "2026-10-07");
  assert.equal(parsed.metrics.instagram.metricMetadata?.reach.reason, "period_too_long");
});
