import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { createUserWithMemberships, findAuthContextByUserId, findUserByEmail, updateManagedUserWithMemberships, updateUserAvatar, updateUserPasswordHash } from "./auth.repository.js";
import { hashPassword, verifyPassword } from "./auth.crypto.js";
import type { ChangeMyPasswordInput, CreateUserInput, LoginInput, UpdateMyProfileInput } from "./auth.schemas.js";
import { signAccessToken } from "./auth.tokens.js";
import { verifyLegacyPassword } from "./legacy-auth.service.js";

export async function loginWithPassword(app: FastifyInstance, input: LoginInput) {
  const user = await findUserByEmail(app.db, input.email);

  if (!user) {
    throw app.httpErrors.unauthorized("Email ou senha inválidos.");
  }

  let passwordOk = Boolean(user.is_active) && await verifyPassword(input.password, user.password_hash);

  // Supabase Auth does not export plaintext passwords or reusable hashes.
  // Imported V1 accounts therefore migrate lazily on their first valid login.
  if (!passwordOk && await verifyLegacyPassword(app, user.email, input.password)) {
    await updateUserPasswordHash(app.db, user.id, await hashPassword(input.password), true);
    passwordOk = true;
  }

  if (!passwordOk) {
    throw app.httpErrors.unauthorized("Email ou senha inválidos.");
  }

  const auth = await findAuthContextByUserId(app.db, user.id);
  if (!auth) {
    throw app.httpErrors.notFound("Usuário não encontrado.");
  }

  const accessToken = signAccessToken(app, {
    userId: auth.user.id,
    role: auth.user.globalRole,
  });

  return {
    accessToken,
    user: auth.user,
    memberships: auth.memberships,
  };
}

export async function createManagedUser(
  app: FastifyInstance,
  input: CreateUserInput,
  createdByUserId: string | null,
) {
  const existing = await findUserByEmail(app.db, input.email);
  if (existing) {
    if (existing.is_active) throw app.httpErrors.conflict("Já existe um usuário ativo com esse email.");
    await updateUserPasswordHash(app.db, existing.id, await hashPassword(input.password), true);
    const reactivated = await updateManagedUserWithMemberships(app.db, existing.id, {
      fullName: input.fullName,
      globalRole: input.globalRole,
      clientAccountIds: input.memberships.map((membership) => membership.clientAccountId),
      assignedByUserId: createdByUserId ?? existing.id,
      portalAccessLevel: input.memberships[0]?.portalAccessLevel,
    });
    if (!reactivated) throw app.httpErrors.badRequest("Não foi possível reativar o usuário.");
    return reactivated;
  }

  const passwordHash = await hashPassword(input.password);
  const created = await createUserWithMemberships(app.db, {
    ...input,
    id: crypto.randomUUID(),
    passwordHash,
    createdByUserId,
  });

  if (!created) {
    throw app.httpErrors.badRequest("Não foi possível criar o usuário.");
  }

  return created;
}

export async function updateMyProfile(app: FastifyInstance, userId: string, input: UpdateMyProfileInput) {
  const updated = await updateUserAvatar(app.db, userId, input.avatarUrl);
  if (!updated) throw app.httpErrors.notFound("Usuário não encontrado.");
  return updated.user;
}

export async function changeMyPassword(app: FastifyInstance, userId: string, input: ChangeMyPasswordInput) {
  const user = await findAuthContextByUserId(app.db, userId);
  const account = await findUserByEmail(app.db, user?.user.email ?? "");
  if (!account || !(await verifyPassword(input.currentPassword, account.password_hash))) {
    throw app.httpErrors.badRequest("A senha atual esta incorreta.");
  }
  await updateUserPasswordHash(app.db, userId, await hashPassword(input.newPassword));
}

export async function resetManagedUserPassword(app: FastifyInstance, userId: string, newPassword: string) {
  const user = await findAuthContextByUserId(app.db, userId);
  if (!user) throw app.httpErrors.notFound("Usuário não encontrado.");
  // Imported accounts intentionally start inactive. A password defined by the
  // super admin is the explicit activation step and does not send any email.
  await updateUserPasswordHash(app.db, userId, await hashPassword(newPassword), true);
}
