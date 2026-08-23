import type { FastifyInstance } from "fastify";
import {
  createClientAccountWithDefaults,
  findClientAccountById,
  findClientAccountBySlug,
  findUserLookupById,
  listClientAccesses,
  upsertClientMembership,
} from "./clients.repository.js";
import type {
  CreateClientAccountInput,
  UpsertClientMembershipInput,
} from "./clients.schemas.js";

export async function createClientAccount(
  app: FastifyInstance,
  input: CreateClientAccountInput,
  createdByUserId: string,
) {
  const existingSlug = await findClientAccountBySlug(app.db, input.slug);
  if (existingSlug) {
    throw app.httpErrors.conflict("Ja existe uma conta com esse identificador.");
  }

  if (input.ownerUserId) {
    const ownerUser = await findUserLookupById(app.db, input.ownerUserId);
    if (!ownerUser) {
      throw app.httpErrors.notFound("Usuario responsavel nao encontrado.");
    }
    if (ownerUser.global_role === "cliente") {
      throw app.httpErrors.badRequest(
        "O responsavel interno nao pode ter perfil de cliente.",
      );
    }
  }

  const created = await createClientAccountWithDefaults(app.db, input, createdByUserId);
  if (!created) {
    throw app.httpErrors.badRequest("Nao foi possivel criar a conta do cliente.");
  }

  return created;
}

export async function attachUserToClient(
  app: FastifyInstance,
  clientAccountId: string,
  input: UpsertClientMembershipInput,
  assignedByUserId: string,
) {
  const client = await findClientAccountById(app.db, clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
  }

  const user = await findUserLookupById(app.db, input.userId);
  if (!user) {
    throw app.httpErrors.notFound("Usuario nao encontrado.");
  }

  if (input.membershipRole === "cliente" && user.global_role !== "cliente") {
    throw app.httpErrors.badRequest(
      "Para acesso de portal, o usuario precisa ter perfil global de cliente.",
    );
  }

  if (input.membershipRole !== "cliente" && user.global_role === "cliente") {
    throw app.httpErrors.badRequest(
      "Usuarios do portal nao podem receber papel interno nesta conta.",
    );
  }

  return upsertClientMembership(app.db, clientAccountId, input, assignedByUserId);
}

export async function getClientAccessList(
  app: FastifyInstance,
  clientAccountId: string,
) {
  const client = await findClientAccountById(app.db, clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
  }

  return {
    client,
    accesses: await listClientAccesses(app.db, clientAccountId),
  };
}
