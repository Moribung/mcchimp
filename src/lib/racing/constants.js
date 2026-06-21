// Shared difficulty vocabulary (mirrored from golf/mma/football).
export const TIER_ORDER = ['easy', 'medium', 'hard', 'elite'];

export const DIFF_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', elite: 'Elite' };
export const DIFF_COLORS = {
  easy:   '#3ecf6a',
  medium: '#e8994a',
  hard:   '#e05252',
  elite:  '#a855f7',
};
export const DIFF_BG = {
  easy:   'rgba(62,207,106,0.1)',
  medium: 'rgba(232,153,74,0.1)',
  hard:   'rgba(224,82,82,0.1)',
  elite:  'rgba(168,85,247,0.1)',
};

// Adaptive q-score thresholds (mirrored from golf/mma/football).
export const QSCORE_UP_THRESHOLD   =  3;
export const QSCORE_DOWN_THRESHOLD = -3;

/* ── Race shape ─────────────────────────────────────────── */
export const FIELD_SIZE = 12;     // cars on the grid, you included
export const DUEL_TIMER_MS = 20000;

/* ── Commitment = the per-duel difficulty dial ──────────── */
// Chosen during the action-break. tier sets the question difficulty;
// maxGain/wrongLoss set the risk/reward; wearRate burns tyres;
// exitBonus feeds the momentum that decides the next duel.
// wearRate here is the EXTRA wear a hard move adds ON TOP of the base wear that
// accrues just from running (SIM.BASE_WEAR_PER_SEC). Base wear is the bigger
// share — you can't dodge the pit by simply avoiding duels.
export const COMMITMENTS = {
  measured: { id: 'measured', label: 'Measured', tier: 'easy',   maxGain: 1, wrongLoss: 1, wearRate: 0.02, exitBonus: 0.00,
              blurb: 'Easier question. Climb steadily — low downside.' },
  push:     { id: 'push',     label: 'Push',     tier: 'medium', maxGain: 1, wrongLoss: 1, wearRate: 0.035, exitBonus: 0.10,
              blurb: 'Balanced question. A clean answer makes the move.' },
  lunge:    { id: 'lunge',    label: 'Lunge',    tier: 'hard',   maxGain: 2, wrongLoss: 2, wearRate: 0.06, exitBonus: 0.25,
              blurb: 'Hard question. Lunge for two — or run wide and drop two.' },
};
export const COMMIT_ORDER = ['measured', 'push', 'lunge'];

/* ── Stance = the baseline difficulty set at race start ─── */
// Pre-selects the default commitment each break; the player can still
// flex up or down per duel.
export const STANCES = {
  cautious:   { id: 'cautious',   label: 'Cautious',   default: 'measured', blurb: 'Defaults to easier questions. Safe, steady climbing.' },
  balanced:   { id: 'balanced',   label: 'Balanced',   default: 'push',     blurb: 'A medium default. Flex up or down each duel.' },
  aggressive: { id: 'aggressive', label: 'Aggressive', default: 'lunge',    blurb: 'Defaults to hard questions. Big risk, big climbs.' },
};
export const STANCE_ORDER = ['cautious', 'balanced', 'aggressive'];

/* ── Continuous-distance sim (Level 2) ──────────────────── */
export const SIM = {
  LAP_DIST:     1000,  // dist units per lap of the track loop
  GAP_DIST:     28,    // initial grid spacing — packed at the start, spreads over the race
  JITTER:       4,     // initial dist jitter
  SPEED_NOISE:  2,     // ± velocity noise (units/s); small so closing rates read clean
  DRAFT:        24,    // gap held to a neighbour (no silent passing) + duel trigger
  PROX_RANGE:   52,    // both neighbours within this → sandwich
  PASS_GAP:     36,    // dist placed beyond a passed/passing car (> DRAFT)
  DEFEND_GAP:   30,    // gap pulled on a clean defence
  PLAYER_BOOST: 44,    // max ± player velocity from exit momentum (units/s)
  MIN_RUN_DIST: 380,   // distance you must race between duels (the long gap)
  MAX_RUN_DIST: 1300,  // force a duel after this much clear running
  BASE_WEAR_PER_SEC: 0.008, // tyres wear just from running (~0.10/lap) — the bulk of wear
  PIT_OPEN_LAP:   2,   // pit lane opens from this lap
  PIT_WEAR_PROMPT: 0.45, // only prompt to pit at the line when tyres are this worn

  /* 2D lanes — AI swap places by pulling out alongside (mutual room), never
     overlapping. Lane is a lateral px offset; 0 = racing line. */
  LANE_W:       11,    // how far out a passing / yielding car sits from the line
  LANE_CLEAR:   18,    // two cars share a lane band (block each other) within this lateral px
  BLOCK_GAP:    24,    // a same-lane car ahead caps you to its speed inside this dist gap
  LOOKAHEAD:    90,    // how far ahead (dist) to scan for a blocker
  PASS_SPAN:    70,    // the overtaking lane must be clear this far ahead (dist) to commit
  CLEAR_AHEAD:  30,    // you've completed a pass once this far (dist) ahead of who you passed
  OVERTAKE_PACE: 1.5,  // must be this much faster (pace) than the blocker to try a pass
  PATIENCE:     0.7,   // seconds held up before pulling out
  LANE_SIM_K:   7,     // how quickly cars slide between lanes (per-second lerp rate)
};

/* ── Outcome bands ──────────────────────────────────────── */
export const BAND_GAIN = 'gain';   // ratio === 1
export const BAND_HOLD = 'hold';   // 0.5 <= ratio < 1
export const BAND_LOSE = 'lose';   // ratio < 0.5
export function bandOf(ratio) {
  return ratio >= 1 ? BAND_GAIN : ratio >= 0.5 ? BAND_HOLD : BAND_LOSE;
}

/* ── Tyres & pit stops ──────────────────────────────────── */
export const WEAR_THRESHOLD = 0.55;
export const WEAR_CRITICAL  = 0.85;

export const PIT_TIMER_MS    = 6000;  // per-tyre countdown
export const PIT_SLOW_MS     = 3500;

export const PIT_BASE_POS_LOSS   = 2;
export const PIT_BASE_MS         = 2000;
export const PIT_FUMBLE_MS       = 6000;
export const PIT_SLOW_PENALTY_MS = 2500;

export function tyresToChange(wear) {
  return Math.min(4, Math.max(2, Math.round(wear * 4)));
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
