import { z } from "zod";

export const startTimeEntrySchema = z.object({
  clientAccountId: z.string().uuid(),
  cardId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(255).optional(),
});

export const listTimeEntriesSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  clientAccountId: z.string().uuid().optional(),
});
