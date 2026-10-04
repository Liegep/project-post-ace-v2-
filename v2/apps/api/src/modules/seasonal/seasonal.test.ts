import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import Fastify from "fastify";
import type { Pool } from "mysql2/promise";
import type { AuthContext } from "../auth/auth.types.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { SeasonalRepository } from "./seasonal.repository.js";
import { seasonalRoutes } from "./seasonal.routes.js";
import { opportunitySchema, radarQuerySchema } from "./seasonal.schemas.js";
import { createNagerLoader, normalizeNagerHoliday } from "./seasonal.nager.js";
import { loadRadar } from "./seasonal.service.js";
import { daysBetween, todayInZone, yearsInPeriod } from "./seasonal.dates.js";
import { ISO_COUNTRY_CODES, isIsoCountryCode } from "./iso-countries.js";

// Real persistence/repository/HTTP tests in an isolated SQLite DB. Translate only MySQL syntax.
// The proposed MySQL migration is also read directly, preserving its FK/unique/check constraints.
// MySQL deployment, driver and row-lock behaviour still require an approved staging DB run.
function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys = ON; CREATE TABLE users (id CHAR(36) PRIMARY KEY); CREATE TABLE client_accounts (id CHAR(36) PRIMARY KEY, name TEXT, slug TEXT);");
  sql.exec("INSERT INTO users VALUES ('admin'), ('other'); INSERT INTO client_accounts VALUES ('client-a', 'Cliente A', 'a'), ('client-b', 'Cliente B', 'b');");
  const migration = readFileSync(new URL("../../../../../database/migrations/20261004_seasonal_radar_foundation.sql", import.meta.url), "utf8");
  const translated = migration.replace(/--[^\n]*/g, "")
    .replace(/ CHARACTER SET ascii COLLATE ascii_bin/g, "")
    .replace(/\) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/g, ")")
    .replace(/UNIQUE KEY \w+ \(/g, "UNIQUE (")
    .replace(/^\s*KEY \w+ \([^\n]*\),\n/gm, "")
    .replace(/ ON UPDATE CURRENT_TIMESTAMP\(3\)/g, "")
    .replace(/CURRENT_TIMESTAMP\(3\)/g, "CURRENT_TIMESTAMP")
    .replace(/TIMESTAMP\(3\)/g, "TIMESTAMP")
    .replace(/SMALLINT UNSIGNED/g, "INTEGER")
    .replace(/YEAR\(occurrence_date\)/g, "CAST(strftime('%Y', occurrence_date) AS INTEGER)")
    .replace(/INSERT IGNORE/g, "INSERT OR IGNORE");
  sql.exec(translated); sql.exec(translated); // migration is additive and repeatable
  let failOccurrence = false;
  const statements: string[] = [];
  const query = async (statement: string, values: unknown[] = []) => {
    statements.push(statement);
    if (failOccurrence && statement.includes("INSERT INTO seasonal_occurrences")) throw new Error("simulated occurrence failure");
    let command = statement.replace(/ FOR UPDATE/g, "").replace(/CURRENT_TIMESTAMP\(3\)/g, "CURRENT_TIMESTAMP")
      .replace(/DATE_FORMAT\((\w+\.\w+), '%Y-%m-%d'\)/g, "$1");
    if (command.includes("ON DUPLICATE KEY UPDATE")) {
      const keys = command.includes("INSERT INTO client_editorial_markets") ? "workspace_id, client_account_id, country_code"
        : command.includes("INSERT INTO seasonal_categories") ? "workspace_id, code" : "workspace_id, country_code";
      command = command.replace("ON DUPLICATE KEY UPDATE", `ON CONFLICT (${keys}) DO UPDATE SET`).replace(/VALUES\((\w+)\)/g, "excluded.$1");
    }
    const prepared = sql.prepare(command);
    const args = values as Array<string | number | null>;
    if (/^\s*SELECT/i.test(command)) return [prepared.all(...args), []];
    return [{ affectedRows: Number(prepared.run(...args).changes) }, []];
  };
  const pool = { query, getConnection: async () => ({ query, beginTransaction: async () => { sql.exec("BEGIN"); }, commit: async () => { sql.exec("COMMIT"); }, rollback: async () => { sql.exec("ROLLBACK"); }, release: () => {} }) } as unknown as Pool;
  return { sql, pool, store: new SeasonalRepository(pool), statements, failOccurrence: () => { failOccurrence = true; }, close: () => sql.close() };
}
const noExternal = async () => ({ items: [], warnings: [] });
const period = { from: "2026-12-30", to: "2027-01-04", includeExternal: "false" };
const opportunity = (changes: Record<string, unknown> = {}) => opportunitySchema.parse({ title: "Oportunidade", categoryCode: "cultural", scope: "countries", countryCodes: ["BR", "SE"], occurrences: [{ date: "2027-01-01" }], ...changes });

test("complete ISO directory accepts countries without provider coverage, normalizes case and rejects non-ISO values", () => {
  assert.equal(ISO_COUNTRY_CODES.length, 249); assert.equal(new Set(ISO_COUNTRY_CODES).size, 249);
  assert.ok(isIsoCountryCode("AQ")); assert.ok(isIsoCountryCode("AX")); assert.ok(!isIsoCountryCode("ZZ")); assert.ok(!isIsoCountryCode("XK"));
  assert.deepEqual(opportunity({ countryCodes: ["br", "SE", "BR"] }).countryCodes, ["BR", "SE"]);
  assert.throws(() => opportunity({ countryCodes: ["BRA"] }));
});

test("one multipaís opportunity has two markets; distinct events on the same date remain distinct", async () => {
  const f = fixture();
  try {
    await f.store.setMonitoredCountry("BR", true); await f.store.setMonitoredCountry("SE", true);
    const first = await f.store.createOpportunity(opportunity()); const second = await f.store.createOpportunity(opportunity());
    assert.notEqual(first, second);
    assert.equal(f.sql.prepare("SELECT COUNT(*) AS count FROM seasonal_opportunities").get()!.count, 2);
    const result = await loadRadar(f.store, noExternal, radarQuerySchema.parse(period), null, "2026-12-30");
    assert.equal(result.total, 2); assert.deepEqual(new Set(result.items[0].countryCodes), new Set(["BR", "SE"]));
    assert.ok(result.items.every((item) => item.year === 2027 && item.daysUntil === 2));
  } finally { f.close(); }
});

test("global opportunity works without monitored countries and is not duplicated per client or market", async () => {
  const f = fixture();
  try {
    await f.store.confirmMarkets("client-a", ["BR", "IT"], "admin"); await f.store.confirmMarkets("client-b", ["SE"], "admin");
    await f.store.createOpportunity(opportunity({ scope: "global", countryCodes: [] }));
    const result = await loadRadar(f.store, noExternal, radarQuerySchema.parse(period), null, "2027-01-01");
    assert.equal(result.total, 1); assert.deepEqual(result.items[0].countryCodes, []);
    assert.equal(result.items[0].daysUntil, 0); assert.equal(result.items[0].relatedClients.length, 2);
    assert.equal((await loadRadar(f.store, noExternal, radarQuerySchema.parse({ ...period, countryCode: "IT" }), null, "2027-01-01")).total, 1);
    assert.throws(() => opportunity({ scope: "global", countryCodes: ["BR"] }));
  } finally { f.close(); }
});

test("client markets are explicit many-to-many confirmations; removal retains inactive rows and timestamps", async () => {
  const f = fixture();
  try {
    assert.deepEqual(await f.store.markets("client-a"), []);
    await f.store.confirmMarkets("client-a", ["BR", "IT"], "admin");
    assert.deepEqual((await f.store.markets("client-a")).map((market) => market.countryCode), ["BR", "IT"]);
    const original = await f.store.markets("client-a");
    await f.store.confirmMarkets("client-a", ["IT", "SE"], "other");
    const all = await f.store.markets("client-a"); assert.equal(all.length, 3);
    assert.equal(all.find((market) => market.countryCode === "BR")!.active, false);
    assert.equal(all.find((market) => market.countryCode === "BR")!.createdAt, original[0].createdAt);
    assert.deepEqual((await f.store.editorialClients(null))[0].countryCodes, ["IT", "SE"]);
    assert.equal((await f.store.editorialClients(["client-b"])).length, 0);
  } finally { f.close(); }
});

test("deactivating monitoring never deletes opportunities, occurrences or client markets; another connection sees the state", async () => {
  const f = fixture();
  try {
    await f.store.setMonitoredCountry("BR", true); await f.store.confirmMarkets("client-a", ["BR"], "admin");
    await f.store.createOpportunity(opportunity({ countryCodes: ["BR"] }));
    const before = (await f.store.monitoredCountries())[0];
    await f.store.setMonitoredCountry("BR", false);
    const otherDevice = new SeasonalRepository(f.pool);
    const after = (await otherDevice.monitoredCountries())[0];
    assert.equal(after.active, false); assert.equal(after.createdAt, before.createdAt);
    assert.equal((await otherDevice.occurrences(period.from, period.to)).length, 1);
    assert.equal((await otherDevice.markets("client-a"))[0].active, true);
    assert.equal((await loadRadar(f.store, noExternal, radarQuerySchema.parse(period), null, "2026-12-30")).total, 0);
    await f.store.setMonitoredCountry("BR", true); assert.equal((await f.store.monitoredCountries()).length, 1);
    assert.ok(f.statements.every((sql) => !/DELETE/i.test(sql)));
  } finally { f.close(); }
});

test("occurrences may select a subset of opportunity countries, retaining independently dated occurrences", async () => {
  const f = fixture();
  try {
    await f.store.setMonitoredCountry("BR", true); await f.store.setMonitoredCountry("SE", true);
    await f.store.createOpportunity(opportunity({ occurrences: [{ date: "2027-01-01", countryCodes: ["BR"] }, { date: "2027-01-02", countryCodes: ["SE"] }] }));
    const items = await f.store.occurrences(period.from, period.to);
    assert.deepEqual(items.map((item) => item.countryCodes), [["BR"], ["SE"]]);
    assert.equal(items[0].opportunityId, items[1].opportunityId); assert.notEqual(items[0].occurrenceId, items[1].occurrenceId);
    assert.throws(() => opportunity({ occurrences: [{ date: "2027-01-01", countryCodes: ["IT"] }] }));
  } finally { f.close(); }
});

test("failed occurrence persistence rolls back the opportunity and its countries", async () => {
  const f = fixture();
  try {
    f.failOccurrence(); await assert.rejects(f.store.createOpportunity(opportunity()), /simulated/);
    assert.equal(f.sql.prepare("SELECT COUNT(*) AS count FROM seasonal_opportunities").get()!.count, 0);
    assert.equal(f.sql.prepare("SELECT COUNT(*) AS count FROM seasonal_opportunity_countries").get()!.count, 0);
  } finally { f.close(); }
});

test("categories can expand without enum changes; migration preserves existing seed categories on repeat application", async () => {
  const f = fixture();
  try {
    assert.deepEqual(new Set((await f.store.categories()).map((item) => item.label)), new Set(["Feriado", "Cultural", "Comercial", "Sazonal"]));
    await f.store.addCategory("esportivo", "Esportivo"); await f.store.createOpportunity(opportunity({ categoryCode: "esportivo" }));
    assert.equal((await f.store.categories()).length, 5);
    assert.equal((await f.store.occurrences(period.from, period.to))[0].categoryCode, "esportivo");
  } finally { f.close(); }
});

test("today, tomorrow, December crossing, leap days and DST use calendar comparisons", () => {
  assert.equal(daysBetween("2026-10-04", "2026-10-04"), 0); assert.equal(daysBetween("2026-10-04", "2026-10-05"), 1);
  assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1); assert.deepEqual(yearsInPeriod("2026-12-30", "2027-01-04"), [2026, 2027]);
  assert.equal(daysBetween("2026-03-28", "2026-03-30"), 2); assert.equal(daysBetween("2026-10-24", "2026-10-26"), 2);
  assert.equal(daysBetween("2028-02-28", "2028-03-01"), 2); assert.throws(() => daysBetween("2026-02-29", "2026-03-01"));
  assert.equal(todayInZone("Europe/Stockholm", new Date("2026-10-03T22:30:00Z")), "2026-10-04");
});

test("Nager failure in one country/year preserves others, next year is requested and regional scope is retained", async () => {
  const calls: string[] = [];
  const loader = createNagerLoader((async (url: string | URL | Request) => {
    const path = String(url); calls.push(path);
    if (path.endsWith("/AQ")) return new Response("", { status: 404 });
    const year = path.includes("/2026/") ? 2026 : 2027;
    return Response.json([{ date: `${year}-${year === 2026 ? "12-31" : "01-01"}`, name: "Holiday", localName: "Feriado", countryCode: "BR", global: false, counties: ["BR-SP"], types: ["Public"] }]);
  }) as typeof fetch);
  const result = await loader("2026-12-30", "2027-01-04", ["BR", "AQ"]);
  assert.equal(result.items.length, 2); assert.equal(result.warnings.length, 2);
  assert.ok(calls.some((path) => path.endsWith("2027/BR")));
  assert.equal(result.items[0].scope, "countries"); assert.deepEqual(result.items[0].regionalScope, { nationwide: false, subdivisions: ["BR-SP"] });
  const national = normalizeNagerHoliday({ date: "2027-01-01", name: "National", localName: "Nacional", countryCode: "BR", global: true });
  assert.equal(national.scope, "countries"); assert.equal(national.opportunityId, null); assert.equal(national.occurrenceId, null);
});

test("pagination has no 24-row truncation, global/client filters respect permissions and regional clients are not asserted", async () => {
  const f = fixture();
  try {
    await f.store.setMonitoredCountry("BR", true); await f.store.confirmMarkets("client-a", ["BR", "IT"], "admin"); await f.store.confirmMarkets("client-b", ["BR"], "admin");
    for (let index = 0; index < 55; index++) await f.store.createOpportunity(opportunity({ countryCodes: ["BR"] }));
    const first = await loadRadar(f.store, noExternal, radarQuerySchema.parse({ ...period, limit: 50 }), ["client-a"], "2026-12-30");
    const second = await loadRadar(f.store, noExternal, radarQuerySchema.parse({ ...period, limit: 50, offset: 50 }), ["client-a"], "2026-12-30");
    assert.equal(first.total, 55); assert.equal(first.items.length, 50); assert.equal(second.items.length, 5); assert.equal(first.hasMore, true); assert.equal(second.hasMore, false);
    assert.ok(first.items.every((item) => item.relatedClients.length === 1 && item.relatedClients[0].id === "client-a"));
    assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 55);
    const external = async () => ({ warnings: [], items: [normalizeNagerHoliday({ date: "2027-01-01", name: "Regional", localName: "Regional", countryCode: "BR", global: false, counties: ["BR-SP"] })] });
    const regional = await loadRadar(f.store, external, radarQuerySchema.parse({ ...period, includeExternal: "true", limit: 100 }), null, "2026-12-30");
    assert.deepEqual(regional.items.find((item) => item.origin === "nager")!.relatedClients, []);
  } finally { f.close(); }
});

test("HTTP endpoints enforce auth, management roles, client access and explicit confirmation, without startup DDL", async () => {
  const f = fixture(); const app = Fastify();
  let auth: AuthContext | null = null;
  app.decorate("db", f.pool);
  app.decorate("appEnv", { APP_TIMEZONE: "Europe/Stockholm" } as never);
  await app.register(httpErrorsPluginRegistered);
  app.addHook("onRequest", async (request) => { request.auth = auth; });
  await app.register(seasonalRoutes, { prefix: "/api", today: () => "2026-12-30", external: noExternal });
  try {
    await app.ready(); assert.equal(f.statements.length, 0);
    assert.equal((await app.inject("/api/seasonal/countries")).statusCode, 401);
    const user = (globalRole: AuthContext["user"]["globalRole"]): AuthContext => ({ user: { id: "admin", fullName: "Equipe", email: "test@example.invalid", globalRole, avatarUrl: null, locale: "pt", isActive: true }, memberships: [] });
    auth = user("cliente"); assert.equal((await app.inject("/api/seasonal/countries")).statusCode, 403);
    auth = user("colaborador"); assert.equal((await app.inject({ method: "PUT", url: "/api/seasonal/monitored-countries/BR", payload: { active: true } })).statusCode, 403);
    auth = user("super_admin");
    assert.equal((await app.inject("/api/seasonal/countries")).json().countryCodes.length, 249);
    assert.equal((await app.inject({ method: "PUT", url: "/api/seasonal/monitored-countries/aq", payload: { active: true } })).statusCode, 200);
    assert.equal((await app.inject({ method: "PUT", url: "/api/seasonal/monitored-countries/ZZ", payload: { active: true } })).statusCode, 400);
    const marketUrl = "/api/clients/client-a/editorial-markets";
    assert.equal((await app.inject({ method: "PUT", url: marketUrl, payload: { countryCodes: ["BR", "SE"] } })).statusCode, 400);
    assert.equal((await app.inject({ method: "PUT", url: marketUrl, payload: { countryCodes: ["BR", "SE"], confirmed: true } })).statusCode, 200);
    assert.equal((await app.inject(marketUrl)).json().items.length, 2);
    assert.equal((await app.inject({ method: "POST", url: "/api/seasonal/opportunities", payload: opportunity({ scope: "global", countryCodes: [] }) })).statusCode, 201);
    assert.equal((await app.inject("/api/seasonal/radar?from=2026-12-30&to=2027-01-04&includeExternal=false")).json().total, 1);
    assert.equal((await app.inject("/api/seasonal/radar?from=2026-02-30&to=2027-01-04")).statusCode, 400);
    auth = user("admin"); assert.equal((await app.inject(marketUrl)).statusCode, 403);
    assert.equal((await app.inject("/api/seasonal/radar?from=2026-12-30&to=2027-01-04&clientId=client-a")).statusCode, 403);
  } finally { await app.close(); f.close(); }
});
