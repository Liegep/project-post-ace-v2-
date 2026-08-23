import type { SessionUser } from "./types";

export const ACCESS_TOKEN_KEY = "designhub-v2-access-token";

type ApiAuthResponse = {
  authenticated: boolean;
  accessToken: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    globalRole: "super_admin" | "admin" | "colaborador" | "cliente";
    locale: string;
    avatarUrl?: string | null;
  };
  memberships: Array<{
    clientAccountId: string;
    membershipRole: "admin" | "colaborador" | "cliente";
    clientSlug: string;
  }>;
};

function getApiBaseUrl() {
  const value = import.meta.env.VITE_V2_API_URL;
  return typeof value === "string" && value.length > 0 ? value : "";
}

function mapRole(role: ApiAuthResponse["user"]["globalRole"]): SessionUser["role"] {
  switch (role) {
    case "colaborador":
      return "collaborator";
    case "cliente":
      return "client";
    default:
      return role;
  }
}

function mapSessionFromApi(data: ApiAuthResponse) {
  const assignedAdminSlugs = data.memberships
    .filter((membership) => membership.membershipRole !== "cliente")
    .map((membership) => membership.clientSlug);
  const assignedPortalSlugs = data.memberships
    .filter((membership) => membership.membershipRole === "cliente")
    .map((membership) => membership.clientSlug);
  const role = mapRole(data.user.globalRole);

  return {
    id: data.user.id,
    name: data.user.fullName,
    email: data.user.email,
    password: "",
    role,
    assignedAdminSlugs: role === "client" ? [] : assignedAdminSlugs,
    assignedPortalSlugs:
      assignedPortalSlugs.length > 0 ? assignedPortalSlugs : data.memberships.map((m) => m.clientSlug),
    locale: data.user.locale,
    avatarUrl: data.user.avatarUrl ?? null,
    source: "api" as const,
    accessToken: data.accessToken,
  };
}

export async function loginWithApi(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as ApiAuthResponse;
  return mapSessionFromApi(data);
}

export async function restoreApiSession(accessToken: string): Promise<SessionUser | null> {
  if (!accessToken) return null;

  const response = await fetch(`${getApiBaseUrl()}/api/auth/session`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Omit<ApiAuthResponse, "accessToken"> & {
    authenticated: boolean;
  };

  if (!data.authenticated) {
    return null;
  }

  return mapSessionFromApi({
    ...data,
    accessToken,
  });
}
