import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { createInvoice, generateInvoiceReceipt, updateInvoice } from "./invoices.repository.js";
import { getReceiptSignature, setReceiptSignature } from "./billing-settings.repository.js";

function harness(signature: string | null = "/api/uploads/aaaa.webp") {
  const row: Record<string, unknown> = {
    id: "invoice", invoice_number: 1, recipient_name: "Cliente", recipient_email: "", recipient_address: "",
    recipient_country: "", recipient_tax_id: "", issue_date: "2026-10-02", due_date: "2026-10-10", period_label: "Outubro",
    currency: "BRL", locale: "pt", status: "open", title: "Serviços", notes: "", paid_at: "2026-10-02",
    receipt_number: null, receipt_snapshot_json: null,
  };
  let reference = signature;
  const statements: string[] = [];
  let commits = 0;
  let rollbacks = 0;
  let releases = 0;
  let failSnapshot = false;
  const query = async (sql: string, values: unknown[] = []) => {
    statements.push(sql);
    if (sql.includes("AS next_number")) return [[{ next_number: 1 }], []];
    if (sql.startsWith("INSERT INTO invoices")) { Object.assign(row, { id: values[0], status: values[14], paid_at: values[21], payment_method: values[22] }); return [{ affectedRows: 1 }, []]; }
    if (sql.startsWith("DELETE FROM invoice_") || sql.startsWith("INSERT INTO invoice_")) return [{ affectedRows: 1 }, []];
    if (sql.includes("FROM billing_settings")) return [[{ receipt_signature_url: reference }], []];
    if (sql.startsWith("INSERT INTO billing_settings")) { reference = values[0] as string | null; return [{ affectedRows: 1 }, []]; }
    if (sql.startsWith("SELECT") && sql.includes("FROM invoices")) return [[{ ...row }], []];
    if (sql.includes("FROM invoice_items")) return [[{ id: "line", invoice_id: "invoice", description: "Design", quantity: 1, unit_price: 100 }], []];
    if (sql.includes("FROM invoice_attachments")) return [[], []];
    if (sql.includes("receipt_snapshot_json = ?")) {
      if (failSnapshot) throw new Error("snapshot write failure");
      Object.assign(row, { status: "paid", paid_at: values[0], receipt_number: values[1], receipt_snapshot_json: values[2] });
      return [{ affectedRows: 1 }, []];
    }
    if (sql.startsWith("UPDATE invoices SET status = ?")) { row.status = values[0]; return [{ affectedRows: 1 }, []]; }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const connection = { query, beginTransaction: async () => {}, commit: async () => { commits++; }, rollback: async () => { rollbacks++; }, release: () => { releases++; } };
  const db = { query, getConnection: async () => connection } as unknown as Pool;
  return { db, row, statements, fail: () => { failSnapshot = true; }, counts: () => ({ commits, rollbacks, releases }) };
}

test("receipt freezes current signature alongside the original invoice snapshot", async () => {
  const { db, statements } = harness();
  const receipt = await generateInvoiceReceipt(db, "invoice");
  const snapshot = receipt?.receiptSnapshot as Record<string, unknown>;
  assert.equal(snapshot.signatureUrl, "/api/uploads/aaaa.webp");
  assert.equal(snapshot.total, 100);
  assert.equal(receipt?.status, "paid");
  assert.ok(statements.some((sql) => sql.endsWith("FOR UPDATE")));
});

test("replacing then removing settings preserves old snapshots; new receipts use the current setting", async () => {
  const { db, row } = harness();
  const original = (await generateInvoiceReceipt(db, "invoice"))?.receiptSnapshot;
  await setReceiptSignature(db, "/api/uploads/bbbb.webp");
  assert.equal(await getReceiptSignature(db), "/api/uploads/bbbb.webp");
  assert.deepEqual((await generateInvoiceReceipt(db, "invoice"))?.receiptSnapshot, original);
  row.receipt_number = null; row.receipt_snapshot_json = null;
  assert.equal(((await generateInvoiceReceipt(db, "invoice"))?.receiptSnapshot as Record<string, unknown>).signatureUrl, "/api/uploads/bbbb.webp");
  await setReceiptSignature(db, null);
  assert.equal(((await generateInvoiceReceipt(db, "invoice"))?.receiptSnapshot as Record<string, unknown>).signatureUrl, "/api/uploads/bbbb.webp");
  row.receipt_number = null; row.receipt_snapshot_json = null;
  assert.equal(((await generateInvoiceReceipt(db, "invoice"))?.receiptSnapshot as Record<string, unknown>).signatureUrl, null);
});

test("marking paid automatically issues a signed receipt in the same transaction", async () => {
  const { db, counts } = harness();
  const receipt = await updateInvoice(db, "invoice", "user", { status: "paid" });
  assert.equal(receipt?.receiptNumber, "REC-2026-0001");
  assert.equal((receipt?.receiptSnapshot as Record<string, unknown>).signatureUrl, "/api/uploads/aaaa.webp");
  assert.deepEqual(counts(), { commits: 1, rollbacks: 0, releases: 1 });
});

test("receipt failure rolls back paid transition and releases the connection", async () => {
  const { db, fail, counts } = harness();
  fail();
  await assert.rejects(updateInvoice(db, "invoice", "user", { status: "paid" }), /snapshot write failure/);
  assert.deepEqual(counts(), { commits: 0, rollbacks: 1, releases: 1 });
});

test("no signature is a valid receipt and repeated generation never rewrites the snapshot", async () => {
  const { db, statements } = harness(null);
  const receipt = await generateInvoiceReceipt(db, "invoice");
  assert.equal((receipt?.receiptSnapshot as Record<string, unknown>).signatureUrl, null);
  await generateInvoiceReceipt(db, "invoice");
  assert.equal(statements.filter((sql) => sql.includes("receipt_snapshot_json = ?")).length, 1);
});

test("invoice created already paid issues a receipt with the supplied payment details", async () => {
  const { db, counts } = harness();
  const receipt = await createInvoice(db, "user", {
    clientAccountId: null, title: "Design", clientName: "Cliente", clientEmail: "", clientAddress: "", clientCountry: "", clientTaxId: "",
    issueDate: "2026-10-02", dueDate: "2026-10-10", period: "Outubro", currency: "BRL", locale: "pt", status: "paid", recurring: false,
    fixedAmount: true, visibleToClient: false, sentToClient: false, notes: "", lines: [], attachments: [], paidAt: "2026-09-30", paymentMethod: "Pix",
  });
  const snapshot = receipt?.receiptSnapshot as Record<string, unknown>;
  assert.equal(snapshot.signatureUrl, "/api/uploads/aaaa.webp");
  assert.equal(snapshot.paidAt, "2026-09-30");
  assert.equal(snapshot.paymentMethod, "Pix");
  assert.deepEqual(counts(), { commits: 1, rollbacks: 0, releases: 1 });
});
