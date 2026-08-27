import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useBrandBrain, VocabularyStatus } from "@/hooks/useBrandBrain";
import { getBbDict } from "@/lib/brandBrainI18n";
import { parseSpreadsheetFile, importVocabularyRows, downloadVocabularyTemplate, parseExpressionsFile, importExpressionRows, downloadExpressionsTemplate } from "@/lib/brandVocabularyImport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, Copy, Sparkles, Upload, Download, BookOpen, Layers, Mic, Ban, MessageSquareQuote, Palette, ArrowRight, Home } from "lucide-react";

interface ClientLite { id: string; name: string; logo_url: string; slug: string; locale: string }

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
    {message}
  </div>
);

const STATUS_LABEL: Record<VocabularyStatus, { label: string; className: string }> = {
  approved: { label: "Aprovado", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  avoid: { label: "Evitar", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  forbidden: { label: "Proibido", className: "bg-red-500/15 text-red-700 dark:text-red-300" },
};

export default function BrandBrainPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const [client, setClient] = useState<ClientLite | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);

  useEffect(() => {
    if (!slug) return;
    supabase.from("clients").select("id, name, logo_url, slug, locale, allow_client_edit_brand_brain").eq("slug", slug).maybeSingle().then(({ data }) => {
      setClient((data as ClientLite) || null);
      setLoadingClient(false);
    });
  }, [slug]);

  const isTeam = role === "super_admin" || role === "admin" || role === "colaborador";
  const canEdit = isTeam || (role === "client" && !!(client as any)?.allow_client_edit_brand_brain);
  const data = useBrandBrain(client?.id);
  const t = useMemo(() => getBbDict(client?.locale), [client?.locale]);
  const [tab, setTab] = useState<string>("home");

  if (loadingClient || roleLoading) {
    return <div className="p-10 text-center text-muted-foreground">…</div>;
  }
  if (!client) {
    return <div className="p-10 text-center text-muted-foreground">Cliente não encontrado.</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/client/${slug}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {client.logo_url && <img src={client.logo_url} alt="" className="h-12 w-12 rounded-lg border object-contain" />}
            <div>
              <h1 className="type-heading">{client.name}</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> {t.subtitle}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="flex w-full overflow-x-auto sm:flex-wrap h-auto justify-start gap-1 bg-muted/50 p-1">
            <TabsTrigger value="home" className="text-xs sm:text-sm whitespace-nowrap">{t.tab_home}</TabsTrigger>
            <TabsTrigger value="overview" className="text-xs sm:text-sm whitespace-nowrap">{t.tab_overview}</TabsTrigger>
            <TabsTrigger value="vocabulary" className="text-xs sm:text-sm whitespace-nowrap">{t.tab_vocabulary}</TabsTrigger>
            <TabsTrigger value="pillars" className="text-xs sm:text-sm whitespace-nowrap">{t.tab_pillars}</TabsTrigger>
            <TabsTrigger value="voice" className="text-xs sm:text-sm whitespace-nowrap">{t.tab_voice}</TabsTrigger>
            <TabsTrigger value="avoid" className="text-xs sm:text-sm whitespace-nowrap">{t.tab_avoid}</TabsTrigger>
            <TabsTrigger value="expressions" className="text-xs sm:text-sm whitespace-nowrap">{t.tab_expressions}</TabsTrigger>
            <TabsTrigger value="visual" className="text-xs sm:text-sm whitespace-nowrap">{t.tab_visual}</TabsTrigger>
            {canEdit && <TabsTrigger value="ai" className="text-xs sm:text-sm whitespace-nowrap">{t.tab_ai}</TabsTrigger>}
          </TabsList>

          <TabsContent value="home" className="mt-6">
            <HomeTab data={data} t={t} clientName={client.name} logoUrl={client.logo_url} goTo={setTab} />
          </TabsContent>
          <TabsContent value="overview" className="mt-6">
            <OverviewTab clientId={client.id} canEdit={canEdit} data={data} t={t} />
          </TabsContent>
          <TabsContent value="vocabulary" className="mt-6">
            <VocabularyTab clientId={client.id} canEdit={canEdit} data={data} t={t} />
          </TabsContent>
          <TabsContent value="pillars" className="mt-6">
            <PillarsTab clientId={client.id} canEdit={canEdit} data={data} t={t} />
          </TabsContent>
          <TabsContent value="voice" className="mt-6">
            <VoiceTab clientId={client.id} canEdit={canEdit} data={data} />
          </TabsContent>
          <TabsContent value="avoid" className="mt-6">
            <AvoidTab clientId={client.id} canEdit={canEdit} data={data} t={t} />
          </TabsContent>
          <TabsContent value="expressions" className="mt-6">
            <ExpressionsTab clientId={client.id} canEdit={canEdit} data={data} t={t} />
          </TabsContent>
          <TabsContent value="visual" className="mt-6">
            <VisualTab clientId={client.id} canEdit={canEdit} data={data} t={t} />
          </TabsContent>
          {canEdit && (
            <TabsContent value="ai" className="mt-6">
              <AiPromptsTab clientName={client.name} data={data} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

type DataBundle = ReturnType<typeof useBrandBrain>;
type Dict = ReturnType<typeof getBbDict>;

/* -------------------- Home -------------------- */
function HomeTab({ data, t, clientName, logoUrl, goTo }: { data: DataBundle; t: Dict; clientName: string; logoUrl?: string; goTo: (v: string) => void }) {
  const { brain, voices, pillars, vocabulary, avoid, expressions, visuals } = data;
  const hasIdentity = !!(brain?.mission || brain?.vision || brain?.summary);
  const primaryVoice = voices?.[0];

  const sections: { key: string; label: string; desc: string; count: number; icon: typeof BookOpen; gradient: string }[] = [
    { key: "vocabulary", label: t.tab_vocabulary, desc: t.nav.vocabulary, count: vocabulary.length, icon: BookOpen, gradient: "from-sky-500/20 to-blue-500/5" },
    { key: "pillars", label: t.tab_pillars, desc: t.nav.pillars, count: pillars.length, icon: Layers, gradient: "from-violet-500/20 to-purple-500/5" },
    { key: "voice", label: t.tab_voice, desc: t.nav.voice, count: voices.length, icon: Mic, gradient: "from-rose-500/20 to-pink-500/5" },
    { key: "avoid", label: t.tab_avoid, desc: t.nav.avoid, count: avoid.length, icon: Ban, gradient: "from-amber-500/20 to-orange-500/5" },
    { key: "expressions", label: t.tab_expressions, desc: t.nav.expressions, count: expressions.length, icon: MessageSquareQuote, gradient: "from-emerald-500/20 to-teal-500/5" },
    { key: "visual", label: t.tab_visual, desc: t.nav.visual, count: visuals.length, icon: Palette, gradient: "from-fuchsia-500/20 to-pink-500/5" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="glass-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          {logoUrl && (
            <img src={logoUrl} alt="" className="h-16 w-16 rounded-2xl border bg-card object-contain p-1.5 shadow-md sm:h-20 sm:w-20" />
          )}
          <div className="flex-1">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" /> Brand Brain
            </div>
            <h2 className="text-2xl font-bold leading-tight tracking-tight sm:text-4xl">{t.home_welcome}</h2>
            {clientName && <p className="mt-1 text-sm font-medium text-muted-foreground">{clientName}</p>}
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{t.home_intro}</p>
          </div>
        </div>
      </div>

      {/* Identity summary — horizontal stack */}
      {hasIdentity ? (
        <div className="space-y-3">
          {[
            { label: t.mission, value: brain?.mission, accent: "bg-sky-500" },
            { label: t.vision, value: brain?.vision, accent: "bg-violet-500" },
            { label: t.summary, value: brain?.summary, accent: "bg-emerald-500" },
          ].filter((c) => c.value).map((c) => (
            <div key={c.label} className="glass-card relative overflow-hidden p-5">
              <div className={`absolute inset-y-0 left-0 w-1 ${c.accent}`} />
              <div className="pl-3 sm:flex sm:items-start sm:gap-6">
                <div className="mb-2 sm:mb-0 sm:w-40 sm:shrink-0">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{c.label}</span>
                </div>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-muted-foreground">{t.home_empty}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => goTo("overview")}>
            {t.tab_overview} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Voice highlight */}
      {primaryVoice && (primaryVoice.emotional_tone || primaryVoice.archetype) && (
        <button onClick={() => goTo("voice")} className="glass-card group relative block w-full overflow-hidden p-5 text-left transition-all hover:shadow-lg">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-300">
              <Mic className="h-5 w-5" />
            </div>
            <div className="min-w-[200px] flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {t.tab_voice}{primaryVoice.brand_name ? ` · ${primaryVoice.brand_name}` : ""}
              </div>
              <div className="mt-0.5 text-base font-semibold text-foreground">
                {[primaryVoice.archetype, primaryVoice.emotional_tone].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground transition-transform group-hover:translate-x-1">
              {t.home_open} <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </button>
      )}

      {/* Pillars distribution */}
      {pillars.length > 0 && (() => {
        const palette = ["bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-fuchsia-500", "bg-teal-500", "bg-orange-500"];
        const parsed = pillars.map((p, i) => {
          const m = (p.suggested_frequency || "").match(/(\d+(?:[.,]\d+)?)/);
          const pct = m ? parseFloat(m[1].replace(",", ".")) : 0;
          return { ...p, pct, color: palette[i % palette.length] };
        });
        const total = parsed.reduce((s, p) => s + p.pct, 0);
        const hasPct = total > 0;
        const max = Math.max(...parsed.map((p) => p.pct), 1);
        return (
          <div className="glass-card relative overflow-hidden p-5 sm:p-6">
            <button onClick={() => goTo("pillars")} className="group mb-4 flex w-full items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{t.tab_pillars}</div>
                  <div className="text-base font-semibold text-foreground">{pillars.length} {t.counters.pillars.toLowerCase()}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground transition-transform group-hover:translate-x-1">
                {t.home_open} <ArrowRight className="h-4 w-4" />
              </div>
            </button>

            {hasPct && (
              <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-muted">
                {parsed.filter((p) => p.pct > 0).map((p) => (
                  <div key={p.id} className={`${p.color} transition-all`} style={{ width: `${(p.pct / total) * 100}%` }} title={`${p.name} · ${p.pct}%`} />
                ))}
              </div>
            )}

            <div className="space-y-2.5">
              {parsed.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.color}`} />
                    <span className="truncate text-sm font-medium text-foreground">{p.name}</span>
                    {p.main_emotion && <span className="hidden truncate text-xs text-muted-foreground sm:inline">· {p.main_emotion}</span>}
                  </div>
                  <div className="flex w-32 items-center gap-2 sm:w-48">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${p.color}`} style={{ width: `${(p.pct / max) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs font-semibold tabular-nums text-foreground">
                      {p.pct > 0 ? `${p.pct}%` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Visual identity by brand */}
      {visuals.length > 0 && (() => {
        const groups = new Map<string, typeof visuals>();
        visuals.forEach((v) => {
          const key = v.brand_name?.trim() || "—";
          if (!groups.has(key)) groups.set(key, [] as any);
          (groups.get(key) as any).push(v);
        });
        return (
          <div className="space-y-3">
            <button onClick={() => goTo("visual")} className="group flex w-full items-center justify-between gap-3 text-left">
              <h3 className="text-base font-semibold text-foreground">{t.tab_visual}</h3>
              <div className="flex items-center gap-1 text-sm text-muted-foreground transition-transform group-hover:translate-x-1">
                {t.home_open} <ArrowRight className="h-4 w-4" />
              </div>
            </button>
            <div className="grid gap-3 lg:grid-cols-2">
              {Array.from(groups.entries()).map(([brand, items]) => {
                const allColors = Array.from(new Set(items.flatMap((v) => v.colors || []))).slice(0, 12);
                const typographies = Array.from(new Set(items.map((v) => v.typography).filter(Boolean)));
                return (
                  <div key={brand} className="glass-card relative overflow-hidden p-5">
                    <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
                    <div className="relative">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300">
                          <Palette className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{t.tab_visual}</div>
                          <div className="truncate text-base font-semibold text-foreground">{brand}</div>
                        </div>
                      </div>

                      {allColors.length > 0 && (
                        <div className="mt-4">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Paleta</div>
                          <div className="flex flex-wrap gap-2">
                            {allColors.map((c) => (
                              <div key={c} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-card/60 px-2 py-1 text-[11px] text-foreground backdrop-blur">
                                <span className="h-4 w-4 rounded-full border border-white/20" style={{ background: c }} />
                                <span className="font-mono tabular-nums">{c}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {typographies.length > 0 && (
                        <div className="mt-4">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Tipografia</div>
                          <div className="space-y-3">
                            {typographies.map((tp) => {
                              const fonts = Array.from(tp.matchAll(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 \-]+?)(?=\s*\(|,|$)/g))
                                .map((m) => m[1].trim())
                                .filter(Boolean);
                              const headingFont = fonts[0];
                              const bodyFont = fonts[1] || fonts[0];
                              const ff = (f?: string) => f ? `'${f}', ui-sans-serif, system-ui, sans-serif` : undefined;
                              return (
                                <div key={tp} className="rounded-lg border border-border/40 bg-background/30 p-3">
                                  <p className="mb-2 text-[11px] text-muted-foreground">{tp}</p>
                                  <p className="text-2xl font-semibold leading-tight text-foreground" style={{ fontFamily: ff(headingFont) }}>
                                    {headingFont || "Título da marca"}
                                  </p>
                                  <p className="mt-1 text-sm text-muted-foreground" style={{ fontFamily: ff(bodyFont) }}>
                                    {bodyFont ? `The quick brown fox jumps over the lazy dog — ${bodyFont}` : "The quick brown fox jumps over the lazy dog"}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}


                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {items.map((v) => (
                          <span key={v.id} className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                            {v.category}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Navigation grid (includes Visual) */}
      <div>

        <h3 className="mb-3 text-base font-semibold text-foreground">{t.home_explore}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => goTo(s.key)}
                className="glass-card group relative overflow-hidden p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-50 transition-opacity group-hover:opacity-80`} />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-card/90 text-foreground shadow-sm backdrop-blur">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-2xl font-bold tabular-nums text-foreground/80">{s.count}</span>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                      {s.label}
                      <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">{s.desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>

  );
}



/* -------------------- Overview -------------------- */
function OverviewTab({ clientId, canEdit, data, t }: { clientId: string; canEdit: boolean; data: DataBundle; t: Dict }) {
  const [mission, setMission] = useState("");
  const [vision, setVision] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMission(data.brain?.mission || "");
    setVision(data.brain?.vision || "");
    setSummary(data.brain?.summary || "");
  }, [data.brain]);

  const save = async () => {
    setSaving(true);
    const payload = { client_id: clientId, mission, vision, summary };
    const { error } = data.brain
      ? await supabase.from("brand_brains").update(payload).eq("id", data.brain.id)
      : await supabase.from("brand_brains").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("OK");
    data.refresh();
  };

  const counters = [
    { label: t.counters.vocab, value: data.vocabulary.length },
    { label: t.counters.pillars, value: data.pillars.length },
    { label: t.counters.avoid, value: data.avoid.length },
    { label: t.counters.expr, value: data.expressions.length },
    { label: t.counters.visuals, value: data.visuals.length },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {counters.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>{t.identity}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t.mission}</Label>
            <Textarea value={mission} onChange={(e) => setMission(e.target.value)} disabled={!canEdit} rows={3} maxLength={1000} />
          </div>
          <div>
            <Label>{t.vision}</Label>
            <Textarea value={vision} onChange={(e) => setVision(e.target.value)} disabled={!canEdit} rows={3} maxLength={1000} />
          </div>
          <div>
            <Label>{t.summary}</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} disabled={!canEdit} rows={5} maxLength={3000} />
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>{saving ? t.saving : t.save}</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


/* -------------------- Vocabulary -------------------- */
function VocabularyTab({ clientId, canEdit, data, t }: { clientId: string; canEdit: boolean; data: DataBundle; t: Dict }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const emptyForm = {
    term: "", category: "keyword", emotion: "", status: "approved" as VocabularyStatus, notes: "",
    brand: "", content_type: "", priority: "", frequency: "",
    related_words: "", approved_phrases: "", can_be_used: true, technical_notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      term: item.term || "",
      category: item.category || "keyword",
      emotion: item.emotion || "",
      status: item.status || "approved",
      notes: item.notes || "",
      brand: item.brand || "",
      content_type: item.content_type || "",
      priority: item.priority || "",
      frequency: item.frequency || "",
      related_words: (item.related_words || []).join(", "),
      approved_phrases: (item.approved_phrases || []).join(" | "),
      can_be_used: item.can_be_used !== false,
      technical_notes: item.technical_notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.term.trim()) return toast.error("Termo / Termine *");
    const payload = {
      client_id: clientId,
      term: form.term.trim(),
      category: form.category,
      emotion: form.emotion,
      status: form.status,
      notes: form.notes,
      brand: form.brand,
      content_type: form.content_type,
      priority: form.priority,
      frequency: form.frequency,
      related_words: form.related_words.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
      approved_phrases: form.approved_phrases.split(/\||\n/).map((s) => s.trim()).filter(Boolean),
      can_be_used: form.can_be_used,
      technical_notes: form.technical_notes,
    };
    const { error } = editing
      ? await supabase.from("brand_vocabulary").update(payload).eq("id", editing.id)
      : await supabase.from("brand_vocabulary").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("OK");
    setOpen(false); data.refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("?")) return;
    const { error } = await supabase.from("brand_vocabulary").delete().eq("id", id);
    if (error) return toast.error(error.message);
    data.refresh();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const rows = await parseSpreadsheetFile(file);
      if (!rows.length) { toast.error("Nenhuma linha válida"); return; }
      const { inserted } = await importVocabularyRows(clientId, rows);
      toast.success(`${inserted} ${t.tab_vocabulary.toLowerCase()} → OK`);
      data.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Erro");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
          <Button variant="outline" size="sm" onClick={downloadVocabularyTemplate}>
            <Download className="mr-2 h-4 w-4" /> {t.vocab_template}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="mr-2 h-4 w-4" /> {importing ? "..." : t.vocab_import}
          </Button>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> {t.vocab_new}</Button>
        </div>
      )}
      {data.vocabulary.length === 0 ? (
        <EmptyState message={t.vocab_empty} />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.cols.term}</TableHead>
                <TableHead>{t.cols.category}</TableHead>
                <TableHead>{t.cols.brand}</TableHead>
                <TableHead>{t.cols.contentType}</TableHead>
                <TableHead>{t.cols.priority}</TableHead>
                <TableHead>{t.cols.frequency}</TableHead>
                <TableHead>{t.cols.emotion}</TableHead>
                <TableHead>{t.cols.related}</TableHead>
                <TableHead>{t.cols.phrases}</TableHead>
                <TableHead>{t.cols.canUse}</TableHead>
                <TableHead>{t.cols.notes}</TableHead>
                {canEdit && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.vocabulary.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.term}</TableCell>
                  <TableCell><Badge variant="secondary">{v.category}</Badge></TableCell>
                  <TableCell className="text-sm">{v.brand}</TableCell>
                  <TableCell className="text-sm">{v.content_type}</TableCell>
                  <TableCell className="text-sm">{v.priority}</TableCell>
                  <TableCell className="text-sm">{v.frequency}</TableCell>
                  <TableCell className="text-sm">{v.emotion}</TableCell>
                  <TableCell className="text-xs max-w-[160px] truncate">{(v.related_words || []).join(", ")}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{(v.approved_phrases || []).join(" | ")}</TableCell>
                  <TableCell>
                    <Badge className={v.can_be_used ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-red-500/15 text-red-700 dark:text-red-300"}>
                      {v.can_be_used ? t.yes : t.no}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{v.technical_notes || v.notes}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(v.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? t.cols.term : t.vocab_new}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t.cols.term} *</Label><Input value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} maxLength={120} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t.cols.category}</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={120} />
              </div>
              <div>
                <Label>{t.cols.brand}</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} maxLength={120} />
              </div>
              <div>
                <Label>{t.cols.contentType}</Label>
                <Input value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value })} maxLength={120} />
              </div>
              <div>
                <Label>{t.cols.priority}</Label>
                <Input value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} maxLength={60} />
              </div>
              <div>
                <Label>{t.cols.frequency}</Label>
                <Input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} maxLength={60} />
              </div>
              <div>
                <Label>{t.cols.emotion}</Label>
                <Input value={form.emotion} onChange={(e) => setForm({ ...form, emotion: e.target.value })} maxLength={120} />
              </div>
            </div>
            <div>
              <Label>{t.cols.related}</Label>
              <Input value={form.related_words} onChange={(e) => setForm({ ...form, related_words: e.target.value })} placeholder="a, b, c" />
            </div>
            <div>
              <Label>{t.cols.phrases}</Label>
              <Textarea value={form.approved_phrases} onChange={(e) => setForm({ ...form, approved_phrases: e.target.value })} placeholder="Frase 1 | Frase 2" rows={2} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>{t.cols.canUse}</Label>
              <Switch checked={form.can_be_used} onCheckedChange={(c) => setForm({ ...form, can_be_used: c, status: c ? "approved" : "avoid" })} />
            </div>
            <div><Label>{t.cols.notes}</Label><Textarea value={form.technical_notes} onChange={(e) => setForm({ ...form, technical_notes: e.target.value })} maxLength={500} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={save}>{t.save}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


/* -------------------- Pillars -------------------- */
function PillarsTab({ clientId, canEdit, data, t }: { clientId: string; canEdit: boolean; data: DataBundle; t: Dict }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const empty = { name: "", objective: "", themes: "", main_emotion: "", suggested_frequency: "", notes: "" };
  const [form, setForm] = useState(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name, objective: p.objective, themes: (p.themes || []).join(", "), main_emotion: p.main_emotion, suggested_frequency: p.suggested_frequency, notes: p.notes });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    const payload = {
      client_id: clientId,
      name: form.name,
      objective: form.objective,
      themes: form.themes.split(",").map((s) => s.trim()).filter(Boolean),
      main_emotion: form.main_emotion,
      suggested_frequency: form.suggested_frequency,
      notes: form.notes,
    };
    const { error } = editing
      ? await supabase.from("content_pillars").update(payload).eq("id", editing.id)
      : await supabase.from("content_pillars").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo"); setOpen(false); data.refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este pilar?")) return;
    const { error } = await supabase.from("content_pillars").delete().eq("id", id);
    if (error) return toast.error(error.message);
    data.refresh();
  };

  return (
    <div className="space-y-4">
      {canEdit && <div className="flex justify-end"><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo pilar</Button></div>}
      {data.pillars.length === 0 ? (
        <EmptyState message={t.pillars_empty} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.pillars.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-lg">{p.name}</CardTitle>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {p.objective && <p><span className="font-medium">Objetivo:</span> {p.objective}</p>}
                {p.main_emotion && <p><span className="font-medium">Emoção:</span> {p.main_emotion}</p>}
                {p.suggested_frequency && <p><span className="font-medium">Frequência:</span> {p.suggested_frequency}</p>}
                {p.themes?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {p.themes.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                  </div>
                )}
                {p.notes && <p className="text-muted-foreground pt-2">{p.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar pilar" : "Novo pilar"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} /></div>
            <div><Label>Objetivo</Label><Textarea value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} maxLength={500} /></div>
            <div><Label>Temas relacionados (separados por vírgula)</Label><Input value={form.themes} onChange={(e) => setForm({ ...form, themes: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Emoção principal</Label><Input value={form.main_emotion} onChange={(e) => setForm({ ...form, main_emotion: e.target.value })} maxLength={120} /></div>
              <div><Label>Frequência sugerida</Label><Input value={form.suggested_frequency} onChange={(e) => setForm({ ...form, suggested_frequency: e.target.value })} placeholder="ex.: 30%" maxLength={60} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- Voice -------------------- */
function VoiceTab({ clientId, canEdit, data }: { clientId: string; canEdit: boolean; data: DataBundle }) {
  const voices = data.voices || [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const empty = {
    brand_name: "", emotional_tone: "", archetype: "", writing_rhythm: "", formality_level: "",
    things_to_avoid: "", good_examples: "", bad_examples: "",
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (voices.length && !selectedId && !isNew) setSelectedId(voices[0].id);
  }, [voices, selectedId, isNew]);

  const current = isNew ? null : voices.find((v) => v.id === selectedId) || null;

  useEffect(() => {
    if (current) {
      setForm({
        brand_name: current.brand_name || "",
        emotional_tone: current.emotional_tone,
        archetype: current.archetype,
        writing_rhythm: current.writing_rhythm,
        formality_level: current.formality_level,
        things_to_avoid: current.things_to_avoid,
        good_examples: (current.good_examples || []).join("\n"),
        bad_examples: (current.bad_examples || []).join("\n"),
      });
    } else if (isNew) {
      setForm(empty);
    }
  }, [current, isNew]);

  const buildPayload = () => ({
    client_id: clientId,
    brand_name: form.brand_name,
    emotional_tone: form.emotional_tone,
    archetype: form.archetype,
    writing_rhythm: form.writing_rhythm,
    formality_level: form.formality_level,
    things_to_avoid: form.things_to_avoid,
    good_examples: form.good_examples.split("\n").map((s) => s.trim()).filter(Boolean),
    bad_examples: form.bad_examples.split("\n").map((s) => s.trim()).filter(Boolean),
  });

  const save = async () => {
    setSaving(true);
    const payload = buildPayload();
    const { data: res, error } = current
      ? await supabase.from("brand_voice").update(payload).eq("id", current.id).select().single()
      : await supabase.from("brand_voice").insert(payload).select().single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Voz da marca salva");
    setIsNew(false);
    if (res?.id) setSelectedId(res.id);
    data.refresh();
  };

  const duplicate = async () => {
    if (!current) return;
    setSaving(true);
    const payload = {
      ...buildPayload(),
      brand_name: (form.brand_name || "Marca") + " (cópia)",
    };
    const { data: res, error } = await supabase.from("brand_voice").insert(payload).select().single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Voz duplicada");
    if (res?.id) setSelectedId(res.id);
    data.refresh();
  };

  const remove = async () => {
    if (!current) return;
    if (!confirm("Remover esta voz?")) return;
    const { error } = await supabase.from("brand_voice").delete().eq("id", current.id);
    if (error) return toast.error(error.message);
    setSelectedId(null);
    data.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Tom de voz</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {voices.length > 0 && (
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={isNew ? "__new__" : (selectedId || "")}
                onChange={(e) => {
                  if (e.target.value === "__new__") { setIsNew(true); setSelectedId(null); }
                  else { setIsNew(false); setSelectedId(e.target.value); }
                }}
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>{v.brand_name || "(sem nome)"}</option>
                ))}
                {isNew && <option value="__new__">Nova voz…</option>}
              </select>
            )}
            {canEdit && (
              <>
                <Button size="sm" variant="outline" onClick={() => { setIsNew(true); setSelectedId(null); }}>
                  <Plus className="mr-1 h-4 w-4" /> Nova
                </Button>
                {current && (
                  <Button size="sm" variant="outline" onClick={duplicate} disabled={saving}>
                    Duplicar
                  </Button>
                )}
                {current && voices.length > 1 && (
                  <Button size="sm" variant="ghost" onClick={remove} className="text-destructive">
                    Remover
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div><Label>Nome da marca / conta</Label><Input placeholder="Ex.: @kynagogi_main" value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} disabled={!canEdit} /></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div><Label>Tom emocional</Label><Input value={form.emotional_tone} onChange={(e) => setForm({ ...form, emotional_tone: e.target.value })} disabled={!canEdit} /></div>
          <div><Label>Arquétipo da marca</Label><Input value={form.archetype} onChange={(e) => setForm({ ...form, archetype: e.target.value })} disabled={!canEdit} /></div>
          <div><Label>Ritmo de escrita</Label><Input value={form.writing_rhythm} onChange={(e) => setForm({ ...form, writing_rhythm: e.target.value })} disabled={!canEdit} /></div>
          <div><Label>Nível de formalidade</Label><Input value={form.formality_level} onChange={(e) => setForm({ ...form, formality_level: e.target.value })} disabled={!canEdit} /></div>
        </div>
        <div><Label>O que a marca deve evitar</Label><Textarea value={form.things_to_avoid} onChange={(e) => setForm({ ...form, things_to_avoid: e.target.value })} disabled={!canEdit} rows={3} /></div>
        <div><Label>Exemplos no tom correto (um por linha)</Label><Textarea value={form.good_examples} onChange={(e) => setForm({ ...form, good_examples: e.target.value })} disabled={!canEdit} rows={4} /></div>
        <div><Label>Exemplos fora do tom (um por linha)</Label><Textarea value={form.bad_examples} onChange={(e) => setForm({ ...form, bad_examples: e.target.value })} disabled={!canEdit} rows={4} /></div>
        {canEdit && <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button></div>}
      </CardContent>
    </Card>
  );
}

/* -------------------- Avoid -------------------- */
function AvoidTab({ clientId, canEdit, data, t }: { clientId: string; canEdit: boolean; data: DataBundle; t: Dict }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const empty = { word: "", reason: "", recommended_alternative: "", category: "" };
  const [form, setForm] = useState(empty);

  const save = async () => {
    if (!form.word.trim()) return toast.error("Palavra é obrigatória");
    const payload = { ...form, client_id: clientId };
    const { error } = editing
      ? await supabase.from("words_to_avoid").update(payload).eq("id", editing.id)
      : await supabase.from("words_to_avoid").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo"); setOpen(false); data.refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Remover?")) return;
    const { error } = await supabase.from("words_to_avoid").delete().eq("id", id);
    if (error) return toast.error(error.message);
    data.refresh();
  };

  return (
    <div className="space-y-4">
      {canEdit && <div className="flex justify-end"><Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Nova palavra</Button></div>}
      {data.avoid.length === 0 ? (
        <EmptyState message={t.avoid_empty} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evitar</TableHead>
                <TableHead>Usar no lugar</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Motivo</TableHead>
                {canEdit && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.avoid.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium text-red-600 dark:text-red-400">{w.word}</TableCell>
                  <TableCell className="text-emerald-600 dark:text-emerald-400">{w.recommended_alternative}</TableCell>
                  <TableCell>{w.category && <Badge variant="secondary">{w.category}</Badge>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{w.reason}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(w); setForm(w); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(w.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova palavra a evitar"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Palavra/expressão *</Label><Input value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} maxLength={120} /></div>
            <div><Label>Alternativa recomendada</Label><Input value={form.recommended_alternative} onChange={(e) => setForm({ ...form, recommended_alternative: e.target.value })} maxLength={120} /></div>
            <div><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={60} /></div>
            <div><Label>Motivo</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={500} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- Expressions -------------------- */
function ExpressionsTab({ clientId, canEdit, data, t }: { clientId: string; canEdit: boolean; data: DataBundle; t: Dict }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const empty = { expression: "", usage_context: "", emotion: "", notes: "" };
  const [form, setForm] = useState(empty);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const save = async () => {
    if (!form.expression.trim()) return toast.error("*");
    const payload = { ...form, client_id: clientId };
    const { error } = editing
      ? await supabase.from("approved_expressions").update(payload).eq("id", editing.id)
      : await supabase.from("approved_expressions").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("OK"); setOpen(false); data.refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("?")) return;
    const { error } = await supabase.from("approved_expressions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    data.refresh();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const rows = await parseExpressionsFile(file);
      if (!rows.length) { toast.error("Nenhuma linha válida"); return; }
      const { inserted } = await importExpressionRows(clientId, rows);
      toast.success(`${inserted} → OK`);
      data.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Erro");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
          <Button variant="outline" size="sm" onClick={downloadExpressionsTemplate}>
            <Download className="mr-2 h-4 w-4" /> {t.expr_template}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="mr-2 h-4 w-4" /> {importing ? "..." : t.expr_import}
          </Button>
          <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> {t.expr_new}
          </Button>
        </div>
      )}
      {data.expressions.length === 0 ? (
        <EmptyState message={t.expr_empty} />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.cols.expression}</TableHead>
                <TableHead>{t.cols.context}</TableHead>
                <TableHead>{t.cols.emotion}</TableHead>
                <TableHead>{t.cols.obs}</TableHead>
                {canEdit && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.expressions.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium max-w-[320px]">{e.expression}</TableCell>
                  <TableCell className="text-sm">{e.usage_context}</TableCell>
                  <TableCell className="text-sm">{e.emotion && <Badge variant="secondary">{e.emotion}</Badge>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{e.notes}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setForm({ expression: e.expression, usage_context: e.usage_context, emotion: e.emotion, notes: e.notes }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t.cols.expression : t.expr_new}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t.cols.expression} *</Label><Textarea value={form.expression} onChange={(e) => setForm({ ...form, expression: e.target.value })} maxLength={500} /></div>
            <div><Label>{t.cols.context}</Label><Input value={form.usage_context} onChange={(e) => setForm({ ...form, usage_context: e.target.value })} maxLength={200} /></div>
            <div><Label>{t.cols.emotion}</Label><Input value={form.emotion} onChange={(e) => setForm({ ...form, emotion: e.target.value })} maxLength={120} /></div>
            <div><Label>{t.cols.obs}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} /></div>
          </div>
          <DialogFooter><Button onClick={save}>{t.save}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- Visual -------------------- */
function VisualTab({ clientId, canEdit, data, t }: { clientId: string; canEdit: boolean; data: DataBundle; t: Dict }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const empty = { brand_name: "", category: "", direction: "", colors: "", image_style: "", lighting: "", composition: "", typography: "", things_to_avoid: "" };
  const [form, setForm] = useState(empty);

  const openEdit = (v: any) => {
    setEditing(v);
    setForm({ ...empty, ...v, colors: (v.colors || []).join(", ") });
    setOpen(true);
  };

  const save = async () => {
    if (!form.category.trim()) return toast.error("Categoria é obrigatória");
    const payload = {
      client_id: clientId,
      brand_name: form.brand_name,
      category: form.category,
      direction: form.direction,
      colors: form.colors.split(",").map((s) => s.trim()).filter(Boolean),
      image_style: form.image_style,
      lighting: form.lighting,
      composition: form.composition,
      typography: form.typography,
      things_to_avoid: form.things_to_avoid,
    };
    const { error } = editing
      ? await supabase.from("visual_directions").update(payload).eq("id", editing.id)
      : await supabase.from("visual_directions").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo"); setOpen(false); data.refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover?")) return;
    const { error } = await supabase.from("visual_directions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    data.refresh();
  };

  return (
    <div className="space-y-4">
      {canEdit && <div className="flex justify-end"><Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Nova direção</Button></div>}
      {data.visuals.length === 0 ? (
        <EmptyState message={t.visual_empty} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.visuals.map((v) => (
            <Card key={v.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{v.category}</CardTitle>
                  {v.brand_name && <p className="mt-0.5 text-xs font-medium text-muted-foreground">{v.brand_name}</p>}
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(v.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {v.direction && <p>{v.direction}</p>}
                {v.colors?.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {v.colors.map((c) => (
                      <div key={c} className="flex items-center gap-1.5 text-xs">
                        <span className="h-4 w-4 rounded border" style={{ background: c }} />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                )}
                {v.typography && <p><span className="font-medium">Tipografia:</span> {v.typography}</p>}
                {v.image_style && <p><span className="font-medium">Estilo:</span> {v.image_style}</p>}
                {v.lighting && <p><span className="font-medium">Iluminação:</span> {v.lighting}</p>}
                {v.composition && <p><span className="font-medium">Composição:</span> {v.composition}</p>}
                {v.things_to_avoid && <p className="text-muted-foreground"><span className="font-medium">Evitar:</span> {v.things_to_avoid}</p>}
              </CardContent>

            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar direção visual" : "Nova direção visual"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Marca</Label><Input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} maxLength={120} placeholder="Nome da marca" /></div>
              <div><Label>Categoria/tipo de conteúdo *</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={120} /></div>
            </div>
            <div><Label>Direção visual</Label><Textarea value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} maxLength={500} /></div>
            <div><Label>Cores (hex, separadas por vírgula)</Label><Input value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} placeholder="#0d1b2a, #2dd4a8" /></div>
            <div><Label>Tipografia</Label><Input value={form.typography} onChange={(e) => setForm({ ...form, typography: e.target.value })} maxLength={200} placeholder="ex.: Inter (títulos), Lora (corpo)" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Estilo de imagem</Label><Input value={form.image_style} onChange={(e) => setForm({ ...form, image_style: e.target.value })} maxLength={200} /></div>
              <div><Label>Iluminação</Label><Input value={form.lighting} onChange={(e) => setForm({ ...form, lighting: e.target.value })} maxLength={200} /></div>
            </div>
            <div><Label>Composição</Label><Input value={form.composition} onChange={(e) => setForm({ ...form, composition: e.target.value })} maxLength={200} /></div>
            <div><Label>O que evitar visualmente</Label><Textarea value={form.things_to_avoid} onChange={(e) => setForm({ ...form, things_to_avoid: e.target.value })} maxLength={500} /></div>
          </div>

          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- AI Prompts -------------------- */
function AiPromptsTab({ clientName, data }: { clientName: string; data: DataBundle }) {
  const [pillarId, setPillarId] = useState<string>("");
  const [contentType, setContentType] = useState("post");
  const [emotion, setEmotion] = useState("");
  const [objective, setObjective] = useState("");
  const [format, setFormat] = useState("legenda");
  const [visualId, setVisualId] = useState<string>("");

  const generated = useMemo(() => {
    const pillar = data.pillars.find((p) => p.id === pillarId);
    const visual = data.visuals.find((v) => v.id === visualId);
    const approvedVocab = data.vocabulary.filter((v) => v.status === "approved").map((v) => v.term);
    const forbidden = [
      ...data.vocabulary.filter((v) => v.status !== "approved").map((v) => v.term),
      ...data.avoid.map((w) => w.word),
    ];
    const tone = data.voice?.emotional_tone || "(tom não definido)";
    const archetype = data.voice?.archetype;
    const expressions = data.expressions.slice(0, 5).map((e) => `"${e.expression}"`);

    const lines: string[] = [];
    lines.push(`Crie ${format === "legenda" ? "uma legenda" : format === "roteiro" ? "um roteiro" : format === "carrossel" ? "um carrossel" : format === "imagem" ? "uma direção de imagem" : format === "arte" ? "uma direção de arte" : format === "campanha" ? "uma campanha" : "um conteúdo"} para a marca ${clientName}.`);
    if (pillar) lines.push(`Pilar de conteúdo: ${pillar.name}${pillar.objective ? ` — ${pillar.objective}` : ""}.`);
    lines.push(`Tipo de conteúdo: ${contentType}.`);
    lines.push(`Tom de voz: ${tone}${archetype ? ` (arquétipo: ${archetype})` : ""}.`);
    if (emotion) lines.push(`Emoção desejada: ${emotion}.`);
    if (objective) lines.push(`Objetivo do post: ${objective}.`);
    if (approvedVocab.length) lines.push(`Use palavras como: ${approvedVocab.slice(0, 15).join(", ")}.`);
    if (forbidden.length) lines.push(`Evite os termos: ${forbidden.slice(0, 15).join(", ")}.`);
    if (expressions.length) lines.push(`Inspire-se em expressões aprovadas: ${expressions.join(", ")}.`);
    if (visual) {
      lines.push(`Direção visual (${visual.category}): ${visual.direction}${visual.image_style ? `, estilo ${visual.image_style}` : ""}${visual.lighting ? `, iluminação ${visual.lighting}` : ""}${visual.composition ? `, composição ${visual.composition}` : ""}.`);
      if (visual.colors?.length) lines.push(`Paleta sugerida: ${visual.colors.join(", ")}.`);
    }
    if (data.voice?.things_to_avoid) lines.push(`Não use: ${data.voice.things_to_avoid}.`);
    return lines.join("\n");
  }, [data, pillarId, contentType, emotion, objective, format, visualId, clientName]);

  const copy = async () => {
    await navigator.clipboard.writeText(generated);
    toast.success("Prompt copiado");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Configurar prompt</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Pilar de conteúdo</Label>
            <Select value={pillarId} onValueChange={setPillarId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {data.pillars.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de conteúdo</Label>
            <Input value={contentType} onChange={(e) => setContentType(e.target.value)} placeholder="ex.: post, reel, story" />
          </div>
          <div>
            <Label>Emoção desejada</Label>
            <Input value={emotion} onChange={(e) => setEmotion(e.target.value)} />
          </div>
          <div>
            <Label>Objetivo do post</Label>
            <Input value={objective} onChange={(e) => setObjective(e.target.value)} />
          </div>
          <div>
            <Label>Formato</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="legenda">Legenda</SelectItem>
                <SelectItem value="roteiro">Roteiro</SelectItem>
                <SelectItem value="arte">Arte</SelectItem>
                <SelectItem value="carrossel">Carrossel</SelectItem>
                <SelectItem value="imagem">Imagem</SelectItem>
                <SelectItem value="campanha">Campanha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Direção visual (opcional)</Label>
            <Select value={visualId} onValueChange={setVisualId}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                {data.visuals.map((v) => <SelectItem key={v.id} value={v.id}>{v.category}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Prompt gerado</CardTitle>
          <Button size="sm" variant="outline" onClick={copy}><Copy className="mr-2 h-4 w-4" /> Copiar</Button>
        </CardHeader>
        <CardContent>
          <Textarea readOnly value={generated} rows={18} className="font-mono text-xs bg-white text-black" />
        </CardContent>
      </Card>
    </div>
  );
}
