import crypto from "node:crypto";
import type { Pool } from "mysql2/promise";

export type ClientFeedbackEventType = "contract_accepted" | "proposal_accepted";

export async function ensureClientFeedbackEventsTable(db: Pool) {
  await db.query([
    "CREATE TABLE IF NOT EXISTS client_feedback_events (",
    "id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NULL, client_name VARCHAR(190) NOT NULL,",
    "source_type ENUM('contract','proposal') NOT NULL, source_id VARCHAR(120) NOT NULL,",
    "activity_type ENUM('contract_accepted','proposal_accepted') NOT NULL, title VARCHAR(255) NOT NULL, detail VARCHAR(500) NULL,",
    "occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,",
    "UNIQUE KEY uq_client_feedback_source (source_type, source_id, activity_type),",
    "KEY idx_client_feedback_account_date (client_account_id, occurred_at),",
    "CONSTRAINT fk_client_feedback_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE SET NULL ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
}

export async function recordClientFeedbackEvent(db: Pool, input: { clientAccountId?: string | null; clientName: string; sourceType: "contract" | "proposal"; sourceId: string; activityType: ClientFeedbackEventType; title: string; detail?: string | null }) {
  await db.query(
    "INSERT INTO client_feedback_events (id, client_account_id, client_name, source_type, source_id, activity_type, title, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE client_account_id = COALESCE(VALUES(client_account_id), client_account_id), client_name = VALUES(client_name), title = VALUES(title), detail = VALUES(detail)",
    [crypto.randomUUID(), input.clientAccountId ?? null, input.clientName.trim(), input.sourceType, input.sourceId.trim(), input.activityType, input.title.trim(), input.detail?.trim() || null],
  );
}
