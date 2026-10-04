-- MANUAL, data-preserving rollback. Stop radar writes and take a backup first.
-- Roll application code back to a release that does not use seasonal tables.
-- Atomic RENAME archives all seven tables and keeps their rows and FK relationships.
-- Run once; an existing archive/missing source fails safely. No DROP/DELETE/TRUNCATE.
RENAME TABLE
  seasonal_occurrences TO seasonal_archive_20261004_occurrences,
  seasonal_opportunity_countries TO seasonal_archive_20261004_opportunity_countries,
  seasonal_opportunities TO seasonal_archive_20261004_opportunities,
  client_editorial_markets TO seasonal_archive_20261004_editorial_markets,
  seasonal_monitored_countries TO seasonal_archive_20261004_monitored_countries,
  seasonal_categories TO seasonal_archive_20261004_categories,
  seasonal_workspaces TO seasonal_archive_20261004_workspaces;
