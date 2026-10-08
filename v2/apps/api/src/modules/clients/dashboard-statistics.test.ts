import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool } from "mysql2/promise";
import type { FastifyInstance } from "fastify";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { clientRoutes } from "./clients.routes.js";
import { calculateDashboardStatistics, classifyDashboardPost, loadDashboardStatistics, type DashboardPost, type DashboardMetaPost } from "./dashboard-statistics.js";

const options = { now: new Date("2026-10-15T12:00:00Z"), timeZone: "Europe/Stockholm" };
const card = (overrides: Partial<DashboardPost> & { createdAt?: string } = {}): DashboardPost => ({
  id: "a", clientAccountId: "client-a", isBriefApproval: false, artType: "single_post", mediaType: "image", archived: false,
  legacyId: null, scheduledAt: null, scheduledTimeZone: "Europe/Stockholm", publishedAt: null,
  deadlineAt: "2026-10-15 00:00:00", calendarDate: null, calendarTime: null, calendarTimeZone: null, ...overrides,
});
const meta = (overrides: Partial<DashboardMetaPost> & { platform?: string } = {}): DashboardMetaPost => ({ cardId: "a", clientAccountId: "client-a", status: "scheduled", scheduledAt: "2026-10-15T10:00:00Z", publishedAt: null, ...overrides });
const count = (cards: DashboardPost[], publications: DashboardMetaPost[] = []) => calculateDashboardStatistics(cards, publications, options);
function assertCounts(result: ReturnType<typeof count>, expected: [number, number, number]) {
  assert.deepEqual([result.pending, result.scheduled, result.published], expected);
  assert.equal(result.postsThisMonth, expected.reduce((a, b) => a + b, 0));
  assert.equal(result.postsThisMonth, result.pending + result.scheduled + result.published);
}

test("post planned for this month without a valid schedule is pending", () => assertCounts(count([card()]), [1, 0, 0]));
test("created last month but planned for this month counts", () => assertCounts(count([card({ createdAt: "2026-09-05T12:00:00Z" })]), [1, 0, 0]));
test("created this month but planned for next month does not count", () => assertCounts(count([card({ createdAt: "2026-10-05T12:00:00Z", deadlineAt: "2026-11-15 00:00:00" })]), [0, 0, 0]));
test("internal scheduling is scheduled", () => assertCounts(count([card({ scheduledAt: "2026-10-16 14:30:00" })]), [0, 1, 0]));
test("Meta scheduled and publishing are valid schedules", () => {
  for (const status of ["scheduled", "publishing"] as const) assertCounts(count([card()], [meta({ status })]), [0, 1, 0]);
});
test("Instagram and Facebook schedules count one card", () => assertCounts(count([card()], [meta({ platform: "instagram" }), meta({ platform: "facebook" })]), [0, 1, 0]));
test("internal and both Meta schedules count one card", () => assertCounts(count([card({ scheduledAt: "2026-10-16 12:00:00" })], [meta(), meta()]), [0, 1, 0]));
test("internal publication is published", () => assertCounts(count([card({ publishedAt: "2026-10-14 12:00:00" })]), [0, 0, 1]));
test("Meta published marks the card published even without internal publication", () => assertCounts(count([card()], [meta({ status: "published", publishedAt: "2026-10-15T10:05:00Z" })]), [0, 0, 1]));
test("both Meta channels published count one post", () => assertCounts(count([card()], [meta({ status: "published" }), meta({ status: "published" })]), [0, 0, 1]));
test("published prevails over internal and Meta schedules", () => assertCounts(count([card({ scheduledAt: "2026-10-15 12:00:00" })], [meta({ status: "published" }), meta({ status: "scheduled" })]), [0, 0, 1]));
test("pautas and briefs never count", () => assertCounts(count([card({ id: "pauta", isBriefApproval: true }), card({ id: "brief", artType: "brief" }), card({ id: "design-brief", mediaType: "design_brief" })]), [0, 0, 0]));
test("archived historical cards and legacy records outside this month do not count", () => assertCounts(count([card({ archived: true, legacyId: "legacy" }), card({ id: "old", legacyId: "legacy-old", publishedAt: "2025-10-15 12:00:00" })]), [0, 0, 0]));
test("archived internal publications of this month remain concluded work", () => assertCounts(count([card({ archived: true, publishedAt: "2026-10-10 12:00:00" })]), [0, 0, 1]));
test("archived records with real Meta publications or active schedules remain operational", () => {
  assertCounts(count([card({ archived: true })], [meta({ status: "published" })]), [0, 0, 1]);
  assertCounts(count([card({ archived: true })], [meta()]), [0, 1, 0]);
  assertCounts(count([card({ archived: true, scheduledAt: "2026-10-15 12:00:00" })]), [0, 0, 0]);
});
test("legacy cards reused in current work are not excluded just because they were imported", () => assertCounts(count([card({ legacyId: "imported", scheduledAt: "2026-10-15 12:00:00" })]), [0, 1, 0]));
test("every valid card has one prioritized state and total equals the partition", () => {
  const cards = [card({ id: "pending" }), card({ id: "scheduled", scheduledAt: "2026-10-15 12:00:00" }), card({ id: "published", scheduledAt: "2026-10-15 12:00:00", publishedAt: "2026-10-15 12:00:00" })];
  assertCounts(count(cards.concat(cards), [meta({ cardId: "published", status: "published" }), meta({ cardId: "published", status: "scheduled" })]), [1, 1, 1]);
});
test("date precedence is internal publication, internal schedule, Meta, deadline, calendar", () => {
  const candidates = [meta({ scheduledAt: "2026-09-20T12:00:00Z" })];
  assert.equal(classifyDashboardPost(card({ publishedAt: "2026-10-15 12:00:00", scheduledAt: "2026-11-15 12:00:00" }), candidates, options.timeZone)?.source, "internal_published");
  assert.equal(classifyDashboardPost(card({ scheduledAt: "2026-10-15 12:00:00" }), candidates, options.timeZone)?.source, "internal_scheduled");
  assertCounts(count([card({ scheduledAt: "2026-11-15 12:00:00" })], [meta()]), [0, 0, 0]);
  assertCounts(count([card()], candidates), [0, 0, 0]);
  assert.equal(classifyDashboardPost(card(), [], options.timeZone)?.source, "deadline");
  assert.equal(classifyDashboardPost(card({ deadlineAt: null, calendarDate: "2026-10-15" }), [], options.timeZone)?.source, "calendar");
});
test("calendar fallback positions undated posts without treating approval as scheduling", () => assertCounts(count([card({ deadlineAt: null, calendarDate: "2026-10-15" })]), [1, 0, 0]));
test("cards without operational dates do not fall back to creation time", () => assertCounts(count([card({ createdAt: "2026-10-01T12:00:00Z", deadlineAt: null })]), [0, 0, 0]));
test("cancelled and failed Meta records do not constitute a valid schedule", () => {
  for (const status of ["cancelled", "failed"] as const) {
    assertCounts(count([card()], [meta({ status })]), [1, 0, 0]);
    assert.equal(classifyDashboardPost(card({ deadlineAt: null }), [meta({ status })], options.timeZone)?.source, "meta_previous_plan");
  }
});
test("cross-client or orphan Meta rows cannot classify a different client's card", () => assertCounts(count([card()], [meta({ clientAccountId: "client-b", status: "published" }), meta({ cardId: "missing", status: "scheduled" })]), [1, 0, 0]));
test("malformed internal dates are not valid schedules or publications", () => assertCounts(count([card({ scheduledAt: "invalid", publishedAt: "2026-13-01 12:00:00" })]), [1, 0, 0]));
test("the user's timezone determines the current month and Meta boundary", () => {
  const row = card({ deadlineAt: null }); const publications = [meta({ scheduledAt: "2026-09-30T23:30:00Z" })];
  const now = new Date("2026-09-30T23:45:00Z");
  const stockholm = calculateDashboardStatistics([row], publications, { now, timeZone: "Europe/Stockholm" });
  const brazil = calculateDashboardStatistics([row], publications, { now, timeZone: "America/Sao_Paulo" });
  assert.equal(stockholm.month, "2026-10"); assert.equal(brazil.month, "2026-09");
  assertCounts(stockholm, [0, 1, 0]); assertCounts(brazil, [0, 1, 0]);
});
test("internal wall clocks honor their saved timezone across month boundaries", () => {
  const row = card({ scheduledAt: "2026-10-01 00:30:00", scheduledTimeZone: "Europe/Stockholm" });
  assertCounts(calculateDashboardStatistics([row], [], { ...options, timeZone: "America/Sao_Paulo" }), [0, 0, 0]);
  assert.equal(classifyDashboardPost(row, [], "America/Sao_Paulo")?.operationalDate, "2026-09-30");
});
test("planned date-only deadlines keep their day in all user timezones", () => {
  for (const timeZone of ["America/Sao_Paulo", "Europe/Stockholm", "Pacific/Kiritimati"]) assert.equal(classifyDashboardPost(card({ deadlineAt: "2026-10-01 00:00:00" }), [], timeZone)?.operationalDate, "2026-10-01");
});
test("the same rules compute the previous month without an October tracking cutoff", () => {
  const result = count([card({ deadlineAt: "2026-09-15 00:00:00" }), card({ id: "old-published", publishedAt: "2026-09-20 12:00:00" })]);
  assert.equal(result.postsPreviousMonth, 2); assert.equal(result.publishedPreviousMonth, 1);
  assert.equal(calculateDashboardStatistics([card({ deadlineAt: "2026-01-10 00:00:00" })], [], { ...options, now: new Date("2026-02-01T12:00:00Z") }).postsPreviousMonth, 1);
});
test("calendar time is interpreted with its own saved timezone", () => assert.equal(classifyDashboardPost(card({ deadlineAt: null, calendarDate: "2026-10-01", calendarTime: "00:30:00", calendarTimeZone: "Europe/Stockholm" }), [], "America/Sao_Paulo")?.operationalDate, "2026-09-30"));
test("platform order does not affect canonical card date", () => {
  const items = [meta({ scheduledAt: "2026-10-20T12:00:00Z" }), meta({ scheduledAt: "2026-10-15T12:00:00Z" })];
  assert.deepEqual(classifyDashboardPost(card(), items, options.timeZone), classifyDashboardPost(card(), [...items].reverse(), options.timeZone));
});

test("repository scopes both reads, avoids channel fan-out and never selects created_at", async () => {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = { async query(sql: string, params: unknown[] = []) { queries.push({ sql, params }); return [sql.includes("AS calendarDate") ? [card()] : [meta(), meta()], []]; } } as unknown as Pool;
  assertCounts(await loadDashboardStatistics(db, ["client-a"], options), [0, 1, 0]);
  assert.equal(queries.length, 2);
  for (const query of queries) {
    assert.match(query.sql, /c\.client_account_id IN \(\?\)/); assert.equal(query.params[0], "client-a"); assert.equal(query.params.length, 11);
    assert.doesNotMatch(query.sql, /created_at|INSERT|UPDATE|DELETE/);
  }
  assert.match(queries[1]!.sql, /c\.client_account_id = p\.client_account_id/);
  assert.doesNotMatch(queries[0]!.sql, /JOIN meta_scheduled_publications/);
  queries.length = 0; assertCounts(await loadDashboardStatistics(db, [], options), [0, 0, 0]); assert.equal(queries.length, 0);
});

test("overview returns operational counters and user timezone while preserving widget payloads", async () => {
  const db = { async query(sql: string) {
    if (sql.startsWith("SHOW")) return [[{ Field: "present" }], []];
    if (!sql.startsWith("SELECT")) return [{ affectedRows: 0 }, []];
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit" }).format(new Date());
    if (sql.includes("AS calendarDate")) return [[card({ deadlineAt: `${month}-15 00:00:00` })], []];
    return [[], []];
  } } as unknown as Pool;
  const app = Fastify(); app.decorate("db", db); await app.register(httpErrorsPluginRegistered); app.decorateRequest("auth", null);
  app.addHook("preHandler", async (request) => { request.auth = { user: { id: "user-a", fullName: "Test", email: "test@example.invalid", globalRole: "super_admin", avatarUrl: null, locale: "pt", isActive: true }, memberships: [] }; });
  await app.register(clientRoutes, { prefix: "/api" });
  try {
    const response = await app.inject({ method: "GET", url: "/api/dashboard/overview?timeZone=Europe%2FStockholm" });
    assert.equal(response.statusCode, 200, response.body);
    const body = response.json(); assertCounts(body.statistics, [1, 0, 0]); assert.equal(body.statistics.timeZone, "Europe/Stockholm");
    assert.ok(Array.isArray(body.approvedPautas)); assert.ok(Array.isArray(body.upcomingPosts));
    assert.equal(body.statistics.approvedThisMonth, undefined); assert.equal(body.statistics.trackingStartsAt, undefined);
  } finally { await app.close(); }
});

test("a delayed Meta execution remains attached to its original planned month", () => {
  const result = count([card({ deadlineAt: null })], [meta({ status: "published", scheduledAt: "2026-10-31T12:00:00Z", publishedAt: "2026-11-01T12:00:00Z" })]);
  assertCounts(result, [0, 0, 1]);
  assert.equal(classifyDashboardPost(card({ deadlineAt: null }), [meta({ status: "published" })], options.timeZone)?.source, "meta_published");
});
test("imported publication timestamps without a saved timezone retain their UTC semantics", () => {
  const row = card({ legacyId: "legacy", scheduledTimeZone: null, publishedAt: "2026-09-30 23:30:00" });
  assert.equal(classifyDashboardPost(row, [], "Europe/Stockholm")?.operationalDate, "2026-10-01");
});
