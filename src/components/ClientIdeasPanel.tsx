import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Lightbulb, Link as LinkIcon, Loader2, Pencil, Plus, Search, Send, Sparkles, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePosts } from "@/context/PostsContext";
import { useBrandBrain } from "@/hooks/useBrandBrain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type IdeaStatus = "draft" | "converted";

interface ClientPautaIdea {
  id: string;
  client_id: string;
  title: string;
  description: string;
  comment: string;
  caption: string;
  reference_link: string;
  internal_comment: string;
  image_urls: string[];
  status: IdeaStatus;
  converted_post_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface IdeaForm {
  title: string;
  description: string;
  comment: string;
  caption: string;
  referenceLink: string;
  internalComment: string;
  imageUrls: string[];
}

const emptyForm = (): IdeaForm => ({
  title: "",
  description: "",
  comment: "",
  caption: "",
  referenceLink: "",
  internalComment: "",
  imageUrls: [],
});

function matchesTerm(text: string, term: string) {
  return term.trim() && text.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase());
}

export function ClientIdeasPanel({ clientId, onCountChange }: { clientId: string; onCountChange?: (count: number) => void }) {
  const { uploadMedia, ensurePautaColumn } = usePosts();
  const { brain, vocabulary, pillars, avoid, expressions, loading: brainLoading } = useBrandBrain(clientId);
  const [ideas, setIdeas] = useState<ClientPautaIdea[]>([]);
  const [form, setForm] = useState<IdeaForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("new");
  const [filter, setFilter] = useState<"all" | IdeaStatus>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [previewIdea, setPreviewIdea] = useState<ClientPautaIdea | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadIdeas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_pauta_ideas")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false });
    if (error) toast({ title: "Não foi possível carregar as ideias", description: error.message, variant: "destructive" });
    const nextIdeas = (data || []) as ClientPautaIdea[];
    setIdeas(nextIdeas);
    onCountChange?.(nextIdeas.filter((idea) => idea.status === "draft").length);
    setLoading(false);
  }, [clientId, onCountChange]);

  useEffect(() => { void loadIdeas(); }, [loadIdeas]);

  const updateForm = <K extends keyof IdeaForm>(key: K, value: IdeaForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const analysisText = `${form.title}\n${form.description}\n${form.caption}`;
  const brainFeedback = useMemo(() => {
    const forbidden = vocabulary.filter((item) => item.status === "forbidden" && matchesTerm(analysisText, item.term));
    const avoided = [
      ...vocabulary.filter((item) => item.status === "avoid" && matchesTerm(analysisText, item.term)).map((item) => ({ term: item.term, alternative: item.notes })),
      ...avoid.filter((item) => matchesTerm(analysisText, item.word)).map((item) => ({ term: item.word, alternative: item.recommended_alternative })),
    ];
    const helpfulExpressions = expressions.filter((item) => !matchesTerm(analysisText, item.expression)).slice(0, 2);
    const relatedPillars = pillars.filter((pillar) => {
      const words = [pillar.name, pillar.objective, ...pillar.themes].filter(Boolean);
      return words.some((word) => matchesTerm(analysisText, word));
    });
    return { forbidden, avoided, helpfulExpressions, relatedPillars };
  }, [analysisText, avoid, expressions, pillars, vocabulary]);

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const invalid = files.find((file) => file.size > 20 * 1024 * 1024);
    if (invalid) {
      toast({ title: "Arquivo grande", description: `"${invalid.name}" excede 20 MB.`, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const urls = await Promise.all(files.map((file) => uploadMedia(file)));
      updateForm("imageUrls", [...form.imageUrls, ...urls]);
    } catch (error) {
      toast({ title: "Erro ao enviar imagem", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const saveIdea = async (continueCreating: boolean) => {
    if (!form.title.trim()) {
      toast({ title: "Dê um título para a ideia", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      client_id: clientId,
      title: form.title.trim(),
      description: form.description.trim(),
      comment: form.comment.trim(),
      caption: form.caption.trim(),
      reference_link: form.referenceLink.trim(),
      internal_comment: form.internalComment.trim(),
      image_urls: form.imageUrls,
    };
    const { error } = editingId
      ? await supabase.from("client_pauta_ideas").update(payload).eq("id", editingId)
      : await supabase.from("client_pauta_ideas").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Não foi possível salvar a ideia", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "Ideia atualizada" : "Ideia salva no banco" });
    await loadIdeas();
    resetForm();
    if (!continueCreating) setActiveTab("bank");
  };

  const editIdea = (idea: ClientPautaIdea) => {
    setEditingId(idea.id);
    setForm({
      title: idea.title,
      description: idea.description,
      comment: idea.comment,
      caption: idea.caption,
      referenceLink: idea.reference_link,
      internalComment: idea.internal_comment,
      imageUrls: idea.image_urls || [],
    });
    setActiveTab("new");
  };

  const convertIdea = async (idea: ClientPautaIdea) => {
    setConvertingId(idea.id);
    try {
      const pautaColumn = await ensurePautaColumn();
      const { data: latestPost } = await supabase
        .from("posts")
        .select("position")
        .eq("client_id", clientId)
        .eq("column_id", pautaColumn.id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert({
          client_id: clientId,
          title: idea.title,
          caption: idea.caption || idea.description || idea.comment || "",
          image_url: idea.image_urls?.[0] || idea.reference_link || "",
          media_urls: idea.image_urls || [],
          media_type: "image",
          column_id: pautaColumn.id,
          position: (latestPost?.position ?? -1) + 1,
          status: ["entrada"],
          client_label: "pendente",
          is_pauta: true,
        })
        .select("id")
        .single();
      if (postError || !post) throw postError || new Error("Não foi possível criar o card de pauta.");
      const { error: ideaError } = await supabase
        .from("client_pauta_ideas")
        .update({ status: "converted", converted_post_id: post.id, converted_at: new Date().toISOString() })
        .eq("id", idea.id);
      if (ideaError) throw ideaError;
      toast({ title: "Pauta enviada para o cliente", description: "O card foi criado na coluna Pauta." });
      await loadIdeas();
    } catch (error) {
      toast({ title: "Não foi possível transformar a ideia em pauta", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setConvertingId(null);
    }
  };

  const filteredIdeas = ideas.filter((idea) => {
    const matchesStatus = filter === "all" || idea.status === filter;
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const matchesSearch = !normalizedSearch || [idea.title, idea.description, idea.caption].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
    return matchesStatus && matchesSearch;
  });

  const hasBrain = Boolean(brain || vocabulary.length || pillars.length || avoid.length || expressions.length);
  const reviewLevel = brainFeedback.forbidden.length > 0 ? "precisa revisar" : brainFeedback.avoided.length > 0 ? "atenção" : "bem alinhada";

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="new"><Plus className="mr-1.5 h-3.5 w-3.5" />{editingId ? "Editar ideia" : "Nova ideia"}</TabsTrigger>
        <TabsTrigger value="bank"><Lightbulb className="mr-1.5 h-3.5 w-3.5" />Banco ({ideas.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="new" className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950">
          <p className="font-semibold">Uma ideia fica interna até você enviá-la como pauta.</p>
          <p className="mt-1 text-xs text-amber-800">O cliente verá apenas o card de pauta, nunca este banco.</p>
        </div>
        <div className="space-y-3">
          <div><Label htmlFor="idea-title">Ideia *</Label><Input id="idea-title" value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="Ex.: Carrossel com mitos e verdades" /></div>
          <div><Label htmlFor="idea-description">Descrição</Label><Textarea id="idea-description" value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="Contexto, abordagem e objetivo da pauta." className="min-h-20" /></div>
          <div><Label htmlFor="idea-comment">Comentário</Label><Textarea id="idea-comment" value={form.comment} onChange={(event) => updateForm("comment", event.target.value)} placeholder="Observações para desenvolver a ideia." /></div>
          <div><Label htmlFor="idea-caption">Legenda sugerida</Label><Textarea id="idea-caption" value={form.caption} onChange={(event) => updateForm("caption", event.target.value)} placeholder="Uma primeira direção para a legenda." className="min-h-20" /></div>
          <div><Label htmlFor="idea-link">Link de referência</Label><div className="relative"><LinkIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="idea-link" className="pl-9" value={form.referenceLink} onChange={(event) => updateForm("referenceLink", event.target.value)} placeholder="https://..." /></div></div>
          <div><Label htmlFor="idea-internal-comment">Comentário interno</Label><Textarea id="idea-internal-comment" value={form.internalComment} onChange={(event) => updateForm("internalComment", event.target.value)} placeholder="Informação que não vai para o cliente." /></div>
          <div>
            <Label>Imagem ou anexo</Label>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
            <Button type="button" variant="outline" className="mt-1 w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Adicionar mídia
            </Button>
            {form.imageUrls.length > 0 && <div className="mt-2 grid grid-cols-3 gap-2">{form.imageUrls.map((url, index) => <div key={url} className="group relative overflow-hidden rounded-lg border bg-muted"><img src={url} alt="Mídia da ideia" className="h-20 w-full object-cover" /><button type="button" className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100" onClick={() => updateForm("imageUrls", form.imageUrls.filter((_, itemIndex) => itemIndex !== index))}><X className="h-3 w-3" /></button></div>)}</div>}
          </div>
        </div>

        {hasBrain && !brainLoading && (
          <div className={cn("rounded-xl border p-3", reviewLevel === "precisa revisar" ? "border-red-200 bg-red-50" : reviewLevel === "atenção" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50")}>
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4" /><p className="text-sm font-semibold">Brand Brain: {reviewLevel}</p></div>
            {brainFeedback.forbidden.map((item) => <p key={item.id} className="mt-2 text-xs text-red-700">Evite “{item.term}”: este termo está marcado como proibido.</p>)}
            {brainFeedback.avoided.map((item) => <p key={item.term} className="mt-2 text-xs text-amber-800">Atenção a “{item.term}”. {item.alternative ? `Alternativa: ${item.alternative}` : ""}</p>)}
            {brainFeedback.helpfulExpressions.map((item) => <p key={item.id} className="mt-2 text-xs text-emerald-800">Pode fortalecer: “{item.expression}”.</p>)}
            {brainFeedback.relatedPillars.length > 0 && <p className="mt-2 text-xs text-emerald-800">Alinhada ao pilar: {brainFeedback.relatedPillars.map((pillar) => pillar.name).join(", ")}.</p>}
            {!brainFeedback.forbidden.length && !brainFeedback.avoided.length && !brainFeedback.helpfulExpressions.length && <p className="mt-2 text-xs text-emerald-800">A ideia não tem alertas de linguagem. Continue desenvolvendo com a voz da marca.</p>}
          </div>
        )}
        <div className="flex gap-2"><Button type="button" className="flex-1 bg-amber-500 text-white hover:bg-amber-600" disabled={saving || uploading} onClick={() => saveIdea(false)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar ideia</Button><Button type="button" variant="outline" disabled={saving || uploading} onClick={() => saveIdea(true)}>Salvar e continuar</Button></div>
        {editingId && <Button type="button" variant="ghost" className="w-full" onClick={resetForm}>Cancelar edição</Button>}
      </TabsContent>

      <TabsContent value="bank" className="space-y-3">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ideias" /></div>
        <div className="flex gap-2"><Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Todas</Button><Button size="sm" variant={filter === "draft" ? "default" : "outline"} onClick={() => setFilter("draft")}>Rascunhos</Button><Button size="sm" variant={filter === "converted" ? "default" : "outline"} onClick={() => setFilter("converted")}>Enviadas</Button></div>
        {loading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : filteredIdeas.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma ideia encontrada.</div> : filteredIdeas.map((idea) => (
          <article key={idea.id} className={cn("rounded-xl border p-3", idea.status === "converted" ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40")}>
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-foreground">{idea.title}</h3><p className="mt-1 text-xs text-muted-foreground">Atualizada em {format(new Date(idea.updated_at), "dd/MM/yyyy")}</p></div><span className={cn("rounded-full px-2 py-1 text-[10px] font-bold uppercase", idea.status === "converted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{idea.status === "converted" ? "Enviada como pauta" : "Rascunho"}</span></div>
            {idea.description && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{idea.description}</p>}
            {idea.image_urls?.[0] && <img src={idea.image_urls[0]} alt="Referência da pauta" className="mt-3 h-28 w-full rounded-lg object-cover" />}
            <div className="mt-3 flex gap-2">{idea.status === "draft" ? <Button size="sm" className="flex-1 bg-amber-500 text-white hover:bg-amber-600" disabled={convertingId === idea.id} onClick={() => convertIdea(idea)}>{convertingId === idea.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}Transformar em pauta</Button> : idea.converted_post_id ? <Button size="sm" variant="outline" className="flex-1" onClick={() => setPreviewIdea(idea)}>Ver card gerado</Button> : null}<Button size="sm" variant="outline" onClick={() => editIdea(idea)}><Pencil className="h-3.5 w-3.5" /></Button></div>
          </article>
        ))}
      </TabsContent>
      <Dialog open={Boolean(previewIdea)} onOpenChange={(open) => !open && setPreviewIdea(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-600" />Pauta enviada ao cliente</DialogTitle></DialogHeader>
          {previewIdea && <div className="overflow-hidden rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/50"><div className="bg-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">Pauta para aprovação</div>{previewIdea.image_urls?.[0] && <img src={previewIdea.image_urls[0]} alt="Pauta enviada" className="h-44 w-full object-cover" />}<div className="space-y-2 p-4"><h3 className="font-semibold">{previewIdea.title}</h3><p className="whitespace-pre-wrap text-sm text-muted-foreground">{previewIdea.caption || previewIdea.description || previewIdea.comment || "Sem legenda sugerida."}</p></div></div>}
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
