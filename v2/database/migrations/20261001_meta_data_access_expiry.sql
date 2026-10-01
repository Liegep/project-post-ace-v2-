ALTER TABLE meta_connections
  ADD COLUMN data_access_expires_at DATETIME NULL AFTER token_expires_at;
