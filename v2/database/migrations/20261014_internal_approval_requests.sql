-- Apply explicitly after review. No user changes or historical reassignment.
CREATE TABLE IF NOT EXISTS internal_approval_requests (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  card_id CHAR(36) NOT NULL,
  requested_by_user_id CHAR(36) NULL,
  assigned_to_user_id CHAR(36) NULL,
  comment_id CHAR(36) NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_internal_approval_recipient (assigned_to_user_id, created_at),
  KEY idx_internal_approval_card (card_id, created_at),
  CONSTRAINT fk_internal_approval_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE,
  CONSTRAINT fk_internal_approval_card FOREIGN KEY (card_id) REFERENCES kanban_cards (id) ON DELETE CASCADE,
  CONSTRAINT fk_internal_approval_requester FOREIGN KEY (requested_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_internal_approval_recipient FOREIGN KEY (assigned_to_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_internal_approval_comment FOREIGN KEY (comment_id) REFERENCES card_comments (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
