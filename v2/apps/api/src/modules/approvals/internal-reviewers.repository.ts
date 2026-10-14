import type { Pool, RowDataPacket } from "mysql2/promise";

// This exact identity is created by bootstrap-local-db.ts and mirrored in
// mockData.ts. Do not infer identity from a name or exclude other .local users.
export const demoReviewer = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "liege@designhub.local",
};

export async function listInternalReviewers(db: Pick<Pool, "query">, clientAccountId: string, requesterId: string) {
  const [rows] = await db.query<RowDataPacket[]>([
    "SELECT u.id, u.full_name AS fullName, u.email, u.global_role AS globalRole",
    "FROM users u WHERE u.is_active = 1 AND u.id <> ?",
    "AND NOT (u.id = ? AND LOWER(u.email) = ?)",
    "AND u.global_role IN ('super_admin', 'admin', 'colaborador')",
    "AND (u.global_role = 'super_admin' OR EXISTS (",
    "SELECT 1 FROM client_memberships cm WHERE cm.user_id = u.id",
    "AND cm.client_account_id = ? AND cm.membership_role IN ('admin', 'colaborador')",
    ")) ORDER BY u.full_name ASC, u.id ASC",
  ].join(" "), [requesterId, demoReviewer.id, demoReviewer.email, clientAccountId]);
  return rows.map((row) => ({ id: row.id as string, fullName: row.fullName as string, email: row.email as string, globalRole: row.globalRole as "super_admin" | "admin" | "colaborador" }));
}
