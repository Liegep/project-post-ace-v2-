import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => text(max).nullable().optional().default(null);
const sourceDate = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Data da fonte inválida."),
  z.string().datetime({ offset: true }).max(40),
]);
export const radarSuggestionInputSchema = z.object({
  title: text(240), concept: text(8000), hook: text(4000), description: text(12000),
  contentType: text(80), pillar: optionalText(240), objective: text(4000), rationale: text(8000),
  cta: optionalText(4000), captionSuggestion: optionalText(20000),
  alignmentScore: z.number().int().min(0).max(100).nullable().optional().default(null),
  sourceTitle: text(500),
  sourceUrl: z.string().trim().url().max(4000).refine((value) => {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  }, "Use uma URL HTTP/HTTPS sem credenciais.").nullable().optional().default(null),
  sourceDate: sourceDate.nullable().optional().default(null), radarName: text(240),
  aiModel: optionalText(120), basedOn: z.array(text(500)).max(20).optional().default([]),
  brandBrainVersion: z.number().int().min(0).max(4294967295).nullable().optional().default(null),
  brandBrainContextHash: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional().default(null),
}).strict();
export const radarSuggestionParamsSchema = z.object({ clientId: z.string().uuid() }).strict();
export const radarSuggestionDetailParamsSchema = radarSuggestionParamsSchema.extend({ id: z.string().uuid() });
export const radarSuggestionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
}).strict();
export type RadarSuggestionInput = z.infer<typeof radarSuggestionInputSchema>;
export type RadarSuggestionQuery = z.infer<typeof radarSuggestionQuerySchema>;
export type RadarSuggestion = RadarSuggestionInput & {
  id: string; clientAccountId: string; status: "pending" | "accepted" | "dismissed";
  sourceKey: string; dedupeHash: string; createdByUserId: string | null;
  acceptedPautaId: string | null; acceptedByUserId: string | null; dismissedByUserId: string | null;
  createdAt: string; updatedAt: string; acceptedAt: string | null; dismissedAt: string | null;
};

export type RadarSuggestionSummary = Pick<RadarSuggestion, "id" | "clientAccountId" | "title" | "contentType" | "pillar" | "alignmentScore" | "sourceTitle" | "sourceDate" | "createdAt"> & { clientName: string };
export type RadarPauta = { id: string; title: string; description: string; caption: string; contentType: string; status: "draft"; createdAt: string; updatedAt: string; createdBy: "radar_ai"; radarSuggestionId: string; radarSource: string; sourceTitle: string; sourceUrl: string | null; pillar: string | null; objective: string };
