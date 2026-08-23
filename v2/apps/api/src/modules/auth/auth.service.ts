import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { createUserWithMemberships, findAuthContextByUserId, findUserByEmail, updateUserAvatar, updateUserPasswordHash } from "./auth.repository.js";
import { hashPassword, verifyPassword } from "./auth.crypto.js";
import type { ChangeMyPasswordInput, CreateUserInput, LoginInput, UpdateMyProfileInput } from "./auth.schemas.js";
import { signAccessToken } from "./auth.tokens.js";

export async function loginWithPassword(app: FastifyInstance, input: LoginInput) {
  const user = await findUserByEmail(app.db, input.email);

  if (!user || !user.is_active) {
    throw app.httpErrors.unauthorized("Email ou senha invalidos.");
  }

  const passwordOk = await verifyPassword(input.password, user.password_hash);
  if (!passwordOk) {
    throw app.httpErrors.unauthorized("Email ou senha invalidos.");
  }

  const auth = await findAuthContextByUserId(app.db, user.id);
  if (!auth) {
    throw app.httpErrors.notFound("Usuario nao encontrado.");
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
    throw app.httpErrors.conflict("Ja existe um usuario com esse email.");
  }

  const passwordHash = await hashPassword(input.password);
  const created = await createUserWithMemberships(app.db, {
    ...input,
    id: crypto.randomUUID(),
    passwordHash,
    createdByUserId,
  });

  if (!created) {
    throw app.httpErrors.badRequest("Nao foi possivel criar o usuario.");
  }

  return created;
}

export async function updateMyProfile(app: FastifyInstance, userId: string, input: UpdateMyProfileInput) {
  const updated = await updateUserAvatar(app.db, userId, input.avatarUrl);
  if (!updated) throw app.httpErrors.notFound("Usuario nao encontrado.");
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
  if (!user) throw app.httpErrors.notFound("Usuario nao encontrado.");
  await updateUserPasswordHash(app.db, userId, await hashPassword(newPassword));
}
