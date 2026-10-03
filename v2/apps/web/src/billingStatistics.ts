export const summaryCurrencies = ["BRL", "USD", "EUR"] as const;
type SummaryCurrency = typeof summaryCurrencies[number];
export type CurrencyTotals = Record<SummaryCurrency, number>;

type SummaryInvoice = {
  status: string;
  currency: string;
  lines: readonly { quantity: number; unitPrice: number }[];
};

function emptyCurrencyTotals(): CurrencyTotals {
  return { BRL: 0, USD: 0, EUR: 0 };
}

// Aggregate only valid invoices. Keep cancelled records available to the list and documents.
export function calculateBillingStatistics(invoices: readonly SummaryInvoice[]) {
  const totals = { all: emptyCurrencyTotals(), paid: emptyCurrencyTotals(), open: emptyCurrencyTotals(), overdue: emptyCurrencyTotals() };
  for (const invoice of invoices) {
    if (invoice.status !== "open" && invoice.status !== "paid" && invoice.status !== "overdue") continue;
    if (!summaryCurrencies.includes(invoice.currency as SummaryCurrency)) continue;
    const currency = invoice.currency as SummaryCurrency;
    const total = invoice.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    totals[invoice.status][currency] += total;
    totals.all[currency] += total;
  }
  return totals;
}
