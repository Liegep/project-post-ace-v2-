import { z } from "zod";
export const fieldSchema = z
  .object({
    id: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,120}$/)
      .refine(
        (value) => !["__proto__", "constructor", "prototype"].includes(value),
        "ID de campo reservado.",
      ),
    type: z.enum([
      "short",
      "long",
      "choice",
      "checklist",
      "dropdown",
      "number",
      "date",
      "link",
      "scale",
      "file",
    ]),
    label: z.string().trim().min(1).max(500),
    help: z.string().max(5000).default(""),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(500)).max(100).default([]),
    validation: z
      .object({
        min: z.number().finite().optional(),
        max: z.number().finite().optional(),
        maxLength: z.number().int().min(1).max(10000).optional(),
        maxFiles: z.number().int().min(1).max(10).optional(),
      })
      .strict()
      .default({}),
  })
  .strict()
  .superRefine((field, ctx) => {
    if (
      ["choice", "checklist", "dropdown"].includes(field.type) &&
      (!field.options.length ||
        new Set(field.options).size !== field.options.length)
    )
      ctx.addIssue({
        code: "custom",
        message: "Opções devem ser únicas e não vazias.",
      });
    if (
      field.validation.min !== undefined &&
      field.validation.max !== undefined &&
      field.validation.min > field.validation.max
    )
      ctx.addIssue({ code: "custom", message: "Intervalo inválido." });
    if (
      field.type === "scale" &&
      (field.validation.min ?? 1) > (field.validation.max ?? 5)
    )
      ctx.addIssue({
        code: "custom",
        message: "Intervalo da escala inválido.",
      });
    if (
      field.type === "scale" &&
      [field.validation.min ?? 1, field.validation.max ?? 5].some(
        (value) => !Number.isInteger(value),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Escala exige limites inteiros.",
      });
  });
export const formSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    introduction: z.string().max(10000).default(""),
    category: z.string().trim().min(1).max(100).default("custom"),
    locale: z.enum(["pt", "en", "es", "it", "sv"]).default("pt"),
    fields: z.array(fieldSchema).max(200).default([]),
  })
  .strict()
  .superRefine((form, ctx) => {
    if (new Set(form.fields.map((f) => f.id)).size !== form.fields.length)
      ctx.addIssue({
        code: "custom",
        message: "IDs de campos devem ser únicos.",
      });
  });
export const templateSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(255),
    description: z.string().max(10000).default(""),
    form: formSchema,
  })
  .strict();
export const templateUpdateSchema = templateSchema
  .omit({ id: true })
  .extend({ expectedVersion: z.number().int().positive() });
export const instanceSchema = z
  .object({
    id: z.string().uuid(),
    clientAccountId: z.string().uuid().nullable(),
    templateId: z.string().uuid().nullable().default(null),
    templateVersion: z.number().int().positive().nullable().default(null),
    form: formSchema,
  })
  .strict();
export const instanceUpdateSchema = instanceSchema
  .omit({ id: true, templateId: true, templateVersion: true })
  .extend({ expectedVersion: z.number().int().positive() });
export const versionSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const responseSchema = versionSchema.extend({
  answers: z.record(z.string(), z.unknown()),
});
export const submitSchema = responseSchema.extend({
  idempotencyKey: z.string().uuid(),
});
export type BriefForm = z.infer<typeof formSchema>;
export type BriefField = BriefForm["fields"][number];
export function briefError(
  message: string,
  statusCode = 409,
): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      );
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}
export function validateAnswers(
  form: BriefForm,
  answers: Record<string, unknown>,
  submit: boolean,
) {
  const fields = new Map(form.fields.map((field) => [field.id, field]));
  if (Buffer.byteLength(JSON.stringify(answers)) > 500000)
    throw briefError("Respostas excedem o limite permitido.", 400);
  for (const key of Object.keys(answers))
    if (!fields.has(key)) throw briefError(`Campo desconhecido: ${key}.`, 400);
  for (const field of form.fields) {
    const value = answers[field.id];
    const empty =
      value === undefined ||
      value === null ||
      value === "" ||
      (typeof value === "string" && !value.trim()) ||
      (Array.isArray(value) && !value.length);
    if (empty) {
      if (
        field.type === "file" &&
        value !== undefined &&
        value !== null &&
        !Array.isArray(value)
      )
        throw briefError(`Resposta inválida: ${field.label}.`, 400);
      if (submit && field.required)
        throw briefError(`Preencha: ${field.label}.`, 400);
      continue;
    }
    let valid = false;
    switch (field.type) {
      case "short":
      case "long":
        valid =
          typeof value === "string" &&
          value.length <=
            (field.validation.maxLength ??
              (field.type === "short" ? 500 : 10000));
        break;
      case "link":
        try {
          const url = new URL(String(value));
          valid =
            typeof value === "string" &&
            value.length <= 2000 &&
            ["http:", "https:"].includes(url.protocol);
        } catch {}
        break;
      case "choice":
      case "dropdown":
        valid = typeof value === "string" && field.options.includes(value);
        break;
      case "checklist":
        valid =
          Array.isArray(value) &&
          value.every(
            (v) => typeof v === "string" && field.options.includes(v),
          ) &&
          new Set(value).size === value.length;
        break;
      case "number":
      case "scale":
        valid =
          typeof value === "number" &&
          Number.isFinite(value) &&
          (field.type !== "scale" || Number.isInteger(value)) &&
          value >=
            (field.validation.min ??
              (field.type === "scale" ? 1 : -Infinity)) &&
          value <=
            (field.validation.max ?? (field.type === "scale" ? 5 : Infinity));
        break;
      case "date":
        valid =
          typeof value === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !Number.isNaN(new Date(value + "T00:00:00Z").valueOf()) &&
          new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
        break;
      case "file":
        valid =
          Array.isArray(value) &&
          value.length <= (field.validation.maxFiles ?? 5) &&
          value.every(
            (v) =>
              typeof v === "string" && z.string().uuid().safeParse(v).success,
          ) &&
          new Set(value).size === value.length;
        break;
    }
    if (!valid) throw briefError(`Resposta inválida: ${field.label}.`, 400);
  }
}
