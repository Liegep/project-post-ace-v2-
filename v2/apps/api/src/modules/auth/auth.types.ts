export const appRoles = ["super_admin", "admin", "colaborador", "cliente"] as const;

export type AppRole = (typeof appRoles)[number];

export const membershipRoles = ["admin", "colaborador", "cliente"] as const;

export type MembershipRole = (typeof membershipRoles)[number];

export const portalAccessLevels = ["admin", "approver", "viewer"] as const;
export type PortalAccessLevel = (typeof portalAccessLevels)[number];

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  globalRole: AppRole;
  avatarUrl: string | null;
  locale: string;
  isActive: boolean;
};

export type ClientMembership = {
  clientAccountId: string;
  membershipRole: MembershipRole;
  portalAccessLevel: PortalAccessLevel;
  isPrimary: boolean;
  clientName: string;
  clientSlug: string;
  ownerUserId: string | null;
};

export type AuthContext = {
  user: AuthUser;
  memberships: ClientMembership[];
};
