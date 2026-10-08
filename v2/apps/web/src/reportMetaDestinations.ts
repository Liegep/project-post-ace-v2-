import type { MetaPublishDestination, ReportMetrics } from "./api";

export const REPORT_INSTAGRAM_INSIGHTS_PERIOD_MESSAGE = "O Instagram permite importar Insights em períodos de até 30 dias. Ajuste as datas e tente novamente.";

export function reportMetaImportPeriodWarning(hasInstagram: boolean, since: string, until: string) {
  const duration = Date.parse(`${until}T00:00:00Z`) - Date.parse(`${since}T00:00:00Z`);
  return hasInstagram && duration > 30 * 86_400_000
    ? REPORT_INSTAGRAM_INSIGHTS_PERIOD_MESSAGE
    : null;
}

const emptyChannel = () => ({ reach: null, impressions: null, engagement: null, followers: null, followersGained: null, followersLost: null, followersNet: null, visits: null, clicks: null });

export function emptyReportMetrics(): ReportMetrics {
  return { instagram: emptyChannel(), facebook: { ...emptyChannel(), posts: null, reactions: null, comments: null, shares: null } };
}

export function chooseReportMetaDestination(destinations: MetaPublishDestination[], preferredId?: string | null) {
  return destinations.find((destination) => destination.id === preferredId)
    ?? destinations.find((destination) => destination.isDefault)
    ?? destinations[0]
    ?? null;
}

export function resetOrganicReportMetrics(metrics: ReportMetrics): ReportMetrics {
  return { ...emptyReportMetrics(), ads: metrics.ads };
}

export function reportDestinationMetadata(name: string | null | undefined, label: string) {
  const value = name?.trim();
  return value ? `${label}: ${value}` : null;
}
