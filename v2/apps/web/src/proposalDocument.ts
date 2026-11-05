export type ProposalOption = {
  id: string;
  name: string;
  description: string;
  items: string[];
  value: number;
  recommended: boolean;
};
export type ProposalDocument = {
  title: string;
  summary: string;
  scopeTitle: string;
  objectives: string;
  included: string;
  excluded: string;
  mode: "single" | "alternatives";
  options: ProposalOption[];
  deliverablesTitle: string;
  deliverables: Array<{ name: string; description: string }>;
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
