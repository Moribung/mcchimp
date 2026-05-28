/**
 * src/lib/mma/questions.js
 * ─────────────────────────────────────────
 * Question pool management — pure logic, no DOM.
 * Reads from and writes to the reactive state object passed in.
 *
 * All functions accept `state` as a parameter rather than importing
 * it directly, so they stay testable in isolation.
 */

import { CHAMP_SLOT, TIER_ORDER, QSCORE_UP_THRESHOLD, QSCORE_DOWN_THRESHOLD } from './constants.js';
import { gf, migrateDivSlots } from './fighters.js';
import { shuffle } from './utils.js';

/* ── Question normalisation ──────────────────────────── */
/**
 * Coerce any question format to the standard internal shape.
 * Handles v1 formats (answer as number, answers as number, correct field)
 * and fills in defaults for true_false.
 * Returns null if the question is unsupported/broken and should be skipped.
 */
export function normaliseQuestion(q) {
  if (!q || typeof q !== 'object') return null;

  const type = q.type || 'multi_select';

  // Skip types not yet renderable
  if (type === 'image') return null;
  if (type === 'ordered') return null;

  // Warn on unknown types
  const KNOWN = ['multi_select', 'multiple_choice', 'true_false', 'typed', 'fill_gap'];
  if (!KNOWN.includes(type)) {
    console.warn(`[questions] Unknown question type "${type}" — skipping`);
    return null;
  }

  // Normalise answers to number[]
  let answers = q.answers;
  if (answers === undefined || answers === null) {
    // v1: answer as single number
    if (typeof q.answer === 'number') answers = [q.answer];
    else if (typeof q.correct === 'number') answers = [q.correct];
    else if (type === 'typed' || type === 'fill_gap') answers = q.answers || [];
    else return null; // can't determine answers
  }
  if (typeof answers === 'number') answers = [answers];
  if (!Array.isArray(answers)) return null;

  // true_false: fill in options if missing
  let options = q.options;
  if (type === 'true_false' && (!options || options.length === 0)) {
    options = ['True', 'False'];
  }

  // typed / fill_gap: no options needed
  if (type !== 'typed' && type !== 'fill_gap') {
    if (!options || options.length < 2) return null;
  }

  return { ...q, type, answers, options: options || [] };
}

/* ── Active module accessor ──────────────────────────── */
export function getActiveMod(state) {
  if (!state.activeModId || !state.loadedModules) return null;
  return state.loadedModules[state.activeModId] || null;
}

/* ── Pool initialisation ─────────────────────────────── */
/**
 * Ensure the question pool is built from the active module.
 * Idempotent — safe to call multiple times; rebuilds only if _qPool is null.
 */
export function ensureQPool(state) {
  const mod = getActiveMod(state);
  if (!mod) return;
  if (state._qPool) return; // already built

  state._qPool = {};
  state._qUsed = new Set();
  state._qById = {};

  for (const t of TIER_ORDER) {
    const raw = mod.tiers[t] || [];
    const qs  = shuffle(
      raw
        .map(q => normaliseQuestion({ ...q, _tier: t }))
        .filter(Boolean)
    );
    state._qPool[t] = qs;
    qs.forEach(q => {
      state._qById[q._id || q.id || q.question] = q;
    });
  }
}

/* ── Adaptive tier ───────────────────────────────────── */
/**
 * Adjust a question's effective tier based on historical score.
 * +2 correct answers  → bump up one tier
 * -2 wrong answers    → bump down one tier
 */
export function effectiveTier(state, qid, baseTier) {
  const score = (state._qScores && state._qScores[qid]) || 0;
  const idx   = TIER_ORDER.indexOf(baseTier);
  if (score >= QSCORE_UP_THRESHOLD   && idx < TIER_ORDER.length - 1) return TIER_ORDER[idx + 1];
  if (score <= QSCORE_DOWN_THRESHOLD && idx > 0)                      return TIER_ORDER[idx - 1];
  return baseTier;
}

/* ── Tier selector ───────────────────────────────────── */
/**
 * Pick the target question tier for a fight based on phase, player slot,
 * and optionally the opponent's record.
 */
export function tierForFight(phase, slot, opponentFighter) {
  const rankPct = slot / CHAMP_SLOT;

  let baseTier;
  if (phase === 1) {
    if (slot === CHAMP_SLOT)  baseTier = 'medium';
    else if (rankPct >= 0.6)  baseTier = Math.random() < 0.4 ? 'medium' : 'easy';
    else                      baseTier = 'easy';
  } else if (phase === 2) {
    if (slot === CHAMP_SLOT)  baseTier = 'hard';
    else if (rankPct >= 0.75) baseTier = Math.random() < 0.5 ? 'hard' : 'medium';
    else                      baseTier = 'medium';
  } else {
    if (slot === CHAMP_SLOT)  baseTier = Math.random() < 0.6 ? 'elite' : 'hard';
    else if (rankPct >= 0.75) baseTier = Math.random() < 0.5 ? 'elite' : 'hard';
    else if (rankPct >= 0.4)  baseTier = 'hard';
    else                      baseTier = Math.random() < 0.4 ? 'hard' : 'medium';
  }

  // Record modifier: dominant opponent → harder; weak opponent → easier
  if (opponentFighter && !opponentFighter.isPlayer) {
    const w     = opponentFighter.wins   || 0;
    const l     = opponentFighter.losses || 0;
    const total = w + l;
    if (total >= 4) {
      const rate = w / total;
      const idx  = TIER_ORDER.indexOf(baseTier);
      if (rate >= 0.80 && idx < 3)     baseTier = TIER_ORDER[idx + 1];
      else if (rate < 0.35 && idx > 0) baseTier = TIER_ORDER[idx - 1];
    }
  }

  return baseTier;
}

/* ── Per-fight question draw ─────────────────────────── */
/**
 * Draw the next question from the pool for the current fight.
 * Uses adaptive tier + fallback order. Resets pool when exhausted.
 */
export function drawNextQuestion(state, cs) {
  ensureQPool(state);
  const mod = getActiveMod(state);
  if (!mod) return null;

  const phase = cs ? cs.phase : 1;
  const slot  = cs ? getPlayerSlot(cs) : 0;

  // Resolve opponent fighter for tier calculation
  const oppFid = (cs && cs.division && state.currentOpponent &&
    typeof state.currentOpponent.divisionSlot === 'number')
    ? cs.division.slots[state.currentOpponent.divisionSlot]
    : null;
  const oppFighter = oppFid ? gf(oppFid) : null;
  const targetTier = tierForFight(phase, slot, oppFighter);

  const fallbackOrder = {
    easy:   ['easy', 'medium', 'hard', 'elite'],
    medium: ['medium', 'easy', 'hard', 'elite'],
    hard:   ['hard', 'medium', 'elite', 'easy'],
    elite:  ['elite', 'hard', 'medium', 'easy'],
  };

  // Build flat list of all available (unused) questions with their effective tiers
  const allAvail = [];
  for (const t of TIER_ORDER) {
    for (const q of (state._qPool[t] || [])) {
      const qid = q._id || q.question;
      if (state._qUsed.has(qid)) continue;
      const eff = effectiveTier(state, qid, q._tier || t);
      allAvail.push({ q, qid, eff });
    }
  }

  for (const t of fallbackOrder[targetTier]) {
    let pool = allAvail.filter(x => x.eff === t && x.qid !== state.lastQid);
    if (!pool.length) pool = allAvail.filter(x => x.eff === t);
    if (pool.length > 0) {
      const { q, qid } = pool[Math.floor(Math.random() * pool.length)];
      state._qUsed.add(qid);
      state.lastQid = qid;
      return q;
    }
  }

  // Pool exhausted — reset used set, keeping only slot-owned questions reserved
  const ownedIds = new Set();
  if (cs && cs.division) {
    cs.division.slots.forEach(fid => {
      if (!fid || fid === 'player') return;
      const f = gf(fid);
      if (f && f.questionId) ownedIds.add(f.questionId);
    });
  }
  state._qUsed = new Set(ownedIds);
  return drawNextQuestion(state, cs); // recurse once after reset
}

/* ── Slot-owned question draw ────────────────────────── */
/**
 * Serve the question owned by a specific opponent slot.
 * The slot keeps its question until beaten twice — then it rotates.
 * Falls back to drawNextQuestion if no owned question found.
 */
export function drawQuestionForSlot(state, fidOrObj, cs) {
  ensureQPool(state);

  let f = null;
  if (typeof fidOrObj === 'string' && fidOrObj !== 'player') {
    f = gf(fidOrObj);
  } else if (fidOrObj && typeof fidOrObj === 'object' && !fidOrObj.isPlayer) {
    f = fidOrObj;
  }

  if (f && !f.isPlayer) {
    // Assign if no question yet
    if (!f.questionId && cs && cs.division) {
      assignDivisionQuestions(state, cs.division, cs.phase);
    }
    if (f.questionId) {
      // Try _qById cache first
      const owned = state._qById && state._qById[f.questionId];
      if (owned) { state.lastQid = f.questionId; return owned; }
      // Fallback: scan pool
      for (const t of TIER_ORDER) {
        const q = (state._qPool[t] || []).find(x => (x._id || x.question) === f.questionId);
        if (q) {
          if (state._qById) state._qById[f.questionId] = q;
          state.lastQid = f.questionId;
          return q;
        }
      }
    }
  }

  return drawNextQuestion(state, cs);
}

/* ── Sparring pool ───────────────────────────────────── */
/**
 * Build a shuffled flat pool of all questions for sparring mode.
 */
export function buildSparringPool(state) {
  const mod = getActiveMod(state);
  if (!mod) return [];
  const all = TIER_ORDER.flatMap(t =>
    (mod.tiers[t] || []).map(q => ({ ...q, _tier: t }))
  );
  return shuffle(all);
}

/* ── Division question assignment ────────────────────── */
/**
 * Assign one owned question to each fighter slot in a division.
 * Preserves existing assignments — only fills empty slots.
 */
export function assignDivisionQuestions(state, div, phase) {
  ensureQPool(state);
  migrateDivSlots(div);

  div.slots.forEach((fid, i) => {
    if (!fid || fid === 'player') return;
    const f = gf(fid);
    if (!f) return;
    if (f.questionId) return; // preserve existing assignment

    const tier = tierForFight(phase, i, f);
    const fallback = {
      easy:   ['easy', 'medium', 'hard', 'elite'],
      medium: ['medium', 'easy', 'hard', 'elite'],
      hard:   ['hard', 'medium', 'elite', 'easy'],
      elite:  ['elite', 'hard', 'medium', 'easy'],
    };

    let q = null;
    for (const t of fallback[tier]) {
      q = (state._qPool[t] || []).find(x => !state._qUsed.has(x._id || x.question));
      if (q) break;
    }
    if (q) {
      const qid = q._id || q.question;
      state._qUsed.add(qid);
      f.questionId = qid;
      if (state._qById) state._qById[qid] = q;
    }
  });
}

/* ── Scoring engine ──────────────────────────────────── */
/**
 * Score a submitted answer set against the question's correct answers.
 *
 * score  = (correct selections) - (wrong selections), floored at 0
 * maxPts = total correct answers in the question
 * ratio  = score / maxPts  (0–1)
 *
 * ratio == 1.0       → WIN
 * 0.5 <= ratio < 1   → DRAW
 * 0   <  ratio < 0.5 → LOSS
 * ratio == 0         → FINISH
 */
export function scoreQuestion(q, selectedSet) {
  const correctSet = new Set(q.answers);
  let pts = 0;
  selectedSet.forEach(i => { pts += correctSet.has(i) ? 1 : -1; });
  const score  = Math.max(0, pts);
  const maxPts = correctSet.size;
  const ratio  = maxPts > 0 ? score / maxPts : 0;
  return { score, maxPts, ratio };
}

/* ── Private helper ──────────────────────────────────── */
function getPlayerSlot(cs) {
  return cs.division ? cs.division.playerSlot : 0;
}
