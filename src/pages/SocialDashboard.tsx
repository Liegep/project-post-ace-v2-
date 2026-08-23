import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useSocialPosts, type SocialPost, type SocialPostStatus } from "@/hooks/useSocialPosts";
import { SocialPostCard } from "@/components/social/SocialPostCard";
import { SocialPostDialog } from "@/components/social/SocialPostDialog";
import { SocialCalendar, type ScheduledKanbanPost } from "@/components/social/SocialCalendar";
import { MetaConnectPanel } from "@/components/social/MetaConnectPanel";
import { MobileNav } from "@/components/MobileNav";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, CalendarDays, List, ArrowLeft, Facebook, Instagram, Settings, FileText, CheckCircle, Clock, Send, AlertTriangle, LogOut } from "lucide-react";
import { format } from "date-fns";

interface Client {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
}

const STATUS_FILTERS: { value: string; label: string; icon: React.ComponentType<any> }[] = [
  { value: "all", label: "Todos", icon: List },
  { value: "draft", label: "Rascunhos", icon: FileText },
  { value: "pending_approval", label: "Aguardando", icon: Clock },
  { value: "approved", label: "Aprovados", icon: CheckCircle },
  { value: "scheduled", label: "Agendados", icon: Clock },
  { value: "published", label: "Publicados", icon: Send },
  { value: "error", label: "Com Erro", icon: AlertTriangle },
];

export default function SocialDashboard() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);

  const { posts, pages, loading, createPost, updatePost, deletePost, duplicatePost, publishPost, cancelPost, approvePost, fetchPages } = useSocialPosts(selectedClientId === "all" ? null : selectedClientId);

  const [scheduledKanbanPosts, setScheduledKanbanPosts] = useState<ScheduledKanbanPost[]>([]);

  useEffect(() => {
    supabase.from("clients").select("id, name, slug, logo_url").order("name").then(({ data }) => {
      setClients((data || []) as Client[]);
    });
  }, []);

  // Fetch kanban posts that should appear on the social calendar:
  // any non-archived, non-published post with a future deadline, OR posts tagged "agendado".
  const fetchScheduledKanban = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let query = supabase
      .from("posts")
      .select("id, title, caption, image_url, media_urls, deadline, status, archived, client_id, clients(name)")
      .not("deadline", "is", null);

    if (selectedClientId !== "all") {
      query = query.eq("client_id", selectedClientId);
    }

    const { data } = await query as any;

    if (data) {
      const filtered = data.filter((p: any) => {
        const status: string[] = Array.isArray(p.status) ? p.status : [];
        if (status.includes("publicado")) return false;
        if (status.includes("agendado")) return true;
        // Include any future-deadline post not yet published
        return p.deadline && new Date(p.deadline) >= today;
      });
      const mapped: ScheduledKanbanPost[] = filtered.map((p: any) => ({
        id: p.id,
        title: p.title,
        client_name: p.clients?.name || "—",
        client_id: p.client_id,
        deadline: p.deadline,
        preview_url: p.image_url || (Array.isArray(p.media_urls) ? p.media_urls[0] : null) || null,
        preview_text: p.caption || null,
      }));
      setScheduledKanbanPosts(mapped);
    }
  };

  useEffect(() => {
    fetchScheduledKanban();
  }, [selectedClientId]);

  const filteredPosts = useMemo(() => {
    let filtered = posts;
    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }
    if (platformFilter !== "all") {
      filtered = filtered.filter((p) => p.platform === platformFilter);
    }
    return filtered;
  }, [posts, statusFilter, platformFilter]);

  // Dashboard metrics
  const metrics = useMemo(() => ({
    total: posts.length,
    draft: posts.filter((p) => p.status === "draft").length,
    scheduled: posts.filter((p) => p.status === "scheduled" || p.status === "approved").length,
    published: posts.filter((p) => p.status === "published").length,
    errors: posts.filter((p) => p.status === "error").length,
  }), [posts]);

  const handleSave = async (data: Partial<SocialPost>) => {
    if (data.id) {
      const { id, ...updates } = data;
      return updatePost(id, updates);
    } else {
      return createPost(data);
    }
  };

  const handleEdit = (post: SocialPost) => {
    setEditingPost(post);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este post?")) return;
    await deletePost(id);
    toast({ title: "Post excluído" });
  };

  const handlePublishNow = async (id: string) => {
    if (!confirm("Publicar agora?")) return;
    const result = await publishPost(id, true);
    if (result.success) {
      toast({ title: "Post publicado com sucesso!" });
    } else {
      toast({ title: "Erro ao publicar", description: result.error, variant: "destructive" });
    }
  };

  const handleSchedule = (post: SocialPost) => {
    setEditingPost(post);
    setDialogOpen(true);
  };

  const handleApprove = async (id: string) => {
    await approvePost(id);
    toast({ title: "Post aprovado!" });
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancelar este agendamento?")) return;
    await cancelPost(id);
    toast({ title: "Agendamento cancelado" });
  };

  const handleReschedule = async (post: SocialPost, newDate: Date) => {
    const currentDate = post.scheduled_at ? new Date(post.scheduled_at) : new Date();
    const hours = currentDate.getHours();
    const minutes = currentDate.getMinutes();
    newDate.setHours(hours, minutes, 0, 0);

    const { error } = await updatePost(post.id, {
      scheduled_at: newDate.toISOString(),
    } as any);
    if (!error) {
      toast({ title: "Post reagendado", description: `Movido para ${format(newDate, "dd/MM/yyyy")}` });
    } else {
      toast({ title: "Erro ao reagendar", variant: "destructive" });
    }
  };

  const handleRescheduleKanban = async (postId: string, newDate: Date) => {
    const { error } = await supabase
      .from("posts")
      .update({ deadline: newDate.toISOString() })
      .eq("id", postId);
    if (!error) {
      toast({ title: "Post reagendado", description: `Movido para ${format(newDate, "dd/MM/yyyy")}` });
      fetchScheduledKanban();
    } else {
      toast({ title: "Erro ao reagendar", variant: "destructive" });
    }
  };

  const handleRetry = async (id: string) => {
    const result = await publishPost(id, true);
    if (result.success) {
      toast({ title: "Publicado com sucesso!" });
    } else {
      toast({ title: "Erro novamente", description: result.error, variant: "destructive" });
    }
  };

  const handleDuplicate = async (post: SocialPost) => {
    await duplicatePost(post);
    toast({ title: "Post duplicado!" });
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-header px-4 py-3 md:px-6 md:py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <MobileNav title="Social" />
            <Button variant="ghost" size="icon" className="hidden md:inline-flex group bg-white hover:bg-foreground shadow-md border border-border/40 transition-colors" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5 text-black group-hover:text-white transition-colors" strokeWidth={2.5} />
            </Button>
            <div className="min-w-0">
              <h1 className="text-base md:text-xl font-bold text-foreground flex items-center gap-2 truncate">
                <CalendarDays className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
                <span className="truncate">Agendamento Social</span>
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Gerencie e agende posts para Facebook e Instagram</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-[120px] md:w-[200px] text-xs md:text-sm">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 md:h-9 md:w-9"
              onClick={() => setShowSettings(!showSettings)}
              title={selectedClientId === "all" ? "Selecione um cliente para configurar contas" : "Configurar Contas"}
              disabled={selectedClientId === "all"}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => { setEditingPost(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Novo Post</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/login");
              }}
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Meta accounts panel */}
        {showSettings && selectedClientId !== "all" && (
          <MetaConnectPanel clientId={selectedClientId} pages={pages} onRefresh={fetchPages} />
        )}

        {/* Metrics */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
          {[
            { label: "Total", value: metrics.total, color: "text-foreground" },
            { label: "Rascunhos", value: metrics.draft, color: "text-muted-foreground" },
            { label: "Agendados", value: metrics.scheduled, color: "text-info" },
            { label: "Publicados", value: metrics.published, color: "text-success" },
            { label: "Erros", value: metrics.errors, color: "text-destructive" },
          ].map((m) => (
            <Card key={m.label} className={m.label === "Total" || m.label === "Erros" ? "col-span-1" : ""}>
              <CardContent className="p-3 md:p-4 text-center">
                <p className={`text-lg md:text-2xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground">{m.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 md:gap-3 items-start sm:items-center overflow-x-auto">
          <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto max-w-full">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-2 md:px-3 py-1.5 text-[11px] md:text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === f.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setPlatformFilter("all")}
              className={`px-2 md:px-3 py-1.5 text-[11px] md:text-xs font-medium rounded-md transition-colors ${platformFilter === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              Todos
            </button>
            <button
              onClick={() => setPlatformFilter("facebook")}
              className={`px-2 md:px-3 py-1.5 text-[11px] md:text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${platformFilter === "facebook" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              <Facebook className="h-3 w-3" /> <span className="hidden sm:inline">Facebook</span>
            </button>
            <button
              onClick={() => setPlatformFilter("instagram")}
              className={`px-2 md:px-3 py-1.5 text-[11px] md:text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${platformFilter === "instagram" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              <Instagram className="h-3 w-3" /> <span className="hidden sm:inline">Instagram</span>
            </button>
          </div>
        </div>

        {/* Tabs: Calendar / List */}
        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar" className="gap-1">
              <CalendarDays className="h-4 w-4" /> Calendário
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-1">
              <List className="h-4 w-4" /> Lista
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            <SocialCalendar posts={filteredPosts} scheduledPosts={scheduledKanbanPosts} onPostClick={handleEdit} onReschedule={handleReschedule} onRescheduleKanban={handleRescheduleKanban} />
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum post encontrado</p>
                <Button variant="outline" className="mt-3" onClick={() => { setEditingPost(null); setDialogOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" /> Criar primeiro post
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPosts.map((post) => (
                  <SocialPostCard
                    key={post.id}
                    post={post}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                    onPublishNow={handlePublishNow}
                    onSchedule={handleSchedule}
                    onApprove={handleApprove}
                    onCancel={handleCancel}
                    onRetry={handleRetry}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Post Dialog */}
      <SocialPostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        post={editingPost}
        pages={pages}
        clients={clients}
        clientId={selectedClientId}
        onSave={handleSave}
        onPublishNow={handlePublishNow}
      />
    </div>
  );
}
