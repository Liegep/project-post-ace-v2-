import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, History, Filter } from "lucide-react";
import UserProfileMenu from "@/components/UserProfileMenu";
import { MobileNav } from "@/components/MobileNav";
import { useEffect } from "react";

interface ClientOption {
  id: string;
  name: string;
}

const ActivityLogPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { isSuperAdmin, isAdmin } = useUserRole();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [filterClientId, setFilterClientId] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("");
  const [filterDate, setFilterDate] = useState<string>("");

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      setClients((data || []) as ClientOption[]);
    };
    fetchClients();
  }, []);

  const activityLogs = useActivityLogs({
    clientId: filterClientId !== "all" ? filterClientId : undefined,
    action: filterAction || undefined,
    limit: 50,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-header px-4 md:px-6 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="group bg-white hover:bg-foreground shadow-md border border-border/40 transition-colors" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5 text-black group-hover:text-white transition-colors" strokeWidth={2.5} />
            </Button>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <h1 className="type-heading text-foreground">Registro de Atividades</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><MobileNav /></div>
            <UserProfileMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 md:p-6">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3 items-end">
          <div className="w-full sm:w-auto">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente</label>
            <Select value={filterClientId} onValueChange={setFilterClientId}>
              <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-auto">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Ação</label>
            <Select value={filterAction || "all"} onValueChange={(v) => setFilterAction(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
                <SelectValue placeholder="Todas as ações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="post_approved">Aprovações</SelectItem>
                <SelectItem value="post_change_requested">Solicitações de alteração</SelectItem>
                <SelectItem value="post_edited">Edições de post</SelectItem>
                <SelectItem value="post_created">Criações de post</SelectItem>
                <SelectItem value="post_status_changed">Mudanças de status</SelectItem>
                <SelectItem value="post_commented">Comentários</SelectItem>
                <SelectItem value="brief_created">Pautas criadas</SelectItem>
                <SelectItem value="brief_commented">Comentários em pautas</SelectItem>
                <SelectItem value="caption_edited">Edições de legenda</SelectItem>
                <SelectItem value="feedback_sent">Feedbacks</SelectItem>
                <SelectItem value="post_viewed">Visualizações</SelectItem>
                <SelectItem value="post_downloaded">Downloads</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-xl border bg-card p-4 md:p-6">
          <ActivityTimeline
            logs={activityLogs.logs}
            loading={activityLogs.loading}
            hasMore={activityLogs.hasMore}
            onLoadMore={activityLogs.loadMore}
            showClientName
          />
        </div>
      </main>
    </div>
  );
};

export default ActivityLogPage;
