export type MetaPublicationPlatform = "instagram" | "facebook";
export type MetaPublicationMediaType = "image" | "carousel" | "reel" | "story";
export type InstagramUserTag = { username: string; x: number; y: number };

type MetaPublicationMediaPlan = {
  platform: MetaPublicationPlatform;
  mediaType: MetaPublicationMediaType;
  mediaUrl: string;
  mediaUrls: string[];
  reelCoverUrl: string | null;
  locationId: string | null;
  instagramUserTags: InstagramUserTag[];
};

export function planMetaCardPublications(input: {
  platforms: MetaPublicationPlatform[];
  mediaUrls: string[];
  mediaType: string | null;
  artType: string | null;
  publicationFormat?: "story" | null;
  reelCoverUrl?: string | null;
  locationId: string | null;
  instagramUserTags: InstagramUserTag[];
}): { plans: MetaPublicationMediaPlan[]; error: null } | { plans: null; error: string } {
  const mediaUrls = [...new Set(input.mediaUrls.map((url) => url.trim()).filter(Boolean))];
  if (mediaUrls.length === 0) {
    return { plans: null, error: "Adicione uma imagem ou vídeo antes de agendar a publicação." };
  }
  const videoUrls = mediaUrls.filter((url) => /\.(mp4|mov)(?:$|[?#])/i.test(url));
  const declaredVideo = /video/i.test(input.mediaType ?? "");
  const declaredReel = /reel/i.test(input.artType ?? "");
  const isStory = input.publicationFormat === "story" || /stor(?:y|ies)/i.test(input.artType ?? "");
  if (isStory) {
    if (mediaUrls.length !== 1) {
      return { plans: null, error: "Stories aceita exatamente uma imagem ou um vídeo nesta etapa." };
    }
    return {
      plans: input.platforms.map((platform) => ({
        platform,
        mediaType: "story",
        mediaUrl: mediaUrls[0],
        mediaUrls,
        reelCoverUrl: null,
        locationId: null,
        instagramUserTags: [],
      })),
      error: null,
    };
  }
  const isReel = mediaUrls.length === 1 && (videoUrls.length === 1 || declaredVideo || declaredReel);
  if (videoUrls.length > 1 || (mediaUrls.length > 1 && (videoUrls.length > 0 || declaredVideo || declaredReel))) {
    return { plans: null, error: "Reels aceita somente um vídeo. Não misture vídeo com imagens nem selecione vários vídeos." };
  }
  const reelCoverUrl = input.reelCoverUrl?.trim() || null;
  if (isReel && reelCoverUrl) {
    const isInternalUpload = reelCoverUrl.startsWith("/api/uploads/");
    let parsedCover: URL | null = null;
    if (!isInternalUpload) {
      try {
        parsedCover = new URL(reelCoverUrl);
      } catch {
        return { plans: null, error: "A capa do Reel precisa ser uma imagem válida enviada pelo Design Hub." };
      }
    }
    if ((!isInternalUpload && parsedCover?.protocol !== "https:") || /\.(mp4|mov|webm)(?:$|[?#])/i.test(reelCoverUrl)) {
      return { plans: null, error: "A capa do Reel precisa ser uma imagem JPG, JPEG ou PNG disponível por HTTPS." };
    }
  }
  if (mediaUrls.length > 10) {
    return { plans: null, error: "O carrossel do Instagram aceita no máximo 10 imagens." };
  }
  const isCarousel = !isReel && mediaUrls.length > 1;
  if (isCarousel && input.platforms.includes("facebook")) {
    return { plans: null, error: "Nesta etapa, carrossel está disponível somente no Instagram. Remova o Facebook para continuar." };
  }
  return {
    plans: input.platforms.map((platform) => ({
      platform,
      mediaType: isReel ? "reel" : isCarousel ? "carousel" : "image",
      mediaUrl: mediaUrls[0],
      mediaUrls,
      reelCoverUrl: isReel ? reelCoverUrl : null,
      locationId: isReel && platform === "instagram" ? null : input.locationId,
      instagramUserTags: platform === "instagram" && !isCarousel && !isReel ? input.instagramUserTags : [],
    })),
    error: null,
  };
}
