import { z } from "zod";

const noteColor = z.enum(["yellow", "pink", "blue", "green", "lavender"]);
const reminderDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export const createDashboardNoteSchema = z.object({
  text: z.string().trim().min(1).max(500),
  color: noteColor.default("yellow"),
  reminderDate: reminderDate.optional(),
});

export const updateDashboardNoteSchema = z.object({
  text: z.string().trim().min(1).max(500).optional(),
  color: noteColor.optional(),
  reminderDate: reminderDate.optional(),
});
