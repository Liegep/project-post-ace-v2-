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
    "CREATE TABLE IF NOT EXISTS meta_publish_destinations (",
    "id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NOT NULL, name VARCHAR(255) NOT NULL,",
    "facebook_page_id VARCHAR(190) NULL, facebook_page_name VARCHAR(255) NULL, instagram_account_id VARCHAR(190) NULL, instagram_username VARCHAR(255) NULL,",
    "is_default BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,",
    "UNIQUE KEY uq_meta_publish_destination_name (client_account_id, name), KEY idx_meta_publish_destination_client (client_account_id, is_default),",
    "KEY idx_meta_publish_destination_page (facebook_page_id), KEY idx_meta_publish_destination_instagram (instagram_account_id),",
    "CONSTRAINT fk_meta_publish_destination_client FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
  await db.query([
    "CREATE TABLE IF NOT EXISTS meta_saved_locations (",
    "id CHAR(36) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, meta_place_id VARCHAR(190) NOT NULL, notes TEXT NULL,",
    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,",
    "UNIQUE KEY uq_meta_saved_locations_place (meta_place_id), KEY idx_meta_saved_locations_name (name)",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
  await db.query([
    "CREATE TABLE IF NOT EXISTS meta_scheduled_publications (",
    "id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NOT NULL, card_id CHAR(36) NULL, destination_id CHAR(36) NULL, destination_name VARCHAR(255) NULL,",
    "platform ENUM('instagram', 'facebook') NOT NULL, meta_asset_id VARCHAR(190) NOT NULL, scheduled_at DATETIME(3) NOT NULL, timezone VARCHAR(64) NOT NULL,",
    "caption TEXT NULL, media_url VARCHAR(2048) NULL, media_urls_json JSON NULL, media_type VARCHAR(50) NULL, reel_cover_url VARCHAR(2048) NULL, location_id VARCHAR(190) NULL, location_name VARCHAR(255) NULL, instagram_user_tags_json JSON NULL,",
    "status ENUM('scheduled', 'publishing', 'published', 'failed', 'cancelled') NOT NULL DEFAULT 'scheduled', attempt_count INT UNSIGNED NOT NULL DEFAULT 0,",
    "idempotency_key CHAR(64) NOT NULL, published_meta_id VARCHAR(190) NULL, published_permalink VARCHAR(2048) NULL, last_error TEXT NULL, created_by_user_id CHAR(36) NULL,",
    "created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), published_at DATETIME(3) NULL,",
    "UNIQUE KEY uq_meta_sched_pub_idempotency (idempotency_key), UNIQUE KEY uq_meta_sched_pub_published (platform, published_meta_id),",
    "KEY idx_meta_sched_pub_due (status, scheduled_at), KEY idx_meta_sched_pub_client (client_account_id), KEY idx_meta_sched_pub_card (card_id), KEY idx_meta_sched_pub_destination (destination_id),",
    "CONSTRAINT fk_meta_sched_pub_client FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE,",
    "CONSTRAINT fk_meta_sched_pub_card FOREIGN KEY (card_id) REFERENCES kanban_cards (id) ON DELETE SET NULL ON UPDATE CASCADE,",
    "CONSTRAINT fk_meta_sched_pub_destination FOREIGN KEY (destination_id) REFERENCES meta_publish_destinations (id) ON DELETE SET NULL ON UPDATE CASCADE,",
    "CONSTRAINT fk_meta_sched_pub_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  ].join(" "));
  const publicationColumns = [
    ["destination_id", "CHAR(36) NULL AFTER card_id"],
    ["destination_name", "VARCHAR(255) NULL AFTER destination_id"],
    ["reel_cover_url", "VARCHAR(2048) NULL AFTER media_type"],
    ["location_id", "VARCHAR(190) NULL AFTER media_type"],
    ["location_name", "VARCHAR(255) NULL AFTER location_id"],
    ["instagram_user_tags_json", "JSON NULL AFTER location_name"],
  ] as const;
  for (const [column, definition] of publicationColumns) {
    const [columns] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM meta_scheduled_publications LIKE ?", [column]);
    if (columns.length === 0) await db.query(`ALTER TABLE meta_scheduled_publications ADD COLUMN ${column} ${definition}`);
  }
  const [destinationIndexes] = await db.query<RowDataPacket[]>("SHOW INDEX FROM meta_scheduled_publications WHERE Key_name = 'idx_meta_sched_pub_destination'");
  if (destinationIndexes.length === 0) await db.query("ALTER TABLE meta_scheduled_publications ADD INDEX idx_meta_sched_pub_destination (destination_id)");
  const [destinationForeignKeys] = await db.query<RowDataPacket[]>([
    "SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS",
    "WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'meta_scheduled_publications' AND CONSTRAINT_NAME = 'fk_meta_sched_pub_destination'",
  ].join(" "));
  if (destinationForeignKeys.length === 0) {
    await db.query("ALTER TABLE meta_scheduled_publications ADD CONSTRAINT fk_meta_sched_pub_destination FOREIGN KEY (destination_id) REFERENCES meta_publish_destinations (id) ON DELETE SET NULL ON UPDATE CASCADE");
  }
  const adAccountColumns = [
    ["meta_ad_account_id", "VARCHAR(190) NULL AFTER instagram_username"],
    ["meta_ad_account_name", "VARCHAR(255) NULL AFTER meta_ad_account_id"],
  ] as const;
  for (const [column, definition] of adAccountColumns) {
    const [columns] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM client_meta_assets LIKE ?", [column]);
    if (columns.length === 0) await db.query(`ALTER TABLE client_meta_assets ADD COLUMN ${column} ${definition}`);
  }
  await db.query([
    "INSERT INTO meta_publish_destinations (id, client_account_id, name, facebook_page_id, facebook_page_name, instagram_account_id, instagram_username, is_default)",
    "SELECT UUID(), a.client_account_id, COALESCE(NULLIF(TRIM(c.name), ''), 'Destino Meta'), a.facebook_page_id, a.facebook_page_name, a.instagram_account_id, a.instagram_username, TRUE",
    "FROM client_meta_assets a INNER JOIN client_accounts c ON c.id = a.client_account_id",
    "WHERE (a.facebook_page_id IS NOT NULL OR a.instagram_account_id IS NOT NULL)",
    "AND NOT EXISTS (SELECT 1 FROM meta_publish_destinations d WHERE d.client_account_id = a.client_account_id)",
  ].join(" "));
  await db.query([
    "UPDATE meta_scheduled_publications p INNER JOIN meta_publish_destinations d ON d.client_account_id = p.client_account_id AND d.is_default = TRUE",
    "SET p.destination_id = d.id, p.destination_name = d.name",
    "WHERE p.destination_id IS NULL AND ((p.platform = 'facebook' AND p.meta_asset_id = d.facebook_page_id) OR (p.platform = 'instagram' AND p.meta_asset_id = d.instagram_account_id))",
  ].join(" "));
  await db.query("DELETE FROM meta_oauth_states WHERE expires_at_ms < ?", [Date.now()]);
}
