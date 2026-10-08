import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).optional();
const nullable = (max: number) => text(max).nullable();
export const ALIGNMENT_SCORE_CONTRACT = "alignmentScore must be an integer from 0 to 100. Examples: weak alignment = 25; moderate = 55; strong = 80; excellent = 95. Never use a 0–10 scale. A value of 9 means 9 percent, not 9 out of 10.";
const alignmentScore = z.number().int().min(0).max(100).describe(ALIGNMENT_SCORE_CONTRACT);
export const analyzeInput = z.object({ title: text(240), description: optional(6000), caption: optional(10000), contentType: optional(80) }).strict();
export const analysisOutput = z.object({ alignmentScore, approvalPrediction: z.enum(["high", "medium", "low"]), mainPillar: nullable(240), tone: z.enum(["aligned", "partial", "misaligned"]), toneReason: text(500), audienceFit: text(500), strengths: z.array(text(300)).max(3), warnings: z.array(text(300)).max(3), recommendation: text(800), basedOn: z.array(text(200)).max(6) }).strict();
export const ideaOutput = z.object({ temporaryId: text(80), title: text(240), concept: text(800), hook: text(400), description: text(1600), format: text(80), pillar: nullable(240), objective: text(400), rationale: text(600), cta: nullable(400), contentSuggestion: nullable(2000), alignmentScore, basedOn: z.array(text(200)).max(6) }).strict();
export const generateInput = z.object({ objective: z.enum(["engagement", "authority", "education", "conversion", "relationship", "institutional", "other"]), quantity: z.union([z.literal(3), z.literal(5), z.literal(10)]), format: z.enum(["free", "post", "carousel", "reel", "story", "article"]).optional(), topic: optional(500), notes: optional(2000) }).strict();
export const generationOutput = z.object({ ideas: z.array(ideaOutput).min(1).max(10) }).strict();
export const refineInput = z.object({ idea: ideaOutput, direction: z.enum(["educational", "commercial", "human", "direct", "sophisticated", "custom"]), customDirection: optional(1000) }).strict().refine(input => input.direction !== "custom" || !!input.customDirection?.trim(), "Descreva o refinamento desejado.");
export const radarInput = z.object({ sourceTitle: text(500), sourceUrl: z.string().url().max(4000).refine(value => { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }).nullable().optional().default(null), sourceDate: z.union([z.string().date(), z.string().datetime({ offset: true })]).nullable().optional().default(null), sourceSummary: text(6000), radarName: text(240).optional().default("Radar") }).strict();
export const radarIdeaOutput = ideaOutput.omit({ temporaryId: true, contentSuggestion: true }).extend({ captionSuggestion: nullable(2000) });
// Both keys required for the provider's strict schema. The public service omits null suggestion.
export const radarOutput = z.object({ shouldCreate: z.boolean(), suggestion: radarIdeaOutput.nullable() }).strict();
export type AiIdea = z.infer<typeof ideaOutput>;
export type AiAnalysis = z.infer<typeof analysisOutput>;
