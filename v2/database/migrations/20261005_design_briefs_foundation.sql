-- Additive only: existing briefs, answers, templates and IDs are preserved.
-- Safe to repeat CREATE TABLE; no legacy import or status conversion.
CREATE TABLE IF NOT EXISTS design_brief_template_metadata (
 template_id CHAR(36) NOT NULL PRIMARY KEY,
 category VARCHAR(100) NOT NULL DEFAULT 'custom', description TEXT NOT NULL,
 locale VARCHAR(10) NOT NULL DEFAULT 'pt', version INT UNSIGNED NOT NULL DEFAULT 1,
 status ENUM('active','archived') NOT NULL DEFAULT 'active',
 updated_by_user_id CHAR(36) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 CONSTRAINT fk_db_metadata_template FOREIGN KEY(template_id) REFERENCES design_brief_templates(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT fk_db_metadata_actor FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS design_brief_template_versions (
 template_id CHAR(36) NOT NULL, version INT UNSIGNED NOT NULL, snapshot_json JSON NOT NULL,
 created_by_user_id CHAR(36) NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(template_id,version),
 CONSTRAINT fk_db_version_template FOREIGN KEY(template_id) REFERENCES design_brief_templates(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT fk_db_version_actor FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS design_brief_instances (
 id CHAR(36) NOT NULL PRIMARY KEY, client_account_id CHAR(36) NULL,
 template_id CHAR(36) NULL, template_version INT UNSIGNED NULL,
 snapshot_json JSON NOT NULL, status ENUM('draft','sent','answered','reopened','archived') NOT NULL DEFAULT 'draft',
 version INT UNSIGNED NOT NULL DEFAULT 1, sent_at DATETIME(3) NULL, sent_by_user_id CHAR(36) NULL,
 created_by_user_id CHAR(36) NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_db_instance_client_status(client_account_id,status,created_at),
 CONSTRAINT fk_db_instance_client FOREIGN KEY(client_account_id) REFERENCES client_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT fk_db_instance_template_version FOREIGN KEY(template_id,template_version) REFERENCES design_brief_template_versions(template_id,version) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT fk_db_instance_sender FOREIGN KEY(sent_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
 CONSTRAINT fk_db_instance_creator FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS design_brief_responses (
 id CHAR(36) NOT NULL PRIMARY KEY, brief_id CHAR(36) NOT NULL, client_account_id CHAR(36) NOT NULL,
 status ENUM('draft','submitted') NOT NULL DEFAULT 'draft', version INT UNSIGNED NOT NULL DEFAULT 1,
 answers_json JSON NOT NULL, respondent_user_id CHAR(36) NULL, submitted_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_db_response_brief(brief_id),
 CONSTRAINT fk_db_response_brief FOREIGN KEY(brief_id) REFERENCES design_brief_instances(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT fk_db_response_client FOREIGN KEY(client_account_id) REFERENCES client_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT fk_db_response_actor FOREIGN KEY(respondent_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS design_brief_response_revisions (
 id CHAR(36) NOT NULL PRIMARY KEY, response_id CHAR(36) NOT NULL, revision INT UNSIGNED NOT NULL,
 answers_json JSON NOT NULL, submitted_by_user_id CHAR(36) NULL, submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 idempotency_key CHAR(36) NOT NULL, request_hash CHAR(64) NOT NULL,
 UNIQUE KEY uq_db_revision_number(response_id,revision), UNIQUE KEY uq_db_revision_retry(response_id,idempotency_key),
 CONSTRAINT fk_db_revision_response FOREIGN KEY(response_id) REFERENCES design_brief_responses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT fk_db_revision_actor FOREIGN KEY(submitted_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS design_brief_attachments (
 id CHAR(36) NOT NULL PRIMARY KEY, response_id CHAR(36) NOT NULL, field_id VARCHAR(120) COLLATE utf8mb4_bin NOT NULL,
 original_name VARCHAR(255) NOT NULL, storage_key VARCHAR(100) NOT NULL, content_type VARCHAR(100) NOT NULL, size_bytes INT UNSIGNED NOT NULL,
 uploaded_by_user_id CHAR(36) NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_db_attachment_response_field(response_id,field_id), UNIQUE KEY uq_db_attachment_storage(storage_key),
 CONSTRAINT fk_db_attachment_response FOREIGN KEY(response_id) REFERENCES design_brief_responses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT fk_db_attachment_actor FOREIGN KEY(uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS design_brief_events (
 id CHAR(36) NOT NULL PRIMARY KEY, brief_id CHAR(36) NOT NULL, actor_user_id CHAR(36) NULL,
 action VARCHAR(40) NOT NULL, response_revision INT UNSIGNED NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_db_event_brief_time(brief_id,created_at),
 CONSTRAINT fk_db_event_brief FOREIGN KEY(brief_id) REFERENCES design_brief_instances(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT fk_db_event_actor FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
