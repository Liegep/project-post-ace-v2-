import { z } from "zod";

export const createColumnSchema = z.object({
  name: z.string().min(1).max(190),
  color: z.string().max(20).nullable().optional(),
  visibleToClient: z.boolean().default(false),
  autoCreated: z.boolean().default(false),
});

export const updateColumnSchema = z.object({
  name: z.string().min(1).max(190).optional(),
  color: z.string().max(20).nullable().optional(),
  visibleToClient: z.boolean().optional(),
  autoCreated: z.boolean().optional(),
});

export const reorderColumnsSchema = z.object({
  orderedColumnIds: z.array(z.string().min(1)).min(1),
});

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type ReorderColumnsInput = z.infer<typeof reorderColumnsSchema>;
