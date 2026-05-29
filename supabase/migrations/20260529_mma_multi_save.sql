-- ─────────────────────────────────────────────────────────────
-- MMA multi-save + past-careers + dashboard migration
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to run more than once (all statements are idempotent).
-- ─────────────────────────────────────────────────────────────

-- 1. career_saves: support multiple named, star-able saves per user/game
ALTER TABLE career_saves ADD COLUMN IF NOT EXISTS fighter_name text;
ALTER TABLE career_saves ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false;

-- Drop the single-save unique constraint so a user can hold many active saves.
ALTER TABLE career_saves DROP CONSTRAINT IF EXISTS career_saves_user_game_unique;

-- 2. career_history: richer past-career records
ALTER TABLE career_history ADD COLUMN IF NOT EXISTS highest_org    text;
ALTER TABLE career_history ADD COLUMN IF NOT EXISTS starred        boolean NOT NULL DEFAULT false;
ALTER TABLE career_history ADD COLUMN IF NOT EXISTS stat_breakdown jsonb;

-- final_record is stored as a display string (e.g. "5-2-1"); the original column
-- was jsonb, which rejects a bare string. Convert it to text.
ALTER TABLE career_history ALTER COLUMN final_record TYPE text USING final_record::text;

-- 3. profiles.tier already exists — included for completeness / fresh DBs.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'regular';

-- 4. Table-level GRANTs — REQUIRED. RLS policies only apply once the role
--    has base table privileges. Without these, every query from a logged-in
--    user fails with "permission denied for table" (Postgres 42501),
--    regardless of how correct the RLS policies are.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_saves   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_history TO authenticated;

-- Ensure RLS is enabled (it should already be, given the policies exist).
ALTER TABLE public.career_saves   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_history ENABLE ROW LEVEL SECURITY;

-- 5. career_history RLS policies. career_saves already has its four policies;
--    career_history may never have had a working set (the original archive path
--    was never actually wired up). These let each user read/insert/update only
--    their own completed careers. Drop-then-create keeps it idempotent.
DROP POLICY IF EXISTS "Users can read their own history"   ON public.career_history;
CREATE POLICY "Users can read their own history"   ON public.career_history
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own history" ON public.career_history;
CREATE POLICY "Users can insert their own history" ON public.career_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own history" ON public.career_history;
CREATE POLICY "Users can update their own history" ON public.career_history
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own history" ON public.career_history;
CREATE POLICY "Users can delete their own history" ON public.career_history
  FOR DELETE USING (auth.uid() = user_id);
