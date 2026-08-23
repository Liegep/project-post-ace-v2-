import { useMemo, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Facebook, Instagram, FileText, CalendarClock, X, Columns3, LayoutGrid, List } from "lucide-react";
import type { SocialPost } from "@/hooks/useSocialPosts";
import { getClientColor } from "@/lib/clientColors";
import { useClientColors } from "@/hooks/useClientColors";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClientLegend {
  id: string;
  name: string;
}

export interface ScheduledKanbanPost {
  id: string;
  title: string;
  client_name: string;
  client_id: string;
  deadline: string;
  preview_url?: string | null;
  preview_text?: string | null;
}

type ViewMode = "month" | "week" | "day";

type SelectedItem =
  | { type: "social"; post: SocialPost }
  | { type: "kanban"; post: ScheduledKanbanPost };

type CalendarEntry =
  | {
      id: string;
      type: "social";
      date: Date;
      clientId: string;
      clientName: string;
      title: string;
      previewUrl: string | null;
      previewText: string | null;
      source: SocialPost;
    }
  | {
      id: string;
      type: "kanban";
      date: Date;
      clientId: string;
      clientName: string;
      title: string;
      previewUrl: string | null;
      previewText: string | null;
      source: ScheduledKanbanPost;
    };

interface SocialCalendarProps {
  posts: SocialPost[];
  scheduledPosts?: ScheduledKanbanPost[];
  onPostClick: (post: SocialPost) => void;
  onReschedule?: (post: SocialPost, newDate: Date) => void;
  onRescheduleKanban?: (postId: string, newDate: Date) => void;
}

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const VIEW_OPTIONS: Array<{ value: ViewMode; label: string; icon: typeof LayoutGrid }> = [
  { value: "month", label: "Mês", icon: LayoutGrid },
  { value: "week", label: "Semana", icon: Columns3 },
  { value: "day", label: "Dia", icon: List },
];

const SOCIAL_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  pending_approval: "Pendente",
  approved: "Aprovado",
  scheduled: "Agendado",
  publishing: "Publicando",
  published: "Publicado",
  error: "Erro",
  cancelled: "Cancelado",
};

function formatEntryTime(entry: CalendarEntry) {
  const hasExplicitTime = entry.date.getHours() !== 0 || entry.date.getMinutes() !== 0;
  if (!hasExplicitTime) return "";
  return format(entry.date, "HH:mm");
}

function getSelectedItemId(item: SelectedItem | null) {
  if (!item) return "";
  return `${item.type}:${item.post.id}`;
}

export function SocialCalendar({ posts, scheduledPosts = [], onPostClick, onReschedule, onRescheduleKanban }: SocialCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { colors: clientColorOverrides, setColor: setClientColor } = useClientColors();

  const canReschedule = Boolean(onReschedule || onRescheduleKanban);

  const entries = useMemo<CalendarEntry[]>(() => {
    const socialEntries: CalendarEntry[] = posts.map((post) => {
      const date = new Date(post.scheduled_at || post.created_at);
      return {
        id: `social:${post.id}`,
        type: "social",
        date,
        clientId: post.client_id,
        clientName: post.clients?.name || "—",
        title: post.caption?.trim() || "Sem legenda",
        previewUrl: post.media_urls?.[0] || null,
        previewText: post.caption || null,
        source: post,
      };
    });

    const kanbanEntries: CalendarEntry[] = scheduledPosts.map((post) => ({
      id: `kanban:${post.id}`,
      type: "kanban",
      date: new Date(post.deadline),
      clientId: post.client_id,
      clientName: post.client_name || "—",
      title: post.title || "Post sem título",
      previewUrl: post.preview_url || null,
      previewText: post.preview_text || null,
      source: post,
    }));

    return [...socialEntries, ...kanbanEntries].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [posts, scheduledPosts]);

  const entriesByDay = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {};
    entries.forEach((entry) => {
      const key = format(entry.date, "yyyy-MM-dd");
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(entry);
    });
    return map;
  }, [entries]);

  const clientsLegend = useMemo<ClientLegend[]>(() => {
    const map = new Map<string, string>();
    entries.forEach((entry) => {
      if (entry.clientId && entry.clientName) {
        map.set(entry.clientId, entry.clientName);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  const visibleDays = useMemo(() => {
    if (viewMode === "day") {
      return [currentDate];
    }

    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = addDays(start, 6);
      return eachDayOfInterval({ start, end });
    }

    const monthStart = startOfMonth(currentDate);
    const start = startOfWeek(monthStart, { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate, viewMode]);

  const headerLabel = useMemo(() => {
    if (viewMode === "month") {
      return format(currentDate, "MMMM yyyy", { locale: ptBR });
    }

    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = addDays(start, 6);
      return `${format(start, "d MMM", { locale: ptBR })} - ${format(end, "d MMM yyyy", { locale: ptBR })}`;
    }

    return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR });
  }, [currentDate, viewMode]);

  const selectedItemId = getSelectedItemId(selectedItem);

  const getSelectedDate = () => {
    if (!selectedItem) return "";
    return selectedItem.type === "social"
      ? selectedItem.post.scheduled_at || selectedItem.post.created_at
      : selectedItem.post.deadline;
  };

  const getSelectedLabel = () => {
    if (!selectedItem) return "";
    return selectedItem.type === "social"
      ? selectedItem.post.caption?.slice(0, 30) || "Post"
      : selectedItem.post.title || "Post";
  };

  const cancelSelection = () => {
    setSelectedItem(null);
    setTargetDate(null);
    setConfirmOpen(false);
  };

  const confirmReschedule = () => {
    if (!selectedItem || !targetDate) return;

    if (selectedItem.type === "social" && onReschedule) {
      onReschedule(selectedItem.post, targetDate);
    }

    if (selectedItem.type === "kanban" && onRescheduleKanban) {
      onRescheduleKanban(selectedItem.post.id, targetDate);
    }

    cancelSelection();
  };

  const handleDayAction = (day: Date) => {
    if (selectedItem && canReschedule) {
      const originalDate = new Date(getSelectedDate());
      if (isSameDay(originalDate, day)) return;
      setTargetDate(day);
      setConfirmOpen(true);
      return;
    }

    if (viewMode === "month") {
      setCurrentDate(day);
      setViewMode("day");
    }
  };

  const handleEntryClick = (entry: CalendarEntry, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!canReschedule) {
      if (entry.type === "social") {
        onPostClick(entry.source);
      }
      return;
    }

    const nextItem: SelectedItem =
      entry.type === "social"
        ? { type: "social", post: entry.source }
        : { type: "kanban", post: entry.source };

    if (selectedItemId === entry.id) {
      cancelSelection();
      return;
    }

    setSelectedItem(nextItem);
  };

  const handleEntryDoubleClick = (entry: CalendarEntry) => {
    if (entry.type === "social") {
      onPostClick(entry.source);
    }
  };

  const navigateRange = (direction: "prev" | "next") => {
    if (viewMode === "month") {
      setCurrentDate((prev) => (direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)));
      return;
    }

    if (viewMode === "week") {
      setCurrentDate((prev) => (direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1)));
      return;
    }

    setCurrentDate((prev) => (direction === "prev" ? subDays(prev, 1) : addDays(prev, 1)));
  };

  const renderEntry = (entry: CalendarEntry, compact = false) => {
    const color = getClientColor(entry.clientId, clientColorOverrides[entry.clientId] ?? null);
    const timeLabel = formatEntryTime(entry);
    const isSelected = selectedItemId === entry.id;
    const isPublished = entry.type === "social" && entry.source.status === "published";

    return (
      <Tooltip key={entry.id}>
        <TooltipTrigger asChild>
          <button
            onClick={(event) => handleEntryClick(entry, event)}
            onDoubleClick={() => handleEntryDoubleClick(entry)}
            className={`w-full rounded-xl border px-2 py-1.5 text-left transition-all ${
              compact ? "text-[11px]" : "text-xs"
            } ${isSelected ? "ring-2 ring-primary/60" : ""}`}
            style={
              isSelected
                ? { background: "hsl(var(--primary) / 0.12)", borderColor: "hsl(var(--primary) / 0.45)", color: "hsl(var(--primary))" }
                : isPublished
                ? { background: "hsl(var(--success) / 0.16)", borderColor: "hsl(var(--success) / 0.28)", color: "hsl(var(--success))" }
                : { background: color.bg, borderColor: color.border, color: color.text }
            }
          >
            <div className="flex items-start gap-1.5">
              {entry.type === "social" ? (
                entry.source.platform === "instagram" ? (
                  <Instagram className="mt-0.5 h-3 w-3 shrink-0 text-pink-500" />
                ) : (
                  <Facebook className="mt-0.5 h-3 w-3 shrink-0 text-blue-600" />
                )
              ) : (
                <FileText className="mt-0.5 h-3 w-3 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  {timeLabel ? <span className="font-semibold">{timeLabel}</span> : null}
                  <span className="truncate font-medium">{entry.title}</span>
                </div>
                {!compact ? (
                  <p className="truncate opacity-75">{entry.clientName}</p>
                ) : (
                  <p className="truncate opacity-75">{entry.clientName}</p>
                )}
              </div>
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" align="start" className="w-64 p-3">
          <div className="space-y-2">
            {entry.previewUrl ? (
              <img src={entry.previewUrl} alt="Prévia do post" className="aspect-square w-full rounded-lg object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                Sem imagem
              </div>
            )}
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{entry.title}</p>
              <p className="text-xs text-muted-foreground">{entry.clientName}</p>
              <p className="text-xs text-muted-foreground">
                {format(entry.date, "dd/MM/yyyy")}
                {timeLabel ? ` às ${timeLabel}` : ""}
              </p>
              {entry.type === "social" ? (
                <p className="text-xs text-muted-foreground">
                  {SOCIAL_STATUS_LABELS[entry.source.status] || entry.source.status}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Agendado no kanban</p>
              )}
            </div>
            {entry.previewText ? (
              <p className="line-clamp-3 text-xs text-foreground">{entry.previewText}</p>
            ) : null}
            {canReschedule ? (
              <p className="text-[10px] italic text-muted-foreground">
                Clique para selecionar e mover para outro dia.
              </p>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  const renderMonthView = () => (
    <div className="overflow-hidden rounded-[28px] border border-border/70 bg-card/80 shadow-sm">
      <div className="grid grid-cols-7 border-b border-border/70 bg-muted/40">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="px-3 py-3 text-center text-sm font-semibold text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {visibleDays.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEntries = entriesByDay[key] || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const cellIsToday = isToday(day);

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => handleDayAction(day)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleDayAction(day);
                }
              }}
              className={`min-h-[158px] border-b border-r border-border/60 p-2 text-left align-top transition-colors ${
                isCurrentMonth ? "bg-background/90 hover:bg-muted/30" : "bg-muted/25 text-muted-foreground/60"
              } ${selectedItem ? "cursor-pointer hover:bg-primary/5" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    cellIsToday ? "bg-primary text-primary-foreground" : ""
                  }`}
                >
                  {format(day, "d")}
                </span>
                {dayEntries.length > 0 ? (
                  <span className="text-[11px] font-medium text-muted-foreground">{dayEntries.length}</span>
                ) : null}
              </div>

              <div className="space-y-1.5">
                {dayEntries.slice(0, 4).map((entry) => renderEntry(entry, true))}
                {dayEntries.length > 4 ? (
                  <p className="px-1 text-[11px] font-medium text-muted-foreground">
                    +{dayEntries.length - 4} mais
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderWeekView = () => (
    <div className="overflow-hidden rounded-[28px] border border-border/70 bg-card/80 shadow-sm">
      <div className="grid grid-cols-7 border-b border-border/70 bg-muted/40">
        {visibleDays.map((day) => (
          <button
            key={format(day, "yyyy-MM-dd")}
            type="button"
            onClick={() => {
              setCurrentDate(day);
              setViewMode("day");
            }}
            className="border-r border-border/60 px-3 py-3 text-left last:border-r-0"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {format(day, "EEE", { locale: ptBR })}
            </p>
            <p className={`mt-1 text-lg font-bold ${isToday(day) ? "text-primary" : "text-foreground"}`}>
              {format(day, "d")}
            </p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {visibleDays.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEntries = entriesByDay[key] || [];

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => handleDayAction(day)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleDayAction(day);
                }
              }}
              className={`min-h-[430px] border-r border-border/60 p-3 text-left align-top last:border-r-0 ${
                selectedItem ? "cursor-pointer hover:bg-primary/5" : ""
              }`}
            >
              <div className="space-y-2">
                {dayEntries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
                    Nenhum post neste dia
                  </div>
                ) : (
                  dayEntries.map((entry) => renderEntry(entry))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderDayView = () => {
    const day = visibleDays[0];
    const key = format(day, "yyyy-MM-dd");
    const dayEntries = entriesByDay[key] || [];

    return (
      <div className="rounded-[28px] border border-border/70 bg-card/80 p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
            <p className="text-xs text-muted-foreground">
              {dayEntries.length} {dayEntries.length === 1 ? "post agendado" : "posts agendados"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setViewMode("week")}>
            Voltar para semana
          </Button>
        </div>

        {dayEntries.length === 0 ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleDayAction(day)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleDayAction(day);
              }
            }}
            className="rounded-3xl border border-dashed border-border/70 px-6 py-16 text-center text-sm text-muted-foreground"
          >
            Nenhum post neste dia.
          </div>
        ) : (
          <div className="space-y-3">
            {dayEntries.map((entry) => (
              <div key={entry.id} className="rounded-3xl border border-border/60 bg-background/70 p-4">
                {renderEntry(entry)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {selectedItem ? (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-foreground">
            <strong>Reagendar:</strong> escolha um dia para mover{" "}
            <em className="text-primary">"{getSelectedLabel()}"</em>
          </span>
          <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={cancelSelection}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="rounded-[30px] border border-border/70 bg-card/85 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateRange("prev")} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[190px] px-2 text-center text-lg font-semibold capitalize text-foreground">
              {headerLabel}
            </div>
            <Button variant="outline" size="icon" onClick={() => navigateRange("next")} aria-label="Próximo">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-2xl bg-muted p-1">
              {VIEW_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setViewMode(option.value)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      viewMode === option.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {clientsLegend.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {clientsLegend.map((client) => {
            const override = clientColorOverrides[client.id] ?? null;
            const color = getClientColor(client.id, override);

            return (
              <Popover key={client.id}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90"
                    style={{ background: color.bg, borderColor: color.border, color: color.text }}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.text }} />
                    {client.name}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 space-y-3 p-3" align="start">
                  <div className="text-xs font-semibold text-foreground">{client.name}</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={override || color.hex}
                      onChange={(event) => setClientColor(client.id, event.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
                      aria-label={`Cor de ${client.name}`}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Personalize a cor deste cliente no calendário.
                    </p>
                  </div>
                  {override ? (
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setClientColor(client.id, null)}>
                      Restaurar cor padrão
                    </Button>
                  ) : null}
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      ) : null}

      {viewMode === "month" ? renderMonthView() : null}
      {viewMode === "week" ? renderWeekView() : null}
      {viewMode === "day" ? renderDayView() : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Reagendar post
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Mover o post para{" "}
              <strong className="text-foreground">
                {targetDate ? format(targetDate, "dd 'de' MMMM", { locale: ptBR }) : ""}
              </strong>
              ?
            </p>
            {selectedItem ? (
              <div className="space-y-1 rounded-2xl border bg-muted/50 p-3">
                <div className="flex items-center gap-2">
                  {selectedItem.type === "social" ? (
                    selectedItem.post.platform === "instagram" ? (
                      <Instagram className="h-4 w-4 text-pink-500" />
                    ) : (
                      <Facebook className="h-4 w-4 text-blue-600" />
                    )
                  ) : (
                    <FileText className="h-4 w-4 text-primary" />
                  )}
                  <span className="truncate text-sm font-medium text-foreground">
                    {selectedItem.type === "social"
                      ? selectedItem.post.caption?.slice(0, 50) || "Sem legenda"
                      : selectedItem.post.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Atualmente em: {format(new Date(getSelectedDate()), "dd/MM/yyyy")}
                </p>
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelSelection}>Cancelar</Button>
            <Button onClick={confirmReschedule}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
