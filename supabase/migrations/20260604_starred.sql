-- ─────────────────────────────────────────────────────────────
-- Favourite ("starred") flag for question sets and groups.
-- Starred items sort first in the library and the in-game picker.
-- Idempotent — safe to run more than once.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.user_question_sets
  ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false;

ALTER TABLE public.question_set_groups
  ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false;
