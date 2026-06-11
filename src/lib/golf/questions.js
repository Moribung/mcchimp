/**
 * Golf question pool management.
 * Mirrors the football questions.js pattern, adapted for one question per stroke:
 * the lie (bunker/long putt) sets a target tier, and the answer's score ratio
 * feeds straight into shot accuracy.
 */

import { TIER_ORDER, QSCORE_UP_THRESHOLD, QSCORE_DOWN_THRESHOLD } from './constants.js';
import { shuffle } from './utils.js';

/* ── Question identity ─────────────────────────────────── */
export function qidOf(q) {
  return (q && (q.id || q._id || q.question)) || null;
}

/* ── Normalisation ─────────────────────────────────────── */
export function normaliseQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  const type = q.type || 'multi_select';
  if (type === 'image' || type === 'ordered') return null;
  const KNOWN = ['multi_select', 'multiple_choice', 'true_false', 'typed', 'fill_gap'];
  if (!KNOWN.includes(type)) return null;

  let answers = q.answers;
  if (answers === undefined || answers === null) {
    if (typeof q.answer === 'number') answers = [q.answer];
    else if (typeof q.correct === 'number') answers = [q.correct];
    else if (type === 'typed' || type === 'fill_gap') answers = q.answers || [];
    else return null;
  }
  if (typeof answers === 'number') answers = [answers];
  if (!Array.isArray(answers)) return null;

  let options = q.options;
  if (type === 'true_false' && (!options || options.length === 0)) {
    options = ['True', 'False'];
  }
  if (type !== 'typed' && type !== 'fill_gap') {
    if (!options || options.length < 2) return null;
  }
  return { ...q, type, answers, options: options || [] };
}

/* ── Adaptive difficulty ───────────────────────────────── */
export function effectiveTier(qScores, qid, baseTier) {
  const score = (qScores && qScores[qid]) || 0;
  const idx   = TIER_ORDER.indexOf(baseTier);
  if (score >= QSCORE_UP_THRESHOLD   && idx < TIER_ORDER.length - 1) return TIER_ORDER[idx + 1];
  if (score <= QSCORE_DOWN_THRESHOLD && idx > 0)                      return TIER_ORDER[idx - 1];
  return baseTier;
}

/** Bump a tier up by n steps (bunker lies, long putts). */
export function bumpTier(tier, n = 1) {
  const idx = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.min(TIER_ORDER.length - 1, Math.max(0, idx + n))];
}

/* ── Pool build ────────────────────────────────────────── */
export function buildPool(mod) {
  const pool   = {};
  const byId   = {};
  for (const t of TIER_ORDER) {
    const qs = shuffle(
      (mod.tiers[t] || [])
        .map(q => normaliseQuestion({ ...q, _tier: t }))
        .filter(Boolean)
    );
    pool[t] = qs;
    qs.forEach(q => { byId[qidOf(q)] = q; });
  }
  return { pool, byId };
}

/* ── Scoring ───────────────────────────────────────────── */
export function scoreQuestion(q, selectedSet) {
  const type = q.type || 'multi_select';

  if (type === 'typed' || type === 'fill_gap') {
    const matched = selectedSet.size;
    const maxPts  = type === 'typed'
      ? (q.required_count ?? q.answers.length)
      : q.answers.length;
    const score = Math.min(matched, maxPts);
    const ratio = maxPts > 0 ? score / maxPts : 0;
    return { score, maxPts, ratio };
  }

  const correctSet = new Set(q.answers);
  let pts = 0;
  selectedSet.forEach(i => { pts += correctSet.has(i) ? 1 : -1; });
  const score  = Math.max(0, pts);
  const maxPts = correctSet.size;
  const ratio  = maxPts > 0 ? score / maxPts : 0;
  return { score, maxPts, ratio };
}

/* ── Per-stroke question selection ─────────────────────── */
const FALLBACK_ORDER = {
  easy:   ['easy', 'medium', 'hard', 'elite'],
  medium: ['medium', 'easy', 'hard', 'elite'],
  hard:   ['hard', 'medium', 'elite', 'easy'],
  elite:  ['elite', 'hard', 'medium', 'easy'],
};

/**
 * Pick one question at the target tier (after adaptive shifting),
 * avoiding recently used ids; allows reuse when the pool is exhausted.
 */
export function selectShotQuestion(pool, qScores, qUsed, targetTier) {
  const buckets = {};
  for (const t of TIER_ORDER) buckets[t] = [];
  for (const t of TIER_ORDER) {
    for (const q of (pool[t] || [])) {
      const qid = qidOf(q);
      const eff = effectiveTier(qScores, qid, q._tier || t);
      buckets[eff].push({ q, qid });
    }
  }

  const usedIds = new Set(qUsed || []);
  const order   = FALLBACK_ORDER[targetTier] || FALLBACK_ORDER.medium;

  for (const t of order) {
    const fresh = buckets[t].filter(x => !usedIds.has(x.qid));
    if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)].q;
  }
  // Pool exhausted — allow reuse
  for (const t of order) {
    if (buckets[t].length) return buckets[t][Math.floor(Math.random() * buckets[t].length)].q;
  }
  return null;
}

/* ── Typed / fill_gap scoring helpers ─────────────────── */
export function scoreTypedInputs(q, inputs) {
  const pool      = (q.answers || []).map(a => String(a).toLowerCase().trim());
  const remaining = [...pool];
  const matched   = new Set();
  inputs.forEach((val, i) => {
    const given = String(val || '').toLowerCase().trim();
    if (!given) return;
    const idx = remaining.indexOf(given);
    if (idx !== -1) { matched.add(i); remaining.splice(idx, 1); }
  });
  return matched;
}

export function scoreFillGapInputs(q, inputs) {
  const answers = (q.answers || []).map(a => String(a).toLowerCase().trim());
  const matched  = new Set();
  inputs.forEach((val, i) => {
    if (i < answers.length && String(val || '').toLowerCase().trim() === answers[i]) matched.add(i);
  });
  return matched;
}

/* ── Score update ──────────────────────────────────────── */
export function updateQScore(qScores, qid, correct) {
  const prev = qScores[qid] || 0;
  qScores[qid] = Math.max(-6, Math.min(6, prev + (correct ? 1 : -1)));
}
