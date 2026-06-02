-- ─────────────────────────────────────────────────────────────
-- Add an assignable colour to question set groups.
-- Idempotent — safe to run more than once.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.question_set_groups
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#E8C14A';
