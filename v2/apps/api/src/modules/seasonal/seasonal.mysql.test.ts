import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import Fastify from "fastify";
import { SeasonalRepository } from "./seasonal.repository.js";
import { seasonalRoutes } from "./seasonal.routes.js";
import { loadRadar } from "./seasonal.service.js";
import { opportunitySchema, radarQuerySchema } from "./seasonal.schemas.js";
import { createNagerLoader } from "./seasonal.nager.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { cardRoutes } from "../cards/cards.routes.js";
import type { AuthContext } from "../auth/auth.types.js";

// Deliberately ignores .env/DB_HOST/DB_NAME. This suite can only create/drop its own
// random test databases through the socket of our isolated local temporary instance.
const socketPath = process.env.SEASONAL_TEST_SOCKET;
if (!socketPath || !/^\/(?:private\/)?tmp\/seasonal-mariadb-[^/]+\/server\.sock$/.test(socketPath)) {
  throw new Error("SEASONAL_TEST_SOCKET deve apontar à instância temporária /tmp/seasonal-mariadb-*/server.sock; conexões de staging/produção são recusadas.");
}
const mode = "STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_IN_DATE,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION";
const migration = readFileSync(new URL("../../../../../database/migrations/20261004_seasonal_radar_foundation.sql", import.meta.url), "utf8");
const applicationSchema = readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8").split("-- Additive foundation only.")[0];
const tables = ["seasonal_workspaces", "seasonal_monitored_countries", "client_editorial_markets", "seasonal_categories", "seasonal_opportunities", "seasonal_opportunity_countries", "seasonal_occurrences"];
const adminId = "10000000-0000-4000-8000-000000000001";
const clientA = "20000000-0000-4000-8000-000000000001";
const clientB = "20000000-0000-4000-8000-000000000002";
const legacyPauta = "30000000-0000-4000-8000-000000000001";
const noExternal = async () => ({ items: [], warnings: [] });
const baseInput = (changes: Record<string, unknown> = {}) => opportunitySchema.parse({ title: "Ação editorial 🌍", description: "Descrição preservada — ação", categoryCode: "cultural", origin: "manual", scope: "countries", countryCodes: ["BR"], occurrences: [{ date: "2026-12-31" }], ...changes });
const period = (changes: Record<string, unknown> = {}) => radarQuerySchema.parse({ from: "2026-12-30", to: "2027-01-03", includeExternal: "false", ...changes });
const evidence: Record<string, unknown> = { migrationSha256: createHash("sha256").update(migration).digest("hex"), tests: [], productionTouched: false };
let server: mysql.Connection;
let metadata: RowDataPacket;
const results: string[] = [];
function passed(name: string) { results.push(name); }

before(async () => {
  server = await mysql.createConnection({ socketPath, user: "root", multipleStatements: true, charset: "utf8mb4", timezone: "Z" });
  await server.query("SET SESSION sql_mode = ?", [mode]);
  const [rows] = await server.query<RowDataPacket[]>(`SELECT VERSION() AS version, @@version_comment AS versionComment, @@sql_mode AS sqlMode,
    @@character_set_server AS charset, @@collation_server AS collation, @@lower_case_table_names AS lowerCaseTableNames,
    @@time_zone AS timeZone, @@foreign_key_checks AS foreignKeyChecks, @@default_storage_engine AS storageEngine`);
  metadata = rows[0]; evidence.server = metadata;
});
after(async () => {
  evidence.tests = results;
  if (process.env.SEASONAL_TEST_REPORT) writeFileSync(process.env.SEASONAL_TEST_REPORT, JSON.stringify(evidence, null, 2) + "\n");
  await server?.end();
});
async function fixture() {
  const database = `seasonal_test_${process.pid}_${randomUUID().replace(/-/g, "")}`;
  await server.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const pool = mysql.createPool({ socketPath, user: "root", database, multipleStatements: true, connectionLimit: 4, charset: "utf8mb4", timezone: "Z" });
  try {
    const [session] = await pool.query<RowDataPacket[]>("SELECT @@sql_mode AS sqlMode");
    assert.ok(session[0].sqlMode.includes("STRICT_ALL_TABLES"));
    await pool.query(applicationSchema);
    await pool.query("INSERT INTO users (id, full_name, email, password_hash, global_role, locale) VALUES (?, 'Equipe de teste', 'admin@invalid.test', 'unused', 'super_admin', 'sv')", [adminId]);
    await pool.query("INSERT INTO client_accounts (id, name, slug, portal_title, locale) VALUES (?, 'Cliente A', 'client-a', 'Portal A', 'it'), (?, 'Cliente B', 'client-b', 'Portal B', 'pt')", [clientA, clientB]);
    await pool.query("INSERT INTO invoices (id, client_account_id, invoice_number, title, recipient_name, recipient_email, recipient_address, recipient_country, recipient_tax_id, issue_date, due_date, period_label, currency, locale, status, notes) VALUES (?, ?, 900001, 'Fiscal', 'Cliente A', '', 'Rua de teste', 'Suécia', '', '2026-10-01', '2026-10-31', '10/2026', 'SEK', 'it', 'open', '')", [randomUUID(), clientA]);
    await pool.query("INSERT INTO kanban_cards (id, client_account_id, title, is_brief_approval, deadline_at) VALUES (?, ?, 'Pauta existente', 1, '2026-12-31')", [legacyPauta, clientA]);
    await pool.query(migration);
    return { database, pool, store: new SeasonalRepository(pool), close: async () => { await pool.end(); await server.query(`DROP DATABASE \`${database}\``); } };
  } catch (error) { await pool.end(); await server.query(`DROP DATABASE \`${database}\``); throw error; }
}
async function rows(pool: Pool, query: string, values: unknown[] = []) { return (await pool.query<RowDataPacket[]>(query, values))[0]; }
async function snapshot(pool: Pool) {
  const data: Record<string, unknown> = {};
  for (const name of [...tables, "users", "client_accounts", "invoices", "kanban_cards"]) data[name] = await rows(pool, `SELECT * FROM ${name} ORDER BY 1, 2`);
  return JSON.stringify(data);
}
async function httpFixture(pool: Pool) {
  const app = Fastify(); app.decorate("db", pool); app.decorate("appEnv", { APP_TIMEZONE: "Europe/Stockholm" } as never);
  const auth: AuthContext = { user: { id: adminId, fullName: "Equipe", email: "test@invalid.test", globalRole: "super_admin", avatarUrl: null, locale: "sv", isActive: true }, memberships: [] };
  await app.register(httpErrorsPluginRegistered); app.addHook("onRequest", async (request) => { request.auth = auth; });
  await app.register(seasonalRoutes, { prefix: "/api", external: noExternal, today: () => "2026-12-31" });
  await app.register(cardRoutes, { prefix: "/api" }); await app.ready(); return app;
}

test("MySQL DDL: seven tables, PK/FK/index/default/date/charset metadata and migration repeated without data changes", async () => {
  const f = await fixture();
  try {
    assert.ok(metadata.sqlMode.includes("STRICT_ALL_TABLES")); assert.equal(metadata.storageEngine, "InnoDB");
    const names = await rows(f.pool, `SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${tables.map(() => "?").join(",")}) ORDER BY TABLE_NAME`, [f.database, ...tables]);
    assert.equal(names.length, 7); assert.ok(names.every((table) => table.engine === "InnoDB" && table.collation === "utf8mb4_unicode_ci"));
    const indexes = await rows(f.pool, `SELECT TABLE_NAME AS tableName, INDEX_NAME AS name, NON_UNIQUE AS nonUnique, SEQ_IN_INDEX AS position, COLUMN_NAME AS columnName FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${tables.map(() => "?").join(",")}) ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`, [f.database, ...tables]);
    assert.equal(new Set(indexes.filter((item) => item.name === "PRIMARY").map((item) => item.tableName)).size, 7);
    assert.ok(indexes.some((item) => item.name === "uq_seasonal_opportunity_workspace" && item.nonUnique === 0));
    assert.deepEqual(indexes.filter((item) => item.name === "idx_seasonal_occurrence_period").map((item) => item.columnName), ["workspace_id", "occurrence_date"]);
    const fks = await rows(f.pool, "SELECT TABLE_NAME AS tableName, CONSTRAINT_NAME AS name, REFERENCED_TABLE_NAME AS target, DELETE_RULE AS deleteRule, UPDATE_RULE AS updateRule FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME IN (" + tables.map(() => "?").join(",") + ") ORDER BY TABLE_NAME, CONSTRAINT_NAME", [f.database, ...tables]);
    assert.equal(fks.length, 9); assert.ok(fks.every((fk) => fk.deleteRule === "RESTRICT" && fk.updateRule === "RESTRICT"));
    const columns = await rows(f.pool, "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS type, COLUMN_DEFAULT AS defaultValue, IS_NULLABLE AS nullable, CHARACTER_SET_NAME AS charset, COLLATION_NAME AS collation, EXTRA AS extra, GENERATION_EXPRESSION AS expression FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (" + tables.map(() => "?").join(",") + ") ORDER BY TABLE_NAME, ORDINAL_POSITION", [f.database, ...tables]);
    assert.ok(columns.filter((item) => item.name === "country_code").every((item) => item.type === "char(2)" && item.charset === "ascii" && item.collation === "ascii_bin"));
    assert.equal(columns.find((item) => item.name === "occurrence_date")!.type, "date");
    assert.match(columns.find((item) => item.name === "occurrence_year")!.extra, /STORED GENERATED/i);
    assert.match(columns.find((item) => item.name === "occurrence_year")!.expression, /year/i);
    assert.ok(columns.filter((item) => item.name === "active").every((item) => item.type === "tinyint(1)" && String(item.defaultValue) === "1"));
    assert.ok(columns.filter((item) => item.name === "created_at").every((item) => item.type === "timestamp(3)" && /current_timestamp/i.test(item.defaultValue)));
    assert.ok(columns.filter((item) => item.name === "updated_at").every((item) => /on update current_timestamp\(3\)/i.test(item.extra)));
    await f.store.setMonitoredCountry("BR", false); await f.store.confirmMarkets(clientA, ["BR", "IT"], adminId);
    await f.store.createOpportunity(baseInput()); await f.store.addCategory("cultural", "Cultural editada");
    const before = await snapshot(f.pool); await f.pool.query(migration); assert.equal(await snapshot(f.pool), before);
    const [warnings] = await f.pool.query("SHOW WARNINGS"); evidence.repeatWarnings = warnings;
    evidence.tables = names; evidence.indexes = indexes; evidence.foreignKeys = fks; evidence.columns = columns;
    passed("DDL/metadata/idempotence");
  } finally { await f.close(); }
});

test("MySQL monitoring: add, deactivate, reactivate across connections without deleting clients, pauta, markets or history", async () => {
  const f = await fixture();
  try {
    const id = await f.store.createOpportunity(baseInput()); await f.store.confirmMarkets(clientA, ["BR", "IT"], adminId);
    await f.store.setMonitoredCountry("BR", true); const original = (await f.store.monitoredCountries())[0];
    const preserved = await rows(f.pool, "SELECT * FROM kanban_cards WHERE id = ?", [legacyPauta]);
    await f.store.setMonitoredCountry("BR", false);
    const anotherConnection = mysql.createPool({ socketPath, user: "root", database: f.database, charset: "utf8mb4", timezone: "Z" });
    try {
      const independent = new SeasonalRepository(anotherConnection); const inactive = (await independent.monitoredCountries())[0];
      assert.equal(inactive.active, false); assert.equal(inactive.createdAt, original.createdAt);
      assert.ok(inactive.updatedAt >= inactive.createdAt);
      assert.equal((await independent.occurrences(period().from, period().to))[0].opportunityId, id);
      assert.equal((await independent.markets(clientA)).length, 2);
      assert.equal((await rows(anotherConnection, "SELECT COUNT(*) AS count FROM client_accounts"))[0].count, 2);
      assert.deepEqual(await rows(anotherConnection, "SELECT * FROM kanban_cards WHERE id = ?", [legacyPauta]), preserved);
    } finally { await anotherConnection.end(); }
    await f.store.setMonitoredCountry("BR", true); assert.equal((await f.store.monitoredCountries()).length, 1);
    assert.equal((await f.store.monitoredCountries())[0].active, true); passed("monitoring/deactivation/reactivation/history");
  } finally { await f.close(); }
});

test("MySQL editorial markets: explicit N:N, no language/fiscal inference and removed associations stay inactive", async () => {
  const f = await fixture(); const app = await httpFixture(f.pool);
  try {
    assert.deepEqual(await f.store.markets(clientA), []); assert.deepEqual(await f.store.markets(clientB), []);
    const url = `/api/clients/${clientA}/editorial-markets`;
    assert.equal((await app.inject({ method: "PUT", url, payload: { countryCodes: ["BR", "IT"] } })).statusCode, 400);
    assert.equal((await app.inject({ method: "PUT", url, payload: { countryCodes: ["br", "IT", "BR"], confirmed: true } })).statusCode, 200);
    assert.deepEqual((await f.store.markets(clientA)).map((market) => market.countryCode), ["BR", "IT"]);
    await f.store.confirmMarkets(clientA, ["IT", "SE"], adminId);
    const all = await f.store.markets(clientA); assert.equal(all.length, 3); assert.equal(all.find((market) => market.countryCode === "BR")!.active, false);
    assert.deepEqual((await f.store.editorialClients(null))[0].countryCodes, ["IT", "SE"]); passed("explicit-multiple-editorial-markets/no-inference");
  } finally { await app.close(); await f.close(); }
});

test("MySQL opportunity scopes: national, multipaís and global, with two distinct same-country/same-date identities", async () => {
  const f = await fixture();
  try {
    await f.store.setMonitoredCountry("BR", true); await f.store.setMonitoredCountry("SE", true);
    const ids = [await f.store.createOpportunity(baseInput()), await f.store.createOpportunity(baseInput()),
      await f.store.createOpportunity(baseInput({ title: "Multipaís", countryCodes: ["BR", "SE"] })),
      await f.store.createOpportunity(baseInput({ title: "Internacional", scope: "global", countryCodes: [] }))];
    assert.equal(new Set(ids).size, 4);
    const result = await loadRadar(f.store, noExternal, period(), null, "2026-12-31"); assert.equal(result.total, 4);
    assert.equal(result.items.find((item) => item.title === "Multipaís")!.countryCodes.length, 2);
    assert.deepEqual(result.items.find((item) => item.title === "Internacional")!.countryCodes, []);
    assert.equal((await rows(f.pool, "SELECT COUNT(*) AS count FROM seasonal_opportunity_countries WHERE opportunity_id = ?", [ids[3]]))[0].count, 0);
    await f.store.setMonitoredCountry("BR", false); await f.store.setMonitoredCountry("SE", false);
    assert.equal((await loadRadar(f.store, noExternal, period(), null, "2026-12-31")).total, 1);
    passed("national/multicountry/global/distinct-identities");
  } finally { await f.close(); }
});

test("MySQL DATE/generated year: December/January occurrences, today/tomorrow and regional JSON preserved without truncation", async () => {
  const f = await fixture();
  try {
    await f.store.setMonitoredCountry("BR", true); await f.store.setMonitoredCountry("SE", true);
    const payload = { legacyId: "synthetic-example", date_month: 12, date_day: 31, title: "Mês/dia preservados", description: "Descrição", category: "cultural", country: "Brasil" };
    await f.store.createOpportunity(baseInput({ countryCodes: ["BR", "SE"], occurrences: [
      { date: "2026-12-31", countryCodes: ["BR"], externalSource: "legacy-example", externalReference: "synthetic-example", externalPayload: payload },
      { date: "2027-01-01", countryCodes: ["SE"], regionalScope: { nationwide: false, subdivisions: ["SE-AB", "BR-SP", "US-CA", "CN-12345678901234567890123456789"] } },
    ] }));
    const result = await loadRadar(f.store, noExternal, period(), null, "2026-12-31");
    assert.deepEqual(result.items.map((item) => item.year), [2026, 2027]); assert.deepEqual(result.items.map((item) => item.daysUntil), [0, 1]);
    assert.deepEqual(result.items.map((item) => item.countryCodes), [["BR"], ["SE"]]);
    assert.equal(result.items[1].regionalScope!.subdivisions[3].length, 32);
    assert.deepEqual(result.items[1].regionalScope, { nationwide: false, subdivisions: ["SE-AB", "BR-SP", "US-CA", "CN-12345678901234567890123456789"] });
    const stored = await rows(f.pool, "SELECT external_payload FROM seasonal_occurrences WHERE external_reference = 'synthetic-example'");
    assert.deepEqual(typeof stored[0].external_payload === "string" ? JSON.parse(stored[0].external_payload) : stored[0].external_payload, payload);
    evidence.jsonDriverValue = typeof stored[0].external_payload; passed("date/generated-year/today/tomorrow/regional-json/legacy-provenance");
  } finally { await f.close(); }
});

test("MySQL plus Nager service: failure in one country preserves the other country/year and provider global stays national", async () => {
  const f = await fixture();
  try {
    await f.store.setMonitoredCountry("BR", true); await f.store.setMonitoredCountry("AQ", true); await f.store.confirmMarkets(clientA, ["BR"], adminId);
    const calls: string[] = [];
    const loader = createNagerLoader((async (url: string | URL | Request) => {
      const path = String(url); calls.push(path); if (path.endsWith("/AQ")) return new Response("", { status: 404 });
      const year = path.includes("/2026/") ? 2026 : 2027;
      return Response.json([{ date: `${year}-${year === 2026 ? "12-31" : "01-01"}`, localName: "Regional", name: "Regional", countryCode: "BR", global: false, counties: ["BR-SP"], types: ["Public"] },
        { date: `${year}-${year === 2026 ? "12-31" : "01-01"}`, localName: "Nacional", name: "National", countryCode: "BR", global: true, counties: null }]);
    }) as typeof fetch);
    const result = await loadRadar(f.store, loader, period({ includeExternal: "true" }), null, "2026-12-31");
    assert.equal(result.total, 4); assert.equal(result.warnings.length, 2); assert.equal(calls.length, 4);
    assert.ok(result.items.every((item) => item.scope === "countries"));
    assert.deepEqual(result.items.find((item) => item.title === "Regional")!.regionalScope, { nationwide: false, subdivisions: ["BR-SP"] });
    assert.equal(result.items.find((item) => item.title === "Regional")!.relatedClients.length, 0);
    assert.equal(result.items.find((item) => item.title === "Nacional")!.relatedClients.length, 1);
    passed("external-country-failure/next-year/regional-preservation");
  } finally { await f.close(); }
});

test("MySQL HTTP flow: real pending pauta creation reused, country validation and 55-row pagination without truncation", async () => {
  const f = await fixture(); const app = await httpFixture(f.pool);
  try {
    const monitor = (countryCode: string, active: boolean) => app.inject({ method: "PUT", url: `/api/seasonal/monitored-countries/${countryCode}`, payload: { active } });
    assert.equal((await monitor("br", true)).statusCode, 200); assert.equal((await monitor("BRA", true)).statusCode, 400); assert.equal((await monitor("ZZ", true)).statusCode, 400);
    for (let index = 0; index < 55; index++) {
      const response = await app.inject({ method: "POST", url: "/api/seasonal/opportunities", payload: baseInput({ title: `Oportunidade ${index}` }) }); assert.equal(response.statusCode, 201, response.body);
    }
    const first = (await app.inject("/api/seasonal/radar?from=2026-12-30&to=2027-01-03&includeExternal=false&limit=50")).json();
    const second = (await app.inject("/api/seasonal/radar?from=2026-12-30&to=2027-01-03&includeExternal=false&limit=50&offset=50")).json();
    assert.equal(first.total, 55); assert.equal(first.items.length, 50); assert.equal(second.items.length, 5); assert.equal(first.hasMore, true); assert.equal(second.hasMore, false);
    assert.equal(new Set([...first.items, ...second.items].map((item: { id: string }) => item.id)).size, 55);
    const pauta = await app.inject({ method: "POST", url: `/api/clients/${clientA}/cards`, payload: { columnId: null, title: first.items[0].title, caption: "Criada a partir do radar", status: ["Entrada"], tags: ["Data comemorativa"], isBriefApproval: true, clientLabel: "Pendente", deadlineAt: first.items[0].date } });
    assert.equal(pauta.statusCode, 200, pauta.body); assert.equal(pauta.json().card.isBriefApproval, true);
    const before = await rows(f.pool, "SELECT * FROM kanban_cards ORDER BY id"); await monitor("BR", false);
    assert.deepEqual(await rows(f.pool, "SELECT * FROM kanban_cards ORDER BY id"), before);
    assert.equal((await rows(f.pool, "SELECT COUNT(*) AS count FROM seasonal_occurrences"))[0].count, 55);
    passed("http/pauta-reuse/iso-validation/pagination55/no-deletion");
  } finally { await app.close(); await f.close(); }
});

test("MySQL PK/FK/CHECK/strict dates/JSON/length errors are enforced, transactions roll back, and referenced records cannot be deleted/updated", async () => {
  const f = await fixture();
  try {
    await f.store.setMonitoredCountry("BR", true); await f.store.confirmMarkets(clientA, ["BR", "IT"], adminId);
    const id = await f.store.createOpportunity(baseInput());
    await assert.rejects(f.pool.query("INSERT INTO seasonal_monitored_countries (workspace_id, country_code) VALUES ('operation', 'BR')"), { code: "ER_DUP_ENTRY" });
    await assert.rejects(f.pool.query("INSERT INTO seasonal_monitored_countries (workspace_id, country_code) VALUES ('operation', 'BRA')"), { code: "ER_DATA_TOO_LONG" });
    await assert.rejects(f.pool.query("INSERT INTO seasonal_opportunity_countries (workspace_id, opportunity_id, country_code) VALUES ('operation', ?, 'IT')", [randomUUID()]), { code: "ER_NO_REFERENCED_ROW_2" });
    for (const query of ["DELETE FROM seasonal_workspaces WHERE id = 'operation'", `DELETE FROM client_accounts WHERE id = '${clientA}'`, `DELETE FROM users WHERE id = '${adminId}'`, `DELETE FROM seasonal_opportunities WHERE id = '${id}'`, "UPDATE seasonal_workspaces SET id = 'other' WHERE id = 'operation'"]) await assert.rejects(f.pool.query(query), { code: "ER_ROW_IS_REFERENCED_2" });
    await assert.rejects(f.pool.query("UPDATE seasonal_opportunities SET scope = 'invalid' WHERE id = ?", [id]));
    await assert.rejects(f.pool.query("UPDATE seasonal_occurrences SET occurrence_date = '2026-02-30' WHERE opportunity_id = ?", [id]));
    await assert.rejects(f.pool.query("UPDATE seasonal_occurrences SET regional_scope_json = 'not-json' WHERE opportunity_id = ?", [id]));
    const before = (await rows(f.pool, "SELECT COUNT(*) AS count FROM seasonal_opportunities"))[0].count;
    // Bypass API validation only in this test to force a late database error after inserting the opportunity/countries.
    const invalid = baseInput(); invalid.occurrences[0].date = "2026-02-30";
    await assert.rejects(f.store.createOpportunity(invalid));
    assert.equal((await rows(f.pool, "SELECT COUNT(*) AS count FROM seasonal_opportunities"))[0].count, before);
    assert.equal((await rows(f.pool, "SELECT COUNT(*) AS count FROM seasonal_opportunity_countries"))[0].count, 1);
    passed("primary/foreign/check/strict-date/json/length/rollback");
  } finally { await f.close(); }
});

test("MySQL FOR UPDATE blocks a concurrent market confirmation, then completes without mixed active market sets", async () => {
  const f = await fixture(); const lock = await f.pool.getConnection();
  try {
    await lock.beginTransaction(); await lock.query("SELECT id FROM client_accounts WHERE id = ? FOR UPDATE", [clientA]);
    let done = false; const pending = f.store.confirmMarkets(clientA, ["BR", "SE"], adminId).then(() => { done = true; });
    await new Promise((resolve) => setTimeout(resolve, 100)); assert.equal(done, false);
    await lock.commit(); await pending;
    assert.deepEqual((await f.store.markets(clientA)).filter((item) => item.active).map((item) => item.countryCode), ["BR", "SE"]);
    await Promise.all([f.store.confirmMarkets(clientA, ["IT"], adminId), f.store.confirmMarkets(clientA, ["SE", "BR"], adminId)]);
    const active = (await f.store.markets(clientA)).filter((item) => item.active).map((item) => item.countryCode);
    assert.ok(JSON.stringify(active) === '["IT"]' || JSON.stringify(active) === '["BR","SE"]');
    passed("real-row-lock/concurrent-confirmations");
  } finally { await lock.rollback(); lock.release(); await f.close(); }
});

test("MySQL safe reversal archives populated tables atomically and restores all data/FKs; unrelated records remain unchanged", async () => {
  const f = await fixture();
  try {
    await f.store.setMonitoredCountry("BR", true); await f.store.confirmMarkets(clientA, ["BR", "IT"], adminId); await f.store.createOpportunity(baseInput());
    const before = await snapshot(f.pool);
    const archive = readFileSync(new URL("../../../../../database/rollback/20261004_seasonal_radar_foundation.archive.sql", import.meta.url), "utf8");
    const restore = readFileSync(new URL("../../../../../database/rollback/20261004_seasonal_radar_foundation.restore.sql", import.meta.url), "utf8");
    await f.pool.query(archive);
    const archived = await rows(f.pool, "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'seasonal_archive_20261004_%'", [f.database]);
    assert.equal(archived.length, 7);
    assert.equal((await rows(f.pool, "SELECT COUNT(*) AS count FROM seasonal_archive_20261004_occurrences"))[0].count, 1);
    const fks = await rows(f.pool, "SELECT REFERENCED_TABLE_NAME AS target FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME LIKE 'seasonal_archive_20261004_%'", [f.database]);
    assert.equal(fks.length, 9); assert.ok(fks.every((fk) => fk.target.startsWith("seasonal_archive_20261004_") || ["client_accounts", "users"].includes(fk.target)));
    await assert.rejects(f.pool.query(archive)); // repeat does not overwrite archived rows
    await f.pool.query(restore); assert.equal(await snapshot(f.pool), before);
    await f.pool.query(migration); assert.equal(await snapshot(f.pool), before);
    evidence.reversal = { archivedTables: 7, fkReferencesPreserved: 9, restoredExactSnapshot: true };
    passed("atomic-data-preserving-reversal/restore");
  } finally { await f.close(); }
});
