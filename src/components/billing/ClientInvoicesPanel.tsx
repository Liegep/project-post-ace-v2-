import { useState, useEffect, useMemo } from "react";
import { startOfMonth, endOfMonth } from "date-fns";
import { useInvoices, useInvoiceItems, useInvoiceAttachments, Invoice } from "@/hooks/useInvoices";
import { logBillingAccess } from "@/hooks/useBillingPermissions";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Receipt, CheckCircle2, AlertCircle, Clock, XCircle,
  ChevronRight, FileText, Download, History, Paperclip, Eye
} from "lucide-react";
import { format } from "date-fns";
import { generateInvoicePDF } from "@/lib/invoicePdf";
import { formatCurrency } from "@/lib/currency";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Aberta", color: "bg-blue-500/15 text-blue-600", icon: Clock },
  paid: { label: "Paga", color: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle2 },
  overdue: { label: "Atrasada", color: "bg-red-500/15 text-red-600", icon: AlertCircle },
  cancelled: { label: "Cancelada", color: "bg-muted text-muted-foreground", icon: XCircle },
};

const MAX_RECENT = 3;

/* ── Invoice Detail (inside dialog) ── */
interface InvoiceDetailProps {
  invoice: Invoice;
  canDownloadInvoices?: boolean;
  canViewAttachments?: boolean;
  canDownloadAttachments?: boolean;
}

export function InvoiceDetail({ invoice, canDownloadInvoices = true, canViewAttachments = true, canDownloadAttachments = true }: InvoiceDetailProps) {
  const { items, loading } = useInvoiceItems(invoice.id);
  const { attachments } = useInvoiceAttachments(invoice.id);
  const cur = invoice.currency_code || invoice.clients?.billing_currency;

  const subtotal = items.reduce((sum, it) => sum + Number(it.total_price || 0), 0);
  const discount = Number(invoice.discount || 0);
  const surcharge = Number(invoice.surcharge || 0);
  const total = subtotal - discount + surcharge;

  // Log invoice view on mount
  useEffect(() => {
    const logView = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", session.user.id).maybeSingle();
      await logBillingAccess({
        client_id: invoice.client_id,
        user_id: session.user.id,
        user_name: (profile as any)?.full_name || (profile as any)?.email || "",
        action: "view_invoice",
        document_type: "invoice",
        document_id: invoice.id,
        document_name: invoice.title || `Fatura #${invoice.invoice_number}`,
      });
    };
    logView();
  }, [invoice.id]);

  const handleDownloadPDF = async () => {
    generateInvoicePDF(invoice, items, total, subtotal, cur);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", session.user.id).maybeSingle();
      await logBillingAccess({
        client_id: invoice.client_id,
        user_id: session.user.id,
        user_name: (profile as any)?.full_name || (profile as any)?.email || "",
        action: "download_invoice",
        document_type: "invoice",
        document_id: invoice.id,
        document_name: invoice.title || `Fatura #${invoice.invoice_number}`,
      });
    }
  };

  const handleViewAttachment = async (att: { id: string; file_name: string; file_url: string }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", session.user.id).maybeSingle();
      await logBillingAccess({
        client_id: invoice.client_id,
        user_id: session.user.id,
        user_name: (profile as any)?.full_name || (profile as any)?.email || "",
        action: "view_attachment",
        document_type: "attachment",
        document_id: att.id,
        document_name: att.file_name,
      });
    }
    window.open(att.file_url, "_blank");
  };

  const handleDownloadAttachment = async (att: { id: string; file_name: string; file_url: string }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", session.user.id).maybeSingle();
      await logBillingAccess({
        client_id: invoice.client_id,
        user_id: session.user.id,
        user_name: (profile as any)?.full_name || (profile as any)?.email || "",
        action: "download_attachment",
        document_type: "attachment",
        document_id: att.id,
        document_name: att.file_name,
      });
    }
  };

  const cfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.open;
  const Icon = cfg.icon;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Status</span>
          <Badge variant="secondary" className={`${cfg.color} ml-2`}>
            <Icon className="h-3 w-3 mr-1" />
            {cfg.label}
          </Badge>
        </div>
        <div>
          <span className="text-muted-foreground">Emissão: </span>
          <span className="font-medium">{format(new Date(invoice.issue_date), "dd/MM/yyyy")}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Vencimento: </span>
          <span className="font-medium">{format(new Date(invoice.due_date), "dd/MM/yyyy")}</span>
        </div>
        {invoice.paid_at && (
          <div>
            <span className="text-muted-foreground">Pago em: </span>
            <span className="font-medium">{format(new Date(invoice.paid_at), "dd/MM/yyyy")}</span>
          </div>
        )}
        {invoice.payment_method && invoice.payment_method !== "" && (
          <div>
            <span className="text-muted-foreground">Método: </span>
            <span className="font-medium capitalize">{invoice.payment_method}</span>
          </div>
        )}
      </div>

      {invoice.notes && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Observações</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      <Separator />

      {loading ? (
        <p className="text-sm text-muted-foreground py-2">Carregando itens...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">Nenhum item nesta fatura.</p>
      ) : (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Itens</h4>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{item.name || "Item"}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.quantity}x · {formatCurrency(Number(item.unit_price || 0), cur)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-foreground ml-3">
                  {formatCurrency(Number(item.total_price || 0), cur)}
                </span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal, cur)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between items-center text-sm text-emerald-600">
                <span>Desconto</span>
                <span>- {formatCurrency(discount, cur)}</span>
              </div>
            )}
            {surcharge > 0 && (
              <div className="flex justify-between items-center text-sm text-amber-600">
                <span>Acréscimo</span>
                <span>+ {formatCurrency(surcharge, cur)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1">
              <span className="text-sm font-semibold text-foreground">Total</span>
              <span className="text-base font-bold text-foreground">{formatCurrency(total, cur)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Attachments (Nota Fiscal) */}
      {canViewAttachments && attachments.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <Paperclip className="h-4 w-4" /> Nota Fiscal
            </h4>
            <div className="space-y-1.5">
              {attachments.map(att => (
                <div key={att.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="flex-1 truncate">{att.file_name}</span>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleViewAttachment(att)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {canDownloadAttachments && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                        <a href={att.file_url} download={att.file_name} onClick={() => handleDownloadAttachment(att)}>
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!loading && items.length > 0 && canDownloadInvoices && (
        <>
          <Separator />
          <Button onClick={handleDownloadPDF} variant="outline" className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Baixar fatura em PDF
          </Button>
        </>
      )}
    </div>
  );
}

/* ── Compact invoice row (for recent cards & history list) ── */
function InvoiceRow({
  invoice,
  onSelect,
  isNew,
}: {
  invoice: Invoice;
  onSelect: (inv: Invoice) => void;
  isNew?: boolean;
}) {
  const cfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.open;
  const Icon = cfg.icon;

  return (
    <button
      onClick={() => onSelect(invoice)}
      className="w-full flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors text-left"
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">
              {invoice.title || `Fatura #${invoice.invoice_number}`}
            </p>
            {isNew && (
              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                Novo
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Vencimento: {format(new Date(invoice.due_date), "dd/MM/yyyy")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="secondary" className={`${cfg.color} text-xs`}>
          <Icon className="h-3 w-3 mr-1" />
          {cfg.label}
        </Badge>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

/* ── Main Panel ── */
export function ClientInvoicesPanel({
  clientId,
  unseenIds,
  canDownloadInvoices = true,
  canViewAttachments = true,
  canDownloadAttachments = true,
  filterMonth,
  locale,
}: {
  clientId: string;
  unseenIds?: Set<string>;
  canDownloadInvoices?: boolean;
  canViewAttachments?: boolean;
  canDownloadAttachments?: boolean;
  filterMonth?: Date;
  locale?: string;
}) {
  const CI_T: Record<string, { invoices: string; loading: string; history: string; older: string; total: string; details: string }> = {
    pt: { invoices: "Faturas", loading: "Carregando faturas...", history: "Ver histórico", older: "Faturas anteriores", total: "fatura(s) no total", details: "Detalhes da fatura" },
    en: { invoices: "Invoices", loading: "Loading invoices...", history: "View history", older: "Previous invoices", total: "invoice(s) total", details: "Invoice details" },
    it: { invoices: "Fatture", loading: "Caricamento fatture...", history: "Vedi cronologia", older: "Fatture precedenti", total: "fattura/e in totale", details: "Dettagli fattura" },
    es: { invoices: "Facturas", loading: "Cargando facturas...", history: "Ver historial", older: "Facturas anteriores", total: "factura(s) en total", details: "Detalles de la factura" },
    sv: { invoices: "Fakturor", loading: "Laddar fakturor...", history: "Visa historik", older: "Tidigare fakturor", total: "faktura/or totalt", details: "Fakturadetaljer" },
  };
  const ci = CI_T[(locale as string) in CI_T ? (locale as string) : "pt"];
  const { invoices, loading } = useInvoices(clientId);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const visibleInvoices = useMemo(() => {
    let list = invoices.filter((inv) => inv.client_visible !== false);
    if (filterMonth) {
      const ms = startOfMonth(filterMonth);
      const me = endOfMonth(filterMonth);
      list = list.filter((inv) => {
        const d = new Date(inv.issue_date);
        return d >= ms && d <= me;
      });
    }
    return list;
  }, [invoices, filterMonth]);

  // Helper: was this invoice created in the last 7 days?
  const isRecentlyCreated = (inv: Invoice) => {
    const created = new Date((inv as any).created_at || inv.issue_date);
    const diffMs = Date.now() - created.getTime();
    return diffMs <= 7 * 24 * 60 * 60 * 1000;
  };

  // Show in main card: all unpaid (open/overdue) + the single most recent paid one.
  // Everything else (older paid/cancelled) goes to history.
  const { recentInvoices, olderInvoices } = useMemo(() => {
    const unpaid = visibleInvoices.filter((i) => i.status === "open" || i.status === "overdue");
    const paid = visibleInvoices.filter((i) => i.status === "paid");
    const others = visibleInvoices.filter((i) => i.status !== "open" && i.status !== "overdue" && i.status !== "paid");
    const mostRecentPaid = paid[0];
    const recent = [...unpaid, ...(mostRecentPaid ? [mostRecentPaid] : [])].slice(0, MAX_RECENT);
    const recentIds = new Set(recent.map((i) => i.id));
    const older = visibleInvoices.filter((i) => !recentIds.has(i.id));
    return { recentInvoices: recent, olderInvoices: older };
  }, [visibleInvoices]);
  const hasOlder = olderInvoices.length > 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5" />
            Faturas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Carregando faturas...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (visibleInvoices.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5" />
              Faturas
            </CardTitle>
            {hasOlder && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHistoryOpen(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <History className="h-3.5 w-3.5 mr-1.5" />
                Ver histórico ({olderInvoices.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentInvoices.map((inv) => {
            const unseen = unseenIds ? !unseenIds.has(`invoice:${inv.id}`) : false;
            const showNew = unseen || isRecentlyCreated(inv);
            return <InvoiceRow key={inv.id} invoice={inv} onSelect={setSelectedInvoice} isNew={showNew} />;
          })}

          {hasOlder && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="w-full rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <History className="h-4 w-4 inline mr-1.5 -mt-0.5" />
              Faturas anteriores ({olderInvoices.length})
            </button>
          )}
        </CardContent>
      </Card>

      {/* History Sheet */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de faturas
            </SheetTitle>
            <SheetDescription>
              {visibleInvoices.length} fatura{visibleInvoices.length !== 1 ? "s" : ""} no total
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="space-y-2 p-4">
              {visibleInvoices.map((inv) => {
                const unseen = unseenIds ? !unseenIds.has(`invoice:${inv.id}`) : false;
                const showNew = unseen || isRecentlyCreated(inv);
                return (
                  <InvoiceRow
                    key={inv.id}
                    invoice={inv}
                    isNew={showNew}
                    onSelect={(inv) => {
                      setSelectedInvoice(inv);
                      setHistoryOpen(false);
                    }}
                  />
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={(v) => { if (!v) setSelectedInvoice(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedInvoice?.title || `Fatura #${selectedInvoice?.invoice_number}`}
            </DialogTitle>
            <DialogDescription>
              Detalhes da fatura
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <InvoiceDetail
              invoice={selectedInvoice}
              canDownloadInvoices={canDownloadInvoices}
              canViewAttachments={canViewAttachments}
              canDownloadAttachments={canDownloadAttachments}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
