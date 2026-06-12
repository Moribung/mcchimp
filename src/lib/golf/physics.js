/**
 * Pure shot resolution — no DOM, no state. Everything here is testable in node.
 *
 * Coordinates are map pixels (192×96, y down). Angles in radians.
 * Yard conversions use hole.scale (yards per pixel).
 */

import { TERRAIN as T, CLUBS, PHYS, LIE_DIST_MULT, RUN_MULT } from './constants.js';
import { clamp, dist } from './utils.js';
import { terrainAt } from './terrain.js';

// Triangular distribution in [-1, 1]: big misses are rarer than small ones.
function tri() { return Math.random() + Math.random() - 1; }

export function lieOf(t) {
  switch (t) {
    case T.TEE:     return 'tee';
    case T.FAIRWAY: return 'fairway';
    case T.GREEN:   return 'green';
    case T.SAND:    return 'sand';
    case T.TREES:   return 'trees';
    default:        return 'rough';
  }
}

export function yardsToPin(ball, hole) {
  return dist(ball, hole.pin) * hole.scale;
}

export function angleToPin(ball, hole) {
  return Math.atan2(hole.pin[1] - ball[1], hole.pin[0] - ball[0]);
}

/** Smallest club that comfortably covers the distance; putter only on green. */
export function suggestClub(distYd, lie) {
  if (lie === 'green') return CLUBS.find(c => c.id === 'putter');
  const usable = CLUBS.filter(c => c.id !== 'putter');
  const mult = LIE_DIST_MULT[lie] ?? 1;
  // walk from shortest to longest, take the first that reaches at ~95% power
  for (let i = usable.length - 1; i >= 0; i--) {
    if (usable[i].maxCarry * mult * 0.95 >= distYd) return usable[i];
  }
  return usable[0]; // driver
}

/** Full meter distance in yards for the given club/lie/ball position. */
export function meterMaxYd(club, lie, ball, hole) {
  if (club.id === 'putter') {
    return clamp(2 * yardsToPin(ball, hole), PHYS.PUTT_MIN_YD, PHYS.PUTT_MAX_YD);
  }
  return club.maxCarry * (LIE_DIST_MULT[lie] ?? 1);
}

/**
 * Resolve one stroke.
 * @returns {{ path: {x,y,mode}[], rest: [x,y], restLie: string, holed: boolean,
 *             duffed: boolean, events: string[], penaltyStrokes: number,
 *             errDeg: number, travelYd: number }}
 */
export function resolveShot({ ball, aimAngle, power, club, ratio, lie, grid, hole, answerSpeed = 0 }) {
  const scale = hole.scale;
  const pin = hole.pin;
  const isPutt = club.id === 'putter';
  const events = [];
  let penaltyStrokes = 0;
  let holed = false;

  // 1. Intended distance from power + lie
  const maxYd = meterMaxYd(club, lie, ball, hole);

  // 2. Angular error: baseline dispersion + answer-quality spread.
  const errBase = isPutt ? PHYS.BASE_ERR_DEG_PUTT : PHYS.BASE_ERR_DEG;
  const errMax  = isPutt ? PHYS.ERR_MAX_DEG_PUTT  : PHYS.ERR_MAX_DEG;
  const spread  = errBase + (errMax - errBase) * (1 - ratio);
  let errDeg = spread * tri();
  // Heavier tail for wrong answers: a wild miss flies far off the line.
  let wild = false;
  if (Math.random() < PHYS.WILD_MISS_CHANCE * (1 - ratio)) {
    const [lo, hi] = PHYS.WILD_MISS_MULT;
    errDeg = spread * (lo + Math.random() * (hi - lo)) * (Math.random() < 0.5 ? -1 : 1);
    wild = true;
  }
  // Answering very late pulls the ball off course (slight directional bias).
  if (answerSpeed > PHYS.LATE_THRESHOLD) {
    const lateAmt = (answerSpeed - PHYS.LATE_THRESHOLD) / (1 - PHYS.LATE_THRESHOLD);
    const pull = lateAmt * PHYS.LATE_PULL_DEG * (isPutt ? 0.5 : 1);
    errDeg += pull * (Math.random() < 0.5 ? -1 : 1);
  }
  const angle = aimAngle + (errDeg * Math.PI) / 180;

  // 3. Distance: small strike noise always; wrong answers come up short — the
  //    further off the answer, the shorter the shot. Mostly proportional to
  //    (1 - ratio) with a little noise, so a miss reliably falls short rather
  //    than (as before) only losing distance on a random subset of misses.
  const baseNoise = isPutt ? PHYS.BASE_DIST_NOISE_PUTT : PHYS.BASE_DIST_NOISE;
  const distErrMax = isPutt ? PHYS.DIST_ERR_MAX_PUTT : PHYS.DIST_ERR_MAX;
  const missLoss = distErrMax * (1 - ratio) * (0.6 + 0.4 * Math.random());
  const distMult = (1 + baseNoise * tri()) * (1 - missLoss);
  const duffed = !isPutt && distMult < PHYS.DUFF_THRESHOLD;

  // Fast answers (first fifth of the timer) earn a small power boost.
  let speedPowerMult = 1;
  if (!isPutt && answerSpeed < PHYS.FAST_THRESHOLD) {
    speedPowerMult = 1 + PHYS.SPEED_POWER_BOOST * (1 - answerSpeed / PHYS.FAST_THRESHOLD);
  }

  const travelYd = maxYd * power * distMult * speedPowerMult;
  const travelPx = Math.max(0.5, travelYd / scale);

  const holeRadPx = Math.max(0.9, PHYS.HOLE_RADIUS_YD / scale);
  const captureRollPx = PHYS.CAPTURE_ROLL_YD / scale;

  const dirX = Math.cos(angle), dirY = Math.sin(angle);
  const path = [];
  let land = [...ball];
  let treeStop = false;

  /* ── Flight (putts skip — pure roll) ──────────────────── */
  if (!isPutt) {
    const steps = Math.max(1, Math.ceil(travelPx));
    let stopped = false;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = ball[0] + dirX * travelPx * t;
      const y = ball[1] + dirY * travelPx * t;
      path.push({ x, y, mode: 'flight' });
      // chip-in: short lofted shots can drop straight in late in flight
      if (travelYd <= PHYS.CHIP_IN_MAX_YD && t >= 0.75 &&
          Math.hypot(x - pin[0], y - pin[1]) <= holeRadPx) {
        holed = true; land = [pin[0], pin[1]]; stopped = true;
        break;
      }
      // trees catch the descending ball over the final fraction of flight
      if (t >= 1 - PHYS.TREE_BLOCK_FRAC && terrainAt(grid, x, y) === T.TREES) {
        land = [x - dirX * 2, y - dirY * 2];
        path.push({ x: land[0], y: land[1], mode: 'flight' });
        events.push('trees');
        treeStop = true; stopped = true;
        break;
      }
    }
    if (!stopped) land = [ball[0] + dirX * travelPx, ball[1] + dirY * travelPx];
  }

  /* ── Roll ─────────────────────────────────────────────── */
  let cx = land[0], cy = land[1];
  if (!holed) {
    let runPx;
    if (isPutt) runPx = travelPx;
    else if (treeStop) runPx = 0;
    else {
      const landT = terrainAt(grid, cx, cy);
      runPx = travelPx * club.runFrac * (RUN_MULT[landT] ?? 0);
    }
    let remaining = runPx;
    while (remaining > 0) {
      const step = Math.min(1, remaining);
      cx += dirX * step; cy += dirY * step; remaining -= step;
      path.push({ x: cx, y: cy, mode: 'roll' });
      const dPin = Math.hypot(cx - pin[0], cy - pin[1]);
      if (dPin <= holeRadPx && remaining <= captureRollPx) {
        holed = true; cx = pin[0]; cy = pin[1];
        break;
      }
      const tt = terrainAt(grid, cx, cy);
      if (tt === T.WATER || tt === T.OB) break; // resolved below
      if (tt === T.SAND) break;                 // plugged
    }
  }

  // putt gimme
  if (isPutt && !holed && Math.hypot(cx - pin[0], cy - pin[1]) <= PHYS.GIMME_YD / scale) {
    holed = true; cx = pin[0]; cy = pin[1];
  }

  /* ── Hazards at rest ──────────────────────────────────── */
  let rest = [cx, cy];
  let restLie = lieOf(terrainAt(grid, cx, cy));

  if (!holed) {
    const restT = terrainAt(grid, cx, cy);
    if (restT === T.OB) {
      // stroke and distance: replay from the pre-shot spot
      events.push('ob');
      penaltyStrokes = 1;
      rest = [...ball];
      restLie = lie;
    } else if (restT === T.WATER) {
      events.push('water');
      penaltyStrokes = 1;
      rest = dropPoint(path, ball, grid);
      restLie = lieOf(terrainAt(grid, rest[0], rest[1]));
    } else if (restT === T.SAND) {
      events.push('sand');
    }
  } else {
    events.push('holed');
  }

  return { path, rest, restLie, holed, duffed, wild, events, penaltyStrokes, errDeg, travelYd };
}

/** Last dry, in-bounds point along the travel path (water drop). */
function dropPoint(path, ball, grid) {
  for (let i = path.length - 1; i >= 0; i--) {
    const t = terrainAt(grid, path[i].x, path[i].y);
    if (t !== T.WATER && t !== T.OB) return [path[i].x, path[i].y];
  }
  return [...ball];
}
