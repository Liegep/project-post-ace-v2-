import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { LABEL_CONFIG } from "@/types/post";
import { CalendarClock, Bell, MessageCircle, Clock, CheckCircle, AlertCircle, FileText, X, CalendarDays, Instagram, Facebook, Youtube, Linkedin, Twitter, Globe } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import UserProfileMenu from "@/components/UserProfileMenu";
import { toast } from "@/hooks/use-toast";
import { TodayAppointmentsWidget } from "@/components/TodayAppointmentsWidget";
import { TodayTasksWidget } from "@/components/TodayTasksWidget";
import { NotificationBell } from "@/components/NotificationBell";

interface AssignedClient {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  posting_period: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  youtube_url: string;
  linkedin_url: string;
  twitter_url: string;
  website_url: string;
}

interface PostSummary {
  clientId: string;
  clientName: string;
  clientSlug: string;
  clientLogo: string;
  postId: string;
  postTitle: string;
  status: string[];
  clientLabel: string;
  deadline: string | null;
  updatedAt: string;
}

interface Feedback {
  id: string;
  postId: string;
  postTitle: string;
  clientName: string;
  message: string;
  createdAt: string;
  fromName: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  postId: string | null;
  clientId: string | null;
}

const TeamDashboard = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [clients, setClients] = useState<AssignedClient[]>([]);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState("");
  const [userId, setUserId] = useState("");

  // Post detail for status change
  const [statusDialogPost, setStatusDialogPost] = useState<PostSummary | null>(null);
  const [newStatus, setNewStatus] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  // Realtime for notifications
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("team-notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "admin_notifications",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const n = payload.new as any;
        setNotifications(prev => [{
          id: n.id, type: n.type, title: n.title, message: n.message,
          read: n.read, createdAt: n.created_at, postId: n.post_id, clientId: n.client_id,
        }, ...prev]);
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "post_feedback",
        filter: `to_user_id=eq.${userId}`,
      }, (payload) => {
        const f = payload.new as any;
        // Refresh feedbacks
        loadFeedbacks(userId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    setUserId(session.user.id);

    // Get profile name
    const { data: profile } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", session.user.id).single();
    if (profile) {
      setUserName((profile as any).full_name);
      setUserAvatar((profile as any).avatar_url || "");
    }

    // Get assigned client IDs
    const { data: assignmentData } = await supabase.from("user_client_assignments").select("client_id").eq("user_id", session.user.id);
    const clientIds = (assignmentData || []).map((a: any) => a.client_id);

    if (clientIds.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch clients
    const { data: clientsData } = await supabase.from("clients")
      .select("id, name, slug, logo_url, posting_period, instagram_url, facebook_url, tiktok_url, youtube_url, linkedin_url, twitter_url, website_url")
      .in("id", clientIds);
    setClients((clientsData as AssignedClient[]) || []);

    // Fetch posts for those clients
    const { data: postsData } = await supabase.from("posts")
      .select("id, title, status, client_label, deadline, updated_at, client_id")
      .in("client_id", clientIds)
      .eq("archived", false)
      .order("updated_at", { ascending: false });

    const clientMap: Record<string, AssignedClient> = {};
    (clientsData || []).forEach((c: any) => { clientMap[c.id] = c; });

    setPosts((postsData || []).map((p: any) => ({
      clientId: p.client_id,
      clientName: clientMap[p.client_id]?.name || "",
      clientSlug: clientMap[p.client_id]?.slug || "",
      clientLogo: clientMap[p.client_id]?.logo_url || "",
      postId: p.id,
      postTitle: p.title,
      status: Array.isArray(p.status) ? p.status : [p.status],
      clientLabel: p.client_label,
      deadline: p.deadline,
      updatedAt: p.updated_at,
    })));

    await loadFeedbacks(session.user.id);
    await loadNotifications(session.user.id);
    setLoading(false);
  };

  const loadFeedbacks = async (uid: string) => {
    const { data } = await supabase.from("post_feedback")
      .select("id, post_id, message, created_at, from_user_id")
      .eq("to_user_id", uid)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!data || data.length === 0) { setFeedbacks([]); return; }

    const postIds = [...new Set(data.map((f: any) => f.post_id))];
    const { data: postsData } = await supabase.from("posts")
      .select("id, title, client_id")
      .in("id", postIds);

    const postMap: Record<string, any> = {};
    (postsData || []).forEach((p: any) => { postMap[p.id] = p; });

    setFeedbacks(data.map((f: any) => ({
      id: f.id,
      postId: f.post_id,
      postTitle: postMap[f.post_id]?.title || "",
      clientName: "",
      message: f.message,
      createdAt: f.created_at,
      fromName: "Admin",
    })));
  };

  const loadNotifications = async (uid: string) => {
    const { data } = await supabase.from("admin_notifications")
      .select("*")
      .eq("user_id", uid)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(50);

    setNotifications((data || []).map((n: any) => ({
      id: n.id, type: n.type, title: n.title, message: n.message,
      read: n.read, createdAt: n.created_at, postId: n.post_id, clientId: n.client_id,
    })));
  };

  const dismissNotification = async (id: string) => {
    await supabase.from("admin_notifications").update({ read: true } as any).eq("id", id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleStatusChange = async (post: PostSummary, status: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Record history
    await supabase.from("post_status_history").insert({
      post_id: post.postId,
      old_status: post.status.join(','),
      new_status: status,
      changed_by: session.user.id,
    } as any);

    // Update post
    await supabase.from("posts").update({ status: [status] } as any).eq("id", post.postId);


    // Refresh
    setPosts(prev => prev.map(p => p.postId === post.postId ? { ...p, status: [status] } : p));
    toast({ title: t("statusUpdated") });
  };

  const todayPosts = posts.filter(p => {
    if (!p.deadline) return false;
    const d = new Date(p.deadline);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  const pendingPosts = posts.filter(p => p.status.includes("entrada"));
  const inProgressPosts = posts.filter(p => p.status.some(s => ["em_desenvolvimento", "escrevendo_legenda"].includes(s)));
  const readyPosts = posts.filter(p => p.status.some(s => ["pronto", "finalizado"].includes(s)));
  const feedbackPosts = posts.filter(p => p.clientLabel !== "pendente");

  const STATUS_OPTIONS = ["entrada", "em desenvolvimento", "escrevendo legenda", "pronto", "finalizado"];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-header px-4 py-3 md:px-6 md:py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <MobileNav title="Equipe" />
            <div className="min-w-0">
              <h1 className="type-heading truncate text-foreground">
                {t("hello")}, {userName || t("teamMember")} 👋
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">{t("yourClients")}: {clients.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={() => navigate("/briefs")}>
              <FileText className="h-4 w-4" /> Pautas
            </Button>
            <NotificationBell />
            <LanguageSelector />
            <UserProfileMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 md:p-6 space-y-4 md:space-y-6">
        <TodayTasksWidget />
        <TodayAppointmentsWidget />
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-muted p-6">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">{t("noClientsAssigned")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("contactAdmin")}</p>
          </div>
        ) : (
          <>
            {/* Notifications */}
            {notifications.length > 0 && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
                    <Bell className="h-4 w-4 text-amber-500" />
                  </div>
                  <h2 className="font-semibold text-foreground">{t("notifications")}</h2>
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-500">{notifications.length}</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {notifications.map(n => (
                    <div key={n.id} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.message}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(n.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                      <button onClick={() => dismissNotification(n.id)} className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Feedbacks */}
            {feedbacks.length > 0 && (
              <div className="rounded-xl border border-blue-400/30 bg-blue-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20">
                    <MessageCircle className="h-4 w-4 text-blue-500" />
                  </div>
                  <h2 className="font-semibold text-foreground">{t("adminFeedback")}</h2>
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-500">{feedbacks.length}</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {feedbacks.map(f => (
                    <div key={f.id} className="rounded-lg bg-muted/50 px-3 py-2.5">
                      <p className="text-sm font-medium text-foreground">{f.postTitle}</p>
                      <p className="text-xs text-muted-foreground mt-1">{f.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(f.createdAt).toLocaleString("pt-BR")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Today's posts */}
            {todayPosts.length > 0 && (
              <div className="rounded-xl border border-blue-400/30 bg-blue-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20">
                    <CalendarClock className="h-4 w-4 text-blue-500" />
                  </div>
                  <h2 className="font-semibold text-foreground">{t("postsForToday")}</h2>
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-500">{todayPosts.length}</span>
                </div>
                <div className="space-y-2">
                  {todayPosts.map(p => (
                    <div key={p.postId} onClick={() => navigate(`/admin/${p.clientSlug}`)} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5 cursor-pointer hover:bg-muted">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.postTitle}</p>
                        <p className="text-xs text-muted-foreground">{p.clientName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Client feedbacks on posts */}
            {feedbackPosts.length > 0 && (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  </div>
                  <h2 className="font-semibold text-foreground">{t("clientFeedbacks")}</h2>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-500">{feedbackPosts.length}</span>
                </div>
                <div className="space-y-2">
                  {feedbackPosts.map(p => {
                    const labelConfig = LABEL_CONFIG[p.clientLabel as keyof typeof LABEL_CONFIG];
                    return (
                      <div key={p.postId} onClick={() => navigate(`/admin/${p.clientSlug}`)} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5 cursor-pointer hover:bg-muted">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.postTitle}</p>
                          <p className="text-xs text-muted-foreground">{p.clientName}</p>
                        </div>
                        {labelConfig && (
                          <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${labelConfig.color}`}>
                            {labelConfig.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* My Clients */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">{t("myClients")}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {clients.map(client => {
                  const clientPosts = posts.filter(p => p.clientId === client.id);
                  const pending = clientPosts.filter(p => p.status.includes("entrada")).length;
                  const inProgress = clientPosts.filter(p => p.status.some(s => ["em_desenvolvimento", "escrevendo_legenda"].includes(s))).length;
                  const ready = clientPosts.filter(p => p.status.some(s => ["pronto", "finalizado"].includes(s))).length;
                  return (
                    <div
                      key={client.id}
                      onClick={() => navigate(`/admin/${client.slug}`)}
                      className="group relative flex flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-lg cursor-pointer"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {client.logo_url ? (
                          <img src={client.logo_url} alt={client.name} className="h-12 w-12 rounded-lg object-contain border" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted">
                            <span className="text-lg font-bold text-muted-foreground">{client.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {client.instagram_url && (
                                <a href={client.instagram_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded p-0.5 text-muted-foreground hover:text-pink-500 transition-colors" title="Instagram">
                                  <Instagram className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {client.facebook_url && (
                                <a href={client.facebook_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded p-0.5 text-muted-foreground hover:text-blue-600 transition-colors" title="Facebook">
                                  <Facebook className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {client.tiktok_url && (
                                <a href={client.tiktok_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors" title="TikTok">
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 3.76.92V6.69Z"/></svg>
                                </a>
                              )}
                              {client.youtube_url && (
                                <a href={client.youtube_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded p-0.5 text-muted-foreground hover:text-red-500 transition-colors" title="YouTube">
                                  <Youtube className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {client.linkedin_url && (
                                <a href={client.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded p-0.5 text-muted-foreground hover:text-blue-700 transition-colors" title="LinkedIn">
                                  <Linkedin className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {client.twitter_url && (
                                <a href={client.twitter_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors" title="X (Twitter)">
                                  <Twitter className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {client.website_url && (
                                <a href={client.website_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded p-0.5 text-muted-foreground hover:text-primary transition-colors" title="Website">
                                  <Globe className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{clientPosts.length} posts</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                          <Clock className="h-3 w-3" /> {pending}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                          <FileText className="h-3 w-3" /> {inProgress}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                          <CheckCircle className="h-3 w-3" /> {ready}
                        </span>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/${client.slug}`);
                          }}
                        >
                          {t("manage")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/briefs?client=${client.id}`);
                          }}
                        >
                          <FileText className="h-3.5 w-3.5" /> Pautas
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default TeamDashboard;
