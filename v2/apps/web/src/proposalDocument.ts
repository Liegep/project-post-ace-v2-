export type ProposalTimelineStage = {
  id: string;
  title: string;
  description: string;
  value: string;
  unit: "business" | "calendar" | "date";
};

export type ProposalOption = {
  id: string;
  name: string;
  description: string;
  items: string[];
  value: number;
  recommended: boolean;
  subtitle?: string;
  excludedItems?: string[];
  badge?: string;
};
export type ProposalDocument = {
  title: string;
  summary: string;
  scopeTitle: string;
  objectives: string;
  included: string;
  excluded: string;
  mode: "single" | "alternatives" | "packages";
  options: ProposalOption[];
  deliverablesTitle: string;
  deliverables: Array<{ name: string; description: string }>;
  timelineStages?: ProposalTimelineStage[];
  timelineTitle: string;
  timelineValue: string;
  timelineUnit: "business" | "calendar" | "date";
  timelineStart: string;
  timelineNotes: string;
  addons: Array<{ name: string; description: string; value: number }>;
  paymentTerms: string;
  deposit: number | null;
  balance: string;
  paymentMethods: string;
  financialNotes: string;
  revisions: number | null;
  terms: string;
  clientMaterials: string;
  approvalText: string;
};
export const emptyProposalDocument = (): ProposalDocument => ({
  title: "",
  summary: "",
  scopeTitle: "",
  objectives: "",
  included: "",
  excluded: "",
  mode: "single",
  options: [],
  deliverablesTitle: "",
  deliverables: [],
  timelineTitle: "",
  timelineValue: "",
  timelineUnit: "business",
  timelineStart: "",
  timelineNotes: "",
  addons: [],
  paymentTerms: "",
  deposit: null,
  balance: "",
  paymentMethods: "",
  financialNotes: "",
  revisions: null,
  terms: "",
  clientMaterials: "",
  approvalText: "",
});

export const hasProposalPackages = (document?: ProposalDocument | null) =>
  document?.mode === "packages" || document?.mode === "alternatives";

// Absence means legacy data; an explicit empty list means the user removed it.
// Reading a proposal never rewrites its historical document or acceptance snapshot.
export function proposalTimelineStages(
  document?: ProposalDocument | null,
): ProposalTimelineStage[] {
  if (!document) return [];
  if (document.timelineStages !== undefined) return document.timelineStages;
  return document.timelineValue
    ? [
        {
          id: "00000000-0000-4000-8000-000000000001",
          title: "",
          description: "",
          value: document.timelineValue,
          unit: document.timelineUnit,
        },
      ]
    : [];
}
