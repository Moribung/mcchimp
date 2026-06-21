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
  const lane0 = { lane: 0, laneT: 0, blockT: 0, passing: false, passSide: 0, passTarget: null,
                  passT: 0, passCool: 0, merging: 0, mergeLane: 0 };
  const ai = names.map((name, i) => ({
    id: `ai_${i}`, name, pace: randInt(60, 88), isPlayer: false,
    color: LIVERIES[i % LIVERIES.length], variant: i % 3, dist: 0, ...lane0,
  }));
  // Grid order is roughly by pace but deliberately MESSY (a scrappy qualifying):
  // faster cars often start a few rows back, so they have to carve through —
  // that's where the on-track overtaking comes from, all over the field. Use a
  // fixed per-car key so the sort stays consistent (no per-compare randomness).
  ai.forEach(c => { c._grid = c.pace + (Math.random() * 2 - 1) * 14; });
  ai.sort((a, b) => b._grid - a._grid);
  ai.forEach(c => { delete c._grid; });

  const player = { id: 'player', name: 'You', pace: 74, isPlayer: true, color: PLAYER_COLOR, variant: 0, dist: 0, ...lane0 };
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
    if (c.pitting) continue;   // parked in the pit bay (held by TrackScene)
    const noise = (rng() * 2 - 1) * SIM.SPEED_NOISE;
    const v = speedOf(c.pace) + noise + (c.isPlayer ? playerBoost : 0);
    c.dist += Math.max(0, v) * dt;
  }
}

/* ── 2D lane model (overtaking + no-overlap) ─────────────── */

function freeSpeed(c, playerBoost, rng) {
  const noise = (rng() * 2 - 1) * SIM.SPEED_NOISE;
  return Math.max(0, speedOf(c.pace) + noise + (c.isPlayer ? playerBoost : 0));
}

/**
 * Is the lateral band around `laneVal` clear of every car (except `who` and
 * `ignore`) over the dist window [dist-back, dist+fwd] around `who`? Dist is
 * cumulative and the pack is tight, so a plain (non-wrapped) compare is fine.
 */
function laneWindowClear(active, who, laneVal, back, fwd, ignore) {
  for (const o of active) {
    if (o === who || o === ignore) continue;
    const gap = o.dist - who.dist;
    if (gap < -back || gap > fwd) continue;
    if (Math.abs(o.lane - laneVal) < SIM.LANE_CLEAR) return false;
  }
  return true;
}

/**
 * Can `attacker` go around `target` on side S (+1/-1)? It needs its own lane
 * (S·LANE_W) clear ahead, AND the target must be able to make room to the
 * opposite side (−S·LANE_W) — a real, side-by-side pass with no contact. If
 * the target is flanked on both sides there's no way through (boxed in).
 */
function canPass(active, attacker, target, S) {
  const aLane = S * SIM.LANE_W, tLane = -S * SIM.LANE_W;
  if (!laneWindowClear(active, attacker, aLane, 6, SIM.PASS_SPAN, target)) return false;
  if (!laneWindowClear(active, target, tLane, 14, 14, attacker)) return false;
  return true;
}

function pickSide(active, attacker, target) {
  for (const S of [1, -1]) if (canPass(active, attacker, target, S)) return S;
  return 0;
}

function blockerAhead(active, i) {
  const c = active[i];
  for (let j = i - 1; j >= 0; j--) {          // active is leader-first; lower index = ahead
    const o = active[j], gap = o.dist - c.dist;
    if (gap <= 0) continue;
    if (gap > SIM.LOOKAHEAD) break;
    if (Math.abs(o.lane - c.lane) < SIM.LANE_CLEAR) return { blk: o, gap };
  }
  return { blk: null, gap: Infinity };
}

/**
 * One sim step in 2D: cars hold the racing line and string out single-file; a
 * faster car held up behind a slower one pulls out (and the slower one yields
 * the other way) to swap places without ever overlapping. The player never
 * auto-passes — its order only changes through duels. Mutates dist/lane; caller
 * resorts. Replaces advanceField as the running-phase integrator.
 */
export function stepField(field, dt, { playerBoost = 0 } = {}, rng = Math.random) {
  const active = field.filter(c => !c.pitting);
  for (const c of active) {
    if (c.lane == null) c.lane = 0;
    if (c.blockT == null) c.blockT = 0;
    if (c.passing == null) c.passing = false;
    if (c.passT == null) c.passT = 0;
    if (c.passCool == null) c.passCool = 0;
    if (c.merging == null) c.merging = 0;
    if (c.mergeLane == null) c.mergeLane = 0;
    if (c.merging > 0) c.merging = Math.max(0, c.merging - dt);
    if (c.passCool > 0) c.passCool = Math.max(0, c.passCool - dt);
  }
  active.sort((a, b) => b.dist - a.dist);

  const vf = new Map();
  for (const c of active) vf.set(c, freeSpeed(c, playerBoost, rng));

  // Blocker per car (same lane band, ahead, within look-ahead).
  for (let i = 0; i < active.length; i++) {
    const { blk, gap } = blockerAhead(active, i);
    active[i]._blk = blk; active[i]._bg = gap;
  }

  // Lane intent: commit / continue / finish a pass.
  for (let i = 0; i < active.length; i++) {
    const c = active[i], blk = c._blk;
    const blocked = blk && c._bg <= SIM.BLOCK_GAP;
    if (blocked) c.blockT += dt; else c.blockT = 0;

    if (c.isPlayer) { c.laneT = 0; continue; }   // player line is driven by duels, not the AI
    if (c.merging > 0) { c.laneT = c.mergeLane; continue; }   // just out of the pit — hold the outer lane

    // Commit to a pass: faster than the car ahead, stuck behind it a beat, a
    // clear side to go, and not still cooling down from the last pass.
    if (!c.passing && c.passCool <= 0 && blocked && c.blockT > SIM.PATIENCE
        && vf.get(c) > vf.get(blk) + SIM.OVERTAKE_PACE) {
      const S = pickSide(active, c, blk);
      if (S) { c.passing = true; c.passSide = S; c.passTarget = blk; c.passT = 0; c.blockT = 0; }
    }
    if (c.passing) {
      c.passT += dt;
      c.laneT = c.passSide * SIM.LANE_W;   // commit to the chosen side for the whole move
      const tgt = c.passTarget;
      const past = tgt ? c.dist - tgt.dist : Infinity;
      const done = !tgt || tgt.pitting || (past > SIM.CLEAR_AHEAD && laneWindowClear(active, c, 0, 6, SIM.CLEAR_AHEAD, null));
      const giveUp = c.passT > SIM.PASS_TIMEOUT && past < SIM.CLEAR_AHEAD;   // it won't stick → back in line
      if (done || giveUp) { c.passing = false; c.passTarget = null; c.laneT = 0; c.passCool = SIM.PASS_COOLDOWN; }
    } else {
      c.laneT = 0;
    }
  }

  // Yield: cars make space. A car being overtaken — or one a pit-exiting car is
  // merging beside — steps to the opposite side to open the door.
  for (const c of active) {
    if (c.isPlayer || c.passing || c.merging > 0) continue;
    const atk = active.find(o => o.passing && o.passTarget === c);
    if (atk) { c.laneT = -atk.passSide * SIM.LANE_W; continue; }
    const mrg = active.find(o => o.merging > 0 && o !== c
      && Math.abs(o.dist - c.dist) < SIM.BLOCK_GAP * 1.6 && Math.abs(o.lane - c.lane) < SIM.LANE_CLEAR);
    if (mrg) c.laneT = -Math.sign(mrg.lane || 1) * SIM.LANE_W;
  }

  // Slide between lanes.
  const lk = 1 - Math.exp(-SIM.LANE_SIM_K * dt);
  for (const c of active) c.lane += ((c.laneT ?? 0) - c.lane) * lk;

  // Integrate distance with an EASED speed and a no-creep limit. Each car's
  // speed lerps toward a target rather than snapping, so an overtake is a
  // controlled draw-past (a modest OVERTAKE_DV over the car being passed), not a
  // rocket — even for a big pace gap. The no-creep limit means a car never comes
  // within BLOCK_GAP of a same-lane car ahead and is NEVER yanked backward, so
  // nothing overlaps and nothing teleports. Leader-first, using predecessors'
  // already-updated positions.
  active.sort((a, b) => b.dist - a.dist);
  const sk = 1 - Math.exp(-SIM.ACCEL_K * dt);
  const nd = new Map();
  for (let i = 0; i < active.length; i++) {
    const c = active[i];
    const { blk, gap } = blockerAhead(active, i);
    const blocked = blk && gap <= SIM.BLOCK_GAP;
    let targetV;
    if (c.passing && !blocked) {
      // clear of the blocker's lane → ease up to a controlled overtaking pace
      const base = c.passTarget ? vf.get(c.passTarget) : vf.get(c);
      targetV = Math.min(vf.get(c), base + SIM.OVERTAKE_DV);
    } else if (blocked) {
      targetV = Math.min(vf.get(c), vf.get(blk));   // tucked behind — match the car ahead
    } else {
      targetV = vf.get(c);
    }
    if (c.spd == null) c.spd = targetV;
    c.spd += (targetV - c.spd) * sk;
    let d = c.dist + Math.max(0, c.spd) * dt;
    let cap = Infinity;
    for (let j = 0; j < i; j++) {
      const p = active[j];
      if (Math.abs(p.lane - c.lane) < SIM.LANE_CLEAR) cap = Math.min(cap, nd.get(active[j]) - SIM.BLOCK_GAP);
    }
    if (d > cap) d = Math.max(c.dist, cap);   // hold position, don't snap back
    nd.set(c, d);
  }
  for (const c of active) c.dist = nd.get(c);
}

/**
 * Is the player boxed in behind the car ahead — no clear lane to mount an
 * earnest overtake? Used to suppress the attack duel trigger when there's
 * genuinely no way through.
 */
export function playerBoxed(field, playerIdx) {
  const active = field.filter(c => !c.pitting).sort((a, b) => b.dist - a.dist);
  const pi = active.findIndex(c => c.isPlayer);
  if (pi <= 0) return false;                   // leading the racing cars → nothing to pass
  const me = active[pi], target = active[pi - 1];
  return !canPass(active, me, target, 1) && !canPass(active, me, target, -1);
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
 * Work out a duel's result by score band WITHOUT moving anyone yet — so the
 * banner can announce it while the cars are still frozen.
 *   gain → attack/sandwich: pass up to maxGain places; defend: hold (no places).
 *   hold → no change.   lose → drop one place.
 * @returns { band, gains, posDelta } (posDelta > 0 = places gained).
 */
export function duelOutcome({ type, commitment, ratio, playerIdx, fieldLen }) {
  const cfg = COMMITMENTS[commitment] || COMMITMENTS.push;
  const band = bandOf(ratio);
  let gains = 0, posDelta = 0;
  if (band === BAND_GAIN) {
    if (type === 'attack' || type === 'sandwich') { gains = Math.min(cfg.maxGain, playerIdx); posDelta = gains; }
  } else if (band === BAND_LOSE) {
    posDelta = playerIdx < fieldLen - 1 ? -1 : 0;
  }
  return { band, gains, posDelta };
}

/**
 * Play the result out organically when the camera zooms back out. On a win YOU
 * surge ahead of the car(s) in front. On a loss YOU falter — lose grip, scrub
 * speed and slide back behind the chaser (TrackScene plays a wobble) rather than
 * the chaser magically rocketing past. Mutates `dist`; caller resorts.
 */
export function applyOutcome({ field, playerIdx, band, type, gains }) {
  const me = field[playerIdx];
  if (band === BAND_GAIN) {
    if ((type === 'attack' || type === 'sandwich') && gains > 0) me.dist = field[playerIdx - gains].dist + SIM.PASS_GAP;
    else if (type === 'defend') me.dist += SIM.DEFEND_GAP;
  } else if (band === BAND_LOSE) {
    // You botch it: scrub speed and drop back behind the car that was chasing.
    if (playerIdx < field.length - 1) me.dist = field[playerIdx + 1].dist - SIM.DEFEND_GAP;
  }
  // hold: nobody moves
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
