import type { Pool, RowDataPacket } from "mysql2/promise";
import crypto from "node:crypto";
import type { AppRole, AuthContext, ClientMembership } from "./auth.types.js";
import type { CreateUserInput } from "./auth.schemas.js";

type UserRow = RowDataPacket & {
  id: string;
  full_name: string;
  email: string;
  global_role: AppRole;
  avatar_url: string | null;
  locale: string;
  is_active: number;
  password_hash: string;
};

type UserListRow = RowDataPacket & {
  id: string;
  full_name: string;
  email: string;
  global_role: AppRole;
  locale: string;
  is_active: number;
  created_at: Date | string;
};

type MembershipRow = RowDataPacket & {
  client_account_id: string;
  membership_role: ClientMembership["membershipRole"];
  is_primary: number;
  client_name: string;
  client_slug: string;
  owner_user_id: string | null;
};

export async function findAuthContextByUserId(
  db: Pool,
  userId: string,
): Promise<AuthContext | null> {
  const [users] = await db.query<UserRow[]>(
    [
      "SELECT id, full_name, email, global_role, avatar_url, locale, is_active, password_hash",
      "FROM users",
      "WHERE id = ?",
      "LIMIT 1",
    ].join(" "),
    [userId],
  );

  const user = users[0];
  if (!user) return null;

  const [membershipRows] = await db.query<MembershipRow[]>(
    [
      "SELECT",
      "cm.client_account_id,",
      "cm.membership_role,",
      "cm.is_primary,",
      "ca.name AS client_name,",
      "ca.slug AS client_slug,",
      "ca.owner_user_id",
      "FROM client_memberships cm",
      "INNER JOIN client_accounts ca ON ca.id = cm.client_account_id",
      "WHERE cm.user_id = ?",
      "ORDER BY cm.is_primary DESC, ca.name ASC",
    ].join(" "),
    [userId],
  );

  return {
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      globalRole: user.global_role,
      avatarUrl: user.avatar_url,
      locale: user.locale,
      isActive: Boolean(user.is_active),
    },
    memberships: membershipRows.map((row) => ({
      clientAccountId: row.client_account_id,
      membershipRole: row.membership_role,
      isPrimary: Boolean(row.is_primary),
      clientName: row.client_name,
      clientSlug: row.client_slug,
      ownerUserId: row.owner_user_id,
    })),
  };
}

export async function findUserByEmail(db: Pool, email: string) {
  const [users] = await db.query<UserRow[]>(
    [
      "SELECT id, full_name, email, global_role, avatar_url, locale, is_active, password_hash",
      "FROM users",
      "WHERE email = ?",
      "LIMIT 1",
    ].join(" "),
    [email.toLowerCase()],
  );

  return users[0] ?? null;
}

export async function updateUserAvatar(db: Pool, userId: string, avatarUrl: string | null) {
  await db.query("UPDATE users SET avatar_url = ? WHERE id = ?", [avatarUrl, userId]);
  return findAuthContextByUserId(db, userId);
}

export async function updateUserPasswordHash(db: Pool, userId: string, passwordHash: string) {
  await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
}

export async function listUsers(db: Pool) {
  const [rows] = await db.query<UserListRow[]>(
    [
      "SELECT id, full_name, email, global_role, locale, is_active, created_at",
      "FROM users",
      "ORDER BY created_at DESC, full_name ASC",
    ].join(" "),
  );

  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    globalRole: row.global_role,
    locale: row.locale,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  }));
}

export async function createUserWithMemberships(
  db: Pool,
  input: CreateUserInput & { id: string; passwordHash: string; createdByUserId: string | null },
) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      [
        "INSERT INTO users (id, full_name, email, password_hash, global_role, avatar_url, locale, is_active)",
        "VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
      ].join(" "),
      [
        input.id,
        input.fullName,
        input.email.toLowerCase(),
        input.passwordHash,
        input.globalRole,
        input.avatarUrl ?? null,
        input.locale,
      ],
    );

    for (const membership of input.memberships) {
      await connection.query(
        [
          "INSERT INTO client_memberships",
          "(id, user_id, client_account_id, membership_role, assigned_by_user_id, is_primary)",
          "VALUES (?, ?, ?, ?, ?, ?)",
        ].join(" "),
        [
          crypto.randomUUID(),
          input.id,
          membership.clientAccountId,
          membership.membershipRole,
          input.createdByUserId,
          membership.isPrimary ? 1 : 0,
        ],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return findAuthContextByUserId(db, input.id);
}
