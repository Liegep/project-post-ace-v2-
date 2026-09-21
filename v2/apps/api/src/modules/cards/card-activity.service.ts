import crypto from "node:crypto";
import type { Pool } from "mysql2/promise";

export type CardActivityType = "client_approved" | "client_changes_requested";

export async function ensureCardActivityEventsTable(db: Pool) {
  await db.query([
    "CREATE TABLE IF NOT EXISTS card_activity_events (",
    "id CHAR(36) NOT NULL PRIMARY KEY,",
    "client_account_id CHAR(36) NOT NULL,",
    "card_id CHAR(36) NOT NULL,",
    "actor_user_id CHAR(36) NULL,",
    "actor_name VARCHAR(190) NOT NULL,",
    "actor_role VARCHAR(40) NOT NULL,",
    "activity_type VARCHAR(64) NOT NULL,",
    "detail VARCHAR(500) NULL,",
    "occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,",
    "KEY idx_card_activity_account_date (client_account_id, occurred_at),",
    "KEY idx_card_activity_card_date (card_id, occurred_at)",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
}

export async function recordCardActivityEvent(db: Pick<Pool, "query">, input: {
  clientAccountId: string;
  cardId: string;
  actorUserId?: string | null;
  actorName: string;
  actorRole: string;
  activityType: CardActivityType;
  detail?: string | null;
}) {
  await db.query(
    "INSERT INTO card_activity_events (id, client_account_id, card_id, actor_user_id, actor_name, actor_role, activity_type, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      crypto.randomUUID(),
      input.clientAccountId,
      input.cardId,
      input.actorUserId ?? null,
      input.actorName.trim() || "Cliente",
      input.actorRole,
      input.activityType,
      input.detail?.trim() || null,
    ],
  );
}
