import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSocialReports, useDeleteReport, SocialReport } from "@/hooks/useSocialReports";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "@/components/MobileNav";
import UserProfileMenu from "@/components/UserProfileMenu";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  Plus, FileBarChart, Trash2, Copy, Eye, Calendar, Pencil, Send,
  Instagram, Facebook, ArrowLeft
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
}

const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram,
  facebook: Facebook,
};

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  draft: { label: "Rascunho", class: "bg-muted text-muted-foreground" },
  published: { label: "Publicado", class: "bg-emerald-500/15 text-emerald-600" },
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const { isSuperAdmin, isAdmin, userId: currentUserId } = useUserRole();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const deleteReport = useDeleteReport();

  const clientFilter = selectedClient === "all" ? undefined : selectedClient;
  const { data: reports = [], isLoading } = useSocialReports(clientFilter);

  useEffect(() => {
    const fetchClients = async () => {
      if (!currentUserId) return;
      const { data: assignments } = await supabase
        .from("user_client_assignments")
        .select("client_id")
        .eq("user_id", currentUserId);
      const ids = (assignments || []).map((a: any) => a.client_id);
      const { data: owned } = await supabase.from("clients").select("id").eq("owner_id", currentUserId);
      const allIds = [...new Set([...ids, ...(owned || []).map((c: any) => c.id)])];
      if (allIds.length > 0) {
        const { data } = await supabase.from("clients").select("id, name, slug, logo_url").in("id", allIds).order("name");
        setClients((data as Client[]) || []);
      }
    };
    fetchClients();
  }, [currentUserId]);

  const handleDuplicate = async (report: SocialReport) => {
    const { id, created_at, updated_at, ...rest } = report;
    const { error } = await supabase.from("social_reports").insert({
      ...rest,
      title: `${rest.title} (cópia)`,
      status: "draft",
    } as any);
    if (error) {
      toast({ title: "Erro ao duplicar", variant: "destructive" });
    } else {
      toast({ title: "Relatório duplicado!" });
      // refetch handled by react-query
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este relatório?")) return;
    try {
      await deleteReport.mutateAsync(id);
      toast({ title: "Relatório excluído" });
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const handleResend = async (report: SocialReport) => {
    if (!confirm("Reenviar este relatório? Ele aparecerá novamente como novidade para o cliente.")) return;
    try {
      // Ensure it's published so the client area shows it
      if (report.status !== "published") {
        await supabase.from("social_reports").update({ status: "published" }).eq("id", report.id);
      }
      // Clear seen markers so the Novidades widget surfaces it again
      await supabase.from("client_seen_items").delete().eq("item_id", report.id).eq("item_type", "report");
      toast({ title: "Relatório reenviado ao cliente" });
    } catch {
      toast({ title: "Erro ao reenviar", variant: "destructive" });
    }
  };

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.04),transparent_70%)]">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-header">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <MobileNav title="Relatórios" />
            <Button variant="ghost" size="icon" className="hidden md:flex group bg-white hover:bg-foreground shadow-md border border-border/40 transition-colors" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5 text-black group-hover:text-white transition-colors" strokeWidth={2.5} />
            </Button>
            <div>
              <h1 className="type-heading">Relatórios</h1>
              <p className="hidden md:block text-xs text-muted-foreground">Relatórios de mídias sociais</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <UserProfileMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Filtrar por cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => navigate("/reports/new")} className="w-full sm:w-auto gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90">
            <Plus className="h-4 w-4" />
            Novo Relatório
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileBarChart className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-base font-medium mb-1">Nenhum relatório encontrado</h3>
              <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro relatório de mídias sociais</p>
              <Button onClick={() => navigate("/reports/new")} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Criar relatório
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {reports.map(report => {
              const client = clientMap[report.client_id];
              const PlatformIcon = PLATFORM_ICONS[report.platform] || FileBarChart;
              const statusCfg = STATUS_LABELS[report.status] || STATUS_LABELS.draft;
              return (
                <Card
                  key={report.id}
                  className="group cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => navigate(`/reports/${report.id}`)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {client?.logo_url ? (
                          <img src={client.logo_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <FileBarChart className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="text-sm font-medium truncate">{report.title || "Sem título"}</h3>
                          <p className="text-xs text-muted-foreground">{client?.name || "—"}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={cn("text-[10px] shrink-0", statusCfg.class)}>
                        {statusCfg.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <PlatformIcon className="h-3 w-3" />
                        {report.platform === "instagram" ? "Instagram" : "Facebook"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(report.period_start), "dd/MM", { locale: ptBR })} – {format(new Date(report.period_end), "dd/MM/yy", { locale: ptBR })}
                      </span>
                    </div>

                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Visualizar" onClick={(e) => { e.stopPropagation(); navigate(`/reports/${report.id}`); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={(e) => { e.stopPropagation(); navigate(`/reports/${report.id}/edit`); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" title="Reenviar ao cliente" onClick={(e) => { e.stopPropagation(); handleResend(report); }}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplicar" onClick={(e) => { e.stopPropagation(); handleDuplicate(report); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Excluir" onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
