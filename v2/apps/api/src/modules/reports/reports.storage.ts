import type { Pool, RowDataPacket } from "mysql2/promise";

type ReportStorageDb = Pick<Pool, "query">;

export async function ensureReportStorage(db: ReportStorageDb) {
  const columns = [
    ["meta_destination_id", "CHAR(36) NULL AFTER client_account_id"],
    ["meta_destination_name", "VARCHAR(255) NULL AFTER meta_destination_id"],
  ] as const;
  for (const [column, definition] of columns) {
    const [rows] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM client_reports LIKE ?", [column]);
    if (rows.length === 0) await db.query(`ALTER TABLE client_reports ADD COLUMN ${column} ${definition}`);
  }
  const [indexes] = await db.query<RowDataPacket[]>("SHOW INDEX FROM client_reports WHERE Key_name = 'idx_client_reports_meta_destination'");
  if (indexes.length === 0) await db.query("ALTER TABLE client_reports ADD INDEX idx_client_reports_meta_destination (meta_destination_id)");
}
