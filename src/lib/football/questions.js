/**
 * Football question pool management.
 * Mirrors the MMA questions.js pattern but adapted for per-match question selection.
 *
 * Key difference from MMA: instead of 1 question per fight, football selects N questions
 * per match (2–5 based on rating gap + tactic), resolved one at a time inside the match.
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

/* ── Match question selection ──────────────────────────── */
const FALLBACK_ORDER = {
  easy:   ['easy', 'medium', 'hard', 'elite'],
  medium: ['medium', 'easy', 'hard', 'elite'],
  hard:   ['hard', 'medium', 'elite', 'easy'],
  elite:  ['elite', 'hard', 'medium', 'easy'],
};

/**
 * Pick count questions for a match based on a difficulty mix.
 * mix = [easyFrac, medFrac, hardFrac, eliteFrac] (sum = 1)
 * Returns a shuffled array of normalised question objects.
 */
export function selectMatchQuestions(pool, byId, qScores, qUsed, count, mix) {
  const diffs = TIER_ORDER;
  // Build effective-tier buckets
  const buckets = {};
  for (const t of diffs) buckets[t] = [];
  for (const t of diffs) {
    for (const q of (pool[t] || [])) {
      const qid = qidOf(q);
      const eff = effectiveTier(qScores, qid, q._tier || t);
      buckets[eff].push({ q, qid });
    }
  }

  const usedIds  = new Set(qUsed || []);
  const selected = [];
  const pickedIds = new Set();

  for (let i = 0; i < count; i++) {
    // Roll difficulty
    const r = Math.random();
    let cum = 0, targetTier = 'medium';
    for (let j = 0; j < diffs.length; j++) {
      cum += mix[j] || 0;
      if (r < cum) { targetTier = diffs[j]; break; }
    }

    // Try fallback order
    let picked = null;
    for (const t of FALLBACK_ORDER[targetTier] || FALLBACK_ORDER.medium) {
      const candidates = buckets[t].filter(x => !pickedIds.has(x.qid) && !usedIds.has(x.qid));
      if (candidates.length) {
        picked = candidates[Math.floor(Math.random() * candidates.length)];
        break;
      }
    }
    // Allow reuse if pool exhausted
    if (!picked) {
      for (const t of FALLBACK_ORDER[targetTier] || FALLBACK_ORDER.medium) {
        const candidates = buckets[t].filter(x => !pickedIds.has(x.qid));
        if (candidates.length) {
          picked = candidates[Math.floor(Math.random() * candidates.length)];
          break;
        }
      }
    }
    if (picked) {
      selected.push(picked.q);
      pickedIds.add(picked.qid);
    }
  }

  return shuffle(selected);
}

/* ── Question count + mix based on rating gap ─────────── */
export function getQuestionCount(ratingGap, tactic) {
  let base;
  if (ratingGap >= 10)      base = 2;
  else if (ratingGap >= 1)  base = 3;
  else if (ratingGap >= 0)  base = 3;
  else if (ratingGap >= -9) base = 4;
  else                       base = 5;

  if (tactic === 'offensive') return Math.max(2, Math.min(8, Math.round(base * 1.5)));
  if (tactic === 'defensive') return Math.max(1, Math.min(6, Math.round(base * 0.75)));
  return base;
}

export function getDifficultyMix(ratingGap, formScore, season) {
  let m;
  if (ratingGap >= 10)      m = [60, 30, 10,  0];
  else if (ratingGap >= 1)  m = [30, 40, 25,  5];
  else if (ratingGap >= -9) m = [10, 30, 40, 20];
  else                       m = [ 0, 15, 45, 40];

  if (season >= 3)     { m[0] = Math.max(0, m[0] - 20); m[2] += 12; m[3] += 8; }
  else if (season ===2){ m[0] = Math.max(0, m[0] - 10); m[1] += 10; }

  if (formScore >= 4)       m = [0, m[0], m[1], m[2] + m[3]];
  else if (formScore >= 2)  { m[0] = Math.max(0,m[0]-10); m[1]=Math.max(0,m[1]-5); m[2]+=10; m[3]+=5; }
  else if (formScore <= -4) m = [m[1], m[2], m[3], 0];
  else if (formScore <= -2) { m[0]+=10; m[1]+=5; m[2]=Math.max(0,m[2]-10); m[3]=Math.max(0,m[3]-5); }

  const total = m.reduce((s, v) => s + v, 0) || 1;
  return m.map(v => v / total);
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
