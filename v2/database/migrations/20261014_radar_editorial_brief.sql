-- PROPOSAL: apply only after explicit approval. Never execute on startup/deploy.
-- DDL commits separately: if the second ALTER fails, repair the prerequisite and rerun.
-- IF NOT EXISTS preserves existing columns; verify their types before application.
-- No backfill, no rewritten approved texts, no reconstruction of missing source summaries.
ALTER TABLE radar_suggestions ADD COLUMN IF NOT EXISTS source_summary MEDIUMTEXT NULL;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS editorial_brief_json JSON NULL;
