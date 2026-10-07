-- Additive deduplication ledger. Apply explicitly after review; no startup DDL.
CREATE TABLE IF NOT EXISTS radar_source_runs (
 id CHAR(36) NOT NULL PRIMARY KEY,
 client_account_id CHAR(36) NOT NULL,
 source_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 context_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'processing',
 suggestion_id CHAR(36) NULL,
 error_code VARCHAR(40) NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_radar_source_client (client_account_id, source_key),
 KEY idx_radar_source_suggestion (suggestion_id),
 CONSTRAINT fk_radar_source_client FOREIGN KEY (client_account_id) REFERENCES client_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_radar_source_suggestion FOREIGN KEY (suggestion_id) REFERENCES radar_suggestions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT chk_radar_source_status CHECK (status IN ('processing','completed','no_op','failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
