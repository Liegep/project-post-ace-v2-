-- Additive telemetry only. Apply after review; never on application startup.
CREATE TABLE IF NOT EXISTS brand_brain_ai_runs (
 id CHAR(36) NOT NULL PRIMARY KEY,
 client_account_id CHAR(36) NOT NULL,
 operation VARCHAR(24) NOT NULL,
 model VARCHAR(120) NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 duration_ms INT UNSIGNED NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'running',
 input_tokens INT UNSIGNED NULL,
 output_tokens INT UNSIGNED NULL,
 total_tokens INT UNSIGNED NULL,
 context_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 error_code VARCHAR(40) NULL,
 estimated_cost_usd DECIMAL(12,8) NULL,
 KEY idx_brand_ai_client_created (client_account_id, created_at),
 CONSTRAINT fk_brand_ai_client FOREIGN KEY (client_account_id) REFERENCES client_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT chk_brand_ai_operation CHECK (operation IN ('analyze', 'generate', 'refine', 'radar')),
 CONSTRAINT chk_brand_ai_status CHECK (status IN ('running', 'success', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
