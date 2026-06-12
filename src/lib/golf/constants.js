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

// Adaptive q-score thresholds (mirrored from MMA/football)
export const QSCORE_UP_THRESHOLD   =  3;
export const QSCORE_DOWN_THRESHOLD = -3;

/* ── Course map ─────────────────────────────────────────── */
export const MAP_W = 192;
export const MAP_H = 96;

export const TERRAIN = {
  OB:      0,
  ROUGH:   1,
  FAIRWAY: 2,
  TEE:     3,
  GREEN:   4,
  SAND:    5,
  WATER:   6,
  TREES:   7,
};

/* ── Clubs ──────────────────────────────────────────────── */
// maxCarry in yards at 100% power from a clean lie; runFrac = roll as fraction of flight.
export const CLUBS = [
  { id: 'driver',     label: 'Driver',     short: 'DR', maxCarry: 250, runFrac: 0.18 },
  { id: 'wood',       label: '3 Wood',     short: '3W', maxCarry: 210, runFrac: 0.14 },
  { id: 'long_iron',  label: 'Long Iron',  short: '4i', maxCarry: 180, runFrac: 0.10 },
  { id: 'mid_iron',   label: 'Mid Iron',   short: '7i', maxCarry: 150, runFrac: 0.08 },
  { id: 'short_iron', label: 'Short Iron', short: '9i', maxCarry: 115, runFrac: 0.06 },
  { id: 'wedge',      label: 'Wedge',      short: 'PW', maxCarry: 75,  runFrac: 0.03 },
  { id: 'putter',     label: 'Putter',     short: 'PT', maxCarry: 36,  runFrac: 0 },
];
export const CLUB_BY_ID = Object.fromEntries(CLUBS.map(c => [c.id, c]));

/* ── Shot physics tuning ────────────────────────────────── */
export const PHYS = {
  // A correct answer still has a little natural dispersion — golf, not lasers.
  BASE_ERR_DEG:       3,    // angular spread at ratio 1 (full shots)
  BASE_ERR_DEG_PUTT:  1.5,  // angular spread at ratio 1 (putts)
  ERR_MAX_DEG:        25,   // angular spread at ratio 0 (full shots)
  ERR_MAX_DEG_PUTT:   12,   // angular spread at ratio 0 (putts)
  BASE_DIST_NOISE:    0.04, // ±4% strike-quality noise even when correct
  BASE_DIST_NOISE_PUTT: 0.02, // putts are struck more cleanly
  DIST_ERR_MAX:       0.35, // max distance loss fraction at ratio 0 (full shots)
  DIST_ERR_MAX_PUTT:  0.28, // missed putts come up clearly short
  DUFF_THRESHOLD:     0.75, // distance multiplier below this = duffed (whiff anim)
  // Wrong answers don't just spread wider — they get a heavier tail: an
  // occasional WILD miss that flies way off the intended line.
  WILD_MISS_CHANCE:   0.45, // peak probability (scaled by 1-ratio) of a wild miss
  WILD_MISS_MULT:     [1.6, 3.0], // multiplier range applied to the spread on a wild miss
  // Answer-speed → power/accuracy. answerSpeed is the fraction of the timer
  // used (0 = instant, 1 = buzzer). First half = no penalty.
  FAST_THRESHOLD:     0.2,  // answered within this fraction → power boost
  SPEED_POWER_BOOST:  0.1,  // up to +10% distance for an instant answer
  LATE_THRESHOLD:     0.85, // answered after this fraction → pulled off course
  LATE_PULL_DEG:      10,   // max extra angular pull at the buzzer (full shots)
  // Trees only catch the descending ball — sampled over this final fraction
  // of the flight. Approximation: the top-down map has no ball height.
  TREE_BLOCK_FRAC:    0.40,
  CHIP_IN_MAX_YD:     30,   // short wedge flights can drop straight in
  HOLE_RADIUS_YD:     2,    // pin capture radius
  CAPTURE_ROLL_YD:    2,    // ball must be nearly spent to drop in
  GIMME_YD:           0.8,  // putt stopping this close counts as holed
  // Putter meter scales so 50% power ≈ distance to the pin (full = 2× dist).
  // A small floor keeps very short putts controllable without overshooting.
  PUTT_MIN_YD:        2.5,
  PUTT_MAX_YD:        36,
  LONG_PUTT_YD:       20,   // putts beyond this bump the question tier
  LONG_PUTT_BUMP:     true,
};

// Distance multiplier by lie of the ball being struck
export const LIE_DIST_MULT = {
  tee: 1.0, fairway: 1.0, green: 1.0, rough: 0.8, sand: 0.6, trees: 0.65,
};

// Roll multiplier by terrain the ball lands on
export const RUN_MULT = {
  [TERRAIN.FAIRWAY]: 1.0,
  [TERRAIN.TEE]:     1.0,
  [TERRAIN.GREEN]:   1.5,
  [TERRAIN.ROUGH]:   0.35,
  [TERRAIN.SAND]:    0,
  [TERRAIN.TREES]:   0.1,
  [TERRAIN.WATER]:   0,
  [TERRAIN.OB]:      0,
};

export const LIE_LABELS = {
  tee: 'Tee', fairway: 'Fairway', green: 'Green',
  rough: 'Rough', sand: 'Bunker', trees: 'Under Trees',
};

/* ── Scoring labels ─────────────────────────────────────── */
export function parLabel(strokes, par) {
  if (strokes === 1) return 'Hole-in-One';
  const d = strokes - par;
  if (d <= -3) return 'Albatross';
  if (d === -2) return 'Eagle';
  if (d === -1) return 'Birdie';
  if (d === 0)  return 'Par';
  if (d === 1)  return 'Bogey';
  if (d === 2)  return 'Double Bogey';
  if (d === 3)  return 'Triple Bogey';
  return `+${d}`;
}

export function toParStr(toPar) {
  if (toPar === 0) return 'E';
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}

// Strokes cap per hole (pick-up rule so a hole can't go forever)
export const MAX_STROKES_OVER_PAR = 5;
