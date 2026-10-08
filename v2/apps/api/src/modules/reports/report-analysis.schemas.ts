import { z } from 'zod';
import { createReportSchema } from './reports.schemas.js';
const text = z.string().trim().min(1).max(900);
const title = z.string().trim().min(1).max(160);
const refs = z.array(z.string().min(1).max(100)).min(1).max(6);
const supported = { evidence: z.string().trim().min(1).max(2400), evidenceRefs: refs };
const point = z.strictObject({ title, explanation: text, ...supported });
export const reportAnalysisSchema = z.strictObject({
  executiveSummary: text,
  keyFindings: z.array(z.strictObject({ title, finding: text, ...supported, type: z.enum(['fact', 'interpretation', 'hypothesis']) })).max(5),
  whatWorked: z.array(point).max(4), attentionPoints: z.array(point).max(4),
  platformComparison: z.strictObject({ instagram: text.nullable(), facebook: text.nullable(), evidenceRefs: refs }).nullable(),
  contentInsights: z.array(z.strictObject({ contentTitle: title.nullable(), insight: text, ...supported })).max(5),
  nextSteps: z.array(z.strictObject({ action: title, reason: text, priority: z.enum(['high', 'medium', 'low']), ...supported })).max(5),
  experiments: z.array(z.strictObject({ test: title, expectedLearning: text, ...supported })).max(3),
  confidenceNotes: z.array(text).max(8),
});
export const reportAnalysisJsonSchema = z.toJSONSchema(reportAnalysisSchema);
// Use the same local contract and constrain every reference to IDs in this request.
// An empty registry requires empty supported sections and null comparison; local
// minimum-reference validation remains unchanged.
export function reportAnalysisSchemaForEvidence(ids: string[]) {
  const schema = structuredClone(reportAnalysisJsonSchema);
  if (!ids.length) {
    const properties = schema.properties as Record<string, any>;
    for (const key of ['keyFindings', 'whatWorked', 'attentionPoints', 'contentInsights', 'nextSteps', 'experiments']) properties[key].maxItems = 0;
    properties.platformComparison = { type: 'null' };
    return schema;
  }
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.properties?.evidenceRefs) {
      const refs = node.properties.evidenceRefs;
      refs.items.enum = [...ids];
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit); else visit(value);
    }
  };
  visit(schema);
  return schema;
}
// Snapshot of the editor only: identities, comparison and Brand Brain are never accepted from the browser.
export const reportAnalysisRequestSchema = z.strictObject({ snapshot: createReportSchema.optional() });
export type ReportAnalysis = z.infer<typeof reportAnalysisSchema>;
