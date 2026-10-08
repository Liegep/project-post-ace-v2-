import type { FastifyPluginAsync } from "fastify";
import {
  canAccessInternalArea,
  canCreateClients,
  getClientScope,
} from "./auth.access.js";
import { changeMyPasswordSchema, completePasswordResetSchema, createUserSchema, loginSchema, requestPasswordResetSchema, resetManagedUserPasswordSchema, updateManagedUserSchema, updateMyProfileSchema } from "./auth.schemas.js";
import { changeMyPassword, createManagedUser, loginWithPassword, resetManagedUserPassword, updateMyProfile } from "./auth.service.js";
import { deactivateManagedUser, listUsers, updateManagedUserWithMemberships } from "./auth.repository.js";
import { completePasswordReset, requestPasswordReset } from "./password-reset.service.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/login", async (request) => {
    const input = loginSchema.parse(request.body);
    const session = await loginWithPassword(app, input);

    return {
      authenticated: true,
      ...session,
    };
  });

  app.post("/auth/forgot-password", async (request) => {
    const { email } = requestPasswordResetSchema.parse(request.body);
    await requestPasswordReset(app, email);
    return { ok: true, message: "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha." };
  });

  app.post("/auth/reset-password", async (request) => {
    const input = completePasswordResetSchema.parse(request.body);
    await completePasswordReset(app, input.token, input.newPassword);
    return { ok: true };
  });

  app.get("/auth/session", async (request) => {
    if (!request.auth) {
      return {
        authenticated: false,
        roles: ["super_admin", "admin", "colaborador", "cliente"],
      };
    }

    const { user, memberships } = request.auth;
    const scope = getClientScope(user.globalRole, user.id, memberships);

    return {
      authenticated: true,
      user,
      memberships,
      scope,
      capabilities: {
        internalArea: canAccessInternalArea(user.globalRole),
        canCreateClients: canCreateClients(user.globalRole),
        canSeeGlobalData: user.globalRole === "super_admin",
      },
      roles: ["super_admin", "admin", "colaborador", "cliente"],
    };
  });

  app.patch("/auth/me", async (request) => {
    if (!request.auth) throw app.httpErrors.unauthorized("Sessão obrigatória.");
    return { ok: true, user: await updateMyProfile(app, request.auth.user.id, updateMyProfileSchema.parse(request.body)) };
  });

  app.post("/auth/change-password", async (request) => {
    if (!request.auth) throw app.httpErrors.unauthorized("Sessão obrigatória.");
    await changeMyPassword(app, request.auth.user.id, changeMyPasswordSchema.parse(request.body));
    return { ok: true };
  });

  app.get("/auth/users", async (request) => {
    if (!request.auth) throw app.httpErrors.unauthorized("Sessão obrigatória.");
    if (request.auth.user.globalRole !== "super_admin" && request.auth.user.globalRole !== "admin") {
      throw app.httpErrors.forbidden("Seu perfil não pode listar acessos.");
    }
    const items = await listUsers(app.db);
    return {
      items: request.auth.user.globalRole === "super_admin"
        ? items
        : items.filter((item) => item.globalRole === "admin" || item.globalRole === "colaborador"),
    };
  });

  app.post("/auth/users", async (request) => {
    if (!request.auth) throw app.httpErrors.unauthorized("Sessão obrigatória.");
    if (request.auth.user.globalRole !== "super_admin") throw app.httpErrors.forbidden("Apenas o super admin pode criar acessos.");
    const input = createUserSchema.parse(request.body);
    const created = await createManagedUser(app, input, request.auth.user.id);
    return { ok: true, user: created.user, memberships: created.memberships };
  });

  app.post("/auth/users/:userId/reset-password", async (request) => {
    if (!request.auth) throw app.httpErrors.unauthorized("Sessão obrigatória.");
    if (request.auth.user.globalRole !== "super_admin") throw app.httpErrors.forbidden("Apenas o super admin pode redefinir senhas.");
    const { userId } = request.params as { userId: string };
    const input = resetManagedUserPasswordSchema.parse(request.body);
    await resetManagedUserPassword(app, userId, input.newPassword);
    return { ok: true };
  });

  app.patch("/auth/users/:userId", async (request) => {
    if (!request.auth) throw app.httpErrors.unauthorized("Sessão obrigatória.");
    if (request.auth.user.globalRole !== "super_admin") throw app.httpErrors.forbidden("Apenas o super admin pode alterar acessos.");
    const { userId } = request.params as { userId: string };
    if (userId === request.auth.user.id) throw app.httpErrors.badRequest("Altere o seu próprio perfil pelas configurações da conta.");
    const input = updateManagedUserSchema.parse(request.body);
    const user = await updateManagedUserWithMemberships(app.db, userId, { ...input, assignedByUserId: request.auth.user.id });
    if (!user) throw app.httpErrors.notFound("Usuário não encontrado.");
    return { ok: true, user: user.user, memberships: user.memberships };
  });

  app.delete("/auth/users/:userId", async (request) => {
    if (!request.auth) throw app.httpErrors.unauthorized("Sessão obrigatória.");
    if (request.auth.user.globalRole !== "super_admin") throw app.httpErrors.forbidden("Apenas o super admin pode remover acessos.");
    const { userId } = request.params as { userId: string };
    if (userId === request.auth.user.id) throw app.httpErrors.badRequest("Você não pode remover o próprio acesso.");
    await deactivateManagedUser(app.db, userId);
    return { ok: true };
  });
};
