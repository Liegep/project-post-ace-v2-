import { z } from "zod";

const nullableString = z.string().min(1).nullable().optional();
const mediaUrlSchema = z
  .string()
  .refine(
    (value) => z.string().url().safeParse(value).success || value.startsWith("/api/uploads/"),
    "URL de midia invalida.",
  );

export const listCardsQuerySchema = z.object({
  archived: z
    .union([z.literal("0"), z.literal("1"), z.literal("true"), z.literal("false")])
    .optional(),
  columnId: z.string().min(1).optional(),
  search: z.string().min(1).max(255).optional(),
});

export const boardQuerySchema = z.object({
  archived: z
    .union([z.literal("0"), z.literal("1"), z.literal("true"), z.literal("false")])
    .optional(),
  search: z.string().min(1).max(255).optional(),
});

export const createCardSchema = z.object({
  columnId: z.string().min(1).nullable().optional(),
  title: z.string().min(1).max(255),
  caption: z.string().nullable().optional(),
  mediaType: z.string().min(1).max(50).default("image"),
  primaryMediaUrl: mediaUrlSchema.nullable().optional(),
  mediaUrls: z.array(mediaUrlSchema).default([]),
  externalLinkUrl: z.string().url().max(1024).nullable().optional(),
  artType: z.string().min(1).max(50).default("single_post"),
  status: z.array(z.string().min(1).max(100)).default([]),
  tags: z.array(z.string().min(1).max(100)).default([]),
  hashtags: z.array(z.string().min(1).max(100)).default([]),
  isBriefApproval: z.boolean().default(false),
  keepFiles: z.boolean().default(false),
  deadlineAt: nullableString,
  scheduledAt: nullableString,
  scheduledTimeZone: z.string().min(1).max(64).optional(),
  clientLabel: z.string().min(1).max(100).default("pendente"),
  eventColor: z.string().max(20).nullable().optional(),
});

export const updateCardSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  caption: z.string().nullable().optional(),
  mediaType: z.string().min(1).max(50).optional(),
  primaryMediaUrl: mediaUrlSchema.nullable().optional(),
  mediaUrls: z.array(mediaUrlSchema).optional(),
  externalLinkUrl: z.string().url().max(1024).nullable().optional(),
  artType: z.string().min(1).max(50).optional(),
  status: z.array(z.string().min(1).max(100)).optional(),
  tags: z.array(z.string().min(1).max(100)).optional(),
  hashtags: z.array(z.string().min(1).max(100)).optional(),
  isBriefApproval: z.boolean().optional(),
  keepFiles: z.boolean().optional(),
  deadlineAt: nullableString,
  scheduledAt: nullableString,
  scheduledTimeZone: z.string().min(1).max(64).optional(),
  clientLabel: z.string().min(1).max(100).optional(),
  eventColor: z.string().max(20).nullable().optional(),
});

export const moveCardSchema = z.object({
  columnId: z.string().min(1).nullable(),
  position: z.number().int().min(0).optional(),
});

export const archiveCardSchema = z.object({
  archived: z.boolean(),
});

export type ListCardsQueryInput = z.infer<typeof listCardsQuerySchema>;
export type BoardQueryInput = z.infer<typeof boardQuerySchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
export type ArchiveCardInput = z.infer<typeof archiveCardSchema>;
