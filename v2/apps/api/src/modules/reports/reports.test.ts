import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { createReport, listReports, updateReport } from "./reports.repository.js";
import { createReportSchema } from "./reports.schemas.js";
import { ensureReportStorage } from "./reports.storage.js";

const metrics = {
  instagram: { reach: 10, impressions: 20, engagement: 3, followers: 40, visits: 5, clicks: 1 },
  facebook: { reach: 11, impressions: 21, engagement: 4, followers: 41, visits: 6, clicks: 2 },
};

const reportRow = (overrides: Record<string, unknown> = {}) => ({
  id: "report-1", client_account_id: "client-1", meta_destination_id: null, meta_destination_name: null,
  title: "Relatório setembro", period_start: "2026-09-01", period_end: "2026-09-30", status: "draft",
  metrics_json: JSON.stringify(metrics), highlights_json: "[]", evidence_urls_json: "[]", notes: null,
  published_at: null, created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-01T10:00:00Z", ...overrides,
});

const input = {
  title: "Relatório setembro", periodStart: "2026-09-01", periodEnd: "2026-09-30",
  metrics, highlights: [], evidenceUrls: [], notes: null,
};

test("report schema supports a destination and remains compatible with old reports", () => {
  assert.equal(createReportSchema.parse(input).metaDestinationId, undefined);
  assert.equal(createReportSchema.parse({ ...input, metaDestinationId: null }).metaDestinationId, null);
  assert.equal(createReportSchema.parse({ ...input, metaDestinationId: "destination-commercial" }).metaDestinationId, "destination-commercial");
});

test("reports persist the destination id and immutable name snapshot", async () => {
  let insertParams: unknown[] = [];
  const row = reportRow({ meta_destination_id: "destination-commercial", meta_destination_name: "Commercial" });
  const db = { async query(sql: string, params: unknown[] = []) {
    if (sql.startsWith("INSERT INTO client_reports")) { insertParams = params; return [{ affectedRows: 1 }, []]; }
    if (sql.startsWith("SELECT")) return [[{ ...row, id: params[0] }], []];
    throw new Error(`Unexpected SQL: ${sql}`);
  } } as unknown as Pool;
  const created = await createReport(db, "client-1", "user-1", { ...input, metaDestinationId: "destination-commercial", metaDestinationName: "Commercial" });
  assert.deepEqual(insertParams.slice(1, 4), ["client-1", "destination-commercial", "Commercial"]);
  assert.equal(created?.metaDestinationId, "destination-commercial");
  assert.equal(created?.metaDestinationName, "Commercial");
});

test("old reports map null destination fields and destination renames do not rewrite their snapshot", async () => {
  let row = reportRow();
  const db = { async query(sql: string, params: unknown[] = []) {
    if (sql.startsWith("UPDATE")) {
      if (sql.includes("title = ?")) row = { ...row, title: String(params[0]) };
      return [{ affectedRows: 1 }, []];
    }
    if (sql.startsWith("SELECT")) return [[row], []];
    throw new Error(`Unexpected SQL: ${sql}`);
  } } as unknown as Pool;
  const [legacy] = await listReports(db, "client-1");
  assert.equal(legacy?.metaDestinationId, null);
  assert.equal(legacy?.metaDestinationName, null);

  row = reportRow({ meta_destination_id: "destination-commercial", meta_destination_name: "Commercial original" });
  const updated = await updateReport(db, "report-1", { title: "Título atualizado" });
  assert.equal(updated?.title, "Título atualizado");
  assert.equal(updated?.metaDestinationName, "Commercial original");
});

test("report storage migration is additive and idempotent", async () => {
  const statements: string[] = [];
  const missingDb = { async query(sql: string) {
    statements.push(sql);
    if (sql.startsWith("SHOW")) return [[], []];
    return [{ affectedRows: 0 }, []];
  } } as unknown as Pool;
  await ensureReportStorage(missingDb);
  assert.equal(statements.some((sql) => sql.includes("ADD COLUMN meta_destination_id")), true);
  assert.equal(statements.some((sql) => sql.includes("ADD COLUMN meta_destination_name")), true);
  assert.equal(statements.some((sql) => sql.includes("ADD INDEX idx_client_reports_meta_destination")), true);

  const idempotentStatements: string[] = [];
  const existingDb = { async query(sql: string) {
    idempotentStatements.push(sql);
    return sql.startsWith("SHOW COLUMNS") ? [[{ Field: "present" }], []] : [[{ Key_name: "idx_client_reports_meta_destination" }], []];
  } } as unknown as Pool;
  await ensureReportStorage(existingDb);
  assert.equal(idempotentStatements.some((sql) => sql.startsWith("ALTER TABLE")), false);
});
