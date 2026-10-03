import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "mysql2/promise";
import { analyzeRecurringInvoices, auditRecurringInvoices, type RecurringAuditRow } from "./invoice-recurring-audit.js";
import { confirmRecurringSource, ensureRecurringSources, registerNewRecurringSource } from "./invoice-recurring-sources.js";
const root = (id = "september", overrides: Partial<RecurringAuditRow> = {}): RecurringAuditRow => ({
  id, client_account_id: "client", invoice_number: 57, title: "Setembro 2026", recipient_name: "Client",
  issue_date: "2026-09-01", due_date: "2026-09-28", period_label: "setembro de 2026", locale: "pt", recurring: 1,
  recurring_source_invoice_id: null, recurring_period: null, legacy_id: id, status: "paid", receipt_number: null, sent_at: null, ...overrides,
});
const instance = (overrides: Partial<RecurringAuditRow> = {}) => root("october", {
  invoice_number: 91, title: "Outubro 2026", issue_date: "2026-10-01", due_date: "2026-10-28", period_label: "outubro de 2026",
  recurring: 0, recurring_source_invoice_id: "september", recurring_period: "2026-10", legacy_id: null, status: "open", ...overrides,
});
test("audit groups historical flags for review without inferring independent confirmed chains", () => {
  const rows = [root("march", { issue_date: "2026-03-01", invoice_number: 30 }), root(), instance({ title: "Setembro 2026" })];
  const original = structuredClone(rows);
  const result = analyzeRecurringInvoices(rows, [], "2026-10");
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].suggestedSourceId, "september");
  assert.deepEqual(result.sources[0].confirmedSourceIds, []);
  assert.equal(result.needsSourceReview, 2);
  assert.deepEqual(result.instances[0].problems, ["historical_title", "unconfirmed_source"]);
  assert.equal(result.instances[0].expectedTitle, "Outubro 2026");
  assert.deepEqual(rows, original);
});
test("audit identifies valid October, wrong dates, inherited delivery, and a generated source", () => {
  assert.deepEqual(analyzeRecurringInvoices([root(), instance()], ["september"], "2026-10").instances[0].problems, []);
  const bad = instance({ due_date: "2026-11-28", issue_date: "2026-09-01", period_label: "setembro de 2026", recurring: 1, receipt_number: "receipt", sent_at: "sent" });
  assert.deepEqual(analyzeRecurringInvoices([root(), bad], ["september"], "2026-10").instances[0].problems,
    ["wrong_due_month_or_day", "wrong_period_label", "instance_marked_recurring", "wrong_issue_date", "has_history_or_delivery_review_required"]);
  assert.ok(analyzeRecurringInvoices([instance(), instance({ id: "child", recurring_source_invoice_id: "october" })], [], "2026-10").instances[1].problems.includes("invalid_source"));
  assert.ok(analyzeRecurringInvoices([root("september", { due_date: "invalid" }), instance()], [], "2026-10").instances[0].problems.includes("invalid_source_due_date"));
});
test("diagnostic database access is SELECT-only and normalizes driver Date objects", async () => {
  const statements: string[] = [];
  const db = { query: async (sql: string) => {
    statements.push(sql);
    return sql.includes("FROM invoices WHERE") ? [[root(), { ...instance(), issue_date: new Date("2026-10-01T00:00:00Z"), due_date: new Date("2026-10-28T00:00:00Z") }]] : [[{ source_invoice_id: "september" }]];
  } } as unknown as Pool;
  const audit = await auditRecurringInvoices(db, new Date("2026-10-03T12:00:00Z"), "Europe/Stockholm");
  assert.equal(audit.instances[0].issueDate, "2026-10-01");
  assert.deepEqual(audit.instances[0].problems, []);
  assert.ok(statements.every((sql) => sql.startsWith("SELECT ")));
});
function sourceHarness(invoice = root(), otherSources: string[] = []) {
  const statements: string[] = [];
  const registered = new Set<string>();
  let commits = 0, rollbacks = 0, released = false;
  const connection = { query: async (sql: string, values: unknown[] = []) => {
    statements.push(sql);
    if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }]];
    if (sql.includes("RELEASE_LOCK")) return [[{ released: 1 }]];
    if (sql.startsWith("SELECT id, client_account_id")) return [[invoice]];
    if (sql.startsWith("SELECT i.id")) return [otherSources.map((id) => ({ id }))];
    if (sql.startsWith("INSERT INTO invoice_recurring_sources")) registered.add(String(values[0]));
    return [[], []];
  }, beginTransaction: async () => {}, commit: async () => { commits++; }, rollback: async () => { rollbacks++; }, release: () => { released = true; } };
  const db = { query: connection.query, getConnection: async () => connection } as unknown as Pool;
  return { db, connection, statements, registered, state: () => ({ commits, rollbacks, released }) };
}
test("upgrade creates an empty source registry without seeding historical flags", async () => {
  const { db, statements } = sourceHarness();
  await ensureRecurringSources(db);
  assert.equal(statements.length, 1);
  assert.ok(statements[0].startsWith("CREATE TABLE IF NOT EXISTS invoice_recurring_sources"));
  assert.ok(!statements[0].includes("SELECT"));
});
test("explicit source confirmation is repeatable and only writes the source registry", async () => {
  const h = sourceHarness();
  await confirmRecurringSource(h.db, "september", "admin");
  await confirmRecurringSource(h.db, "september", "admin");
  assert.deepEqual([...h.registered], ["september"]);
  assert.equal(h.state().commits, 2);
  assert.equal(h.state().released, true);
  assert.ok(!h.statements.some((sql) => /^(UPDATE|DELETE|INSERT INTO invoices )/.test(sql)));
});
test("generated/disabled invoices cannot become sources and duplicate legacy chains are blocked", async () => {
  for (const invoice of [instance({ recurring: 1 }), root("disabled", { recurring: 0 })]) {
    const h = sourceHarness(invoice);
    await assert.rejects(confirmRecurringSource(h.db, invoice.id, "admin"), /fatura-base/);
    assert.equal(h.registered.size, 0);
    assert.equal(h.state().rollbacks, 1);
    assert.equal(h.state().released, true);
  }
  const h = sourceHarness(root("march"), ["september"]);
  await assert.rejects(confirmRecurringSource(h.db, "march", "admin"), /já possui uma fonte histórica/);
  assert.equal(h.registered.size, 0);
});
test("an explicitly created recurring invoice can register its own source", async () => {
  const h = sourceHarness();
  await registerNewRecurringSource(h.connection as never, "new", "admin");
  assert.deepEqual([...h.registered], ["new"]);
});
