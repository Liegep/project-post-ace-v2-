// Explicitly invoked read-only audit. Never run through application startup.
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2/promise";
import { loadEnv } from "../config/env.js";
import { demoReviewer } from "../modules/approvals/internal-reviewers.repository.js";

async function audit() {
  const env = loadEnv();
  const db = await mysql.createConnection({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, connectTimeout: 5000 });
  try {
    await db.query("SET TRANSACTION READ ONLY");
    await db.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");
    const [users] = await db.query<RowDataPacket[]>("SELECT id, full_name, email, global_role, is_active, created_at FROM users WHERE id = ? OR LOWER(email) = ? OR (LOWER(full_name) LIKE '%liege%' AND LOWER(email) LIKE 'hello@%')", [demoReviewer.id, demoReviewer.email]);
    const [columns] = await db.query<RowDataPacket[]>([
      "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS",
      "WHERE TABLE_SCHEMA = DATABASE() AND (COLUMN_NAME REGEXP '(user_id|assigned_to|requested_by)$')",
      "ORDER BY TABLE_NAME, COLUMN_NAME",
    ].join(" "));
    const refs: Record<string, unknown>[] = [];
    for (const user of users) {
      for (const column of columns) {
        if (!/^[a-zA-Z0-9_]+$/.test(column.tableName) || !/^[a-zA-Z0-9_]+$/.test(column.columnName)) throw new Error("Invalid schema identifier");
        const [counts] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${column.tableName}\` WHERE \`${column.columnName}\` = ?`, [user.id]);
        if (Number(counts[0].count)) refs.push({ userId: user.id, table: column.tableName, column: column.columnName, count: Number(counts[0].count) });
      }
    }
    console.log(JSON.stringify({ audit: "read-only", environment: /^(localhost|127\.0\.0\.1|::1)$/.test(env.DB_HOST) ? "local" : "remote", users, references: refs,
      limitation: "Counts are references, not proof of human usage. JSON references, browser-local legacy notifications and external exports are not included. No deactivation is proposed." }, null, 2));
    await db.rollback();
  } finally { await db.end(); }
}

try { await audit(); } catch (error) {
  const code = (error as { code?: string }).code ?? "AUDIT_FAILED";
  console.error(`Read-only reviewer audit failed (${code}). No user or data changes were requested.`);
  process.exitCode = 1;
}
