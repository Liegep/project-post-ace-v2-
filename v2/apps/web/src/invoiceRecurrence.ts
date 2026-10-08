import type { BillingInvoice } from "./api";

export function invoiceRecurrenceLabel(invoice: Pick<BillingInvoice, "recurring" | "recurrence" | "recurringSourceInvoiceId" | "recurringPeriod">) {
  if (invoice.recurringSourceInvoiceId) return `Gerada por recorrência · ${invoice.recurringPeriod ?? ""}`;
  if (!invoice.recurring) return "Fatura avulsa.";
  const state = invoice.recurrence;
  if (!state) return "Recorrência ativa · aguardando atualização.";
  if (!state.sourceConfirmed) return "Histórico recorrente · fonte ainda não definida.";
  const currentIssueDate = `${state.currentPeriod}-01`;
  if (!state.currentInvoiceId && state.eligible) {
    return `Fatura de ${new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long" }).format(new Date(`${currentIssueDate}T12:00:00Z`))} aguardando geração`;
  }
  return `Próxima geração: ${new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${state.nextIssueDate}T12:00:00Z`))}`;
}
