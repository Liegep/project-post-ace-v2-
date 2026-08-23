import { z } from "zod";

export const createCommentSchema = z.object({
  commentText: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
