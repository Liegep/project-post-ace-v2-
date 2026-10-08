ALTER TABLE meta_scheduled_publications
  ADD COLUMN IF NOT EXISTS reel_cover_url VARCHAR(2048) NULL AFTER media_type;
