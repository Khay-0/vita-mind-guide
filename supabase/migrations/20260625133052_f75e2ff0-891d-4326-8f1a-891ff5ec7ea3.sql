ALTER TABLE public.health_trackers
  ADD COLUMN IF NOT EXISTS linked_coach_id text,
  ADD COLUMN IF NOT EXISTS photo_guidance text,
  ADD COLUMN IF NOT EXISTS voice_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS metrics jsonb,
  ADD COLUMN IF NOT EXISTS frequency_days integer NOT NULL DEFAULT 1;