CREATE TABLE users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  global_role ENUM('super_admin', 'admin', 'colaborador', 'cliente') NOT NULL,
  avatar_url TEXT NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'pt',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE client_accounts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  slug VARCHAR(190) NOT NULL UNIQUE,
  owner_user_id CHAR(36) NULL,
  logo_url TEXT NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'pt',
  portal_title VARCHAR(190) NOT NULL DEFAULT '',
  require_login TINYINT(1) NOT NULL DEFAULT 1,
  link_expiration_days INT NOT NULL DEFAULT 7,
  show_archived_to_client TINYINT(1) NOT NULL DEFAULT 0,
  show_upcoming_posts TINYINT(1) NOT NULL DEFAULT 0,
  tracking_enabled TINYINT(1) NOT NULL DEFAULT 0,
  tracking_visible_to_client TINYINT(1) NOT NULL DEFAULT 0,
  calendar_color VARCHAR(20) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  legacy_id VARCHAR(100) NULL,
  legacy_source VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_client_accounts_owner
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE client_memberships (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  client_account_id CHAR(36) NOT NULL,
  membership_role ENUM('admin', 'colaborador', 'cliente') NOT NULL,
  assigned_by_user_id CHAR(36) NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_client_membership (user_id, client_account_id),
  CONSTRAINT fk_client_memberships_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_client_memberships_client
    FOREIGN KEY (client_account_id) REFERENCES client_accounts(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_client_memberships_assigned_by
    FOREIGN KEY (assigned_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE client_permissions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  allow_client_edit_caption TINYINT(1) NOT NULL DEFAULT 0,
  allow_client_create_post TINYINT(1) NOT NULL DEFAULT 0,
  allow_client_create_tags TINYINT(1) NOT NULL DEFAULT 0,
  allow_client_download TINYINT(1) NOT NULL DEFAULT 0,
  allow_client_edit_brand_brain TINYINT(1) NOT NULL DEFAULT 0,
  allow_client_search TINYINT(1) NOT NULL DEFAULT 0,
  allow_client_view_invoices TINYINT(1) NOT NULL DEFAULT 0,
  allow_client_view_reports TINYINT(1) NOT NULL DEFAULT 0,
  allow_client_view_brand_brain TINYINT(1) NOT NULL DEFAULT 0,
  allow_client_view_tracking TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_client_permissions_account (client_account_id),
  CONSTRAINT fk_client_permissions_account
    FOREIGN KEY (client_account_id) REFERENCES client_accounts(id)
    ON DELETE CASCADE
);

CREATE TABLE kanban_columns (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  name VARCHAR(190) NOT NULL,
  color VARCHAR(20) NULL,
  position INT NOT NULL DEFAULT 0,
  visible_to_client TINYINT(1) NOT NULL DEFAULT 0,
  auto_created TINYINT(1) NOT NULL DEFAULT 0,
  legacy_id VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_kanban_columns_client_position (client_account_id, position),
  CONSTRAINT fk_kanban_columns_client
    FOREIGN KEY (client_account_id) REFERENCES client_accounts(id)
    ON DELETE CASCADE
);

CREATE TABLE kanban_cards (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  column_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  caption LONGTEXT NULL,
  media_type VARCHAR(50) NOT NULL DEFAULT 'image',
  primary_media_url TEXT NULL,
  media_urls_json JSON NULL,
  art_type VARCHAR(50) NOT NULL DEFAULT 'single_post',
  status_json JSON NULL,
  tags_json JSON NULL,
  deadline_at DATETIME NULL,
  scheduled_at DATETIME NULL,
  published_at DATETIME NULL,
  archived TINYINT(1) NOT NULL DEFAULT 0,
  archived_at DATETIME NULL,
  client_label VARCHAR(100) NOT NULL DEFAULT 'pendente',
  event_color VARCHAR(20) NULL,
  comments_count_cache INT NOT NULL DEFAULT 0,
  created_by_user_id CHAR(36) NULL,
  position INT NOT NULL DEFAULT 0,
  legacy_id VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_kanban_cards_client_archived (client_account_id, archived),
  KEY idx_kanban_cards_column_position (column_id, position),
  KEY idx_kanban_cards_scheduled (scheduled_at),
  CONSTRAINT fk_kanban_cards_client
    FOREIGN KEY (client_account_id) REFERENCES client_accounts(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_kanban_cards_column
    FOREIGN KEY (column_id) REFERENCES kanban_columns(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_kanban_cards_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE card_comments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  card_id CHAR(36) NOT NULL,
  user_id CHAR(36) NULL,
  author_name VARCHAR(160) NOT NULL,
  author_role ENUM('super_admin', 'admin', 'colaborador', 'cliente', 'guest') NOT NULL,
  comment_text LONGTEXT NOT NULL,
  is_internal TINYINT(1) NOT NULL DEFAULT 0,
  legacy_id VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_card_comments_card_created (card_id, created_at),
  CONSTRAINT fk_card_comments_card
    FOREIGN KEY (card_id) REFERENCES kanban_cards(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_card_comments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE card_calendar_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  card_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  caption LONGTEXT NULL,
  media_type VARCHAR(50) NOT NULL DEFAULT 'image',
  media_urls_json JSON NULL,
  publish_date DATE NOT NULL,
  publish_time TIME NULL,
  status ENUM('draft', 'in_review', 'approved', 'scheduled', 'published') NOT NULL DEFAULT 'draft',
  event_color VARCHAR(20) NULL,
  created_by_user_id CHAR(36) NULL,
  legacy_id VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_card_calendar_events_client_date (client_account_id, publish_date),
  CONSTRAINT fk_card_calendar_events_client
    FOREIGN KEY (client_account_id) REFERENCES client_accounts(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_card_calendar_events_card
    FOREIGN KEY (card_id) REFERENCES kanban_cards(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_card_calendar_events_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE client_reports (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  metrics_json JSON NOT NULL,
  highlights_json JSON NULL,
  evidence_urls_json JSON NULL,
  notes LONGTEXT NULL,
  created_by_user_id CHAR(36) NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_client_reports_account_period (client_account_id, period_end),
  KEY idx_client_reports_account_status (client_account_id, status),
  CONSTRAINT fk_client_reports_client FOREIGN KEY (client_account_id) REFERENCES client_accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_reports_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE approval_links (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  card_id CHAR(36) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  viewed_at DATETIME NULL,
  approved_at DATETIME NULL,
  created_by_user_id CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_approval_links_card (card_id),
  KEY idx_approval_links_expires (expires_at),
  CONSTRAINT fk_approval_links_client
    FOREIGN KEY (client_account_id) REFERENCES client_accounts(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_approval_links_card
    FOREIGN KEY (card_id) REFERENCES kanban_cards(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_approval_links_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE kanban_automations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  name VARCHAR(190) NOT NULL,
  trigger_type VARCHAR(100) NOT NULL,
  trigger_value JSON NULL,
  action_type VARCHAR(100) NOT NULL,
  action_value JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_user_id CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_kanban_automations_client (client_account_id),
  CONSTRAINT fk_kanban_automations_client
    FOREIGN KEY (client_account_id) REFERENCES client_accounts(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_kanban_automations_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS meta_connections (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  token_expires_at DATETIME NULL,
  meta_user_id VARCHAR(190) NOT NULL,
  meta_account_name VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_meta_connections_user (user_id),
  KEY idx_meta_connections_expiry (token_expires_at),
  CONSTRAINT fk_meta_connections_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meta_oauth_states (
  state_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  return_path VARCHAR(255) NOT NULL,
  expires_at_ms BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_meta_oauth_states_expiry (expires_at_ms),
  CONSTRAINT fk_meta_oauth_states_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_meta_assets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  facebook_page_id VARCHAR(190) NULL,
  facebook_page_name VARCHAR(255) NULL,
  instagram_account_id VARCHAR(190) NULL,
  instagram_username VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_client_meta_assets_account (client_account_id),
  KEY idx_client_meta_assets_page (facebook_page_id),
  KEY idx_client_meta_assets_instagram (instagram_account_id),
  CONSTRAINT fk_client_meta_assets_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Additive foundation only. Apply explicitly after review, never on application startup.
-- One operation per existing V2 database. Future tenancy must resolve workspace from auth.
CREATE TABLE IF NOT EXISTS seasonal_workspaces (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO seasonal_workspaces (id) VALUES ('operation');

CREATE TABLE IF NOT EXISTS seasonal_monitored_countries (
  workspace_id VARCHAR(64) NOT NULL,
  country_code CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (workspace_id, country_code),
  CONSTRAINT fk_seasonal_monitor_workspace FOREIGN KEY (workspace_id) REFERENCES seasonal_workspaces (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_editorial_markets (
  workspace_id VARCHAR(64) NOT NULL,
  client_account_id CHAR(36) NOT NULL,
  country_code CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  confirmed_by_user_id CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (workspace_id, client_account_id, country_code),
  CONSTRAINT fk_editorial_market_workspace FOREIGN KEY (workspace_id) REFERENCES seasonal_workspaces (id) ON DELETE RESTRICT,
  CONSTRAINT fk_editorial_market_client FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE RESTRICT,
  CONSTRAINT fk_editorial_market_confirmer FOREIGN KEY (confirmed_by_user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seasonal_categories (
  workspace_id VARCHAR(64) NOT NULL,
  code VARCHAR(64) NOT NULL,
  label VARCHAR(120) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (workspace_id, code),
  CONSTRAINT fk_seasonal_category_workspace FOREIGN KEY (workspace_id) REFERENCES seasonal_workspaces (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO seasonal_categories (workspace_id, code, label) VALUES
  ('operation', 'feriado', 'Feriado'), ('operation', 'cultural', 'Cultural'),
  ('operation', 'comercial', 'Comercial'), ('operation', 'sazonal', 'Sazonal');

CREATE TABLE IF NOT EXISTS seasonal_opportunities (
  id CHAR(36) NOT NULL PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category_code VARCHAR(64) NOT NULL,
  origin VARCHAR(64) NOT NULL,
  scope VARCHAR(16) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_seasonal_opportunity_workspace (workspace_id, id),
  CONSTRAINT chk_seasonal_scope CHECK (scope IN ('global', 'countries')),
  CONSTRAINT fk_seasonal_opportunity_workspace FOREIGN KEY (workspace_id) REFERENCES seasonal_workspaces (id) ON DELETE RESTRICT,
  CONSTRAINT fk_seasonal_opportunity_category FOREIGN KEY (workspace_id, category_code) REFERENCES seasonal_categories (workspace_id, code) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seasonal_opportunity_countries (
  workspace_id VARCHAR(64) NOT NULL,
  opportunity_id CHAR(36) NOT NULL,
  country_code CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (workspace_id, opportunity_id, country_code),
  CONSTRAINT fk_seasonal_country_opportunity FOREIGN KEY (workspace_id, opportunity_id) REFERENCES seasonal_opportunities (workspace_id, id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seasonal_occurrences (
  id CHAR(36) NOT NULL PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL,
  opportunity_id CHAR(36) NOT NULL,
  occurrence_date DATE NOT NULL,
  occurrence_year SMALLINT UNSIGNED GENERATED ALWAYS AS (YEAR(occurrence_date)) STORED,
  external_source VARCHAR(64) NULL,
  external_reference VARCHAR(255) NULL,
  external_payload JSON NULL,
  country_codes_json JSON NULL,
  regional_scope_json JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_seasonal_occurrence_period (workspace_id, occurrence_date),
  CONSTRAINT fk_seasonal_occurrence_opportunity FOREIGN KEY (workspace_id, opportunity_id) REFERENCES seasonal_opportunities (workspace_id, id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- No legacy imports, client updates, deletes or country/locale-derived assignments.
