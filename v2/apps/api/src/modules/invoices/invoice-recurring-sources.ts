import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { acquireInvoiceNumberLock, releaseInvoiceNumberLock } from "./invoice-number-lock.js";

export async function ensureRecurringSources(db: Pool) {
  // Empty on upgrade: historic recurring flags are not sufficient evidence of a template.
  await db.query(`CREATE TABLE IF NOT EXISTS invoice_recurring_sources (
    source_invoice_id CHAR(36) NOT NULL PRIMARY KEY,
    confirmed_by_user_id CHAR(36) NULL,
    confirmed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}
export async function registerNewRecurringSource(connection: PoolConnection, invoiceId: string, userId: string) {
  await connection.query("INSERT INTO invoice_recurring_sources (source_invoice_id, confirmed_by_user_id) VALUES (?, ?)", [invoiceId, userId]);
}

/** Explicit operator selection; never called by startup or legacy import. */
export async function confirmRecurringSource(db: Pool, invoiceId: string, userId: string) {
  const connection = await db.getConnection();
  let locked = false;
  try {
    locked = await acquireInvoiceNumberLock(connection, 10);
    if (!locked) throw new Error("A geração está em andamento. Tente novamente.");
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>("SELECT id, client_account_id, legacy_id, recurring, recurring_source_invoice_id FROM invoices WHERE id = ? FOR UPDATE", [invoiceId]);
    const invoice = rows[0];
    if (!invoice || !invoice.recurring || invoice.recurring_source_invoice_id) throw new Error("Escolha uma fatura-base com recorrência ativa, não uma instância gerada.");
    if (invoice.legacy_id && invoice.client_account_id) {
      const [otherSources] = await connection.query<RowDataPacket[]>(
        "SELECT i.id FROM invoice_recurring_sources s JOIN invoices i ON i.id = s.source_invoice_id WHERE i.client_account_id = ? AND i.legacy_id IS NOT NULL AND i.recurring = 1 AND i.id <> ? LIMIT 1", [invoice.client_account_id, invoiceId],
      );
      if (otherSources.length) throw new Error("Este cliente já possui uma fonte histórica definida. Não crie outra cadeia para os meses antigos.");
    }
    await connection.query("INSERT INTO invoice_recurring_sources (source_invoice_id, confirmed_by_user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE source_invoice_id = VALUES(source_invoice_id)", [invoiceId, userId]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { try { if (locked) await releaseInvoiceNumberLock(connection); } finally { connection.release(); } }
}
