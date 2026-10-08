import assert from "node:assert/strict";
import test from "node:test";
import type { MetaPublishDestination, ReportMetrics } from "../src/api";
import { chooseReportMetaDestination, reportDestinationMetadata, resetOrganicReportMetrics } from "../src/reportMetaDestinations";

const destination = (id: string, name: string, isDefault = false): MetaPublishDestination => ({
  id, clientAccountId: "client-1", name, facebookPageId: `page-${id}`, facebookPageName: name,
  instagramAccountId: `ig-${id}`, instagramUsername: name.toLowerCase(), isDefault,
  createdAt: "2026-10-01T10:00:00Z", updatedAt: "2026-10-01T10:00:00Z",
});

test("one destination is selected automatically and two destinations honor the report snapshot", () => {
  const commercial = destination("commercial", "Kynagogi Commercial", true);
  const detection = destination("detection", "Kynagogi Detection");
  assert.equal(chooseReportMetaDestination([commercial])?.id, "commercial");
  assert.equal(chooseReportMetaDestination([commercial, detection], "detection")?.id, "detection");
  assert.equal(chooseReportMetaDestination([detection, commercial])?.id, "commercial");
});

test("changing organic destination clears organic data but preserves client-level Ads", () => {
  const ads: NonNullable<ReportMetrics["ads"]> = {
    accountName: "Kynagogi Ads", currency: "SEK", spend: 100, reach: 200, impressions: 300,
    frequency: 1.5, clicks: 20, inlineLinkClicks: 15, ctr: 5, cpc: 2, cpm: 3, cpp: 4,
    uniqueClicks: 10, uniqueCtr: 4, campaigns: [],
  };
  const reset = resetOrganicReportMetrics({
    instagram: { reach: 1, impressions: 2, engagement: 3, followers: 4, visits: 5, clicks: 6 },
    facebook: { reach: 7, impressions: 8, engagement: 9, followers: 10, visits: 11, clicks: 12 },
    ads,
  });
  assert.equal(reset.instagram.reach, null);
  assert.equal(reset.facebook.reach, null);
  assert.equal(reset.ads, ads);
});

test("portal and PDF destination metadata remains optional and never exposes an id", () => {
  assert.equal(reportDestinationMetadata(null, "Conta analisada"), null);
  assert.equal(reportDestinationMetadata(undefined, "Conta analisada"), null);
  assert.equal(reportDestinationMetadata(" Kynagogi Detection ", "Conta analisada"), "Conta analisada: Kynagogi Detection");
});
