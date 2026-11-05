import { z } from "zod";

const text = z.string().max(50000);
const optionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  description: text,
  items: z.array(text).max(100),
  value: z.number().finite().min(0).max(1e12),
  recommended: z.boolean(),
  subtitle: z.string().max(255).optional(),
  excludedItems: z.array(text).max(100).optional(),
  badge: z.string().max(80).optional(),
});
export const proposalDocumentSchema = z
  .object({
    title: text,
    summary: text,
    scopeTitle: text,
    objectives: text,
    included: text,
    excluded: text,
    mode: z.enum(["single", "alternatives", "packages"]),
    options: z.array(optionSchema).max(20),
    deliverablesTitle: text,
    deliverables: z.array(z.object({ name: text, description: text })).max(100),
    timelineTitle: text,
    timelineValue: z.string().max(100),
    timelineUnit: z.enum(["business", "calendar", "date"]),
    timelineStart: text,
    timelineNotes: text,
    addons: z
      .array(
        z.object({
          name: text,
          description: text,
          value: z.number().finite().min(0).max(1e12),
        }),
      )
      .max(100),
    paymentTerms: text,
    deposit: z.number().min(0).max(100).nullable(),
    balance: text,
    paymentMethods: text,
    financialNotes: text,
    revisions: z.number().int().min(0).max(1000).nullable(),
    terms: text,
    clientMaterials: text,
    approvalText: text,
  })
  .superRefine((doc, ctx) => {
    if (doc.mode === "packages" && doc.options.length < 1)
      ctx.addIssue({
        code: "custom",
        message: "Adicione pelo menos um pacote.",
        path: ["options"],
      });
    if (doc.mode === "alternatives" && doc.options.length < 2)
      ctx.addIssue({
        code: "custom",
        message: "Adicione pelo menos duas opções.",
        path: ["options"],
      });
    if (
      doc.timelineValue &&
      (doc.timelineUnit === "date"
        ? !/^\d{4}-\d{2}-\d{2}$/.test(doc.timelineValue) ||
          !Number.isFinite(Date.parse(doc.timelineValue))
        : !/^\d+$/.test(doc.timelineValue))
    )
      ctx.addIssue({
        code: "custom",
        message: "Informe um prazo válido.",
        path: ["timelineValue"],
      });
    if (new Set(doc.options.map((o) => o.id)).size !== doc.options.length)
      ctx.addIssue({
        code: "custom",
        message: "As opções devem ter identificadores únicos.",
        path: ["options"],
      });
  });
export type ProposalDocument = z.infer<typeof proposalDocumentSchema>;

const serviceSchema = z.object({
  name: z.string().trim().max(255).default(""),
  description: z.string().max(10_000).default(""),
  value: z.coerce.number().finite().min(0).default(0),
});

export const proposalFieldsSchema = z.object({
  document: proposalDocumentSchema.optional(),
  revision: z.number().int().min(0).optional(),
  clientName: z.string().trim().max(255),
  email: z.string().trim().email().or(z.literal("")).default(""),
  locale: z.string().trim().min(2).max(30).default("Português"),
  proposalType: z.string().trim().max(120).default("Projeto"),
  plan: z.string().trim().max(255).default(""),
  pieces: z.coerce.number().int().min(0).max(100_000).default(0),
  scope: z.string().max(250_000).default(""),
  investment: z.string().max(100_000).default(""),
  currency: z.string().trim().min(1).max(10).default("BRL"),
  expiresAt: z.string().datetime(),
  status: z
    .enum(["draft", "sent", "viewed", "accepted", "refused", "expired"])
    .default("draft"),
  services: z.array(serviceSchema).max(200).default([]),
});

export const createProposalSchema = proposalFieldsSchema;
export const updateProposalSchema = proposalFieldsSchema.partial().extend(
  Object.fromEntries(
    Object.entries(proposalFieldsSchema.shape).map(([key, schema]) => [
      key,
      (schema instanceof z.ZodDefault ? schema.unwrap() : schema).optional(),
    ]),
  ) as unknown as {
    [K in keyof typeof proposalFieldsSchema.shape]: z.ZodOptional<
      z.ZodType<z.infer<(typeof proposalFieldsSchema.shape)[K]>>
    >;
  },
);
export const decideProposalSchema = z.object({
  status: z.enum(["accepted", "refused"]),
  optionId: z.string().uuid().optional(),
  revision: z.number().int().min(0).optional(),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
