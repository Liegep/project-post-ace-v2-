import { z } from "zod";

export const portalBoardQuerySchema = z.object({
  archived: z
    .union([z.literal("0"), z.literal("1"), z.literal("true"), z.literal("false")])
    .optional(),
  search: z.string().min(1).max(255).optional(),
});

export type PortalBoardQueryInput = z.infer<typeof portalBoardQuerySchema>;
