import { z } from "zod";

const nullableText = z.string().max(20_000).nullable().optional();
const textTagSchema = z.union([
  z.string().trim().min(1).max(40).transform((name) => ({ name, color: "#7568dc" })),
  z.object({
    name: z.string().trim().min(1).max(40),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#7568dc"),
  }),
]);

export const createTextSchema = z.object({
  title: z.string().min(1).max(255).default("Novo texto"),
  contentHtml: z.string().max(500_000).default("<p>Comece a escrever aqui.</p>"),
  contentType: z.enum(["Blog", "Artigo", "Texto", "Copy", "Documento"]).default("Texto"),
  tags: z.array(textTagSchema).max(12).default([]),
});

export const updateTextSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  contentHtml: z.string().max(500_000).optional(),
  contentType: z.enum(["Blog", "Artigo", "Texto", "Copy", "Documento"]).optional(),
  plannedAt: z.string().date().nullable().optional(),
  internalNotes: nullableText,
  status: z.enum(["Rascunho", "Em revisão", "Aprovado"]).optional(),
  tags: z.array(textTagSchema).max(12).optional(),
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
