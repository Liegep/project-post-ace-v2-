import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n/I18nContext";
import { useAppointments, Appointment, AppointmentTag } from "@/hooks/useAppointments";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LanguageSelector } from "@/components/LanguageSelector";
import UserProfileMenu from "@/components/UserProfileMenu";
import { MobileNav } from "@/components/MobileNav";
import {
  Plus, ChevronLeft, ChevronRight, CalendarIcon, Check, Clock,
  Trash2, ArrowLeft, CalendarDays, CalendarRange, Calendar as CalendarLucide, XCircle, Ban, Tag, X
} from "lucide-react";
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, addMonths, subMonths, addWeeks, subWeeks, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { toast } from "@/hooks/use-toast";

type RepeatMode = "none" | "daily" | "weekly" | "weekdays" | "custom_days";
type ViewMode = "day" | "week" | "month";

const CATEGORY_COLORS: Record<string, string> = {
  "": "bg-primary/10 text-primary",
  reunião: "bg-info/20 text-info",
  tarefa: "bg-accent/20 text-accent-foreground",
  pessoal: "bg-purple-500/20 text-purple-600",
  urgente: "bg-destructive/20 text-destructive",
  "último post": "bg-blue-600/20 text-blue-600",
};

const getCategoryStyle = (cat: string) => CATEGORY_COLORS[cat.toLowerCase()] || CATEGORY_COLORS[""];

const AgendaPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { appointments, tags, loading, createAppointment, createBatch, toggleComplete, toggleCancelled, deleteAppointment, updateAppointment, createTag, deleteTag } = useAppointments();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const appointmentId = String(active.id);
    const newDate = String(over.id);
    const apt = appointments.find(a => a.id === appointmentId);
    if (!apt || apt.appointmentDate === newDate) return;
    await updateAppointment(appointmentId, { appointmentDate: newDate });
  };

  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [formTime, setFormTime] = useState("09:00");
  const [formCategory, setFormCategory] = useState("");
  const [formTagId, setFormTagId] = useState<string | null>(null);
  const [formRepeat, setFormRepeat] = useState<RepeatMode>("none");
  const [formRepeatEnd, setFormRepeatEnd] = useState<Date | undefined>(undefined);
  const [formRepeatEndOpen, setFormRepeatEndOpen] = useState(false);
  const [formCustomDays, setFormCustomDays] = useState<number[]>([]); // 0=Sun...6=Sat
  const [saving, setSaving] = useState(false);

  const navigateDate = (dir: number) => {
    if (viewMode === "day") setCurrentDate(prev => dir > 0 ? addDays(prev, 1) : subDays(prev, 1));
    else if (viewMode === "week") setCurrentDate(prev => dir > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1));
    else setCurrentDate(prev => dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  const getDateRange = (): { start: Date; end: Date } => {
    if (viewMode === "day") return { start: currentDate, end: currentDate };
    if (viewMode === "week") return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
  };

  const filteredAppointments = useMemo(() => {
    const { start, end } = getDateRange();
    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(end, "yyyy-MM-dd");
    return appointments.filter(a => a.appointmentDate >= startStr && a.appointmentDate <= endStr);
  }, [appointments, currentDate, viewMode]);

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    filteredAppointments.forEach(a => {
      if (!map[a.appointmentDate]) map[a.appointmentDate] = [];
      map[a.appointmentDate].push(a);
    });
    // Sort each day by time
    Object.values(map).forEach(arr => arr.sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime)));
    return map;
  }, [filteredAppointments]);

  const handleCreate = async () => {
    if (!formTitle.trim()) return;
    setSaving(true);

    const baseInput = {
      title: formTitle.trim(),
      description: formDesc.trim(),
      appointmentTime: formTime,
      category: formCategory,
      tagId: formTagId,
    };

    if (formRepeat === "none") {
      await createAppointment({
        ...baseInput,
        appointmentDate: format(formDate, "yyyy-MM-dd"),
      });
    } else {
      // Build date list based on repeat mode
      const endDate = formRepeatEnd || addDays(formDate, 30); // default 30 days if no end set
      const allDays = eachDayOfInterval({ start: formDate, end: endDate });

      let dates: Date[] = [];
      if (formRepeat === "daily") {
        dates = allDays;
      } else if (formRepeat === "weekly") {
        // Same weekday as formDate
        const targetDay = formDate.getDay();
        dates = allDays.filter(d => d.getDay() === targetDay);
      } else if (formRepeat === "weekdays") {
        dates = allDays.filter(d => d.getDay() >= 1 && d.getDay() <= 5);
      } else if (formRepeat === "custom_days") {
        dates = allDays.filter(d => formCustomDays.includes(d.getDay()));
      }

      if (dates.length === 0) dates = [formDate];

      const inputs = dates.map(d => ({
        ...baseInput,
        appointmentDate: format(d, "yyyy-MM-dd"),
      }));

      await createBatch(inputs);
    }

    setSaving(false);
    setDialogOpen(false);
    setFormTitle("");
    setFormDesc("");
    setFormDate(new Date());
    setFormTime("09:00");
    setFormCategory("");
    setFormTagId(null);
    setFormRepeat("none");
    setFormRepeatEnd(undefined);
    setFormCustomDays([]);
  };

  const openCreateForDate = (date?: Date) => {
    setFormDate(date || currentDate);
    setFormTitle("");
    setFormDesc("");
    setFormTime("09:00");
    setFormCategory("");
    setFormTagId(null);
    setFormRepeat("none");
    setFormRepeatEnd(undefined);
    setFormCustomDays([]);
    setDialogOpen(true);
  };

  const headerTitle = () => {
    if (viewMode === "day") return format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (viewMode === "week") {
      const { start, end } = getDateRange();
      return `${format(start, "dd MMM", { locale: ptBR })} — ${format(end, "dd MMM yyyy", { locale: ptBR })}`;
    }
    return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
  };

  const pendingCount = filteredAppointments.filter(a => !a.completed && !a.cancelled).length;
  const completedCount = filteredAppointments.filter(a => a.completed).length;
  const cancelledCount = filteredAppointments.filter(a => a.cancelled).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-header px-4 sm:px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <MobileNav title="Agenda" />
            <Button variant="ghost" size="icon" className="group bg-white hover:bg-foreground shadow-md border border-border/40 transition-colors" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5 text-black group-hover:text-white transition-colors" strokeWidth={2.5} />
            </Button>
            <div>
              <h1 className="type-heading text-foreground">Agenda</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Seus compromissos e tarefas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <UserProfileMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 sm:p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday} className="font-medium">
              Hoje
            </Button>
            <div className="flex items-center rounded-lg border bg-card">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:text-black" onClick={() => navigateDate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-sm font-medium text-foreground capitalize min-w-0 truncate max-w-[260px]">
                {headerTitle()}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:text-black" onClick={() => navigateDate(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggles */}
            <div className="flex rounded-lg border bg-card p-0.5">
              {([
                { mode: "day" as ViewMode, icon: CalendarDays, label: "Dia" },
                { mode: "week" as ViewMode, icon: CalendarRange, label: "Semana" },
                { mode: "month" as ViewMode, icon: CalendarLucide, label: "Mês" },
              ]).map(({ mode, icon: Icon, label }) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? "default" : "ghost"}
                  size="sm"
                  className={cn("h-8 gap-1.5 text-xs", viewMode === mode && "bg-primary text-primary-foreground")}
                  onClick={() => setViewMode(mode)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </Button>
              ))}
            </div>

            {/* Stats */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs">
              <Badge variant="outline" className="gap-1 bg-warning/10 text-warning-foreground border-warning/30">
                <Clock className="h-3 w-3" /> {pendingCount}
              </Badge>
              <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/30">
                <Check className="h-3 w-3" /> {completedCount}
              </Badge>
              <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/30">
                <Ban className="h-3 w-3" /> {cancelledCount}
              </Badge>
            </div>

            <Button variant="outline" size="sm" onClick={() => setTagDialogOpen(true)} className="gap-1.5">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Etiquetas</span>
            </Button>

            <Button onClick={() => openCreateForDate()} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo compromisso</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : viewMode === "month" ? (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <MonthView
              currentDate={currentDate}
              appointmentsByDate={appointmentsByDate}
              tags={tags}
              onDayClick={(d) => openCreateForDate(d)}
              onShowMore={(d) => { setCurrentDate(d); setViewMode("day"); }}
              onCreateClick={(d) => openCreateForDate(d)}
              onToggle={toggleComplete}
              onCancel={toggleCancelled}
              onDelete={deleteAppointment}
            />
          </DndContext>
        ) : viewMode === "week" ? (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <DayListView
              dates={eachDayOfInterval({ start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) })}
              appointmentsByDate={appointmentsByDate}
              tags={tags}
              onToggle={toggleComplete}
              onCancel={toggleCancelled}
              onDelete={deleteAppointment}
              onCreateClick={(d) => openCreateForDate(d)}
              draggable
            />
          </DndContext>
        ) : (
          <DayListView
            dates={[currentDate]}
            appointmentsByDate={appointmentsByDate}
            tags={tags}
            onToggle={toggleComplete}
            onCancel={toggleCancelled}
            onDelete={deleteAppointment}
            onCreateClick={(d) => openCreateForDate(d)}
          />
        )}
      </main>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo compromisso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-primary-foreground">
            <Input
              placeholder="Título do compromisso"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              autoFocus
            />
            <Textarea
              placeholder="Descrição (opcional)"
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              className="resize-none min-h-[60px]"
            />
            <div className="grid grid-cols-2 gap-3 text-primary-foreground">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formDate}
                    onSelect={(d) => { if (d) { setFormDate(d); setCalendarOpen(false); } }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={formTime}
                onChange={e => setFormTime(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["", "reunião", "tarefa", "pessoal", "urgente", "último post"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setFormCategory(cat)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium border transition-all",
                    formCategory === cat
                      ? "ring-2 ring-primary ring-offset-1 " + getCategoryStyle(cat)
                      : "bg-muted/50 hover:bg-muted text-black"
                  )}
                >
                  {cat || "Geral"}
                </button>
              ))}
            </div>
            {/* Tag selector */}
            {tags.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Etiqueta</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setFormTagId(null)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium border transition-all",
                      formTagId === null
                        ? "ring-2 ring-primary ring-offset-1 bg-muted text-primary"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Nenhuma
                  </button>
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => setFormTagId(tag.id)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium border transition-all",
                        formTagId === tag.id ? "ring-2 ring-offset-1" : "opacity-70 hover:opacity-100"
                      )}
                      style={{
                        backgroundColor: tag.color + "30",
                        color: tag.color,
                        borderColor: tag.color + "60",
                        ...(formTagId === tag.id ? { ringColor: tag.color } : {}),
                      }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Repeat options */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Repetir</span>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { mode: "none" as RepeatMode, label: "Não repetir" },
                  { mode: "daily" as RepeatMode, label: "Todo dia" },
                  { mode: "weekly" as RepeatMode, label: "Semanal" },
                  { mode: "weekdays" as RepeatMode, label: "Seg-Sex" },
                  { mode: "custom_days" as RepeatMode, label: "Dias específicos" },
                ]).map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => setFormRepeat(mode)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium border transition-all",
                      formRepeat === mode
                        ? "ring-2 ring-primary ring-offset-1 bg-primary/10 text-primary"
                        : "bg-muted/50 hover:bg-muted text-black"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Custom days selector */}
              {formRepeat === "custom_days" && (
                <div className="flex flex-wrap gap-1">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day, i) => (
                    <button
                      key={i}
                      onClick={() => setFormCustomDays(prev =>
                        prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                      )}
                      className={cn(
                        "rounded-full w-9 h-7 text-[10px] font-medium border transition-all",
                        formCustomDays.includes(i)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted border-border"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              )}

              {/* End date picker */}
              {formRepeat !== "none" && (
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Repetir até:</span>
                  <Popover open={formRepeatEndOpen} onOpenChange={setFormRepeatEndOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal text-xs h-8">
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {formRepeatEnd ? format(formRepeatEnd, "dd/MM/yyyy") : "Escolher data final"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formRepeatEnd}
                        onSelect={(d) => { if (d) { setFormRepeatEnd(d); setFormRepeatEndOpen(false); } }}
                        disabled={(d) => isBefore(d, formDate)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {formRepeat !== "none" && (
                <p className="text-[11px] text-muted-foreground">
                  {(() => {
                    const endDate = formRepeatEnd || addDays(formDate, 30);
                    const allDays = eachDayOfInterval({ start: formDate, end: endDate });
                    let count = 0;
                    if (formRepeat === "daily") count = allDays.length;
                    else if (formRepeat === "weekly") count = allDays.filter(d => d.getDay() === formDate.getDay()).length;
                    else if (formRepeat === "weekdays") count = allDays.filter(d => d.getDay() >= 1 && d.getDay() <= 5).length;
                    else if (formRepeat === "custom_days") count = allDays.filter(d => formCustomDays.includes(d.getDay())).length;
                    return `${count} compromisso${count !== 1 ? "s" : ""} serão criados (${format(formDate, "dd/MM")} → ${format(endDate, "dd/MM")})`;
                  })()}
                </p>
              )}
            </div>
            <Button onClick={handleCreate} disabled={saving || !formTitle.trim()} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              {saving ? "Salvando..." : formRepeat !== "none" ? "Criar compromissos" : "Criar compromisso"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tag Manager Dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Gerenciar Etiquetas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex gap-2">
              <Input
                placeholder="Nome da etiqueta"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                className="flex-1"
              />
              <input
                type="color"
                value={newTagColor}
                onChange={e => setNewTagColor(e.target.value)}
                className="h-10 w-10 rounded border cursor-pointer"
              />
              <Button
                size="sm"
                disabled={!newTagName.trim()}
                onClick={async () => {
                  await createTag(newTagName.trim(), newTagColor);
                  setNewTagName("");
                  setNewTagColor("#3b82f6");
                }}
                className="bg-accent text-accent-foreground"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma etiqueta criada ainda.</p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {tags.map(tag => (
                  <div key={tag.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: tag.color + "20" }}>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="text-sm font-medium" style={{ color: tag.color }}>{tag.name}</span>
                    </div>
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="rounded-full p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Day/Week List View ──────────────────────────────────────────────────────────

interface DayListViewProps {
  dates: Date[];
  appointmentsByDate: Record<string, Appointment[]>;
  tags: AppointmentTag[];
  onToggle: (id: string, completed: boolean) => void;
  onCancel: (id: string, cancelled: boolean) => void;
  onDelete: (id: string) => void;
  onCreateClick: (date: Date) => void;
  draggable?: boolean;
}

const DroppableDay = ({ dateStr, children, enabled }: { dateStr: string; children: React.ReactNode; enabled: boolean }) => {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr, disabled: !enabled });
  return (
    <div ref={enabled ? setNodeRef : undefined} className={cn("rounded-xl transition-shadow", isOver && "ring-2 ring-primary ring-offset-2")}>
      {children}
    </div>
  );
};

const DayListView = ({ dates, appointmentsByDate, tags, onToggle, onCancel, onDelete, onCreateClick, draggable = false }: DayListViewProps) => {
  return (
    <div className="space-y-4">
      {dates.map(date => {
        const dateStr = format(date, "yyyy-MM-dd");
        const dayAppointments = appointmentsByDate[dateStr] || [];
        const today = isToday(date);

        return (
          <DroppableDay key={dateStr} dateStr={dateStr} enabled={draggable}>
            <div className={cn("rounded-xl border transition-colors", today ? "border-accent/50 bg-amber-50/80 dark:bg-amber-950/20" : "bg-white dark:bg-card")}>
              {/* Day header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex flex-col items-center justify-center h-12 w-12 rounded-xl font-bold",
                    today ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <span className="text-lg leading-none">{format(date, "dd")}</span>
                    <span className="text-[10px] uppercase leading-none mt-0.5">{format(date, "EEE", { locale: ptBR })}</span>
                  </div>
                  {today && <Badge className="bg-accent text-accent-foreground text-[10px]">HOJE</Badge>}
                  {dates.length > 1 && (
                    <span className="text-sm text-muted-foreground capitalize">{format(date, "EEEE", { locale: ptBR })}</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onCreateClick(date)}
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>

              {/* Appointments */}
              <div className="p-2">
                {dayAppointments.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum compromisso para este dia
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {dayAppointments.map(apt => (
                      <AppointmentCard key={apt.id} appointment={apt} tags={tags} onToggle={onToggle} onCancel={onCancel} onDelete={onDelete} draggable={draggable} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DroppableDay>
        );
      })}
    </div>
  );
};

// ── Appointment Card ────────────────────────────────────────────────────────────

const AppointmentCard = ({ appointment: apt, tags, onToggle, onCancel, onDelete, draggable = false }: {
  appointment: Appointment;
  tags: AppointmentTag[];
  onToggle: (id: string, completed: boolean) => void;
  onCancel: (id: string, cancelled: boolean) => void;
  onDelete: (id: string) => void;
  draggable?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: apt.id, disabled: !draggable });
  const [detailOpen, setDetailOpen] = useState(false);
  const aptTag = apt.tagId ? tags.find(t => t.id === apt.tagId) : null;
  const now = new Date();
  const aptDateTime = new Date(`${apt.appointmentDate}T${apt.appointmentTime}`);
  const isOverdue = !apt.completed && !apt.cancelled && isBefore(aptDateTime, now);
  const isLastPost = apt.category.toLowerCase() === "último post";

  const rowBg = apt.completed
    ? "bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800"
    : apt.cancelled
      ? "bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800"
      : isLastPost
        ? "bg-blue-100 dark:bg-blue-950/40 border border-blue-400 dark:border-blue-800"
        : isOverdue
          ? "bg-destructive/5 border border-destructive/20"
          : aptTag
            ? "border"
            : "bg-white dark:bg-card hover:bg-muted/50 border border-transparent";

  const tagStyle = (!apt.completed && !apt.cancelled && !isLastPost && !isOverdue && aptTag) ? {
    backgroundColor: aptTag.color + "20",
    borderColor: aptTag.color + "50",
  } : undefined;

  return (
    <>
      <div
        ref={draggable ? setNodeRef : undefined}
        {...(draggable ? attributes : {})}
        {...(draggable ? listeners : {})}
        onClick={() => setDetailOpen(true)}
        className={cn(
          "group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all",
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          isDragging && "opacity-50",
          rowBg
        )}
        style={tagStyle}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(apt.id, !apt.completed); }}
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
            apt.completed
              ? "bg-emerald-500 border-emerald-500 text-white"
              : apt.cancelled
                ? "border-muted-foreground/30"
                : isOverdue
                  ? "border-destructive hover:bg-destructive/10"
                  : "border-muted-foreground/40 hover:border-primary hover:bg-primary/10"
          )}
        >
          {apt.completed && <Check className="h-3 w-3" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-medium",
              apt.completed ? "line-through text-emerald-700 dark:text-emerald-400" : apt.cancelled ? "line-through text-red-500 dark:text-red-400" : "text-foreground"
            )}>
              {apt.title}
            </span>
            {apt.category && (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", getCategoryStyle(apt.category))}>
                {apt.category}
              </span>
            )}
            {aptTag && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: aptTag.color + "30", color: aptTag.color }}
              >
                {aptTag.name}
              </span>
            )}
            {isOverdue && !apt.completed && !apt.cancelled && (
              <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive bg-destructive/10">
                Atrasado
              </Badge>
            )}
            {apt.completed && (
              <Badge variant="outline" className="text-[10px] border-emerald-400/50 text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">
                Concluído
              </Badge>
            )}
            {apt.cancelled && (
              <Badge variant="outline" className="text-[10px] border-red-400/50 text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400">
                Cancelado
              </Badge>
            )}
          </div>
          {apt.description && (
            <p className={cn("text-xs mt-0.5 line-clamp-1", apt.completed || apt.cancelled ? "text-muted-foreground/60 line-through" : "text-muted-foreground")}>
              {apt.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            "flex items-center gap-1 text-xs font-mono",
            apt.completed ? "text-emerald-600/60 dark:text-emerald-400/60" : apt.cancelled ? "text-red-500/60" : isOverdue ? "text-destructive" : "text-muted-foreground"
          )}>
            <Clock className="h-3 w-3" />
            {apt.appointmentTime}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onCancel(apt.id, !apt.cancelled); }}
            className={cn(
              "rounded-full p-1 transition-all",
              apt.cancelled
                ? "text-red-500 opacity-100"
                : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
            )}
            title={apt.cancelled ? "Desfazer cancelamento" : "Cancelar"}
          >
            <Ban className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(apt.id); }}
            className="opacity-0 group-hover:opacity-100 rounded-full p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {apt.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                <span>{format(new Date(apt.appointmentDate + "T12:00:00"), "dd/MM/yyyy")}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{apt.appointmentTime}</span>
              </div>
              {apt.category && (
                <Badge variant="outline" className={cn("text-xs", getCategoryStyle(apt.category))}>
                  {apt.category}
                </Badge>
              )}
              {aptTag && (
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{ backgroundColor: aptTag.color + "20", color: aptTag.color, borderColor: aptTag.color + "50" }}
                >
                  {aptTag.name}
                </Badge>
              )}
            </div>

            <div className="flex gap-2">
              {apt.completed && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Concluído
                </Badge>
              )}
              {apt.cancelled && (
                <Badge className="bg-red-100 text-red-600 border-red-300 dark:bg-red-900/30 dark:text-red-400">
                  Cancelado
                </Badge>
              )}
              {isOverdue && !apt.completed && !apt.cancelled && (
                <Badge className="bg-destructive/10 text-destructive border-destructive/30">
                  Atrasado
                </Badge>
              )}
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium text-muted-foreground mb-1">Descrição</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {apt.description || "Sem descrição adicional."}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant={apt.completed ? "outline" : "default"}
                className={cn("flex-1 gap-1.5", !apt.completed && "bg-emerald-600 hover:bg-emerald-700 text-white")}
                onClick={() => { onToggle(apt.id, !apt.completed); setDetailOpen(false); }}
              >
                <Check className="h-4 w-4" />
                {apt.completed ? "Desmarcar" : "Concluir"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => { onCancel(apt.id, !apt.cancelled); setDetailOpen(false); }}
              >
                <Ban className="h-4 w-4" />
                {apt.cancelled ? "Reativar" : "Cancelar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ── Month View ──────────────────────────────────────────────────────────────────

interface MonthViewProps {
  currentDate: Date;
  appointmentsByDate: Record<string, Appointment[]>;
  tags: AppointmentTag[];
  onDayClick: (date: Date) => void;
  onShowMore: (date: Date) => void;
  onCreateClick: (date: Date) => void;
  onToggle: (id: string, completed: boolean) => void;
  onCancel: (id: string, cancelled: boolean) => void;
  onDelete: (id: string) => void;
}

const MonthView = ({ currentDate, appointmentsByDate, tags, onDayClick, onShowMore, onCreateClick, onToggle, onCancel, onDelete }: MonthViewProps) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {weekDays.map(d => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {allDays.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayApts = appointmentsByDate[dateStr] || [];
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const today = isToday(day);

          return (
            <MonthDayCell
              key={i}
              day={day}
              dateStr={dateStr}
              dayApts={dayApts}
              tags={tags}
              isCurrentMonth={isCurrentMonth}
              today={today}
              onDayClick={onDayClick}
              onShowMore={onShowMore}
              onCreateClick={onCreateClick}
              onToggle={onToggle}
              onCancel={onCancel}
              onDelete={onDelete}
            />
          );
        })}
      </div>
    </div>
  );
};

// ── Month Day Cell (droppable) ──────────────────────────────────────────────────

const MonthDayCell = ({ day, dateStr, dayApts, tags, isCurrentMonth, today, onDayClick, onShowMore, onCreateClick, onToggle, onCancel, onDelete }: {
  day: Date;
  dateStr: string;
  dayApts: Appointment[];
  tags: AppointmentTag[];
  isCurrentMonth: boolean;
  today: boolean;
  onDayClick: (date: Date) => void;
  onShowMore: (date: Date) => void;
  onCreateClick: (date: Date) => void;
  onToggle: (id: string, completed: boolean) => void;
  onCancel: (id: string, cancelled: boolean) => void;
  onDelete: (id: string) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  return (
    <div
      ref={setNodeRef}
      onClick={() => onDayClick(day)}
      className={cn(
        "min-h-[90px] border-b border-r p-1.5 cursor-pointer transition-colors hover:bg-muted/30",
        !isCurrentMonth && "opacity-40",
        isOver && "ring-2 ring-inset ring-primary bg-primary/5"
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
          today ? "bg-accent text-accent-foreground font-bold" : "text-foreground"
        )}>
          {format(day, "d")}
        </span>
        {dayApts.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onCreateClick(day); }}
            className="rounded-full p-0.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
      {dayApts.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {dayApts.slice(0, 3).map(apt => (
            <MonthApt key={apt.id} apt={apt} tags={tags} onToggle={onToggle} onCancel={onCancel} onDelete={onDelete} />
          ))}
          {dayApts.length > 3 && (
            <button
              onClick={(e) => { e.stopPropagation(); onShowMore(day); }}
              className="w-full text-left text-[10px] font-medium text-primary hover:underline pl-1"
            >
              +{dayApts.length - 3} mais
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const MonthApt = ({ apt, tags, onToggle, onCancel, onDelete }: {
  apt: Appointment;
  tags: AppointmentTag[];
  onToggle: (id: string, completed: boolean) => void;
  onCancel: (id: string, cancelled: boolean) => void;
  onDelete: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: apt.id });
  const [detailOpen, setDetailOpen] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const isLastPost = apt.category.toLowerCase() === "último post";
  const aptTag = apt.tagId ? tags.find(t => t.id === apt.tagId) : null;
  const useTagColor = !apt.completed && !apt.cancelled && !isLastPost && aptTag;
  const now = new Date();
  const aptDateTime = new Date(`${apt.appointmentDate}T${apt.appointmentTime}`);
  const isOverdue = !apt.completed && !apt.cancelled && isBefore(aptDateTime, now);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    listeners?.onPointerDown?.(e);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    if (dx < 5 && dy < 5 && !isDragging) {
      setDetailOpen(true);
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        {...attributes}
        {...(listeners ? { ...listeners, onPointerDown: handlePointerDown } : {})}
        onPointerUp={handlePointerUp}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "rounded px-1.5 py-0.5 text-[10px] font-medium truncate cursor-pointer hover:ring-1 hover:ring-primary/40",
          isDragging && "opacity-50 cursor-grabbing",
          apt.completed
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 line-through"
            : apt.cancelled
              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 line-through"
              : isLastPost
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : useTagColor
                  ? ""
                  : getCategoryStyle(apt.category)
        )}
        style={useTagColor ? { backgroundColor: aptTag!.color + "25", color: aptTag!.color } : undefined}
      >
        <span className="font-mono mr-1">{apt.appointmentTime}</span>
        {apt.title}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {apt.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                <span>{format(new Date(apt.appointmentDate + "T12:00:00"), "dd/MM/yyyy")}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{apt.appointmentTime}</span>
              </div>
              {apt.category && (
                <Badge variant="outline" className={cn("text-xs", getCategoryStyle(apt.category))}>
                  {apt.category}
                </Badge>
              )}
              {aptTag && (
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{ backgroundColor: aptTag.color + "20", color: aptTag.color, borderColor: aptTag.color + "50" }}
                >
                  {aptTag.name}
                </Badge>
              )}
            </div>

            <div className="flex gap-2">
              {apt.completed && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Concluído
                </Badge>
              )}
              {apt.cancelled && (
                <Badge className="bg-red-100 text-red-600 border-red-300 dark:bg-red-900/30 dark:text-red-400">
                  Cancelado
                </Badge>
              )}
              {isOverdue && !apt.completed && !apt.cancelled && (
                <Badge className="bg-destructive/10 text-destructive border-destructive/30">
                  Atrasado
                </Badge>
              )}
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium text-muted-foreground mb-1">Descrição</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {apt.description || "Sem descrição adicional."}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant={apt.completed ? "outline" : "default"}
                className={cn("flex-1 gap-1.5", !apt.completed && "bg-emerald-600 hover:bg-emerald-700 text-white")}
                onClick={() => { onToggle(apt.id, !apt.completed); setDetailOpen(false); }}
              >
                <Check className="h-4 w-4" />
                {apt.completed ? "Desmarcar" : "Concluir"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => { onCancel(apt.id, !apt.cancelled); setDetailOpen(false); }}
              >
                <Ban className="h-4 w-4" />
                {apt.cancelled ? "Reativar" : "Cancelar"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => { onDelete(apt.id); setDetailOpen(false); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AgendaPage;
