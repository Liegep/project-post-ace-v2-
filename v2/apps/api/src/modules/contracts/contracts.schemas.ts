import { z } from "zod";

const nullableDate = z.string().date().nullable();

export const contractFieldsSchema = z.object({
  clientAccountId: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  bodyHtml: z.string().max(250_000).default(""),
  language: z.string().trim().min(2).max(50).default("Português"),
  contractType: z.string().trim().max(120).default("Prestação de serviços"),
  startDate: nullableDate.default(null),
  endDate: nullableDate.default(null),
  contractValue: z.string().trim().max(255).default(""),
  scope: z.string().max(100_000).default(""),
  notes: z.string().max(20_000).default(""),
  status: z.enum(["pending", "accepted", "cancelled"]).default("pending"),
});

export const createContractSchema = contractFieldsSchema;
export const updateContractSchema = contractFieldsSchema.partial();
export const createContractTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  bodyHtml: z.string().max(250_000).default(""),
  language: z.string().trim().min(2).max(50).default("Português"),
  description: z.string().trim().max(500).default("Modelo criado por você."),
  draft: contractFieldsSchema.omit({ clientAccountId: true, status: true }).partial().default({}),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type CreateContractTemplateInput = z.infer<typeof createContractTemplateSchema>;
