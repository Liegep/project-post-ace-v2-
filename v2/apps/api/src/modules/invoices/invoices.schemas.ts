import { z } from "zod";

const invoiceLineSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(2_000),
  quantity: z.number().positive().max(100_000),
  unitPrice: z.number().min(0).max(1_000_000_000),
});

const invoiceAttachmentSchema = z.object({
  id: z.string().uuid().optional(),
  fileName: z.string().trim().min(1).max(255),
  fileUrl: z.string().trim().min(1).max(2_000),
});

export const invoiceFieldsSchema = z.object({
  clientAccountId: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(255),
  clientName: z.string().trim().max(255),
  clientEmail: z.string().trim().max(255),
  clientAddress: z.string().trim().max(2_000),
  clientCountry: z.string().trim().max(120),
  clientTaxId: z.string().trim().max(120),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  period: z.string().trim().max(255),
  currency: z.enum(["BRL", "EUR", "USD", "SEK"]),
  locale: z.enum(["pt", "en", "it", "es", "sv"]),
  status: z.enum(["open", "paid", "overdue", "cancelled"]),
  recurring: z.boolean(),
  fixedAmount: z.boolean(),
  visibleToClient: z.boolean(),
  sentToClient: z.boolean(),
  notes: z.string().max(20_000),
  lines: z.array(invoiceLineSchema).max(200),
  attachments: z.array(invoiceAttachmentSchema).max(30),
});

export const createInvoiceSchema = invoiceFieldsSchema;
export const updateInvoiceSchema = invoiceFieldsSchema.partial();
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
