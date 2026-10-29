-- PROPOSAL ONLY. Apply explicitly before enabling CARD_TRANSFERS_ENABLED.
-- No startup DDL. Keep this ledger for as long as operation keys can be replayed.
CREATE TABLE card_transfer_operations (
  operation_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  actor_user_id CHAR(36) NOT NULL,
  source_client_id CHAR(36) NOT NULL,
  source_card_id CHAR(36) NOT NULL,
  target_client_id CHAR(36) NOT NULL,
  target_column_id CHAR(36) NULL,
  mode ENUM('copy','move') NOT NULL,
  source_fingerprint CHAR(64) NOT NULL,
  status ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  destination_card_id CHAR(36) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at TIMESTAMP(3) NULL,
  KEY idx_transfer_actor_source (actor_user_id, source_client_id, created_at)
) ENGINE=InnoDB;
-- Intentionally no FK/cascade to cards: deleting a card must not erase deduplication history.
