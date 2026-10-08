CREATE TABLE IF NOT EXISTS dashboard_dismissals (
  user_id CHAR(36) NOT NULL,
  item_type ENUM('client_feedback','approved_pauta') NOT NULL,
  item_id VARCHAR(255) NOT NULL,
  dismissed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, item_type, item_id),
  KEY idx_dashboard_dismissals_user (user_id, item_type),
  CONSTRAINT fk_dashboard_dismissals_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
