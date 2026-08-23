import { z } from "zod";

export const calendarQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  status: z.enum(["draft", "in_review", "approved", "scheduled", "published"]).optional(),
});

export type CalendarQueryInput = z.infer<typeof calendarQuerySchema>;
