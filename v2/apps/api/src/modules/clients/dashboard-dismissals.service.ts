import type { Pool } from "mysql2/promise";

export type DashboardDismissalType = "client_feedback" | "approved_pauta" | "client_submission";

export async function ensureDashboardDismissalsTable(db: Pool) {
  await db.query([
    "CREATE TABLE IF NOT EXISTS dashboard_dismissals (",
    "user_id CHAR(36) NOT NULL, item_type VARCHAR(64) NOT NULL, item_id VARCHAR(255) NOT NULL,",
    "dismissed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,",
    "PRIMARY KEY (user_id, item_type, item_id), KEY idx_dashboard_dismissals_user (user_id, item_type),",
    "CONSTRAINT fk_dashboard_dismissals_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
  await db.query("ALTER TABLE dashboard_dismissals MODIFY item_type VARCHAR(64) NOT NULL");
}

export async function dismissDashboardItem(db: Pool, input: { userId: string; itemType: DashboardDismissalType; itemId: string }) {
  await db.query(
    "INSERT IGNORE INTO dashboard_dismissals (user_id, item_type, item_id) VALUES (?, ?, ?)",
    [input.userId, input.itemType, input.itemId],
  );
}

export function filterDismissedDashboardItems<T extends { id: string }>(items: T[], dismissedIds: ReadonlySet<string>) {
  return items.filter((item) => !dismissedIds.has(item.id));
}
