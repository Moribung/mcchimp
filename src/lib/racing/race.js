/**
 * Quiz Racing — pure domain logic (no DOM, Node-testable).
 *
 * LEVEL 2 — continuous distance model. Every car carries a `dist` (race
 * distance travelled). Standings are simply the cars sorted by `dist` desc, so
 * positions are emergent, not slots: AI cars drift at their own pace (with
 * noise) and shuffle the order organically, and a duel is resolved by moving the
 * player's `dist` relative to a rival. The field array is kept sorted (leader
 * first) by the caller after any change.
 */

import { clamp, randInt, shuffle } from './utils.js';
import { COMMITMENTS, bandOf, BAND_GAIN, BAND_HOLD, BAND_LOSE, SIM } from './constants.js';
import {
  PIT_BASE_POS_LOSS, PIT_BASE_MS, PIT_FUMBLE_MS, PIT_SLOW_MS, PIT_SLOW_PENALTY_MS,
} from './constants.js';

const AI_NAMES = [
  'Verstraeten', 'Okonkwo', 'Halvorsen', 'Marchetti', 'Dubois', 'Tanaka',
  'Fernández', 'Novak', 'Lindqvist', 'Costa', 'Müller', 'Petrov',
  'Abara', 'Sørensen', 'Rossi', 'Nakamura', 'Vasquez', 'Bauer',
];

const LIVERIES = [
  '#4FA3E0', '#E0574F', '#5DCAA5', '#B07FE0', '#E089B0', '#7FB04F',
  '#E0954A', '#4FE0C8', '#9AA0A8', '#D95FA0', '#6FA0E0', '#C77F4F',
];
export const PLAYER_COLOR = '#E8C14A';

/** Cruising speed (dist units/sec) from a car's pace rating. */
function speedOf(pace) { return 80 + (pace - 74) * 0.6; }

/**
 * Build the grid. Faster cars start ahead (more dist); the player slots in near
 * the back. Each car gets a livery and a sprite variant.
 * @returns { field, playerIdx } — field sorted leader-first.
 */
export function initField(fieldSize) {
  const names = shuffle(AI_NAMES).slice(0, fieldSize - 1);
  const ai = names.map((name, i) => ({
    id: `ai_${i}`, name, pace: randInt(60, 88), isPlayer: false,
    color: LIVERIES[i % LIVERIES.length], variant: i % 3, dist: 0,
  }));
  ai.sort((a, b) => b.pace - a.pace);

  const player = { id: 'player', name: 'You', pace: 74, isPlayer: true, color: PLAYER_COLOR, variant: 0, dist: 0 };
  const startIdx = clamp(Math.round(fieldSize * 0.66), 1, fieldSize - 1);
  const ordered = [...ai];
  ordered.splice(startIdx, 0, player);

  // Assign descending dist by grid slot, with a little jitter for organic gaps.
  const n = ordered.length;
  ordered.forEach((c, i) => { c.dist = (n - i) * SIM.GAP_DIST + (Math.random() * 2 - 1) * SIM.JITTER; });
  ordered.sort((a, b) => b.dist - a.dist);
  return { field: ordered, playerIdx: ordered.findIndex(c => c.isPlayer) };
}

export function playerIndex(field) { return field.findIndex(c => c.isPlayer); }

/** Keep the field sorted leader-first. Returns the player's new index. */
export function resortField(field) {
  field.sort((a, b) => b.dist - a.dist);
  return field.findIndex(c => c.isPlayer);
}

/**
 * Advance every car's distance over dt seconds. AI drift at pace + noise (so the
 * order shuffles organically); the player gets a momentum boost from the last
 * exit rating, which physically closes the gap to the car ahead (or lets the
 * chaser close). Mutates `dist`; caller resorts.
 */
export function advanceField(field, dt, playerBoost = 0, rng = Math.random) {
  for (const c of field) {
    const noise = (rng() * 2 - 1) * SIM.SPEED_NOISE;
    const v = speedOf(c.pace) + noise + (c.isPlayer ? playerBoost : 0);
    c.dist += Math.max(0, v) * dt;
  }
}

/**
 * Pick the duel from current proximity. Always returns a duel (nearest side) so
 * the cadence is reliable; sandwich when both neighbours are within range.
 */
export function triggerType(field, playerIdx) {
  const last = field.length - 1;
  const me = field[playerIdx];
  const ahead  = playerIdx > 0 ? field[playerIdx - 1] : null;
  const behind = playerIdx < last ? field[playerIdx + 1] : null;
  const gapAhead  = ahead ? ahead.dist - me.dist : Infinity;
  const gapBehind = behind ? me.dist - behind.dist : Infinity;

  let type;
  if (!ahead) type = 'defend';
  else if (!behind) type = 'attack';
  else if (gapAhead <= SIM.PROX_RANGE && gapBehind <= SIM.PROX_RANGE) type = 'sandwich';
  else type = gapAhead <= gapBehind ? 'attack' : 'defend';

  return {
    type,
    ahead:  type === 'defend' ? null : ahead,
    behind: type === 'attack' ? null : behind,
    gapAhead, gapBehind,
  };
}

/**
 * Resolve a duel by score band, moving the player's `dist`. Caller resorts after.
 *   gain  → attack/sandwich: jump ahead of the car(s) passed (up to maxGain);
 *           defend: pull a small gap.
 *   hold  → stay put.
 *   lose  → drop just behind the chaser.
 * @returns the band.
 */
export function applyDuelDist({ field, playerIdx, type, commitment, ratio }) {
  const cfg = COMMITMENTS[commitment] || COMMITMENTS.push;
  const band = bandOf(ratio);
  const me = field[playerIdx];

  if (band === BAND_GAIN) {
    if (type === 'attack' || type === 'sandwich') {
      const gains = Math.min(cfg.maxGain, playerIdx);
      if (gains > 0) me.dist = field[playerIdx - gains].dist + SIM.PASS_GAP;
    } else {
      me.dist += SIM.DEFEND_GAP;
    }
  } else if (band === BAND_HOLD) {
    me.dist += 1;
  } else {
    if (playerIdx < field.length - 1) me.dist = field[playerIdx + 1].dist - SIM.PASS_GAP;
  }
  return band;
}

/**
 * Momentum out of a duel, 0..1. Feeds the player's running boost and the delay
 * to the next duel. Driven by outcome + answer speed.
 */
export function exitRating({ band, answerSpeed = 1, commitment }) {
  const cfg = COMMITMENTS[commitment] || COMMITMENTS.push;
  const baseB = band === BAND_GAIN ? 0.6 : band === BAND_HOLD ? 0.4 : 0.2;
  const speed = (1 - clamp(answerSpeed, 0, 1)) * 0.4;
  const bonus = band === BAND_LOSE ? 0 : cfg.exitBonus;
  return clamp(baseB + speed + bonus, 0, 1);
}

/* ── Pit stops ─────────────────────────────────────────── */
export function pitOutcome({ tireResults = [] }) {
  let timeLostMs = PIT_BASE_MS, positionsLost = PIT_BASE_POS_LOSS;
  for (const t of tireResults) {
    if (!t.correct) { timeLostMs += PIT_FUMBLE_MS; positionsLost += 1; }
    else if (t.answerMs > PIT_SLOW_MS) { timeLostMs += PIT_SLOW_PENALTY_MS; positionsLost += 1; }
    else { timeLostMs += t.answerMs; }
  }
  return { timeLostMs, positionsLost };
}

/** Drop the player back by `positionsLost` in distance space. Caller resorts. */
export function applyPitDropDist(field, playerIdx, positionsLost) {
  const me = field[playerIdx];
  const targetIdx = Math.min(field.length - 1, playerIdx + positionsLost);
  if (targetIdx > playerIdx) me.dist = field[targetIdx].dist - SIM.PASS_GAP;
}
