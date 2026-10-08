import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { acquireInvoiceNumberLock, releaseInvoiceNumberLock } from "./invoice-number-lock.js";

export function billingMonth(now = new Date(), timeZone = "America/Sao_Paulo") {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}`;
}
export function nextBillingIssueDate(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}
const dateOnly = (value: string | Date) => value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
const locales: Record<string, string> = { pt: "pt-BR", en: "en-US", it: "it-IT", es: "es-ES", sv: "sv-SE" };
export function recurringDates(issueDate: string | Date, dueDate: string | Date, period: string, locale: string) {
  const [year, month] = period.split("-").map(Number);
  const dueDay = Number(dateOnly(dueDate).slice(8, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly(dueDate)) || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) throw new Error("Vencimento da fonte inválido.");
  const targetMonth = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const due = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), Math.min(dueDay, lastDay)));
  return {
    issueDate: `${period}-01`, dueDate: due.toISOString().slice(0, 10),
    period: new Intl.DateTimeFormat(locales[locale] ?? "pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${period}-01T12:00:00Z`)),
  };
}

const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "settembre", "ottobre", "novembre", "dicembre", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre", "januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
const monthReference = new RegExp(`\\b(?:${[...new Set(monthNames)].join("|")})\\s+(?:de\\s+)?20\\d{2}\\b|\\b(?:\\d{2}[/-])?(?:0[1-9]|1[0-2])[/-]20\\d{2}\\b`, "giu");
export function recurringMonthTitle(period: string, locale: string) {
  const month = new Intl.DateTimeFormat(locales[locale] ?? "pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(`${period}-01T12:00:00Z`));
  return `${month.charAt(0).toLocaleUpperCase(locales[locale] ?? "pt-BR")}${month.slice(1)} ${period.slice(0, 4)}`;
}
export function recurringDescription(value: string, period: string, locale: string) {
  return value.replace(monthReference, recurringMonthTitle(period, locale));
}
export function recurringInvoiceTitle(value: string, period: string, locale: string) {
  const replaced = recurringDescription(value, period, locale);
  const month = recurringMonthTitle(period, locale);
  return replaced !== value || value.includes(month) ? replaced.slice(0, 255) : `${value.slice(0, 230)} · ${month}`;
}

/** Generates only the current month, including startup catch-up after day 1. */
export async function generateRecurringInvoices(db: Pool, now = new Date(), timeZone = "America/Sao_Paulo") {
  const period = billingMonth(now, timeZone);
  const connection = await db.getConnection();
  let locked = false;
  let created = 0;
  let skipped = 0;
  const failedSourceIds: string[] = [];
  try {
    // Also shared by manual invoice creation so MAX(invoice_number) cannot race.
    locked = await acquireInvoiceNumberLock(connection, 0);
    if (!locked) return { period, created, skipped, failedSourceIds, busy: true };
    const [sources] = await connection.query<(RowDataPacket & { id: string })[]>(
      "SELECT i.id FROM invoice_recurring_sources s JOIN invoices i ON i.id = s.source_invoice_id WHERE i.recurring = 1 AND i.recurring_source_invoice_id IS NULL AND i.issue_date <= ? ORDER BY i.id",
      [`${period}-01`],
    );
    for (const { id } of sources) {
      await connection.beginTransaction();
      try {
        // Recheck under lock: disabling/editing the source is serialized with generation.
        const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT i.* FROM invoice_recurring_sources s JOIN invoices i ON i.id = s.source_invoice_id WHERE i.id = ? AND i.recurring = 1 AND i.recurring_source_invoice_id IS NULL FOR UPDATE", [id],
        );
        const source = rows[0];
        if (!source || dateOnly(source.issue_date).slice(0, 7) > period) { skipped++; await connection.commit(); continue; }
        const [existing] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM invoices WHERE recurring_source_invoice_id = ? AND recurring_period = ? LIMIT 1", [id, period],
        );
        // The base invoice itself already bills its issue month; don't duplicate it.
        if (existing.length || dateOnly(source.issue_date).slice(0, 7) === period) { skipped++; await connection.commit(); continue; }
        const dates = recurringDates(source.issue_date, source.due_date, period, source.locale);
        const [numbers] = await connection.query<(RowDataPacket & { next_number: number })[]>(
          "SELECT COALESCE(MAX(invoice_number), 0) + 1 AS next_number FROM invoices",
        );
        const newId = crypto.randomUUID();
        await connection.query(`INSERT INTO invoices (
          id, client_account_id, invoice_number, title, recipient_name, recipient_email, recipient_address, recipient_country, recipient_tax_id,
          issue_date, due_date, period_label, currency, locale, status, recurring, fixed_amount, visible_to_client, sent_at, notes, created_by_user_id,
          recurring_source_invoice_id, recurring_period
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 0, ?, ?, NULL, ?, ?, ?, ?)`,
        [newId, source.client_account_id, Number(numbers[0].next_number), recurringInvoiceTitle(source.title, period, source.locale), source.recipient_name, source.recipient_email,
          source.recipient_address, source.recipient_country, source.recipient_tax_id, dates.issueDate, dates.dueDate, dates.period,
          source.currency, source.locale, source.fixed_amount, source.visible_to_client, source.notes, source.created_by_user_id, id, period]);
        const [lines] = await connection.query<RowDataPacket[]>(
          "SELECT description, quantity, unit_price, position FROM invoice_items WHERE invoice_id = ? ORDER BY position, created_at", [id],
        );
        for (const line of lines) await connection.query(
          "INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, position) VALUES (?, ?, ?, ?, ?, ?)",
          [crypto.randomUUID(), newId, recurringDescription(line.description, period, source.locale), line.quantity, line.unit_price, line.position],
        );
        // Payment, proof, attachments and receipt fields remain at their NULL/default values.
        await connection.commit();
        created++;
      } catch { await connection.rollback(); failedSourceIds.push(id); }
    }
    return { period, created, skipped, failedSourceIds, busy: false };
  } finally {
    try { if (locked) await releaseInvoiceNumberLock(connection); }
    finally { connection.release(); }
  }
}
