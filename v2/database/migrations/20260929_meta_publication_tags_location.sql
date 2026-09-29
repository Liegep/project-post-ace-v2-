ALTER TABLE meta_scheduled_publications
  ADD COLUMN location_id VARCHAR(190) NULL AFTER media_type,
  ADD COLUMN instagram_user_tags_json JSON NULL AFTER location_id;
