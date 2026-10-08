import type { Pool, RowDataPacket } from "mysql2/promise";
import { billingMonth, recurringDates, recurringInvoiceTitle } from "./invoice-recurring.service.js";

export type RecurringAuditRow = {
  id: string; client_account_id: string | null; invoice_number: number; title: string; recipient_name: string;
  issue_date: string; due_date: string; period_label: string; locale: string; recurring: number;
  recurring_source_invoice_id: string | null; recurring_period: string | null; legacy_id: string | null;
  status: string; receipt_number: string | null; sent_at: string | null;
};
export function analyzeRecurringInvoices(rows: RecurringAuditRow[], confirmedIds: string[], period: string) {
  const roots = rows.filter((row) => row.recurring && !row.recurring_source_invoice_id);
  const confirmed = new Set(confirmedIds);
  const grouped = new Map<string, RecurringAuditRow[]>();
  for (const root of roots) {
    const key = root.client_account_id ?? root.id;
    grouped.set(key, [...grouped.get(key) ?? [], root]);
  }
  const sources = [...grouped.values()].map((candidates) => {
    const ordered = [...candidates].sort((a, b) => b.issue_date.localeCompare(a.issue_date) || b.invoice_number - a.invoice_number);
    return {
      clientAccountId: ordered[0].client_account_id, clientName: ordered[0].recipient_name,
      suggestedSourceId: ordered[0].id, confirmedSourceIds: ordered.filter((row) => confirmed.has(row.id)).map((row) => row.id),
      candidates: ordered.map((row) => ({ id: row.id, number: row.invoice_number, title: row.title, issueDate: row.issue_date, dueDate: row.due_date, legacy: Boolean(row.legacy_id) })),
    };
  });
  const currentInstances = rows.filter((row) => row.recurring_source_invoice_id && row.recurring_period === period);
  const instances = currentInstances.map((row) => {
    const source = rows.find((candidate) => candidate.id === row.recurring_source_invoice_id);
    const problems: string[] = [];
    let expectedTitle: string | null = null;
    let expectedDueDate: string | null = null;
    if (!source || source.recurring_source_invoice_id) problems.push("invalid_source");
    else {
      expectedTitle = recurringInvoiceTitle(source.title, period, source.locale);
      try { expectedDueDate = recurringDates(source.issue_date, source.due_date, period, source.locale).dueDate; }
      catch { problems.push("invalid_source_due_date"); }
      if (row.title !== expectedTitle) problems.push("historical_title");
      if (row.due_date !== expectedDueDate) problems.push("wrong_due_month_or_day");
      if (expectedDueDate && row.period_label !== recurringDates(source.issue_date, source.due_date, period, source.locale).period) problems.push("wrong_period_label");
      if (!confirmed.has(source.id)) problems.push("unconfirmed_source");
    }
    if (row.recurring) problems.push("instance_marked_recurring");
    if (row.issue_date !== `${period}-01`) problems.push("wrong_issue_date");
    if (row.legacy_id || row.status !== "open" || row.receipt_number || row.sent_at) problems.push("has_history_or_delivery_review_required");
    return { id: row.id, number: row.invoice_number, clientName: row.recipient_name, title: row.title,
      sourceId: row.recurring_source_invoice_id!, period, issueDate: row.issue_date, dueDate: row.due_date,
      expectedTitle, expectedDueDate, problems };
  });
  return { period, sources, instances, needsSourceReview: roots.filter((row) => !confirmed.has(row.id)).length };
}
export async function auditRecurringInvoices(db: Pool, now = new Date(), timeZone = "America/Sao_Paulo") {
  const [rows] = await db.query<(RowDataPacket & RecurringAuditRow)[]>(`SELECT id, client_account_id, invoice_number, title, recipient_name,
    issue_date, due_date, period_label, locale, recurring, recurring_source_invoice_id, recurring_period, legacy_id, status, receipt_number, sent_at
    FROM invoices WHERE recurring = 1 OR recurring_source_invoice_id IS NOT NULL
      OR id IN (SELECT recurring_source_invoice_id FROM invoices WHERE recurring_source_invoice_id IS NOT NULL)
    ORDER BY client_account_id, issue_date, invoice_number`);
  const [sources] = await db.query<(RowDataPacket & { source_invoice_id: string })[]>("SELECT source_invoice_id FROM invoice_recurring_sources");
  const dateOnly = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return analyzeRecurringInvoices(rows.map((row) => ({ ...row, issue_date: dateOnly(row.issue_date), due_date: dateOnly(row.due_date) })), sources.map((source) => source.source_invoice_id), billingMonth(now, timeZone));
}
