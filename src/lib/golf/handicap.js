/**
 * WHS-style handicap for Quiz Golf careers.
 *
 * The game has no real Course Rating / Slope, so a round's "score differential"
 * is simply its score relative to par (gross strokes − par) — i.e. its to-par.
 * Lower is better; negative differentials (under par) drive a "plus" handicap.
 *
 * The Handicap Index is the average of the best N of the most recent 20
 * differentials, where N (and a small adjustment) follow the World Handicap
 * System table below. Fewer than 3 rounds → not yet established.
 *
 * Only ranked rounds (career "Play Next", 18 holes) produce differentials;
 * practice rounds never call into here.
 */

export const ROUNDS_TO_ESTABLISH = 3;
export const MAX_DIFFERENTIALS = 20;

// WHS "scores used" table: rounds → { count of best diffs used, adjustment }.
const WHS_TABLE = [
  { upTo: 3,  count: 1, adj: -2.0 },
  { upTo: 4,  count: 1, adj: -1.0 },
  { upTo: 5,  count: 1, adj:  0.0 },
  { upTo: 6,  count: 2, adj: -1.0 },
  { upTo: 8,  count: 2, adj:  0.0 },
  { upTo: 11, count: 3, adj:  0.0 },
  { upTo: 14, count: 4, adj:  0.0 },
  { upTo: 16, count: 5, adj:  0.0 },
  { upTo: 18, count: 6, adj:  0.0 },
  { upTo: 19, count: 7, adj:  0.0 },
  { upTo: 20, count: 8, adj:  0.0 },
];

/** Score differential for a completed 18-hole ranked round. */
export function scoreDifferential({ totalStrokes, totalPar }) {
  return totalStrokes - totalPar;
}

/**
 * Compute the Handicap Index from a list of differentials (numbers, newest
 * last). Returns a number rounded to 1 decimal, or null if not yet established.
 */
export function computeHandicap(differentials = []) {
  const recent = differentials.slice(-MAX_DIFFERENTIALS);
  const n = recent.length;
  if (n < ROUNDS_TO_ESTABLISH) return null;

  const row = WHS_TABLE.find(r => n <= r.upTo) || WHS_TABLE[WHS_TABLE.length - 1];
  const best = [...recent].sort((a, b) => a - b).slice(0, row.count);
  const avg = best.reduce((s, d) => s + d, 0) / best.length;
  return Math.round((avg + row.adj) * 10) / 10;
}

/** Display string for a handicap index (golf convention: below 0 shows as "+"). */
export function handicapLabel(h) {
  if (h === null || h === undefined) return '—';
  if (h < 0) return `+${(-h).toFixed(1)}`;
  return h.toFixed(1);
}

/** How many more ranked rounds until the handicap is established. */
export function roundsRemaining(n) {
  return Math.max(0, ROUNDS_TO_ESTABLISH - n);
}
