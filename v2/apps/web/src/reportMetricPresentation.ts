import type { ReportMetricMetadata } from "./api";
type Locale = "pt" | "en" | "es" | "it" | "sv";
export const reportGrowthLabels = {
  pt: { followersGained: "Seguidores ganhos", followersLost: "Seguidores perdidos", followersNet: "Crescimento líquido" },
  en: { followersGained: "Followers gained", followersLost: "Followers lost", followersNet: "Net growth" },
  es: { followersGained: "Seguidores ganados", followersLost: "Seguidores perdidos", followersNet: "Crecimiento neto" },
  it: { followersGained: "Nuovi follower", followersLost: "Follower persi", followersNet: "Crescita netta" },
  sv: { followersGained: "Nya följare", followersLost: "Tappade följare", followersNet: "Nettotillväxt" },
};
const unavailable = {
  pt: ["Não disponível", "Sem dados no período", "Não disponível pela API da Meta", "Não foi possível consultar a Meta"],
  en: ["Not available", "No data in this period", "Not available through Meta API", "Unable to retrieve Meta data"],
  es: ["No disponible", "Sin datos en el período", "No disponible mediante la API de Meta", "No se pudo consultar Meta"],
  it: ["Non disponibile", "Nessun dato nel periodo", "Non disponibile tramite Meta API", "Impossibile recuperare i dati da Meta"],
  sv: ["Inte tillgängligt", "Inga data under perioden", "Inte tillgängligt via Meta API", "Kunde inte hämta data från Meta"],
};
const locales = { pt: "pt-BR", en: "en-US", es: "es-ES", it: "it-IT", sv: "sv-SE" };
export function formatReportMetric(value: number | null | undefined, key: string, locale: Locale, status?: ReportMetricMetadata["status"]) {
  if (value == null) return unavailable[locale][status === "empty" ? 1 : status === "invalid_metric" ? 2 : status === "api_error" || status === "permission_error" ? 3 : 0];
  const formatted = new Intl.NumberFormat(locales[locale], { notation: Math.abs(value) >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Math.abs(value));
  if (key === "followersLost") return value > 0 ? `−${formatted}` : formatted;
  if (key === "followersGained" || key === "followersNet") return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted}`;
  return formatted;
}
export function reportMetricMetadata(metadata: Record<string, ReportMetricMetadata> | undefined, platform: "instagram" | "facebook") {
  if (!metadata) return undefined;
  const mapping = { reach: "reach", impressions: "views", engagement: platform === "instagram" ? "interactions" : "engagement", followers: "followers", visits: platform === "instagram" ? "profileViews" : "pageViews", clicks: "linkClicks", followersGained: "followersGained", followersLost: "followersLost", followersNet: "followersNet" };
  return Object.fromEntries(Object.entries(mapping).flatMap(([key, source]) => metadata[source] ? [[key, metadata[source]]] : []));
}
