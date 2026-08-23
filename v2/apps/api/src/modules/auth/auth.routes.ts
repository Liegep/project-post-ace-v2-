import type { FastifyPluginAsync } from "fastify";
import {
  canAccessInternalArea,
  canCreateClients,
  hasGlobalRole,
  getClientScope,
} from "./auth.access.js";
import { changeMyPasswordSchema, createUserSchema, loginSchema, resetManagedUserPasswordSchema, updateMyProfileSchema } from "./auth.schemas.js";
import { changeMyPassword, createManagedUser, loginWithPassword, resetManagedUserPassword, updateMyProfile } from "./auth.service.js";
import { listUsers } from "./auth.repository.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/login", async (request) => {
    const input = loginSchema.parse(request.body);
    const session = await loginWithPassword(app, input);

    return {
      authenticated: true,
      ...session,
    };
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
    if (!request.auth) throw app.httpErrors.unauthorized("Sessao obrigatoria.");
    return { ok: true, user: await updateMyProfile(app, request.auth.user.id, updateMyProfileSchema.parse(request.body)) };
  });

  app.post("/auth/change-password", async (request) => {
    if (!request.auth) throw app.httpErrors.unauthorized("Sessao obrigatoria.");
    await changeMyPassword(app, request.auth.user.id, changeMyPasswordSchema.parse(request.body));
    return { ok: true };
  });

  app.get("/auth/users", async (request) => {
    if (!request.auth) {
      throw app.httpErrors.unauthorized("Sessao obrigatoria.");
    }
    if (!hasGlobalRole(request.auth.user.globalRole, "super_admin")) {
      throw app.httpErrors.forbidden(
        "Apenas o super admin pode listar acessos.",
      );
    }

    return {
      items: await listUsers(app.db),
    };
  });

  app.post("/auth/users", async (request) => {
    if (!request.auth) {
      throw app.httpErrors.unauthorized("Sessao obrigatoria.");
    }
    if (!hasGlobalRole(request.auth.user.globalRole, "super_admin")) {
      throw app.httpErrors.forbidden(
        "Apenas o super admin pode criar acessos.",
      );
    }

    const input = createUserSchema.parse(request.body);
    const created = await createManagedUser(app, input, request.auth.user.id);

    return {
      ok: true,
      user: created.user,
      memberships: created.memberships,
    };
  });

  app.post("/auth/users/:userId/reset-password", async (request) => {
    if (!request.auth) throw app.httpErrors.unauthorized("Sessao obrigatoria.");
    if (!hasGlobalRole(request.auth.user.globalRole, "super_admin")) {
      throw app.httpErrors.forbidden("Apenas o super admin pode redefinir senhas.");
    }
    const { userId } = request.params as { userId: string };
    const input = resetManagedUserPasswordSchema.parse(request.body);
    await resetManagedUserPassword(app, userId, input.newPassword);
    return { ok: true };
  });
};
