import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nContext";
import { uploadClientLogo } from "@/lib/uploadClientLogo";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import UserProfileMenu from "@/components/UserProfileMenu";
import { Locale, LOCALE_LABELS, LOCALE_FLAGS } from "@/i18n/translations";
import { Plus, ImagePlus, ExternalLink, Copy, Pencil, Trash2, MessageCircle, Bell, X, RotateCcw, UserPlus, FilePlus, CalendarClock, Users, User, CalendarDays, Lightbulb, Calendar, Instagram, Facebook, Youtube, Linkedin, Twitter, FileText, FileBarChart, Globe, CheckCircle2, Shield, Share2, Lock, Menu, LayoutDashboard, Settings, CalendarHeart, History as HistoryIcon, DollarSign, Eye, FileSignature, Link2, Palette, ChevronDown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StorageCleanupButton } from "@/components/StorageCleanupButton";
import { MobileNav } from "@/components/MobileNav";
import { toast } from "@/hooks/use-toast";

import { cn } from "@/lib/utils";
import { LABEL_CONFIG, Post, PostStatus, ClientLabel, STATUS_CONFIG, Tag, DEFAULT_TAGS } from "@/types/post";
import InviteAdminDialog from "@/components/InviteAdminDialog";
import { TodayAppointmentsWidget } from "@/components/TodayAppointmentsWidget";
import { CommemorativeDatesWidget } from "@/components/CommemorativeDatesWidget";
import { PostDetailDialog } from "@/components/PostDetailDialog";
import { TodayTasksWidget } from "@/components/TodayTasksWidget";
import { NotificationBell } from "@/components/NotificationBell";
import { QuickLinksPanel } from "@/components/QuickLinksPanel";

const CLIENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  standard: { label: "Padrão", color: "bg-muted text-muted-foreground" },
  premium: { label: "Premium", color: "bg-amber-500/15 text-amber-600" },
  partner: { label: "Parceiro", color: "bg-emerald-500/15 text-emerald-600" },
  vip: { label: "VIP", color: "bg-purple-500/15 text-purple-600" },
};

interface Client {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  locale: string;
  posting_period: string;
  created_at: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  youtube_url: string;
  linkedin_url: string;
  twitter_url: string;
  website_url: string;
  owner_id: string | null;
  shared: boolean;
  client_type: string;
}

interface ClientUser {
  userId: string;
  email: string;
  fullName?: string;
}

interface ClientUserMap {
  [clientId: string]: ClientUser[];
}

interface FeedbackNotification {
  postId: string;
  postTitle: string;
  clientId: string;
  clientName: string;
  clientSlug: string;
  clientLogo: string;
  label: string;
  updatedAt: string;
  deadline: string | null;
  imageUrl: string;
  mediaUrls: string[];
  caption: string;
}

interface UnarchiveNotification {
  postId: string;
  postTitle: string;
  clientName: string;
  clientSlug: string;
  clientLogo: string;
  unarchivedAt: string;
}

interface ClientCreatedNotification {
  postId: string;
  postTitle: string;
  clientName: string;
  clientSlug: string;
  clientLogo: string;
  createdAt: string;
}

interface StatusNotification {
  id: string;
  title: string;
  message: string;
  clientId: string | null;
  postId: string | null;
  createdAt: string;
  actorAvatarUrl: string;
}

interface TodayPost {
  postId: string;
  postTitle: string;
  clientName: string;
  clientSlug: string;
  clientLogo: string;
  deadline: string;
}

interface DashboardTask {
  id: string;
  title: string;
  clientName: string;
  clientSlug: string;
  clientLogo: string;
  deadline: string;
  status?: string;
}

interface DashboardAppointment {
  id: string;
  title: string;
  time: string;
  category: string;
  completed: boolean;
}

const AdminDashboard = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const { role, userId: currentUserId, isSuperAdmin, isAdmin, loading: roleLoading } = useUserRole();
  const [clients, setClients] = useState<Client[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackNotification[]>([]);
  
  const [unarchiveNotifs, setUnarchiveNotifs] = useState<UnarchiveNotification[]>([]);
  const [clientCreatedNotifs, setClientCreatedNotifs] = useState<ClientCreatedNotification[]>([]);
  const [statusNotifs, setStatusNotifs] = useState<StatusNotification[]>([]);
  const [todayPosts, setTodayPosts] = useState<TodayPost[]>([]);
  const [dashboardTasks, setDashboardTasks] = useState<DashboardTask[]>([]);
  const [dashboardAppointments, setDashboardAppointments] = useState<DashboardAppointment[]>([]);
  const [monthlyPostsCount, setMonthlyPostsCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [schedulePopoverOpen, setSchedulePopoverOpen] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [locale, setLocale] = useState<Locale>("pt");
  const [logoPreview, setLogoPreview] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [viewPost, setViewPost] = useState<Post | null>(null);
  const [viewPostOpen, setViewPostOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState<"all" | "mine" | "shared">("all");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [existingClientUser, setExistingClientUser] = useState<ClientUser | null>(null);
  const [clientType, setClientType] = useState("standard");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareClientId, setShareClientId] = useState<string | null>(null);
  const [allAdmins, setAllAdmins] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [shareSelectedUsers, setShareSelectedUsers] = useState<Set<string>>(new Set());
  const [clientAssignments, setClientAssignments] = useState<{ user_id: string; client_id: string }[]>([]);
  const [clientUsersMap, setClientUsersMap] = useState<ClientUserMap>({});
  
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [quickLinksOpen, setQuickLinksOpen] = useState(false);
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const appLogoInputRef = useRef<HTMLInputElement>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    if (!currentUserId) return;
    supabase.from("profiles").select("full_name").eq("id", currentUserId).single()
      .then(({ data }) => { if (data?.full_name) setUserName(data.full_name); });
  }, [currentUserId]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const getFormattedDate = () => {
    return new Date().toLocaleDateString("pt-BR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  };

  const fetchStatusNotifs = async () => {
    setStatusNotifs([]);
  };

  const dismissStatusNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("admin_notifications").update({ read: true } as any).eq("id", id);
    setStatusNotifs((prev) => prev.filter((n) => n.id !== id));
  };


  // Notification sound ref
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    notificationAudioRef.current = new Audio("/notification.wav");
  }, []);

  const playNotificationSound = () => {
    if (notificationAudioRef.current) {
      notificationAudioRef.current.currentTime = 0;
      notificationAudioRef.current.play().catch(() => {});
    }
  };

  // Fetch app logo from app_settings
  useEffect(() => {
    const fetchAppLogo = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "app_logo_url")
        .maybeSingle();
      if (data?.value) setAppLogo(data.value);
    };
    fetchAppLogo();
  }, []);

  const handleAppLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { compressImage } = await import("@/lib/imageCompressor");
    const compressed = await compressImage(file);
    const ext = compressed.name.split(".").pop();
    const path = `app-logo-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("app-branding").upload(path, compressed, { upsert: true });
    if (uploadError) {
      toast({ title: "Erro ao enviar logo", description: uploadError.message, variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("app-branding").getPublicUrl(path);
    const logoUrl = urlData.publicUrl;
    const { error: settingsError } = await supabase
      .from("app_settings")
      .upsert({ key: "app_logo_url", value: logoUrl, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (settingsError) {
      toast({ title: "Erro ao salvar configuração", description: settingsError.message, variant: "destructive" });
      return;
    }
    setAppLogo(logoUrl);
    toast({ title: "Logo atualizado com sucesso!" });
  };

  // Cache allowed client IDs for the lifetime of this mount to avoid repeated
  // 2–3 query roundtrips for every notification fetcher.
  const allowedClientIdsRef = useRef<string[] | null>(null);

  useEffect(() => {
    if (roleLoading || !currentUserId) return;
    allowedClientIdsRef.current = null; // reset on user/role change
    (async () => {
      await fetchClients();
      await fetchClientUsers();
      // Run the notification fetchers serially so they share the cached allowed-ids
      await fetchFeedbacks();
      await fetchUnarchiveNotifs();
      await fetchClientCreatedNotifs();
      await fetchTodayPosts();
      await fetchDashboardTasks();
      await fetchDashboardAppointments();
      await fetchDashboardStats();
      await fetchStatusNotifs();
    })();

    // Realtime: refresh feedbacks when a post becomes actionable for the dashboard.
    // Keep this narrowed to feedback-label updates so unrelated post edits do not
    // keep the Realtime WAL listener busy or trigger broad dashboard refetches.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("feedback-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts", filter: "client_label=neq.pendente" },
        (payload) => {
          const oldLabel = (payload.old as any)?.client_label;
          const newLabel = (payload.new as any)?.client_label;
          if (oldLabel !== newLabel) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => { fetchFeedbacks(); }, 800);
          }
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [roleLoading, role, currentUserId]);

  const fetchTodayPosts = async () => {
    const allowedIds = await getAllowedClientIds();
    if (allowedIds.length === 0) { setTodayPosts([]); return; }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const { data: posts } = await supabase
      .from("posts")
      .select("id, title, client_id, deadline")
      .gte("deadline", startOfDay)
      .lt("deadline", endOfDay)
      .eq("archived", false)
      .in("client_id", allowedIds)
      .order("deadline", { ascending: true });

    if (!posts || posts.length === 0) {
      setTodayPosts([]);
      return;
    }

    const clientIds = [...new Set(posts.map((p: any) => p.client_id).filter(Boolean))];
    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, name, slug, logo_url")
      .in("id", clientIds);

    const clientMap: Record<string, { name: string; slug: string; logo_url: string }> = {};
    (clientsData || []).forEach((c: any) => { clientMap[c.id] = { name: c.name, slug: c.slug, logo_url: c.logo_url }; });

    setTodayPosts(
      posts.map((p: any) => ({
        postId: p.id,
        postTitle: p.title,
        clientName: clientMap[p.client_id]?.name || "—",
        clientSlug: clientMap[p.client_id]?.slug || "",
        clientLogo: clientMap[p.client_id]?.logo_url || "",
        deadline: p.deadline,
      }))
    );
  };

  const fetchDashboardTasks = async () => {
    const allowedIds = await getAllowedClientIds();
    if (allowedIds.length === 0) {
      setDashboardTasks([]);
      return;
    }

    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [{ data: posts }, { data: clientsData }] = await Promise.all([
      supabase
        .from("posts")
        .select("id, title, client_id, deadline, status")
        .in("client_id", allowedIds)
        .eq("archived", false)
        .not("deadline", "is", null)
        .lte("deadline", nextWeek.toISOString())
        .order("deadline", { ascending: true }),
      supabase
        .from("clients")
        .select("id, name, slug, logo_url")
        .in("id", allowedIds),
    ]);

    const clientMap: Record<string, { name: string; slug: string; logo_url: string }> = {};
    (clientsData || []).forEach((client: any) => {
      clientMap[client.id] = client;
    });

    const tasks = (posts || [])
      .filter((post: any) => {
        const statusList: string[] = Array.isArray(post.status) ? post.status : [];
        return !statusList.includes("publicado");
      })
      .map((post: any) => ({
        id: post.id,
        title: post.title,
        clientName: clientMap[post.client_id]?.name || "—",
        clientSlug: clientMap[post.client_id]?.slug || "",
        clientLogo: clientMap[post.client_id]?.logo_url || "",
        deadline: post.deadline,
        status: Array.isArray(post.status) ? post.status[0] : post.status,
      }))
      .slice(0, 4);

    setDashboardTasks(tasks);
  };

  const fetchDashboardAppointments = async () => {
    if (!currentUserId) {
      setDashboardAppointments([]);
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("appointments")
      .select("id, title, appointment_time, category, completed")
      .eq("user_id", currentUserId)
      .eq("appointment_date", today)
      .order("appointment_time", { ascending: true });

    if (error) {
      console.error("[AdminDashboard] Could not load appointments", error);
      setDashboardAppointments([]);
      return;
    }

    setDashboardAppointments(
      ((data || []) as any[]).slice(0, 5).map((item) => ({
        id: item.id,
        title: item.title,
        time: item.appointment_time?.slice(0, 5) || "09:00",
        category: item.category || "Post",
        completed: !!item.completed,
      }))
    );
  };

  const fetchDashboardStats = async () => {
    const allowedIds = await getAllowedClientIds();
    if (allowedIds.length === 0) {
      setMonthlyPostsCount(0);
      setApprovedCount(0);
      return;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const [{ count: monthlyCount }, { data: approvedPosts }] = await Promise.all([
      supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .in("client_id", allowedIds)
        .gte("created_at", monthStart)
        .lt("created_at", monthEnd),
      supabase
        .from("posts")
        .select("id, client_label")
        .in("client_id", allowedIds)
        .eq("client_label", "aprovado"),
    ]);

    setMonthlyPostsCount(monthlyCount || 0);
    setApprovedCount((approvedPosts || []).length);
  };

  const fetchClients = async () => {
    setLoading(true);
    try {
      if (!currentUserId) return;

      // Super admins can manage every client. Do not limit this to clients marked
      // as shared, otherwise existing clients disappear from the dashboard.
      if (isSuperAdmin) {
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setClients((data as Client[]) || []);
        return;
      }

      const [assignmentsResult, ownedClientsResult] = await Promise.all([
        supabase
          .from("user_client_assignments")
          .select("client_id")
          .eq("user_id", currentUserId),
        supabase
          .from("clients")
          .select("id")
          .eq("owner_id", currentUserId),
      ]);

      if (assignmentsResult.error) throw assignmentsResult.error;
      if (ownedClientsResult.error) throw ownedClientsResult.error;

      const assignedIds = (assignmentsResult.data || []).map((assignment: any) => assignment.client_id);
      const ownedIds = (ownedClientsResult.data || []).map((client: any) => client.id);
      const clientIds = [...new Set([...assignedIds, ...ownedIds])];

      if (clientIds.length === 0) {
        setClients([]);
        return;
      }

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .in("id", clientIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setClients((data as Client[]) || []);
    } catch (error: any) {
      console.error("[AdminDashboard] Could not load clients", error);
      setClients([]);
      toast({
        title: "Não foi possível carregar os clientes",
        description: error?.message || "O servidor retornou um erro. Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClientUsers = async () => {
    // Get all client role users
    const { data: clientRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "client");
    
    if (!clientRoles || clientRoles.length === 0) {
      setClientUsersMap({});
      return;
    }

    const clientUserIds = clientRoles.map(r => r.user_id);

    // Get their assignments
    const { data: assignments } = await supabase
      .from("user_client_assignments")
      .select("user_id, client_id")
      .in("user_id", clientUserIds);

    // Get their profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", clientUserIds);

    const profileMap: Record<string, { full_name: string; email: string }> = {};
    (profiles || []).forEach(p => { profileMap[p.id] = { full_name: p.full_name, email: p.email }; });

    const map: ClientUserMap = {};
    (assignments || []).forEach(a => {
      if (!map[a.client_id]) map[a.client_id] = [];
      const profile = profileMap[a.user_id];
      if (profile) {
        map[a.client_id].push({ userId: a.user_id, email: profile.email, fullName: profile.full_name });
      }
    });
    setClientUsersMap(map);
  };

  const fetchFeedbacks = async () => {
    const allowedIds = await getAllowedClientIds();
    if (allowedIds.length === 0) { setFeedbacks([]); return; }

    // Fetch posts where client gave feedback (label != pendente)
    // Exclude archived posts and posts whose deadline has already passed
    const { data: posts } = await supabase
      .from("posts")
      .select("id, title, client_label, client_id, updated_at, deadline, image_url, media_urls, caption, archived, status")
      .neq("client_label", "pendente")
      .eq("archived", false)
      .in("client_id", allowedIds)
      .order("updated_at", { ascending: false });

    if (!posts || posts.length === 0) {
      setFeedbacks([]);
      return;
    }

    // Filter out posts whose deadline has already passed or that are already published
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const activePosts = posts.filter((p: any) => {
      const statusList: string[] = Array.isArray(p.status) ? p.status : [];
      if (statusList.includes("publicado")) return false;
      if (p.deadline) {
        const d = new Date(p.deadline);
        if (!Number.isNaN(d.getTime()) && d < todayStart) return false;
      }
      return true;
    });

    if (activePosts.length === 0) {
      setFeedbacks([]);
      return;
    }

    const clientIds = [...new Set(activePosts.map((p: any) => p.client_id).filter(Boolean))];
    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, name, slug, logo_url")
      .in("id", clientIds);

    const clientMap: Record<string, { name: string; slug: string; logo_url: string }> = {};
    (clientsData || []).forEach((c: any) => { clientMap[c.id] = { name: c.name, slug: c.slug, logo_url: c.logo_url }; });

    setFeedbacks(
      activePosts.map((p: any) => ({
        postId: p.id,
        postTitle: p.title,
        clientId: p.client_id,
        clientName: clientMap[p.client_id]?.name || "—",
        clientSlug: clientMap[p.client_id]?.slug || "",
        clientLogo: clientMap[p.client_id]?.logo_url || "",
        label: p.client_label,
        updatedAt: p.updated_at,
        deadline: p.deadline || null,
        imageUrl: p.image_url || "",
        mediaUrls: p.media_urls || [],
        caption: p.caption || "",
      }))
    );
  };

  const getAllowedClientIds = async (): Promise<string[]> => {
    if (!currentUserId) return [];
    if (allowedClientIdsRef.current) return allowedClientIdsRef.current;

    if (isSuperAdmin) {
      const { data, error } = await supabase.from("clients").select("id");
      if (error) throw error;
      const allClientIds = (data || []).map((client: any) => client.id);
      allowedClientIdsRef.current = allClientIds;
      return allClientIds;
    }

    const [assignmentsRes, ownedRes] = await Promise.all([
      supabase.from("user_client_assignments").select("client_id").eq("user_id", currentUserId),
      supabase.from("clients").select("id").eq("owner_id", currentUserId),
    ]);
    if (assignmentsRes.error) throw assignmentsRes.error;
    if (ownedRes.error) throw ownedRes.error;

    const assignedIds = (assignmentsRes.data || []).map((a: any) => a.client_id);
    const ownedIds = (ownedRes.data || []).map((c: any) => c.id);

    const merged = [...new Set([...assignedIds, ...ownedIds])];
    allowedClientIdsRef.current = merged;
    return merged;
  };

  const fetchUnarchiveNotifs = async () => {
    const allowedIds = await getAllowedClientIds();
    if (allowedIds.length === 0) { setUnarchiveNotifs([]); return; }

    const { data: posts } = await supabase
      .from("posts")
      .select("id, title, client_id, client_unarchived_at")
      .not("client_unarchived_at", "is", null)
      .in("client_id", allowedIds)
      .order("client_unarchived_at", { ascending: false });

    if (!posts || posts.length === 0) {
      setUnarchiveNotifs([]);
      return;
    }

    const clientIds = [...new Set(posts.map((p: any) => p.client_id).filter(Boolean))];
    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, name, slug, logo_url")
      .in("id", clientIds);

    const clientMap: Record<string, { name: string; slug: string; logo_url: string }> = {};
    (clientsData || []).forEach((c: any) => { clientMap[c.id] = { name: c.name, slug: c.slug, logo_url: c.logo_url }; });

    setUnarchiveNotifs(
      posts.map((p: any) => ({
        postId: p.id,
        postTitle: p.title,
        clientName: clientMap[p.client_id]?.name || "—",
        clientSlug: clientMap[p.client_id]?.slug || "",
        clientLogo: clientMap[p.client_id]?.logo_url || "",
        unarchivedAt: p.client_unarchived_at,
      }))
    );
  };

  const dismissFeedback = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("posts").update({ client_label: "pendente" } as any).eq("id", postId);
    setFeedbacks((prev) => prev.filter((fb) => fb.postId !== postId));
  };

  const markAsAgendado = async (fb: FeedbackNotification, selectedDate: string, selectedTime: string) => {
    if (!selectedDate || !selectedTime) {
      toast({ title: "Informe a data e o horário do agendamento", variant: "destructive" });
      return;
    }

    const deadlineISO = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();

    // Ensure "Agendados" column exists for this client
    const { data: existingCols } = await supabase
      .from("columns")
      .select("id, name")
      .eq("client_id", fb.clientId);

    let agendadosColId: string;
    const agendadosCol = (existingCols || []).find((c: any) => c.name.toLowerCase() === "agendados");
    if (agendadosCol) {
      agendadosColId = agendadosCol.id;
    } else {
      const maxPos = (existingCols || []).length;
      const { data: newCol } = await supabase
        .from("columns")
        .insert({ client_id: fb.clientId, name: "Agendados", position: maxPos } as any)
        .select()
        .single();
      if (!newCol) return;
      agendadosColId = (newCol as any).id;
    }

    // Update post: set status to agendado, move to Agendados column, reset label, set deadline
    await supabase.from("posts").update({
      status: ["agendado"],
      column_id: agendadosColId,
      client_label: "pendente",
      deadline: deadlineISO,
    } as any).eq("id", fb.postId);

    // Also create an entry in the social calendar
    const publishDate = selectedDate;
    const publishTime = selectedTime;

    await supabase.from("calendar_posts").insert({
      client_id: fb.clientId,
      title: fb.postTitle,
      caption: fb.caption || "",
      media_urls: fb.mediaUrls || [],
      media_type: fb.mediaUrls?.some((u: string) => /\.(mp4|mov|webm)/i.test(u)) ? "video" : "image",
      publish_date: publishDate,
      publish_time: publishTime,
      status: "scheduled",
      created_by: currentUserId,
    } as any);

    setFeedbacks((prev) => prev.filter((f) => f.postId !== fb.postId));
    setSchedulePopoverOpen(null);
    toast({ title: "Post agendado", description: `"${fb.postTitle}" agendado para ${selectedDate} às ${selectedTime}.` });
  };

  const dismissUnarchiveNotif = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("posts").update({ client_unarchived_at: null } as any).eq("id", postId);
    setUnarchiveNotifs((prev) => prev.filter((n) => n.postId !== postId));
  };

  const fetchClientCreatedNotifs = async () => {
    const allowedIds = await getAllowedClientIds();
    if (allowedIds.length === 0) { setClientCreatedNotifs([]); return; }

    const { data: posts } = await supabase
      .from("posts")
      .select("id, title, client_id, client_created_at")
      .not("client_created_at", "is", null)
      .in("client_id", allowedIds)
      .order("client_created_at", { ascending: false });

    if (!posts || posts.length === 0) {
      setClientCreatedNotifs([]);
      return;
    }

    const clientIds = [...new Set(posts.map((p: any) => p.client_id).filter(Boolean))];
    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, name, slug, logo_url")
      .in("id", clientIds);

    const clientMap: Record<string, { name: string; slug: string; logo_url: string }> = {};
    (clientsData || []).forEach((c: any) => { clientMap[c.id] = { name: c.name, slug: c.slug, logo_url: c.logo_url }; });

    setClientCreatedNotifs(
      posts.map((p: any) => ({
        postId: p.id,
        postTitle: p.title,
        clientName: clientMap[p.client_id]?.name || "—",
        clientSlug: clientMap[p.client_id]?.slug || "",
        clientLogo: clientMap[p.client_id]?.logo_url || "",
        createdAt: p.client_created_at,
      }))
    );
  };

  const dismissClientCreatedNotif = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("posts").update({ client_created_at: null } as any).eq("id", postId);
    setClientCreatedNotifs((prev) => prev.filter((n) => n.postId !== postId));
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!editingClient) {
      setSlug(generateSlug(value));
    }
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const openCreate = () => {
    setEditingClient(null);
    setName("");
    setSlug("");
    setLocale("pt");
    setLogoPreview("");
    setLogoFile(null);
    setInstagramUrl("");
    setFacebookUrl("");
    setTiktokUrl("");
    setYoutubeUrl("");
    setLinkedinUrl("");
    setTwitterUrl("");
    setClientEmail("");
    setClientPassword("");
    setExistingClientUser(null);
    setClientType("standard");
    setDialogOpen(true);
  };

  const openEdit = async (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setSlug(client.slug);
    setLocale(client.locale as Locale);
    setLogoPreview(client.logo_url);
    setLogoFile(null);
    setInstagramUrl(client.instagram_url || "");
    setFacebookUrl(client.facebook_url || "");
    setTiktokUrl(client.tiktok_url || "");
    setYoutubeUrl(client.youtube_url || "");
    setLinkedinUrl(client.linkedin_url || "");
    setTwitterUrl(client.twitter_url || "");
    setWebsiteUrl(client.website_url || "");
    setClientType(client.client_type || "standard");
    setClientPassword("");

    // Load existing client user
    const { data: assignments } = await supabase
      .from("user_client_assignments")
      .select("user_id")
      .eq("client_id", client.id);

    if (assignments && assignments.length > 0) {
      // Check if any assigned user has client role
      for (const a of assignments) {
        const { data: hasClientRole } = await supabase.rpc("has_role" as any, {
          _user_id: a.user_id,
          _role: "client",
        });
        if (hasClientRole) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", a.user_id)
            .single();
          setExistingClientUser({ userId: a.user_id, email: profile?.email || "" });
          setClientEmail(profile?.email || "");
          break;
        }
      }
      if (!existingClientUser) {
        setExistingClientUser(null);
        setClientEmail("");
      }
    } else {
      setExistingClientUser(null);
      setClientEmail("");
    }

    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name || !slug) return;
    setSaving(true);
    try {
      let logoUrl = editingClient?.logo_url || "";
      if (logoFile) {
        logoUrl = await uploadClientLogo(logoFile);
      }

      const socialFields = {
        instagram_url: instagramUrl,
        facebook_url: facebookUrl,
        tiktok_url: tiktokUrl,
        youtube_url: youtubeUrl,
        linkedin_url: linkedinUrl,
        twitter_url: twitterUrl,
        website_url: websiteUrl,
      };

      let clientId = editingClient?.id;

      if (editingClient) {
        const { error } = await supabase.from("clients").update({
          name,
          slug,
          locale,
          logo_url: logoUrl,
          client_type: clientType,
          ...socialFields,
        } as any).eq("id", editingClient.id);
        if (error) throw error;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const { data: newClient, error } = await supabase.from("clients").insert({
          name,
          slug,
          locale,
          logo_url: logoUrl,
          owner_id: session?.user?.id || null,
          client_type: clientType,
          ...socialFields,
        } as any).select().single();
        if (error) throw error;
        clientId = (newClient as any)?.id;
        
        // Auto-assign client to creator if not super_admin
        if (clientId && session?.user && !isSuperAdmin) {
          const { error: assignmentError } = await supabase.from("user_client_assignments").insert({
            user_id: session.user.id,
            client_id: clientId,
          } as any);
          if (assignmentError) throw assignmentError;
        }
      }

      // Create or update client user login
      if (clientId && clientEmail) {
        if (existingClientUser) {
          // Update existing client user
          if (clientEmail !== existingClientUser.email || clientPassword) {
            const { data: result, error: fnError } = await supabase.functions.invoke("create-client-user", {
              body: {
                mode: "update",
                user_id: existingClientUser.userId,
                email: clientEmail !== existingClientUser.email ? clientEmail : undefined,
                password: clientPassword || undefined,
              },
            });
            if (fnError) {
              toast({ title: "Erro ao atualizar login do cliente", description: fnError.message, variant: "destructive" });
            } else if (result?.error) {
              toast({ title: "Erro ao atualizar login do cliente", description: result.error, variant: "destructive" });
            } else {
              toast({ title: "Login do cliente atualizado" });
            }
          }
        } else if (clientPassword) {
          // Create new client user
          const { data: result, error: fnError } = await supabase.functions.invoke("create-client-user", {
            body: {
              mode: "create",
              email: clientEmail,
              password: clientPassword,
              client_id: clientId,
              client_name: name,
            },
          });
          if (fnError) {
            toast({ title: "Erro ao criar login do cliente", description: fnError.message, variant: "destructive" });
          } else if (result?.error) {
            toast({ title: "Erro ao criar login do cliente", description: result.error, variant: "destructive" });
          } else {
            toast({ title: "Login do cliente criado com sucesso" });
          }
        }
      }

      setDialogOpen(false);
      fetchClients().then(() => fetchClientUsers());
    } catch (err: any) {
      console.error("[AdminDashboard] Could not save client", err);
      toast({
        title: editingClient ? "Não foi possível atualizar o cliente" : "Não foi possível criar o cliente",
        description: err?.message || "O servidor retornou um erro. Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDeleteClient"))) return;
    await supabase.from("clients").delete().eq("id", id);
    fetchClients();
  };

  const copyClientUrl = (slug: string) => {
    const url = `${window.location.origin}/client/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: t("linkCopied"), description: url });
  };

  const baseUrl = window.location.origin;

  const filteredClients = clients.filter((client) => {
    if (!isSuperAdmin || clientFilter === "all") return true;
    if (clientFilter === "mine") return client.owner_id === currentUserId;
    if (clientFilter === "shared") return client.shared;
    return true;
  });

  const pendingCount = feedbacks.length + clientCreatedNotifs.length;
  const activeClientsCount = filteredClients.length;
  const todayAppointmentsPending = dashboardAppointments.filter((appointment) => !appointment.completed).length;

  return (
    <div className="min-h-screen bg-[#f6f8ff] text-slate-900">
      <header className="sticky top-0 z-30 px-3 py-4 md:px-6 md:py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-[30px] border border-white/70 bg-white/90 px-4 py-3 shadow-[0_18px_60px_-30px_rgba(61,87,203,0.45)] backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <input type="file" accept="image/*" ref={appLogoInputRef} className="hidden" onChange={handleAppLogoUpload} />
            {isAdmin ? (
              <button
                type="button"
                onClick={() => appLogoInputRef.current?.click()}
                className="relative group shrink-0"
                title="Clique para alterar o logo"
              >
                {appLogo ? (
                  <img src={appLogo} alt="Logo" className="h-10 w-10 rounded-2xl object-contain border border-slate-200 bg-white shadow-sm" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-100 via-white to-violet-100 shadow-sm">
                    <ImagePlus className="h-4 w-4 text-slate-500" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Pencil className="h-3.5 w-3.5 text-white" />
                </div>
              </button>
            ) : appLogo ? (
              <img src={appLogo} alt="Logo" className="h-10 w-10 shrink-0 rounded-2xl object-contain border border-slate-200 bg-white shadow-sm" />
            ) : null}
            <div className="flex items-center gap-3">
              <h1 className="type-heading text-slate-900">Design Hub</h1>
              <div className="hidden items-center gap-3 md:flex">
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/team-management")}
                    className="rounded-xl border-slate-200 bg-white px-5 text-slate-700 shadow-sm"
                  >
                    <Users className="mr-2 h-4 w-4" /> Equipe
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/social")}
                    className="rounded-xl border-slate-200 bg-white px-5 text-slate-700 shadow-sm"
                  >
                    <CalendarClock className="mr-2 h-4 w-4" /> Social
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <MobileNav title="Design Hub" />
            {isAdmin && (
              <Button
                onClick={openCreate}
                className="rounded-2xl bg-gradient-to-r from-sky-500 to-violet-600 px-6 text-white shadow-[0_16px_32px_-16px_rgba(95,78,255,0.9)] hover:from-sky-600 hover:to-violet-700"
              >
                <Plus className="mr-2 h-4 w-4" /> Clientes
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setQuickLinksOpen(true)} title="Links Rápidos" className="rounded-full text-slate-600">
              <Link2 className="h-5 w-5" />
            </Button>
            <NotificationBell />
            <UserProfileMenu />
          </div>
          <div className="flex md:hidden items-center gap-1">
            <MobileNav title="Design Hub" />
            <Button size="icon" variant="ghost" onClick={() => setQuickLinksOpen(true)}>
              <Link2 className="h-5 w-5" />
            </Button>
            <NotificationBell />
            {isAdmin && (
              <Button size="icon" variant="ghost" onClick={openCreate}>
                <Plus className="h-5 w-5" />
              </Button>
            )}
            <UserProfileMenu />
          </div>
        </div>
      </header>

      {/* Quick Links drawer */}
      <Sheet open={quickLinksOpen} onOpenChange={setQuickLinksOpen}>
        <SheetContent side="right" className="w-72 p-0">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="type-subheading flex items-center gap-2 text-left">
              <Link2 className="h-4 w-4" />
              Links Rápidos
            </SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <QuickLinksPanel />
          </div>
        </SheetContent>
      </Sheet>

      <main className="mx-auto max-w-7xl px-4 pb-10 pt-2 md:px-6">
        <div className="space-y-5 rounded-[34px] border border-white/70 bg-white/55 p-4 shadow-[0_24px_80px_-40px_rgba(76,95,170,0.45)] backdrop-blur md:p-6">
          <section className="grid gap-4 xl:grid-cols-[1.2fr_1.4fr]">
            <div className="relative overflow-hidden rounded-[28px] border border-[#dfe8fb] bg-gradient-to-r from-white via-[#f7faff] to-[#eef4ff] px-7 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="relative z-10">
                <h2 className="type-display text-slate-900">
                  {getGreeting()}, {userName ? userName.split(" ")[0] : "Liege"}👋
                </h2>
                <p className="type-body mt-2 capitalize text-slate-500">{getFormattedDate()}</p>
              </div>
              <div className="pointer-events-none absolute -right-3 top-8 h-32 w-32 rounded-full bg-gradient-to-br from-[#dce8ff] via-[#bccbff] to-[#eef2ff] opacity-80 blur-[1px]" />
              <div className="pointer-events-none absolute right-24 top-12 h-20 w-20 rounded-full border border-white/70 bg-white/50 backdrop-blur" />
              <div className="pointer-events-none absolute right-48 top-16 h-5 w-5 rounded-full bg-[#cdd8ff]" />
              <div className="pointer-events-none absolute right-40 bottom-10 h-7 w-7 rounded-full bg-[#d7e4ff]" />
            </div>

            <div className="grid gap-px overflow-hidden rounded-[24px] border border-[#dde5fb] bg-[#edf2ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] md:grid-cols-4">
              {[
                { label: "Clientes ativos", value: activeClientsCount, note: `${Math.max(activeClientsCount - 1, 0)} novos este mês`, icon: Users, color: "text-sky-600" },
                { label: "Posts este mês", value: monthlyPostsCount, note: "+18% vs mês anterior", icon: CalendarDays, color: "text-blue-600" },
                { label: "Pendentes", value: pendingCount, note: pendingCount > 0 ? `${pendingCount} exigem ação` : "Tudo em dia", icon: Clock, color: "text-amber-500" },
                { label: "Aprovados", value: approvedCount, note: approvedCount > 0 ? `+${approvedCount} aprovações` : "Sem aprovações hoje", icon: CheckCircle2, color: "text-emerald-500" },
              ].map((item) => (
                <div key={item.label} className="bg-white px-5 py-5">
                  <div className="type-label flex items-center gap-2 text-slate-500">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    {item.label}
                  </div>
                  <div className="type-kpi mt-4 text-slate-900">{item.value}</div>
                  <p className={`type-caption mt-2 ${item.color}`}>{item.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[24px] border border-[#e5eaf8] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <h3 className="type-subheading text-slate-900">Tarefas com Prazo</h3>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-600">
                  Em breve ({dashboardTasks.length})
                </span>
              </div>
              <div className="space-y-3">
                {dashboardTasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    Nenhuma tarefa com prazo próximo.
                  </div>
                ) : dashboardTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => navigate(`/admin/${task.clientSlug}`)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-[#edf1fb] bg-[#fffdfa] px-3 py-3 text-left transition hover:border-[#d9e3fb] hover:bg-[#fffaf1]"
                  >
                    {task.clientLogo ? (
                      <img src={task.clientLogo} alt={task.clientName} className="h-10 w-10 rounded-full border border-slate-200 object-contain" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f7ff] font-semibold text-slate-500">
                        {task.clientName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
                      <p className="truncate text-xs text-slate-500">{task.clientName}</p>
                    </div>
                    <span className="rounded-full bg-[#fff1dd] px-2 py-1 text-[11px] font-semibold text-amber-600">
                      {new Date(task.deadline).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </button>
                ))}
              </div>
              {dashboardTasks.length > 0 && (
                <div className="mt-4 text-center">
                  <button type="button" onClick={() => navigate("/calendar")} className="text-sm font-medium text-[#5d6bff] hover:underline">
                    Ver todas as tarefas →
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-[#e5eaf8] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <h3 className="type-subheading text-slate-900">Agenda de hoje</h3>
                </div>
                <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-600">
                  {todayAppointmentsPending} pendentes
                </span>
              </div>
              <div className="space-y-3">
                {dashboardAppointments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    Sem compromissos para hoje.
                  </div>
                ) : dashboardAppointments.map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => navigate("/agenda")}
                    className="flex w-full items-center gap-3 rounded-2xl border border-[#edf1fb] bg-[#fcfdff] px-3 py-3 text-left transition hover:border-[#d9e3fb]"
                  >
                    <div className={`h-4 w-4 rounded-full border-2 ${appointment.completed ? "border-emerald-500 bg-emerald-500" : "border-rose-400 bg-transparent"}`} />
                    <span className="w-12 shrink-0 text-sm font-medium text-slate-500">{appointment.time}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{appointment.title}</p>
                    </div>
                    <span className="rounded-full bg-[#f3efff] px-2 py-1 text-[11px] font-semibold text-violet-500">
                      {appointment.category || "Post"}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-4 text-center">
                <button type="button" onClick={() => navigate("/agenda")} className="text-sm font-medium text-[#5d6bff] hover:underline">
                  Ver agenda completa →
                </button>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#e5eaf8] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <h3 className="type-subheading text-slate-900">Posts para Hoje</h3>
                </div>
                <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-600">
                  {todayPosts.length}
                </span>
              </div>
              <div className="space-y-3">
                {todayPosts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    Nenhum post programado para hoje.
                  </div>
                ) : todayPosts.slice(0, 5).map((post) => (
                  <button
                    key={post.postId}
                    type="button"
                    onClick={() => navigate(`/admin/${post.clientSlug}`)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-[#edf1fb] bg-[#fcfdff] px-3 py-3 text-left transition hover:border-[#d9e3fb]"
                  >
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500">
                      {new Date(post.deadline).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{post.postTitle}</p>
                      <p className="truncate text-xs text-slate-500">{post.clientName}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 text-center">
                <button type="button" onClick={() => navigate("/calendar")} className="text-sm font-medium text-[#5d6bff] hover:underline">
                  Ver todos os posts →
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
        {feedbacks.length > 0 && (
          <div className="rounded-[24px] border border-[#e5eaf8] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                <Bell className="h-4 w-4 text-amber-500" />
              </div>
                <h3 className="type-subheading text-slate-900">{t("clientFeedbacks")}</h3>
              </div>
              <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-600">
                {feedbacks.length}
              </span>
            </div>
            <div className="space-y-3">
              {feedbacks.slice(0, 3).map((fb) => {
                const labelConfig = LABEL_CONFIG[fb.label as keyof typeof LABEL_CONFIG];
                return (
                  <div
                    key={fb.postId}
                    onClick={() => navigate(`/admin/${fb.clientSlug}`)}
                    className="cursor-pointer rounded-2xl border border-[#edf1fb] bg-[#fcfdff] px-3 py-3 transition hover:border-[#d9e3fb]"
                  >
                    <div className="flex items-center gap-3">
                      {fb.clientLogo ? (
                        <img src={fb.clientLogo} alt={fb.clientName} className="h-10 w-10 rounded-full border border-slate-200 object-contain shrink-0" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-[#f5f7ff] shrink-0">
                          <span className="text-xs font-bold text-slate-500">{fb.clientName.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <HoverCard openDelay={200} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <p className="cursor-pointer truncate text-sm font-semibold text-slate-900 hover:underline">{fb.postTitle}</p>
                          </HoverCardTrigger>
                          <HoverCardContent side="top" className="w-72 p-2" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const previewUrls = fb.mediaUrls.length > 0 ? fb.mediaUrls : fb.imageUrl ? [fb.imageUrl] : [];
                              return previewUrls.length > 0 ? (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-foreground truncate">{fb.postTitle}</p>
                                  <div className={cn("grid gap-1", previewUrls.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                                    {previewUrls.slice(0, 4).map((url, i) => (
                                      <img key={i} src={url} alt={`${fb.postTitle} ${i + 1}`} className="w-full rounded-md object-cover aspect-square" />
                                    ))}
                                  </div>
                                  {previewUrls.length > 4 && (
                                    <p className="text-[10px] text-muted-foreground text-center">+{previewUrls.length - 4} mais</p>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                                  Sem mídia
                                </div>
                              );
                            })()}
                          </HoverCardContent>
                        </HoverCard>
                        <p className="text-xs text-slate-500">{fb.clientName}</p>
                      </div>
                      <span className="hidden shrink-0 text-[10px] text-slate-400 sm:inline">
                        {new Date(fb.updatedAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 pl-[52px] flex-wrap">
                      {labelConfig && (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${labelConfig.color}`}>
                          {labelConfig.label}
                        </span>
                      )}
                      {fb.deadline && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                          <CalendarClock className="h-3 w-3" />
                          {new Date(fb.deadline).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 sm:hidden">
                        {new Date(fb.updatedAt).toLocaleDateString("pt-BR")}
                      </span>
                      <div className="flex-1" />
                       <button
                         onClick={async (e) => {
                           e.stopPropagation();
                           const { data: postData } = await supabase.from("posts").select("*").eq("id", fb.postId).maybeSingle();
                           if (postData) {
                             const p: Post = {
                               id: postData.id,
                               title: postData.title,
                               imageUrl: postData.image_url,
                               mediaType: (postData.media_type as any) || "image",
                               mediaUrls: postData.media_urls || [],
                               caption: postData.caption || "",
                               deadline: postData.deadline ? new Date(postData.deadline) : null,
                               status: (postData.status || []) as PostStatus[],
                               clientLabel: (postData.client_label || "pendente") as ClientLabel,
                               comments: [],
                               tags: postData.tags || [],
                               createdAt: new Date(postData.created_at),
                               columnId: postData.column_id,
                               position: postData.position,
                               archived: postData.archived,
                               archivedAt: postData.archived_at ? new Date(postData.archived_at) : null,
                               trelloCardId: postData.trello_card_id,
                             };
                             setViewPost(p);
                             setViewPostOpen(true);
                           }
                         }}
                         className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                         title="Ver post completo"
                       >
                         <Eye className="h-3 w-3 mr-0.5" />
                         Ver
                       </button>
                        <Popover
                          open={schedulePopoverOpen === fb.postId}
                          onOpenChange={(open) => {
                            if (open) {
                              setSchedulePopoverOpen(fb.postId);
                              setScheduleDate(fb.deadline ? new Date(fb.deadline).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
                              setScheduleTime(fb.deadline ? new Date(fb.deadline).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "09:00");
                            } else {
                              setSchedulePopoverOpen(null);
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-purple-700 transition-colors"
                              title="Marcar como Agendado"
                            >
                              <CalendarClock className="h-3 w-3 mr-0.5" />
                              Agendar
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3 space-y-3" align="end" onClick={(e) => e.stopPropagation()}>
                            <p className="text-xs font-semibold text-foreground">Agendar publicação</p>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Data</Label>
                              <Input
                                type="date"
                                value={scheduleDate}
                                onChange={(e) => setScheduleDate(e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Horário</Label>
                              <Input
                                type="time"
                                value={scheduleTime}
                                onChange={(e) => setScheduleTime(e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>
                            <Button
                              size="sm"
                              className="w-full h-7 text-xs"
                              onClick={() => markAsAgendado(fb, scheduleDate, scheduleTime)}
                            >
                              <CalendarClock className="h-3 w-3 mr-1" />
                              Confirmar Agendamento
                            </Button>
                          </PopoverContent>
                        </Popover>
                       <button
                         onClick={(e) => dismissFeedback(fb.postId, e)}
                         className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                         title="Dispensar"
                       >
                         <X className="h-3.5 w-3.5" />
                       </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-center">
              <button type="button" onClick={() => navigate("/calendar")} className="text-sm font-medium text-[#5d6bff] hover:underline">
                Ver todos os feedbacks →
              </button>
            </div>
          </div>
        )}
          {clientCreatedNotifs.length > 0 && (
            <div className="rounded-[24px] border border-[#e5eaf8] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                    <FilePlus className="h-4 w-4" />
                  </div>
                  <h3 className="type-subheading text-slate-900">{t("postsCreatedByClient")}</h3>
                </div>
                <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-600">
                  {clientCreatedNotifs.length}
                </span>
              </div>
              <div className="space-y-3">
                {clientCreatedNotifs.slice(0, 4).map((item) => (
                  <button
                    key={item.postId}
                    type="button"
                    onClick={() => navigate(`/admin/${item.clientSlug}`)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-[#edf1fb] bg-[#fcfdff] px-3 py-3 text-left transition hover:border-[#d9e3fb]"
                  >
                    {item.clientLogo ? (
                      <img src={item.clientLogo} alt={item.clientName} className="h-10 w-10 rounded-xl border border-slate-200 object-contain shrink-0" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-[#f5f7ff] font-semibold text-slate-500 shrink-0">
                        {item.clientName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.postTitle}</p>
                      <p className="truncate text-xs text-slate-500">{item.clientName}</p>
                    </div>
                    <span className="rounded-full bg-[#f3efff] px-2 py-1 text-[11px] font-semibold text-violet-500">
                      Revisar
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-4 text-center">
                <button type="button" onClick={() => navigate("/calendar")} className="text-sm font-medium text-[#5d6bff] hover:underline">
                  Ver todos os posts enviados →
                </button>
              </div>
            </div>
          )}

          <div className="rounded-[24px] border border-[#e5eaf8] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                  <Users className="h-4 w-4" />
                </div>
                <h3 className="type-subheading text-slate-900">Clientes</h3>
              </div>
              <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-600">
                {activeClientsCount}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredClients.slice(0, 6).map((client) => (
                <div key={client.id} className="rounded-2xl border border-[#edf1fb] bg-[#fcfdff] p-3">
                  <div className="flex items-center gap-3">
                    {client.logo_url ? (
                      <img src={client.logo_url} alt={client.name} className="h-12 w-12 rounded-xl border border-slate-200 object-contain" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-[#f5f7ff] font-semibold text-slate-500">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{client.name}</p>
                      <p className="text-xs text-slate-500">
                        {LOCALE_FLAGS[client.locale as Locale]} {LOCALE_LABELS[client.locale as Locale]}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" className="h-8 flex-1 rounded-xl bg-[#eef2ff] text-[#5d6bff] hover:bg-[#dfe7ff]" onClick={() => navigate(`/admin/${client.slug}`)}>
                      Gerenciar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 rounded-xl text-slate-500" onClick={() => copyClientUrl(client.slug)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              {isAdmin && (
                <Button
                  onClick={openCreate}
                  className="rounded-2xl bg-gradient-to-r from-sky-500 to-violet-600 px-4 text-white shadow-[0_16px_32px_-16px_rgba(95,78,255,0.9)] hover:from-sky-600 hover:to-violet-700"
                >
                  <Plus className="mr-2 h-4 w-4" /> Criar cliente
                </Button>
              )}
              <button type="button" onClick={() => navigate("/team")} className="text-sm font-medium text-[#5d6bff] hover:underline">
                Ver todos os clientes →
              </button>
            </div>
          </div>
          </section>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-muted p-6">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">{t("noClientsYet")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("createFirstClient")}</p>
            {isSuperAdmin && (
              <Button onClick={openCreate} className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="mr-2 h-4 w-4" /> {t("createClient")}
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Filter tabs for super admin */}
            {isSuperAdmin && (
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setClientFilter("all")}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", clientFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                >
                  Todos ({clients.length})
                </button>
                <button
                  onClick={() => setClientFilter("mine")}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", clientFilter === "mine" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                >
                  Meus ({clients.filter(c => c.owner_id === currentUserId).length})
                </button>
                <button
                  onClick={() => setClientFilter("shared")}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", clientFilter === "shared" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                >
                  <Share2 className="inline h-3 w-3 mr-1" />
                  Compartilhados ({clients.filter(c => c.shared).length})
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="group relative flex flex-col rounded-xl border bg-card p-5 transition-all hover:shadow-lg hover:border-primary/20"
                >
                  {/* Top badges row */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {/* Client type badge */}
                    {(() => {
                      const typeConfig = CLIENT_TYPE_CONFIG[client.client_type] || CLIENT_TYPE_CONFIG.standard;
                      return (
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", typeConfig.color)}>
                          {typeConfig.label}
                        </span>
                      );
                    })()}
                    {client.owner_id === currentUserId && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600" title="Você é o dono">
                        <Shield className="h-2.5 w-2.5" />
                      </span>
                    )}
                    {client.shared && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600" title="Compartilhado">
                        <Share2 className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Client info */}
                  <div className="flex items-center gap-3 mb-4">
                    {client.logo_url ? (
                      <img src={client.logo_url} alt={client.name} className="h-12 w-12 rounded-xl object-contain border bg-background" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted">
                        <span className="text-lg font-bold text-muted-foreground">
                          {client.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate text-base">{client.name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {LOCALE_FLAGS[client.locale as Locale]} {LOCALE_LABELS[client.locale as Locale]}
                        </span>
                        {clientUsersMap[client.id] && clientUsersMap[client.id].length > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground ml-1" title={`${clientUsersMap[client.id].length} acesso(s)`}>
                            <User className="h-3 w-3" />
                            {clientUsersMap[client.id].length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Social links row */}
                  <div className="flex items-center gap-1 mb-3">
                    {client.instagram_url && (
                      <a href={client.instagram_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded-md p-1 text-muted-foreground hover:text-pink-500 hover:bg-pink-500/10 transition-colors" title="Instagram">
                        <Instagram className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {client.facebook_url && (
                      <a href={client.facebook_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded-md p-1 text-muted-foreground hover:text-blue-600 hover:bg-blue-600/10 transition-colors" title="Facebook">
                        <Facebook className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {client.tiktok_url && (
                      <a href={client.tiktok_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="TikTok">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 3.76.92V6.69Z"/></svg>
                      </a>
                    )}
                    {client.youtube_url && (
                      <a href={client.youtube_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded-md p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors" title="YouTube">
                        <Youtube className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {client.linkedin_url && (
                      <a href={client.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded-md p-1 text-muted-foreground hover:text-blue-700 hover:bg-blue-700/10 transition-colors" title="LinkedIn">
                        <Linkedin className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {client.twitter_url && (
                      <a href={client.twitter_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="X (Twitter)">
                        <Twitter className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {client.website_url && (
                      <a href={client.website_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded-md p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Website">
                        <Globe className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <div className="flex-1" />
                    <button
                      onClick={(e) => { e.stopPropagation(); copyClientUrl(client.slug); }}
                      className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Copiar link do portal"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-auto flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/admin/${client.slug}`)}
                    >
                      {t("manage")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`/client/${client.slug}`); }}
                      title="Ver portal do cliente"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {(isSuperAdmin || client.owner_id === currentUserId) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(client)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {(isSuperAdmin || client.owner_id === currentUserId) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(client.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {/* Share button - for client owners */}
                    {(isSuperAdmin || client.owner_id === currentUserId) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setShareClientId(client.id);
                          // Fetch all admin/colaborador users to share with
                          const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");
                          const { data: roles } = await supabase.from("user_roles").select("user_id, role");
                          const adminUsers = (profiles || []).filter(p => {
                            const userRole = (roles || []).find((r: any) => r.user_id === p.id);
                            return userRole && ["super_admin", "admin", "colaborador"].includes(userRole.role) && p.id !== currentUserId;
                          });
                          setAllAdmins(adminUsers);
                          // Fetch existing assignments for this client
                          const { data: existingAssignments } = await supabase
                            .from("user_client_assignments")
                            .select("user_id, client_id")
                            .eq("client_id", client.id);
                          const assigned = new Set((existingAssignments || []).map((a: any) => a.user_id));
                          setShareSelectedUsers(assigned);
                          setShareDialogOpen(true);
                        }}
                        title="Compartilhar cliente"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        </div>
      </main>

      {/* Create / Edit Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? t("editClient") : t("newClient")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("clientName")}</Label>
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t("clientNamePlaceholder")}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              />
            </div>

            <div>
              <Label>{t("slugUrl")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">/client/</span>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="empresa-xyz"
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <Label>{t("clientLanguage")}</Label>
              <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {LOCALE_FLAGS[loc]} {LOCALE_LABELS[loc]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo de Cliente</Label>
              <Select value={clientType} onValueChange={setClientType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLIENT_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("logo")}</Label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
              {logoPreview ? (
                <div className="mt-1 flex items-center gap-3">
                  <img src={logoPreview} alt="Logo" className="h-14 w-14 rounded-lg object-contain border" />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    {t("change")}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 py-6 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  <ImagePlus className="h-5 w-5" /> {t("selectLogo")}
                  
                </button>
              )}

            <div>
              <Label>Redes Sociais</Label>
              <div className="mt-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Instagram className="h-4 w-4 text-pink-500 shrink-0" />
                  <Input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." className="flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-blue-600 shrink-0" />
                  <Input value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/..." className="flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 3.76.92V6.69Z"/></svg>
                  <Input value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="https://tiktok.com/@..." className="flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <Youtube className="h-4 w-4 text-red-500 shrink-0" />
                  <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/..." className="flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4 text-blue-700 shrink-0" />
                  <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/..." className="flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <Twitter className="h-4 w-4 shrink-0" />
                  <Input value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="https://x.com/..." className="flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary shrink-0" />
                  <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://meusite.com.br" className="flex-1" />
                </div>
              </div>
            </div>

            {/* Login do cliente */}
            <div className="border-t pt-4">
              <Label className="text-sm font-semibold">Login do Cliente</Label>
              <p className="text-xs text-muted-foreground mb-2">
                {existingClientUser
                  ? "Atualize o e-mail ou senha do cliente"
                  : "Crie um acesso para o cliente visualizar seus conteúdos"}
              </p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">E-mail do cliente</Label>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="cliente@email.com"
                  />
                </div>
                <div>
                  <Label className="text-xs">
                    {existingClientUser ? "Nova senha (deixe vazio para manter)" : "Senha"}
                  </Label>
                  <Input
                    type="password"
                    value={clientPassword}
                    onChange={(e) => setClientPassword(e.target.value)}
                    placeholder={existingClientUser ? "••••••••" : "Mínimo 6 caracteres"}
                  />
                </div>
              </div>
            </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !name || !slug}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {saving ? "..." : editingClient ? t("save") : t("createClient")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <InviteAdminDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <PostDetailDialog
        post={viewPost}
        open={viewPostOpen}
        onOpenChange={setViewPostOpen}
        tags={DEFAULT_TAGS}
        t={t}
        onUpdateLabel={async (postId, label, comment) => {
          try {
            await supabase.from("posts").update({ client_label: label }).eq("id", postId);
            if (comment) {
              const { data: { user } } = await supabase.auth.getUser();
              await supabase.from("comments").insert({ post_id: postId, author: user?.email || "Admin", text: comment });
            }
            if (viewPost && viewPost.id === postId) {
              setViewPost({ ...viewPost, clientLabel: label });
            }
            toast({ title: "Etiqueta atualizada com sucesso!" });
          } catch (err) {
            console.error("Error updating label:", err);
            toast({ title: "Erro ao atualizar etiqueta", variant: "destructive" });
          }
        }}
      />

      {/* Share Client Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Compartilhar Cliente
            </DialogTitle>
            <DialogDescription>
              Selecione os usuários que terão acesso a este cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {allAdmins.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum outro usuário disponível para compartilhar.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 rounded-lg border p-3">
                {allAdmins.map(admin => (
                  <label key={admin.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shareSelectedUsers.has(admin.id)}
                      onChange={() => {
                        setShareSelectedUsers(prev => {
                          const next = new Set(prev);
                          if (next.has(admin.id)) next.delete(admin.id);
                          else next.add(admin.id);
                          return next;
                        });
                      }}
                      className="rounded border-border"
                    />
                    <div>
                      <p className="text-sm font-medium">{admin.full_name}</p>
                      <p className="text-xs text-muted-foreground">{admin.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <Button
              className="w-full"
              disabled={saving}
              onClick={async () => {
                if (!shareClientId) return;
                setSaving(true);
                try {
                  // Delete existing non-owner assignments
                  await supabase.from("user_client_assignments").delete()
                    .eq("client_id", shareClientId)
                    .neq("user_id", currentUserId || "");
                  
                  // Insert new assignments
                  if (shareSelectedUsers.size > 0) {
                    const { data: { session } } = await supabase.auth.getSession();
                    const newAssignments = Array.from(shareSelectedUsers)
                      .filter(uid => uid !== currentUserId)
                      .map(uid => ({
                        user_id: uid,
                        client_id: shareClientId,
                        assigned_by: session?.user?.id || null,
                      }));
                    if (newAssignments.length > 0) {
                      await supabase.from("user_client_assignments").insert(newAssignments as any);
                    }
                  }

                  // Mark as shared if others have access
                  const isShared = shareSelectedUsers.size > 0;
                  await supabase.from("clients").update({ shared: isShared } as any).eq("id", shareClientId);
                  setClients(prev => prev.map(c => c.id === shareClientId ? { ...c, shared: isShared } : c));

                  toast({ title: "Compartilhamento atualizado" });
                  setShareDialogOpen(false);
                } catch (err: any) {
                  toast({ title: "Erro", description: err.message, variant: "destructive" });
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Salvando..." : "Salvar compartilhamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AdminDashboard;
