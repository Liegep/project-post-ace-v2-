import { useEffect, useMemo, useState } from "react";
import type { SessionUser } from "./types";
import "./BillingWorkspace.css";
import "./BillingWorkspaceLogo.css";
import "./BillingWorkspaceInvoiceFooter.css";
import "./BillingWorkspaceClientThumb.css";
import liegePaschoaliniLogo from "./assets/liege-paschoalini-logo.png";
import { listAdminClients } from "./api";

type Currency = "BRL" | "EUR" | "USD" | "SEK";
type InvoiceStatus = "open" | "paid" | "overdue" | "cancelled";

type InvoiceLine = { id: string; description: string; quantity: number; unitPrice: number };
export type BillingLineRequest = { clientName: string; description: string; quantity: number; unitPrice: number; notes: string };
export const BILLING_PENDING_LINE_KEY = "designhub-v2-billing-pending-line";
export type BillingInvoice = {
  id: string;
  number: number;
  title: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  clientCountry: string;
  clientTaxId: string;
  issueDate: string;
  dueDate: string;
  period: string;
  currency: Currency;
  locale: "pt" | "en" | "it" | "es" | "sv";
  status: InvoiceStatus;
  recurring: boolean;
  fixedAmount: boolean;
  visibleToClient: boolean;
  sentToClient?: boolean;
  attachmentName: string;
  notes: string;
  lines: InvoiceLine[];
};

const STORAGE_KEY = "designhub-v2-billing-preview";
const currencies: Array<{ value: Currency; label: string }> = [
  { value: "BRL", label: "Real brasileiro (R$)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "USD", label: "Dolar americano (US$)" },
  { value: "SEK", label: "Coroa sueca (kr)" },
];

const labels: Record<BillingInvoice["locale"], { invoice: string; from: string; to: string; issued: string; due: string; period: string; description: string; quantity: string; price: string; total: string; payment: string; account: string }> = {
  pt: { invoice: "FATURA", from: "DE", to: "PARA", issued: "EMISSAO", due: "VENCIMENTO", period: "PERIODO", description: "DESCRICAO", quantity: "QTD.", price: "VALOR", total: "TOTAL", payment: "PAGAMENTO", account: "Numero da conta" },
  en: { invoice: "INVOICE", from: "FROM", to: "TO", issued: "ISSUED", due: "DUE DATE", period: "PERIOD", description: "DESCRIPTION", quantity: "QTY.", price: "PRICE", total: "TOTAL", payment: "PAYMENT", account: "Account number" },
  it: { invoice: "FATTURA", from: "DA", to: "A", issued: "EMISSIONE", due: "SCADENZA", period: "PERIODO", description: "DESCRIZIONE", quantity: "QTA.", price: "PREZZO", total: "TOTALE", payment: "PAGAMENTO", account: "Numero di conto" },
  es: { invoice: "FACTURA", from: "DE", to: "PARA", issued: "EMISION", due: "VENCIMIENTO", period: "PERIODO", description: "DESCRIPCION", quantity: "CANT.", price: "PRECIO", total: "TOTAL", payment: "PAGO", account: "Numero de cuenta" },
  sv: { invoice: "FAKTURA", from: "FRAN", to: "TILL", issued: "UTFARDAD", due: "FORFALLODAG", period: "PERIOD", description: "BESKRIVNING", quantity: "ANTAL", price: "PRIS", total: "TOTALT", payment: "BETALNING", account: "Kontonummer" },
};

function seedInvoices(): BillingInvoice[] {
  return [
    {
      id: "invoice-56", number: 56, title: "Gestao de redes sociais", clientName: "Aplikasi", clientEmail: "contato@aplikasi.com", clientAddress: "Rua do Comercio, 120", clientCountry: "Brasil", clientTaxId: "CNPJ 00.000.000/0001-00", issueDate: "2026-08-01", dueDate: "2026-09-09", period: "01/08/2026 - 31/08/2026", currency: "BRL", locale: "pt", status: "open", recurring: true, fixedAmount: true, visibleToClient: true, attachmentName: "nota-fiscal-56.pdf", notes: "Pagamento via transferencia bancaria.", lines: [{ id: "line-56", description: "Gestao de redes sociais - Agosto 2026", quantity: 1, unitPrice: 1776 }],
    },
    {
      id: "invoice-55", number: 55, title: "Consultoria mensal", clientName: "Elite Leader Podcast", clientEmail: "hello@eliteleader.com", clientAddress: "Av. Paulista, 400", clientCountry: "Brasil", clientTaxId: "", issueDate: "2026-08-01", dueDate: "2026-09-09", period: "01/08/2026 - 31/08/2026", currency: "BRL", locale: "pt", status: "open", recurring: true, fixedAmount: false, visibleToClient: true, attachmentName: "", notes: "", lines: [{ id: "line-55", description: "Consultoria estrategica", quantity: 1, unitPrice: 950 }],
    },
    {
      id: "invoice-54", number: 54, title: "Social media", clientName: "Niko", clientEmail: "niko@example.it", clientAddress: "Via Guadel, 7, 31043 Fontanelle", clientCountry: "Italia", clientTaxId: "P. IVA 04943260267", issueDate: "2026-08-01", dueDate: "2026-08-28", period: "01/08/2026 - 31/08/2026", currency: "EUR", locale: "it", status: "paid", recurring: true, fixedAmount: true, visibleToClient: true, attachmentName: "nota-fiscale.pdf", notes: "", lines: [{ id: "line-54", description: "Gestione social media", quantity: 1, unitPrice: 200 }],
    },
  ];
}

function loadInvoices() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as BillingInvoice[] : seedInvoices().map((invoice) => ({ ...invoice, visibleToClient: false }));
  } catch { return seedInvoices().map((invoice) => ({ ...invoice, visibleToClient: false })); }
}

export function loadClientVisibleInvoices(clientName: string) {
  const normalizedName = clientName.trim().toLocaleLowerCase("pt-BR");
  return loadInvoices().filter((invoice) => invoice.visibleToClient && invoice.sentToClient === true && invoice.clientName.trim().toLocaleLowerCase("pt-BR") === normalizedName);
}

export function getBillingInvoiceTotal(invoice: BillingInvoice) { return invoiceTotal(invoice); }
export function formatBillingMoney(value: number, currency: Currency) { return money(value, currency); }
export function formatBillingDate(value: string) { return date(value); }

function emptyInvoice(nextNumber: number): BillingInvoice {
  const today = new Date().toISOString().slice(0, 10);
  return { id: crypto.randomUUID(), number: nextNumber, title: "Nova fatura", clientName: "", clientEmail: "", clientAddress: "", clientCountry: "", clientTaxId: "", issueDate: today, dueDate: today, period: "", currency: "BRL", locale: "pt", status: "open", recurring: false, fixedAmount: true, visibleToClient: false, attachmentName: "", notes: "", lines: [{ id: crypto.randomUUID(), description: "Servico", quantity: 1, unitPrice: 0 }] };
}

function invoiceTotal(invoice: BillingInvoice) { return invoice.lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0); }

export function BillingInvoiceDocument({ invoice }: { invoice: BillingInvoice }) {
  const text = labels[invoice.locale];
  return <article className="invoice-paper"><div className="invoice-paper-head"><img className="issuer-logo" src={liegePaschoaliniLogo} alt="Liege Paschoalini Studio" /><div><p>{text.invoice}</p><h1>#{invoice.number}</h1><span className={`invoice-status ${invoice.status}`}>{statusLabel[invoice.status]}</span></div></div><hr /><div className="invoice-addresses"><div><small>{text.from}</small><strong>LIEGE PASCHOALINI STUDIO</strong><p>Temperaturgatan, 67<br />Suecia<br />hello@liegepaschoalini.design</p></div><div><small>{text.to}</small><strong>{invoice.clientName || "Nome do cliente"}</strong><p>{invoice.clientAddress || "Endereco do cliente"}<br />{invoice.clientCountry || "Pais"}<br />{invoice.clientEmail || "E-mail do cliente"}<br />{invoice.clientTaxId}</p></div></div><div className="invoice-dates"><span><small>{text.issued}</small><b>{date(invoice.issueDate)}</b></span><span><small>{text.due}</small><b>{date(invoice.dueDate)}</b></span><span><small>{text.period}</small><b>{invoice.period || "-"}</b></span></div><div className="invoice-lines"><div className="invoice-lines-head"><span>{text.description}</span><span>{text.quantity}</span><span>{text.price}</span><span>{text.total}</span></div>{invoice.lines.map((line) => <div key={line.id}><span>{line.description}</span><span>{line.quantity}</span><span>{money(line.unitPrice, invoice.currency)}</span><strong>{money(line.quantity * line.unitPrice, invoice.currency)}</strong></div>)}</div><div className="invoice-total"><span>Subtotal</span><span>{money(invoiceTotal(invoice), invoice.currency)}</span><strong>{text.total}</strong><b>{money(invoiceTotal(invoice), invoice.currency)}</b></div>{invoice.notes ? <p className="invoice-notes">{invoice.notes}</p> : null}<footer className="invoice-footer"><div className="invoice-payment"><small>{text.payment}</small><p>IBAN: SE51 5000 0000 0538 3021 2593<br />BIC: ESSESESSXXX<br />{text.account}: 53830212593 - SEB Bank<br />PayPal: slmariew@gmail.com<br />Pix: pix@liegepaschoalini.design</p></div><span>liegestudio.com</span></footer></article>;
}

function money(value: number, currency: Currency) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value); }
function date(value: string) { return value ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`)) : "-"; }

const statusLabel: Record<InvoiceStatus, string> = { open: "Aberta", paid: "Paga", overdue: "Atrasada", cancelled: "Cancelada" };

export function BillingWorkspace({ session, newInvoiceSignal = 0 }: { session: SessionUser; newInvoiceSignal?: number }) {
  const [invoices, setInvoices] = useState<BillingInvoice[]>(loadInvoices);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [logosByClient, setLogosByClient] = useState<Record<string, string>>({});

  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices)); }, [invoices]);
  useEffect(() => {
    listAdminClients()
      .then(({ items }) => setLogosByClient(Object.fromEntries(items.filter((client) => client.logo_url).map((client) => [client.name.trim().toLocaleLowerCase(), client.logo_url as string]))))
      .catch(() => setLogosByClient({}));
  }, []);
  useEffect(() => {
    const raw = window.localStorage.getItem(BILLING_PENDING_LINE_KEY);
    if (!raw) return;
    window.localStorage.removeItem(BILLING_PENDING_LINE_KEY);
    try {
      const request = JSON.parse(raw) as BillingLineRequest;
      if (!request.clientName || !request.description) return;
      setInvoices((current) => {
        const existing = current.find((invoice) => invoice.clientName.trim().toLocaleLowerCase() === request.clientName.trim().toLocaleLowerCase() && invoice.status === "open");
        if (existing) {
          const updated = { ...existing, lines: [...existing.lines, { id: crypto.randomUUID(), description: request.description, quantity: request.quantity, unitPrice: request.unitPrice }], notes: [existing.notes, request.notes].filter(Boolean).join("\n") };
          setSelectedId(updated.id);
          return current.map((invoice) => invoice.id === updated.id ? updated : invoice);
        }
        const next = { ...emptyInvoice(Math.max(0, ...current.map((invoice) => invoice.number)) + 1), title: `Fatura ${request.clientName}`, clientName: request.clientName, notes: request.notes, lines: [{ id: crypto.randomUUID(), description: request.description, quantity: request.quantity, unitPrice: request.unitPrice }] };
        setSelectedId(next.id);
        return [next, ...current];
      });
    } catch {
      // Ignore malformed pending requests and keep the billing page usable.
    }
  }, []);

  const filtered = useMemo(() => invoices.filter((invoice) => {
    const searchable = `${invoice.title} ${invoice.clientName} ${invoice.number}`.toLowerCase();
    return searchable.includes(query.toLowerCase()) && (statusFilter === "all" || invoice.status === statusFilter);
  }), [invoices, query, statusFilter]);
  const selected = invoices.find((invoice) => invoice.id === selectedId) ?? null;
  const totals = invoices.reduce((result, invoice) => {
    const total = invoiceTotal(invoice);
    if (invoice.status === "paid") result.paid += total;
    else if (invoice.status === "overdue") result.overdue += total;
    else if (invoice.status === "open") result.open += total;
    result.all += total;
    return result;
  }, { all: 0, paid: 0, open: 0, overdue: 0 });

  const create = () => {
    const next = emptyInvoice(Math.max(0, ...invoices.map((invoice) => invoice.number)) + 1);
    setInvoices((current) => [next, ...current]);
    setSelectedId(next.id);
  };
  useEffect(() => { if (newInvoiceSignal > 0) create(); }, [newInvoiceSignal]);
  const save = (next: BillingInvoice) => setInvoices((current) => current.map((invoice) => invoice.id === next.id ? next : invoice));
  const remove = (id: string) => { if (window.confirm("Excluir esta fatura?")) { setInvoices((current) => current.filter((invoice) => invoice.id !== id)); setSelectedId(null); } };

  if (selected) return <InvoiceEditor invoice={selected} session={session} onBack={() => setSelectedId(null)} onChange={save} onDelete={() => remove(selected.id)} />;

  return <section className="billing-workspace">
    <section className="billing-metrics">
      <Metric label="Total faturado" value={money(totals.all, "BRL")} tone="violet" />
      <Metric label="Total recebido" value={money(totals.paid, "BRL")} tone="green" />
      <Metric label="Pendente" value={money(totals.open, "BRL")} tone="orange" />
      <Metric label="Atrasado" value={money(totals.overdue, "BRL")} tone="red" />
    </section>
    <div className="billing-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar fatura ou cliente" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | InvoiceStatus)}><option value="all">Todos os status</option><option value="open">Abertas</option><option value="paid">Pagas</option><option value="overdue">Atrasadas</option><option value="cancelled">Canceladas</option></select><span>{invoices.filter((invoice) => invoice.recurring).length} recorrencias ativas: geracao prevista para todo dia 1.</span></div>
    <div className="billing-list">{filtered.map((invoice) => <button key={invoice.id} className="billing-row" onClick={() => setSelectedId(invoice.id)}><span className="billing-row-mark">#{invoice.number}</span><ClientThumb name={invoice.clientName} logoUrl={logosByClient[invoice.clientName.trim().toLocaleLowerCase()]} /><span className="billing-row-main"><strong>{invoice.title}</strong><small>{invoice.clientName || "Cliente sem nome"} · Venc. {date(invoice.dueDate)}</small></span><span className="billing-row-repeat">{invoice.recurring ? "Recorrente" : "Avulsa"}</span><span className="billing-row-value"><strong>{money(invoiceTotal(invoice), invoice.currency)}</strong><em className={`invoice-status ${invoice.status}`}>{statusLabel[invoice.status]}</em></span></button>)}{filtered.length === 0 && <div className="billing-empty">Nenhuma fatura encontrada.</div>}</div>
  </section>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) { return <article className={`billing-metric ${tone}`}><span>{label}</span><strong>{value}</strong></article>; }

function ClientThumb({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const initials = name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
  return <span className="billing-client-thumb">{logoUrl ? <img src={logoUrl} alt={`Logo ${name}`} /> : initials}</span>;
}

function InvoiceEditor({ invoice, session, onBack, onChange, onDelete }: { invoice: BillingInvoice; session: SessionUser; onBack: () => void; onChange: (invoice: BillingInvoice) => void; onDelete: () => void }) {
  const [tab, setTab] = useState<"details" | "client" | "settings">("details");
  const [sent, setSent] = useState(invoice.sentToClient === true);
  const update = <K extends keyof BillingInvoice>(key: K, value: BillingInvoice[K]) => onChange({ ...invoice, [key]: value });
  useEffect(() => {
    if (!sent || !invoice.visibleToClient || invoice.sentToClient === true) return;
    onChange({ ...invoice, sentToClient: true });
  }, [sent, invoice, onChange]);
  const updateLine = (id: string, key: keyof InvoiceLine, value: string | number) => update("lines", invoice.lines.map((line) => line.id === id ? { ...line, [key]: value } : line));
  const setFixedAmount = (value: number) => update("lines", invoice.lines.length
    ? invoice.lines.map((line, index) => index === 0 ? { ...line, quantity: 1, unitPrice: value } : line)
    : [{ id: crypto.randomUUID(), description: "Servico recorrente", quantity: 1, unitPrice: value }]);
  const copy = () => navigator.clipboard?.writeText(`${window.location.origin}/#/client/invoices/${invoice.id}`);
  const text = labels[invoice.locale];
  return <section className="invoice-editor">
    <aside className="invoice-editor-side invoice-editor-nav"><button className="back-button" onClick={onBack}>← Faturamento</button><p className="eyebrow">Fatura #{invoice.number}</p><h2>{invoice.title}</h2><button className={tab === "details" ? "active" : ""} onClick={() => setTab("details")}>Detalhes e itens</button><button className={tab === "client" ? "active" : ""} onClick={() => setTab("client")}>Dados do cliente</button><button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>Configuracoes</button><div className="invoice-editor-side-note"><strong>Recorrencia</strong><p>{invoice.recurring ? "A proxima fatura sera criada no dia 1." : "Fatura avulsa."}</p></div></aside>
    <main className="invoice-canvas"><div className="invoice-canvas-actions"><button onClick={() => update("status", invoice.status === "paid" ? "open" : "paid")}>{invoice.status === "paid" ? "Marcar como aberta" : "Marcar como paga"}</button><button onClick={() => window.print()}>Baixar PDF</button><button className="send" onClick={() => { setSent(true); update("visibleToClient", true); }}>{sent ? "Enviada para o cliente" : "Enviar ao cliente"}</button></div><article className="invoice-paper"><div className="invoice-paper-head"><img className="issuer-logo" src={liegePaschoaliniLogo} alt="Liege Paschoalini Studio" /><div><p>{text.invoice}</p><h1>#{invoice.number}</h1><span className={`invoice-status ${invoice.status}`}>{statusLabel[invoice.status]}</span></div></div><hr /><div className="invoice-addresses"><div><small>{text.from}</small><strong>LIEGE PASCHOALINI STUDIO</strong><p>Temperaturgatan, 67<br />Suecia<br />hello@liegepaschoalini.design</p></div><div><small>{text.to}</small><strong>{invoice.clientName || "Nome do cliente"}</strong><p>{invoice.clientAddress || "Endereco do cliente"}<br />{invoice.clientCountry || "Pais"}<br />{invoice.clientEmail || "E-mail do cliente"}<br />{invoice.clientTaxId}</p></div></div><div className="invoice-dates"><span><small>{text.issued}</small><b>{date(invoice.issueDate)}</b></span><span><small>{text.due}</small><b>{date(invoice.dueDate)}</b></span><span><small>{text.period}</small><b>{invoice.period || "-"}</b></span></div><div className="invoice-lines"><div className="invoice-lines-head"><span>{text.description}</span><span>{text.quantity}</span><span>{text.price}</span><span>{text.total}</span></div>{invoice.lines.map((line) => <div key={line.id}><span>{line.description}</span><span>{line.quantity}</span><span>{money(line.unitPrice, invoice.currency)}</span><strong>{money(line.quantity * line.unitPrice, invoice.currency)}</strong></div>)}</div><div className="invoice-total"><span>Subtotal</span><span>{money(invoiceTotal(invoice), invoice.currency)}</span><strong>{text.total}</strong><b>{money(invoiceTotal(invoice), invoice.currency)}</b></div>{invoice.notes ? <p className="invoice-notes">{invoice.notes}</p> : null}<footer className="invoice-footer"><div className="invoice-payment"><small>{text.payment}</small><p>IBAN: SE51 5000 0000 0538 3021 2593<br />BIC: ESSESESSXXX<br />{text.account}: 53830212593 - SEB Bank<br />PayPal: slmariew@gmail.com<br />Pix: pix@liegepaschoalini.design</p></div><span>liegestudio.com</span></footer></article></main>
    <aside className="invoice-editor-side invoice-editor-controls">{tab === "details" ? <><label>Titulo<input value={invoice.title} onChange={(event) => update("title", event.target.value)} /></label><div className="field-row"><label>Emissao<input type="date" value={invoice.issueDate} onChange={(event) => update("issueDate", event.target.value)} /></label><label>Vencimento<input type="date" value={invoice.dueDate} onChange={(event) => update("dueDate", event.target.value)} /></label></div><label>Periodo<input value={invoice.period} onChange={(event) => update("period", event.target.value)} placeholder="01/08/2026 - 31/08/2026" /></label><div className="editor-section-title"><strong>Itens</strong><button onClick={() => update("lines", [...invoice.lines, { id: crypto.randomUUID(), description: "Novo servico", quantity: 1, unitPrice: 0 }])}>+ Item</button></div>{invoice.lines.map((line) => <div className="invoice-line-edit" key={line.id}><input value={line.description} onChange={(event) => updateLine(line.id, "description", event.target.value)} /><input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(line.id, "quantity", Number(event.target.value))} /><input type="number" min="0" value={line.unitPrice} onChange={(event) => updateLine(line.id, "unitPrice", Number(event.target.value))} /><button onClick={() => update("lines", invoice.lines.filter((item) => item.id !== line.id))}>×</button></div>)}<label>Observacoes<textarea value={invoice.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Informacoes de pagamento ou observacoes" /></label></> : null}{tab === "client" ? <><label>Nome do cliente<input value={invoice.clientName} onChange={(event) => update("clientName", event.target.value)} /></label><label>E-mail<input type="email" value={invoice.clientEmail} onChange={(event) => update("clientEmail", event.target.value)} /></label><label>Endereco<textarea value={invoice.clientAddress} onChange={(event) => update("clientAddress", event.target.value)} /></label><label>Pais<input value={invoice.clientCountry} onChange={(event) => update("clientCountry", event.target.value)} /></label><label>Documento fiscal<input value={invoice.clientTaxId} onChange={(event) => update("clientTaxId", event.target.value)} /></label></> : null}{tab === "settings" ? <><label>Moeda<select value={invoice.currency} onChange={(event) => update("currency", event.target.value as Currency)}>{currencies.map((currency) => <option key={currency.value} value={currency.value}>{currency.label}</option>)}</select></label><label>Idioma do cliente<select value={invoice.locale} onChange={(event) => update("locale", event.target.value as BillingInvoice["locale"])}><option value="pt">Portugues</option><option value="en">English</option><option value="it">Italiano</option><option value="es">Espanol</option><option value="sv">Svenska</option></select></label><Toggle label="Fatura recorrente" checked={invoice.recurring} onChange={(value) => update("recurring", value)} /><Toggle label="Valor fixo" checked={invoice.fixedAmount} onChange={(value) => update("fixedAmount", value)} />{invoice.recurring && invoice.fixedAmount ? <label className="fixed-amount-field">Valor mensal fixo<input type="number" min="0" step="0.01" value={invoice.lines[0]?.unitPrice ?? 0} onChange={(event) => setFixedAmount(Number(event.target.value))} /><small>Este valor sera usado na proxima fatura automatica.</small></label> : null}<Toggle label="Visivel na area do cliente" checked={invoice.visibleToClient} onChange={(value) => update("visibleToClient", value)} /><label className="attachment-field">Anexar PDF ou nota fiscal<input type="file" accept="application/pdf" onChange={(event) => update("attachmentName", event.target.files?.[0]?.name ?? "")} />{invoice.attachmentName ? <span>{invoice.attachmentName}</span> : <span>Nenhum documento anexado</span>}</label>{invoice.attachmentName ? <button className="secondary-full" onClick={() => update("attachmentName", "")}>Remover anexo</button> : null}<button className="secondary-full" onClick={() => { copy(); setSent(true); }}>Copiar link da area do cliente</button></> : null}<button className="delete-invoice" onClick={onDelete}>Excluir fatura</button><small className="invoice-editor-user">Editando como {session.name}</small></aside>
  </section>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="billing-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>; }
