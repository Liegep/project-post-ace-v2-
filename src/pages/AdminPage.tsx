import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { ClientTrackerPanel } from "@/components/ClientTrackerPanel";
import { ClientBillingConfig } from "@/components/billing/ClientBillingConfig";
import { BillingPermissionsPanel } from "@/components/billing/BillingPermissionsPanel";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { supabase } from "@/integrations/supabase/client";
import { PostsProvider, usePosts } from "@/context/PostsContext";
import { Post, PostStatus, STATUS_CONFIG } from "@/types/post";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PostCard } from "@/components/PostCard";
import { PostCardDialog } from "@/components/PostCardDialog";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { QuickAddCard } from "@/components/QuickAddCard";
import { EditPostDialog } from "@/components/EditPostDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, LayoutGrid, List, Pencil, ImagePlus, Trash2, GripVertical, Archive, RotateCcw, CheckSquare, X, Eye, EyeOff, ClipboardList, StickyNote, LinkIcon, ExternalLink, UserPlus, Settings, History, Download, CalendarClock, FileText, Search, Sparkles, MoreVertical, Paintbrush, Receipt, BarChart3, Check, ChevronDown } from "lucide-react";
import { invoiceColumnAuto } from "@/hooks/useInvoices";
import { InvoiceColumnDialog } from "@/components/billing/InvoiceColumnDialog";
import { ClientRightSidebar } from "@/components/ClientRightSidebar";
import { TextContentsPanel } from "@/components/TextContentsPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { TrackingDrawer } from "@/components/TrackingDrawer";
import { PRESET_COLORS } from "@/components/calendar/EventColorPicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import ClientAccessPanel from "@/components/ClientAccessPanel";
import { HybridAccessConfig } from "@/components/HybridAccessConfig";
import { ClientCalendarWidget } from "@/components/calendar/ClientCalendarWidget";
import { ApprovalLinkButton } from "@/components/ApprovalLinkButton";
import { KanbanScrollWrapper } from "@/components/KanbanScrollWrapper";
import { KanbanAutomationsPanel } from "@/components/KanbanAutomationsPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { DndContext, DragOverlay, closestCorners, pointerWithin, rectIntersection, getFirstCollision, PointerSensor, TouchSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, DragOverEvent, useDroppable, CollisionDetection } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Locale } from "@/i18n/translations";
import { uploadClientLogo } from "@/lib/uploadClientLogo";

const UNASSIGNED_COLUMN_ID = "__unassigned__";

const DroppableColumn = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`space-y-3 min-h-[60px] flex-1 overflow-y-auto pr-1 -mr-1 rounded-lg transition-colors ${isOver ? "bg-accent/10 ring-2 ring-accent/30" : ""}`}>
      {children}
    </div>
  );
};

const DraggablePostCard = ({ post, onStatusChange, onDelete, onEdit, onArchive, selectionMode, isSelected, onToggleSelect }: {
  post: Post;
  onStatusChange: (s: PostStatus[]) => void;
  onDelete: () => void;
  onEdit: () => void;
  onArchive: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: post.id,
    data: { type: "post", post },
    disabled: selectionMode,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  // Wrap pointer-down listener so right-click (button !== 0) does not start a drag
  // and Radix ContextMenu can open + receive clicks normally.
  const dragListeners = selectionMode
    ? {}
    : {
        ...listeners,
        onPointerDown: (e: React.PointerEvent) => {
          if (e.button !== 0) return;
          listeners?.onPointerDown?.(e);
        },
      };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...dragListeners}>
      <PostCard
        post={post}
        isAdmin
        onStatusChange={onStatusChange}
        onDelete={onDelete}
        onEdit={onEdit}
        onArchive={onArchive}
        selectionMode={selectionMode}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      />
    </div>
  );
};
interface ClientData {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  locale: string;
  posting_period: string;
  trello_board_id: string;
  show_archived_to_client: boolean;
  tracking_enabled: boolean;
  tracking_visible_to_client: boolean;
  show_upcoming_posts: boolean;
  client_portal_title: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  youtube_url: string;
  linkedin_url: string;
  twitter_url: string;
  website_url: string;
}

interface ClientMenuItem {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

interface KanbanBoardProps {
  posts: Post[];
  columns: { id: string; name: string; position: number; visibleToClient: boolean; color?: string | null }[];
  unassignedPosts: Post[];
  editingColumnId: string | null;
  editingColumnName: string;
  setEditingColumnId: (id: string | null) => void;
  setEditingColumnName: (name: string) => void;
  editColumnInputRef: React.RefObject<HTMLInputElement>;
  handleRenameColumn: (id: string) => void;
  handleDeleteColumn: (id: string) => void;
  updatePostStatus: (id: string, status: PostStatus[]) => void;
  deletePost: (id: string) => void;
  updatePost: (id: string, updates: Partial<Post>) => void;
  setDetailPost: (post: Post) => void;
  setCreateInColumnId: (id: string | null) => void;
  setCreateOpen: (open: boolean) => void;
  addingColumn: boolean;
  setAddingColumn: (v: boolean) => void;
  newColumnName: string;
  setNewColumnName: (v: string) => void;
  newColumnInputRef: React.RefObject<HTMLInputElement>;
  handleAddColumn: () => void;
  movePostToColumn: (postId: string, columnId: string | null) => void;
  reorderPostsInColumn: (columnId: string | null, orderedPostIds: string[]) => void;
  t: (key: any) => string;
  toggleColumnVisibility: (id: string, visible: boolean) => void;
  setColumnColor: (id: string, color: string | null) => void;
  selectionMode?: boolean;
  selectedPostIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  reorderColumns: (columns: { id: string; name: string; position: number; visibleToClient: boolean; color?: string | null }[]) => void;
  clientId: string;
  billingCurrency?: string;
}

type InvoiceColumnTarget = {
  id: string;
  name: string;
};

const SortableColumn = ({ col, children }: { col: { id: string }; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `col-${col.id}`,
    data: { type: "column", columnId: col.id },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="board-column-shell">
      <div {...attributes} {...listeners} className="mb-ui-1 flex shrink-0 justify-center cursor-grab active:cursor-grabbing">
        <GripVertical className="size-icon-sm rotate-90 text-muted-foreground/50" />
      </div>
      {children}
    </div>
  );
};

export const KanbanBoard = ({
  posts, columns, unassignedPosts, editingColumnId, editingColumnName,
  setEditingColumnId, setEditingColumnName, editColumnInputRef, handleRenameColumn,
  handleDeleteColumn, updatePostStatus, deletePost, setDetailPost, setCreateInColumnId,
  updatePost,
  setCreateOpen, addingColumn, setAddingColumn, newColumnName, setNewColumnName,
  newColumnInputRef, handleAddColumn, movePostToColumn, reorderPostsInColumn, t,
  toggleColumnVisibility, setColumnColor,
  selectionMode, selectedPostIds, onToggleSelect,
  reorderColumns,
  clientId,
  billingCurrency,
}: KanbanBoardProps) => {
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [invoiceColumnTarget, setInvoiceColumnTarget] = useState<InvoiceColumnTarget | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  // Custom collision detection: prefer pointer-within (great for sparse columns),
  // fall back to rectangle intersection, then closest-corners. Makes dropping into
  // empty space inside a column and swapping with adjacent cards much easier.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) return rectCollisions;
    return closestCorners(args);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "column") {
      setActiveColumnId(data.columnId);
    } else {
      const post = posts.find((p) => p.id === event.active.id);
      if (post) setActivePost(post);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const wasColumnDrag = activeColumnId !== null;
    setActivePost(null);
    setActiveColumnId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    // Handle column reorder
    if (wasColumnDrag) {
      const activeColId = activeId.replace("col-", "");
      const overColId = overId.replace("col-", "");
      const oldIndex = columns.findIndex((c) => c.id === activeColId);
      const newIndex = columns.findIndex((c) => c.id === overColId);
      if (oldIndex >= 0 && newIndex >= 0) {
        const newCols = arrayMove([...columns], oldIndex, newIndex).map((c, i) => ({ ...c, position: i }));
        reorderColumns(newCols);
      }
      return;
    }

    // Handle post reorder
    const postId = activeId;

    // Determine target column
    let targetColumnId: string | null = null;
    if (overId === UNASSIGNED_COLUMN_ID) {
      targetColumnId = null;
    } else if (columns.some((c) => c.id === overId)) {
      targetColumnId = overId;
    } else {
      const overPost = posts.find((p) => p.id === overId);
      if (overPost) {
        targetColumnId = overPost.columnId;
      } else {
        return;
      }
    }

    const currentPost = posts.find((p) => p.id === postId);
    if (!currentPost) return;

    // Get posts in the target column (sorted by position)
    const targetPosts = posts
      .filter((p) => p.columnId === targetColumnId && p.id !== postId)
      .sort((a, b) => a.position - b.position);

    // Find insert index
    const overIndex = targetPosts.findIndex((p) => p.id === overId);
    const newOrder = [...targetPosts];
    if (overIndex >= 0) {
      newOrder.splice(overIndex, 0, currentPost);
    } else {
      newOrder.push(currentPost);
    }

    reorderPostsInColumn(targetColumnId, newOrder.map((p) => p.id));
  };

  const allPostIds = posts.map((p) => p.id);
  const columnSortIds = columns.map((c) => `col-${c.id}`);

  return (
    <>
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <KanbanScrollWrapper fillHeight>
        <SortableContext items={columnSortIds} strategy={horizontalListSortingStrategy}>
          {columns.map((col) => {
            const columnPosts = posts.filter((p) => p.columnId === col.id).sort((a, b) => a.position - b.position);
            const headerBg = col.color || "#000000";
            const luminance = (() => {
              const m = headerBg.replace("#", "");
              if (!/^[0-9a-fA-F]{6}$/.test(m)) return 0;
              const r = parseInt(m.slice(0, 2), 16);
              const g = parseInt(m.slice(2, 4), 16);
              const b = parseInt(m.slice(4, 6), 16);
              return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            })();
            const isLight = luminance > 0.6;
            const textColor = isLight ? "#111827" : "#ffffff";
            const mutedColor = isLight ? "rgba(17,24,39,0.65)" : "rgba(255,255,255,0.65)";
            const hoverBg = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";
            return (
              <SortableColumn key={col.id} col={col}>
                <div
                  className="mb-4 flex items-center justify-between gap-2 shrink-0 z-10 rounded-lg backdrop-blur-sm border border-l-4 px-3 py-2 shadow-sm"
                  style={{
                    backgroundColor: headerBg,
                    borderColor: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
                    borderLeftColor: col.color || (isLight ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.5)"),
                    color: textColor,
                  }}
                >
                  {editingColumnId === col.id ? (
                    <Input
                      ref={editColumnInputRef}
                      value={editingColumnName}
                      onChange={(e) => setEditingColumnName(e.target.value)}
                      onBlur={() => handleRenameColumn(col.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameColumn(col.id);
                        if (e.key === "Escape") setEditingColumnId(null);
                      }}
                      className="h-7 text-sm font-semibold bg-white/90 text-black"
                    />
                  ) : (
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 ring-1"
                        style={{
                          backgroundColor: col.color || "transparent",
                          borderColor: isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.4)",
                          boxShadow: isLight ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : "inset 0 0 0 1px rgba(255,255,255,0.35)",
                        }}
                      />
                      <span className="text-sm font-semibold break-words whitespace-normal" style={{ color: textColor }}>{col.name}</span>
                      <span
                        className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-full px-2.5 text-[11px] font-semibold shrink-0"
                        style={{
                          backgroundColor: isLight ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.88)",
                          color: "#6b7280",
                        }}
                      >
                        {columnPosts.length}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleColumnVisibility(col.id, !col.visibleToClient)}
                      className="rounded p-1 transition-colors"
                      style={{ color: col.visibleToClient ? textColor : mutedColor }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      title={col.visibleToClient ? t("visibleToClient") : t("hiddenFromClient")}
                    >
                      {col.visibleToClient ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="rounded p-1 transition-colors"
                          style={{ color: mutedColor }}
                          title={`Mais ações da coluna ${col.name}`}
                          aria-label={`Mais ações da coluna ${col.name}`}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={8}
                        className="w-56 border-slate-200 !bg-white !text-slate-900 shadow-2xl"
                        style={{ backgroundColor: "#ffffff", color: "#111827", opacity: 1 }}
                      >
                        <DropdownMenuItem
                          className="text-slate-900 focus:bg-slate-100 focus:text-slate-950"
                          style={{ color: "#111827" }}
                          onClick={() => { setCreateInColumnId(col.id); setCreateOpen(true); }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {t("addPost")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-slate-900 focus:bg-slate-100 focus:text-slate-950"
                          style={{ color: "#111827" }}
                          onClick={() => { setEditingColumnId(col.id); setEditingColumnName(col.name); }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-slate-900 focus:bg-slate-100 focus:text-slate-950"
                          style={{ color: "#111827" }}
                          onClick={() => setInvoiceColumnTarget({ id: col.id, name: col.name })}
                        >
                          <Receipt className="h-4 w-4 mr-2" />
                          Faturar
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="text-slate-900 focus:bg-slate-100" style={{ color: "#111827" }}>
                            <Paintbrush className="h-4 w-4 mr-2" />
                            {t("color")}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent
                            className="w-56 border-slate-200 !bg-white !text-slate-900 p-2 shadow-2xl"
                            sideOffset={6}
                            style={{ backgroundColor: "#ffffff", color: "#111827", opacity: 1 }}
                          >
                            <div className="grid grid-cols-6 gap-1.5">
                              {PRESET_COLORS.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setColumnColor(col.id, c)}
                                  className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                                  style={{
                                    backgroundColor: c,
                                    borderColor: col.color === c ? (isLight ? "#111" : "#fff") : "transparent",
                                    boxShadow: col.color === c ? "0 0 0 1px " + (isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.3)") : "none",
                                  }}
                                  title={c}
                                />
                              ))}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="color"
                                value={col.color || "#3b82f6"}
                                onChange={(e) => setColumnColor(col.id, e.target.value)}
                                className="h-7 w-10 p-0.5 cursor-pointer rounded border"
                                style={{ borderColor: isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)" }}
                              />
                              {col.color && (
                                <button
                                  type="button"
                                  onClick={() => setColumnColor(col.id, null)}
                                  className="text-xs px-2 py-1 rounded border transition-colors"
                                  style={{
                                    color: mutedColor,
                                    borderColor: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
                                  }}
                                >
                                  Remover cor
                                </button>
                              )}
                            </div>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteColumn(col.id)}
                          className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("deleteAction")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <SortableContext items={columnPosts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <DroppableColumn id={col.id}>
                    {columnPosts.map((post) => (
                      <DraggablePostCard
                        key={post.id}
                        post={post}
                        onStatusChange={(s) => updatePostStatus(post.id, s)}
                        onDelete={() => deletePost(post.id)}
                        onEdit={() => setDetailPost(post)}
                        onArchive={() => updatePost(post.id, { archived: true, archivedAt: new Date() })}
                        selectionMode={selectionMode}
                        isSelected={selectedPostIds?.has(post.id)}
                        onToggleSelect={onToggleSelect}
                      />
                    ))}
                    {columnPosts.length === 0 && (
                      <p className="py-8 text-center text-sm text-muted-foreground">{t("noPosts")}</p>
                    )}
                    <QuickAddCard columnId={col.id} />
                  </DroppableColumn>
                </SortableContext>
              </SortableColumn>
            );
          })}
        </SortableContext>

        {/* Unassigned posts column */}
        {unassignedPosts.length > 0 && (
          <div className="board-column-shell bg-muted/30">
            <div className="mb-4 flex items-center gap-2 shrink-0">
              <span className="text-sm font-semibold text-muted-foreground">{t("noColumn")}</span>
              <span className="text-xs text-muted-foreground">({unassignedPosts.length})</span>
            </div>
            <SortableContext items={unassignedPosts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <DroppableColumn id={UNASSIGNED_COLUMN_ID}>
                {unassignedPosts.map((post) => (
                  <DraggablePostCard
                    key={post.id}
                    post={post}
                    onStatusChange={(s) => updatePostStatus(post.id, s)}
                    onDelete={() => deletePost(post.id)}
                    onEdit={() => setDetailPost(post)}
                    onArchive={() => updatePost(post.id, { archived: true, archivedAt: new Date() })}
                    selectionMode={selectionMode}
                    isSelected={selectedPostIds?.has(post.id)}
                    onToggleSelect={onToggleSelect}
                  />
                ))}
              </DroppableColumn>
            </SortableContext>
          </div>
        )}

        {/* Add column button */}
        <div className="w-80 shrink-0">
          {addingColumn ? (
            <div className="rounded-ui-lg border bg-card/50 p-ui-4">
              <Input
                ref={newColumnInputRef}
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onBlur={handleAddColumn}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddColumn();
                  if (e.key === "Escape") { setNewColumnName(""); setAddingColumn(false); }
                }}
                placeholder={t("columnName")}
                className="mb-2"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddColumn} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
                  {t("create")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setNewColumnName(""); setAddingColumn(false); }}>
                  {t("cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 py-12 text-sm text-muted-foreground hover:border-accent hover:text-accent transition-colors"
            >
              <Plus className="h-5 w-5" /> {t("newColumn")}
              
            </button>
          )}
        </div>
      </KanbanScrollWrapper>

      <DragOverlay>
        {activePost && (
          <div className="w-80 rotate-2 opacity-90">
            <PostCard post={activePost} isAdmin />
          </div>
        )}
        {activeColumnId && (
          <div className="w-80 rotate-1 rounded-ui-lg border bg-card/50 p-ui-4 opacity-80 shadow-lg">
            <span className="text-ui-sm font-semibold text-foreground">
              {columns.find((c) => c.id === activeColumnId)?.name}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
    <InvoiceColumnDialog
      open={!!invoiceColumnTarget}
      onOpenChange={(o) => { if (!o) setInvoiceColumnTarget(null); }}
      columnName={invoiceColumnTarget?.name || ""}
      currency={billingCurrency}
      onConfirm={async ({ name, quantity, unit_price, description }) => {
        try {
          const res = await invoiceColumnAuto(clientId, name, { quantity, unit_price, description });
          toast({ title: "Adicionado à fatura", description: `"${name}" enviado para "${res.invoiceTitle}".` });
        } catch (err: any) {
          toast({ title: "Erro ao faturar", description: err.message, variant: "destructive" });
        }
      }}
    />
    </>
  );
};

const ArchivedView = ({ archivedPosts, columns, unarchivePost, deletePost, selectionMode, selectedPostIds, onToggleSelect, t }: {
  archivedPosts: Post[];
  columns: { id: string; name: string }[];
  unarchivePost: (id: string, columnId?: string | null) => void;
  deletePost: (id: string) => void;
  selectionMode?: boolean;
  selectedPostIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  t: (key: any) => string;
}) => {
  const grouped = archivedPosts.reduce<Record<string, Post[]>>((acc, post) => {
    const date = post.deadline || post.archivedAt || post.createdAt;
    const key = format(date, "MMMM yyyy", { locale: ptBR });
    if (!acc[key]) acc[key] = [];
    acc[key].push(post);
    return acc;
  }, {});

  const months = Object.keys(grouped).sort((a, b) => {
    const dateA = grouped[a][0].deadline || grouped[a][0].archivedAt || grouped[a][0].createdAt;
    const dateB = grouped[b][0].deadline || grouped[b][0].archivedAt || grouped[b][0].createdAt;
    return dateB.getTime() - dateA.getTime();
  });

  if (archivedPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-full bg-muted p-6">
          <Archive className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">{t("noArchivedPosts")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("archivedPostsAppearHere")}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full">
      {months.map((month) => (
        <div key={month} className="board-column-shell">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground capitalize">{month}</span>
            <span className="text-xs text-muted-foreground">({grouped[month].length})</span>
          </div>
          <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
            {grouped[month].map((post) => {
              const isSelected = selectedPostIds?.has(post.id);
              return (
                <div key={post.id} className="relative">
                  <PostCard
                    post={post}
                    isAdmin
                    hideFeedback
                    selectionMode={selectionMode}
                    isSelected={isSelected}
                    onToggleSelect={onToggleSelect}
                    onEdit={() => {}}
                  />
                  {!selectionMode && (
                    <div className="mt-1.5 flex gap-1.5">
                      {columns.length > 0 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 text-xs">
                              <RotateCcw className="mr-1 h-3 w-3" /> {t("restore")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-2" align="start">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Mover para coluna:</p>
                            <div className="space-y-1">
                              {columns.map((col) => (
                                <button
                                  key={col.id}
                                  onClick={() => unarchivePost(post.id, col.id)}
                                  className="w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                                >
                                  {col.name}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => unarchivePost(post.id)}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" /> {t("restore")}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive text-xs"
                        onClick={() => { if (confirm(t("deletePermanently"))) deletePost(post.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const AdminPageInner = ({ clientData }: { clientData: ClientData }) => {
  const {
    posts, archivedPosts, columns, tags, updatePostStatus, deletePost, updatePost, postingPeriod, setPostingPeriod,
    companyLogo, setCompanyLogo, addColumn, renameColumn, deleteColumn, toggleColumnVisibility, setColumnColor,
    movePostToColumn, reorderPostsInColumn, unarchivePost, bulkUpdateStatus, bulkDeletePosts, bulkMoveToColumn, reorderColumns,
    clientId: ctxClientId,
  } = usePosts();
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [activeTab, setActiveTab] = useState<"board" | "archived" | "activity" | "texts">("board");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createAsPauta, setCreateAsPauta] = useState(false);
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [editingPeriod, setEditingPeriod] = useState(false);
  const [periodDraft, setPeriodDraft] = useState(postingPeriod);
  const periodInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const newColumnInputRef = useRef<HTMLInputElement>(null);
  const editColumnInputRef = useRef<HTMLInputElement>(null);
  const [createInColumnId, setCreateInColumnId] = useState<string | null>(null);

   const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
   const [searchQuery, setSearchQuery] = useState("");

   const normalizedQuery = searchQuery.trim().toLowerCase();
   const searchResults = normalizedQuery
     ? [
         ...posts.map((p) => ({ post: p, archived: false })),
         ...archivedPosts.map((p) => ({ post: p, archived: true })),
       ].filter(({ post }) =>
         (post.title || "").toLowerCase().includes(normalizedQuery) ||
         (post.caption || "").toLowerCase().includes(normalizedQuery)
       )
     : [];

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [showArchivedToClient, setShowArchivedToClient] = useState(clientData.show_archived_to_client);
  const [allowClientEditCaption, setAllowClientEditCaption] = useState((clientData as any).allow_client_edit_caption ?? false);
  const [allowClientCreatePost, setAllowClientCreatePost] = useState((clientData as any).allow_client_create_post ?? false);
  const [allowClientDownload, setAllowClientDownload] = useState((clientData as any).allow_client_download ?? false);
  const [allowClientCreateTags, setAllowClientCreateTags] = useState((clientData as any).allow_client_create_tags ?? false);
  const [trackingEnabled, setTrackingEnabled] = useState(clientData.tracking_enabled ?? false);
  const [trackingVisibleToClient, setTrackingVisibleToClient] = useState(clientData.tracking_visible_to_client ?? false);
  const [trackingColumnIds, setTrackingColumnIds] = useState<string[]>(((clientData as any).tracking_column_ids as string[]) ?? []);
  const [showUpcomingPosts, setShowUpcomingPosts] = useState((clientData as any).show_upcoming_posts ?? false);
  const [allowClientEditBrandBrain, setAllowClientEditBrandBrain] = useState((clientData as any).allow_client_edit_brand_brain ?? false);
  const [clientLocale, setClientLocale] = useState<Locale>((clientData.locale as Locale) || "pt");
  const [availableClients, setAvailableClients] = useState<ClientMenuItem[]>([]);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const loadAvailableClients = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isSuperAdmin = (roles || []).some((role: any) => role.role === "super_admin");

      if (isSuperAdmin) {
        const { data } = await supabase
          .from("clients")
          .select("id, name, slug, logo_url")
          .order("name");
        setAvailableClients((data || []) as ClientMenuItem[]);
        return;
      }

      const [assignmentsResult, ownedClientsResult] = await Promise.all([
        supabase.from("user_client_assignments").select("client_id").eq("user_id", user.id),
        supabase.from("clients").select("id").eq("owner_id", user.id),
      ]);
      const clientIds = [...new Set([
        ...(assignmentsResult.data || []).map((assignment: any) => assignment.client_id),
        ...(ownedClientsResult.data || []).map((client: any) => client.id),
      ])];

      if (clientIds.length === 0) return;

      const { data } = await supabase
        .from("clients")
        .select("id, name, slug, logo_url")
        .in("id", clientIds)
        .order("name");
      setAvailableClients((data || []) as ClientMenuItem[]);
    };

    loadAvailableClients();
  }, []);

  // Auto-open post from query param (e.g. from dashboard notification)
  useEffect(() => {
    const postId = searchParams.get("postId");
    if (postId && posts.length > 0) {
      const found = posts.find((p) => p.id === postId);
      if (found) {
        setEditPost(found);
        // Clean up the query param
        searchParams.delete("postId");
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, posts]);

  useEffect(() => {
    if (!detailPost) return;
    const freshPost = posts.find((p) => p.id === detailPost.id);
    if (freshPost && freshPost !== detailPost) {
      setDetailPost(freshPost);
    }
    if (!freshPost) {
      setDetailPost(null);
    }
  }, [detailPost, posts]);

  useEffect(() => {
    if (!editPost) return;
    const freshPost = posts.find((p) => p.id === editPost.id);
    if (!freshPost) {
      setEditPost(null);
    }
  }, [editPost, posts]);

  // Activity logs for this client
  const activityLogs = useActivityLogs({ clientId: ctxClientId, enabled: activeTab === "activity" });

  const toggleShowArchivedToClient = async (checked: boolean) => {
    setShowArchivedToClient(checked);
    await supabase.from("clients").update({ show_archived_to_client: checked } as any).eq("id", clientData.id);
  };

  const toggleAllowClientEditCaption = async (checked: boolean) => {
    setAllowClientEditCaption(checked);
    await supabase.from("clients").update({ allow_client_edit_caption: checked } as any).eq("id", clientData.id);
  };

  const toggleAllowClientCreatePost = async (checked: boolean) => {
    setAllowClientCreatePost(checked);
    await supabase.from("clients").update({ allow_client_create_post: checked } as any).eq("id", clientData.id);
  };

  const toggleAllowClientDownload = async (checked: boolean) => {
    setAllowClientDownload(checked);
    await supabase.from("clients").update({ allow_client_download: checked } as any).eq("id", clientData.id);
  };

  const toggleAllowClientCreateTags = async (checked: boolean) => {
    setAllowClientCreateTags(checked);
    await supabase.from("clients").update({ allow_client_create_tags: checked } as any).eq("id", clientData.id);
  };

  const updateClientLocale = async (nextLocale: Locale) => {
    setClientLocale(nextLocale);
    await supabase.from("clients").update({ locale: nextLocale } as any).eq("id", clientData.id);
  };

  const enableTracking = async () => {
    // Create default steps
    const defaultSteps = [
      { name: "Roteiro", color: "#6366f1" },
      { name: "Design / Arte", color: "#f59e0b" },
      { name: "Legenda", color: "#3b82f6" },
      { name: "Revisão", color: "#8b5cf6" },
      { name: "Agendado", color: "#06b6d4" },
      { name: "Publicado", color: "#22c55e" },
    ];
    for (let i = 0; i < defaultSteps.length; i++) {
      await supabase.from("tracking_steps").insert({
        client_id: clientData.id,
        name: defaultSteps[i].name,
        color: defaultSteps[i].color,
        position: i,
      } as any);
    }
    await supabase.from("clients").update({ tracking_enabled: true } as any).eq("id", clientData.id);
    setTrackingEnabled(true);
    toast({ title: t("trackingCreated"), description: t("trackingCreatedDesc") });
  };

  const disableTracking = async () => {
    await supabase.from("clients").update({ tracking_enabled: false } as any).eq("id", clientData.id);
    setTrackingEnabled(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedPostIds(new Set());
  };

  const handleBulkStatusChange = async (statuses: PostStatus[]) => {
    const ids = Array.from(selectedPostIds);
    await bulkUpdateStatus(ids, statuses);
    exitSelectionMode();
    toast({ title: `${ids.length} ${t("postsUpdated")}` });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedPostIds);
    if (!confirm(t("confirmBulkDelete").replace("{count}", String(ids.length)))) return;
    await bulkDeletePosts(ids);
    exitSelectionMode();
    toast({ title: `${ids.length} ${t("postsDeleted")}` });
  };

  const handleBulkUnarchive = async () => {
    const ids = Array.from(selectedPostIds);
    for (const id of ids) await unarchivePost(id);
    exitSelectionMode();
    toast({ title: `${ids.length} ${t("postsRestored")}` });
  };

  const handleBulkMoveToColumn = async (columnId: string) => {
    const ids = Array.from(selectedPostIds);
    const targetColumnId = columnId === "__unassigned__" ? null : columnId;
    await bulkMoveToColumn(ids, targetColumnId);
    exitSelectionMode();
    toast({ title: `${ids.length} ${t("postsMoved")}` });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadClientLogo(file);
      setCompanyLogo(url);
      toast({ title: "Logo atualizado com sucesso" });
    } catch (err) {
      console.error("Logo upload failed", err);
      toast({
        title: "Erro ao enviar logo",
        description: err instanceof Error ? err.message : "Não foi possível enviar o logo do cliente.",
        variant: "destructive",
      });
    } finally {
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (editingPeriod && periodInputRef.current) {
      periodInputRef.current.focus();
      periodInputRef.current.select();
    }
  }, [editingPeriod]);

  useEffect(() => {
    if (addingColumn && newColumnInputRef.current) {
      newColumnInputRef.current.focus();
    }
  }, [addingColumn]);

  useEffect(() => {
    if (editingColumnId && editColumnInputRef.current) {
      editColumnInputRef.current.focus();
      editColumnInputRef.current.select();
    }
  }, [editingColumnId]);

  const savePeriod = () => {
    if (periodDraft.trim()) setPostingPeriod(periodDraft.trim());
    setEditingPeriod(false);
  };

  const addingColumnRef = useRef(false);
  const handleAddColumn = async () => {
    if (!newColumnName.trim()) {
      setAddingColumn(false);
      return;
    }
    if (addingColumnRef.current) return;
    addingColumnRef.current = true;
    try {
      await addColumn(newColumnName.trim());
      setNewColumnName("");
      setAddingColumn(false);
    } catch (err) {
      console.error(err);
      toast({ title: t("columnCreateError"), variant: "destructive" });
    } finally {
      addingColumnRef.current = false;
    }
  };

  const handleRenameColumn = (id: string) => {
    if (editingColumnName.trim()) {
      renameColumn(id, editingColumnName.trim());
    }
    setEditingColumnId(null);
  };

  const handleDeleteColumn = (id: string) => {
    if (!confirm(t("deleteColumnConfirm"))) return;
    deleteColumn(id);
  };

  // Posts without a column
  const unassignedPosts = posts.filter((p) => !p.columnId).sort((a, b) => a.position - b.position);


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={() => navigate("/admin")}
              className="rounded-lg p-2 transition-colors shrink-0 group bg-white hover:bg-foreground shadow-md border border-border/40 transition-colors"
              title="Dashboard"
              aria-label="Ir para o dashboard"
            >
              <LayoutGrid className="h-5 w-5 text-black group-hover:text-white transition-colors" strokeWidth={2.5} />
            </button>
            <button
              onClick={() => logoInputRef.current?.click()}
              className="group relative flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary overflow-hidden transition-colors shrink-0"
            >
              {companyLogo ? (
                <>
                  <img src={companyLogo} alt="Logo" className="h-full w-full object-contain" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="h-4 w-4 text-white" />
                  </div>
                </>
              ) : (
                <ImagePlus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              )}
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <div className="flex min-w-0 items-center gap-1">
              <button
                onClick={() => navigate(`/client/${clientData.slug}`)}
                className="group min-w-0 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Abrir área do cliente"
              >
                <span className="block truncate text-lg font-bold text-foreground group-hover:text-primary sm:text-2xl">{clientData.name}</span>
                <span className="hidden truncate text-xs text-muted-foreground lg:block">{t("adminSubtitle")}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="group shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Trocar cliente"
                  >
                    <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 p-1">
                  {availableClients.map((client) => {
                    const isCurrentClient = client.id === clientData.id;
                    const destination = isCurrentClient ? `/client/${client.slug}` : `/admin/${client.slug}`;
                    return (
                      <DropdownMenuItem key={client.id} asChild>
                        <Link to={destination} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-xs font-bold text-muted-foreground">
                            {client.logo_url ? (
                              <img src={client.logo_url} alt="" className="h-full w-full object-contain" />
                            ) : (
                              client.name.charAt(0).toUpperCase()
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{client.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {isCurrentClient ? "Abrir área do cliente" : "Abrir Kanban"}
                            </span>
                          </span>
                          {isCurrentClient && <Check className="h-4 w-4 shrink-0 text-primary" />}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Desktop actions (lg+) */}
          <div className="hidden lg:flex items-center gap-3">
            <LanguageSelector />
            <div className="flex rounded-lg border bg-muted p-1">
              <button
                onClick={() => navigate("/admin")}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${view === "kanban" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                title="Ir para o dashboard"
                aria-label="Ir para o dashboard"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("list")}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button
              variant={selectionMode ? "default" : "outline"}
              onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
            >
              <CheckSquare className="mr-2 h-4 w-4" /> {selectionMode ? t("cancel") : t("select")}
            </Button>
            {!trackingEnabled && (
              <Button variant="outline" onClick={enableTracking}>
                <ClipboardList className="mr-2 h-4 w-4" /> {t("createTracking")}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => { setCreateInColumnId(null); setCreateAsPauta(true); setCreateOpen(true); }}
              className="border-amber-400 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
              title="Nova Pauta"
            >
              <FileText className="mr-2 h-4 w-4" /> Nova Pauta
            </Button>
            <Button onClick={() => { setCreateInColumnId(null); setCreateAsPauta(false); setCreateOpen(true); }} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" /> {t("newPost")}
            </Button>
            <Button variant="outline" size="icon" onClick={() => setSettingsDrawerOpen(true)} title="Configurações">
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          {/* Tablet actions (md to lg): icon-only, compact */}
          <div className="hidden md:flex lg:hidden items-center gap-1.5 shrink-0">
            <div className="flex rounded-lg border bg-muted p-0.5">
              <button
                onClick={() => navigate("/admin")}
                className={`rounded-md px-2 py-1.5 transition-colors ${view === "kanban" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                title="Ir para o dashboard"
                aria-label="Ir para o dashboard"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("list")}
                className={`rounded-md px-2 py-1.5 transition-colors ${view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                title="Lista"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button
              variant={selectionMode ? "default" : "outline"}
              size="icon"
              onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
              title={selectionMode ? t("cancel") : t("select")}
            >
              <CheckSquare className="h-4 w-4" />
            </Button>
            {!trackingEnabled && (
              <Button variant="outline" size="icon" onClick={enableTracking} title={t("createTracking")}>
                <ClipboardList className="h-4 w-4" />
              </Button>
            )}
            <Button onClick={() => { setCreateInColumnId(null); setCreateAsPauta(false); setCreateOpen(true); }} className="bg-accent text-accent-foreground hover:bg-accent/90" title={t("newPost")}>
              <Plus className="h-4 w-4 mr-1.5" /> <span className="text-sm">{t("newPost")}</span>
            </Button>
            <Button variant="outline" size="icon" onClick={() => setSettingsDrawerOpen(true)} title="Configurações">
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile actions */}
          <div className="flex md:hidden items-center gap-1.5">
            <Button size="sm" onClick={() => { setCreateInColumnId(null); setCreateAsPauta(false); setCreateOpen(true); }} className="bg-accent text-accent-foreground hover:bg-accent/90 h-8 px-2.5">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSettingsDrawerOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile settings drawer */}
      <Sheet open={settingsDrawerOpen} onOpenChange={setSettingsDrawerOpen}>
        <SheetContent side="right" className="w-[300px] overflow-y-auto p-0">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="text-left text-base">Configurações</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col divide-y">
            {/* View toggle */}
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Visualização</p>
              <div className="flex rounded-lg border bg-muted p-1">
                <button
                  onClick={() => { navigate("/admin"); setSettingsDrawerOpen(false); }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${view === "kanban" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                  aria-label="Ir para o dashboard"
                >
                  <LayoutGrid className="h-4 w-4 mx-auto" />
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  <List className="h-4 w-4 mx-auto" />
                </button>
              </div>
            </div>

            {/* Quick actions */}
            <div className="px-5 py-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">Ações</p>
              <Button
                variant={selectionMode ? "default" : "outline"}
                size="sm"
                className="w-full justify-start"
                onClick={() => { selectionMode ? exitSelectionMode() : setSelectionMode(true); setSettingsDrawerOpen(false); }}
              >
                <CheckSquare className="mr-2 h-4 w-4" /> {selectionMode ? t("cancel") : t("select")}
              </Button>
              {!trackingEnabled && (
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => { enableTracking(); setSettingsDrawerOpen(false); }}>
                  <ClipboardList className="mr-2 h-4 w-4" /> {t("createTracking")}
                </Button>
              )}
            </div>

            {/* Panels: Acesso */}
            <div className="px-5 py-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">Painéis</p>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <UserPlus className="mr-2 h-4 w-4 text-green-500" />
                    Acesso do Cliente
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:w-[440px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-green-500" />
                      Acesso do Cliente
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-6">
                    <ClientAccessPanel clientId={clientData.id} clientName={clientData.name} />
                    <HybridAccessConfig clientId={clientData.id} />
                  </div>
                </SheetContent>
              </Sheet>
              <ApprovalLinkButton
                clientId={clientData.id}
                variant="batch"
                className="w-full justify-start"
              />
            </div>

            {/* Permissions */}
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Permissões do Cliente</p>
              <div className="flex items-center justify-between">
                <label className="text-sm text-foreground flex items-center gap-2">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  Editar legenda
                </label>
                <Switch checked={allowClientEditCaption} onCheckedChange={toggleAllowClientEditCaption} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-foreground flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  Criar posts
                </label>
                <Switch checked={allowClientCreatePost} onCheckedChange={toggleAllowClientCreatePost} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-foreground flex items-center gap-2">
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  Baixar conteúdo
                </label>
                <Switch checked={allowClientDownload} onCheckedChange={toggleAllowClientDownload} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-foreground flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                  Criar tags
                </label>
                <Switch checked={allowClientCreateTags} onCheckedChange={toggleAllowClientCreateTags} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-foreground flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  Mostrar arquivados
                </label>
                <Switch checked={showArchivedToClient} onCheckedChange={toggleShowArchivedToClient} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-foreground flex items-center gap-2">
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                  Próximos posts
                </label>
                <Switch checked={showUpcomingPosts} onCheckedChange={async (checked) => {
                  setShowUpcomingPosts(checked);
                  await supabase.from("clients").update({ show_upcoming_posts: checked } as any).eq("id", clientData.id);
                }} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-foreground flex items-center gap-2">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  Editar Brand Brain
                </label>
                <Switch checked={allowClientEditBrandBrain} onCheckedChange={async (checked) => {
                  setAllowClientEditBrandBrain(checked);
                  await supabase.from("clients").update({ allow_client_edit_brand_brain: checked } as any).eq("id", clientData.id);
                }} />
              </div>
              {trackingEnabled && (
                <>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-foreground flex items-center gap-2">
                      <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                      Tracking ativo
                    </label>
                    <Switch checked={trackingEnabled} onCheckedChange={(checked) => { if (!checked) disableTracking(); }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-foreground flex items-center gap-2">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      Tracking visível
                    </label>
                    <Switch checked={trackingVisibleToClient} onCheckedChange={async (visible) => {
                      setTrackingVisibleToClient(visible);
                      await supabase.from("clients").update({ tracking_visible_to_client: visible }).eq("id", clientData.id);
                    }} />
                  </div>
                </>
              )}
            </div>

            {/* Automations */}
            <div className="px-5 py-4 space-y-2">
              <KanbanAutomationsPanel clientId={clientData.id} columns={columns} />
            </div>

            {/* Portal Title */}
            <div className="px-5 py-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">Título do Portal</p>
              <Input
                placeholder="Ex: Post da approvare"
                defaultValue={clientData.client_portal_title || ""}
                onBlur={async (e) => {
                  const val = e.target.value.trim();
                  await supabase.from("clients").update({ client_portal_title: val } as any).eq("id", clientData.id);
                }}
              />
              <p className="text-[11px] text-muted-foreground">Título exibido na área do cliente. Deixe vazio para usar o padrão.</p>
            </div>
            <div className="px-5 py-4 border-t">
              <ClientBillingConfig clientId={clientData.id} />
            </div>

            {/* Billing Permissions */}
            <div className="px-5 border-t">
              <BillingPermissionsPanel clientId={clientData.id} />
            </div>

            {/* Language */}
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Idioma</p>
              <LanguageSelector />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Right Sidebar for Notes & Links */}
      <ClientRightSidebar
        clientId={clientData.id}
        trackerPanel={
          <ClientTrackerPanel
            locale={clientLocale}
            onLocaleChange={updateClientLocale}
            trackingEnabled={trackingEnabled}
            onTrackingEnabledChange={(checked) => {
              if (checked && !trackingEnabled) return enableTracking();
              if (!checked && trackingEnabled) return disableTracking();
            }}
            viewItems={[
              {
                key: "tracking",
                label: "Tracking visível",
                checked: trackingVisibleToClient,
                onCheckedChange: async (checked) => {
                  setTrackingVisibleToClient(checked);
                  await supabase.from("clients").update({ tracking_visible_to_client: checked }).eq("id", clientData.id);
                },
                icon: <BarChart3 className="h-4 w-4" />,
              },
              {
                key: "archived",
                label: "Arquivados",
                checked: showArchivedToClient,
                onCheckedChange: toggleShowArchivedToClient,
                icon: <Archive className="h-4 w-4" />,
              },
              {
                key: "upcoming-posts",
                label: "Próximos posts",
                checked: showUpcomingPosts,
                onCheckedChange: async (checked) => {
                  setShowUpcomingPosts(checked);
                  await supabase.from("clients").update({ show_upcoming_posts: checked } as any).eq("id", clientData.id);
                },
                icon: <CalendarClock className="h-4 w-4" />,
              },
            ]}
            actionItems={[
              {
                key: "edit-caption",
                label: "Editar legenda",
                checked: allowClientEditCaption,
                onCheckedChange: toggleAllowClientEditCaption,
                icon: <Pencil className="h-4 w-4" />,
              },
              {
                key: "create-posts",
                label: "Criar posts",
                checked: allowClientCreatePost,
                onCheckedChange: toggleAllowClientCreatePost,
                icon: <Plus className="h-4 w-4" />,
              },
              {
                key: "download-content",
                label: "Baixar conteúdo",
                checked: allowClientDownload,
                onCheckedChange: toggleAllowClientDownload,
                icon: <Download className="h-4 w-4" />,
              },
              {
                key: "create-tags",
                label: "Criar tags",
                checked: allowClientCreateTags,
                onCheckedChange: toggleAllowClientCreateTags,
                icon: <ClipboardList className="h-4 w-4" />,
              },
              {
                key: "edit-brand-brain",
                label: "Editar Brand Brain",
                checked: allowClientEditBrandBrain,
                onCheckedChange: async (checked) => {
                  setAllowClientEditBrandBrain(checked);
                  await supabase.from("clients").update({ allow_client_edit_brand_brain: checked } as any).eq("id", clientData.id);
                },
                icon: <Sparkles className="h-4 w-4" />,
              },
            ]}
            columns={columns.map((column) => ({
              id: column.id,
              name: column.name,
              visibleToClient: column.visibleToClient,
            }))}
            onToggleColumn={toggleColumnVisibility}
          />
        }
      />

      <main className="mx-auto max-w-full p-4 sm:p-6">
        {/* Tab switcher */}
        <div className="mb-6 flex flex-col sm:flex-row items-center justify-center gap-2">
          <div className="flex rounded-lg border bg-muted p-1">
            <button
              onClick={() => setActiveTab("board")}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === "board" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="mr-1.5 inline h-4 w-4" /> {t("board")}
            </button>
            <button
              onClick={() => setActiveTab("archived")}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === "archived" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              <Archive className="mr-1.5 inline h-4 w-4" /> {t("archived")}
              {archivedPosts.length > 0 && (
                <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-[10px] font-semibold">
                  {archivedPosts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("texts")}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === "texts" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              <FileText className="mr-1.5 inline h-4 w-4" /> Textos
            </button>
            <button
              onClick={() => setCalendarOpen(true)}
              className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors text-muted-foreground hover:text-foreground"
            >
              <CalendarClock className="mr-1.5 inline h-4 w-4" /> Calendário
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === "activity" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              <History className="mr-1.5 inline h-4 w-4" /> Atividades
            </button>
            <button
              onClick={() => navigate(`/client/${clientData.slug}/brand-brain`)}
              className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors text-muted-foreground hover:text-foreground"
            >
              <Sparkles className="mr-1.5 inline h-4 w-4" /> Brand Brain
            </button>
          </div>
          {/* Compact search popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={`relative flex items-center justify-center h-9 w-9 rounded-md border bg-muted/50 hover:bg-muted transition-colors ${searchQuery ? "ring-2 ring-accent" : ""}`}
                title="Buscar cards"
                aria-label="Buscar cards"
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                {searchQuery && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar cards (ativos + arquivados)..."
                  className="pl-9 pr-9 h-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>
          {/* Desktop-only permission toggles */}
          {activeTab === "archived" && (
            <div className="hidden md:flex items-center gap-2 ml-3">
              <Switch
                id="show-archived-client"
                checked={showArchivedToClient}
                onCheckedChange={toggleShowArchivedToClient}
              />
              <label htmlFor="show-archived-client" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                {showArchivedToClient ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {showArchivedToClient ? t("visibleToClient") : t("hiddenFromClient")}
              </label>
            </div>
          )}
          {activeTab === "board" && (
            <div className="hidden md:flex items-center gap-4 ml-3">
              {trackingEnabled && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="tracking-toggle"
                    checked={trackingEnabled}
                    onCheckedChange={(checked) => { if (!checked) disableTracking(); }}
                  />
                  <label htmlFor="tracking-toggle" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                    <ClipboardList className="h-3.5 w-3.5" />
                    {t("trackingActive")}
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {normalizedQuery ? (
          <div className="mx-auto max-w-7xl">
            <p className="mb-4 text-sm text-muted-foreground text-center">
              {searchResults.length} {searchResults.length === 1 ? "resultado" : "resultados"} para "{searchQuery}"
            </p>
            {searchResults.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-12 text-center">
                <Search className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum card encontrado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {searchResults.map(({ post, archived }) => (
                  <div key={post.id} className="relative">
                    {archived && (
                      <span className="absolute top-2 right-2 z-10 rounded-full bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-md flex items-center gap-1">
                        <Archive className="h-2.5 w-2.5" /> {t("archived")}
                      </span>
                    )}
                    <PostCard
                      post={post}
                      isAdmin
                      onEdit={() => setEditPost(post)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === "board" ? (
          <>
            <div className="mb-8 flex items-center justify-center gap-2">
              {editingPeriod ? (
                <Input
                  ref={periodInputRef}
                  value={periodDraft}
                  onChange={(e) => setPeriodDraft(e.target.value)}
                  onBlur={savePeriod}
                  onKeyDown={(e) => { if (e.key === "Enter") savePeriod(); if (e.key === "Escape") { setPeriodDraft(postingPeriod); setEditingPeriod(false); } }}
                  placeholder={t("editPeriodPlaceholder")}
                  className="max-w-xs text-center text-2xl font-bold border-accent"
                />
              ) : (
                <button
                  onClick={() => { setPeriodDraft(postingPeriod); setEditingPeriod(true); }}
                  className="group flex items-center gap-2 text-2xl font-bold text-foreground hover:text-accent transition-colors"
                >
                  {postingPeriod || t("clickToSetPeriod")}
                  <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                </button>
              )}
            </div>

            {view === "kanban" ? (
              <div className="flex gap-4 h-[calc(100dvh-260px)] min-h-[500px]">
                <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
                  <KanbanBoard
                    posts={posts}
                    columns={columns}
                    unassignedPosts={unassignedPosts}
                    editingColumnId={editingColumnId}
                    editingColumnName={editingColumnName}
                    setEditingColumnId={setEditingColumnId}
                    setEditingColumnName={setEditingColumnName}
                    editColumnInputRef={editColumnInputRef}
                    handleRenameColumn={handleRenameColumn}
                    handleDeleteColumn={handleDeleteColumn}
                    updatePostStatus={updatePostStatus}
                    deletePost={deletePost}
                    updatePost={updatePost}
                    setDetailPost={(p: Post) => setEditPost(p)}
                    setCreateInColumnId={setCreateInColumnId}
                    setCreateOpen={setCreateOpen}
                    addingColumn={addingColumn}
                    setAddingColumn={setAddingColumn}
                    newColumnName={newColumnName}
                    setNewColumnName={setNewColumnName}
                    newColumnInputRef={newColumnInputRef}
                    handleAddColumn={handleAddColumn}
                    movePostToColumn={movePostToColumn}
                    reorderPostsInColumn={reorderPostsInColumn}
                    t={t}
                    toggleColumnVisibility={toggleColumnVisibility}
                    setColumnColor={setColumnColor}
                    selectionMode={selectionMode}
                    selectedPostIds={selectedPostIds}
                    onToggleSelect={toggleSelect}
                    reorderColumns={reorderColumns}
                    clientId={clientData.id}
                    billingCurrency={(clientData as any).billing_currency}
                  />
                </div>
                {trackingEnabled && (
                  <TrackingDrawer
                    clientId={clientData.id}
                    posts={posts}
                    columns={columns}
                    tags={tags}
                    isAdmin
                    visibleToClient={trackingVisibleToClient}
                    onToggleVisibility={async (visible) => {
                      setTrackingVisibleToClient(visible);
                      await supabase.from("clients").update({ tracking_visible_to_client: visible }).eq("id", clientData.id);
                    }}
                    trackingColumnIds={trackingColumnIds}
                    onChangeTrackingColumnIds={async (ids) => {
                      setTrackingColumnIds(ids);
                      await supabase.from("clients").update({ tracking_column_ids: ids } as any).eq("id", clientData.id);
                    }}
                  />
                )}
                
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    isAdmin
                    onStatusChange={(s) => updatePostStatus(post.id, s)}
                    onDelete={() => deletePost(post.id)}
                    onEdit={() => setEditPost(post)}
                    onArchive={() => updatePost(post.id, { archived: true, archivedAt: new Date() })}
                    selectionMode={selectionMode}
                    isSelected={selectedPostIds.has(post.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            )}
          </>
        ) : activeTab === "archived" ? (
          <div className="h-[calc(100vh-200px)] overflow-hidden">
            <ArchivedView
              archivedPosts={archivedPosts}
              columns={columns}
              unarchivePost={unarchivePost}
              deletePost={deletePost}
              selectionMode={selectionMode}
              selectedPostIds={selectedPostIds}
              onToggleSelect={toggleSelect}
              t={t}
            />
          </div>
        ) : activeTab === "texts" ? (
          <div className="mx-auto max-w-4xl">
            <TextContentsPanel clientId={clientData.id} clientName={clientData.name} isAdmin />
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            <ActivityTimeline
              logs={activityLogs.logs}
              loading={activityLogs.loading}
              hasMore={activityLogs.hasMore}
              onLoadMore={activityLogs.loadMore}
              showFilters
              showClientName={false}
            />
          </div>
        )}
      </main>

      {/* Floating bulk action bar */}
      {selectionMode && selectedPostIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border bg-card px-5 py-3 shadow-xl">
          <span className="text-sm font-semibold text-foreground">{selectedPostIds.size} {t("selected")}</span>
          <div className="h-6 w-px bg-border" />
          {activeTab === "board" ? (
            <>
              <Select onValueChange={(v) => handleBulkStatusChange([v as PostStatus])}>
                <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
                  <SelectValue placeholder={t("changeStatus")} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_CONFIG) as PostStatus[]).map((key) => (
                    <SelectItem key={key} value={key}>{STATUS_CONFIG[key].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {columns.length > 0 && (
                <Select onValueChange={(v) => handleBulkMoveToColumn(v)}>
                  <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
                    <SelectValue placeholder={t("moveToColumn")} />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                    ))}
                    <SelectItem value="__unassigned__">{t("noColumn")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange(["finalizado"])}>
                <Archive className="mr-1.5 h-3.5 w-3.5" /> {t("archive")}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={handleBulkUnarchive}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {t("restore")}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleBulkDelete}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> {t("deleteAction")}
          </Button>
          <div className="h-6 w-px bg-border" />
          <Button size="sm" variant="ghost" onClick={exitSelectionMode}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <CreatePostDialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreateAsPauta(false); }} defaultColumnId={createInColumnId} defaultIsPauta={createAsPauta} />
      <EditPostDialog post={editPost} open={!!editPost} onOpenChange={(open) => { if (!open) setEditPost(null); }} />
      <PostCardDialog
        post={detailPost}
        open={!!detailPost}
        onOpenChange={(open) => { if (!open) setDetailPost(null); }}
        isAdmin
        onStatusChange={detailPost ? (s) => updatePostStatus(detailPost.id, s) : undefined}
        onDelete={detailPost ? () => { deletePost(detailPost.id); setDetailPost(null); } : undefined}
        onEdit={detailPost ? () => { setEditPost(detailPost); setDetailPost(null); } : undefined}
      />

      {/* Calendar Modal */}
      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" /> Calendário de Postagens — {clientData.name}
            </DialogTitle>
          </DialogHeader>
          <ClientCalendarWidget clientId={clientData.id} clientName={clientData.name} />
        </DialogContent>
      </Dialog>

    </div>
  );
};

const AdminPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const { data } = await supabase.from("clients").select("*").eq("slug", slug).maybeSingle();
      if (!data) {
        navigate("/admin");
        return;
      }
      setClientData(data as ClientData);
      setLoading(false);
    };
    load();
  }, [slug, navigate]);

  if (loading || !clientData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <PostsProvider clientId={clientData.id} clientLogo={clientData.logo_url} clientPostingPeriod={clientData.posting_period}>
      <AdminPageInner clientData={clientData} />
    </PostsProvider>
  );
};

export default AdminPage;
