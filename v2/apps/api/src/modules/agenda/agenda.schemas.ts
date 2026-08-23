import { z } from "zod";
const recurrenceType = z.enum(["none", "weekdays", "weekly", "monthly_nth_weekday"]);
export const createAgendaEventSchema = z.object({ title: z.string().min(1).max(255), taskDescription: z.string().max(4000).nullable().optional(), startsAt: z.string().min(1), endsAt: z.string().nullable().optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#c9f7df"), clientAccountId: z.string().uuid().nullable().optional(), labelId: z.string().uuid().nullable().optional(), recurrenceType: recurrenceType.default("none"), repeatUntil: z.string().nullable().optional() });
export const updateAgendaEventSchema = createAgendaEventSchema.partial().extend({ title: z.string().min(1).max(255).optional() });
export const listAgendaEventsSchema = z.object({ from: z.string().min(1), to: z.string().min(1) });
export const createAgendaLabelSchema = z.object({ name: z.string().min(1).max(120), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) });
export type CreateAgendaEventInput = z.infer<typeof createAgendaEventSchema>;
