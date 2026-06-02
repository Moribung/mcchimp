/**
 * src/lib/fsrs.js
 * ──────────────────────────────────────────────────────────────
 * FSRS-5 (Free Spaced Repetition Scheduler, v5) implementation.
 * Pure JS — no imports, no side effects.
 *
 * Grades: 1=Again (forgot), 2=Hard (partial), 3=Good (correct), 4=Easy (trivial)
 * States: 'new' → 'learning' → 'review' (mastered); 'review' → 'relearning' on lapse
 *
 * Default parameters trained on a large dataset; suitable without per-user tuning.
 */

// FSRS-5 default weights
const W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0589,
  1.5330, 0.1544, 1.0040, 1.9813,  0.0953, 0.2975, 2.2042, 0.2407,
  2.9466, 0.5034, 0.6567,
];

// Forgetting curve: desired retention at first review = 90%
const DECAY  = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // ≈ 0.2346

// Stability bounds (days)
const MIN_S = 0.01;
const MAX_S = 36500;

// Difficulty bounds
const MIN_D = 1;
const MAX_D = 10;

// Days after first 'learning' review before card can enter 'review' state
const LEARNING_STEPS_DAYS = [1 / 1440, 0.042]; // 1 min, 1 hour — simplified to day fractions

/* ── Internal helpers ─────────────────────────────── */

function clampS(s) { return Math.max(MIN_S, Math.min(MAX_S, s)); }
function clampD(d) { return Math.max(MIN_D, Math.min(MAX_D, d)); }

/** Retrievability R: probability of recall after t days with stability S */
function retrievability(t, S) {
  return Math.pow(1 + FACTOR * t / S, DECAY);
}

/** Initial stability after first review (grade 1–4) */
function initStability(grade) {
  return clampS(W[grade - 1]);
}

/** Initial difficulty after first review (grade 1–4) */
function initDifficulty(grade) {
  return clampD(W[4] - (grade - 3) * W[5]);
}

/** Difficulty after a subsequent review */
function nextDifficulty(D, grade) {
  const d = D - W[6] * (grade - 3);
  // Mean-reversion toward W[4] (neutral difficulty)
  return clampD(d + W[7] * (W[4] - d));
}

/** Stability after successful recall (grade 2, 3, or 4) */
function nextStabilityRecall(D, S, R, grade) {
  const hardPenalty = grade === 2 ? W[15] : 1;
  const easyBonus   = grade === 4 ? W[16] : 1;
  const factor = Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9])
                 * (Math.exp(W[10] * (1 - R)) - 1)
                 * hardPenalty * easyBonus + 1;
  return clampS(S * factor);
}

/** Stability after a lapse (grade 1 = Again) */
function nextStabilityLapse(D, S, R) {
  return clampS(
    W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R))
  );
}

/** Compute the due date: the day when R drops back to 0.9 */
function computeDueDate(stability) {
  const days = stability; // by design: stability ≈ interval to 90% retention
  return new Date(Date.now() + days * 86400000).toISOString();
}

/* ── Public API ───────────────────────────────────── */

/**
 * Convert a game answer ratio (0–1) to an FSRS grade (1–4).
 * ratio === 0     → 1 (Again)
 * 0 < ratio < 1  → 2 (Hard)
 * ratio === 1.0  → 3 (Good)
 * (Grade 4 "Easy" is not produced by the game but is valid in study mode)
 */
export function gradeFromRatio(ratio) {
  if (ratio >= 1.0) return 3;
  if (ratio > 0)    return 2;
  return 1;
}

/**
 * Schedule a brand-new card (never reviewed before).
 * Returns a partial srState: { stability, difficulty, due_date, card_state }
 */
export function scheduleNew(grade) {
  const S = initStability(grade);
  const D = initDifficulty(grade);
  const cardState = grade === 1 ? 'learning' : 'learning';
  // Short interval for learning steps; advance to 'review' quickly for good/easy
  const daysUntilDue = grade >= 3 ? S : LEARNING_STEPS_DAYS[0];
  return {
    stability:  S,
    difficulty: D,
    card_state: cardState,
    due_date:   new Date(Date.now() + daysUntilDue * 86400000).toISOString(),
  };
}

/**
 * Schedule an existing card that has been reviewed before.
 * @param {object} srState  - existing row from question_sr_state
 * @param {number} grade    - 1–4
 * @param {number} elapsedDays - days since last_review (float)
 * Returns: { stability, difficulty, due_date, card_state }
 */
export function scheduleReview(srState, grade, elapsedDays) {
  const D = nextDifficulty(srState.difficulty, grade);
  const S = srState.stability;
  const R = S > 0 ? retrievability(elapsedDays, S) : 0;

  let newS, cardState;

  if (grade === 1) {
    // Lapse: card goes back to relearning
    newS      = nextStabilityLapse(D, S, R);
    cardState = 'relearning';
  } else {
    newS = nextStabilityRecall(D, S, R, grade);
    // Promote to 'review' once stability is meaningful (> 1 day)
    cardState = newS > 1 ? 'review' : (srState.card_state === 'review' ? 'review' : 'learning');
  }

  return {
    stability:  newS,
    difficulty: D,
    card_state: cardState,
    due_date:   computeDueDate(newS),
  };
}

/**
 * Convert FSRS difficulty (1–10) to _qScores-compatible integer.
 * D=5 (neutral) → 0; D<5 (easy) → positive; D>5 (hard) → negative.
 * Clamped to [-3, +3] to stay within the ±2 threshold used by effectiveTier().
 */
export function difficultyToQScore(D) {
  return Math.round(Math.max(-3, Math.min(3, (5 - D) * 0.8)));
}

/**
 * True if a card is due for review right now (or has never been reviewed).
 */
export function isDue(srState) {
  if (!srState || srState.card_state === 'new') return true;
  if (!srState.due_date) return true;
  return new Date(srState.due_date) <= new Date();
}

/** Mastery: stable memory — stability >= 21 days and answered correctly >= 3 times */
export const MASTERY_STABILITY_DAYS = 21;

export function isMastered(srState) {
  return srState
    && srState.stability   >= MASTERY_STABILITY_DAYS
    && srState.correct_count >= 3;
}
