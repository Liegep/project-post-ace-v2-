import { format } from "date-fns";
import { enUS, es, it, pt, sv } from "date-fns/locale";
import issuerLogo from "@/assets/issuer-logo.png";
import { Invoice, InvoiceItem } from "@/hooks/useInvoices";
import { IssuerDetails } from "@/hooks/useIssuerDetails";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

type InvoiceLocale = "pt" | "en" | "it" | "es" | "sv";

const DATE_LOCALES: Record<InvoiceLocale, Locale> = {
  pt,
  en: enUS,
  it,
  es,
  sv,
};

const COPY: Record<InvoiceLocale, Record<string, string>> = {
  pt: {
    invoice: "FATURA",
    from: "De",
    to: "Para",
    issueDate: "Emissão",
    dueDate: "Vencimento",
    paidDate: "Pago em",
    period: "Período",
    item: "Item",
    category: "Categoria",
    date: "Data",
    qty: "Qtd",
    unitPrice: "Unitário",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Desconto",
    surcharge: "Acréscimo",
    payment: "Pagamento",
    notes: "Observações",
    open: "Aberta",
    paid: "Paga",
    overdue: "Atrasada",
    cancelled: "Cancelada",
  },
  en: {
    invoice: "INVOICE",
    from: "From",
    to: "Bill To",
    issueDate: "Issue Date",
    dueDate: "Due Date",
    paidDate: "Paid On",
    period: "Period",
    item: "Item",
    category: "Category",
    date: "Date",
    qty: "Qty",
    unitPrice: "Unit Price",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    surcharge: "Surcharge",
    payment: "Payment",
    notes: "Notes",
    open: "Open",
    paid: "Paid",
    overdue: "Overdue",
    cancelled: "Cancelled",
  },
  it: {
    invoice: "FATTURA",
    from: "Da",
    to: "A",
    issueDate: "Data Emissione",
    dueDate: "Scadenza",
    paidDate: "Pagata il",
    period: "Periodo",
    item: "Voce",
    category: "Categoria",
    date: "Data",
    qty: "Qtà",
    unitPrice: "Prezzo Unit.",
    total: "Totale",
    subtotal: "Subtotale",
    discount: "Sconto",
    surcharge: "Maggiorazione",
    payment: "Pagamento",
    notes: "Note",
    open: "Aperta",
    paid: "Pagata",
    overdue: "Scaduta",
    cancelled: "Annullata",
  },
  es: {
    invoice: "FACTURA",
    from: "De",
    to: "Para",
    issueDate: "Emisión",
    dueDate: "Vencimiento",
    paidDate: "Pagada el",
    period: "Período",
    item: "Ítem",
    category: "Categoría",
    date: "Fecha",
    qty: "Cant.",
    unitPrice: "Unitario",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Descuento",
    surcharge: "Recargo",
    payment: "Pago",
    notes: "Observaciones",
    open: "Abierta",
    paid: "Pagada",
    overdue: "Vencida",
    cancelled: "Cancelada",
  },
  sv: {
    invoice: "FAKTURA",
    from: "Från",
    to: "Till",
    issueDate: "Utfärdad",
    dueDate: "Förfallodatum",
    paidDate: "Betald den",
    period: "Period",
    item: "Artikel",
    category: "Kategori",
    date: "Datum",
    qty: "Antal",
    unitPrice: "Pris/st",
    total: "Totalt",
    subtotal: "Delsumma",
    discount: "Rabatt",
    surcharge: "Tillägg",
    payment: "Betalning",
    notes: "Anteckningar",
    open: "Öppen",
    paid: "Betald",
    overdue: "Försenad",
    cancelled: "Avbruten",
  },
};

const statusClassName: Record<Invoice["status"], string> = {
  open: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-rose-100 text-rose-700",
  cancelled: "bg-stone-200 text-stone-600",
};

const getCopy = (locale?: string) => {
  const key = (locale || "pt") as InvoiceLocale;
  return COPY[key] ? key : "pt";
};

interface Props {
  invoice: Invoice;
  items: InvoiceItem[];
  issuer: IssuerDetails;
  subtotal: number;
  total: number;
  className?: string;
}

export function InvoicePreviewCard({ invoice, items, issuer, subtotal, total, className }: Props) {
  const localeKey = getCopy(invoice.locale || invoice.clients?.locale);
  const t = COPY[localeKey];
  const locale = DATE_LOCALES[localeKey];
  const datePattern = localeKey === "en" ? "MM/dd/yyyy" : "dd/MM/yyyy";
  const formatDate = (value?: string | null) => (value ? format(new Date(value), datePattern, { locale }) : "—");
  const currencyCode = invoice.currency_code || invoice.clients?.billing_currency;
  const recipientName = invoice.recipient_name || invoice.clients?.name || "Cliente";
  const recipientAddress = invoice.recipient_address || invoice.clients?.address || "";
  const recipientCountry = invoice.recipient_country || invoice.clients?.country || "";
  const recipientTaxId = invoice.recipient_tax_id || invoice.clients?.tax_id || "";
  const recipientEmail = invoice.recipient_email || "";

  return (
    <div className={cn("rounded-[32px] border border-stone-200 bg-[#f3ede6] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.10)] md:p-7", className)}>
      <div className="mx-auto max-w-4xl rounded-[28px] bg-[#fffdf9] p-6 text-stone-800 shadow-[0_10px_30px_rgba(15,23,42,0.08)] md:p-10">
        <div className="border-b border-stone-200 pb-8 text-center">
          <img src={issuerLogo} alt={issuer.business_name || "Logo"} className="mx-auto mb-5 max-h-28 object-contain" />
          <p className="text-sm uppercase tracking-[0.35em] text-stone-400">{t.invoice}</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-stone-900">{invoice.title || `${t.invoice} #${invoice.invoice_number}`}</h2>
          <p className="mt-2 font-mono text-sm text-stone-400">#{invoice.invoice_number}</p>
          <div className="mt-4 flex justify-center">
            <span className={cn("rounded-full px-4 py-1 text-xs font-semibold", statusClassName[invoice.status])}>
              {t[invoice.status]}
            </span>
          </div>
        </div>

        <div className="grid gap-10 border-b border-stone-200 py-8 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.28em] text-stone-400">{t.from}</p>
            <p className="text-xl font-semibold text-stone-900">{issuer.business_name || "Sua empresa"}</p>
            <p className="whitespace-pre-wrap text-sm leading-7 text-stone-600">{issuer.address || "Adicione os dados da empresa."}</p>
            <p className="text-sm text-stone-500">{issuer.country || ""}</p>
            <p className="text-sm text-stone-500">{issuer.email || ""}</p>
            <p className="text-sm text-stone-500">{issuer.tax_id || ""}</p>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.28em] text-stone-400">{t.to}</p>
            <p className="text-xl font-semibold text-stone-900">{recipientName}</p>
            <p className="whitespace-pre-wrap text-sm leading-7 text-stone-600">{recipientAddress || "Adicione o nome e endereço do cliente."}</p>
            <p className="text-sm text-stone-500">{recipientCountry || ""}</p>
            <p className="text-sm text-stone-500">{recipientEmail || ""}</p>
            <p className="text-sm text-stone-500">{recipientTaxId || ""}</p>
          </div>
        </div>

        <div className="grid gap-5 border-b border-stone-200 py-6 text-sm md:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">{t.issueDate}</p>
            <p className="mt-2 font-semibold text-stone-900">{formatDate(invoice.issue_date)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">{t.dueDate}</p>
            <p className="mt-2 font-semibold text-stone-900">{formatDate(invoice.due_date)}</p>
          </div>
          {invoice.paid_at && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">{t.paidDate}</p>
              <p className="mt-2 font-semibold text-emerald-700">{formatDate(invoice.paid_at)}</p>
            </div>
          )}
          {invoice.period_start && invoice.period_end && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">{t.period}</p>
              <p className="mt-2 font-semibold text-stone-900">
                {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
              </p>
            </div>
          )}
        </div>

        <div className="overflow-hidden py-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-[0.22em] text-stone-400">
                <th className="py-3 pr-3">{t.item}</th>
                <th className="py-3 pr-3">{t.category}</th>
                <th className="py-3 pr-3">{t.date}</th>
                <th className="py-3 pr-3 text-right">{t.qty}</th>
                <th className="py-3 pr-3 text-right">{t.unitPrice}</th>
                <th className="py-3 text-right">{t.total}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-stone-400">
                    Adicione itens para ver a fatura completa.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-stone-100 align-top text-sm text-stone-700">
                    <td className="py-4 pr-3">
                      <p className="font-medium text-stone-900">{item.name}</p>
                      {item.description && <p className="mt-1 text-xs text-stone-500">{item.description}</p>}
                    </td>
                    <td className="py-4 pr-3">{item.category}</td>
                    <td className="py-4 pr-3">{formatDate(item.service_date)}</td>
                    <td className="py-4 pr-3 text-right">{item.quantity}</td>
                    <td className="py-4 pr-3 text-right">{formatCurrency(Number(item.unit_price || 0), currencyCode)}</td>
                    <td className="py-4 text-right font-semibold">{formatCurrency(Number(item.total_price || 0), currencyCode)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-b border-stone-200 pb-8">
          <div className="w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between text-sm text-stone-600">
              <span>{t.subtotal}</span>
              <span>{formatCurrency(subtotal, currencyCode)}</span>
            </div>
            {Number(invoice.discount || 0) > 0 && (
              <div className="flex items-center justify-between text-sm text-emerald-700">
                <span>{t.discount}</span>
                <span>- {formatCurrency(Number(invoice.discount || 0), currencyCode)}</span>
              </div>
            )}
            {Number(invoice.surcharge || 0) > 0 && (
              <div className="flex items-center justify-between text-sm text-amber-700">
                <span>{t.surcharge}</span>
                <span>+ {formatCurrency(Number(invoice.surcharge || 0), currencyCode)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-stone-900 pt-4 text-2xl font-semibold text-stone-900">
              <span>{t.total}</span>
              <span>{formatCurrency(total, currencyCode)}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 pt-8 md:grid-cols-2">
          <div className="rounded-[22px] bg-[#f4eee8] p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">{t.payment}</p>
            <p className="mt-3 text-sm font-semibold text-stone-900">{invoice.payment_method || issuer.payment_method || "—"}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-stone-600">{invoice.payment_details || issuer.payment_details || "Adicione IBAN, Pix, PayPal ou dados bancários."}</p>
          </div>
          <div className="rounded-[22px] bg-[#faf6f1] p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">{t.notes}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-600">{invoice.notes || "Inclua observações, instruções fiscais ou detalhes extras."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
