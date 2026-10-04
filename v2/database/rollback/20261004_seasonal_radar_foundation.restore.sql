-- MANUAL recovery of the archived foundation. Stop writes and back up first.
-- The normal seasonal tables must not exist: never overwrite an independently populated set.
-- Restore tables before restoring the application release that reads the radar.
RENAME TABLE
  seasonal_archive_20261004_workspaces TO seasonal_workspaces,
  seasonal_archive_20261004_categories TO seasonal_categories,
  seasonal_archive_20261004_monitored_countries TO seasonal_monitored_countries,
  seasonal_archive_20261004_editorial_markets TO client_editorial_markets,
  seasonal_archive_20261004_opportunities TO seasonal_opportunities,
  seasonal_archive_20261004_opportunity_countries TO seasonal_opportunity_countries,
  seasonal_archive_20261004_occurrences TO seasonal_occurrences;
