import { ensureRecurringSources, registerNewRecurringSource } from "./invoice-recurring-sources.js";
import { acquireInvoiceNumberLock, releaseInvoiceNumberLock } from "./invoice-number-lock.js";
import { billingMonth, nextBillingIssueDate } from "./invoice-recurring.service.js";
import { ensureBillingSettings, getReceiptSignature } from "./billing-settings.repository.js";
import crypto from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { CreateInvoiceInput, UpdateInvoiceInput } from "./invoices.schemas.js";

type InvoiceRow = RowDataPacket & {
  id: string; client_account_id: string | null; invoice_number: number; title: string;
  recipient_name: string; recipient_email: string; recipient_address: string; recipient_country: string; recipient_tax_id: string;
  issue_date: string | Date; due_date: string | Date; period_label: string; currency: "BRL" | "EUR" | "USD" | "SEK";
  locale: "pt" | "en" | "it" | "es" | "sv"; status: "open" | "paid" | "overdue" | "cancelled";
  recurring_source_invoice_id: string | null; recurring_period: string | null;
  recurring: number; fixed_amount: number; visible_to_client: number; sent_at: string | null; notes: string;
  paid_at: string | Date | null; payment_method: string | null; payment_proof_name: string | null; payment_proof_url: string | null;
  receipt_number: string | null; receipt_generated_at: string | null; receipt_snapshot_json: string | Record<string, unknown> | null;
  created_at: string; updated_at: string;
};
type LineRow = RowDataPacket & { id: string; invoice_id: string; description: string; quantity: string | number; unit_price: string | number };
type AttachmentRow = RowDataPacket & { id: string; invoice_id: string; file_name: string; file_url: string };
type Executor = Pool | PoolConnection;
const columns = "id, client_account_id, invoice_number, title, recipient_name, recipient_email, recipient_address, recipient_country, recipient_tax_id, issue_date, due_date, period_label, currency, locale, status, recurring, fixed_amount, visible_to_client, sent_at, notes, paid_at, payment_method, payment_proof_name, payment_proof_url, receipt_number, receipt_generated_at, receipt_snapshot_json, recurring_source_invoice_id, recurring_period, created_at, updated_at";
const dateOnly = (value: string | Date) => value instanceof Date ? value.toISOString().slice(0, 10) : value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? value;

export async function ensureInvoiceTables(db: Pool) {
  await ensureBillingSettings(db);
  await db.query(`CREATE TABLE IF NOT EXISTS invoices (
    id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NULL, invoice_number INT NOT NULL,
    title VARCHAR(255) NOT NULL, recipient_name VARCHAR(255) NOT NULL DEFAULT '', recipient_email VARCHAR(255) NOT NULL DEFAULT '',
    recipient_address TEXT NOT NULL, recipient_country VARCHAR(120) NOT NULL DEFAULT '', recipient_tax_id VARCHAR(120) NOT NULL DEFAULT '',
    issue_date DATE NOT NULL, due_date DATE NOT NULL, period_label VARCHAR(255) NOT NULL DEFAULT '', currency CHAR(3) NOT NULL DEFAULT 'BRL',
    locale VARCHAR(10) NOT NULL DEFAULT 'pt', status ENUM('open','paid','overdue','cancelled') NOT NULL DEFAULT 'open',
    recurring TINYINT(1) NOT NULL DEFAULT 0, fixed_amount TINYINT(1) NOT NULL DEFAULT 1, visible_to_client TINYINT(1) NOT NULL DEFAULT 0,
    sent_at DATETIME NULL, notes TEXT NOT NULL,
    paid_at DATE NULL, payment_method VARCHAR(120) NULL, payment_proof_name VARCHAR(255) NULL, payment_proof_url VARCHAR(2000) NULL,
    receipt_number VARCHAR(64) NULL, receipt_generated_at DATETIME NULL, receipt_snapshot_json JSON NULL,
    created_by_user_id CHAR(36) NULL, legacy_id VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_invoices_legacy_id (legacy_id), KEY idx_invoices_number (invoice_number), KEY idx_invoices_account_due (client_account_id, due_date),
    CONSTRAINT fk_invoices_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_invoices_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await db.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at DATE NULL");
  await db.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(120) NULL");
  await db.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_proof_name VARCHAR(255) NULL");
  await db.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_proof_url VARCHAR(2000) NULL");
  await db.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(64) NULL");
  await db.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_generated_at DATETIME NULL");
  await db.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_snapshot_json JSON NULL");
  await db.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring_source_invoice_id CHAR(36) NULL");
  await db.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring_period CHAR(7) NULL");
  const [indexes] = await db.query<RowDataPacket[]>("SHOW INDEX FROM invoices WHERE Key_name = 'uq_invoice_recurring_period'");
  if (!indexes.length) {
    try { await db.query("ALTER TABLE invoices ADD UNIQUE KEY uq_invoice_recurring_period (recurring_source_invoice_id, recurring_period)"); }
    catch (error) { if ((error as { code?: string }).code !== "ER_DUP_KEYNAME") throw error; }
  }
  await ensureRecurringSources(db);
  await db.query(`CREATE TABLE IF NOT EXISTS invoice_items (
    id CHAR(36) NOT NULL PRIMARY KEY, invoice_id CHAR(36) NOT NULL, description TEXT NOT NULL, quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
    unit_price DECIMAL(14,2) NOT NULL DEFAULT 0, position INT NOT NULL DEFAULT 0, legacy_id VARCHAR(120) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_invoice_items_legacy_id (legacy_id), KEY idx_invoice_items_invoice (invoice_id, position),
    CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS invoice_attachments (
    id CHAR(36) NOT NULL PRIMARY KEY, invoice_id CHAR(36) NOT NULL, file_name VARCHAR(255) NOT NULL, file_url VARCHAR(2000) NOT NULL,
    uploaded_by_user_id CHAR(36) NULL, legacy_id VARCHAR(120) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_invoice_attachments_legacy_id (legacy_id), KEY idx_invoice_attachments_invoice (invoice_id),
    CONSTRAINT fk_invoice_attachments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_invoice_attachments_user FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

async function hydrate(db: Executor, rows: InvoiceRow[], timeZone = process.env.APP_TIMEZONE ?? "America/Sao_Paulo") {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id); const placeholders = ids.map(() => "?").join(",");
  const [lineRows] = await db.query<LineRow[]>(`SELECT id, invoice_id, description, quantity, unit_price FROM invoice_items WHERE invoice_id IN (${placeholders}) ORDER BY position, created_at`, ids);
  const [attachmentRows] = await db.query<AttachmentRow[]>(`SELECT id, invoice_id, file_name, file_url FROM invoice_attachments WHERE invoice_id IN (${placeholders}) ORDER BY created_at`, ids);
  const currentPeriod = billingMonth(new Date(), timeZone);
  const sourceIds = rows.filter((row) => row.recurring && !row.recurring_source_invoice_id).map((row) => row.id);
  const generated = new Map<string, string>();
  const confirmed = new Set<string>();
  if (sourceIds.length) {
    const [periodRows] = await db.query<(RowDataPacket & { id: string; recurring_source_invoice_id: string })[]>(
      `SELECT id, recurring_source_invoice_id FROM invoices WHERE recurring_source_invoice_id IN (${sourceIds.map(() => "?").join(",")}) AND recurring_period = ?`, [...sourceIds, currentPeriod],
    );
    for (const item of periodRows) generated.set(item.recurring_source_invoice_id, item.id);
    const [sourceRows] = await db.query<(RowDataPacket & { source_invoice_id: string })[]>(
      `SELECT source_invoice_id FROM invoice_recurring_sources WHERE source_invoice_id IN (${sourceIds.map(() => "?").join(",")})`, sourceIds,
    );
    for (const source of sourceRows) confirmed.add(source.source_invoice_id);
  }
  return rows.map((row) => ({
    id: row.id, clientAccountId: row.client_account_id, number: Number(row.invoice_number), title: row.title,
    clientName: row.recipient_name, clientEmail: row.recipient_email, clientAddress: row.recipient_address,
    clientCountry: row.recipient_country, clientTaxId: row.recipient_tax_id, issueDate: dateOnly(row.issue_date), dueDate: dateOnly(row.due_date),
    period: row.period_label, currency: row.currency, locale: row.locale, status: row.status, recurring: Boolean(row.recurring),
    recurringSourceInvoiceId: row.recurring_source_invoice_id ?? null, recurringPeriod: row.recurring_period ?? null,
    recurrence: row.recurring && !row.recurring_source_invoice_id ? {
      sourceConfirmed: confirmed.has(row.id), currentPeriod, eligible: dateOnly(row.issue_date).slice(0, 7) <= currentPeriod, currentInvoiceId: dateOnly(row.issue_date).slice(0, 7) === currentPeriod ? row.id : generated.get(row.id) ?? null,
      nextIssueDate: nextBillingIssueDate(dateOnly(row.issue_date).slice(0, 7) > currentPeriod ? dateOnly(row.issue_date).slice(0, 7) : currentPeriod), timeZone,
    } : null,
    fixedAmount: Boolean(row.fixed_amount), visibleToClient: Boolean(row.visible_to_client), sentToClient: Boolean(row.sent_at), notes: row.notes,
    paidAt: row.paid_at ? dateOnly(row.paid_at) : null, paymentMethod: row.payment_method,
    paymentProofName: row.payment_proof_name, paymentProofUrl: row.payment_proof_url,
    receiptNumber: row.receipt_number, receiptGeneratedAt: row.receipt_generated_at,
    receiptSnapshot: typeof row.receipt_snapshot_json === "string" ? JSON.parse(row.receipt_snapshot_json) : row.receipt_snapshot_json,
    lines: lineRows.filter((item) => item.invoice_id === row.id).map((item) => ({ id: item.id, description: item.description, quantity: Number(item.quantity), unitPrice: Number(item.unit_price) })),
    attachments: attachmentRows.filter((item) => item.invoice_id === row.id).map((item) => ({ id: item.id, fileName: item.file_name, fileUrl: item.file_url })),
    createdAt: row.created_at, updatedAt: row.updated_at,
  }));
}

export async function listInvoices(db: Pool, clientIds: string[] | null, portalOnly = false, timeZone = process.env.APP_TIMEZONE ?? "America/Sao_Paulo") {
  const where: string[] = []; const params: unknown[] = [];
  if (clientIds) { if (!clientIds.length) return []; where.push(`client_account_id IN (${clientIds.map(() => "?").join(",")})`); params.push(...clientIds); }
  if (portalOnly) where.push("visible_to_client = 1 AND sent_at IS NOT NULL");
  const [rows] = await db.query<InvoiceRow[]>(`SELECT ${columns} FROM invoices${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY invoice_number DESC, created_at DESC`, params);
  return hydrate(db, rows, timeZone);
}
export async function findInvoice(db: Pool, id: string) { const [rows] = await db.query<InvoiceRow[]>(`SELECT ${columns} FROM invoices WHERE id = ? LIMIT 1`, [id]); return (await hydrate(db, rows))[0] ?? null; }

async function replaceChildren(connection: PoolConnection, id: string, input: Pick<CreateInvoiceInput, "lines" | "attachments">, userId: string | null) {
  await connection.query("DELETE FROM invoice_items WHERE invoice_id = ?", [id]);
  for (const [position, line] of input.lines.entries()) await connection.query("INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, position) VALUES (?, ?, ?, ?, ?, ?)", [line.id ?? crypto.randomUUID(), id, line.description, line.quantity, line.unitPrice, position]);
  await connection.query("DELETE FROM invoice_attachments WHERE invoice_id = ?", [id]);
  for (const attachment of input.attachments) await connection.query("INSERT INTO invoice_attachments (id, invoice_id, file_name, file_url, uploaded_by_user_id) VALUES (?, ?, ?, ?, ?)", [attachment.id ?? crypto.randomUUID(), id, attachment.fileName, attachment.fileUrl, userId]);
}

export async function createInvoice(db: Pool, userId: string, input: CreateInvoiceInput) {
  const connection = await db.getConnection(); const id = crypto.randomUUID();
  let locked = false;
  try {
    locked = await acquireInvoiceNumberLock(connection, 10);
    if (!locked) throw new Error("A geração de faturas está ocupada. Tente novamente.");
    await connection.beginTransaction(); const [numberRows] = await connection.query<(RowDataPacket & { next_number: number })[]>("SELECT COALESCE(MAX(invoice_number), 0) + 1 AS next_number FROM invoices FOR UPDATE"); const number = Number(numberRows[0]?.next_number ?? 1);
    await connection.query(`INSERT INTO invoices (id, client_account_id, invoice_number, title, recipient_name, recipient_email, recipient_address, recipient_country, recipient_tax_id, issue_date, due_date, period_label, currency, locale, status, recurring, fixed_amount, visible_to_client, sent_at, notes, created_by_user_id, paid_at, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, input.clientAccountId, number, input.title, input.clientName, input.clientEmail, input.clientAddress, input.clientCountry, input.clientTaxId, input.issueDate, input.dueDate, input.period, input.currency, input.locale, input.status, input.recurring, input.fixedAmount, input.visibleToClient, input.sentToClient ? new Date() : null, input.notes, userId, input.paidAt ?? null, input.paymentMethod ?? null]);
    await replaceChildren(connection, id, input, userId); if (input.recurring) await registerNewRecurringSource(connection, id, userId); if (input.status === "paid") await issueReceipt(connection, id); await connection.commit(); return findInvoice(db, id);
  } catch (error) { await connection.rollback(); throw error; } finally { try { if (locked) await releaseInvoiceNumberLock(connection); } finally { connection.release(); } }
}

export async function updateInvoice(db: Pool, id: string, userId: string, input: UpdateInvoiceInput) {
  const connection = await db.getConnection();
  try { await connection.beginTransaction(); const fields: string[] = []; const values: unknown[] = [];
    const entries: Array<[keyof UpdateInvoiceInput, string]> = [["clientAccountId","client_account_id"],["title","title"],["clientName","recipient_name"],["clientEmail","recipient_email"],["clientAddress","recipient_address"],["clientCountry","recipient_country"],["clientTaxId","recipient_tax_id"],["issueDate","issue_date"],["dueDate","due_date"],["period","period_label"],["currency","currency"],["locale","locale"],["status","status"],["recurring","recurring"],["fixedAmount","fixed_amount"],["visibleToClient","visible_to_client"],["notes","notes"],["paidAt","paid_at"],["paymentMethod","payment_method"],["paymentProofName","payment_proof_name"],["paymentProofUrl","payment_proof_url"]];
    for (const [key, column] of entries) if (typeof input[key] !== "undefined") { fields.push(`${column} = ?`); values.push(input[key]); }
    if (typeof input.sentToClient !== "undefined") { fields.push("sent_at = ?"); values.push(input.sentToClient ? new Date() : null); }
    if (fields.length) { values.push(id); await connection.query(`UPDATE invoices SET ${fields.join(", ")} WHERE id = ?`, values); }
    if (input.lines || input.attachments) { const existing = await findInvoice(db, id); if (!existing) throw new Error("Invoice not found"); await replaceChildren(connection, id, { lines: input.lines ?? existing.lines, attachments: input.attachments ?? existing.attachments }, userId); }
    if (input.status === "paid") await issueReceipt(connection, id);
    await connection.commit(); return findInvoice(db, id);
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}
export async function deleteInvoice(db: Pool, id: string) { const [result] = await db.query("DELETE FROM invoices WHERE id = ?", [id]) as [{ affectedRows: number }, unknown]; return result.affectedRows > 0; }


async function issueReceipt(connection: PoolConnection, id: string) {
  const [rows] = await connection.query<InvoiceRow[]>(`SELECT ${columns} FROM invoices WHERE id = ? FOR UPDATE`, [id]);
  const current = (await hydrate(connection, rows))[0] ?? null;
  if (!current || current.receiptNumber) return current;
  const paidAt = current.paidAt ?? new Date().toISOString().slice(0, 10);
  const receiptNumber = `REC-${paidAt.slice(0, 4)}-${String(current.number).padStart(4, "0")}`;
  const snapshot = {
    receiptNumber, invoiceNumber: current.number,
    clientName: current.clientName, clientEmail: current.clientEmail,
    clientAddress: current.clientAddress, clientCountry: current.clientCountry, clientTaxId: current.clientTaxId,
    paidAt, paymentMethod: current.paymentMethod, currency: current.currency,
    period: current.period, title: current.title, notes: current.notes, lines: current.lines,
    total: current.lines.reduce((sum: number, line: { quantity: number; unitPrice: number }) => sum + line.quantity * line.unitPrice, 0),
    signatureUrl: await getReceiptSignature(connection),
  };
  await connection.query(
    "UPDATE invoices SET status = 'paid', paid_at = ?, receipt_number = ?, receipt_generated_at = NOW(), receipt_snapshot_json = ? WHERE id = ?",
    [paidAt, receiptNumber, JSON.stringify(snapshot), id],
  );
  return current;
}

export async function generateInvoiceReceipt(db: Pool, id: string) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const current = await issueReceipt(connection, id);
    await connection.commit();
    return current ? findInvoice(db, id) : null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
