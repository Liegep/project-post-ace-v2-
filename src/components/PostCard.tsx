import { memo, useRef, useState } from "react";
import { Post, PostStatus, ClientLabel, STATUS_CONFIG, LABEL_CONFIG, TAG_TRANSLATION_KEYS } from "@/types/post";
import { usePosts } from "@/context/PostsContext";
import { useI18n } from "@/i18n/I18nContext";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuCheckboxItem,
} from "@/components/ui/context-menu";
import { LinkedText } from "@/components/LinkedText";
import { MediaLightbox } from "@/components/MediaLightbox";
import { Archive, Calendar, Copy, Download, Pencil, Play, Send, SendHorizontal, Tag as TagIcon, Trash2, X, Check, ListChecks } from "lucide-react";
import { SendPostToClientDialog } from "@/components/SendPostToClientDialog";
import { format } from "date-fns";
import { isExternalLink } from "@/components/ExternalLinkCard";
import { getContrastColor } from "@/lib/utils";
import { toast } from "sonner";
import { getArtTypeConfig } from "@/lib/artTypes";

const STATUS_CHIP_STYLES: Record<PostStatus, string> = {
  entrada: "border-slate-200 bg-slate-100 text-slate-700",
  em_desenvolvimento: "border-sky-200 bg-sky-100 text-sky-700",
  escrevendo_legenda: "border-sky-200 bg-sky-100 text-sky-700",
  pronto: "border-emerald-200 bg-emerald-100 text-emerald-700",
  finalizado: "border-emerald-200 bg-emerald-100 text-emerald-700",
  alteracao_solicitada: "border-sky-200 bg-sky-100 text-sky-700",
  agendado: "border-sky-200 bg-sky-100 text-sky-700",
};

const STATUS_DOT_STYLES: Record<PostStatus, string> = {
  entrada: "bg-slate-400",
  em_desenvolvimento: "bg-sky-500",
  escrevendo_legenda: "bg-sky-500",
  pronto: "bg-emerald-500",
  finalizado: "bg-emerald-500",
  alteracao_solicitada: "bg-sky-500",
  agendado: "bg-sky-500",
};

function formatScheduledLabel(date: Date) {
  return `Agendado: ${format(date, "dd/MM 'às' HH:mm")}`;
}

function splitEditorialTitle(title: string) {
  const normalized = title.trim().replace(/\s+/g, " ");
  const words = normalized.split(" ").filter(Boolean);
  if (words.length < 3) return null;

  const connectorIndex = words.findIndex((word, index) => {
    if (index === 0 || index === words.length - 1) return false;
    return ["que", "de", "do", "da", "dos", "das", "em", "com", "para", "pra", "por"].includes(word.toLowerCase());
  });

  if (connectorIndex > 0) {
    return {
      lead: words.slice(0, connectorIndex).join(" "),
      accent: words.slice(connectorIndex).join(" "),
    };
  }

  if (words.length >= 4) {
    return {
      lead: words.slice(0, words.length - 2).join(" "),
      accent: words.slice(words.length - 2).join(" "),
    };
  }

  return null;
}

const STATUS_KEYS: Record<PostStatus, string> = {
  entrada: "statusEntry",
  em_desenvolvimento: "statusInDevelopment",
  escrevendo_legenda: "statusWritingCaption",
  pronto: "statusReady",
  finalizado: "statusFinalized",
  alteracao_solicitada: "statusChangeRequested",
  agendado: "statusScheduled",
};

const LABEL_KEYS: Record<ClientLabel, string> = {
  pendente: "labelPending",
  aprovado: "labelApproved",
  alteracao_solicitada: "labelChangeRequested",
  leia_comentario: "labelReadComment",
  de_seu_feedback: "labelGiveFeedback",
};

interface PostCardProps {
  post: Post;
  isAdmin: boolean;
  hideFeedback?: boolean;
  allowEditCaption?: boolean;
  allowClientDownload?: boolean;
  onStatusChange?: (status: PostStatus[]) => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  showInlineDetails?: boolean;
}

export const PostCard = memo(
  ({
    post,
    isAdmin,
    onEdit,
    onDelete,
    onArchive,
    selectionMode,
    isSelected,
    onToggleSelect,
    showInlineDetails,
    allowEditCaption,
    allowClientDownload,
  }: PostCardProps) => {
    const { tags, columns, updateClientLabel, addComment, updatePost, addPost, updatePostStatus, uploadMedia, clientId } = usePosts();
    const { t } = useI18n();
    const [commentText, setCommentText] = useState("");
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [mediaAspect, setMediaAspect] = useState<number | null>(null);
    const [mediaError, setMediaError] = useState(false);
    const [reuploading, setReuploading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0); // 0..1
    const reuploadInputRef = useRef<HTMLInputElement | null>(null);

    const handleReupload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      try {
        setReuploading(true);
        const url = await uploadMedia(file);
        const nextMediaUrls = post.mediaUrls.length > 0
          ? [url, ...post.mediaUrls.slice(1)]
          : [url];
        const isVideo = file.type.startsWith("video/");
        await updatePost(post.id, {
          mediaUrls: nextMediaUrls,
          imageUrl: url,
          mediaType: isVideo ? "video" : "image",
        } as any);
        setMediaError(false);
        setMediaAspect(null);
        toast.success("Mídia reenviada");
      } catch (err) {
        console.error(err);
        toast.error("Erro ao reenviar mídia");
      } finally {
        setReuploading(false);
      }
    };
    const [captionDrawerOpen, setCaptionDrawerOpen] = useState(false);
    const [editingCaption, setEditingCaption] = useState(false);
    const [draftCaption, setDraftCaption] = useState(post.caption);
    const [savingCaption, setSavingCaption] = useState(false);
    const [sendDialogOpen, setSendDialogOpen] = useState(false);
    const [copyDialogOpen, setCopyDialogOpen] = useState(false);
    const [targetColumnId, setTargetColumnId] = useState<string | null>(post.columnId);

    const allMedia = post.mediaUrls.length > 0 ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : [];
    const hasMedia = allMedia.length > 0;
    const thumbUrl = allMedia[0];
    const FALLBACK_CONFIG = { label: "—", color: "bg-muted text-muted-foreground" };
    const labelConfig = LABEL_CONFIG[post.clientLabel] ?? FALLBACK_CONFIG;
    const getStatusConfig = (s: PostStatus) => STATUS_CONFIG[s] ?? FALLBACK_CONFIG;
    const primaryStatus = post.status[0] ?? "entrada";
    const editorialTitle = splitEditorialTitle(post.title);
    const isOverdue = post.deadline ? new Date() > post.deadline && !post.status.includes("pronto") : false;

    // Cor customizada vinda da automação "Mudar cor do card" (formato: "color:#hex")
    const customColor = typeof post.clientLabel === "string" && post.clientLabel.startsWith("color:")
      ? post.clientLabel.slice(6)
      : null;

    const postTags = post.tags
      .map((tagId) => tags.find((t) => t.id === tagId))
      .filter(Boolean);

    const ALL_STATUSES: PostStatus[] = ["entrada", "em_desenvolvimento", "escrevendo_legenda", "pronto", "finalizado", "alteracao_solicitada", "agendado"];

    const handleToggleStatus = (s: PostStatus) => {
      const next = post.status.includes(s)
        ? post.status.filter((x) => x !== s)
        : [...post.status, s];
      updatePostStatus(post.id, next);
    };

    const handleToggleTag = (tagId: string) => {
      const next = post.tags.includes(tagId)
        ? post.tags.filter((x) => x !== tagId)
        : [...post.tags, tagId];
      updatePost(post.id, { tags: next });
    };

    const handleDuplicateClick = () => {
      setTargetColumnId(post.columnId);
      setCopyDialogOpen(true);
    };

    const handleConfirmCopy = async () => {
      const ok = await addPost({
        title: `${post.title} (cópia)`,
        imageUrl: post.imageUrl,
        mediaType: post.mediaType,
        mediaUrls: post.mediaUrls,
        caption: post.caption,
        status: post.status,
        tags: post.tags,
        columnId: targetColumnId,
        deadline: post.deadline ?? undefined,
      } as any);
      toast[ok ? "success" : "error"](ok ? "Card copiado" : "Erro ao copiar");
      setCopyDialogOpen(false);
    };

    const isPauta = (post as any).isPauta === true;
    const showPautaTreatment = isPauta; // sempre que marcado, em qualquer view

    const cardEl = (
      <Card
        className={`group cursor-pointer overflow-hidden rounded-ui-lg border border-black/6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-150 hover:translate-y-[-1px] hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)] ${
          selectionMode && isSelected ? "ring-2 ring-accent shadow-lg" : ""
        } ${showPautaTreatment ? "border-2 border-dashed border-amber-400" : ""}`}
        style={customColor ? { borderColor: customColor, borderWidth: 2, boxShadow: `0 0 0 1px ${customColor}40` } : undefined}
        onClick={() => (selectionMode ? onToggleSelect?.(post.id) : onEdit?.())}
      >
        {/* Faixa "PAUTA PARA APROVAÇÃO" */}
        {showPautaTreatment && (
          <div className="flex items-center gap-ui-2 bg-amber-500 px-ui-3 py-ui-1 text-ui-xs font-bold uppercase tracking-widest text-white">
            <Pencil className="size-icon-xs" />
            Pauta para Aprovação
          </div>
        )}
        {/* Title above thumbnail */}
        <div className="flex items-start gap-ui-2 bg-muted/30 px-ui-4 pt-ui-4 pb-ui-3">
          {selectionMode && (
            <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect?.(post.id)} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="break-words text-ui-base font-semibold leading-[1.25] text-foreground">
              {editorialTitle ? (
                <>
                  <span>{editorialTitle.lead}</span>{" "}
                  <span className="font-normal italic text-foreground/78">{editorialTitle.accent}</span>
                </>
              ) : (
                post.title
              )}
            </h3>
            <div className="mt-ui-2 flex flex-wrap items-center gap-ui-2">
              <span className={`inline-flex items-center gap-ui-2 rounded-ui-full border px-ui-3 py-ui-1 text-ui-xs font-medium ${STATUS_CHIP_STYLES[primaryStatus]}`}>
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT_STYLES[primaryStatus]}`} />
                {t((STATUS_KEYS[primaryStatus] ?? "statusEntrada") as any)}
              </span>
              {(() => {
                const cfg = getArtTypeConfig(post.artType);
                const Icon = cfg.icon;
                return (
                  <span className="inline-flex items-center gap-ui-1 rounded-ui-full border border-border bg-background px-ui-2 py-ui-1 text-ui-xs font-medium text-foreground/70">
                    <Icon className={`size-icon-xs ${cfg.color}`} />
                    {cfg.fallbackLabel}
                  </span>
                );
              })()}
            </div>
          </div>
          {isAdmin && (
            <div className="flex shrink-0 items-center gap-ui-1 pt-ui-1 opacity-0 transition-opacity group-hover:opacity-100">
              {hasMedia && (

                <button
                  className="text-muted-foreground hover:text-primary transition-colors"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const url = allMedia[0];
                    if (!url || isExternalLink(url)) return;
                    const { downloadMediaUrl } = await import("@/lib/downloadMedia");
                    await downloadMediaUrl(url, post.title);
                  }}
                  title="Baixar mídia"
                >
                  <Download className="size-icon-sm" />
                </button>
              )}

              {onDelete && (
                <button
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  title="Excluir"
                >
                  <Trash2 className="size-icon-sm" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Thumbnail 4:5 */}
        {hasMedia && (
          <div
            className="relative w-full overflow-hidden cursor-zoom-in"
            style={{ aspectRatio: mediaAspect ? `${mediaAspect}` : "4/5" }}
            onClick={(e) => {
              if (!isExternalLink(thumbUrl)) {
                e.stopPropagation();
                setLightboxOpen(true);
              }
            }}
          >
            {(() => {
              if (isExternalLink(thumbUrl))
                return (
                  <div className="h-full w-full bg-muted flex items-center justify-center">
                    <Play className="h-6 w-6 text-muted-foreground" />
                  </div>
                );
              if (mediaError)
                return (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-ui-2 bg-muted p-ui-3 text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    <span className="text-ui-xs font-medium opacity-70">mídia indisponível</span>
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={reuploading}
                        onClick={(e) => { e.stopPropagation(); reuploadInputRef.current?.click(); }}
                        className="inline-flex items-center gap-ui-1 rounded-ui-md bg-primary/90 px-ui-2 py-ui-1 text-ui-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary disabled:opacity-60"
                      >
                        {reuploading ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                            Enviando…
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                            Reenviar
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              const isVideo = thumbUrl?.match(/\.(mp4|webm|mov|avi)/i) || post.mediaType === "video";
              return isVideo ? (
                <video
                  src={thumbUrl}
                  className="h-full w-full object-cover"
                  muted
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    if (v.videoWidth && v.videoHeight) setMediaAspect(v.videoWidth / v.videoHeight);
                  }}
                  onError={() => setMediaError(true)}
                />
              ) : (
                <img
                  src={thumbUrl}
                  alt={post.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth && img.naturalHeight) setMediaAspect(img.naturalWidth / img.naturalHeight);
                  }}
                  onError={() => setMediaError(true)}
                />
              );
            })()}

            <input
              ref={reuploadInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleReupload}
              onClick={(e) => e.stopPropagation()}
            />


            {/* Client-side download button (top-left) */}
            {!isAdmin && allowClientDownload && !isExternalLink(thumbUrl) && !mediaError && (
              <button
                type="button"
                disabled={downloading}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (downloading) return;
                  const { downloadMediaUrl } = await import("@/lib/downloadMedia");
                  setDownloading(true);
                  setDownloadProgress(0);
                  const isMulti = allMedia.length > 1;
                  const toastId = toast.loading(
                    isMulti ? `Baixando 1 de ${allMedia.length}…` : "Baixando mídia…",
                  );
                  let ok = 0;
                  let failed = 0;
                  try {
                    for (let i = 0; i < allMedia.length; i++) {
                      const url = allMedia[i];
                      if (!url || isExternalLink(url)) { failed++; continue; }
                      if (isMulti) {
                        toast.loading(`Baixando ${i + 1} de ${allMedia.length}…`, { id: toastId });
                      }
                      try {
                        await downloadMediaUrl(url, post.title, isMulti ? i : undefined, (frac) => {
                          const overall = (i + frac) / allMedia.length;
                          setDownloadProgress(overall);
                        });
                        ok++;
                        setDownloadProgress((i + 1) / allMedia.length);
                      } catch {
                        failed++;
                      }
                      if (isMulti && i < allMedia.length - 1) {
                        await new Promise((r) => setTimeout(r, 300));
                      }
                    }
                    if (failed === 0) {
                      toast.success(
                        isMulti ? `${ok} arquivos baixados` : "Download concluído",
                        { id: toastId },
                      );
                    } else if (ok === 0) {
                      toast.error("Não foi possível baixar. Abrimos em nova aba.", { id: toastId });
                    } else {
                      toast.warning(`${ok} baixados, ${failed} falharam`, { id: toastId });
                    }
                  } finally {
                    setDownloading(false);
                    setDownloadProgress(0);
                  }
                }}
                title={allMedia.length > 1 ? "Baixar todas as mídias" : "Baixar mídia"}
                className="absolute left-ui-2 top-ui-2 z-10 inline-flex items-center gap-ui-1 overflow-hidden rounded-ui-full bg-black/70 px-ui-2 py-ui-1 text-ui-xs font-semibold text-white shadow-md backdrop-blur transition-colors hover:bg-black/85 disabled:cursor-not-allowed"
              >
                {/* progress fill */}
                {downloading && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-primary/70 transition-[width] duration-200"
                    style={{ width: `${Math.max(6, Math.round(downloadProgress * 100))}%` }}
                  />
                )}
                <span className="relative inline-flex items-center gap-ui-1">
                  {downloading ? (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Download className="size-icon-xs" />
                  )}
                  {downloading
                    ? `${Math.round(downloadProgress * 100)}%`
                    : allMedia.length > 1
                      ? `${allMedia.length}`
                      : "Baixar"}
                </span>
              </button>
            )}

            {/* Media count badge */}
            {allMedia.length > 1 && (
              <div className="absolute right-ui-2 top-ui-2 rounded-ui-sm bg-black/60 px-ui-2 py-ui-1 text-ui-xs font-bold text-white">
                {allMedia.length}
              </div>
            )}

            {/* Badges overlay at bottom of image */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent px-ui-4 pt-ui-6 pb-ui-3">
              <div className="flex flex-wrap items-center gap-ui-1">
                {post.deadline && isAdmin && (
                  <span className={`inline-flex items-center gap-ui-1 rounded-ui-full bg-black/35 px-ui-3 py-ui-1 text-ui-xs font-medium text-white/92 ${isOverdue ? "text-red-200" : ""}`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                    <Calendar className="size-icon-xs" />
                    {formatScheduledLabel(post.deadline)}
                  </span>
                )}
                {post.deadline && !isAdmin && (
                  <span className="inline-flex items-center gap-ui-1 rounded-ui-full bg-amber-100/95 px-ui-3 py-ui-1 text-ui-xs font-medium text-amber-950">
                    <Calendar className="size-icon-xs" />
                    {formatScheduledLabel(post.deadline)}
                  </span>
                )}
                {post.status.slice(1, 2).map((s) => (
                  <span key={s} className={`inline-flex rounded-ui-sm px-ui-2 py-ui-1 text-ui-xs font-bold ${getStatusConfig(s).color}`}>
                    {t((STATUS_KEYS[s] ?? "statusEntrada") as any)}
                  </span>
                ))}
                <span className={`inline-flex rounded-ui-sm px-ui-2 py-ui-1 text-ui-xs font-bold ${labelConfig.color}`}>
                  {t(LABEL_KEYS[post.clientLabel] as any)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Content */}

        <div className="space-y-ui-3 p-ui-4">


          {/* Tags row */}
          {postTags.length > 0 && (
            <div className="flex flex-wrap gap-ui-1">
              {postTags.map((tag) => {
                if (!tag) return null;
                const translationKey = TAG_TRANSLATION_KEYS[tag.id];
                const displayName = translationKey ? t(translationKey as any) : tag.name;
                return (
                  <span
                    key={tag.id}
                     className="inline-block rounded-ui-sm px-ui-2 py-ui-1 text-ui-xs font-semibold"
                     style={{ backgroundColor: tag.color, color: getContrastColor(tag.color) }}
                  >
                    {displayName}
                  </span>
                );
              })}
            </div>
          )}

          {/* No-media fallback: show badges inline */}
          {!hasMedia && (
            <div className="flex flex-wrap items-center gap-ui-1">
              {post.deadline && isAdmin && (
                <span className={`inline-flex items-center gap-ui-1 rounded-ui-full border border-border bg-muted/40 px-ui-3 py-ui-1 text-ui-xs font-medium ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                  <Calendar className="size-icon-xs" />
                  {formatScheduledLabel(post.deadline)}
                </span>
              )}
              {post.deadline && !isAdmin && (
                <span className="inline-flex items-center gap-ui-1 rounded-ui-full bg-amber-100 px-ui-3 py-ui-1 text-ui-xs font-medium text-amber-950">
                  <Calendar className="size-icon-xs" />
                  {formatScheduledLabel(post.deadline)}
                </span>
              )}
              {post.status.slice(1, 2).map((s) => (
                <span key={s} className={`inline-flex rounded-ui-sm px-ui-2 py-ui-1 text-ui-xs font-semibold ${getStatusConfig(s).color}`}>
                  {t((STATUS_KEYS[s] ?? "statusEntrada") as any)}
                </span>
              ))}
              <span className={`inline-flex rounded-ui-sm px-ui-2 py-ui-1 text-ui-xs font-semibold ${labelConfig.color}`}>
                {t(LABEL_KEYS[post.clientLabel] as any)}
              </span>
            </div>
          )}

          {/* Inline details when no columns visible */}
          {showInlineDetails && !isAdmin && (
            <div className="space-y-2 pt-1 border-t border-border mt-2" onClick={(e) => e.stopPropagation()}>
              {/* Caption preview + Read More */}
              {post.caption && (
                <div className="space-y-1.5">
                  <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed line-clamp-3">
                    <LinkedText text={post.caption} />
                  </div>
                  {post.caption.length > 120 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setCaptionDrawerOpen(true); }}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      {t("readMore")}
                    </button>
                  )}
                </div>
              )}

              {/* Feedback dropdown */}
              <Select value={post.clientLabel === "pendente" ? "" : post.clientLabel} onValueChange={(v) => updateClientLabel(post.id, v as ClientLabel)}>
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue placeholder={t("labelGiveFeedback")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de_seu_feedback">💬 {t("labelGiveFeedback")}</SelectItem>
                  <SelectItem value="aprovado">✅ {t("labelApproved")}</SelectItem>
                  <SelectItem value="alteracao_solicitada">✏️ {t("labelChangeRequested")}</SelectItem>
                </SelectContent>
              </Select>

              {/* Comment field */}
              <div className="flex gap-1.5">
                <Textarea
                  placeholder={t("writeComment")}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="min-h-[40px] text-sm resize-none flex-1 bg-white text-black"
                  rows={1}
                />
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => {
                    if (!commentText.trim()) return;
                    addComment(post.id, "Cliente", commentText.trim());
                    setCommentText("");
                  }}
                  disabled={!commentText.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
        <MediaLightbox
          urls={allMedia.filter((u) => !isExternalLink(u))}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />

        {/* Glassmorphism caption drawer */}
        {post.caption && (
          <Drawer
            open={captionDrawerOpen}
            repositionInputs={false}
            onOpenChange={(open) => {
              setCaptionDrawerOpen(open);
              if (!open) {
                setEditingCaption(false);
                setDraftCaption(post.caption);
              }
            }}
          >
            <DrawerContent
              className="bg-[hsl(0_0%_10%/0.85)] backdrop-blur-2xl border-white/10 text-white max-h-[90vh] flex flex-col"
              style={{ maxHeight: "92dvh" }}
              onClick={(e) => e.stopPropagation()}
            >
              <DrawerHeader className="text-left flex-row items-center justify-between gap-2 pr-4 shrink-0">
                <DrawerTitle className="text-white text-lg flex-1 truncate">{post.title}</DrawerTitle>
                {allowEditCaption && !editingCaption && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftCaption(post.caption);
                      setEditingCaption(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-2 transition-colors shrink-0"
                    title={t("editPost")}
                    aria-label={t("editPost")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t("editPost")}
                  </button>
                )}
              </DrawerHeader>
              <div className="px-4 flex-1 overflow-y-auto overscroll-contain min-h-0">
                {editingCaption ? (
                  <div className="rounded-xl bg-white text-black p-4 sm:p-5 shadow-sm">
                    <Textarea
                      value={draftCaption}
                      onChange={(e) => setDraftCaption(e.target.value)}
                      className="min-h-[220px] w-full resize-none border-0 bg-transparent p-0 text-[18px] leading-[1.6] text-black shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl bg-white text-black p-4 sm:p-5 text-[18px] leading-[1.6] whitespace-pre-wrap font-medium">
                    <LinkedText text={post.caption} />
                  </div>
                )}
              </div>
              {editingCaption && (
                <div className="sticky bottom-0 shrink-0 flex gap-2 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] border-t border-white/10 bg-[hsl(0_0%_10%/0.95)] backdrop-blur-2xl">
                  <Button
                    size="lg"
                    className="h-12 text-base font-semibold flex-1 gap-2"
                    disabled={savingCaption || draftCaption === post.caption}
                    onClick={async () => {
                      setSavingCaption(true);
                      try {
                        await updatePost(post.id, { caption: draftCaption });
                        setEditingCaption(false);
                        setCaptionDrawerOpen(false);
                      } finally {
                        setSavingCaption(false);
                      }
                    }}
                  >
                    <Check className="h-4 w-4" />
                    {savingCaption ? t("saving") : t("save")}
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    className="h-12 text-base text-white hover:bg-white/10 gap-2"
                    disabled={savingCaption}
                    onClick={() => {
                      setEditingCaption(false);
                      setDraftCaption(post.caption);
                    }}
                  >
                    <X className="h-4 w-4" />
                    {t("cancel")}
                  </Button>
                </div>
              )}
            </DrawerContent>
          </Drawer>
        )}
      </Card>
    );

    if (!isAdmin) return cardEl;

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="block">
            {cardEl}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent
          className="w-56"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <ListChecks className="h-4 w-4 mr-2" />
              Status
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-56" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              {ALL_STATUSES.map((s) => (
                <ContextMenuCheckboxItem
                  key={s}
                  checked={post.status.includes(s)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onSelect={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleToggleStatus(s);
                  }}
                >
                  {t((STATUS_KEYS[s] ?? "statusEntrada") as any)}
                </ContextMenuCheckboxItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <TagIcon className="h-4 w-4 mr-2" />
              Etiquetas
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-56 max-h-72 overflow-y-auto" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              {tags.length === 0 ? (
                <ContextMenuItem disabled>Nenhuma etiqueta</ContextMenuItem>
              ) : (
                tags.map((tag) => (
                  <ContextMenuCheckboxItem
                    key={tag.id}
                    checked={post.tags.includes(tag.id)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onSelect={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggleTag(tag.id);
                    }}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full mr-2"
                      style={{ backgroundColor: tag.color }}
                    />
                    {TAG_TRANSLATION_KEYS[tag.id] ? t(TAG_TRANSLATION_KEYS[tag.id] as any) : tag.name}
                  </ContextMenuCheckboxItem>
                ))
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          <ContextMenuItem onSelect={handleDuplicateClick}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar card
          </ContextMenuItem>

          <ContextMenuItem onSelect={() => setSendDialogOpen(true)}>
            <SendHorizontal className="h-4 w-4 mr-2" />
            Enviar para outro cliente
          </ContextMenuItem>

          {onArchive && (
            <ContextMenuItem onSelect={() => onArchive()}>
              <Archive className="h-4 w-4 mr-2" />
              Arquivar
            </ContextMenuItem>
          )}

          {onDelete && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => onDelete()} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
        <SendPostToClientDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          post={post}
          currentClientId={clientId}
        />

        <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Copiar card</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Para qual coluna deseja copiar <strong>&ldquo;{post.title}&rdquo;</strong>?
              </p>
              <Select
                value={targetColumnId ?? "__unassigned__"}
                onValueChange={(v) => setTargetColumnId(v === "__unassigned__" ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma coluna" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCopyDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmCopy}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </ContextMenu>
    );
  },
);

PostCard.displayName = "PostCard";
