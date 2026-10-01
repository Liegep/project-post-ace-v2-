import type { MetaPublishDestination, ReportMetrics } from "./api";

const emptyChannel = () => ({ reach: null, impressions: null, engagement: null, followers: null, visits: null, clicks: null });

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
