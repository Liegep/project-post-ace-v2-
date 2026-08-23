import { ExternalLink, Film, FileText } from "lucide-react";
import { detectExternalVideo, getPlatformLabel } from "@/lib/videoEmbed";

interface ExternalLinkCardProps {
  url: string;
  className?: string;
}

export function ExternalLinkCard({ url, className = "" }: ExternalLinkCardProps) {
  const video = detectExternalVideo(url);
  const isVideo = !!video;
  const label = video ? `Assistir vídeo — ${getPlatformLabel(video.type)}` : "Abrir arquivo";
  const Icon = isVideo ? Film : FileText;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      onClick={(e) => e.stopPropagation()}
      className={`group/link flex w-full items-center gap-ui-3 rounded-ui-lg border border-border bg-muted/40 px-ui-4 py-ui-3 text-left transition-all hover:border-accent hover:bg-accent hover:shadow-sm no-underline ${className}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ui-md bg-primary/10 text-primary transition-colors group-hover/link:bg-primary/20">
        <Icon className="size-icon-md" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="flex items-center gap-ui-2 truncate text-ui-sm font-medium text-foreground underline-offset-2 group-hover/link:underline">
          <ExternalLink className="size-icon-sm shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </span>
        <span className="block truncate text-ui-xs text-muted-foreground">{url}</span>
      </div>
      <ExternalLink className="size-icon-sm shrink-0 text-muted-foreground" />
    </a>
  );
}

export function isExternalLink(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return ["drive.google.com", "youtube.com", "youtu.be", "vimeo.com", "www.youtube.com", "www.vimeo.com"].some(d => u.hostname.includes(d));
  } catch {
    return false;
  }
}
