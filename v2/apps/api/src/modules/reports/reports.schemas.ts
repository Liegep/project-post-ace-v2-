import { z } from "zod";

const metricValueSchema = z.number().min(0).nullable();
const channelMetricsSchema = z.object({
  reach: metricValueSchema,
  impressions: metricValueSchema,
  engagement: metricValueSchema,
  followers: metricValueSchema,
  visits: metricValueSchema,
  clicks: metricValueSchema,
});

const metricsSchema = z.object({
  instagram: channelMetricsSchema,
  facebook: channelMetricsSchema.extend({
    posts: metricValueSchema.optional(),
    reactions: metricValueSchema.optional(),
    comments: metricValueSchema.optional(),
    shares: metricValueSchema.optional(),
  }),
});

const highlightsSchema = z.array(z.object({
  channel: z.enum(["instagram", "facebook"]),
  title: z.string().trim().max(255),
  value: z.number().min(0),
  thumbnailUrl: z.string().url().nullable().optional(),
  permalink: z.string().url().nullable().optional(),
  metricLabel: z.enum(["interactions"]).optional(),
})).max(8);

const reportFieldsSchema = z.object({ title: z.string().trim().min(1).max(255), periodStart: z.string().date(), periodEnd: z.string().date(), metrics: metricsSchema, highlights: highlightsSchema.default([]), evidenceUrls: z.array(z.string().url()).max(16).default([]), notes: z.string().max(10_000).nullable().optional() });
export const createReportSchema = reportFieldsSchema.refine((input) => input.periodStart <= input.periodEnd, { message: "O período inicial deve vir antes do final.", path: ["periodEnd"] });
export const updateReportSchema = reportFieldsSchema.partial();
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
