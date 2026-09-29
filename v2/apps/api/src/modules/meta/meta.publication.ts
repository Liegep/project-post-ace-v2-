export type MetaPublicationPlatform = "instagram" | "facebook";
export type MetaPublicationMediaType = "image" | "carousel";
export type InstagramUserTag = { username: string; x: number; y: number };

type MetaPublicationMediaPlan = {
  platform: MetaPublicationPlatform;
  mediaType: MetaPublicationMediaType;
  mediaUrl: string;
  mediaUrls: string[];
  locationId: string | null;
  instagramUserTags: InstagramUserTag[];
};

export function planMetaCardPublications(input: {
  platforms: MetaPublicationPlatform[];
  mediaUrls: string[];
  mediaType: string | null;
  artType: string | null;
  locationId: string | null;
  instagramUserTags: InstagramUserTag[];
}): { plans: MetaPublicationMediaPlan[]; error: null } | { plans: null; error: string } {
  const mediaUrls = [...new Set(input.mediaUrls.map((url) => url.trim()).filter(Boolean))];
  if (/video|reel|story/i.test(`${input.mediaType ?? ""} ${input.artType ?? ""}`)) {
    return { plans: null, error: "Esta versão da publicação Meta aceita somente imagens." };
  }
  if (mediaUrls.length === 0) {
    return { plans: null, error: "Adicione pelo menos uma imagem antes de agendar a publicação." };
  }
  if (mediaUrls.length > 10) {
    return { plans: null, error: "O carrossel do Instagram aceita no máximo 10 imagens." };
  }
  const isCarousel = mediaUrls.length > 1;
  if (isCarousel && input.platforms.includes("facebook")) {
    return { plans: null, error: "Nesta etapa, carrossel está disponível somente no Instagram. Remova o Facebook para continuar." };
  }
  return {
    plans: input.platforms.map((platform) => ({
      platform,
      mediaType: isCarousel ? "carousel" : "image",
      mediaUrl: mediaUrls[0],
      mediaUrls,
      locationId: input.locationId,
      instagramUserTags: platform === "instagram" && !isCarousel ? input.instagramUserTags : [],
    })),
    error: null,
  };
}
