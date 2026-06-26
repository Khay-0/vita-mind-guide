
-- 1. health_memories table
CREATE TABLE public.health_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('symptom','allergy','condition','medication','goal','preference','habit')),
  label text NOT NULL,
  value text NOT NULL,
  source_thread_id uuid,
  sensitive boolean NOT NULL DEFAULT true,
  confirmed_by_user boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_memories TO authenticated;
GRANT ALL ON public.health_memories TO service_role;

ALTER TABLE public.health_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own health memories"
  ON public.health_memories
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX health_memories_user_id_idx ON public.health_memories(user_id);
CREATE INDEX health_memories_user_confirmed_idx ON public.health_memories(user_id, confirmed_by_user);

CREATE TRIGGER set_health_memories_updated_at
  BEFORE UPDATE ON public.health_memories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Structured payload on chat_messages (optional; null for legacy markdown messages)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS structured jsonb;

-- 3. Memory toggle on profiles (default on)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS memory_enabled boolean NOT NULL DEFAULT true;
