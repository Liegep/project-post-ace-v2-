import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { billingMonth, generateRecurringInvoices, recurringDates, recurringInvoiceTitle, recurringDescription } from "./invoice-recurring.service.js";
import { ensureInvoiceTables, listInvoices } from "./invoices.repository.js";

const source = (id = "source", overrides: Record<string, unknown> = {}) => ({
  id, recurring: 1, recurring_source_invoice_id: null, recurring_period: null,
  client_account_id: "client", invoice_number: 4, title: "Design mensal", recipient_name: "Cliente", recipient_email: "cliente@example.com",
  recipient_address: "Rua 1", recipient_country: "Brasil", recipient_tax_id: "123", issue_date: "2026-09-01", due_date: "2026-09-10",
  period_label: "Setembro", currency: "BRL", locale: "pt", fixed_amount: 1, visible_to_client: 1, notes: "Observações",
  status: "paid", paid_at: "2026-09-10", payment_method: "Pix", payment_proof_url: "/proof", receipt_number: "REC-1",
  receipt_snapshot_json: { signatureUrl: "/signature" }, sent_at: "2026-09-01", created_by_user_id: "user", ...overrides,
});

export function recurringHarness(initial: ReturnType<typeof source>[] = [source()], confirmedIds = initial.map((row) => row.id)) {
  const confirmed = new Set(confirmedIds);
  const rows: Record<string, unknown>[] = initial.map((item) => ({ ...item }));
  const items = initial.map((item) => ({ id: `${item.id}-item`, invoice_id: item.id, description: "Identidade visual", quantity: "2.500", unit_price: "123.45", position: 0 }));
  const statements: string[] = [];
  let locked = false;
  let releases = 0;
  let commits = 0;
  const query = async (sql: string, values: unknown[] = []) => {
    statements.push(sql);
    if (sql.includes("GET_LOCK")) { const acquired = locked ? 0 : 1; if (acquired) locked = true; return [[{ acquired }], []]; }
    if (sql.includes("RELEASE_LOCK")) { locked = false; return [[{ released: 1 }], []]; }
    if (sql.startsWith("SELECT i.id FROM invoice_recurring_sources")) return [rows.filter((row) => confirmed.has(String(row.id)) && row.recurring === 1 && !row.recurring_source_invoice_id && String(row.issue_date) <= String(values[0])).map(({ id }) => ({ id })), []];
    if (sql.startsWith("SELECT i.* FROM invoice_recurring_sources")) return [rows.filter((row) => row.id === values[0] && confirmed.has(String(row.id)) && row.recurring === 1 && !row.recurring_source_invoice_id), []];
    if (sql.startsWith("SELECT id FROM invoices WHERE recurring_source_invoice_id")) return [rows.filter((row) => row.recurring_source_invoice_id === values[0] && row.recurring_period === values[1]), []];
    if (sql.includes("MAX(invoice_number)")) return [[{ next_number: Math.max(...rows.map((row) => Number(row.invoice_number)), 0) + 1 }], []];
    if (sql.startsWith("INSERT INTO invoices")) {
      const columns = sql.match(/INSERT INTO invoices\s*\(([\s\S]*?)\) VALUES/)![1].split(",").map((column) => column.trim());
      const tokens = sql.match(/VALUES \(([\s\S]*?)\)/)![1].split(",").map((token) => token.trim());
      let index = 0;
      const row: Record<string, unknown> = { paid_at: null, payment_method: null, payment_proof_name: null, payment_proof_url: null, receipt_number: null, receipt_snapshot_json: null, receipt_generated_at: null };
      columns.forEach((column, tokenIndex) => { const token = tokens[tokenIndex]; row[column] = token === "?" ? values[index++] : token === "NULL" ? null : token === "0" ? 0 : token.slice(1, -1); });
      assert.ok(!rows.some((item) => item.recurring_source_invoice_id === row.recurring_source_invoice_id && item.recurring_period === row.recurring_period), "unique recurring origin/month constraint");
      rows.push(row); return [{ affectedRows: 1 }, []];
    }
    if (sql.startsWith("SELECT description")) return [items.filter((item) => item.invoice_id === values[0]), []];
    if (sql.startsWith("INSERT INTO invoice_items")) { items.push({ id: String(values[0]), invoice_id: String(values[1]), description: String(values[2]), quantity: String(values[3]), unit_price: String(values[4]), position: Number(values[5]) }); return [{ affectedRows: 1 }, []]; }
    throw new Error(`Unexpected SQL ${sql}`);
  };
  const db = { getConnection: async () => ({ query, beginTransaction: async () => {}, commit: async () => { commits++; }, rollback: async () => {}, release: () => { releases++; } }) } as unknown as Pool;
  return { db, rows, items, statements, counts: () => ({ locked, releases, commits }) };
}
const october = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T12:00:00Z`);
for (const day of [1, 2, 20]) test(`generates the missing current month on October ${day}`, async () => {
  const { db, rows } = recurringHarness();
  const result = await generateRecurringInvoices(db, october(day));
  assert.equal(result.created, 1);
  assert.equal(rows[1].issue_date, "2026-10-01");
  assert.equal(rows[1].due_date, "2026-10-10");
  assert.equal(rows[1].recurring_period, "2026-10");
});

test("preserves billing data/items and resets all payment, receipt, delivery and recurrence fields", async () => {
  const base = source();
  const { db, rows, items } = recurringHarness([base]);
  await generateRecurringInvoices(db, october(2));
  const generated = rows[1];
  for (const field of ["client_account_id", "recipient_name", "recipient_email", "recipient_address", "recipient_country", "recipient_tax_id", "currency", "locale", "fixed_amount", "visible_to_client", "notes", "created_by_user_id"]) assert.equal(generated[field], base[field as keyof typeof base], field);
  for (const field of ["paid_at", "payment_method", "payment_proof_name", "payment_proof_url", "receipt_number", "receipt_snapshot_json", "receipt_generated_at", "sent_at"]) assert.equal(generated[field], null, field);
  assert.equal(generated.status, "open"); assert.equal(generated.recurring, 0);
  assert.equal(generated.recurring_source_invoice_id, base.id);
  assert.notEqual(items[1].id, items[0].id);
  for (const field of ["description", "quantity", "unit_price", "position"] as const) assert.equal(items[1][field], items[0][field]);
  assert.equal(generated.period_label, "outubro de 2026");
  assert.equal(generated.title, "Design mensal · Outubro 2026");
});

test("repeated executions produce one invoice per root/month, without multiplying generated invoices", async () => {
  const { db, rows, counts } = recurringHarness();
  assert.equal((await generateRecurringInvoices(db, october(1))).created, 1);
  assert.equal((await generateRecurringInvoices(db, october(2))).created, 0);
  assert.equal((await generateRecurringInvoices(db, october(30))).created, 0);
  assert.equal(rows.length, 2);
  assert.equal(counts().locked, false);
  assert.equal(counts().releases, 3);
});

test("multiple roots for the same client stay independent; disabled and future roots are skipped", async () => {
  const { db, rows } = recurringHarness([source("a"), source("b", { fixed_amount: 0, visible_to_client: 0 }), source("disabled", { recurring: 0 }), source("future", { issue_date: "2026-11-01" })]);
  assert.equal((await generateRecurringInvoices(db, october(2))).created, 2);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.slice(4).map((row) => row.recurring_source_invoice_id), ["a", "b"]);
  assert.equal(rows[5].visible_to_client, 0); assert.equal(rows[5].fixed_amount, 0);
});

test("base invoice already bills this month and is not duplicated", async () => {
  const { db, rows } = recurringHarness([source("base", { issue_date: "2026-10-01", due_date: "2026-10-10" })]);
  assert.equal((await generateRecurringInvoices(db, october(2))).created, 0);
  assert.equal(rows.length, 1);
});

test("month/year rollover creates only requested current months, never historic backlog", async () => {
  const { db, rows } = recurringHarness([source("old", { issue_date: "2025-01-01", due_date: "2025-01-10" })]);
  for (const now of [october(2), new Date("2026-11-02T12:00:00Z"), new Date("2027-01-02T12:00:00Z")]) await generateRecurringInvoices(db, now);
  assert.deepEqual(rows.slice(1).map((row) => row.recurring_period), ["2026-10", "2026-11", "2027-01"]);
});

test("overlapping job runs are serialized with a connection-scoped database lock", async () => {
  const { db, rows } = recurringHarness();
  const results = await Promise.all([generateRecurringInvoices(db, october(2)), generateRecurringInvoices(db, october(2))]);
  assert.equal(results.reduce((total, result) => total + result.created, 0), 1);
  assert.ok(results.some((result) => result.busy)); assert.equal(rows.length, 2);
});

test("billing period follows APP_TIMEZONE at the UTC month boundary", () => {
  const now = new Date("2026-11-01T01:00:00Z");
  assert.equal(billingMonth(now, "America/Sao_Paulo"), "2026-10");
  assert.equal(billingMonth(now, "Europe/Stockholm"), "2026-11");
});

test("due day clamps short/leap months, restores base day later, and always uses the generated month", () => {
  assert.equal(recurringDates("2026-01-01", "2026-01-31", "2026-02", "pt").dueDate, "2026-02-28");
  assert.equal(recurringDates("2026-01-01", "2026-01-31", "2028-02", "pt").dueDate, "2028-02-29");
  assert.equal(recurringDates("2026-01-01", "2026-01-31", "2026-03", "pt").dueDate, "2026-03-31");
  assert.equal(recurringDates("2026-09-01", "2026-10-10", "2026-12", "en").dueDate, "2026-12-10");
  assert.equal(recurringDates("2026-09-01", "2026-09-10", "2027-01", "en").period, "January 2027");
  for (const locale of ["pt", "en", "it", "es", "sv"]) assert.match(recurringDates("2026-09-01", "2026-09-10", "2026-10", locale).period, /2026/);
});

test("storage migration adds durable origin/month and a unique constraint idempotently", async () => {
  const statements: string[] = [];
  let indexExists = false;
  const db = { query: async (sql: string) => {
    statements.push(sql);
    if (sql.startsWith("SHOW INDEX")) return [indexExists ? [{ Key_name: "uq_invoice_recurring_period" }] : [], []];
    if (sql.includes("ADD UNIQUE KEY uq_invoice_recurring_period")) indexExists = true;
    return [[], []];
  } } as unknown as Pool;
  await ensureInvoiceTables(db); await ensureInvoiceTables(db);
  assert.ok(statements.some((sql) => sql.includes("ADD COLUMN IF NOT EXISTS recurring_source_invoice_id")));
  assert.equal(statements.filter((sql) => sql.includes("ADD UNIQUE KEY uq_invoice_recurring_period (recurring_source_invoice_id, recurring_period)")).length, 1);
});

test("deactivating the source stops future generation without changing existing invoices", async () => {
  const { db, rows } = recurringHarness();
  await generateRecurringInvoices(db, october(2));
  rows[0].recurring = 0;
  assert.equal((await generateRecurringInvoices(db, new Date("2026-11-02T12:00:00Z"))).created, 0);
  assert.equal(rows.length, 2);
});

test("failure of one source does not block healthy sources and releases the database lock", async () => {
  const { db, rows, counts } = recurringHarness([source("broken", { due_date: "invalid" }), source("healthy")]);
  const result = await generateRecurringInvoices(db, october(2));
  assert.deepEqual(result.failedSourceIds, ["broken"]);
  assert.equal(result.created, 1);
  assert.equal(rows[2].recurring_source_invoice_id, "healthy");
  assert.equal(counts().locked, false);
});

test("API recurrence state identifies an existing current invoice or a pending month", async () => {
  const timeZone = "Europe/Stockholm";
  const period = billingMonth(new Date(), timeZone);
  const sourceIds = ["pending", "generated", "base"];
  const db = { query: async (sql: string, values: unknown[]) => {
    if (sql.includes("FROM invoice_items") || sql.includes("FROM invoice_attachments")) return [[], []];
    if (sql.startsWith("SELECT source_invoice_id FROM invoice_recurring_sources")) return [sourceIds.map((source_invoice_id) => ({ source_invoice_id })), []];
    if (sql.startsWith("SELECT id, recurring_source_invoice_id")) {
      assert.deepEqual(values, [...sourceIds, period]);
      return [[{ id: "current-invoice", recurring_source_invoice_id: "generated" }], []];
    }
    return [[source("pending", { issue_date: "2020-01-01" }), source("generated", { issue_date: "2020-01-01" }), source("base", { issue_date: `${period}-01` })], []];
  } } as unknown as Pool;
  const invoices = await listInvoices(db, null, false, timeZone);
  assert.equal(invoices[0].recurrence?.currentInvoiceId, null);
  assert.equal(invoices[0].recurrence?.eligible, true);
  assert.equal(invoices[1].recurrence?.currentInvoiceId, "current-invoice");
  assert.equal(invoices[2].recurrence?.currentInvoiceId, "base");
  assert.equal(invoices[0].recurrence?.currentPeriod, period);
});

test("historical recurring flags do not create sources, and only one confirmed legacy template generates", async () => {
  const originals = [source("march", { title: "Invoice March 2026", legacy_id: "march", issue_date: "2026-03-01", due_date: "2026-03-31" }),
    source("april", { title: "Abril 2026", legacy_id: "april", issue_date: "2026-04-01" }),
    source("september", { title: "Setembro 2026", legacy_id: "september" })];
  const unconfirmed = recurringHarness(originals, []);
  assert.equal((await generateRecurringInvoices(unconfirmed.db, october(3))).created, 0);
  assert.deepEqual(unconfirmed.rows, originals);
  const reviewed = recurringHarness(originals, ["september"]);
  assert.equal((await generateRecurringInvoices(reviewed.db, october(3))).created, 1);
  assert.deepEqual(reviewed.rows.slice(0, 3), originals);
  assert.equal(reviewed.rows[3].title, "Outubro 2026");
  assert.equal(reviewed.rows[3].recurring_source_invoice_id, "september");
  assert.equal((await generateRecurringInvoices(reviewed.db, october(3))).created, 0);
  assert.equal((await generateRecurringInvoices(reviewed.db, new Date("2026-11-03T12:00:00Z"))).created, 1);
  assert.equal(reviewed.rows[4].title, "Novembro 2026");
  assert.equal(reviewed.rows[4].recurring_source_invoice_id, "september");
  assert.ok(!reviewed.statements.some((sql) => /^(UPDATE|DELETE) .*invoices/.test(sql)));
});

test("generated instance cannot be a source even if an old recurring flag and source registry entry exist", async () => {
  const child = source("child", { recurring_source_invoice_id: "root", recurring_period: "2026-09" });
  const { db, rows } = recurringHarness([child], ["child"]);
  assert.equal((await generateRecurringInvoices(db, october(3))).created, 0);
  assert.equal(rows.length, 1);
});

test("monthly title and dated descriptions move to the current period in all supported languages", () => {
  assert.equal(recurringInvoiceTitle("Setembro 2026", "2026-10", "pt"), "Outubro 2026");
  assert.equal(recurringInvoiceTitle("Invoice March 2026", "2026-10", "en"), "Invoice October 2026");
  assert.equal(recurringInvoiceTitle("Fattura Marzo 2026", "2026-10", "it"), "Fattura Ottobre 2026");
  assert.equal(recurringInvoiceTitle("Factura septiembre 2026", "2026-10", "es"), "Factura Octubre 2026");
  assert.equal(recurringInvoiceTitle("Faktura september 2026", "2026-10", "sv"), "Faktura Oktober 2026");
  assert.equal(recurringInvoiceTitle("Social Media", "2026-10", "pt"), "Social Media · Outubro 2026");
  assert.equal(recurringInvoiceTitle("Fatura 09/2026", "2026-10", "pt"), "Fatura Outubro 2026");
  assert.equal(recurringDescription("Recorrência mensal - Setembro 2026", "2026-10", "it"), "Recorrência mensal - Ottobre 2026");
  assert.equal(recurringDescription("Design comercial", "2026-10", "pt"), "Design comercial");
  assert.equal(recurringInvoiceTitle("Dezembro 2026", "2027-01", "pt"), "Janeiro 2027");
});

test("an existing October pair with a historical title is preserved for review, never replaced or duplicated", async () => {
  const base = source("september", { title: "Setembro 2026" });
  const oldInstance = source("bad-october", { recurring: 0, recurring_source_invoice_id: "september", recurring_period: "2026-10", title: "Setembro 2026", issue_date: "2026-10-01", due_date: "2026-10-10" });
  const h = recurringHarness([base, oldInstance], ["september"]);
  const original = structuredClone(h.rows);
  for (let retry = 0; retry < 3; retry++) assert.equal((await generateRecurringInvoices(h.db, october(3))).created, 0);
  assert.deepEqual(h.rows, original);
  assert.ok(!h.statements.some((sql) => /^(INSERT INTO invoices|UPDATE invoices|DELETE FROM invoices)/.test(sql)));
});
