import type { Pool, RowDataPacket } from "mysql2/promise";

export async function ensureMetaStorage(db: Pool) {
  await db.query([
    "CREATE TABLE IF NOT EXISTS meta_connections (",
    "id CHAR(36) NOT NULL PRIMARY KEY, user_id CHAR(36) NOT NULL, access_token_encrypted TEXT NOT NULL,",
    "token_expires_at DATETIME NULL, meta_user_id VARCHAR(190) NOT NULL, meta_account_name VARCHAR(255) NULL,",
    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,",
    "UNIQUE KEY uq_meta_connections_user (user_id), KEY idx_meta_connections_expiry (token_expires_at),",
    "CONSTRAINT fk_meta_connections_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
  await db.query([
    "CREATE TABLE IF NOT EXISTS meta_oauth_states (",
    "state_hash CHAR(64) NOT NULL PRIMARY KEY, user_id CHAR(36) NOT NULL, return_path VARCHAR(255) NOT NULL, expires_at_ms BIGINT UNSIGNED NOT NULL,",
    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_meta_oauth_states_expiry (expires_at_ms),",
    "CONSTRAINT fk_meta_oauth_states_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
  await db.query([
    "CREATE TABLE IF NOT EXISTS client_meta_assets (",
    "id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NOT NULL, facebook_page_id VARCHAR(190) NULL, facebook_page_name VARCHAR(255) NULL,",
    "instagram_account_id VARCHAR(190) NULL, instagram_username VARCHAR(255) NULL, meta_ad_account_id VARCHAR(190) NULL, meta_ad_account_name VARCHAR(255) NULL,",
    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,",
    "UNIQUE KEY uq_client_meta_assets_account (client_account_id), KEY idx_client_meta_assets_page (facebook_page_id), KEY idx_client_meta_assets_instagram (instagram_account_id),",
    "CONSTRAINT fk_client_meta_assets_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
  await db.query([
    "CREATE TABLE IF NOT EXISTS meta_scheduled_publications (",
    "id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NOT NULL, card_id CHAR(36) NULL,",
    "platform ENUM('instagram', 'facebook') NOT NULL, meta_asset_id VARCHAR(190) NOT NULL, scheduled_at DATETIME(3) NOT NULL, timezone VARCHAR(64) NOT NULL,",
    "caption TEXT NULL, media_url VARCHAR(2048) NULL, media_urls_json JSON NULL, media_type VARCHAR(50) NULL, location_id VARCHAR(190) NULL, instagram_user_tags_json JSON NULL,",
    "status ENUM('scheduled', 'publishing', 'published', 'failed', 'cancelled') NOT NULL DEFAULT 'scheduled', attempt_count INT UNSIGNED NOT NULL DEFAULT 0,",
    "idempotency_key CHAR(64) NOT NULL, published_meta_id VARCHAR(190) NULL, published_permalink VARCHAR(2048) NULL, last_error TEXT NULL, created_by_user_id CHAR(36) NULL,",
    "created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), published_at DATETIME(3) NULL,",
    "UNIQUE KEY uq_meta_sched_pub_idempotency (idempotency_key), UNIQUE KEY uq_meta_sched_pub_published (platform, published_meta_id),",
    "KEY idx_meta_sched_pub_due (status, scheduled_at), KEY idx_meta_sched_pub_client (client_account_id), KEY idx_meta_sched_pub_card (card_id),",
    "CONSTRAINT fk_meta_sched_pub_client FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE,",
    "CONSTRAINT fk_meta_sched_pub_card FOREIGN KEY (card_id) REFERENCES kanban_cards (id) ON DELETE SET NULL ON UPDATE CASCADE,",
    "CONSTRAINT fk_meta_sched_pub_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
  const publicationColumns = [
    ["location_id", "VARCHAR(190) NULL AFTER media_type"],
    ["instagram_user_tags_json", "JSON NULL AFTER location_id"],
  ] as const;
  for (const [column, definition] of publicationColumns) {
    const [columns] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM meta_scheduled_publications LIKE ?", [column]);
    if (columns.length === 0) await db.query(`ALTER TABLE meta_scheduled_publications ADD COLUMN ${column} ${definition}`);
  }
  const adAccountColumns = [
    ["meta_ad_account_id", "VARCHAR(190) NULL AFTER instagram_username"],
    ["meta_ad_account_name", "VARCHAR(255) NULL AFTER meta_ad_account_id"],
  ] as const;
  for (const [column, definition] of adAccountColumns) {
    const [columns] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM client_meta_assets LIKE ?", [column]);
    if (columns.length === 0) await db.query(`ALTER TABLE client_meta_assets ADD COLUMN ${column} ${definition}`);
  }
  await db.query("DELETE FROM meta_oauth_states WHERE expires_at_ms < ?", [Date.now()]);
}
