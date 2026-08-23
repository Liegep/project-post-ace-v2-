import { z } from "zod";

export const createHashtagGroupSchema = z.object({
  name: z.string().min(1).max(120),
  hashtags: z.array(z.string().min(2).max(100)).min(1).max(100),
});

export type CreateHashtagGroupInput = z.infer<typeof createHashtagGroupSchema>;
