import { z } from "zod";

const nullableMetaIdentifier = z.union([
  z.string().trim().min(1).max(190),
  z.null(),
]).optional();

const nullableMetaLabel = z.union([
  z.string().trim().min(1).max(255),
  z.null(),
]).optional();

export const metaCallbackSchema = z.object({
  code: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1),
  error: z.string().trim().optional(),
  error_description: z.string().trim().optional(),
});

export const metaConnectQuerySchema = z.object({
  returnTo: z.string().trim().regex(/^#\/(dashboard|admin\/[a-z0-9-]+)$/).optional(),
});

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data no formato AAAA-MM-DD.").refine(
  (value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  },
  "Data inválida.",
);

export const metaInsightsQuerySchema = z.object({
  since: isoDateSchema,
  until: isoDateSchema,
}).refine((value) => value.since <= value.until, {
  message: "A data inicial deve ser anterior ou igual à data final.",
  path: ["until"],
});

export type MetaInsightsPeriod = z.infer<typeof metaInsightsQuerySchema>;

export const clientMetaAssetsSchema = z.object({
  facebookPageId: nullableMetaIdentifier,
  facebookPageName: nullableMetaLabel,
  instagramAccountId: nullableMetaIdentifier,
  instagramUsername: nullableMetaLabel,
  metaAdAccountId: nullableMetaIdentifier,
  metaAdAccountName: nullableMetaLabel,
}).superRefine((value, context) => {
  if (Boolean(value.facebookPageId) !== Boolean(value.facebookPageName)) {
    context.addIssue({ code: "custom", message: "A Página do Facebook deve ter id e nome.", path: ["facebookPageId"] });
  }
  if (Boolean(value.instagramAccountId) !== Boolean(value.instagramUsername)) {
    context.addIssue({ code: "custom", message: "A conta do Instagram deve ter id e usuário.", path: ["instagramAccountId"] });
  }
  if (value.instagramAccountId && !value.facebookPageId) {
    context.addIssue({ code: "custom", message: "A conta do Instagram deve pertencer a uma Página selecionada.", path: ["instagramAccountId"] });
  }
  if (Boolean(value.metaAdAccountId) !== Boolean(value.metaAdAccountName)) {
    context.addIssue({ code: "custom", message: "A Conta de anúncios deve ter id e nome.", path: ["metaAdAccountId"] });
  }
});

export type ClientMetaAssetsInput = z.infer<typeof clientMetaAssetsSchema>;

const isoDateTimeSchema = z.string().trim().refine((value) => {
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}, "Use uma data e hora ISO com fuso horário.");

const metaPublicationPlatformSchema = z.enum(["instagram", "facebook"]);

const instagramUserTagSchema = z.object({
  username: z.string().trim().transform((value) => value.replace(/^@+/, "")).refine(
    (value) => /^[A-Za-z0-9._]{1,30}$/.test(value),
    "Use um @username válido do Instagram.",
  ),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const createMetaPublicationSchema = z.object({
  cardId: z.string().trim().min(1).max(190),
  platform: metaPublicationPlatformSchema.optional(),
  platforms: z.array(metaPublicationPlatformSchema).min(1).max(2).optional(),
  scheduledAt: isoDateTimeSchema,
  reelCoverUrl: z.union([
    z.string().trim().max(2048).refine(
      (value) => value.startsWith("/api/uploads/") || z.string().url().safeParse(value).success,
      "URL da capa do Reel inválida.",
    ),
    z.null(),
  ]).optional(),
  locationId: z.union([z.string().trim().regex(/^\d+$/, "O ID da localização deve ser numérico.").max(190), z.null()]).optional(),
  instagramUserTags: z.array(instagramUserTagSchema).max(20, "O Instagram aceita no máximo 20 marcações por publicação.").optional(),
  timezone: z.string().trim().min(1).max(100).refine((value) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Timezone inválido."),
}).superRefine((value, context) => {
  if (!value.platform && !value.platforms?.length) {
    context.addIssue({ code: "custom", message: "Selecione pelo menos uma plataforma.", path: ["platforms"] });
  }
  const selectedPlatforms = value.platforms ?? (value.platform ? [value.platform] : []);
  if (value.instagramUserTags?.length && !selectedPlatforms.includes("instagram")) {
    context.addIssue({ code: "custom", message: "Marcações de pessoas estão disponíveis somente para Instagram nesta versão.", path: ["instagramUserTags"] });
  }
}).transform((value) => ({
  ...value,
  platforms: [...new Set(value.platforms ?? (value.platform ? [value.platform] : []))],
  locationId: value.locationId || null,
  reelCoverUrl: value.reelCoverUrl || null,
  instagramUserTags: value.instagramUserTags ?? [],
}));
