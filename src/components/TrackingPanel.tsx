import { Post, Tag } from "@/types/post";
import { Check, Circle, Eye, EyeOff, GripVertical, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

interface TrackingPanelProps {
  clientId: string;
  posts: Post[];
  columns?: { id: string; name: string }[];
  tags?: Tag[];
  isAdmin?: boolean;
  visibleToClient?: boolean;
  onToggleVisibility?: (visible: boolean) => void;
  trackingColumnIds?: string[];
  onChangeTrackingColumnIds?: (ids: string[]) => void;
}

interface ProjectGroup {
  projectTitle: string;
  posts: Post[];
}

function isPostFinished(post: Post, tags: Tag[]): boolean {
  // Check status
  if (post.status.includes("finalizado")) return true;
  // Check tags - find any tag named "Finalizado" (case-insensitive)
  const finalizadoTagIds = tags
    .filter((t) => t.name.toLowerCase() === "finalizado")
    .map((t) => t.id);
  return post.tags.some((tagId) => finalizadoTagIds.includes(tagId));
}

function getColumnName(post: Post, columns: { id: string; name: string }[]): string {
  if (!post.columnId) return "";
  const col = columns.find((c) => c.id === post.columnId);
  return col?.name || "";
}

function getContrastText(hex: string): string {
  const m = (hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return "#ffffff";
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}

function SortableProjectGroup({
  group,
  columns,
  tags,
}: {
  group: ProjectGroup;
  columns: { id: string; name: string }[];
  tags: Tag[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.projectTitle,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const totalItems = group.posts.length;
  const doneItems = group.posts.filter((p) => isPostFinished(p, tags)).length;
  const allDone = totalItems > 0 && doneItems === totalItems;
  const progressPercent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-ui-lg border bg-card p-ui-3 shadow-sm transition-all",
        allDone && "border-success/30 bg-success/5"
      )}
    >
      {/* Project header */}
      <div className="mb-ui-2 flex items-center gap-ui-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground shrink-0"
        >
          <GripVertical className="size-icon-sm" />
        </button>
        <div className="flex-1 min-w-0">
          <h4
            className={cn(
              "text-sm font-bold truncate",
              allDone ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {group.projectTitle}
          </h4>
          <div className="mt-ui-1 flex items-center gap-ui-2">
            <div className="flex-1 overflow-hidden rounded-ui-full bg-muted h-2">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  allDone ? "bg-success" : "bg-primary"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="shrink-0 text-ui-xs font-medium text-muted-foreground">
              {doneItems}/{totalItems}
            </span>
          </div>
        </div>
      </div>

      {/* Deliverables list */}
      <div className="space-y-ui-1 pl-ui-5">
        {group.posts.map((post) => {
          const finished = isPostFinished(post, tags);
          const postTags = post.tags
            .map((id) => tags.find((t) => t.id === id))
            .filter(Boolean) as Tag[];
          return (
            <div
              key={post.id}
              className={cn(
                "flex items-start gap-ui-2 rounded-ui-md px-ui-2 py-ui-2 transition-colors",
                finished ? "opacity-50" : "hover:bg-muted/50"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-ui-sm border-2 transition-colors",
                  finished
                    ? "border-success bg-success"
                    : "border-muted-foreground/40 bg-transparent"
                )}
              >
                {finished && <Check className="size-icon-xs text-success-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    "block truncate text-ui-xs font-medium",
                    finished
                      ? "line-through text-muted-foreground"
                      : "text-foreground"
                  )}
                >
                  {post.title}
                </span>
                {postTags.length > 0 && (
                  <div className="mt-ui-1 flex flex-wrap gap-ui-1">
                    {postTags.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center rounded-ui-sm px-ui-2 py-ui-1 text-ui-xs font-bold uppercase leading-tight tracking-wide"
                        style={{
                          backgroundColor: t.color,
                          color: getContrastText(t.color),
                        }}
                        title={t.name}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {!finished && (
                <Circle
                  className={cn(
                    "mt-ui-1 h-2 w-2 shrink-0 fill-current",
                    post.status.includes("em_desenvolvimento")
                      ? "text-warning"
                      : post.status.includes("alteracao_solicitada")
                      ? "text-destructive"
                      : post.status.includes("pronto")
                      ? "text-primary"
                      : "text-muted-foreground/40"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const TrackingPanel = ({
  clientId,
  posts,
  columns = [],
  tags = [],
  isAdmin = false,
  visibleToClient,
  onToggleVisibility,
  trackingColumnIds,
  onChangeTrackingColumnIds,
}: TrackingPanelProps) => {
  const [orderedKeys, setOrderedKeys] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const savedOrderRef = useRef<string[]>([]);

  // Group posts by column (project)
  const projectGroups = useMemo(() => {
    const map = new Map<string, Post[]>();
    posts.forEach((post) => {
      const col = columns.find((c) => c.id === post.columnId);
      const key = col?.name || "Sem coluna";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(post);
    });
    const groups: ProjectGroup[] = [];
    map.forEach((groupPosts, projectTitle) => {
      groups.push({ projectTitle, posts: groupPosts });
    });
    return groups;
  }, [posts, columns]);

  // Load saved order from DB
  useEffect(() => {
    const loadOrder = async () => {
      const { data } = await supabase
        .from("tracking_order" as any)
        .select("post_ids")
        .eq("client_id", clientId)
        .maybeSingle();
      if (data) {
        savedOrderRef.current = (data as any).post_ids || [];
      }
      setLoaded(true);
    };
    loadOrder();
  }, [clientId]);

  // Apply saved order
  useEffect(() => {
    if (!loaded) return;
    const savedKeys = savedOrderRef.current;
    const currentKeys = projectGroups.map((g) => g.projectTitle);
    if (savedKeys.length > 0) {
      const ordered: string[] = [];
      for (const key of savedKeys) {
        if (currentKeys.includes(key)) ordered.push(key);
      }
      for (const key of currentKeys) {
        if (!ordered.includes(key)) ordered.push(key);
      }
      setOrderedKeys(ordered);
    } else {
      setOrderedKeys(currentKeys);
    }
  }, [projectGroups, loaded]);

  const orderedGroups = useMemo(() => {
    const map = new Map(projectGroups.map((g) => [g.projectTitle, g]));
    return orderedKeys
      .map((key) => map.get(key))
      .filter(Boolean) as ProjectGroup[];
  }, [orderedKeys, projectGroups]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const saveOrder = useCallback(
    async (keys: string[]) => {
      savedOrderRef.current = keys;
      await supabase
        .from("tracking_order" as any)
        .upsert(
          { client_id: clientId, post_ids: keys, updated_at: new Date().toISOString() } as any,
          { onConflict: "client_id" }
        );
    },
    [clientId]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedKeys((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      const newOrder = arrayMove(prev, oldIndex, newIndex);
      saveOrder(newOrder);
      return newOrder;
    });
  };

  return (
    <div className="w-80 shrink-0 rounded-xl border bg-gradient-to-b from-card to-card/80 p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          📊 Acompanhamento
        </h3>
        <div className="flex items-center gap-1">
          {isAdmin && onChangeTrackingColumnIds && columns.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "rounded-md p-1.5 border transition-colors",
                    (trackingColumnIds && trackingColumnIds.length > 0)
                      ? "text-primary border-primary/40 bg-primary/10 hover:bg-primary/20"
                      : "text-foreground border-border bg-background/60 hover:bg-muted"
                  )}
                  title="Colunas visíveis para o cliente"
                >
                  <Filter className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3">
                <div className="mb-2 text-xs font-semibold text-foreground">
                  Colunas visíveis para o cliente
                </div>
                <div className="mb-2 text-[11px] text-muted-foreground">
                  Se nada for selecionado, o cliente verá todas as colunas.
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {columns.map((col) => {
                    const selected = (trackingColumnIds || []).includes(col.id);
                    return (
                      <label
                        key={col.id}
                        className="flex items-center gap-2 cursor-pointer rounded px-1.5 py-1 hover:bg-muted"
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={(checked) => {
                            const current = trackingColumnIds || [];
                            const next = checked
                              ? [...current, col.id]
                              : current.filter((id) => id !== col.id);
                            onChangeTrackingColumnIds(next);
                          }}
                        />
                        <span className="text-xs text-foreground truncate">{col.name}</span>
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {isAdmin && onToggleVisibility && (
            <button
              onClick={() => onToggleVisibility(!visibleToClient)}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                visibleToClient
                  ? "text-primary hover:bg-primary/10"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={visibleToClient ? "Visível para o cliente" : "Oculto para o cliente"}
            >
              {visibleToClient ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
        {orderedGroups.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedKeys} strategy={verticalListSortingStrategy}>
              {orderedGroups.map((group) => (
                <SortableProjectGroup
                  key={group.projectTitle}
                  group={group}
                  columns={columns}
                  tags={tags}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Nenhum projeto para acompanhar
          </p>
        )}
      </div>
    </div>
  );
};
