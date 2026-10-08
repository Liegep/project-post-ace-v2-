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
// Snapshot of the editor only: identities, comparison and Brand Brain are never accepted from the browser.
export const reportAnalysisRequestSchema = z.strictObject({ snapshot: createReportSchema.optional() });
export type ReportAnalysis = z.infer<typeof reportAnalysisSchema>;
