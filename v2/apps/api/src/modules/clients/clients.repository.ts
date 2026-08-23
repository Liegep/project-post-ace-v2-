import type { Pool, RowDataPacket } from "mysql2/promise";
import crypto from "node:crypto";
import type {
  CreateClientAccountInput,
  UpsertClientMembershipInput,
} from "./clients.schemas.js";

const starterColumns = [
  { name: "Ideias", color: "#7a86a9", visibleToClient: false },
  { name: "Em criação", color: "#24a7e8", visibleToClient: false },
  { name: "Em aprovação", color: "#f7a31a", visibleToClient: true },
  { name: "Agendados", color: "#12bf83", visibleToClient: true },
  { name: "Publicados", color: "#7b61ff", visibleToClient: true },
] as const;

type UserLookupRow = RowDataPacket & {
  id: string;
  full_name: string;
  email: string;
  global_role: "super_admin" | "admin" | "colaborador" | "cliente";
};

type ClientAccountLookupRow = RowDataPacket & {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  locale: string;
  portal_title: string;
  show_archived_to_client: number;
  show_upcoming_posts: number;
  tracking_enabled: number;
  tracking_visible_to_client: number;
  owner_user_id: string | null;
  created_at: Date | string;
};

type ClientPermissionsRow = RowDataPacket & {
  allow_client_edit_caption: number;
  allow_client_create_post: number;
  allow_client_create_tags: number;
  allow_client_download: number;
  allow_client_edit_brand_brain: number;
  allow_client_search: number;
  allow_client_view_invoices: number;
  allow_client_view_reports: number;
  allow_client_view_brand_brain: number;
  allow_client_view_tracking: number;
};

type ClientAccessRow = RowDataPacket & {
  membership_id: string;
  user_id: string;
  full_name: string;
  email: string;
  global_role: "super_admin" | "admin" | "colaborador" | "cliente";
  membership_role: "admin" | "colaborador" | "cliente";
  is_primary: number;
  created_at: Date | string;
};

export async function findClientAccountById(db: Pool, clientAccountId: string) {
  const [rows] = await db.query<ClientAccountLookupRow[]>(
    [
      "SELECT id, name, slug, logo_url, locale, portal_title, show_archived_to_client, show_upcoming_posts, tracking_enabled, tracking_visible_to_client, owner_user_id, created_at",
      "FROM client_accounts",
      "WHERE id = ?",
      "LIMIT 1",
    ].join(" "),
    [clientAccountId],
  );

  return rows[0] ?? null;
}

export async function findClientPermissionsByAccountId(
  db: Pool,
  clientAccountId: string,
) {
  const [rows] = await db.query<ClientPermissionsRow[]>(
    [
      "SELECT",
      "allow_client_edit_caption, allow_client_create_post, allow_client_create_tags, allow_client_download,",
      "allow_client_edit_brand_brain, allow_client_search, allow_client_view_invoices, allow_client_view_reports,",
      "allow_client_view_brand_brain, allow_client_view_tracking",
      "FROM client_permissions",
      "WHERE client_account_id = ?",
      "LIMIT 1",
    ].join(" "),
    [clientAccountId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    allowClientEditCaption: Boolean(row.allow_client_edit_caption),
    allowClientCreatePost: Boolean(row.allow_client_create_post),
    allowClientCreateTags: Boolean(row.allow_client_create_tags),
    allowClientDownload: Boolean(row.allow_client_download),
    allowClientEditBrandBrain: Boolean(row.allow_client_edit_brand_brain),
    allowClientSearch: Boolean(row.allow_client_search),
    allowClientViewInvoices: Boolean(row.allow_client_view_invoices),
    allowClientViewReports: Boolean(row.allow_client_view_reports),
    allowClientViewBrandBrain: Boolean(row.allow_client_view_brand_brain),
    allowClientViewTracking: Boolean(row.allow_client_view_tracking),
  };
}

export async function findClientAccountBySlug(db: Pool, slug: string) {
  const [rows] = await db.query<ClientAccountLookupRow[]>(
    [
      "SELECT id, name, slug, logo_url, locale, portal_title, show_archived_to_client, show_upcoming_posts, tracking_enabled, tracking_visible_to_client, owner_user_id, created_at",
      "FROM client_accounts",
      "WHERE slug = ?",
      "LIMIT 1",
    ].join(" "),
    [slug],
  );

  return rows[0] ?? null;
}

export async function findUserLookupById(db: Pool, userId: string) {
  const [rows] = await db.query<UserLookupRow[]>(
    [
      "SELECT id, full_name, email, global_role",
      "FROM users",
      "WHERE id = ?",
      "LIMIT 1",
    ].join(" "),
    [userId],
  );

  return rows[0] ?? null;
}

export async function createClientAccountWithDefaults(
  db: Pool,
  input: CreateClientAccountInput,
  createdByUserId: string,
) {
  const connection = await db.getConnection();
  const clientAccountId = crypto.randomUUID();
  const permissionsId = crypto.randomUUID();

  try {
    await connection.beginTransaction();

    await connection.query(
      [
        "INSERT INTO client_accounts",
        "(id, name, slug, owner_user_id, logo_url, locale, portal_title, show_upcoming_posts, show_archived_to_client, tracking_enabled, tracking_visible_to_client, calendar_color)",
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ].join(" "),
      [
        clientAccountId,
        input.name,
        input.slug,
        input.ownerUserId ?? null,
        input.logoUrl ?? null,
        input.locale,
        input.portalTitle,
        input.showUpcomingPosts ? 1 : 0,
        input.showArchivedToClient ? 1 : 0,
        input.trackingEnabled ? 1 : 0,
        input.trackingVisibleToClient ? 1 : 0,
        input.calendarColor ?? null,
      ],
    );

    await connection.query(
      [
        "INSERT INTO client_permissions",
        "(",
        "id, client_account_id,",
        "allow_client_edit_caption, allow_client_create_post, allow_client_create_tags, allow_client_download,",
        "allow_client_edit_brand_brain, allow_client_search, allow_client_view_invoices, allow_client_view_reports,",
        "allow_client_view_brand_brain, allow_client_view_tracking",
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ].join(" "),
      [
        permissionsId,
        clientAccountId,
        input.clientPermissions.allowClientEditCaption ? 1 : 0,
        input.clientPermissions.allowClientCreatePost ? 1 : 0,
        input.clientPermissions.allowClientCreateTags ? 1 : 0,
        input.clientPermissions.allowClientDownload ? 1 : 0,
        input.clientPermissions.allowClientEditBrandBrain ? 1 : 0,
        input.clientPermissions.allowClientSearch ? 1 : 0,
        input.clientPermissions.allowClientViewInvoices ? 1 : 0,
        input.clientPermissions.allowClientViewReports ? 1 : 0,
        input.clientPermissions.allowClientViewBrandBrain ? 1 : 0,
        input.clientPermissions.allowClientViewTracking ? 1 : 0,
      ],
    );

    await connection.query(
      [
        "INSERT INTO client_memberships",
        "(id, user_id, client_account_id, membership_role, assigned_by_user_id, is_primary)",
        "VALUES (?, ?, ?, 'admin', ?, 1)",
      ].join(" "),
      [
        crypto.randomUUID(),
        createdByUserId,
        clientAccountId,
        createdByUserId,
      ],
    );

    if (input.ownerUserId && input.ownerUserId !== createdByUserId) {
      await connection.query(
        [
          "INSERT INTO client_memberships",
          "(id, user_id, client_account_id, membership_role, assigned_by_user_id, is_primary)",
          "VALUES (?, ?, ?, 'admin', ?, 0)",
        ].join(" "),
        [
          crypto.randomUUID(),
          input.ownerUserId,
          clientAccountId,
          createdByUserId,
        ],
      );
    }

    // Every new account starts with a usable board instead of an empty canvas.
    for (const [position, column] of starterColumns.entries()) {
      await connection.query(
        [
          "INSERT INTO kanban_columns",
          "(id, client_account_id, name, color, position, visible_to_client, auto_created)",
          "VALUES (?, ?, ?, ?, ?, ?, 1)",
        ].join(" "),
        [
          crypto.randomUUID(),
          clientAccountId,
          column.name,
          column.color,
          position,
          column.visibleToClient ? 1 : 0,
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

  return findClientAccountById(db, clientAccountId);
}

export async function ensureClientStarterColumns(db: Pool, clientAccountId: string) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const [existingColumns] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM kanban_columns WHERE client_account_id = ? LIMIT 1 FOR UPDATE",
      [clientAccountId],
    );

    if (existingColumns.length > 0) {
      await connection.commit();
      return false;
    }

    // Restore a usable board only for legacy accounts that have no columns at all.
    for (const [position, column] of starterColumns.entries()) {
      await connection.query(
        [
          "INSERT INTO kanban_columns",
          "(id, client_account_id, name, color, position, visible_to_client, auto_created)",
          "VALUES (?, ?, ?, ?, ?, ?, 1)",
        ].join(" "),
        [
          crypto.randomUUID(),
          clientAccountId,
          column.name,
          column.color,
          position,
          column.visibleToClient ? 1 : 0,
        ],
      );
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listClientAccesses(db: Pool, clientAccountId: string) {
  const [rows] = await db.query<ClientAccessRow[]>(
    [
      "SELECT",
      "cm.id AS membership_id,",
      "u.id AS user_id,",
      "u.full_name,",
      "u.email,",
      "u.global_role,",
      "cm.membership_role,",
      "cm.is_primary,",
      "cm.created_at",
      "FROM client_memberships cm",
      "INNER JOIN users u ON u.id = cm.user_id",
      "WHERE cm.client_account_id = ?",
      "ORDER BY cm.is_primary DESC, u.full_name ASC",
    ].join(" "),
    [clientAccountId],
  );

  return rows.map((row) => ({
    membershipId: row.membership_id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    globalRole: row.global_role,
    membershipRole: row.membership_role,
    isPrimary: Boolean(row.is_primary),
    createdAt: row.created_at,
  }));
}

export async function upsertClientMembership(
  db: Pool,
  clientAccountId: string,
  input: UpsertClientMembershipInput,
  assignedByUserId: string,
) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    if (input.isPrimary) {
      await connection.query(
        "UPDATE client_memberships SET is_primary = 0 WHERE client_account_id = ?",
        [clientAccountId],
      );
    }

    const [existingRows] = await connection.query<RowDataPacket[]>(
      [
        "SELECT id",
        "FROM client_memberships",
        "WHERE client_account_id = ? AND user_id = ?",
        "LIMIT 1",
      ].join(" "),
      [clientAccountId, input.userId],
    );

    const existing = existingRows[0];

    if (existing) {
      await connection.query(
        [
          "UPDATE client_memberships",
          "SET membership_role = ?, assigned_by_user_id = ?, is_primary = ?",
          "WHERE id = ?",
        ].join(" "),
        [
          input.membershipRole,
          assignedByUserId,
          input.isPrimary ? 1 : 0,
          existing.id,
        ],
      );
    } else {
      await connection.query(
        [
          "INSERT INTO client_memberships",
          "(id, user_id, client_account_id, membership_role, assigned_by_user_id, is_primary)",
          "VALUES (?, ?, ?, ?, ?, ?)",
        ].join(" "),
        [
          crypto.randomUUID(),
          input.userId,
          clientAccountId,
          input.membershipRole,
          assignedByUserId,
          input.isPrimary ? 1 : 0,
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

  return listClientAccesses(db, clientAccountId);
}
