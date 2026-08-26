import type { FastifyRequest } from "fastify";
import type { AppRole, ClientMembership, MembershipRole } from "./auth.types.js";

const roleRank: Record<AppRole, number> = {
  cliente: 0,
  colaborador: 1,
  admin: 2,
  super_admin: 3,
};

export function hasGlobalRole(userRole: AppRole, minimumRole: AppRole) {
  return roleRank[userRole] >= roleRank[minimumRole];
}

export function canCreateClients(userRole: AppRole) {
  return userRole === "super_admin";
}

export function canAccessInternalArea(userRole: AppRole) {
  return userRole !== "cliente";
}

export function getClientScope(
  userRole: AppRole,
  userId: string,
  memberships: ClientMembership[],
) {
  if (userRole === "super_admin") {
    return { mode: "global" as const, clientIds: [] as string[] };
  }

  if (userRole === "admin") {
    const ownedClientIds = memberships
      .filter((membership) => membership.ownerUserId === userId)
      .map((membership) => membership.clientAccountId);
    const assignedClientIds = memberships.map((membership) => membership.clientAccountId);

    return {
      mode: "scoped" as const,
      clientIds: [...new Set([...ownedClientIds, ...assignedClientIds])],
    };
  }

  return {
    mode: "scoped" as const,
    clientIds: [...new Set(memberships.map((membership) => membership.clientAccountId))],
  };
}

export function hasMembershipRole(
  memberships: ClientMembership[],
  clientAccountId: string,
  allowedRoles: MembershipRole[],
) {
  return memberships.some(
    (membership) =>
      membership.clientAccountId === clientAccountId &&
      allowedRoles.includes(membership.membershipRole),
  );
}

export function assertInternalAccess(request: FastifyRequest) {
  const auth = request.auth;
  if (!auth) {
    throw request.server.httpErrors.unauthorized("Sessão obrigatória.");
  }
  if (!canAccessInternalArea(auth.user.globalRole)) {
    throw request.server.httpErrors.forbidden(
      "Clientes não podem acessar a área interna.",
    );
  }
}

export function assertCanCreateClients(request: FastifyRequest) {
  const auth = request.auth;
  if (!auth) {
    throw request.server.httpErrors.unauthorized("Sessão obrigatória.");
  }
  if (!canCreateClients(auth.user.globalRole)) {
    throw request.server.httpErrors.forbidden(
      "Seu perfil não pode criar clientes.",
    );
  }
}

export function assertClientAccess(
  request: FastifyRequest,
  clientAccountId: string,
  allowedMembershipRoles: MembershipRole[] = ["admin", "colaborador", "cliente"],
) {
  const auth = request.auth;
  if (!auth) {
    throw request.server.httpErrors.unauthorized("Sessão obrigatória.");
  }

  if (auth.user.globalRole === "super_admin") return;

  const scope = getClientScope(auth.user.globalRole, auth.user.id, auth.memberships);
  if (scope.mode === "scoped" && !scope.clientIds.includes(clientAccountId)) {
    throw request.server.httpErrors.forbidden(
      "Você não tem acesso a esta conta.",
    );
  }

  if (auth.user.globalRole === "cliente") {
    const ok = hasMembershipRole(auth.memberships, clientAccountId, ["cliente"]);
    if (!ok) {
      throw request.server.httpErrors.forbidden(
        "Cliente só pode acessar a própria área.",
      );
    }
    return;
  }

  if (allowedMembershipRoles.length > 0) {
    const ok = hasMembershipRole(auth.memberships, clientAccountId, allowedMembershipRoles);
    if (!ok) {
      throw request.server.httpErrors.forbidden(
        "Seu papel nessa conta não permite esta ação.",
      );
    }
  }
}
