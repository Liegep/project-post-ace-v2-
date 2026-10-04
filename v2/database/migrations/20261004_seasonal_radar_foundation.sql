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
