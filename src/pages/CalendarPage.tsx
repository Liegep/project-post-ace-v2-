import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCalendarPosts, CalendarPost, CalendarPostStatus, STATUS_CONFIG } from "@/hooks/useCalendarPosts";
import { useCommemorativeDates, CATEGORY_LABELS } from "@/hooks/useCommemorativeDates";
import { CalendarPostDialog } from "@/components/calendar/CalendarPostDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Plus, Check, Clock,
  CalendarDays, LayoutGrid, List, Columns3, CalendarHeart
} from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  startOfWeek, endOfWeek, isSameDay, isSameMonth, isToday
} from "date-fns";
import { ptBR } from "date-fns/locale";

type ViewMode = "month" | "week" | "day";

interface Client {
  id: string;
  name: string;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function CalendarPage() {
  const navigate = useNavigate();
  const { posts, loading, createPost, updatePost, deletePost } = useCalendarPosts();
  const { getDatesByMonthDay, countries, selectedCountries, toggleCountry, setSelectedCountries } = useCommemorativeDates();
  const [clients, setClients] = useState<Client[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<CalendarPost | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>("");
  const [detailPost, setDetailPost] = useState<CalendarPost | null>(null);
  const [showCommemorativeFilter, setShowCommemorativeFilter] = useState(false);

  useEffect(() => {
    supabase.from("clients").select("id, name").order("name").then(({ data }) => {
      setClients((data as Client[]) || []);
    });
  }, []);

  const filteredPosts = useMemo(() => {
    let filtered = posts;
    if (filterClient !== "all") filtered = filtered.filter((p) => p.client_id === filterClient);
    if (filterStatus !== "all") filtered = filtered.filter((p) => p.status === filterStatus);
    return filtered;
  }, [posts, filterClient, filterStatus]);

  const postsByDate = useMemo(() => {
    const map: Record<string, CalendarPost[]> = {};
    filteredPosts.forEach((p) => {
      const key = p.publish_date;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [filteredPosts]);

  const goToToday = () => setCurrentDate(new Date());

  const navigate_date = (dir: "prev" | "next") => {
    const fn = dir === "prev"
      ? viewMode === "month" ? subMonths : viewMode === "week" ? subWeeks : subDays
      : viewMode === "month" ? addMonths : viewMode === "week" ? addWeeks : addDays;
    setCurrentDate(fn(currentDate, 1));
  };

  const headerLabel = useMemo(() => {
    if (viewMode === "month") return format(currentDate, "MMMM yyyy", { locale: ptBR });
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(ws, "d MMM", { locale: ptBR })} — ${format(we, "d MMM yyyy", { locale: ptBR })}`;
    }
    return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR });
  }, [currentDate, viewMode]);

  const handleSave = async (data: Partial<CalendarPost>) => {
    if ((data as any).id) {
      const { id, ...updates } = data as any;
      return updatePost(id, updates);
    }
    return createPost(data);
  };

  const openCreate = (date?: string) => {
    setEditingPost(null);
    setDefaultDate(date || format(new Date(), "yyyy-MM-dd"));
    setDialogOpen(true);
  };

  const openEdit = (post: CalendarPost) => {
    setEditingPost(post);
    setDialogOpen(true);
  };

  const handleMarkPublished = async (post: CalendarPost) => {
    await updatePost(post.id, { status: "published" } as any);
    toast({ title: "Marcado como publicado!" });
  };

  const handleSchedule = async (post: CalendarPost) => {
    await updatePost(post.id, { status: "scheduled" } as any);
    toast({ title: "Post agendado!" });
  };

  // --- Post block component ---
  const PostBlock = ({ post, compact = false }: { post: CalendarPost; compact?: boolean }) => {
    const cfg = STATUS_CONFIG[post.status];
    const clientName = post.clients?.name || clients.find((c) => c.id === post.client_id)?.name || "";
    const time = post.publish_time?.slice(0, 5) || "";

    if (compact) {
      return (
        <button
          onClick={() => openEdit(post)}
          className={`w-full truncate rounded-ui-sm border-l-2 px-ui-2 py-ui-1 text-left text-ui-xs leading-tight transition-opacity hover:opacity-80 ${cfg.bgClass} ${cfg.borderClass}`}
        >
          <span className="font-medium">{time}</span>{" "}
          <span className="text-muted-foreground">{clientName}</span>{" "}
          <span className="truncate">{post.title}</span>
        </button>
      );
    }

    return (
      <div
        onClick={() => setDetailPost(post)}
        className={`cursor-pointer rounded-ui-md border-l-4 p-ui-3 transition-shadow hover:shadow-md ${cfg.bgClass} ${cfg.borderClass}`}
      >
        <div className="flex items-start justify-between gap-ui-2">
          <div className="min-w-0 flex-1">
            <div className="mb-ui-1 flex items-center gap-ui-2">
              <Clock className="size-icon-sm shrink-0 text-muted-foreground" />
              <span className="text-ui-sm font-semibold">{time}</span>
              <span className={`rounded-ui-full px-ui-2 py-ui-1 text-ui-xs font-medium text-white ${cfg.dotClass}`}>
                {cfg.label}
              </span>
            </div>
            <p className="truncate text-ui-sm font-medium">{post.title}</p>
            <p className="truncate text-ui-xs text-muted-foreground">{clientName}</p>
          </div>
          {post.media_urls?.[0] && (
            <img src={post.media_urls[0]} alt="" className="h-12 w-12 rounded object-cover shrink-0" />
          )}
        </div>
        <div className="mt-ui-2 flex gap-ui-1">
          {post.status !== "published" && (
            <Button size="sm" variant="outline" className="h-8 px-ui-2 text-ui-xs" onClick={(e) => { e.stopPropagation(); handleMarkPublished(post); }}>
              <Check className="mr-ui-1 size-icon-xs" /> Publicado
            </Button>
          )}
          {post.status === "approved" && (
            <Button size="sm" variant="outline" className="h-8 px-ui-2 text-ui-xs" onClick={(e) => { e.stopPropagation(); handleSchedule(post); }}>
              Agendar
            </Button>
          )}
        </div>
      </div>
    );
  };

  // --- MONTH VIEW ---
  const MonthView = () => {
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: ms, end: me });
    const startPad = getDay(ms);

    return (
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-muted px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="bg-card min-h-[110px]" />
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDate[key] || [];
          const today = isToday(day);
          const commDates = getDatesByMonthDay(day.getMonth() + 1, day.getDate());
          return (
            <div
              key={key}
              className={`bg-card min-h-[110px] p-1.5 cursor-pointer hover:bg-muted/30 transition-colors ${today ? "ring-2 ring-inset ring-primary/40" : ""}`}
              onClick={() => { setCurrentDate(day); setViewMode("day"); }}
            >
              <div className={`text-xs font-medium mb-1 flex items-center justify-between ${today ? "text-primary font-bold" : "text-muted-foreground"}`}>
                <span className={today ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-[11px]" : ""}>
                  {format(day, "d")}
                </span>
                {dayPosts.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{dayPosts.length}</span>
                )}
              </div>
              {/* Commemorative dates */}
              {commDates.length > 0 && (
                <div className="space-y-0.5 mb-0.5">
                  {commDates.slice(0, 2).map((cd) => (
                    <Popover key={cd.id}>
                      <PopoverTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight truncate flex items-center gap-1 hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: cd.country_color + "20", color: cd.country_color }}
                        >
                          <CalendarHeart className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate font-medium">{cd.name}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-1.5">
                          <p className="font-semibold text-sm">{cd.name}</p>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-flex items-center text-[10px] font-semibold rounded-full px-2 py-0.5 text-white"
                              style={{ backgroundColor: cd.country_color }}
                            >
                              {cd.country}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {CATEGORY_LABELS[cd.category] || cd.category}
                            </span>
                          </div>
                          {cd.description && (
                            <p className="text-xs text-muted-foreground">{cd.description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            {cd.date_day}/{cd.date_month}
                          </p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ))}
                  {commDates.length > 2 && (
                    <p className="text-[9px] text-muted-foreground text-center">+{commDates.length - 2}</p>
                  )}
                </div>
              )}
              <div className="space-y-0.5">
                {dayPosts.slice(0, 3).map((p) => (
                  <PostBlock key={p.id} post={p} compact />
                ))}
                {dayPosts.length > 3 && (
                  <p className="text-[10px] text-muted-foreground text-center">+{dayPosts.length - 3}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- WEEK VIEW ---
  const WeekView = () => {
    const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-muted">
          <div className="p-2" />
          {weekDays.map((d) => (
            <div
              key={d.toISOString()}
              className={`p-2 text-center border-l cursor-pointer hover:bg-muted/80 ${isToday(d) ? "bg-primary/10" : ""}`}
              onClick={() => { setCurrentDate(d); setViewMode("day"); }}
            >
              <p className="text-xs text-muted-foreground">{format(d, "EEE", { locale: ptBR })}</p>
              <p className={`text-lg font-semibold ${isToday(d) ? "text-primary" : ""}`}>{format(d, "d")}</p>
            </div>
          ))}
        </div>
        {/* Time grid */}
        <div className="max-h-[600px] overflow-y-auto">
          {HOURS.map((h) => (
            <div key={h} className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[48px]">
              <div className="text-[11px] text-muted-foreground text-right pr-2 pt-1 border-t">
                {String(h).padStart(2, "0")}:00
              </div>
              {weekDays.map((d) => {
                const key = format(d, "yyyy-MM-dd");
                const hourPosts = (postsByDate[key] || []).filter((p) => {
                  const pHour = parseInt(p.publish_time?.split(":")[0] || "0", 10);
                  return pHour === h;
                });
                return (
                  <div
                    key={`${key}-${h}`}
                    className="border-l border-t p-0.5 hover:bg-muted/20 cursor-pointer"
                    onClick={() => openCreate(key)}
                  >
                    {hourPosts.map((p) => (
                      <PostBlock key={p.id} post={p} compact />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // --- DAY VIEW ---
  const DayView = () => {
    const key = format(currentDate, "yyyy-MM-dd");
    const dayPosts = postsByDate[key] || [];
    const sortedPosts = [...dayPosts].sort((a, b) => (a.publish_time || "").localeCompare(b.publish_time || ""));
    const commDates = getDatesByMonthDay(currentDate.getMonth() + 1, currentDate.getDate());

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold capitalize">
            {format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h3>
          <Button size="sm" onClick={() => openCreate(key)}>
            <Plus className="mr-1 h-4 w-4" /> Novo Post
          </Button>
        </div>

        {/* Commemorative dates for this day */}
        {commDates.length > 0 && (
          <div className="space-y-1.5">
            {commDates.map((cd) => (
              <div
                key={cd.id}
                className="flex items-center gap-3 rounded-lg border p-3"
                style={{ borderLeftWidth: 4, borderLeftColor: cd.country_color }}
              >
                <CalendarHeart className="h-4 w-4 shrink-0" style={{ color: cd.country_color }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{cd.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-[10px] font-semibold rounded-full px-2 py-0.5 text-white"
                      style={{ backgroundColor: cd.country_color }}
                    >
                      {cd.country}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {CATEGORY_LABELS[cd.category] || cd.category}
                    </span>
                  </div>
                  {cd.description && (
                    <p className="text-xs text-muted-foreground mt-1">{cd.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {sortedPosts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum post neste dia</p>
            <Button variant="outline" className="mt-3" onClick={() => openCreate(key)}>
              <Plus className="mr-1 h-4 w-4" /> Criar post
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedPosts.map((p) => (
              <PostBlock key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // --- DETAIL PANEL (side sheet) ---
  const DetailPanel = () => {
    if (!detailPost) return null;
    const cfg = STATUS_CONFIG[detailPost.status];
    const clientName = detailPost.clients?.name || clients.find((c) => c.id === detailPost.client_id)?.name || "";

    return (
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Detalhes do Post</h3>
          <Button variant="ghost" size="icon" onClick={() => setDetailPost(null)}>
            <ChevronRight className="h-4 w-4 text-primary-foreground" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {detailPost.media_urls?.[0] && (
            <div className="rounded-lg overflow-hidden border">
              {detailPost.media_type === "video" ? (
                <video src={detailPost.media_urls[0]} controls className="w-full" />
              ) : (
                <img src={detailPost.media_urls[0]} alt="" className="w-full object-cover max-h-60" />
              )}
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Título</p>
            <p className="font-semibold text-lg">{detailPost.title}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="font-medium">{clientName}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Data</p>
              <p className="font-medium">{format(new Date(detailPost.publish_date + "T12:00:00"), "dd/MM/yyyy")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Horário</p>
              <p className="font-medium">{detailPost.publish_time?.slice(0, 5)}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${cfg.bgClass}`}>
              <span className={`h-2 w-2 rounded-full ${cfg.dotClass}`} />
              {cfg.label}
            </span>
          </div>
          {detailPost.caption && (
            <div>
              <p className="text-xs text-muted-foreground">Legenda</p>
              <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg mt-1">{detailPost.caption}</p>
            </div>
          )}
          {detailPost.media_urls?.length > 1 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Mais mídias</p>
              <div className="flex gap-2 flex-wrap">
                {detailPost.media_urls.slice(1).map((url, i) => (
                  <img key={i} src={url} alt="" className="h-16 w-16 rounded object-cover border" />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => { openEdit(detailPost); setDetailPost(null); }}>
            Editar
          </Button>
          {detailPost.status !== "published" && (
            <Button className="flex-1" onClick={() => { handleMarkPublished(detailPost); setDetailPost(null); }}>
              <Check className="mr-1 h-4 w-4" /> Publicado
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="border-b bg-card px-3 py-2.5 md:px-4 md:py-3 sticky top-0 z-40">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 md:gap-3">
            <MobileNav title="Calendário" />
            <Button variant="ghost" size="icon" className="hidden md:inline-flex group bg-white hover:bg-foreground shadow-md border border-border/40 transition-colors" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5 text-black group-hover:text-white transition-colors" strokeWidth={2.5} />
            </Button>
            <CalendarDays className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
            <h1 className="text-sm md:text-lg font-bold text-foreground truncate">Calendário</h1>
          </div>

          <div className="flex items-center gap-1 md:gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="text-xs h-7 md:h-8" onClick={goToToday}>Hoje</Button>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7 md:h-8 md:w-8 bg-card hover:bg-accent border-border" onClick={() => navigate_date("prev")} aria-label="Anterior"><ChevronLeft className="h-4 w-4 text-foreground" /></Button>
              <span className="text-xs md:text-sm font-semibold capitalize text-center min-w-[120px] md:min-w-[160px]">{headerLabel}</span>
              <Button variant="outline" size="icon" className="h-7 w-7 md:h-8 md:w-8 bg-card hover:bg-accent border-border" onClick={() => navigate_date("next")} aria-label="Próximo"><ChevronRight className="h-4 w-4 text-foreground" /></Button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex bg-muted rounded-lg p-0.5">
              {([
                { mode: "month" as ViewMode, icon: LayoutGrid, label: "Mês" },
                { mode: "week" as ViewMode, icon: Columns3, label: "Sem" },
                { mode: "day" as ViewMode, icon: List, label: "Dia" },
              ]).map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 text-[11px] md:text-xs font-medium rounded-md transition-colors ${viewMode === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-3 w-3 md:h-3.5 md:w-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Filters - hidden on very small screens, shown on sm+ */}
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-[100px] md:w-[160px] h-7 md:h-8 text-[11px] md:text-xs">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="hidden sm:flex w-[140px] h-7 md:h-8 text-[11px] md:text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {(Object.keys(STATUS_CONFIG) as CalendarPostStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${STATUS_CONFIG[s].dotClass}`} />
                      {STATUS_CONFIG[s].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button size="sm" className="h-7 md:h-8 text-xs" onClick={() => openCreate()}>
              <Plus className="h-4 w-4 md:mr-1" /> <span className="hidden md:inline">Novo</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl p-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {viewMode === "month" && <MonthView />}
            {viewMode === "week" && <WeekView />}
            {viewMode === "day" && <DayView />}
          </>
        )}
      </main>

      {/* Detail panel overlay */}
      {detailPost && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDetailPost(null)} />
      )}
      <DetailPanel />

      {/* Create/Edit Dialog */}
      <CalendarPostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        post={editingPost}
        onSave={handleSave}
        onDelete={deletePost}
        defaultDate={defaultDate}
      />
    </div>
  );
}
