import { z } from "zod";

export const createApprovalLinkSchema = z.object({
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

export const submitApprovalDecisionSchema = z.object({
  approved: z.boolean(),
  commentText: z.string().min(1).max(5000).optional(),
  requesterName: z.string().min(2).max(160).optional(),
});

export type CreateApprovalLinkInput = z.infer<typeof createApprovalLinkSchema>;
export type SubmitApprovalDecisionInput = z.infer<typeof submitApprovalDecisionSchema>;
