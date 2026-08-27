import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Locale, LOCALE_LABELS, LOCALE_FLAGS } from "@/i18n/translations";
import { supabase } from "@/integrations/supabase/client";
import {
  useCreateReport, useUpdateReport, useSocialReportTemplates, useSaveTemplate,
  METRIC_LABELS, DEFAULT_METRIC_FIELDS, INSTAGRAM_METRIC_FIELDS, FACEBOOK_METRIC_FIELDS,
  SocialReportMetrics,
} from "@/hooks/useSocialReports";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { MobileNav } from "@/components/MobileNav";
import UserProfileMenu from "@/components/UserProfileMenu";
import {
  ArrowLeft, Save, BookTemplate, Instagram, Facebook,
  TrendingUp, TrendingDown, Minus, MessageSquareText, Send
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CsvUploadPanel, CsvParsedExtra } from "@/components/reports/CsvUploadPanel";
import { ReportCharts } from "@/components/reports/ReportCharts";
import { CsvDataTable } from "@/components/reports/CsvDataTable";
import { CsvDataCharts, MetricKey as CsvMetricKey } from "@/components/reports/CsvDataCharts";
import { TopContentPanel, TopContentData, EMPTY_TOP_CONTENT } from "@/components/reports/TopContentPanel";
import { cn } from "@/lib/utils";

interface Client { id: string; name: string; slug: string; logo_url: string; }

export default function CreateReportPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEditMode = !!editId;
  const createReport = useCreateReport();
  const updateReport = useUpdateReport();
  const saveTemplate = useSaveTemplate();
  const { data: templates = [] } = useSocialReportTemplates();
  const { userId } = useUserRole();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [strategicComment, setStrategicComment] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [bestContent, setBestContent] = useState("");
  const [worstContent, setWorstContent] = useState("");
  const [bestFormat, setBestFormat] = useState("");
  const [observations, setObservations] = useState("");
  const [activeFields, setActiveFields] = useState<string[]>(DEFAULT_METRIC_FIELDS);
  const [metrics, setMetrics] = useState<SocialReportMetrics>({});
  const [prevMetrics, setPrevMetrics] = useState<SocialReportMetrics>({});
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [sendToClient, setSendToClient] = useState(false);
  const [reportLocale, setReportLocale] = useState<Locale>("pt");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, unknown>[]>([]);
  const [csvMapping, setCsvMapping] = useState<Partial<Record<CsvMetricKey, string>>>({});
  const [csvDateColumn, setCsvDateColumn] = useState<string | null>(null);
  const [topContent, setTopContent] = useState<TopContentData>(EMPTY_TOP_CONTENT);

  // When platform changes, swap default metric fields (Instagram vs Facebook) — skip in edit mode
  useEffect(() => {
    if (isEditMode) return;
    setActiveFields(platform === "facebook" ? FACEBOOK_METRIC_FIELDS : INSTAGRAM_METRIC_FIELDS);
  }, [platform, isEditMode]);

  const handleCsvParsed = (
    csvMetrics: SocialReportMetrics,
    csvPrevMetrics: SocialReportMetrics,
    fields: string[],
    extra?: CsvParsedExtra,
  ) => {
    setMetrics(csvMetrics);
    setPrevMetrics(csvPrevMetrics);
    setActiveFields(fields);
    if (extra?.periodStart) setPeriodStart(extra.periodStart);
    if (extra?.periodEnd) setPeriodEnd(extra.periodEnd);
    if (extra?.campaignTitle && !title) setTitle(extra.campaignTitle);
    if (extra?.rawHeaders) setCsvHeaders(extra.rawHeaders);
    if (extra?.rawRows) setCsvRows(extra.rawRows);
    if (extra?.mapping) setCsvMapping(extra.mapping as Partial<Record<CsvMetricKey, string>>);
    setCsvDateColumn(extra?.dateColumn ?? null);
  };

  useEffect(() => {
    const fetch = async () => {
      if (!userId) return;
      const { data: assignments } = await supabase.from("user_client_assignments").select("client_id").eq("user_id", userId);
      const ids = (assignments || []).map((a: any) => a.client_id);
      const { data: owned } = await supabase.from("clients").select("id").eq("owner_id", userId);
      const allIds = [...new Set([...ids, ...(owned || []).map((c: any) => c.id)])];
      if (allIds.length > 0) {
        const { data } = await supabase.from("clients").select("id, name, slug, logo_url").in("id", allIds).order("name");
        setClients((data as Client[]) || []);
      }
    };
    fetch();
  }, [userId]);

  // Load report data when editing
  useEffect(() => {
    if (!editId) return;
    const loadReport = async () => {
      const { data, error } = await supabase
        .from("social_reports")
        .select("*")
        .eq("id", editId)
        .single();
      if (error || !data) {
        toast({ title: "Erro ao carregar relatório", variant: "destructive" });
        return;
      }
      const r: any = data;
      setClientId(r.client_id || "");
      setTitle(r.title || "");
      setPlatform(r.platform || "instagram");
      setPeriodStart(r.period_start || "");
      setPeriodEnd(r.period_end || "");
      setStrategicComment(r.strategic_comment || "");
      setRecommendations(r.recommendations || "");
      setBestContent(r.best_content || "");
      setWorstContent(r.worst_content || "");
      setBestFormat(r.best_format || "");
      setReportLocale((r.locale as Locale) || "pt");
      setMetrics((r.metrics as SocialReportMetrics) || {});
      setPrevMetrics((r.previous_metrics as SocialReportMetrics) || {});
      // Decode observations + topContent
      try {
        const parsed = JSON.parse(r.observations || "");
        if (parsed && typeof parsed === "object" && ("text" in parsed || "top_content" in parsed)) {
          setObservations(parsed.text || "");
          if (parsed.top_content) setTopContent({ ...EMPTY_TOP_CONTENT, ...parsed.top_content });
        } else {
          setObservations(r.observations || "");
        }
      } catch {
        setObservations(r.observations || "");
      }
      // Active fields = keys with values
      const keys = Object.keys((r.metrics as SocialReportMetrics) || {}).filter(
        (k) => (r.metrics as any)[k] !== undefined && (r.metrics as any)[k] !== null,
      );
      if (keys.length > 0) setActiveFields(keys);
      if (r.status === "published") setSendToClient(true);
    };
    loadReport();
  }, [editId]);

  const toggleField = (field: string) => {
    setActiveFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const applyTemplate = (templateId: string) => {
    const t = templates.find(t => t.id === templateId);
    if (t) {
      setActiveFields(t.metric_fields as string[]);
      toast({ title: `Modelo "${t.name}" aplicado` });
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    try {
      await saveTemplate.mutateAsync({ name: templateName, created_by: userId, metric_fields: activeFields });
      toast({ title: "Modelo salvo!" });
      setShowTemplateSave(false);
      setTemplateName("");
    } catch {
      toast({ title: "Erro ao salvar modelo", variant: "destructive" });
    }
  };

  const handleSubmit = async (status: string) => {
    if (!clientId || !periodStart || !periodEnd) {
      toast({ title: "Preencha cliente e período", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const client = clients.find(c => c.id === clientId);
      // Encode top content into observations as JSON (preserving any free text the user typed)
      const observationsPayload = JSON.stringify({
        text: observations,
        top_content: topContent,
      });
      const payload = {
        client_id: clientId,
        title: title || `Relatório ${client?.name || ""} - ${platform}`,
        period_start: periodStart,
        period_end: periodEnd,
        platform,
        strategic_comment: strategicComment,
        recommendations,
        metrics: metrics as any,
        previous_metrics: prevMetrics as any,
        best_content: bestContent,
        worst_content: worstContent,
        best_format: bestFormat,
        observations: observationsPayload,
        locale: reportLocale,
        status,
      };
      let reportId = editId;
      if (isEditMode && editId) {
        await updateReport.mutateAsync({ id: editId, ...payload });
      } else {
        const created = await createReport.mutateAsync({ ...payload, created_by: userId });
        reportId = created.id;
      }
      // When (re)publishing, clear seen markers so clients see it as new again
      if (status === "published" && reportId) {
        await supabase.from("client_seen_items").delete().eq("item_id", reportId).eq("item_type", "report");
      }

      toast({ title: status === "published" ? (isEditMode ? "Relatório republicado!" : "Relatório publicado!") : "Rascunho salvo!" });
      navigate(`/reports/${reportId}`);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-header">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <MobileNav title={isEditMode ? "Editar Relatório" : "Novo Relatório"} />
            <Button variant="ghost" size="icon" className="group bg-white hover:bg-foreground shadow-md border border-border/40 transition-colors" onClick={() => navigate("/reports")}>
              <ArrowLeft className="h-5 w-5 text-black group-hover:text-white transition-colors" strokeWidth={2.5} />
            </Button>
            <h1 className="type-heading">{isEditMode ? "Editar Relatório" : "Novo Relatório"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <UserProfileMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 md:px-6 space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Informações básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          {c.logo_url && <img src={c.logo_url} className="h-4 w-4 rounded-full" alt="" />}
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Plataforma</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram"><span className="flex items-center gap-2"><Instagram className="h-3.5 w-3.5" />Instagram</span></SelectItem>
                    <SelectItem value="facebook"><span className="flex items-center gap-2"><Facebook className="h-3.5 w-3.5" />Facebook</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Idioma do relatório</Label>
                <Select value={reportLocale} onValueChange={(v) => setReportLocale(v as Locale)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        <span className="flex items-center gap-2">
                          {LOCALE_FLAGS[loc]} {LOCALE_LABELS[loc]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Título do relatório</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Relatório Mensal Janeiro 2026" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Período início *</Label>
                <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Período fim *</Label>
                <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CSV Upload */}
        <CsvUploadPanel onMetricsParsed={handleCsvParsed} />

        {/* Summary Cards (always visible once any metric is set) */}
        {Object.keys(metrics).length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="glass-card border-primary/20">
              <CardContent className="p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alcance total</p>
                <p className="text-2xl font-semibold mt-1">{Number(metrics.reach ?? 0).toLocaleString("pt-BR")}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-primary/20">
              <CardContent className="p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Impressões totais</p>
                <p className="text-2xl font-semibold mt-1">{Number(metrics.impressions ?? 0).toLocaleString("pt-BR")}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-primary/20">
              <CardContent className="p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Investimento total</p>
                <p className="text-2xl font-semibold mt-1">
                  {Number(metrics.spend ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pretty-print CSV table */}
        {csvRows.length > 0 && csvHeaders.length > 0 && (
          <CsvDataTable headers={csvHeaders} rows={csvRows} />
        )}

        {/* Rich CSV Charts (per-row analysis) */}
        {csvRows.length > 0 && Object.keys(csvMapping).length > 0 && (
          <CsvDataCharts
            headers={csvHeaders}
            rows={csvRows}
            mapping={csvMapping}
            dateColumn={csvDateColumn}
          />
        )}

        {/* Live Chart Preview (aggregated totals) */}
        {Object.keys(metrics).filter(k => metrics[k] !== undefined).length > 0 && (
          <ReportCharts metrics={metrics} prevMetrics={prevMetrics} locale={reportLocale} />
        )}

        {/* Strategic Comment */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-primary" />
              Comentário Estratégico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={strategicComment}
              onChange={e => setStrategicComment(e.target.value)}
              placeholder="Resumo estratégico da conta: análise geral, pontos de destaque, tendências observadas..."
              className="min-h-[120px]"
            />
          </CardContent>
        </Card>

        {/* Metric Fields Selection */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Métricas a exibir</CardTitle>
              <div className="flex gap-2">
                {templates.length > 0 && (
                  <Select onValueChange={applyTemplate}>
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue placeholder="Usar modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setShowTemplateSave(!showTemplateSave)}>
                  <BookTemplate className="h-3 w-3" /> Salvar modelo
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showTemplateSave && (
              <div className="flex gap-2 pb-2">
                <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Nome do modelo" className="h-8 text-xs" />
                <Button size="sm" className="h-8 text-xs" onClick={handleSaveTemplate}>Salvar</Button>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(METRIC_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={activeFields.includes(key)}
                    onCheckedChange={() => toggleField(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Metrics Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Métricas do Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {activeFields.map(field => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs">{METRIC_LABELS[field] || field}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground">Atual</span>
                      <Input
                        type="number"
                        value={metrics[field] ?? ""}
                        onChange={e => setMetrics(prev => ({ ...prev, [field]: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="0"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">Anterior</span>
                      <Input
                        type="number"
                        value={prevMetrics[field] ?? ""}
                        onChange={e => setPrevMetrics(prev => ({ ...prev, [field]: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="0"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Content (Posts / Reels / Stories) */}
        <TopContentPanel value={topContent} onChange={setTopContent} />

        {/* Recommendations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recomendações e Próximos Passos</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={recommendations}
              onChange={e => setRecommendations(e.target.value)}
              placeholder="Sugestões de melhoria, próximos passos, foco estratégico para o próximo período..."
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>

        {/* Send to Client Toggle */}
        <Card className="glass-card border-primary/20">
          <CardContent className="p-4 flex items-center gap-3">
            <input
              type="checkbox"
              checked={sendToClient}
              onChange={e => setSendToClient(e.target.checked)}
              className="h-4 w-4 rounded border-primary accent-primary"
            />
            <div className="flex-1">
              <p className="text-sm font-medium flex items-center gap-2">
                <Send className="h-3.5 w-3.5 text-primary" />
                Enviar para o cliente
              </p>
              <p className="text-[11px] text-muted-foreground">O relatório ficará visível na área do cliente selecionado</p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => handleSubmit("draft")}
            disabled={saving}
          >
            <Save className="h-4 w-4" /> Salvar Rascunho
          </Button>
          <Button
            className="flex-1 gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
            onClick={() => handleSubmit(sendToClient ? "published" : "draft")}
            disabled={saving}
          >
            {sendToClient ? <><Send className="h-4 w-4" /> Publicar e Enviar</> : "Publicar Relatório"}
          </Button>
        </div>
      </main>
    </div>
  );
}
