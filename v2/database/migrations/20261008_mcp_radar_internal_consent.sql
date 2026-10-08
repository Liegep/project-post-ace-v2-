-- Apply explicitly after review, before deploying the internal-consent OAuth change.
-- Reuse existing OAuth grant storage; all existing grants remain unauthorized for Radar.
ALTER TABLE mcp_oauth_codes
  ADD COLUMN IF NOT EXISTS radar_ai_authorized TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE mcp_oauth_refresh_tokens
  ADD COLUMN IF NOT EXISTS radar_ai_authorized TINYINT(1) NOT NULL DEFAULT 0;
