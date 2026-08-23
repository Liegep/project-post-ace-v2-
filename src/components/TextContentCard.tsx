import { useState } from "react";
import { FileText, BookOpen, Type, PenTool, FileCheck, Calendar, Check, X, Send, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TextContent, CONTENT_TYPE_LABELS, TEXT_STATUS_LABELS, TextContentType } from "@/hooks/useTextContents";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_ICONS: Record<TextContentType, React.ElementType> = {
  blog: BookOpen,
  artigo: FileText,
  texto: Type,
  copy: PenTool,
  documento: FileCheck,
};

interface TextContentCardProps {
  content: TextContent;
  onClick: () => void;
  isAdmin?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onComment?: (id: string, message: string) => void;
}

export function TextContentCard({ content, onClick, isAdmin, onApprove, onReject, onComment }: TextContentCardProps) {
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const Icon = TYPE_ICONS[content.content_type] || FileText;
  const statusConfig = TEXT_STATUS_LABELS[content.status];
  const preview = content.subtitle || content.body.replace(/<[^>]*>/g, "").slice(0, 120);
  const showClientActions = !isAdmin && content.status === "pending_approval";

  const handleComment = async () => {
    if (!comment.trim() || !onComment) return;
    setSending(true);
    await onComment(content.id, comment.trim());
    setComment("");
    setSending(false);
  };

  return (
    <div className="board-card-shell flex h-full w-full flex-col rounded-ui-lg hover:border-primary/30">
      {/* Clickable card area */}
      <button
        onClick={onClick}
        className="group flex h-full w-full flex-col text-left rounded-t-ui-lg p-ui-5 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {/* Header */}
        <div className="mb-ui-3 flex items-start justify-between gap-ui-3">
          <div className="flex min-w-0 items-center gap-ui-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ui-md bg-primary/10">
              <Icon className="size-icon-md text-primary" />
            </div>
            <div className="min-w-0">
              <Badge variant="outline" className="mb-ui-1 font-medium">
                {CONTENT_TYPE_LABELS[content.content_type]}
              </Badge>
              <h3 className="text-ui-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary line-clamp-2">
                {content.title}
              </h3>
            </div>
          </div>
          <Badge className={`shrink-0 ${statusConfig.color}`}>
            {statusConfig.label}
          </Badge>
        </div>

        {/* Preview text */}
        {preview && (
          <p className="mb-ui-3 flex-1 text-ui-sm leading-relaxed text-muted-foreground line-clamp-3">
            {preview}{content.body.replace(/<[^>]*>/g, "").length > 120 && !content.subtitle ? "…" : ""}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-ui-3">
          <div className="flex items-center gap-ui-3 text-ui-xs text-muted-foreground">
            {content.planned_date && (
              <span className="flex items-center gap-ui-1">
                <Calendar className="size-icon-xs" />
                {format(new Date(content.planned_date), "dd MMM", { locale: ptBR })}
              </span>
            )}
            <span>{format(new Date(content.updated_at), "dd/MM/yy", { locale: ptBR })}</span>
          </div>
          <span className="text-ui-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Ler completo →
          </span>
        </div>
      </button>

      {/* Client actions: approve/reject + comment */}
      {showClientActions && (
        <div className="space-y-ui-3 border-t px-ui-5 py-ui-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-ui-2">
            <Button
              size="sm"
              onClick={() => onApprove?.(content.id)}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              <Check className="mr-ui-2 size-icon-sm" /> Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReject?.(content.id)}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <X className="mr-ui-2 size-icon-sm" /> Reprovar
            </Button>
          </div>

          <div className="flex gap-ui-2">
            <div className="relative flex-1">
              <MessageCircle className="absolute left-ui-3 top-1/2 size-icon-sm -translate-y-1/2 text-muted-foreground" />
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Deixe um comentário..."
                className="min-h-[40px] max-h-[80px] resize-none pl-10 text-ui-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(); }
                }}
              />
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={handleComment}
              disabled={!comment.trim() || sending}
              className="shrink-0 self-end h-10 w-10"
            >
              <Send className="size-icon-sm" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
