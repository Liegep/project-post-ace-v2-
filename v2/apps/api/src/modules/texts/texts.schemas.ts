import { z } from "zod";

const nullableText = z.string().max(20_000).nullable().optional();

export const createTextSchema = z.object({
  title: z.string().min(1).max(255).default("Novo texto"),
  contentHtml: z.string().max(500_000).default("<p>Comece a escrever aqui.</p>"),
  contentType: z.enum(["Blog", "Artigo", "Texto", "Copy", "Documento"]).default("Texto"),
});

export const updateTextSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  contentHtml: z.string().max(500_000).optional(),
  contentType: z.enum(["Blog", "Artigo", "Texto", "Copy", "Documento"]).optional(),
  plannedAt: z.string().date().nullable().optional(),
  internalNotes: nullableText,
  status: z.enum(["Rascunho", "Em revisão", "Aprovado"]).optional(),
});

export const createTextCommentSchema = z.object({
  commentText: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false),
});

export const textDecisionSchema = z.object({
  approved: z.boolean(),
  commentText: z.string().max(5000).optional(),
});

export type CreateTextInput = z.infer<typeof createTextSchema>;
export type UpdateTextInput = z.infer<typeof updateTextSchema>;
export type CreateTextCommentInput = z.infer<typeof createTextCommentSchema>;
export type TextDecisionInput = z.infer<typeof textDecisionSchema>;
