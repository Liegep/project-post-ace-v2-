ALTER TABLE agenda_events
  ADD COLUMN IF NOT EXISTS meet_link VARCHAR(500) NULL AFTER repeat_until;
