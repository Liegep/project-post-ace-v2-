-- Apply once to an existing database. API startup also performs these additions idempotently.
ALTER TABLE kanban_cards ADD COLUMN approval_revision INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE kanban_cards ADD COLUMN approval_state VARCHAR(32) NULL;

CREATE TABLE IF NOT EXISTS card_approval_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  card_id CHAR(36) NOT NULL,
  revision INT UNSIGNED NOT NULL,
  action VARCHAR(32) NOT NULL,
  decision VARCHAR(32) NULL,
  source VARCHAR(32) NOT NULL,
  actor_user_id CHAR(36) NULL,
  actor_name VARCHAR(255) NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  comment_id CHAR(36) NULL,
  comment_text TEXT NULL,
  approval_link_id CHAR(36) NULL,
  before_json JSON NOT NULL,
  after_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_card_approval_revision (card_id, revision),
  KEY idx_card_approval_created (card_id, created_at),
  CONSTRAINT fk_card_approval_event_card FOREIGN KEY (card_id) REFERENCES kanban_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
