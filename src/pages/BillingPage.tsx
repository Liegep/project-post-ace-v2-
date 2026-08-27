import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useInvoices, Invoice, createInvoice, updateInvoice, deleteInvoice } from "@/hooks/useInvoices";
import { MobileNav } from "@/components/MobileNav";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, ArrowLeft, FileText, DollarSign, AlertCircle, CheckCircle2, XCircle, Clock, TrendingUp, Eye, EyeOff, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import IssuerSettingsPanel from "@/components/billing/IssuerSettingsPanel";
import { formatCurrency } from "@/lib/currency";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Aberta", color: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: Clock },
  paid: { label: "Paga", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  overdue: { label: "Atrasada", color: "bg-red-500/15 text-red-600 border-red-500/30", icon: AlertCircle },
  cancelled: { label: "Cancelada", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

interface Client {
  id: string;
  name: string;
  logo_url: string;
  slug: string;
}

const BillingPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userId } = useUserRole();
  const { invoices, loading, refetch } = useInvoices();
  const [clients, setClients] = useState<Client[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [issuerOpen, setIssuerOpen] = useState(false);
  
  // Filters
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Create form
  const [formClientId, setFormClientId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formPeriodStart, setFormPeriodStart] = useState("");
  const [formPeriodEnd, setFormPeriodEnd] = useState("");
  const [formIssueDate, setFormIssueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formDueDate, setFormDueDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formClientVisible, setFormClientVisible] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchClients = async () => {
      if (!userId) return;
      const { data: assignments } = await supabase
        .from("user_client_assignments")
        .select("client_id")
        .eq("user_id", userId);
      const ids = (assignments || []).map((a: any) => a.client_id);
      const { data: owned } = await supabase.from("clients").select("id").eq("owner_id", userId);
      const ownedIds = (owned || []).map((c: any) => c.id);
      const allIds = [...new Set([...ids, ...ownedIds])];
      if (allIds.length > 0) {
        const { data } = await supabase.from("clients").select("id, name, logo_url, slug").in("id", allIds).order("name");
        setClients((data as Client[]) || []);
      }
    };
    fetchClients();
  }, [userId]);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateOpen(true);
    }
  }, [searchParams]);

  const handleCreate = async () => {
    if (!formClientId || !formTitle) return;
    setSaving(true);
    try {
      const client = clients.find((entry) => entry.id === formClientId);
      const { data: clientDetails } = await supabase
        .from("clients")
        .select("name, address, country, tax_id, locale, billing_currency")
        .eq("id", formClientId)
        .maybeSingle();

      const created = await createInvoice({
        client_id: formClientId,
        title: formTitle,
        currency_code: (clientDetails as any)?.billing_currency || "BRL",
        locale: (clientDetails as any)?.locale || "pt",
        period_start: formPeriodStart || undefined,
        period_end: formPeriodEnd || undefined,
        issue_date: formIssueDate,
        due_date: formDueDate || formIssueDate,
        notes: formNotes,
        created_by: userId || undefined,
        client_visible: formClientVisible,
        recipient_name: (clientDetails as any)?.name || client?.name || "",
        recipient_address: (clientDetails as any)?.address || "",
        recipient_country: (clientDetails as any)?.country || "",
        recipient_tax_id: (clientDetails as any)?.tax_id || "",
      });
      toast({ title: "Fatura criada com sucesso" });
      setCreateOpen(false);
      setSearchParams({});
      resetForm();
      refetch();
      navigate(`/billing/${(created as Invoice).id}`);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormClientId("");
    setFormTitle("");
    setFormPeriodStart("");
    setFormPeriodEnd("");
    setFormIssueDate(format(new Date(), "yyyy-MM-dd"));
    setFormDueDate("");
    setFormNotes("");
    setFormClientVisible(true);
  };

  // Compute totals per invoice from items
  const [invoiceTotals, setInvoiceTotals] = useState<Record<string, number>>({});
  useEffect(() => {
    const fetchTotals = async () => {
      if (invoices.length === 0) return;
      const ids = invoices.map(i => i.id);
      const { data } = await supabase
        .from("invoice_items")
        .select("invoice_id, total_price")
        .in("invoice_id", ids);
      const totals: Record<string, number> = {};
      (data || []).forEach((item: any) => {
        totals[item.invoice_id] = (totals[item.invoice_id] || 0) + Number(item.total_price || 0);
      });
      setInvoiceTotals(totals);
    };
    fetchTotals();
  }, [invoices]);

  // Auto-mark overdue invoices
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    invoices.forEach(async (inv) => {
      if (inv.status === "open" && inv.due_date) {
        const due = new Date(inv.due_date);
        due.setHours(0, 0, 0, 0);
        if (due < today) {
          await updateInvoice(inv.id, { status: "overdue" } as any);
        }
      }
    });
  }, [invoices]);

  // Filter invoices to only show those belonging to the user's assigned clients
  const userClientIds = useMemo(() => new Set(clients.map(c => c.id)), [clients]);
  
  const filtered = invoices.filter(inv => {
    // Only show invoices for clients assigned to this user
    if (userClientIds.size > 0 && !userClientIds.has(inv.client_id)) return false;
    if (filterClient !== "all" && inv.client_id !== filterClient) return false;
    if (filterStatus !== "all" && inv.status !== filterStatus) return false;
    if (filterMonth !== "all") {
      const month = inv.issue_date?.substring(0, 7);
      if (month !== filterMonth) return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const clientName = inv.clients?.name?.toLowerCase() || "";
      return inv.title.toLowerCase().includes(term) || clientName.includes(term) || String(inv.invoice_number).includes(term);
    }
    return true;
  });

  const months = [...new Set(invoices.map(i => i.issue_date?.substring(0, 7)).filter(Boolean))].sort().reverse();

  const getTotal = (inv: Invoice) => {
    const subtotal = invoiceTotals[inv.id] || 0;
    return subtotal - Number(inv.discount || 0) + Number(inv.surcharge || 0);
  };

  // Financial summary
  // Only count invoices for user's assigned clients in summary
  const userInvoices = useMemo(() => 
    invoices.filter(inv => userClientIds.size === 0 || userClientIds.has(inv.client_id)),
    [invoices, userClientIds]
  );
  const financialSummary = useMemo(() => {
    const byCurrency: Record<string, { totalBilled: number; totalReceived: number; totalPending: number; totalOverdue: number }> = {};
    const ensure = (c: string) => {
      if (!byCurrency[c]) byCurrency[c] = { totalBilled: 0, totalReceived: 0, totalPending: 0, totalOverdue: 0 };
    };
    userInvoices.forEach(i => {
      const cur = (i.clients as any)?.billing_currency || "BRL";
      const total = getTotal(i);
      ensure(cur);
      byCurrency[cur].totalBilled += total;
      if (i.status === "paid") byCurrency[cur].totalReceived += total;
      if (i.status === "open" || i.status === "overdue") byCurrency[cur].totalPending += total;
      if (i.status === "overdue") byCurrency[cur].totalOverdue += total;
    });
    // Sort: BRL first, then USD, then EUR, then others
    const order = ["BRL", "USD", "EUR", "SEK"];
    const sorted = Object.keys(byCurrency).sort((a, b) => {
      const ai = order.indexOf(a); const bi = order.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return { byCurrency, currencies: sorted };
  }, [userInvoices, invoiceTotals]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-header">
        <div className="mx-auto max-w-5xl flex items-center gap-3 px-4 py-3">
          <MobileNav title="Faturamento" />
          <Button variant="ghost" size="icon" className="group bg-white hover:bg-foreground shadow-md border border-border/40 transition-colors" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5 text-black group-hover:text-white transition-colors" strokeWidth={2.5} />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <DollarSign className="h-5 w-5 text-primary" />
            <h1 className="type-heading">Faturamento</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIssuerOpen(true)} className="gap-1.5">
            <Building2 className="h-4 w-4" /> Dados da Empresa
          </Button>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova Fatura
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        {/* Financial Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 border-l-4 border-l-primary">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Total Faturado</span>
            </div>
            <div className="space-y-0.5">
              {financialSummary.currencies.map(cur => (
                <p key={cur} className="text-sm font-bold">
                  {formatCurrency(financialSummary.byCurrency[cur].totalBilled, cur)}
                </p>
              ))}
              {financialSummary.currencies.length === 0 && <p className="text-lg font-bold">{formatCurrency(0)}</p>}
            </div>
          </Card>
          <Card className="p-3 border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground">Total Recebido</span>
            </div>
            <div className="space-y-0.5">
              {financialSummary.currencies.map(cur => (
                <p key={cur} className="text-sm font-bold text-emerald-600">
                  {formatCurrency(financialSummary.byCurrency[cur].totalReceived, cur)}
                </p>
              ))}
              {financialSummary.currencies.length === 0 && <p className="text-lg font-bold text-emerald-600">{formatCurrency(0)}</p>}
            </div>
          </Card>
          <Card className="p-3 border-l-4 border-l-amber-500">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Total Pendente</span>
            </div>
            <div className="space-y-0.5">
              {financialSummary.currencies.map(cur => (
                <p key={cur} className="text-sm font-bold text-amber-600">
                  {formatCurrency(financialSummary.byCurrency[cur].totalPending, cur)}
                </p>
              ))}
              {financialSummary.currencies.length === 0 && <p className="text-lg font-bold text-amber-600">{formatCurrency(0)}</p>}
            </div>
          </Card>
          <Card className="p-3 border-l-4 border-l-red-500">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-muted-foreground">Total Atrasado</span>
            </div>
            <div className="space-y-0.5">
              {financialSummary.currencies.map(cur => (
                <p key={cur} className="text-sm font-bold text-red-600">
                  {formatCurrency(financialSummary.byCurrency[cur].totalOverdue, cur)}
                </p>
              ))}
              {financialSummary.currencies.length === 0 && <p className="text-lg font-bold text-red-600">{formatCurrency(0)}</p>}
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar fatura..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Aberta</SelectItem>
              <SelectItem value="paid">Paga</SelectItem>
              <SelectItem value="overdue">Atrasada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map(m => (
                <SelectItem key={m} value={m!}>
                  {format(new Date(m + "-01"), "MMM yyyy", { locale: ptBR })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status quick filter cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["open", "paid", "overdue", "cancelled"] as const).map(status => {
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;
            const count = invoices.filter(i => i.status === status).length;
            return (
              <Card 
                key={status} 
                className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${filterStatus === status ? "ring-2 ring-primary" : ""}`} 
                onClick={() => setFilterStatus(status === filterStatus ? "all" : status)}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{cfg.label}</span>
                  <span className="ml-auto text-lg font-bold">{count}</span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Invoice list */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
            <Button variant="outline" className="mt-3" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Criar primeira fatura
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(inv => {
              const cfg = STATUS_CONFIG[inv.status];
              const Icon = cfg.icon;
              const total = getTotal(inv);
              const isVisible = (inv as any).client_visible !== false;
              return (
                <Card
                  key={inv.id}
                  className="p-4 cursor-pointer hover:shadow-md transition-all hover:border-primary/20"
                  onClick={() => navigate(`/billing/${inv.id}`)}
                >
                  <div className="flex items-center gap-3">
                    {inv.clients?.logo_url ? (
                      <img src={inv.clients.logo_url} className="h-9 w-9 rounded-full object-contain border shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center border shrink-0">
                        <span className="text-xs font-bold text-muted-foreground">
                          {inv.clients?.name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">#{inv.invoice_number}</span>
                        <h3 className="text-sm font-semibold truncate">{inv.title || "Sem título"}</h3>
                        {!isVisible && (
                          <Badge variant="outline" className="text-[9px] gap-0.5">
                            <EyeOff className="h-2.5 w-2.5" /> Interno
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{inv.clients?.name}</span>
                        {inv.period_start && inv.period_end && (
                          <span>
                            {format(new Date(inv.period_start), "dd/MM")} - {format(new Date(inv.period_end), "dd/MM/yyyy")}
                          </span>
                        )}
                        <span>Venc: {format(new Date(inv.due_date), "dd/MM/yyyy")}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatCurrency(total, inv.currency_code || inv.clients?.billing_currency)}</p>
                      <Badge variant="outline" className={`text-[10px] mt-1 ${cfg.color}`}>
                        <Icon className="h-3 w-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Invoice Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open && searchParams.get("create") === "1") setSearchParams({});
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Fatura</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Cliente *</Label>
              <Select value={formClientId} onValueChange={setFormClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Título *</Label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Ex: Fatura Março 2026" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Período início</Label>
                <Input type="date" value={formPeriodStart} onChange={e => setFormPeriodStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Período fim</Label>
                <Input type="date" value={formPeriodEnd} onChange={e => setFormPeriodEnd(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Data de emissão</Label>
                <Input type="date" value={formIssueDate} onChange={e => setFormIssueDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} placeholder="Condições de pagamento, resumo..." />
            </div>
            <div className="flex items-center justify-between py-1">
              <div>
                <Label className="text-xs">Visível para o cliente</Label>
                <p className="text-[10px] text-muted-foreground">Se desativado, a fatura fica apenas interna</p>
              </div>
              <Switch checked={formClientVisible} onCheckedChange={setFormClientVisible} />
            </div>
            <Button onClick={handleCreate} disabled={saving || !formClientId || !formTitle} className="w-full">
              {saving ? "Criando..." : "Criar Fatura"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <IssuerSettingsPanel open={issuerOpen} onOpenChange={setIssuerOpen} />
    </div>
  );
};

export default BillingPage;
