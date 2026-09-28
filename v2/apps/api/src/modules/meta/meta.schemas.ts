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

export const clientMetaAssetsSchema = z.object({
  facebookPageId: nullableMetaIdentifier,
  facebookPageName: nullableMetaLabel,
  instagramAccountId: nullableMetaIdentifier,
  instagramUsername: nullableMetaLabel,
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
});

export type ClientMetaAssetsInput = z.infer<typeof clientMetaAssetsSchema>;
