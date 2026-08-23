ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS legacy_source text,
ADD COLUMN IF NOT EXISTS legacy_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_user_legacy_source_event
ON public.appointments (user_id, legacy_source, legacy_event_id)
WHERE legacy_source IS NOT NULL AND legacy_event_id IS NOT NULL;
