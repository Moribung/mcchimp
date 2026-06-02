-- ─────────────────────────────────────────────────────────────────────────
-- Learning system: FSRS per-question state, answer log, learning sets, groups
-- ─────────────────────────────────────────────────────────────────────────

-- 1. question_sr_state
--    Central FSRS-5 state per (user, question, set). One row = one card.
--    set_source: 'builtin' | 'public' | 'library'
--    set_id: filename for builtin/public (e.g. 'mma_questions.json'),
--            UUID string for library sets
--    question_id: value from qidOf(q) — q.id || q._id || q.question
CREATE TABLE IF NOT EXISTS public.question_sr_state (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id   text        NOT NULL,
  set_id        text        NOT NULL,
  set_source    text        NOT NULL
                            CHECK (set_source IN ('builtin','public','library')),

  -- FSRS-5 state
  stability     float       NOT NULL DEFAULT 0,
  difficulty    float       NOT NULL DEFAULT 5,
  card_state    text        NOT NULL DEFAULT 'new'
                            CHECK (card_state IN ('new','learning','review','relearning')),
  due_date      timestamptz,
  last_review   timestamptz,
  review_count  int         NOT NULL DEFAULT 0,
  lapse_count   int         NOT NULL DEFAULT 0,

  -- Aggregate counts for mastery calculation
  correct_count int         NOT NULL DEFAULT 0,
  total_count   int         NOT NULL DEFAULT 0,

  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id, set_id)
);

CREATE INDEX IF NOT EXISTS idx_srstate_user_set
  ON public.question_sr_state (user_id, set_id);
CREATE INDEX IF NOT EXISTS idx_srstate_due
  ON public.question_sr_state (user_id, due_date);

ALTER TABLE public.question_sr_state ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.question_sr_state TO authenticated;

DROP POLICY IF EXISTS "srstate own rows" ON public.question_sr_state;
CREATE POLICY "srstate own rows"
  ON public.question_sr_state FOR ALL USING (auth.uid() = user_id);


-- 2. question_answer_log
--    Append-only event log. One row per answered question per fight/study session.
--    grade: FSRS grade — 1=Again, 2=Hard, 3=Good, 4=Easy
--    correct: true when grade >= 3 (full correct answer)
CREATE TABLE IF NOT EXISTS public.question_answer_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id text        NOT NULL,
  set_id      text        NOT NULL,
  set_source  text        NOT NULL CHECK (set_source IN ('builtin','public','library')),
  game_id     text        NOT NULL DEFAULT 'mma',
  grade       int         NOT NULL CHECK (grade BETWEEN 1 AND 4),
  correct     boolean     NOT NULL DEFAULT false,
  score       int         NOT NULL,
  max_pts     int         NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qal_user_set
  ON public.question_answer_log (user_id, set_id);

ALTER TABLE public.question_answer_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.question_answer_log TO authenticated;

DROP POLICY IF EXISTS "qal own rows" ON public.question_answer_log;
CREATE POLICY "qal own rows"
  ON public.question_answer_log FOR ALL USING (auth.uid() = user_id);


-- 3. user_learning_sets
--    Sets a user has marked as "I want to learn this."
CREATE TABLE IF NOT EXISTS public.user_learning_sets (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_id         text        NOT NULL,
  set_source     text        NOT NULL CHECK (set_source IN ('builtin','public','library')),
  set_name       text        NOT NULL,
  question_count int         NOT NULL DEFAULT 0,
  added_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, set_id)
);

ALTER TABLE public.user_learning_sets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_learning_sets TO authenticated;

DROP POLICY IF EXISTS "uls own rows" ON public.user_learning_sets;
CREATE POLICY "uls own rows"
  ON public.user_learning_sets FOR ALL USING (auth.uid() = user_id);


-- 4. question_set_groups
--    Named groups for organising question sets.
CREATE TABLE IF NOT EXISTS public.question_set_groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.question_set_groups ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_set_groups TO authenticated;

DROP POLICY IF EXISTS "qsg own rows" ON public.question_set_groups;
CREATE POLICY "qsg own rows"
  ON public.question_set_groups FOR ALL USING (auth.uid() = user_id);


-- 5. question_set_group_members
--    Many-to-many: one set can belong to multiple groups.
CREATE TABLE IF NOT EXISTS public.question_set_group_members (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       uuid        NOT NULL
                             REFERENCES public.question_set_groups(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_id         text        NOT NULL,
  set_source     text        NOT NULL CHECK (set_source IN ('builtin','public','library')),
  set_name       text        NOT NULL,
  question_count int         NOT NULL DEFAULT 0,
  added_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, set_id)
);

ALTER TABLE public.question_set_group_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.question_set_group_members TO authenticated;

DROP POLICY IF EXISTS "qsgm own rows" ON public.question_set_group_members;
CREATE POLICY "qsgm own rows"
  ON public.question_set_group_members FOR ALL USING (auth.uid() = user_id);
