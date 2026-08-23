CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  global_role ENUM('super_admin', 'admin', 'colaborador', 'cliente') NOT NULL,
  avatar_url VARCHAR(512) NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'pt',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_accounts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  slug VARCHAR(190) NOT NULL,
  owner_user_id CHAR(36) NULL,
  logo_url VARCHAR(512) NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'pt',
  portal_title VARCHAR(190) NOT NULL,
  show_upcoming_posts TINYINT(1) NOT NULL DEFAULT 0,
  show_archived_to_client TINYINT(1) NOT NULL DEFAULT 0,
  tracking_enabled TINYINT(1) NOT NULL DEFAULT 0,
  tracking_visible_to_client TINYINT(1) NOT NULL DEFAULT 0,
  workspace_drawer_json JSON NULL,
  kanban_automations_json JSON NULL,
  calendar_color VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_client_accounts_slug (slug),
  CONSTRAINT fk_client_accounts_owner
    FOREIGN KEY (owner_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_permissions (
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
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_client_permissions_account (client_account_id),
  CONSTRAINT fk_client_permissions_account
    FOREIGN KEY (client_account_id) REFERENCES client_accounts (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_memberships (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  client_account_id CHAR(36) NOT NULL,
  membership_role ENUM('admin', 'colaborador', 'cliente') NOT NULL,
  assigned_by_user_id CHAR(36) NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_client_memberships_user_account (user_id, client_account_id),
  KEY idx_client_memberships_account (client_account_id),
  CONSTRAINT fk_client_memberships_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_client_memberships_account
    FOREIGN KEY (client_account_id) REFERENCES client_accounts (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_client_memberships_assigned_by
    FOREIGN KEY (assigned_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kanban_columns (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  name VARCHAR(190) NOT NULL,
  color VARCHAR(20) NULL,
  position INT NOT NULL DEFAULT 0,
  visible_to_client TINYINT(1) NOT NULL DEFAULT 0,
  auto_created TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_kanban_columns_account_position (client_account_id, position),
  CONSTRAINT fk_kanban_columns_account
    FOREIGN KEY (client_account_id) REFERENCES client_accounts (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kanban_cards (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  column_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  caption TEXT NULL,
  media_type VARCHAR(50) NOT NULL DEFAULT 'image',
  primary_media_url VARCHAR(512) NULL,
  media_urls_json JSON NULL,
  external_link_url VARCHAR(1024) NULL,
  art_type VARCHAR(50) NOT NULL DEFAULT 'single_post',
  status_json JSON NULL,
  tags_json JSON NULL,
  hashtags_json JSON NULL,
  is_brief_approval TINYINT(1) NOT NULL DEFAULT 0,
  keep_files TINYINT(1) NOT NULL DEFAULT 0,
  deadline_at DATETIME NULL,
  scheduled_at DATETIME NULL,
  scheduled_timezone VARCHAR(64) NULL,
  published_at DATETIME NULL,
  archived TINYINT(1) NOT NULL DEFAULT 0,
  archived_at DATETIME NULL,
  client_label VARCHAR(100) NOT NULL DEFAULT 'pendente',
  event_color VARCHAR(20) NULL,
  comments_count_cache INT NOT NULL DEFAULT 0,
  created_by_user_id CHAR(36) NULL,
  position INT NOT NULL DEFAULT 0,
  legacy_id VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_kanban_cards_account_column_position (client_account_id, column_id, position),
  KEY idx_kanban_cards_archived (client_account_id, archived),
  CONSTRAINT fk_kanban_cards_account
    FOREIGN KEY (client_account_id) REFERENCES client_accounts (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_kanban_cards_column
    FOREIGN KEY (column_id) REFERENCES kanban_columns (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_kanban_cards_creator
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_tags (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#5e5cf1',
  legacy_id VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_client_tags_account_name (client_account_id, name),
  KEY idx_client_tags_account (client_account_id),
  CONSTRAINT fk_client_tags_account
    FOREIGN KEY (client_account_id) REFERENCES client_accounts (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hashtag_groups (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  hashtags_json JSON NOT NULL,
  legacy_id VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_hashtag_groups_account (client_account_id),
  CONSTRAINT fk_hashtag_groups_account
    FOREIGN KEY (client_account_id) REFERENCES client_accounts (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agenda_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NULL,
  agenda_label_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  task_description TEXT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NULL,
  recurrence_type ENUM('none', 'weekdays', 'weekly', 'monthly_nth_weekday') NOT NULL DEFAULT 'none',
  repeat_until DATE NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#c9f7df',
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  created_by_user_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_agenda_events_starts_at (starts_at),
  KEY idx_agenda_events_account (client_account_id),
  KEY idx_agenda_events_label (agenda_label_id),
  CONSTRAINT fk_agenda_events_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_agenda_events_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agenda_labels (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#4285f4',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_agenda_labels_user_name (user_id, name),
  KEY idx_agenda_labels_user (user_id),
  CONSTRAINT fk_agenda_labels_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS card_comments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  card_id CHAR(36) NOT NULL,
  user_id CHAR(36) NULL,
  author_name VARCHAR(190) NOT NULL,
  author_role ENUM('super_admin', 'admin', 'colaborador', 'cliente', 'guest') NOT NULL,
  comment_text TEXT NOT NULL,
  is_internal TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_card_comments_card_created (card_id, created_at),
  CONSTRAINT fk_card_comments_card
    FOREIGN KEY (card_id) REFERENCES kanban_cards (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_card_comments_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_texts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content_html LONGTEXT NOT NULL,
  content_type VARCHAR(40) NOT NULL DEFAULT 'Texto',
  status VARCHAR(40) NOT NULL DEFAULT 'Rascunho',
  planned_at DATE NULL,
  internal_notes TEXT NULL,
  is_sent_to_client TINYINT(1) NOT NULL DEFAULT 0,
  sent_at DATETIME NULL,
  created_by_user_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_client_texts_account_updated (client_account_id, updated_at),
  KEY idx_client_texts_account_sent (client_account_id, is_sent_to_client),
  CONSTRAINT fk_client_texts_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_client_texts_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS text_comments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  text_id CHAR(36) NOT NULL,
  user_id CHAR(36) NULL,
  author_name VARCHAR(190) NOT NULL,
  author_role ENUM('super_admin', 'admin', 'colaborador', 'cliente', 'guest') NOT NULL,
  comment_text TEXT NOT NULL,
  is_internal TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_text_comments_text_created (text_id, created_at),
  CONSTRAINT fk_text_comments_text FOREIGN KEY (text_id) REFERENCES client_texts (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_text_comments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_reports (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  metrics_json JSON NOT NULL,
  highlights_json JSON NULL,
  evidence_urls_json JSON NULL,
  notes TEXT NULL,
  created_by_user_id CHAR(36) NULL,
  published_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_client_reports_account_period (client_account_id, period_end),
  KEY idx_client_reports_account_status (client_account_id, status),
  CONSTRAINT fk_client_reports_account FOREIGN KEY (client_account_id) REFERENCES client_accounts (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_client_reports_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_links (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  card_id CHAR(36) NOT NULL,
  token VARCHAR(120) NOT NULL,
  expires_at DATETIME NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  viewed_at DATETIME NULL,
  approved_at DATETIME NULL,
  created_by_user_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_approval_links_token (token),
  KEY idx_approval_links_card (card_id),
  CONSTRAINT fk_approval_links_account
    FOREIGN KEY (client_account_id) REFERENCES client_accounts (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_approval_links_card
    FOREIGN KEY (card_id) REFERENCES kanban_cards (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_approval_links_creator
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS card_calendar_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_account_id CHAR(36) NOT NULL,
  card_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  caption TEXT NULL,
  media_type VARCHAR(50) NOT NULL DEFAULT 'image',
  media_urls_json JSON NULL,
  publish_date DATE NOT NULL,
  publish_time TIME NULL,
  status ENUM('draft', 'in_review', 'approved', 'scheduled', 'published') NOT NULL DEFAULT 'scheduled',
  event_color VARCHAR(20) NULL,
  created_by_user_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_card_calendar_card (card_id),
  KEY idx_card_calendar_account_date (client_account_id, publish_date, publish_time),
  CONSTRAINT fk_card_calendar_account
    FOREIGN KEY (client_account_id) REFERENCES client_accounts (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_card_calendar_card
    FOREIGN KEY (card_id) REFERENCES kanban_cards (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_card_calendar_creator
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
