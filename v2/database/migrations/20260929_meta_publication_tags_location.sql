ALTER TABLE meta_scheduled_publications
  ADD COLUMN IF NOT EXISTS location_id VARCHAR(190) NULL AFTER media_type,
  ADD COLUMN IF NOT EXISTS instagram_user_tags_json JSON NULL AFTER location_id;
