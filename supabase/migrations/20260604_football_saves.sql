-- ─────────────────────────────────────────────────────────────
-- Football career saves
-- Ensures the career_saves table exists with the correct structure
-- for both the MMA and Football games. Safe to run on a fresh DB
-- or one that already has the table from earlier manual setup.
-- All statements are idempotent.
-- ─────────────────────────────────────────────────────────────

-- 1. Create career_saves if it doesn't exist
CREATE TABLE IF NOT EXISTS public.career_saves (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id      text NOT NULL,
  fighter_name text,                          -- club name for football, fighter name for MMA
  save_data    jsonb NOT NULL,
  starred      boolean NOT NULL DEFAULT false,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 2. Add any columns that may be missing (from earlier manual setup)
ALTER TABLE public.career_saves ADD COLUMN IF NOT EXISTS fighter_name text;
ALTER TABLE public.career_saves ADD COLUMN IF NOT EXISTS starred     boolean NOT NULL DEFAULT false;

-- 3. Drop the old single-save-per-user-per-game constraint if still present
ALTER TABLE public.career_saves DROP CONSTRAINT IF EXISTS career_saves_user_game_unique;
ALTER TABLE public.career_saves DROP CONSTRAINT IF EXISTS career_saves_user_id_game_id_key;

-- 4. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_saves TO authenticated;

-- 5. RLS
ALTER TABLE public.career_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own saves"   ON public.career_saves;
CREATE POLICY "Users can read their own saves"   ON public.career_saves
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own saves" ON public.career_saves;
CREATE POLICY "Users can insert their own saves" ON public.career_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own saves" ON public.career_saves;
CREATE POLICY "Users can update their own saves" ON public.career_saves
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own saves" ON public.career_saves;
CREATE POLICY "Users can delete their own saves" ON public.career_saves
  FOR DELETE USING (auth.uid() = user_id);
