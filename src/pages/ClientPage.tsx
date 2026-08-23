import { useState, useEffect, useCallback } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ContractGateModal } from "@/components/ContractGateModal";
import { useUserRole } from "@/hooks/useUserRole";
import { useMyBillingPermission } from "@/hooks/useBillingPermissions";
import { useNavigate } from "react-router-dom";
import ClientBriefs from "@/components/ClientBriefs";
import { ClientInvoicesPanel } from "@/components/billing/ClientInvoicesPanel";
import ClientDesignBriefs from "@/components/briefs/ClientDesignBriefs";
import ClientBriefAssignments from "@/components/briefs/ClientBriefAssignments";
import { TextContentsPanel } from "@/components/TextContentsPanel";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PostsProvider, usePosts } from "@/context/PostsContext";
import { Post } from "@/types/post";
import { PostCard } from "@/components/PostCard";
import { PostCardSkeleton } from "@/components/PostCardSkeleton";
import { PostCardDialog } from "@/components/PostCardDialog";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { Locale, translations } from "@/i18n/translations";
import { I18nProvider } from "@/i18n/I18nContext";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from "date-fns";
import { ptBR, it, enUS, es, sv } from "date-fns/locale";
import { Archive, CheckCircle2, ChevronLeft, ChevronRight as ChevronRightIcon, ClipboardList, FileBarChart, FileText, KeyRound, LayoutGrid, LogOut, Menu, Plus, RotateCcw, Sparkles, Wallet } from "lucide-react";
import { ClientNewsWidget } from "@/components/ClientNewsWidget";
import { UpcomingPostsWidget } from "@/components/UpcomingPostsWidget";
import { TrackingDrawer } from "@/components/TrackingDrawer";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSocialReports, METRIC_LABELS } from "@/hooks/useSocialReports";
import { KanbanScrollWrapper } from "@/components/KanbanScrollWrapper";
import { GradientHeartIcon } from "@/components/GradientHeartIcon";
import { NotificationBell } from "@/components/NotificationBell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ClientData {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  locale: string;
  posting_period: string;
  show_archived_to_client: boolean;
  show_invoices_to_client: boolean;
  allow_client_edit_caption: boolean;
  allow_client_create_post: boolean;
  allow_client_download: boolean;
  allow_client_create_tags: boolean;
  tracking_enabled: boolean;
  tracking_visible_to_client: boolean;
  show_upcoming_posts: boolean;
  client_portal_title: string;
}

const POSTS_PER_PAGE = 6;

interface ClientViewerProfile {
  email: string;
  fullName: string;
  avatarUrl: string;
}

const ClientPageInner = ({ clientData }: { clientData: ClientData }) => {
  const { posts, archivedPosts, columns, tags, postingPeriod, unarchivePost, updateClientLabel, addComment, loading: postsLoading } = usePosts();
  const navigate = useNavigate();
  const { data: reports = [] } = useSocialReports(clientData.id);
  const { permission: billingPerm, loading: billingPermLoading } = useMyBillingPermission(clientData.id);
  const locale = (clientData.locale || "pt") as Locale;
  const t = useCallback(
    (key: keyof typeof translations.pt) => translations[locale]?.[key] || translations.pt[key] || key,
    [locale]
  );

  const userName = clientData.name || "";


  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("goodMorning");
    if (hour < 18) return t("goodAfternoon");
    return t("goodEvening");
  };

  const [activeTab, setActiveTab] = useState<"board" | "archived">("board");
  const [createOpen, setCreateOpen] = useState(false);
  const [createInColumnId, setCreateInColumnId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE);
  const [viewerProfile, setViewerProfile] = useState<ClientViewerProfile | null>(null);

  const isCurrentMonth = isSameMonth(selectedMonth, new Date());
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const monthLocale = { pt: ptBR, it, en: enUS, es, sv }[locale] || ptBR;

  useEffect(() => {
    const loadViewerProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email || "";

      if (!session?.user) {
        setViewerProfile({ email, fullName: "", avatarUrl: "" });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", session.user.id)
        .maybeSingle();

      setViewerProfile({
        email,
        fullName: (profile as any)?.full_name || email.split("@")[0] || "",
        avatarUrl: (profile as any)?.avatar_url || "",
      });
    };

    loadViewerProfile();
  }, []);

  // Reset visible count when month changes
  useEffect(() => {
    setVisibleCount(POSTS_PER_PAGE);
  }, [selectedMonth]);

  // Filter posts by selected month (using deadline or createdAt)
  const filterByMonth = useCallback((post: Post) => {
    const date = post.deadline || post.createdAt;
    return date >= monthStart && date <= monthEnd;
  }, [monthStart, monthEnd]);

  // Filter reports by selected month
  const filteredReports = reports.filter((r) => {
    const start = new Date(r.period_start);
    const end = new Date(r.period_end);
    return (start <= monthEnd && end >= monthStart);
  });

  // Track which items the client has already seen
  const [seenItemIds, setSeenItemIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const fetchSeen = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("client_seen_items")
        .select("item_type, item_id")
        .eq("user_id", session.user.id);
      setSeenItemIds(new Set((data || []).map((s: any) => `${s.item_type}:${s.item_id}`)));
    };
    fetchSeen();
  }, []);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error(t("passwordMinError"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast.error(t("passwordUpdateError") + ": " + error.message);
    } else {
      toast.success(t("passwordUpdated"));
      setPasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const readyPosts = posts.filter((p) => p.status.includes("pronto") && p.clientLabel !== "aprovado");

  const entradaColumn = columns.find((c) => c.name.toLowerCase() === "entrada");
  const entradaPosts = entradaColumn
    ? posts.filter((p) => p.columnId === entradaColumn.id && p.status.includes("em_desenvolvimento"))
    : [];

  // Columns explicitly visible to client (excluding entrada which has its own section)
  const visibleColumns = columns.filter((c) => c.visibleToClient && c.id !== entradaColumn?.id);
  const visibleColumnPosts = visibleColumns.map((col) => ({
    column: col,
    posts: posts.filter((p) => p.columnId === col.id),
  })).filter((g) => g.posts.length > 0);

  const sortByDate = (list: typeof posts) =>
    [...list].sort((a, b) => {
      // Posts with "alterado" tag go first
      const aAlterado = a.tags.includes("alterado") ? 1 : 0;
      const bAlterado = b.tags.includes("alterado") ? 1 : 0;
      if (aAlterado !== bAlterado) return bAlterado - aAlterado;
      const dateA = a.deadline ? new Date(a.deadline).getTime() : 0;
      const dateB = b.deadline ? new Date(b.deadline).getTime() : 0;
      return dateA - dateB;
    });

  const hasContent = readyPosts.length > 0 || entradaPosts.length > 0 || visibleColumnPosts.length > 0;

  const groupedArchived = archivedPosts.reduce<Record<string, typeof archivedPosts>>((acc, post) => {
    const date = post.archivedAt || post.createdAt;
    const key = format(date, "MMMM yyyy", { locale: ptBR });
    if (!acc[key]) acc[key] = [];
    acc[key].push(post);
    return acc;
  }, {});

  const archivedMonths = Object.keys(groupedArchived).sort((a, b) => {
    const dateA = groupedArchived[a][0].archivedAt || groupedArchived[a][0].createdAt;
    const dateB = groupedArchived[b][0].archivedAt || groupedArchived[b][0].createdAt;
    return dateB.getTime() - dateA.getTime();
  });

  const topCards = [
    {
      id: "approvals",
      label: t("postsForApproval"),
      value: readyPosts.length,
      icon: CheckCircle2,
      visible: true,
    },
    {
      id: "briefs",
      label: "Briefs",
      value: 3,
      icon: ClipboardList,
      visible: true,
    },
    {
      id: "invoices",
      label: t("invoices"),
      value: billingPerm?.can_view_invoices ? 1 : 0,
      icon: Wallet,
      visible: clientData.show_invoices_to_client && !!billingPerm?.can_view_invoices,
    },
    {
      id: "reports",
      label: "Reports",
      value: filteredReports.length,
      icon: FileBarChart,
      visible: true,
    },
  ].filter((item) => item.visible);

  const menuItems = [
    { id: "approvals", label: t("postsForApproval"), icon: CheckCircle2, active: true },
    { id: "briefs", label: "Brief", icon: FileText, active: false },
    { id: "upcoming", label: t("upcomingPosts"), icon: LayoutGrid, active: false },
    { id: "billing", label: t("invoices"), icon: Wallet, active: false },
    { id: "reports", label: "Report", icon: FileBarChart, active: false },
  ];

  const displayName = viewerProfile?.fullName || viewerProfile?.email?.split("@")[0] || userName;
  const displayFirstName = displayName?.split(" ")[0] || userName.split(" ")[0] || "";
  const initials = (displayName || viewerProfile?.email || "C")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-transparent px-3 py-3 sm:px-6 sm:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1500px] gap-4 rounded-[2rem] bg-white/72 p-3 shadow-[0_24px_80px_-40px_rgba(40,61,130,0.4)] ring-1 ring-white/70 backdrop-blur-xl sm:p-4 lg:gap-6 lg:p-5">
        <aside className="hidden w-[250px] shrink-0 flex-col justify-between rounded-[1.75rem] bg-white/70 p-4 ring-1 ring-slate-200/70 backdrop-blur-xl lg:flex">
          <div className="space-y-6">
            <div className="border-b border-slate-200/70 px-2 pb-5">
              <div className="flex items-center gap-3 rounded-2xl bg-white/55 px-2 py-2 shadow-[0_12px_24px_-20px_rgba(83,98,182,0.7)]">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-white via-[#eef2ff] to-[#d9ddff] shadow-[inset_2px_2px_4px_rgba(255,255,255,0.95),inset_-3px_-4px_6px_rgba(108,91,190,0.2),0_8px_14px_-8px_rgba(83,98,182,0.75)] ring-1 ring-white/80 [transform:perspective(120px)_rotateX(3deg)]">
                  <span className="pointer-events-none absolute inset-1 rounded-xl bg-gradient-to-br from-white/80 via-transparent to-violet-300/25" />
                  <GradientHeartIcon className="relative h-6 w-6 drop-shadow-[1px_3px_2px_rgba(76,64,160,0.28)]" />
                </div>
                <div>
                  <p className="text-[1.05rem] font-semibold text-slate-800">{clientData.client_portal_title || t("clientTitle")}</p>
                </div>
              </div>
            </div>

            <nav className="space-y-1.5">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition-colors",
                    item.active
                      ? "bg-[linear-gradient(180deg,rgba(92,98,255,0.12),rgba(92,98,255,0.06))] text-primary shadow-sm"
                      : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-800"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="space-y-2 rounded-[1.4rem] border border-slate-200/70 bg-white/70 p-3">
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <KeyRound className="h-4 w-4" />
              <span>{t("changePassword")}</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" />
              <span>{t("signOut")}</span>
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 rounded-[1.75rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(244,247,255,0.76))] p-3 ring-1 ring-slate-200/60 backdrop-blur-xl sm:p-5 lg:p-6">
          <header className="mb-5 rounded-[1.6rem] border border-white/70 bg-white/65 px-4 py-4 shadow-[0_16px_40px_-32px_rgba(75,93,155,0.8)] backdrop-blur-xl sm:px-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                {clientData.logo_url && (
                  <img
                    src={clientData.logo_url}
                    alt="Logo"
                    className="h-12 w-12 rounded-2xl border border-slate-200/70 bg-white object-contain p-2 shadow-sm sm:h-14 sm:w-14"
                  />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{clientData.name}</p>
                  <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                    {getGreeting()}{displayFirstName ? `, ${displayFirstName}` : ""} 👋
                  </h1>
                  <p className="text-sm text-slate-500">{t("clientSubtitle")}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 lg:justify-end">
                <div className="flex items-center gap-2">
                  <div className="rounded-full border border-slate-200/70 bg-white/80 p-1">
                    <NotificationBell />
                  </div>
                  <div className="lg:hidden">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full border border-slate-200/70 bg-white/80 text-slate-500 hover:bg-white">
                          <Menu className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/client/${clientData.slug}/brand-brain`)}>
                          <Sparkles className="mr-2 h-4 w-4" />
                          {t("brandBrain")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
                          <KeyRound className="mr-2 h-4 w-4" />
                          {t("changePassword")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            await supabase.auth.signOut();
                            window.location.href = "/login";
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          {t("signOut")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-full border border-slate-200/70 bg-white/80 px-2.5 py-1.5 shadow-sm">
                  <Avatar className="h-10 w-10 ring-2 ring-white">
                    <AvatarImage src={clientData.logo_url || viewerProfile?.avatarUrl || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden pr-1 sm:block">
                    <p className="max-w-[140px] truncate text-sm font-semibold text-slate-800">{displayName}</p>
                    <p className="text-xs text-slate-400">{t("clientTitle")}</p>
                  </div>
                </div>
              </div>
            </div>

          <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("changePassword")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t("newPassword")}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t("minChars")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t("confirmNewPassword")}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t("repeatPassword")}
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={savingPassword}
                  className="w-full"
                >
                  {savingPassword ? t("saving") : t("saveNewPassword")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </header>

          <main className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {topCards.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.4rem] border border-white/70 bg-white/80 px-4 py-4 shadow-[0_14px_34px_-28px_rgba(76,94,160,0.7)]"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">{item.label}</span>
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <item.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                </div>
              ))}
            </section>

            <section className="rounded-[1.6rem] border border-white/70 bg-white/78 p-4 shadow-[0_16px_40px_-30px_rgba(75,93,155,0.75)] sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{clientData.client_portal_title || t("postsForApproval")}</h2>
                  <p className="text-sm text-slate-500">{t("clientSubtitle")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full border border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50"
                    onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <button
                    onClick={() => setSelectedMonth(new Date())}
                    className="rounded-full border border-slate-200/70 bg-slate-50 px-4 py-2 text-sm font-semibold capitalize text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    {format(selectedMonth, "MMMM yyyy", { locale: monthLocale })}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full border border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50"
                    onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
                    disabled={isCurrentMonth}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                  {!isCurrentMonth && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-slate-200 bg-white text-xs text-slate-600"
                      onClick={() => setSelectedMonth(new Date())}
                    >
                      {t("currentMonth")}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden rounded-full border-slate-200 bg-white text-slate-600 lg:inline-flex"
                    onClick={() => navigate(`/client/${clientData.slug}/brand-brain`)}
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    {t("brandBrain")}
                  </Button>
                </div>
              </div>
            </section>

            <ClientNewsWidget clientId={clientData.id} showInvoices={clientData.show_invoices_to_client && !!billingPerm?.can_view_invoices} locale={clientData.locale} />

            <div className="rounded-[1.6rem] border border-white/70 bg-white/78 p-4 shadow-[0_16px_40px_-30px_rgba(75,93,155,0.75)] sm:p-5">
              <ClientBriefs clientId={clientData.id} clientName={clientData.name} filterMonth={selectedMonth} locale={clientData.locale} />
            </div>

            <div className="rounded-[1.6rem] border border-white/70 bg-white/78 p-4 shadow-[0_16px_40px_-30px_rgba(75,93,155,0.75)] sm:p-5">
              <ClientDesignBriefs clientId={clientData.id} />
            </div>

            <div className="rounded-[1.6rem] border border-white/70 bg-white/78 p-4 shadow-[0_16px_40px_-30px_rgba(75,93,155,0.75)] sm:p-5">
              <ClientBriefAssignments clientId={clientData.id} locale={clientData.locale} />
            </div>

            <div className="rounded-[1.6rem] border border-white/70 bg-white/78 p-4 shadow-[0_16px_40px_-30px_rgba(75,93,155,0.75)] sm:p-5">
              <TextContentsPanel clientId={clientData.id} clientName={clientData.name} locale={clientData.locale} />
            </div>

            {clientData.show_invoices_to_client && billingPerm?.can_view_invoices && (
              <div className="rounded-[1.6rem] border border-white/70 bg-white/78 p-4 shadow-[0_16px_40px_-30px_rgba(75,93,155,0.75)] sm:p-5">
                <ClientInvoicesPanel
                  clientId={clientData.id}
                  unseenIds={seenItemIds}
                  canDownloadInvoices={billingPerm.can_download_invoices}
                  canViewAttachments={billingPerm.can_view_attachments}
                  canDownloadAttachments={billingPerm.can_download_attachments}
                  filterMonth={selectedMonth}
                  locale={clientData.locale}
                />
              </div>
            )}

            {clientData.show_archived_to_client && (
              <div className="flex justify-center">
                <div className="inline-flex rounded-full border border-slate-200/80 bg-white/80 p-1 shadow-sm">
                  <button
                    onClick={() => setActiveTab("board")}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      activeTab === "board" ? "bg-primary text-white shadow-sm" : "text-slate-500"
                    )}
                  >
                    <LayoutGrid className="mr-1.5 inline h-4 w-4" />
                    {clientData.client_portal_title || t("postsForApproval")}
                  </button>
                  <button
                    onClick={() => setActiveTab("archived")}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      activeTab === "archived" ? "bg-primary text-white shadow-sm" : "text-slate-500"
                    )}
                  >
                    <Archive className="mr-1.5 inline h-4 w-4" />
                    {t("archived")}
                    {archivedPosts.length > 0 && (
                      <span className={cn(
                        "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        activeTab === "archived" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                      )}>
                        {archivedPosts.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Reports list moved into the unified Novidades widget above */}

            {activeTab === "board" || !clientData.show_archived_to_client ? (
              <div className="rounded-[1.6rem] border border-white/70 bg-white/78 p-4 shadow-[0_16px_40px_-30px_rgba(75,93,155,0.75)] sm:p-5">
                {!clientData.show_archived_to_client && (
                  <h2 className="mb-6 text-center text-3xl font-bold text-foreground">{clientData.client_portal_title || t("postsForApproval")}</h2>
                )}

                {clientData.allow_client_create_post && (
                  <div className="mb-4 flex justify-center">
                    <Button
                      onClick={() => { setCreateInColumnId(null); setCreateOpen(true); }}
                      className="rounded-full bg-accent px-5 text-accent-foreground hover:bg-accent/90"
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      {t("createPost")}
                    </Button>
                  </div>
                )}


                {clientData.tracking_enabled && clientData.tracking_visible_to_client && (
                  <TrackingDrawer
                    clientId={clientData.id}
                    posts={posts}
                    columns={columns}
                    tags={tags}
                    trackingColumnIds={((clientData as any).tracking_column_ids as string[]) ?? []}
                    locale={clientData.locale}
                  />
                )}

                <div className="flex-1 min-w-0 space-y-8 overflow-x-hidden">
                  {postsLoading ? (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <PostCardSkeleton key={i} />
                      ))}
                    </div>
                  ) : hasContent ? (
                    <>
                      {visibleColumnPosts.length > 0 && (
                        <div className="-mx-4 px-4 sm:-mx-5 sm:px-5">
                          <KanbanScrollWrapper>
                            {visibleColumnPosts.map(({ column, posts: colPosts }) => (
                              <div key={column.id} className="w-80 shrink-0 rounded-[1.4rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,255,0.98),rgba(255,255,255,0.85))] p-4 shadow-[0_14px_30px_-26px_rgba(71,88,150,0.7)]">
                                <div className="mb-4 flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/90 px-3 py-2 shadow-sm">
                                  <span className="text-sm font-semibold text-foreground">{column.name}</span>
                                  <span className="text-xs text-muted-foreground">({colPosts.length})</span>
                                </div>
                                <div className="space-y-4">
                                  {sortByDate(colPosts).map((post) => (
                                    <ErrorBoundary key={post.id} fallbackTitle={t("errorDisplayingPost")}>
                                      <PostCard post={post} isAdmin={false} onEdit={() => setDetailPost(post)} allowEditCaption={clientData.allow_client_edit_caption} allowClientDownload={clientData.allow_client_download} />
                                    </ErrorBoundary>
                                  ))}
                                </div>
                              </div>
                            ))}
                            <div className="w-1 shrink-0" aria-hidden="true" />
                          </KanbanScrollWrapper>
                        </div>
                      )}

                      <div className="flex flex-col gap-6 lg:flex-row">
                        {entradaPosts.length > 0 && (
                          <div className="w-full shrink-0 lg:w-80">
                            <h3 className="mb-3 text-lg font-semibold text-muted-foreground">{t("statusEntry")}</h3>
                            <div className="space-y-4 rounded-[1.35rem] border border-slate-200/70 bg-slate-50/75 p-4">
                              {sortByDate(entradaPosts).map((post) => (
                                <ErrorBoundary key={post.id} fallbackTitle={t("errorDisplayingPost")}>
                                  <PostCard post={post} isAdmin={false} onEdit={() => setDetailPost(post)} hideFeedback allowEditCaption={clientData.allow_client_edit_caption} allowClientDownload={clientData.allow_client_download} />
                                </ErrorBoundary>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          {readyPosts.length > 0 && (
                            <>
                              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                                {sortByDate(readyPosts).slice(0, visibleCount).map((post) => (
                                  <ErrorBoundary key={post.id} fallbackTitle={t("errorDisplayingPost")}>
                                    <PostCard post={post} isAdmin={false} onEdit={() => setDetailPost(post)} allowEditCaption={clientData.allow_client_edit_caption} allowClientDownload={clientData.allow_client_download} showInlineDetails={visibleColumnPosts.length === 0} />
                                  </ErrorBoundary>
                                ))}
                              </div>
                              {visibleCount < readyPosts.length && (
                                <div className="mt-6 flex justify-center">
                                  <Button
                                    variant="outline"
                                    onClick={() => setVisibleCount((prev) => prev + POSTS_PER_PAGE)}
                                    className="rounded-full border-slate-200 bg-white px-8"
                                  >
                                    {t("loadMore")} ({readyPosts.length - visibleCount} {t("loadMoreRemaining")})
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="py-12 text-center text-muted-foreground">{t("noPostsToReview")}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-[1.6rem] border border-white/70 bg-white/78 p-4 shadow-[0_16px_40px_-30px_rgba(75,93,155,0.75)] sm:p-5">
                <div className="h-[calc(100vh-600px)] min-h-[300px] overflow-hidden">
                  {archivedPosts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="mb-4 rounded-full bg-muted p-6">
                        <Archive className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h2 className="text-xl font-semibold text-foreground">{t("noArchivedPosts")}</h2>
                    </div>
                  ) : (
                    <div className="flex h-full gap-4 overflow-x-auto pb-4">
                      {archivedMonths.map((month) => (
                        <div key={month} className="flex h-full w-80 shrink-0 flex-col rounded-[1.35rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,255,0.98),rgba(255,255,255,0.85))] p-4">
                          <div className="mb-4 flex items-center gap-2">
                            <span className="text-sm font-semibold capitalize text-foreground">{month}</span>
                            <span className="text-xs text-muted-foreground">({groupedArchived[month].length})</span>
                          </div>
                          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                            {groupedArchived[month].map((post) => (
                              <div key={post.id} className="relative">
                                <PostCard post={post} isAdmin={false} onEdit={() => setDetailPost(post)} hideFeedback allowEditCaption={clientData.allow_client_edit_caption} allowClientDownload={clientData.allow_client_download} />
                                {columns.length > 0 && (
                                  <div className="mt-1.5">
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="w-full text-xs">
                                          <RotateCcw className="mr-1.5 h-3 w-3" /> {t("restore")}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-48 p-2" align="start">
                                        <p className="mb-2 text-xs font-medium text-muted-foreground">{t("moveToColumn")}:</p>
                                        <div className="space-y-1">
                                          {columns.map((col) => (
                                            <button
                                              key={col.id}
                                              onClick={() => unarchivePost(post.id, col.id, true)}
                                              className="w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                                            >
                                              {col.name}
                                            </button>
                                          ))}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {clientData.allow_client_create_post && (
        <CreatePostDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          defaultColumnId={createInColumnId}
          clientCreated
        />
      )}

      <PostCardDialog
        post={detailPost}
        open={!!detailPost}
        onOpenChange={(v) => { if (!v) setDetailPost(null); }}
        isAdmin={false}
        allowEditCaption={clientData.allow_client_edit_caption}
        allowClientDownload={clientData.allow_client_download}
        allowClientCreateTags={clientData.allow_client_create_tags}
      />
    </div>
  );
};

const ClientPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { isClient } = useUserRole();
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }
    const load = async () => {
      // Load client data
      const { data } = await supabase.from("clients").select("*").eq("slug", slug).maybeSingle();
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setClientData(data as ClientData);
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (notFound || !clientData) {
    const fallbackLocale = (clientData?.locale || "pt") as Locale;
    const tt = (key: keyof typeof translations.pt) => translations[fallbackLocale]?.[key] || translations.pt[key];
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <h1 className="text-2xl font-bold text-foreground">{tt("clientNotFound")}</h1>
        <p className="mt-2 text-muted-foreground">{tt("clientNotFoundDesc")}</p>
      </div>
    );
  }


  const clientLocale = (clientData.locale || "pt") as Locale;
  const tOuter = (key: keyof typeof translations.pt) => translations[clientLocale]?.[key] || translations.pt[key];

  return (
    <ErrorBoundary fallbackTitle={tOuter("errorLoadingClientPage")}>
      {isClient && <ContractGateModal />}
      <I18nProvider key={clientLocale} forceLocale={clientLocale}>
        <PostsProvider clientId={clientData.id} clientLogo={clientData.logo_url} clientPostingPeriod={clientData.posting_period}>
          <ClientPageInner clientData={clientData} />
        </PostsProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
};

export default ClientPage;
