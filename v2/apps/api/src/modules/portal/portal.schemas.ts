import { z } from "zod";

export const portalBoardQuerySchema = z.object({
  archived: z
    .union([z.literal("0"), z.literal("1"), z.literal("true"), z.literal("false")])
    .optional(),
  search: z.string().min(1).max(255).optional(),
});

export const portalSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(255),
});

const portalMediaUrlSchema = z.string().startsWith("/api/uploads/", "Arquivo de mídia inválido.");

export const createPortalPostSchema = z.object({
  title: z.string().trim().min(1).max(255),
  caption: z.string().trim().max(5000).nullable().optional(),
  commentText: z.string().trim().max(5000).nullable().optional(),
  artType: z.string().trim().min(1).max(50).default("Post único"),
  externalLinkUrl: z.string().url().max(1024).nullable().optional(),
  mediaUrls: z.array(portalMediaUrlSchema).max(20).default([]),
});

export const portalCardDecisionSchema = z.object({
  expectedApprovalRevision: z.number().int().nonnegative().optional(),
  approved: z.boolean(),
  commentText: z.string().trim().max(5000).optional(),
});

export const updatePortalCardCaptionSchema = z.object({
  caption: z.string().trim().max(5000).nullable(),
});

export const updatePortalSuggestionSchema = z.object({
  title: z.string().trim().min(1).max(255),
  caption: z.string().trim().max(5000).nullable(),
  externalLinkUrl: z.string().url().max(1024).nullable(),
});

export const updatePortalCardTagsSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(100)).max(30),
});

export type PortalBoardQueryInput = z.infer<typeof portalBoardQuerySchema>;
export type PortalSearchQueryInput = z.infer<typeof portalSearchQuerySchema>;
export type CreatePortalPostInput = z.infer<typeof createPortalPostSchema>;
export type PortalCardDecisionInput = z.infer<typeof portalCardDecisionSchema>;
export type UpdatePortalCardCaptionInput = z.infer<typeof updatePortalCardCaptionSchema>;
export type UpdatePortalSuggestionInput = z.infer<typeof updatePortalSuggestionSchema>;
export type UpdatePortalCardTagsInput = z.infer<typeof updatePortalCardTagsSchema>;
