import type { MetaScheduledPublication } from "./api";

export type MetaPublicationPreview = {
  url: string;
  kind: "image" | "video";
};

type PreviewPublication = Pick<MetaScheduledPublication, "mediaUrl" | "mediaUrls" | "reelCoverUrl">;

function isVideoUrl(url: string) {
  return /\.(?:mp4|mov|m4v|webm)(?:$|[?#])/i.test(url);
}

export function metaPublicationPreviewSource(publication: PreviewPublication): MetaPublicationPreview | null {
  const source = [publication.reelCoverUrl, publication.mediaUrls[0], publication.mediaUrl]
    .find((value) => typeof value === "string" && value.trim().length > 0)
    ?.trim();
  if (!source) return null;
  return { url: source, kind: isVideoUrl(source) ? "video" : "image" };
}
