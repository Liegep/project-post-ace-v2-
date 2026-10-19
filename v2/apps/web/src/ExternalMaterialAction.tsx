import { portalText } from "./portalI18n";

export function externalMaterialUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function isVideoMaterial(url: URL) {
  // The post's media type describes its preview, not necessarily its external material.
  // Drive URLs do not expose a reliable MIME type; keep those generic.
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (["drive.google.com", "docs.google.com"].includes(host)) return false;
  if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(url.pathname)) return true;
  if (host === "youtu.be") return /^\/[\w-]{11}\/?$/.test(url.pathname);
  if (["youtube.com", "m.youtube.com"].includes(host)) {
    return (url.pathname === "/watch" && /^[\w-]{11}$/.test(url.searchParams.get("v") ?? ""))
      || /^\/(shorts|embed)\/[\w-]{11}\/?$/.test(url.pathname);
  }
  return host === "vimeo.com" && /^\/\d+\/?$/.test(url.pathname);
}

export function ExternalMaterialAction({ url, locale }: { url?: string | null; locale: string }) {
  const parsed = externalMaterialUrl(url);
  if (!parsed) return null;
  const video = isVideoMaterial(parsed);
  return <a className="portal-material-action" href={url!} target="_blank" rel="noopener noreferrer">
    <span className="portal-material-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {video ? <path d="m9 5 11 7-11 7Z" /> : <><path d="M14 3h7v7M21 3 10 14" /><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /></>}
      </svg>
    </span>
    <span className="portal-material-copy">
      <strong>{portalText(locale, video ? "Assistir ao vídeo" : "Abrir material")}</strong>
      <small>{parsed.hostname} · {portalText(locale, "Abre em uma nova aba")}</small>
    </span>
    <span className="portal-material-arrow" aria-hidden="true">↗</span>
  </a>;
}
