import { Invoice, InvoiceItem } from "@/hooks/useInvoices";
import { format } from "date-fns";
import { pt, enUS, it, es, sv } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";
import { fetchIssuerDetails, IssuerDetails } from "@/hooks/useIssuerDetails";
import issuerLogo from "@/assets/issuer-logo.png";

type Locale = "pt" | "en" | "it" | "es" | "sv";

const DATE_FN_LOCALES: Record<Locale, any> = { pt, en: enUS, it, es, sv };

const T: Record<Locale, Record<string, string>> = {
  pt: {
    invoice: "FATURA",
    statusOpen: "Aberta", statusPaid: "Paga", statusOverdue: "Atrasada", statusCancelled: "Cancelada",
    from: "De", to: "Para", taxId: "NIF",
    issueDate: "Emissão", dueDate: "Vencimento", paidDate: "Pago em", period: "Período",
    item: "Item", category: "Categoria", date: "Data", qty: "Qtd", unitPrice: "Unitário", total: "Total",
    subtotal: "Subtotal", discount: "Desconto", surcharge: "Acréscimo",
    payment: "Pagamento", notes: "Observações",
  },
  en: {
    invoice: "INVOICE",
    statusOpen: "Open", statusPaid: "Paid", statusOverdue: "Overdue", statusCancelled: "Cancelled",
    from: "From", to: "Bill To", taxId: "Tax ID",
    issueDate: "Issue Date", dueDate: "Due Date", paidDate: "Paid On", period: "Period",
    item: "Item", category: "Category", date: "Date", qty: "Qty", unitPrice: "Unit Price", total: "Total",
    subtotal: "Subtotal", discount: "Discount", surcharge: "Surcharge",
    payment: "Payment", notes: "Notes",
  },
  it: {
    invoice: "FATTURA",
    statusOpen: "Aperta", statusPaid: "Pagata", statusOverdue: "Scaduta", statusCancelled: "Annullata",
    from: "Da", to: "A", taxId: "P. IVA",
    issueDate: "Data Emissione", dueDate: "Scadenza", paidDate: "Pagata il", period: "Periodo",
    item: "Voce", category: "Categoria", date: "Data", qty: "Qtà", unitPrice: "Prezzo Unit.", total: "Totale",
    subtotal: "Subtotale", discount: "Sconto", surcharge: "Maggiorazione",
    payment: "Pagamento", notes: "Note",
  },
  es: {
    invoice: "FACTURA",
    statusOpen: "Abierta", statusPaid: "Pagada", statusOverdue: "Vencida", statusCancelled: "Cancelada",
    from: "De", to: "Para", taxId: "NIF",
    issueDate: "Emisión", dueDate: "Vencimiento", paidDate: "Pagada el", period: "Período",
    item: "Ítem", category: "Categoría", date: "Fecha", qty: "Cant.", unitPrice: "Unitario", total: "Total",
    subtotal: "Subtotal", discount: "Descuento", surcharge: "Recargo",
    payment: "Pago", notes: "Observaciones",
  },
  sv: {
    invoice: "FAKTURA",
    statusOpen: "Öppen", statusPaid: "Betald", statusOverdue: "Försenad", statusCancelled: "Avbruten",
    from: "Från", to: "Till", taxId: "Org.nr",
    issueDate: "Utfärdad", dueDate: "Förfallodatum", paidDate: "Betald den", period: "Period",
    item: "Artikel", category: "Kategori", date: "Datum", qty: "Antal", unitPrice: "Pris/st", total: "Totalt",
    subtotal: "Delsumma", discount: "Rabatt", surcharge: "Tillägg",
    payment: "Betalning", notes: "Anteckningar",
  },
};

const escapeHtml = (s: string) =>
  (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");

async function imageUrlToDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export async function generateInvoicePDF(
  invoice: Invoice,
  items: InvoiceItem[],
  total: number,
  subtotal: number,
  currencyCode?: string,
  issuerOverride?: IssuerDetails
) {
  const issuer = issuerOverride ?? (await fetchIssuerDetails());

  const rawLocale = (invoice.locale || invoice.clients?.locale || "pt") as Locale;
  const locale: Locale = (["pt", "en", "it", "es", "sv"] as Locale[]).includes(rawLocale) ? rawLocale : "pt";
  const t = T[locale];
  const dfLocale = DATE_FN_LOCALES[locale];
  const dateFmt = locale === "en" ? "MM/dd/yyyy" : "dd/MM/yyyy";
  const fd = (d: string | Date) => format(new Date(d), dateFmt, { locale: dfLocale });

  const STATUS_LABELS: Record<string, string> = {
    open: t.statusOpen, paid: t.statusPaid, overdue: t.statusOverdue, cancelled: t.statusCancelled,
  };

  const clientName = invoice.recipient_name || invoice.clients?.name || "Cliente";
  const clientAddress = invoice.recipient_address || invoice.clients?.address || "";
  const clientCountry = invoice.recipient_country || invoice.clients?.country || "";
  const clientTaxId = invoice.recipient_tax_id || invoice.clients?.tax_id || "";
  const issuerLogoData = await imageUrlToDataUrl(issuerLogo);

  const discount = Number(invoice.discount || 0);
  const surcharge = Number(invoice.surcharge || 0);
  const fmt = (v: number) => formatCurrency(v, currencyCode || invoice.currency_code || invoice.clients?.billing_currency);

  const paymentMethod = invoice.payment_method || issuer.payment_method || "";
  const paymentDetails = invoice.payment_details || issuer.payment_details || "";

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<title>${t.invoice} ${invoice.invoice_number} - ${escapeHtml(issuer.business_name || "www.liegestudio.com")}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #f1ede9; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif;
    color: #1d1d1f;
    padding: 48px;
    max-width: 820px;
    margin: 0 auto;
    font-weight: 400;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .top {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 40px;
    padding-bottom: 28px;
    border-bottom: 1px solid #d8d2cb;
    text-align: center;
  }
  .top .logo-wrap { max-width: 360px; margin-bottom: 20px; }
  .top .logo-wrap img { max-height: 180px; max-width: 360px; object-fit: contain; display: block; }
  .top .title-wrap { text-align: center; }
  .top h1 { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; color: #1d1d1f; }
  .top .invoice-num { font-size: 13px; color: #86868b; font-family: 'SF Mono', monospace; margin-top: 4px; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 980px; font-size: 11px; font-weight: 600; margin-top: 8px; letter-spacing: 0.02em; }
  .status-open { background: #e3f2fd; color: #0066cc; }
  .status-paid { background: #d1f4dd; color: #00875a; }
  .status-overdue { background: #ffe5e5; color: #d70015; }
  .status-cancelled { background: #e8e2db; color: #86868b; }

  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    margin-bottom: 40px;
  }
  .party h3 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #86868b;
    margin-bottom: 10px;
    font-weight: 600;
  }
  .party .name { font-size: 15px; font-weight: 600; color: #1d1d1f; margin-bottom: 6px; }
  .party p { font-size: 13px; line-height: 1.6; color: #424245; }
  .party .meta-line { color: #86868b; font-size: 12px; margin-top: 4px; }

  .dates {
    display: flex;
    gap: 40px;
    padding: 16px 0;
    margin-bottom: 32px;
    border-top: 1px solid #d8d2cb;
    border-bottom: 1px solid #d8d2cb;
    font-size: 13px;
  }
  .dates .item span { color: #86868b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; display: block; margin-bottom: 2px; }
  .dates .item strong { color: #1d1d1f; font-weight: 500; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th {
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #86868b;
    padding: 10px 12px;
    border-bottom: 1px solid #c8c0b6;
    font-weight: 600;
  }
  tbody td { padding: 12px; font-size: 13px; border-bottom: 1px solid #e0d9d0; color: #1d1d1f; }
  tbody td .desc { color: #86868b; font-size: 11px; margin-top: 2px; }
  .text-right { text-align: right; }

  .totals { margin-left: auto; width: 320px; padding-top: 8px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #424245; }
  .totals .row.total {
    font-size: 18px;
    font-weight: 600;
    color: #1d1d1f;
    border-top: 1px solid #1d1d1f;
    padding-top: 12px;
    margin-top: 8px;
    letter-spacing: -0.01em;
  }

  .payment-block, .notes-block {
    margin-top: 32px;
    padding: 18px 20px;
    background: #e8e2db;
    border-radius: 12px;
  }
  .payment-block h3, .notes-block h3 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #86868b;
    margin-bottom: 10px;
    font-weight: 600;
  }
  .payment-block .pm { font-size: 14px; font-weight: 600; color: #1d1d1f; margin-bottom: 6px; }
  .payment-block .pd, .notes-block p { font-size: 13px; line-height: 1.6; color: #424245; white-space: pre-wrap; }

  .footer {
    margin-top: 56px;
    padding-top: 20px;
    border-top: 1px solid #d8d2cb;
    text-align: center;
    font-size: 11px;
    color: #86868b;
  }
  .footer a { color: #0066cc; text-decoration: none; }

  @media print {
    body { padding: 24px; }
    @page { margin: 14mm; }
    html, body { background: #f1ede9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

  <div class="top">
    <div class="logo-wrap">
      <img src="${issuerLogoData}" alt="${escapeHtml(issuer.business_name || "Liege Paschoalini Studio")}">
    </div>
    <div class="title-wrap">
      <h1>${t.invoice}</h1>
      <div class="invoice-num">#${invoice.invoice_number}</div>
      <span class="status status-${invoice.status}">${STATUS_LABELS[invoice.status] || invoice.status}</span>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>${t.from}</h3>
      <div class="name">${escapeHtml(issuer.business_name) || "—"}</div>
      ${issuer.address ? `<p>${escapeHtml(issuer.address)}</p>` : ""}
      ${issuer.country ? `<p class="meta-line">${escapeHtml(issuer.country)}</p>` : ""}
      ${issuer.email ? `<p class="meta-line">${escapeHtml(issuer.email)}</p>` : ""}
      ${issuer.tax_id ? `<p class="meta-line">${t.taxId}: ${escapeHtml(issuer.tax_id)}</p>` : ""}
    </div>
    <div class="party">
      <h3>${t.to}</h3>
      <div class="name">${escapeHtml(clientName)}</div>
      ${clientAddress ? `<p>${escapeHtml(clientAddress)}</p>` : ""}
      ${clientCountry ? `<p class="meta-line">${escapeHtml(clientCountry)}</p>` : ""}
      ${clientTaxId ? `<p class="meta-line">${t.taxId}: ${escapeHtml(clientTaxId)}</p>` : ""}
    </div>
  </div>

  <div class="dates">
    <div class="item"><span>${t.issueDate}</span><strong>${fd(invoice.issue_date)}</strong></div>
    <div class="item"><span>${t.dueDate}</span><strong>${fd(invoice.due_date)}</strong></div>
    ${invoice.status === "paid" && invoice.paid_at ? `<div class="item"><span>${t.paidDate}</span><strong style="color:#00875a">${fd(invoice.paid_at)}</strong></div>` : ""}
    ${invoice.period_start && invoice.period_end ? `<div class="item"><span>${t.period}</span><strong>${fd(invoice.period_start)} – ${fd(invoice.period_end)}</strong></div>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th>${t.item}</th>
        <th>${t.category}</th>
        <th>${t.date}</th>
        <th class="text-right">${t.qty}</th>
        <th class="text-right">${t.unitPrice}</th>
        <th class="text-right">${t.total}</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
        <tr>
          <td>${escapeHtml(item.name)}${item.description ? `<div class="desc">${escapeHtml(item.description)}</div>` : ""}</td>
          <td>${escapeHtml(item.category)}</td>
          <td>${fd(item.service_date)}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">${fmt(Number(item.unit_price))}</td>
          <td class="text-right">${fmt(Number(item.total_price))}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>${t.subtotal}</span><span>${fmt(subtotal)}</span></div>
    ${discount > 0 ? `<div class="row" style="color:#00875a"><span>${t.discount}</span><span>− ${fmt(discount)}</span></div>` : ""}
    ${surcharge > 0 ? `<div class="row" style="color:#bf6900"><span>${t.surcharge}</span><span>+ ${fmt(surcharge)}</span></div>` : ""}
    <div class="row total"><span>${t.total}</span><span>${fmt(total)}</span></div>
  </div>

  ${paymentMethod || paymentDetails ? `
  <div class="payment-block">
    <h3>${t.payment}</h3>
    ${paymentMethod ? `<div class="pm">${escapeHtml(paymentMethod)}</div>` : ""}
    ${paymentDetails ? `<div class="pd">${escapeHtml(paymentDetails)}</div>` : ""}
  </div>
  ` : ""}

  ${invoice.notes ? `
  <div class="notes-block">
    <h3>${t.notes}</h3>
    <p>${escapeHtml(invoice.notes)}</p>
  </div>
  ` : ""}

  <div class="footer">
    <a href="https://www.liegestudio.com" target="_blank">www.liegestudio.com</a>
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    const triggerPrint = () => {
      try { printWindow.focus(); } catch {}
      printWindow.print();
    };
    const img = printWindow.document.querySelector("img");
    if (img && !(img as HTMLImageElement).complete) {
      (img as HTMLImageElement).addEventListener("load", () => setTimeout(triggerPrint, 200));
      (img as HTMLImageElement).addEventListener("error", () => setTimeout(triggerPrint, 200));
      setTimeout(triggerPrint, 2500);
    } else {
      setTimeout(triggerPrint, 400);
    }
  }
}
