import { z } from "zod";
import { isIsoCountryCode } from "./iso-countries.js";
import { calendarDayNumber } from "./seasonal.dates.js";

export const countryCodeSchema = z.string().trim().transform((code) => code.toUpperCase())
  .refine(isIsoCountryCode, "Use um código ISO 3166-1 alpha-2 válido.");
export const countryCodesSchema = z.array(countryCodeSchema).max(249).transform((codes) => [...new Set(codes)]);
export const dateSchema = z.string().refine((date) => {
  try { calendarDayNumber(date); return true; } catch { return false; }
}, "Data inválida; use AAAA-MM-DD.");
export const categorySchema = z.object({ code: z.string().regex(/^[a-z0-9_-]{1,64}$/), label: z.string().trim().min(1).max(120) });
export const occurrenceSchema = z.object({
  date: dateSchema,
  countryCodes: countryCodesSchema.optional(),
  externalSource: z.string().trim().min(1).max(64).nullable().optional(),
  externalReference: z.string().trim().min(1).max(255).nullable().optional(),
  externalPayload: z.record(z.string(), z.unknown()).nullable().optional(),
  regionalScope: z.object({ nationwide: z.boolean(), subdivisions: z.array(z.string().max(32)).max(500) }).nullable().optional(),
}).refine((item) => !item.externalReference || !!item.externalSource, "Referência externa exige uma origem externa.");
export const opportunitySchema = z.object({
  title: z.string().trim().min(1).max(255), description: z.string().max(10000).default(""),
  categoryCode: categorySchema.shape.code, origin: z.string().trim().min(1).max(64).default("manual"),
  scope: z.enum(["global", "countries"]), countryCodes: countryCodesSchema.default([]),
  occurrences: z.array(occurrenceSchema).min(1).max(366),
}).superRefine((input, ctx) => {
  if ((input.scope === "global" && input.countryCodes.length !== 0) || (input.scope === "countries" && input.countryCodes.length === 0)) {
    ctx.addIssue({ code: "custom", message: "Global não possui países; abrangência por países exige ao menos um.", path: ["countryCodes"] });
  }
  input.occurrences.forEach((item, index) => {
    if (item.countryCodes !== undefined && (input.scope === "global" || item.countryCodes.length === 0 || item.countryCodes.some((code) => !input.countryCodes.includes(code)))) {
      ctx.addIssue({ code: "custom", message: "Países da ocorrência devem ser um subconjunto não vazio da oportunidade.", path: ["occurrences", index, "countryCodes"] });
    }
    if (input.scope === "global" && item.regionalScope) ctx.addIssue({ code: "custom", message: "Oportunidade global não possui abrangência regional.", path: ["occurrences", index, "regionalScope"] });
  });
});
export const marketSchema = z.object({ countryCodes: countryCodesSchema, confirmed: z.literal(true) });
export const monitorSchema = z.object({ active: z.boolean() });
export const radarQuerySchema = z.object({
  from: dateSchema, to: dateSchema, countryCode: countryCodeSchema.optional(),
  categoryCode: categorySchema.shape.code.optional(), clientId: z.string().min(1).max(36).optional(),
  offset: z.coerce.number().int().min(0).max(100000).default(0), limit: z.coerce.number().int().min(1).max(100).default(50),
  includeExternal: z.enum(["true", "false"]).default("true"),
}).refine((input) => {
  try {
    const days = calendarDayNumber(input.to) - calendarDayNumber(input.from);
    return days >= 0 && days <= 366;
  } catch { return false; }
}, "Escolha um intervalo de até 367 dias, com início anterior ao fim.");
export type OpportunityInput = z.infer<typeof opportunitySchema>;
export type RadarQuery = z.infer<typeof radarQuerySchema>;
