-- PROPOSAL: apply only after explicit approval. Never execute on startup/deploy.
-- No backfill, no rewritten approved texts, no reconstruction of missing source summaries.
ALTER TABLE radar_suggestions ADD COLUMN IF NOT EXISTS source_summary MEDIUMTEXT NULL;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS editorial_brief_json JSON NULL;
