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
