import { z } from "zod";
import { appRoles, membershipRoles, portalAccessLevels } from "./auth.types.js";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const createUserSchema = z.object({
  fullName: z.string().min(2).max(160),
  email: z.email(),
  password: z.string().min(8).max(120),
  globalRole: z.enum(appRoles),
  locale: z.string().min(2).max(10).default("pt"),
  avatarUrl: z.string().url().optional().nullable(),
  memberships: z
    .array(
      z.object({
        clientAccountId: z.string().min(1),
        membershipRole: z.enum(membershipRoles),
        portalAccessLevel: z.enum(portalAccessLevels).default("approver"),
        isPrimary: z.boolean().default(false),
      }),
    )
    .default([]),
});

export const updateMyProfileSchema = z.object({
  avatarUrl: z.string()
    .max(512)
    .refine(
      (value) => z.string().url().safeParse(value).success || value.startsWith("/api/uploads/"),
      "URL da foto inválida.",
    )
    .nullable(),
});

export const changeMyPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(120),
});

export const resetManagedUserPasswordSchema = z.object({
  newPassword: z.string().min(8).max(120),
});

export const requestPasswordResetSchema = z.object({
  email: z.email(),
});

export const completePasswordResetSchema = z.object({
  token: z.string().min(32).max(256),
  newPassword: z.string().min(8).max(120),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
export type ChangeMyPasswordInput = z.infer<typeof changeMyPasswordSchema>;
export type ResetManagedUserPasswordInput = z.infer<typeof resetManagedUserPasswordSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type CompletePasswordResetInput = z.infer<typeof completePasswordResetSchema>;
