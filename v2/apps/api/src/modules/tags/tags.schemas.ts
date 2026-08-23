import { z } from "zod";

export const createClientTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Informe uma cor hexadecimal valida."),
});

export type CreateClientTagInput = z.infer<typeof createClientTagSchema>;
