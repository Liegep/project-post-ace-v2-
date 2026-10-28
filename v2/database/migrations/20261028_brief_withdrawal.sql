-- PROPOSAL ONLY: requires approval before execution on production.
ALTER TABLE kanban_cards ADD COLUMN brief_withdrawn_at DATETIME(3) NULL;
