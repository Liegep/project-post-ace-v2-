ALTER TABLE meta_scheduled_publications
  ADD COLUMN IF NOT EXISTS location_name VARCHAR(255) NULL AFTER location_id;
