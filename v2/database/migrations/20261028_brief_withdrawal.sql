-- PROPOSAL ONLY: requires separate approval before execution on production.
-- Verify INSTANT/NONE support on the target MariaDB version first; never fall back to COPY.
SET SESSION lock_wait_timeout = 5;
ALTER TABLE kanban_cards
  ADD COLUMN brief_withdrawn_at DATETIME(3) NULL,
  ALGORITHM=INSTANT, LOCK=NONE;
