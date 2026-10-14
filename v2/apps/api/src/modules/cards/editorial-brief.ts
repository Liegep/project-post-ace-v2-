import { z } from "zod";

const text = (max: number) => z.string().max(max).nullable().optional();
export const editorialBriefSchema = z.object({
  concept: text(8000), hook: text(4000), cta: text(4000), description: text(12000),
  rationale: text(8000), objective: text(4000), sourceTitle: text(500),
  sourceSummary: text(20000),
  sourceUrl: z.string().url().max(4000).refine(value => {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  }).nullable().optional(),
  sourceDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }), z.string().datetime({ offset: true }).max(40)]).nullable().optional(),
}).strict();
export type EditorialBrief = z.infer<typeof editorialBriefSchema>;
export function readEditorialBrief(raw: unknown): EditorialBrief | null {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    // Only client-facing fields may leave storage, including when reading legacy/untrusted JSON.
    const allowed: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(editorialBriefSchema.shape)) {
      const parsed = schema.safeParse(value[key]);
      if (parsed.success && parsed.data !== undefined) allowed[key] = parsed.data;
    }
    return Object.values(allowed).some(value => typeof value === "string" && value.trim()) ? allowed as EditorialBrief : null;
  } catch { return null; }
}
