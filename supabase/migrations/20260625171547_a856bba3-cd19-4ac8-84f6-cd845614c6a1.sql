CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  birthdate DATE,
  sex TEXT CHECK (sex IN ('male','female','other')),
  height_cm NUMERIC,
  weight_kg NUMERIC,
  allergies TEXT[] DEFAULT '{}',
  conditions TEXT[] DEFAULT '{}',
  medications TEXT[] DEFAULT '{}',
  goals TEXT[] DEFAULT '{}',
  health_score INT NOT NULL DEFAULT 50,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  streak_days INT NOT NULL DEFAULT 0,
  last_active_date DATE,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'question' CHECK (kind IN ('symptom','question','checkup')),
  title TEXT NOT NULL DEFAULT 'Nouvelle conversation',
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads all" ON public.chat_threads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX chat_threads_user_updated ON public.chat_threads(user_id, updated_at DESC);

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages all" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX chat_messages_thread_created ON public.chat_messages(thread_id, created_at ASC);

CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('run','bike','walk')),
  distance_m NUMERIC NOT NULL DEFAULT 0,
  duration_s INT NOT NULL DEFAULT 0,
  avg_speed_kmh NUMERIC,
  max_speed_kmh NUMERIC,
  calories INT,
  route JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activities all" ON public.activities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX activities_user_created ON public.activities(user_id, created_at DESC);

CREATE TABLE public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT current_date,
  mood INT CHECK (mood BETWEEN 1 AND 5),
  energy INT CHECK (energy BETWEEN 1 AND 5),
  sleep_hours NUMERIC,
  water_glasses INT DEFAULT 0,
  notes TEXT,
  ai_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkins all" ON public.daily_checkins FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.health_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_score INT NOT NULL,
  cardio_score INT,
  nutrition_score INT,
  sleep_score INT,
  mental_score INT,
  activity_score INT,
  bmi NUMERIC,
  strengths TEXT[] DEFAULT '{}',
  risks TEXT[] DEFAULT '{}',
  priority_actions TEXT[] DEFAULT '{}',
  ai_summary TEXT,
  raw_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_assessments TO authenticated;
GRANT ALL ON public.health_assessments TO service_role;
ALTER TABLE public.health_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assess all" ON public.health_assessments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX assess_user_created ON public.health_assessments(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_threads_updated BEFORE UPDATE ON public.chat_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE POLICY "symptom photos own select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'symptom-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "symptom photos own insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'symptom-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "symptom photos own update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'symptom-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "symptom photos own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'symptom-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE TABLE public.health_trackers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  thread_id UUID REFERENCES public.chat_threads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT,
  plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  emoji TEXT DEFAULT '🩺',
  ended_at TIMESTAMPTZ,
  linked_coach_id TEXT,
  photo_guidance TEXT,
  voice_enabled BOOLEAN NOT NULL DEFAULT true,
  metrics JSONB,
  frequency_days INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_trackers TO authenticated;
GRANT ALL ON public.health_trackers TO service_role;
ALTER TABLE public.health_trackers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own trackers" ON public.health_trackers FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_health_trackers_updated_at BEFORE UPDATE ON public.health_trackers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tracker_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracker_id UUID NOT NULL REFERENCES public.health_trackers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  feeling SMALLINT,
  note TEXT,
  photo_url TEXT,
  voice_url TEXT,
  kind TEXT NOT NULL DEFAULT 'checkin',
  data JSONB,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracker_entries TO authenticated;
GRANT ALL ON public.tracker_entries TO service_role;
ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own entries" ON public.tracker_entries FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX tracker_entries_tracker_id_idx ON public.tracker_entries(tracker_id, created_at DESC);

CREATE TABLE public.tracker_reports (
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
CREATE POLICY "Users manage their own reports" ON public.tracker_reports FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX tracker_reports_user_idx ON public.tracker_reports(user_id, created_at DESC);

CREATE TABLE public.hydration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT current_date,
  amount_ml integer NOT NULL DEFAULT 0,
  goal_ml integer NOT NULL DEFAULT 2500,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hydration_logs TO authenticated;
GRANT ALL ON public.hydration_logs TO service_role;
ALTER TABLE public.hydration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own hydration" ON public.hydration_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER hydration_logs_updated_at BEFORE UPDATE ON public.hydration_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.mood_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT current_date,
  mood smallint NOT NULL CHECK (mood BETWEEN 1 AND 4),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mood_logs TO authenticated;
GRANT ALL ON public.mood_logs TO service_role;
ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own moods" ON public.mood_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER mood_logs_updated_at BEFORE UPDATE ON public.mood_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  ref_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_events own" ON public.xp_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX xp_events_user_created_idx ON public.xp_events(user_id, created_at DESC);

CREATE TABLE public.coach_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id text NOT NULL,
  onboarding_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  goals jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, coach_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_profiles TO authenticated;
GRANT ALL ON public.coach_profiles TO service_role;
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_profiles own" ON public.coach_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_coach_profiles_updated_at BEFORE UPDATE ON public.coach_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.workout_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal text NOT NULL,
  weeks integer NOT NULL DEFAULT 4,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_programs TO authenticated;
GRANT ALL ON public.workout_programs TO service_role;
ALTER TABLE public.workout_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workout_programs own" ON public.workout_programs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_workout_programs_updated_at BEFORE UPDATE ON public.workout_programs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.workout_programs(id) ON DELETE SET NULL,
  scheduled_date date,
  completed_at timestamptz,
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sessions TO authenticated;
GRANT ALL ON public.workout_sessions TO service_role;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workout_sessions own" ON public.workout_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX workout_sessions_user_idx ON public.workout_sessions(user_id, completed_at DESC NULLS LAST);