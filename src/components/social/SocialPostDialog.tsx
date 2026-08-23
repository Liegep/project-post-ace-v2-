import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Facebook, Instagram, CalendarIcon, ImagePlus, X, Send, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { SocialPost, MetaPage } from "@/hooks/useSocialPosts";
import { toast } from "@/hooks/use-toast";

interface SocialPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: SocialPost | null;
  pages: MetaPage[];
  clients: Array<{ id: string; name: string }>;
  clientId: string;
  onSave: (data: Partial<SocialPost>) => Promise<any>;
  onPublishNow?: (id: string) => void;
}

export function SocialPostDialog({ open, onOpenChange, post, pages, clients, clientId, onSave, onPublishNow }: SocialPostDialogProps) {
  const allowClientSelection = clientId === "all";
  const [platform, setPlatform] = useState<string>("facebook");
  const [selectedClientId, setSelectedClientId] = useState<string>(clientId === "all" ? "" : clientId);
  const [pageId, setPageId] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [notes, setNotes] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState("image");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("12:00");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredPages = pages.filter((p) => {
    const matchesPlatform = p.platform === platform;
    const matchesClient = selectedClientId ? p.client_id === selectedClientId : true;
    return matchesPlatform && matchesClient;
  });

  useEffect(() => {
    if (post) {
      setPlatform(post.platform);
      setSelectedClientId(post.client_id);
      setPageId(post.meta_page_id || "");
      setCaption(post.caption);
      setNotes(post.notes);
      setMediaUrls(post.media_urls || []);
      setMediaType(post.media_type);
      if (post.scheduled_at) {
        const d = new Date(post.scheduled_at);
        setScheduledDate(d);
        setScheduledTime(format(d, "HH:mm"));
      } else {
        setScheduledDate(undefined);
        setScheduledTime("12:00");
      }
    } else {
      setPlatform("facebook");
      setSelectedClientId(clientId === "all" ? "" : clientId);
      setPageId("");
      setCaption("");
      setNotes("");
      setMediaUrls([]);
      setMediaType("image");
      setScheduledDate(undefined);
      setScheduledTime("12:00");
    }
  }, [post, open, clientId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    const newUrls: string[] = [];
    const { compressImage } = await import("@/lib/imageCompressor");
    for (const rawFile of Array.from(files)) {
      const file = await compressImage(rawFile);
      const ext = file.name.split(".").pop();
      const fileName = `social/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(fileName, file);
      if (!error) {
        const { data } = supabase.storage.from("media").getPublicUrl(fileName);
        newUrls.push(data.publicUrl);
      }
    }
    setMediaUrls((prev) => [...prev, ...newUrls]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMedia = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const getScheduledAt = () => {
    if (!scheduledDate) return null;
    const [hours, minutes] = scheduledTime.split(":").map(Number);
    const d = new Date(scheduledDate);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  };

  const handleSave = async (asDraft: boolean) => {
    if (!selectedClientId) {
      toast({ title: "Selecione um cliente", variant: "destructive" });
      return;
    }
    if (!pageId) {
      toast({ title: "Selecione uma página", variant: "destructive" });
      return;
    }
    setSaving(true);
    const data: Partial<SocialPost> = {
      client_id: selectedClientId,
      platform,
      meta_page_id: pageId,
      caption,
      notes,
      media_urls: mediaUrls,
      media_type: mediaType,
      scheduled_at: getScheduledAt(),
      status: asDraft ? "draft" : "pending_approval",
    };

    if (post) {
      data.id = post.id;
    }

    const result = await onSave(data);
    setSaving(false);
    if (!result.error) {
      onOpenChange(false);
      toast({ title: post ? "Post atualizado!" : "Post criado!" });
    } else {
      toast({ title: "Erro ao salvar", description: result.error.message, variant: "destructive" });
    }
  };

  const handleSchedule = async () => {
    if (!selectedClientId) {
      toast({ title: "Selecione um cliente", variant: "destructive" });
      return;
    }
    if (!scheduledDate) {
      toast({ title: "Selecione data e hora", variant: "destructive" });
      return;
    }
    if (!pageId) {
      toast({ title: "Selecione uma página", variant: "destructive" });
      return;
    }

    const scheduledAt = getScheduledAt();
    const now = Date.now();
    const schedTime = new Date(scheduledAt!).getTime();
    const diffMin = (schedTime - now) / 60000;

    if (diffMin < 10) {
      toast({ title: "O agendamento deve ser pelo menos 10 minutos no futuro", variant: "destructive" });
      return;
    }
    if (diffMin > 30 * 24 * 60) {
      toast({ title: "O agendamento deve ser em até 30 dias", variant: "destructive" });
      return;
    }

    setSaving(true);
    const data: Partial<SocialPost> = {
      client_id: selectedClientId,
      platform,
      meta_page_id: pageId,
      caption,
      notes,
      media_urls: mediaUrls,
      media_type: mediaType,
      scheduled_at: scheduledAt,
      status: "approved",
    };

    if (post) data.id = post.id;

    const result = await onSave(data);

    if (!result.error) {
      // Trigger publish (Facebook will schedule natively, Instagram will be queued)
      const savedId = post?.id || result.data?.id;
      if (savedId) {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(`https://${projectId}.supabase.co/functions/v1/social-publish`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: "publish", post_id: savedId }),
        });
      }
      onOpenChange(false);
      toast({ title: "Post agendado com sucesso!" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{post ? "Editar Post" : "Novo Post Social"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {allowClientSelection && (
            <div className="space-y-2">
              <Label className="text-white/80">Cliente</Label>
              <Select
                value={selectedClientId}
                onValueChange={(value) => {
                  setSelectedClientId(value);
                  setPageId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Platform & Page */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white/80">Plataforma</Label>
              <Select value={platform} onValueChange={(value) => { setPlatform(value); setPageId(""); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook">
                    <span className="flex items-center gap-2"><Facebook className="h-4 w-4 text-blue-600" /> Facebook</span>
                  </SelectItem>
                  <SelectItem value="instagram">
                    <span className="flex items-center gap-2"><Instagram className="h-4 w-4 text-pink-500" /> Instagram</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Página / Conta</Label>
              <Select value={pageId} onValueChange={setPageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredPages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.page_name}
                      {p.platform === "instagram" && p.instagram_username && ` (@${p.instagram_username})`}
                    </SelectItem>
                  ))}
                  {filteredPages.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma página conectada</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Media type */}
          <div className="space-y-2">
            <Label className="text-white/80">Tipo de Publicação</Label>
            <Select value={mediaType} onValueChange={setMediaType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Imagem</SelectItem>
                <SelectItem value="carousel">Carrossel</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="reel">Reel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <Label className="text-white/80">Legenda</Label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Escreva a legenda do post..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-white/50 text-right">{caption.length} caracteres</p>
          </div>

          {/* Media upload */}
          <div className="space-y-2">
            <Label className="text-white/80">Mídia</Label>
            <div className="flex flex-wrap gap-2">
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden bg-muted">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeMedia(i)}
                    className="absolute top-1 right-1 bg-foreground/70 text-background rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-white/30 flex items-center justify-center hover:border-primary/50 transition-colors"
              >
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple={mediaType === "carousel"}
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            {uploading && <p className="text-xs text-white/50">Enviando...</p>}
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white/80">Data de Agendamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !scheduledDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "dd/MM/yyyy") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    disabled={(date) => date < new Date()}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Horário</Label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-white/80">Observações Internas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas (não serão publicadas)..."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Preview */}
          {caption && (
            <div className="rounded-lg border border-white/20 bg-white/95 p-4 space-y-2">
              <p className="text-xs font-medium text-zinc-500">📱 Preview</p>
              <p className="text-sm whitespace-pre-wrap text-black">{caption}</p>
              {mediaUrls.length > 0 && (
                <div className="flex gap-1 overflow-x-auto">
                  {mediaUrls.map((url, i) => (
                    <img key={i} src={url} alt="" className="h-24 rounded object-cover" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2 border-t border-white/15">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/30 text-white hover:bg-white/10 hover:text-white">Cancelar</Button>
            <Button variant="secondary" onClick={() => handleSave(true)} disabled={saving}>
              <FileText className="mr-2 h-4 w-4" /> Salvar Rascunho
            </Button>
            {(!post || post.status === "draft") && (
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                <Eye className="mr-2 h-4 w-4" /> Enviar p/ Aprovação
              </Button>
            )}
            {post?.status === "approved" && onPublishNow && (
              <Button onClick={() => { onPublishNow(post.id); onOpenChange(false); }} disabled={saving} className="bg-success text-success-foreground hover:bg-success/90">
                <Send className="mr-2 h-4 w-4" /> Publicar Agora
              </Button>
            )}
            <Button onClick={handleSchedule} disabled={saving || !scheduledDate}>
              <Clock className="mr-2 h-4 w-4" /> Agendar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Import icons used in buttons
import { FileText, Eye } from "lucide-react";
