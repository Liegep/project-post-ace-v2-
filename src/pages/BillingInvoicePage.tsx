import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { InvoicePreviewCard } from "@/components/billing/InvoicePreviewCard";
import { toast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { DEFAULT_ISSUER, useIssuerDetails } from "@/hooks/useIssuerDetails";
import {
  InvoiceItem,
  createInvoiceAttachment,
  createInvoiceItem,
  deleteInvoice,
  deleteInvoiceAttachment,
  deleteInvoiceItem,
  updateInvoice,
  updateInvoiceItem,
  useInvoice,
  useInvoiceAttachments,
  useInvoiceItems,
  useInvoices,
} from "@/hooks/useInvoices";
import { supabase } from "@/integrations/supabase/client";
import { CURRENCIES, formatCurrency } from "@/lib/currency";
import { generateInvoicePDF } from "@/lib/invoicePdf";

const STATUS_OPTIONS = [
  { value: "open", label: "Aberta", icon: Clock, className: "bg-blue-100 text-blue-700" },
  { value: "paid", label: "Paga", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700" },
  { value: "overdue", label: "Atrasada", icon: AlertCircle, className: "bg-rose-100 text-rose-700" },
  { value: "cancelled", label: "Cancelada", icon: XCircle, className: "bg-stone-200 text-stone-600" },
] as const;

const LOCALE_OPTIONS = [
  { value: "pt", label: "Português" },
  { value: "en", label: "English" },
  { value: "it", label: "Italiano" },
  { value: "es", label: "Español" },
  { value: "sv", label: "Svenska" },
] as const;

const PAYMENT_METHODS = [
  { value: "none", label: "Nenhum" },
  { value: "Pix", label: "Pix" },
  { value: "PayPal", label: "PayPal" },
  { value: "Transferência", label: "Transferência" },
  { value: "Boleto", label: "Boleto" },
  { value: "Cartão", label: "Cartão" },
  { value: "Outro", label: "Outro" },
];

const ITEM_CATEGORIES = [
  { value: "mensalidade", label: "Mensalidade" },
  { value: "post", label: "Post" },
  { value: "reels", label: "Reels" },
  { value: "design", label: "Design" },
  { value: "consultoria", label: "Consultoria" },
  { value: "outro", label: "Outro" },
];

const NOTIFICATION_COPY: Record<string, { title: string; message: string }> = {
  pt: { title: "Nova fatura", message: "Valor {total} • Vencimento {due}" },
  en: { title: "New invoice", message: "Amount {total} • Due {due}" },
  it: { title: "Nuova fattura", message: "Importo {total} • Scadenza {due}" },
  es: { title: "Nueva factura", message: "Importe {total} • Vence {due}" },
  sv: { title: "Ny faktura", message: "Belopp {total} • Förfaller {due}" },
};

interface ClientSummary {
  id: string;
  name: string;
  slug: string;
  address: string;
  country: string;
  tax_id: string;
  locale: string;
  billing_currency: string;
}

const emptyItemForm = {
  id: "",
  name: "",
  description: "",
  category: "outro",
  service_date: format(new Date(), "yyyy-MM-dd"),
  quantity: "1",
  unit_price: "",
  notes: "",
};

export default function BillingInvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useUserRole();
  const { invoice, loading, refetch } = useInvoice(id);
  const { invoices } = useInvoices();
  const { issuer, refetch: refetchIssuer } = useIssuerDetails();
  const { items, refetch: refetchItems } = useInvoiceItems(id || "");
  const { attachments, refetch: refetchAttachments } = useInvoiceAttachments(id || "");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [itemSaving, setItemSaving] = useState(false);
  const [itemEditorOpen, setItemEditorOpen] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItemForm);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"open" | "paid" | "overdue" | "cancelled">("open");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [discount, setDiscount] = useState("0");
  const [surcharge, setSurcharge] = useState("0");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("none");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [clientVisible, setClientVisible] = useState(true);
  const [currencyCode, setCurrencyCode] = useState("BRL");
  const [locale, setLocale] = useState("pt");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientCountry, setRecipientCountry] = useState("");
  const [recipientTaxId, setRecipientTaxId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFixedAmount, setRecurringFixedAmount] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      if (!userId) return;
      const { data: assignments } = await supabase
        .from("user_client_assignments")
        .select("client_id")
        .eq("user_id", userId);
      const ids = (assignments || []).map((row: { client_id: string }) => row.client_id);
      const { data: owned } = await supabase.from("clients").select("id").eq("owner_id", userId);
      const ownedIds = (owned || []).map((row: { id: string }) => row.id);
      const allIds = [...new Set([...ids, ...ownedIds, invoice?.client_id].filter(Boolean))];
      if (allIds.length === 0) return;

      const { data } = await supabase
        .from("clients")
        .select("id, name, slug, address, country, tax_id, locale, billing_currency")
        .in("id", allIds)
        .order("name");

      setClients((data as ClientSummary[]) || []);
    };

    fetchClients();
  }, [invoice?.client_id, userId]);

  useEffect(() => {
    if (!invoice) return;
    setTitle(invoice.title || "");
    setStatus(invoice.status);
    setIssueDate(invoice.issue_date || format(new Date(), "yyyy-MM-dd"));
    setDueDate(invoice.due_date || format(new Date(), "yyyy-MM-dd"));
    setPeriodStart(invoice.period_start || "");
    setPeriodEnd(invoice.period_end || "");
    setDiscount(String(invoice.discount || 0));
    setSurcharge(String(invoice.surcharge || 0));
    setNotes(invoice.notes || "");
    setPaymentMethod(invoice.payment_method || "none");
    setPaymentDetails(invoice.payment_details || "");
    setClientVisible(invoice.client_visible !== false);
    setCurrencyCode(invoice.currency_code || invoice.clients?.billing_currency || "BRL");
    setLocale(invoice.locale || invoice.clients?.locale || "pt");
    setRecipientName(invoice.recipient_name || invoice.clients?.name || "");
    setRecipientEmail(invoice.recipient_email || "");
    setRecipientAddress(invoice.recipient_address || invoice.clients?.address || "");
    setRecipientCountry(invoice.recipient_country || invoice.clients?.country || "");
    setRecipientTaxId(invoice.recipient_tax_id || invoice.clients?.tax_id || "");
    setIsRecurring(invoice.is_recurring || false);
    setRecurringFixedAmount(invoice.recurring_fixed_amount !== false);
  }, [invoice]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.total_price || 0), 0),
    [items],
  );
  const total = subtotal - Number(discount || 0) + Number(surcharge || 0);

  const selectedStatus = STATUS_OPTIONS.find((option) => option.value === status) || STATUS_OPTIONS[0];
  const selectedClient = clients.find((client) => client.id === invoice?.client_id);

  const filteredInvoices = useMemo(() => {
    const term = sidebarSearch.trim().toLowerCase();
    return invoices.filter((entry) => {
      if (!term) return true;
      const clientName = entry.clients?.name?.toLowerCase() || "";
      return (
        (entry.title || "").toLowerCase().includes(term) ||
        clientName.includes(term) ||
        String(entry.invoice_number).includes(term)
      );
    });
  }, [invoices, sidebarSearch]);

  const previewInvoice = useMemo(() => {
    if (!invoice) return null;
    return {
      ...invoice,
      title,
      status,
      issue_date: issueDate,
      due_date: dueDate,
      period_start: periodStart || null,
      period_end: periodEnd || null,
      discount: Number(discount || 0),
      surcharge: Number(surcharge || 0),
      notes,
      payment_method: paymentMethod === "none" ? "" : paymentMethod,
      payment_details: paymentDetails,
      client_visible: clientVisible,
      currency_code: currencyCode,
      locale,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      recipient_address: recipientAddress,
      recipient_country: recipientCountry,
      recipient_tax_id: recipientTaxId,
      is_recurring: isRecurring,
      recurring_fixed_amount: recurringFixedAmount,
    };
  }, [
    clientVisible,
    currencyCode,
    discount,
    dueDate,
    invoice,
    isRecurring,
    issueDate,
    locale,
    notes,
    paymentDetails,
    paymentMethod,
    periodEnd,
    periodStart,
    recipientAddress,
    recipientCountry,
    recipientEmail,
    recipientName,
    recipientTaxId,
    recurringFixedAmount,
    status,
    surcharge,
    title,
  ]);

  const handleSave = async () => {
    if (!invoice) return;
    setSaving(true);
    try {
      await updateInvoice(invoice.id, {
        title,
        status,
        issue_date: issueDate,
        due_date: dueDate,
        period_start: periodStart || null,
        period_end: periodEnd || null,
        discount: Number(discount || 0),
        surcharge: Number(surcharge || 0),
        notes,
        payment_method: paymentMethod === "none" ? "" : paymentMethod,
        payment_details: paymentDetails,
        client_visible: clientVisible,
        currency_code: currencyCode,
        locale,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        recipient_address: recipientAddress,
        recipient_country: recipientCountry,
        recipient_tax_id: recipientTaxId,
        is_recurring: isRecurring,
        recurring_fixed_amount: recurringFixedAmount,
        paid_at: status === "paid" ? invoice.paid_at || new Date().toISOString() : null,
      } as Partial<typeof previewInvoice>);

      await supabase
        .from("clients")
        .update({
          billing_currency: currencyCode,
          locale,
          billing_type: isRecurring ? "recurring" : "one_off",
          billing_recurrence_active: isRecurring,
          billing_monthly_amount: isRecurring && recurringFixedAmount ? total : 0,
          billing_description: title,
          billing_due_day: Number((dueDate || issueDate).slice(-2)) || 1,
          billing_start_date: isRecurring ? (issueDate || null) : null,
        } as never)
        .eq("id", invoice.client_id);

      toast({ title: "Fatura atualizada" });
      await Promise.all([refetch(), refetchIssuer()]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar a fatura.";
      toast({ title: "Erro ao salvar", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice || !window.confirm("Deseja excluir esta fatura?")) return;
    try {
      await deleteInvoice(invoice.id);
      toast({ title: "Fatura excluída" });
      navigate("/billing");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível excluir a fatura.";
      toast({ title: "Erro ao excluir", description: message, variant: "destructive" });
    }
  };

  const handleDownloadPdf = async () => {
    if (!previewInvoice) return;
    await generateInvoicePDF(previewInvoice, items, total, subtotal, currencyCode, issuer || DEFAULT_ISSUER);
  };

  const handleSendToClient = async () => {
    if (!invoice) return;
    if (!clientVisible) {
      toast({
        title: "Fatura interna",
        description: "Ative a visibilidade para o cliente antes de enviar.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { data: assignments, error: assignmentsError } = await supabase
        .from("user_client_assignments")
        .select("user_id")
        .eq("client_id", invoice.client_id);
      if (assignmentsError) throw assignmentsError;

      const userIds = (assignments || []).map((row: { user_id: string }) => row.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", userIds)
        .eq("role", "client" as never);
      const clientUserIds = (roles || []).map((row: { user_id: string }) => row.user_id);
      const { data: permissions, error: permissionsError } = await supabase
        .from("client_billing_permissions")
        .select("user_id, expires_at")
        .eq("client_id", invoice.client_id)
        .in("user_id", clientUserIds.length ? clientUserIds : userIds)
        .eq("can_view_invoices", true);
      if (permissionsError) throw permissionsError;

      const activeIds = (permissions || [])
        .filter((permission: { expires_at: string | null }) => !permission.expires_at || new Date(permission.expires_at).getTime() > Date.now())
        .map((permission: { user_id: string }) => permission.user_id);

      if (activeIds.length === 0) {
        toast({
          title: "Sem destinatários",
          description: "Nenhum usuário deste cliente tem permissão ativa para ver faturas.",
          variant: "destructive",
        });
        return;
      }

      const copy = NOTIFICATION_COPY[locale] || NOTIFICATION_COPY.pt;
      const dueFormatted = format(new Date(dueDate), locale === "en" ? "MM/dd/yyyy" : "dd/MM/yyyy");
      const rows = activeIds.map((userIdValue) => ({
        type: "invoice_sent",
        title: `${copy.title}: ${title || `#${invoice.invoice_number}`}`,
        message: copy.message
          .replace("{total}", formatCurrency(total, currencyCode))
          .replace("{due}", dueFormatted),
        user_id: userIdValue,
        client_id: invoice.client_id,
        post_id: null,
        read: false,
      }));

      const { error } = await supabase.from("admin_notifications").insert(rows as never);
      if (error) throw error;

      toast({
        title: "Fatura enviada ao cliente",
        description: "A fatura e os anexos ficarão disponíveis no portal do cliente.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível enviar a fatura.";
      toast({ title: "Erro ao enviar", description: message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const openNewItem = () => {
    setItemForm({
      ...emptyItemForm,
      service_date: issueDate || format(new Date(), "yyyy-MM-dd"),
    });
    setItemEditorOpen(true);
  };

  const editItem = (item: InvoiceItem) => {
    setItemForm({
      id: item.id,
      name: item.name,
      description: item.description || "",
      category: item.category || "outro",
      service_date: item.service_date || issueDate,
      quantity: String(item.quantity || 1),
      unit_price: String(item.unit_price || 0),
      notes: item.notes || "",
    });
    setItemEditorOpen(true);
  };

  const handleSaveItem = async () => {
    if (!invoice || !itemForm.name.trim()) return;
    setItemSaving(true);
    try {
      const quantity = Number(itemForm.quantity || 1);
      const unitPrice = Number(itemForm.unit_price || 0);
      const payload = {
        invoice_id: invoice.id,
        name: itemForm.name.trim(),
        description: itemForm.description.trim(),
        category: itemForm.category,
        service_date: itemForm.service_date || issueDate,
        quantity,
        unit_price: unitPrice,
        total_price: quantity * unitPrice,
        notes: itemForm.notes.trim(),
      };

      if (itemForm.id) {
        await updateInvoiceItem(itemForm.id, payload);
      } else {
        await createInvoiceItem(payload);
      }

      setItemEditorOpen(false);
      setItemForm(emptyItemForm);
      await Promise.all([refetchItems(), refetch()]);
      toast({ title: itemForm.id ? "Item atualizado" : "Item adicionado" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar o item.";
      toast({ title: "Erro no item", description: message, variant: "destructive" });
    } finally {
      setItemSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteInvoiceItem(itemId);
      await Promise.all([refetchItems(), refetch()]);
      toast({ title: "Item removido" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível remover o item.";
      toast({ title: "Erro ao remover", description: message, variant: "destructive" });
    }
  };

  const handleUploadAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !invoice) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `invoices/${invoice.id}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from("media").upload(path, file, {
        contentType: file.type || "application/pdf",
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("media").getPublicUrl(path);
      await createInvoiceAttachment({
        invoice_id: invoice.id,
        file_name: file.name,
        file_url: data.publicUrl,
        uploaded_by: userId || undefined,
      });
      await refetchAttachments();
      toast({ title: "PDF anexado" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível anexar o arquivo.";
      toast({ title: "Erro no upload", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await deleteInvoiceAttachment(attachmentId);
      await refetchAttachments();
      toast({ title: "Anexo removido" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível remover o anexo.";
      toast({ title: "Erro ao remover", description: message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 glass-header">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
            <MobileNav title="Faturamento" />
            <Button variant="ghost" size="icon" onClick={() => navigate("/billing")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">Fatura</h1>
          </div>
        </header>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!invoice || !previewInvoice) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 glass-header">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
            <MobileNav title="Faturamento" />
            <Button variant="ghost" size="icon" onClick={() => navigate("/billing")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">Fatura</h1>
          </div>
        </header>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg font-semibold">Fatura não encontrada</p>
          <p className="mt-2 text-sm text-muted-foreground">Ela pode ter sido removida ou você não tem acesso.</p>
          <Button className="mt-5" onClick={() => navigate("/billing")}>
            Voltar para faturamento
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.12),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#f3f6fb_50%,#eef3f9_100%)]">
      <header className="sticky top-0 z-30 border-b border-white/50 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <MobileNav title="Faturamento" />
          <Button variant="ghost" size="icon" className="bg-white shadow-sm" onClick={() => navigate("/billing")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Fatura #{invoice.invoice_number}</p>
            <h1 className="text-lg font-bold">{title || "Sem título"}</h1>
          </div>
          <Badge className={selectedStatus.className}>
            <selectedStatus.icon className="mr-1 h-3.5 w-3.5" />
            {selectedStatus.label}
          </Badge>
          <Button variant="outline" onClick={handleDownloadPdf}>
            <Download className="mr-2 h-4 w-4" />
            Baixar PDF
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-6 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="space-y-4">
          <Card className="rounded-[28px] border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Biblioteca</p>
                <h2 className="mt-1 text-xl font-semibold">Faturas</h2>
              </div>
              <Button size="sm" onClick={() => navigate("/billing?create=1")}>
                <Plus className="mr-1 h-4 w-4" />
                Nova
              </Button>
            </div>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={sidebarSearch}
                onChange={(event) => setSidebarSearch(event.target.value)}
                placeholder="Buscar fatura"
                className="pl-9"
              />
            </div>
            <ScrollArea className="mt-4 h-[55vh] pr-2">
              <div className="space-y-2">
                {filteredInvoices.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => navigate(`/billing/${entry.id}`)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${entry.id === invoice.id ? "border-primary bg-primary/8 shadow-sm" : "border-border/70 bg-white hover:border-primary/30 hover:bg-primary/5"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-muted-foreground">#{entry.invoice_number}</p>
                        <p className="truncate text-sm font-semibold">{entry.title || "Sem título"}</p>
                        <p className="truncate text-xs text-muted-foreground">{entry.clients?.name}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {entry.due_date ? `Venc. ${format(new Date(entry.due_date), "dd/MM")}` : ""}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </aside>

        <section className="space-y-4">
          <InvoicePreviewCard
            invoice={previewInvoice}
            items={items}
            issuer={issuer || DEFAULT_ISSUER}
            subtotal={subtotal}
            total={total}
          />

          <Card className="rounded-[28px] border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Itens</p>
                <h2 className="mt-1 text-xl font-semibold">Composição da fatura</h2>
              </div>
              <Button onClick={openNewItem}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar item
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {items.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  Ainda não há itens nesta fatura.
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-border/70 bg-white px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold">{item.name}</p>
                        {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{ITEM_CATEGORIES.find((entry) => entry.value === item.category)?.label || item.category}</span>
                          <span>{format(new Date(item.service_date), "dd/MM/yyyy")}</span>
                          <span>{item.quantity}x</span>
                          <span>{formatCurrency(Number(item.unit_price || 0), currencyCode)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">{formatCurrency(Number(item.total_price || 0), currencyCode)}</p>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => editItem(item)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteItem(item.id)}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {itemEditorOpen && (
              <div className="mt-5 rounded-[28px] border border-primary/20 bg-primary/5 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label>Nome do item</Label>
                    <Input value={itemForm.name} onChange={(event) => setItemForm((state) => ({ ...state, name: event.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Descrição</Label>
                    <Textarea value={itemForm.description} onChange={(event) => setItemForm((state) => ({ ...state, description: event.target.value }))} rows={2} />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select value={itemForm.category} onValueChange={(value) => setItemForm((state) => ({ ...state, category: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ITEM_CATEGORIES.map((entry) => (
                          <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input type="date" value={itemForm.service_date} onChange={(event) => setItemForm((state) => ({ ...state, service_date: event.target.value }))} />
                  </div>
                  <div>
                    <Label>Quantidade</Label>
                    <Input type="number" min="1" value={itemForm.quantity} onChange={(event) => setItemForm((state) => ({ ...state, quantity: event.target.value }))} />
                  </div>
                  <div>
                    <Label>Valor unitário</Label>
                    <Input type="number" step="0.01" value={itemForm.unit_price} onChange={(event) => setItemForm((state) => ({ ...state, unit_price: event.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Observações</Label>
                    <Textarea value={itemForm.notes} onChange={(event) => setItemForm((state) => ({ ...state, notes: event.target.value }))} rows={2} />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button onClick={handleSaveItem} disabled={itemSaving}>
                    {itemSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {itemForm.id ? "Atualizar item" : "Adicionar item"}
                  </Button>
                  <Button variant="outline" onClick={() => { setItemEditorOpen(false); setItemForm(emptyItemForm); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </section>

        <aside className="space-y-4">
          <Card className="rounded-[28px] border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Ações</p>
            <div className="mt-4 space-y-2">
              <Button className="w-full justify-start" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar alterações
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={handleDownloadPdf}>
                <Download className="mr-2 h-4 w-4" />
                Baixar PDF
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={handleSendToClient} disabled={sending}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar para cliente
              </Button>
              <Button variant="destructive" className="w-full justify-start" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir fatura
              </Button>
            </div>
          </Card>

          <Card className="rounded-[28px] border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Cliente</p>
                <h2 className="mt-1 text-lg font-semibold">{selectedClient?.name || invoice.clients?.name}</h2>
              </div>
              <Globe2 className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <Label>Nome na fatura</Label>
                <Input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
              </div>
              <div>
                <Label>E-mail do cliente</Label>
                <Input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} />
              </div>
              <div>
                <Label>Endereço</Label>
                <Textarea value={recipientAddress} onChange={(event) => setRecipientAddress(event.target.value)} rows={3} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>País</Label>
                  <Input value={recipientCountry} onChange={(event) => setRecipientCountry(event.target.value)} />
                </div>
                <div>
                  <Label>Tax ID / VAT / CNPJ</Label>
                  <Input value={recipientTaxId} onChange={(event) => setRecipientTaxId(event.target.value)} />
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-[28px] border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Configuração</p>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Título</Label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(value: typeof status) => setStatus(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((entry) => (
                      <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Emissão</Label>
                  <Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
                </div>
                <div>
                  <Label>Vencimento</Label>
                  <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Período inicial</Label>
                  <Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
                </div>
                <div>
                  <Label>Período final</Label>
                  <Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Moeda</Label>
                  <Select value={currencyCode} onValueChange={setCurrencyCode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>{currency.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Idioma do cliente</Label>
                  <Select value={locale} onValueChange={setLocale}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LOCALE_OPTIONS.map((entry) => (
                        <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Desconto</Label>
                  <Input type="number" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} />
                </div>
                <div>
                  <Label>Acréscimo</Label>
                  <Input type="number" step="0.01" value={surcharge} onChange={(event) => setSurcharge(event.target.value)} />
                </div>
              </div>
              <div>
                <Label>Forma de pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((entry) => (
                      <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Detalhes de pagamento</Label>
                <Textarea value={paymentDetails} onChange={(event) => setPaymentDetails(event.target.value)} rows={3} />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium">Visível para o cliente</p>
                  <p className="text-xs text-muted-foreground">Se desligado, a fatura fica apenas interna.</p>
                </div>
                <Switch checked={clientVisible} onCheckedChange={setClientVisible} />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium">Fatura recorrente</p>
                  <p className="text-xs text-muted-foreground">Gera automaticamente para este cliente todo dia 1.</p>
                </div>
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
              </div>
              {isRecurring && (
                <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 p-3">
                  <div>
                    <p className="text-sm font-medium">Valor fixo</p>
                    <p className="text-xs text-muted-foreground">Quando ligado, usa o total atual como valor mensal.</p>
                  </div>
                  <Switch checked={recurringFixedAmount} onCheckedChange={setRecurringFixedAmount} />
                </div>
              )}
            </div>
          </Card>

          <Card className="rounded-[28px] border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Anexos</p>
                <h2 className="mt-1 text-lg font-semibold">PDFs e nota fiscal</h2>
              </div>
              <Paperclip className="h-5 w-5 text-muted-foreground" />
            </div>

            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleUploadAttachment} />
            <Button variant="outline" className="mt-4 w-full justify-start" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Anexar PDF
            </Button>

            <div className="mt-4 space-y-2">
              {attachments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                  Nenhum PDF anexado ainda.
                </div>
              ) : (
                attachments.map((attachment) => (
                  <div key={attachment.id} className="rounded-2xl border border-border/70 bg-white px-3 py-3">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-4 w-4 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{attachment.file_name}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(attachment.created_at), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={attachment.file_url} target="_blank" rel="noreferrer">
                          <Eye className="mr-2 h-3.5 w-3.5" />
                          Ver
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={attachment.file_url} download={attachment.file_name}>
                          <Download className="mr-2 h-3.5 w-3.5" />
                          Baixar
                        </a>
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteAttachment(attachment.id)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Remover
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-[28px] border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Resumo</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal, currencyCode)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Desconto</span>
                <span>- {formatCurrency(Number(discount || 0), currencyCode)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Acréscimo</span>
                <span>+ {formatCurrency(Number(surcharge || 0), currencyCode)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(total, currencyCode)}</span>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                {clientVisible ? (
                  <span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Esta fatura aparece no portal do cliente.</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><EyeOff className="h-3.5 w-3.5" /> Esta fatura está visível apenas internamente.</span>
                )}
              </div>
            </div>
          </Card>
        </aside>
      </main>
    </div>
  );
}
