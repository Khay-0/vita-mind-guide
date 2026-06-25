
-- Extend health_trackers with end timestamp; status already exists
ALTER TABLE public.health_trackers
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Extend tracker_entries to support different kinds (checkin/photo/note) and structured data
ALTER TABLE public.tracker_entries
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'checkin',
  ADD COLUMN IF NOT EXISTS data JSONB;

-- feeling becomes optional for non-checkin entries
ALTER TABLE public.tracker_entries
  ALTER COLUMN feeling DROP NOT NULL;

-- Reports table for prep-RDV, weekly, monthly summaries
CREATE TABLE IF NOT EXISTS public.tracker_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracker_id UUID REFERENCES public.health_trackers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'visit',
  title TEXT,
  content TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracker_reports TO authenticated;
GRANT ALL ON public.tracker_reports TO service_role;

ALTER TABLE public.tracker_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own reports"
  ON public.tracker_reports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS tracker_reports_user_idx
  ON public.tracker_reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tracker_entries_tracker_idx
  ON public.tracker_entries(tracker_id, created_at DESC);
