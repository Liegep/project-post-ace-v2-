import { useState, useEffect } from "react";
import { Post, Tag } from "@/types/post";
import { TrackingPanel } from "@/components/TrackingPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { BarChart3, Pin, PinOff, X, Filter, Eye, EyeOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface TrackingDrawerProps {
  clientId: string;
  posts: Post[];
  columns?: { id: string; name: string }[];
  tags?: Tag[];
  isAdmin?: boolean;
  visibleToClient?: boolean;
  onToggleVisibility?: (visible: boolean) => void;
  trackingColumnIds?: string[];
  onChangeTrackingColumnIds?: (ids: string[]) => void;
  locale?: string;
}

const TD_T: Record<string, { tracking: string; visibleColumns: string; visibleColumnsHelp: string; visibleToClient: string; hiddenFromClient: string; pin: string; unpin: string; close: string }> = {
  pt: { tracking: "Acompanhamento", visibleColumns: "Colunas visíveis para o cliente", visibleColumnsHelp: "Se nada for selecionado, o cliente verá todas as colunas.", visibleToClient: "Visível para o cliente", hiddenFromClient: "Oculto para o cliente", pin: "Fixar na tela", unpin: "Desafixar", close: "Fechar" },
  en: { tracking: "Tracking", visibleColumns: "Columns visible to client", visibleColumnsHelp: "If nothing is selected, the client will see all columns.", visibleToClient: "Visible to client", hiddenFromClient: "Hidden from client", pin: "Pin to screen", unpin: "Unpin", close: "Close" },
  it: { tracking: "Monitoraggio", visibleColumns: "Colonne visibili al cliente", visibleColumnsHelp: "Se nulla è selezionato, il cliente vedrà tutte le colonne.", visibleToClient: "Visibile al cliente", hiddenFromClient: "Nascosto al cliente", pin: "Fissa allo schermo", unpin: "Sblocca", close: "Chiudi" },
  es: { tracking: "Seguimiento", visibleColumns: "Columnas visibles para el cliente", visibleColumnsHelp: "Si nada está seleccionado, el cliente verá todas las columnas.", visibleToClient: "Visible para el cliente", hiddenFromClient: "Oculto para el cliente", pin: "Fijar en pantalla", unpin: "Desfijar", close: "Cerrar" },
  sv: { tracking: "Uppföljning", visibleColumns: "Kolumner synliga för klienten", visibleColumnsHelp: "Om inget är valt ser klienten alla kolumner.", visibleToClient: "Synlig för klient", hiddenFromClient: "Dold för klient", pin: "Fäst på skärmen", unpin: "Lossa", close: "Stäng" },
};

const PINNED_KEY = "tracking-drawer-pinned";

export const TrackingDrawer = (props: TrackingDrawerProps) => {
  const td = TD_T[(props.locale as string) in TD_T ? (props.locale as string) : "pt"];
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem(PINNED_KEY) === "true";
    } catch {
      return false;
    }
  });

  // For client view, filter posts by selected tracking columns (if any configured)
  const filteredPosts = (() => {
    if (props.isAdmin) return props.posts;
    const ids = props.trackingColumnIds || [];
    if (ids.length === 0) return props.posts;
    return props.posts.filter((p) => p.columnId && ids.includes(p.columnId));
  })();
  const effectiveProps = { ...props, posts: filteredPosts };

  const itemCount = filteredPosts.length;

  // Sync pinned state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PINNED_KEY, String(pinned));
    } catch {}
  }, [pinned]);

  // On mobile, never pin
  const effectivePinned = !isMobile && pinned;

  const togglePin = () => {
    if (isMobile) return;
    setPinned((prev) => !prev);
  };

  // Admin controls shown in drawer header (filter + visibility)
  const AdminHeaderControls = () => {
    if (!props.isAdmin) return null;
    return (
      <>
        {props.onChangeTrackingColumnIds && (props.columns?.length ?? 0) > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "rounded-md p-1.5 border transition-colors",
                  (props.trackingColumnIds && props.trackingColumnIds.length > 0)
                    ? "text-primary border-primary/40 bg-primary/10 hover:bg-primary/20"
                    : "text-foreground border-border bg-background/60 hover:bg-muted"
                )}
                title={td.visibleColumns}
              >
                <Filter className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3 z-[60]">
              <div className="mb-ui-2 text-ui-xs font-semibold text-foreground">
                {td.visibleColumns}
              </div>
              <div className="mb-ui-2 text-ui-xs text-muted-foreground">
                {td.visibleColumnsHelp}
              </div>
              <div className="max-h-60 space-y-ui-2 overflow-y-auto">
                {(props.columns || []).map((col) => {
                  const selected = (props.trackingColumnIds || []).includes(col.id);
                  return (
                    <label
                      key={col.id}
                      className="flex cursor-pointer items-center gap-ui-2 rounded-ui-sm px-ui-2 py-ui-1 hover:bg-muted"
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) => {
                          const current = props.trackingColumnIds || [];
                          const next = checked
                            ? [...current, col.id]
                            : current.filter((id) => id !== col.id);
                          props.onChangeTrackingColumnIds?.(next);
                        }}
                      />
                      <span className="truncate text-ui-xs text-foreground">{col.name}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {props.onToggleVisibility && (
          <button
            onClick={() => props.onToggleVisibility?.(!props.visibleToClient)}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              props.visibleToClient
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title={props.visibleToClient ? td.visibleToClient : td.hiddenFromClient}
          >
            {props.visibleToClient ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        )}
      </>
    );
  };

  // Floating trigger button

  const TriggerButton = () => (
    <div className="widget-fab-shell">
      <button onClick={() => setOpen(true)} className="widget-fab-button relative" title={td.tracking}>
        <BarChart3 className="size-icon-lg text-primary" />
        {itemCount > 0 && (
          <span className="absolute right-ui-1 top-ui-1 flex h-6 w-6 items-center justify-center rounded-ui-full bg-primary text-ui-xs font-bold text-primary-foreground shadow">
            {itemCount}
          </span>
        )}
      </button>
    </div>
  );

  // Pinned mode: inline panel on the right
  if (effectivePinned) {
    return (
      <div className="fixed right-ui-4 top-16 z-floating-panel flex h-[calc(100vh-5rem)] w-80 flex-col overflow-hidden rounded-ui-lg border bg-card shadow-lg animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between border-b px-ui-4 py-ui-3">
          <h3 className="flex items-center gap-ui-2 text-ui-sm font-bold text-foreground">
            <BarChart3 className="size-icon-sm text-primary" />
            {td.tracking}
            {itemCount > 0 && (
              <span className="rounded-ui-full bg-primary/10 px-ui-2 py-ui-1 text-ui-xs font-semibold text-primary">
                {itemCount}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-ui-1">
            <AdminHeaderControls />
            <button
              onClick={togglePin}
              className="rounded-ui-md p-ui-2 text-primary transition-colors hover:bg-primary/10"
              title={td.unpin}
            >
              <PinOff className="size-icon-sm" />
            </button>
            <button
              onClick={() => { setPinned(false); setOpen(false); }}
              className="rounded-ui-md p-ui-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={td.close}
            >
              <X className="size-icon-sm" />
            </button>
          </div>

        </div>
        <div className="flex-1 overflow-y-auto p-ui-4">
          <TrackingPanelInline {...effectiveProps} />
        </div>
      </div>
    );
  }

  return (
    <>
      {!open && <TriggerButton />}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className={cn(
            "p-0 flex flex-col",
            isMobile ? "w-[340px] max-w-[85vw]" : "w-[360px]"
          )}
        >
          <SheetHeader className="border-b px-ui-4 pt-ui-4 pb-ui-3">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-ui-2 text-ui-sm font-bold">
                <BarChart3 className="size-icon-sm text-primary" />
                {td.tracking}
                {itemCount > 0 && (
                  <span className="rounded-ui-full bg-primary/10 px-ui-2 py-ui-1 text-ui-xs font-semibold text-primary">
                    {itemCount}
                  </span>
                )}
              </SheetTitle>
              <div className="flex items-center gap-ui-1">
                <AdminHeaderControls />
                {!isMobile && (
                  <button
                    onClick={togglePin}
                    className="rounded-ui-md p-ui-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={td.pin}
                  >
                    <Pin className="size-icon-sm" />
                  </button>
                )}
              </div>

            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-ui-4">
            <TrackingPanelInline {...effectiveProps} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

const TrackingPanelInline = (props: TrackingDrawerProps) => {
  return (
    <div className="[&>div]:w-full [&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&>div]:shadow-none [&>div>div:first-child]:hidden">
      <TrackingPanel
        clientId={props.clientId}
        posts={props.posts}
        columns={props.columns}
        tags={props.tags}
        isAdmin={props.isAdmin}
        visibleToClient={props.visibleToClient}
        onToggleVisibility={props.onToggleVisibility}
        trackingColumnIds={props.trackingColumnIds}
        onChangeTrackingColumnIds={props.onChangeTrackingColumnIds}
      />
    </div>
  );
};
