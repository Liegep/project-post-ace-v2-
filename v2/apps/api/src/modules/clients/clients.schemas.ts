import { z } from "zod";
import { membershipRoles } from "../auth/auth.types.js";

const defaultClientPermissions = {
  allowClientEditCaption: false,
  allowClientCreatePost: false,
  allowClientCreateTags: false,
  allowClientDownload: false,
  allowClientEditBrandBrain: false,
  allowClientSearch: false,
  allowClientViewInvoices: false,
  allowClientViewReports: false,
  allowClientViewBrandBrain: false,
  allowClientViewTracking: false,
};

// Uploads locais sao expostos pela propria API como caminhos relativos.
const clientLogoUrlSchema = z
  .string()
  .refine(
    (value) => z.string().url().safeParse(value).success || value.startsWith("/api/uploads/"),
    "URL do logo invalida.",
  );

export const createClientAccountSchema = z.object({
  name: z.string().min(2).max(190),
  slug: z
    .string()
    .min(2)
    .max(190)
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minusculas, numeros e hifen."),
  locale: z.string().min(2).max(10).default("pt"),
  portalTitle: z.string().min(2).max(190),
  ownerUserId: z.string().min(1).nullable().optional(),
  logoUrl: clientLogoUrlSchema.nullable().optional(),
  calendarColor: z.string().max(20).nullable().optional(),
  showUpcomingPosts: z.boolean().default(false),
  showArchivedToClient: z.boolean().default(false),
  trackingEnabled: z.boolean().default(false),
  trackingVisibleToClient: z.boolean().default(false),
  clientPermissions: z
    .object({
      allowClientEditCaption: z.boolean().default(false),
      allowClientCreatePost: z.boolean().default(false),
      allowClientCreateTags: z.boolean().default(false),
      allowClientDownload: z.boolean().default(false),
      allowClientEditBrandBrain: z.boolean().default(false),
      allowClientSearch: z.boolean().default(false),
      allowClientViewInvoices: z.boolean().default(false),
      allowClientViewReports: z.boolean().default(false),
      allowClientViewBrandBrain: z.boolean().default(false),
      allowClientViewTracking: z.boolean().default(false),
    })
    .default(defaultClientPermissions),
});

export const upsertClientMembershipSchema = z.object({
  userId: z.string().min(1),
  membershipRole: z.enum(membershipRoles),
  isPrimary: z.boolean().default(false),
});

export const updateClientAccountSchema = z.object({
  name: z.string().min(2).max(190),
  slug: z.string().min(2).max(190).regex(/^[a-z0-9-]+$/, "Use apenas letras minusculas, numeros e hifen."),
  locale: z.string().min(2).max(10),
  portalTitle: z.string().min(2).max(190),
  logoUrl: clientLogoUrlSchema.nullable().optional(),
});

export const updateClientTrackerSchema = z.object({
  locale: z.string().min(2).max(10),
  trackingEnabled: z.boolean(),
  trackingVisibleToClient: z.boolean(),
  showUpcomingPosts: z.boolean(),
  showArchivedToClient: z.boolean(),
  clientPermissions: z.object({
    allowClientEditCaption: z.boolean(),
    allowClientCreatePost: z.boolean(),
    allowClientCreateTags: z.boolean(),
    allowClientDownload: z.boolean(),
    allowClientEditBrandBrain: z.boolean(),
    allowClientSearch: z.boolean(),
    allowClientViewInvoices: z.boolean(),
    allowClientViewReports: z.boolean(),
    allowClientViewBrandBrain: z.boolean(),
    allowClientViewTracking: z.boolean(),
  }),
  visibleColumnIds: z.array(z.string().min(1)),
});

export type CreateClientAccountInput = z.infer<typeof createClientAccountSchema>;
export type UpsertClientMembershipInput = z.infer<typeof upsertClientMembershipSchema>;
export type UpdateClientAccountInput = z.infer<typeof updateClientAccountSchema>;
export type UpdateClientTrackerInput = z.infer<typeof updateClientTrackerSchema>;
