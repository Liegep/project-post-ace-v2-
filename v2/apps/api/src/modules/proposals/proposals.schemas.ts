import { z } from "zod";

const serviceSchema = z.object({
  name: z.string().trim().max(255).default(""),
  description: z.string().max(10_000).default(""),
  value: z.coerce.number().finite().min(0).default(0),
});

export const proposalFieldsSchema = z.object({
  clientName: z.string().trim().max(255),
  email: z.string().trim().email().or(z.literal("")).default(""),
  locale: z.string().trim().min(2).max(30).default("Português"),
  proposalType: z.string().trim().max(120).default("Projeto"),
  plan: z.string().trim().max(255).default(""),
  pieces: z.coerce.number().int().min(0).max(100_000).default(0),
  scope: z.string().max(250_000).default(""),
  investment: z.string().max(100_000).default(""),
  currency: z.string().trim().min(1).max(10).default("R$"),
  expiresAt: z.string().datetime(),
  status: z.enum(["draft", "sent", "viewed", "accepted", "refused", "expired"]).default("draft"),
  services: z.array(serviceSchema).max(200).default([]),
});

export const createProposalSchema = proposalFieldsSchema;
export const updateProposalSchema = proposalFieldsSchema.partial();
export const decideProposalSchema = z.object({ status: z.enum(["accepted", "refused"]) });

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
