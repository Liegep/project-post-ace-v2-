import { z } from "zod";

const fieldSchema = z.object({
  id: z.string().trim().min(1).max(120),
  type: z.enum(["short", "long", "choice", "checklist", "link", "file"]),
  label: z.string().max(500),
  help: z.string().max(5_000).default(""),
  required: z.boolean().default(false),
  options: z.array(z.string().max(500)).max(100).default([]),
});

const briefFieldsSchema = z.object({
  title: z.string().trim().min(1).max(500),
  introduction: z.string().max(10_000).default(""),
  category: z.string().trim().max(100).default("custom"),
  locale: z.enum(["pt", "en", "es", "it", "sv"]).default("pt"),
  status: z.enum(["draft", "completed"]).default("draft"),
  clientAccountId: z.string().uuid().nullable().optional(),
  fields: z.array(fieldSchema).max(200).default([]),
  answers: z.record(z.string(), z.unknown()).default({}),
});

export const createDesignBriefSchema = briefFieldsSchema;
export const updateDesignBriefSchema = briefFieldsSchema.partial();
export const createDesignBriefTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  introduction: z.string().max(10_000).default(""),
  fields: z.array(fieldSchema).max(200).default([]),
});

export type CreateDesignBriefInput = z.infer<typeof createDesignBriefSchema>;
export type UpdateDesignBriefInput = z.infer<typeof updateDesignBriefSchema>;
export type CreateDesignBriefTemplateInput = z.infer<typeof createDesignBriefTemplateSchema>;
