import type { BriefInstance } from "./api";
// The input is the account-scoped list returned by the portal Briefs endpoint.
export function portalKnowledgeNavigation(allowBrandBrain: boolean, briefs: BriefInstance[]) {
  return [
    ...(allowBrandBrain ? [{ view: "brand" as const, label: "Brand Brain", count: 0 }] : []),
    ...(briefs.length ? [{ view: "briefs" as const, label: "Briefs", count: briefs.filter((brief) => brief.status === "sent" || brief.status === "reopened").length }] : []),
  ];
}
