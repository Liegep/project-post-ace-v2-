import { ReactNode, useState, useEffect, useCallback } from "react";
import { StickyNote, Link as LinkIcon, X, Copy, ExternalLink, NotebookPen, SlidersHorizontal, Lightbulb } from "lucide-react";
import { GradientHeartIcon } from "@/components/GradientHeartIcon";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ClientNotes } from "@/components/ClientNotes";
import { ClientLinksPanel } from "@/components/ClientLinksPanel";
import { QuickLinksPanel } from "@/components/QuickLinksPanel";
import { QuickDraftNotes } from "@/components/QuickDraftNotes";
import { ClientIdeasPanel } from "@/components/ClientIdeasPanel";

type Tab = "notes" | "drafts" | "links" | "quick" | "tracker" | "ideas" | null;

interface Props {
  clientId: string;
  trackerPanel?: ReactNode;
}

// Use Sheet (drawer) on anything below desktop (lg = 1024px) to avoid the
// fixed side panel covering kanban content on tablets.
function useUseSheet() {
  const [useSheet, setUseSheet] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setUseSheet(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return useSheet;
}

export function ClientRightSidebar({ clientId, trackerPanel }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(null);
  const [notesCount, setNotesCount] = useState(0);
  const [draftsCount, setDraftsCount] = useState(0);
  const [linksCount, setLinksCount] = useState(0);
  const [ideasCount, setIdeasCount] = useState(0);
  const isMobile = useUseSheet();

  const open = activeTab !== null;

  const handleTabClick = useCallback((tab: Tab) => {
    setActiveTab(prev => prev === tab ? null : tab);
  }, []);

  const close = useCallback(() => setActiveTab(null), []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  const tabs = [
    {
      id: "notes" as const,
      label: "Recados",
      icon: StickyNote,
      count: notesCount,
      color: "bg-amber-500",
      hoverColor: "hover:bg-amber-400",
      textColor: "text-amber-500",
      bgLight: "bg-amber-50 dark:bg-amber-500/10",
    },
    {
      id: "drafts" as const,
      label: "Rascunhos",
      icon: NotebookPen,
      count: draftsCount,
      color: "bg-yellow-500",
      hoverColor: "hover:bg-yellow-400",
      textColor: "text-yellow-600",
      bgLight: "bg-yellow-50 dark:bg-yellow-500/10",
    },
    {
      id: "links" as const,
      label: "Links",
      icon: LinkIcon,
      count: linksCount,
      color: "bg-blue-500",
      hoverColor: "hover:bg-blue-400",
      textColor: "text-blue-500",
      bgLight: "bg-blue-50 dark:bg-blue-500/10",
    },
    {
      id: "ideas" as const,
      label: "Ideias de Pauta",
      icon: Lightbulb,
      count: ideasCount,
      color: "bg-amber-500",
      hoverColor: "hover:bg-amber-400",
      textColor: "text-amber-600",
      bgLight: "bg-amber-50 dark:bg-amber-500/10",
    },
    {
      id: "quick" as const,
      label: "Rápidos",
      icon: GradientHeartIcon,
      count: 0,
      color: "bg-transparent",
      hoverColor: "hover:bg-emerald-500 hover:text-white",
      textColor: "text-foreground",
      bgLight: "bg-muted/40",
    },
    ...(trackerPanel ? [{
      id: "tracker" as const,
      label: "Tracker",
      icon: SlidersHorizontal,
      count: 0,
      color: "bg-emerald-500",
      hoverColor: "hover:bg-emerald-400",
      textColor: "text-emerald-600",
      bgLight: "bg-emerald-50 dark:bg-emerald-500/10",
    }] : []),
  ];

  const headerBg = activeTab === "notes"
    ? "bg-amber-50 dark:bg-amber-500/10"
    : activeTab === "drafts"
    ? "bg-yellow-50 dark:bg-yellow-500/10"
    : activeTab === "links"
    ? "bg-blue-50 dark:bg-blue-500/10"
    : activeTab === "ideas"
    ? "bg-amber-50 dark:bg-amber-500/10"
    : activeTab === "tracker"
    ? "bg-emerald-50 dark:bg-emerald-500/10"
    : "opacity-60 bg-lime-100";

  const headerIcon = activeTab === "notes"
    ? <StickyNote className="h-5 w-5 text-amber-500" />
    : activeTab === "drafts"
    ? <NotebookPen className="h-5 w-5 text-yellow-600" />
    : activeTab === "links"
    ? <LinkIcon className="h-5 w-5 text-blue-500" />
    : activeTab === "ideas"
    ? <Lightbulb className="h-5 w-5 text-amber-600" />
    : activeTab === "tracker"
    ? <SlidersHorizontal className="h-5 w-5 text-emerald-500" />
    : <GradientHeartIcon className="h-5 w-5" />;

  const headerTitle = activeTab === "notes"
    ? "Recados"
    : activeTab === "drafts"
    ? "Rascunhos"
    : activeTab === "links"
    ? "Links do Cliente"
    : activeTab === "ideas"
    ? "Ideias de Pauta"
    : activeTab === "tracker"
    ? "Tracker"
    : "Links Rápidos";

  // Mobile: use Sheet
  if (isMobile) {
    return (
      <>
        {/* Floating tabs on the right edge */}
        <div className="fixed right-ui-4 top-1/2 z-floating-widget flex -translate-y-1/2 flex-col gap-ui-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "flex items-center gap-ui-1 rounded-ui-lg px-ui-2 py-ui-3 shadow-lg transition-all duration-200",
                "border border-r-0 border-border/50 backdrop-blur-sm",
                activeTab === tab.id
                  ? `${tab.color} text-white`
                  : "bg-card/95 text-muted-foreground hover:text-foreground hover:shadow-xl"
              )}
            >
              <tab.icon className="size-icon-sm" />
              {tab.count > 0 && (
                <span className={cn(
                  "rounded-ui-full px-ui-2 py-ui-1 text-ui-xs font-bold leading-none",
                  activeTab === tab.id ? "bg-white/30 text-white" : `${tab.color} text-white`
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <Sheet open={open} onOpenChange={(v) => !v && close()}>
          <SheetContent side="right" className="w-full bg-card p-0 sm:w-[380px]">
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className={cn("flex items-center justify-between border-b px-ui-5 py-ui-4", headerBg)}>
                <div className="flex items-center gap-ui-2">
                  {headerIcon}
                  <h2 className="font-semibold text-foreground">{headerTitle}</h2>
                </div>
                <button onClick={close} className="rounded-ui-full p-ui-2 transition-colors hover:bg-black/10">
                  <X className="size-icon-sm" />
                </button>
              </div>

              {/* Tab switcher */}
              <div className="flex border-b">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-ui-2 py-ui-3 text-ui-sm font-medium transition-colors",
                      activeTab === tab.id
                        ? `border-b-2 ${tab.textColor}`
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    style={activeTab === tab.id ? { borderColor: "currentColor" } : undefined}
                  >
                    <tab.icon className="size-icon-sm" />
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={cn("rounded-ui-full px-ui-2 py-ui-1 text-ui-xs font-bold text-white", tab.color)}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-ui-4">
                {activeTab === "notes" && (
                  <ClientNotes clientId={clientId} onCountChange={setNotesCount} />
                )}
                {activeTab === "drafts" && (
                  <QuickDraftNotes clientId={clientId} onCountChange={setDraftsCount} />
                )}
                {activeTab === "links" && (
                  <ClientLinksPanel clientId={clientId} onCountChange={setLinksCount} />
                )}
                {activeTab === "ideas" && <ClientIdeasPanel clientId={clientId} onCountChange={setIdeasCount} />}
                {activeTab === "quick" && <QuickLinksPanel />}
                {activeTab === "tracker" && trackerPanel}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop: overlay panel
  return (
    <>
      {/* Backdrop when open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
          onClick={close}
        />
      )}

      {/* Fixed tabs on the right edge */}
      <div className="fixed right-ui-4 top-1/2 z-floating-widget flex -translate-y-1/2 flex-col gap-ui-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              "group flex items-center gap-ui-2 rounded-ui-lg pl-ui-3 pr-ui-2 py-ui-3 shadow-lg transition-all duration-200",
              "border border-r-0 border-border/50",
              activeTab === tab.id
                ? `${tab.color} text-white shadow-xl`
                : `bg-card text-muted-foreground ${tab.hoverColor} hover:text-white hover:shadow-xl`
            )}
          >
            <tab.icon className="size-icon-sm" />
            <span className={cn(
              "overflow-hidden whitespace-nowrap text-ui-xs font-medium transition-all duration-200",
              activeTab === tab.id ? "max-w-24 opacity-100" : "max-w-0 opacity-0 group-hover:max-w-24 group-hover:opacity-100"
            )}>
              {tab.label}
            </span>
            {tab.count > 0 && (
              <span className={cn(
                "rounded-ui-full px-ui-2 py-ui-1 text-ui-xs font-bold leading-none",
                activeTab === tab.id ? "bg-white/30 text-white" : `${tab.color} text-white`
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div
        className={cn(
          "fixed right-ui-4 top-ui-4 z-floating-panel h-[calc(100vh-2rem)] w-[380px] rounded-ui-lg border bg-card shadow-2xl",
          "transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "translate-x-[calc(100%+1rem)]"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className={cn("flex items-center justify-between border-b px-ui-5 py-ui-4", headerBg)}>
            <div className="flex items-center gap-ui-2">
              {headerIcon}
              <h2 className="font-semibold text-foreground">{headerTitle}</h2>
            </div>
            <button onClick={close} className="rounded-ui-full p-ui-2 transition-colors hover:bg-muted">
              <X className="size-icon-sm" />
            </button>
          </div>

          {/* Tab switcher */}
          <div className="flex border-b">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-ui-2 py-ui-3 text-ui-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? `border-b-2 ${tab.textColor}`
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={activeTab === tab.id ? { borderColor: "currentColor" } : undefined}
              >
                <tab.icon className="size-icon-sm" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={cn("rounded-ui-full px-ui-2 py-ui-1 text-ui-xs font-bold text-white", tab.color)}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-ui-4">
            {activeTab === "notes" && (
              <ClientNotes clientId={clientId} onCountChange={setNotesCount} />
            )}
            {activeTab === "drafts" && (
              <QuickDraftNotes clientId={clientId} onCountChange={setDraftsCount} />
            )}
            {activeTab === "links" && (
              <ClientLinksPanel clientId={clientId} onCountChange={setLinksCount} />
            )}
            {activeTab === "ideas" && <ClientIdeasPanel clientId={clientId} onCountChange={setIdeasCount} />}
            {activeTab === "quick" && <QuickLinksPanel />}
            {activeTab === "tracker" && trackerPanel}
          </div>
        </div>
      </div>
    </>
  );
}
