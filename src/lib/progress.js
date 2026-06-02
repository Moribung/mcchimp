/**
 * src/lib/progress.js
 * ──────────────────────────────────────────────────────────────
 * Supabase CRUD for the learning system tables + client-side
 * progress aggregation helpers.
 *
 * Mirrors the pattern in src/lib/saves.js — all functions are async,
 * direct Supabase calls, RLS enforced server-side.
 */

import { supabase }  from '$lib/supabase.js';
import {
  gradeFromRatio, scheduleNew, scheduleReview,
  difficultyToQScore, isDue, isMastered,
} from '$lib/fsrs.js';

/* ═══════════════════════════════════════════════════════════
 * FSRS STATE
 * ═══════════════════════════════════════════════════════════ */

/**
 * Load all FSRS states for a given (user, set).
 * Returns a Map<questionId, srStateRow>.
 */
export async function loadSrStates(userId, setId) {
  const { data, error } = await supabase
    .from('question_sr_state')
    .select('*')
    .eq('user_id', userId)
    .eq('set_id', setId);
  if (error) throw error;
  const map = new Map();
  for (const row of (data || [])) {
    map.set(row.question_id, row);
  }
  return map;
}

/**
 * Load FSRS states for multiple sets at once.
 * Returns a Map<setId, Map<questionId, srStateRow>>.
 */
export async function loadSrStatesForSets(userId, setIds) {
  if (!setIds.length) return new Map();
  const { data, error } = await supabase
    .from('question_sr_state')
    .select('*')
    .eq('user_id', userId)
    .in('set_id', setIds);
  if (error) throw error;
  const result = new Map();
  for (const row of (data || [])) {
    if (!result.has(row.set_id)) result.set(row.set_id, new Map());
    result.get(row.set_id).set(row.question_id, row);
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════
 * ANSWER LOGGING
 * ═══════════════════════════════════════════════════════════ */

/**
 * Log one answered question and upsert its FSRS state.
 * Fire-and-forget — never throws, never blocks the game flow.
 *
 * @param {string} userId
 * @param {object} q           — question object (has id / _id / question text)
 * @param {object} setMeta     — { setId: string, source: 'builtin'|'public'|'library', name: string }
 * @param {string} gameId      — 'mma' | 'mma_sparring' | 'study'
 * @param {number} ratio       — 0–1 from scoreQuestion()
 * @param {number} score
 * @param {number} maxPts
 */
export async function logAnswer(userId, q, setMeta, gameId, ratio, score, maxPts) {
  if (!userId || !q || !setMeta?.setId) return;
  const questionId = String(q.id ?? q._id ?? q.question ?? '');
  if (!questionId) return;

  const grade   = gradeFromRatio(ratio);
  const correct = grade >= 3;

  try {
    // 1. Insert event log row
    await supabase.from('question_answer_log').insert({
      user_id:    userId,
      question_id: questionId,
      set_id:     setMeta.setId,
      set_source: setMeta.source,
      game_id:    gameId,
      grade,
      correct,
      score,
      max_pts:    maxPts,
    });

    // 2. Fetch existing FSRS state (if any)
    const { data: existing } = await supabase
      .from('question_sr_state')
      .select('*')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .eq('set_id', setMeta.setId)
      .maybeSingle();

    // 3. Compute new FSRS schedule
    let newSchedule;
    if (!existing || existing.card_state === 'new') {
      newSchedule = scheduleNew(grade);
    } else {
      const elapsedDays = existing.last_review
        ? (Date.now() - new Date(existing.last_review).getTime()) / 86400000
        : 0;
      newSchedule = scheduleReview(existing, grade, elapsedDays);
    }

    // 4. Upsert FSRS state
    await supabase.from('question_sr_state').upsert({
      user_id:       userId,
      question_id:   questionId,
      set_id:        setMeta.setId,
      set_source:    setMeta.source,
      ...newSchedule,
      review_count:  (existing?.review_count  ?? 0) + 1,
      lapse_count:   (existing?.lapse_count   ?? 0) + (grade === 1 ? 1 : 0),
      correct_count: (existing?.correct_count ?? 0) + (correct ? 1 : 0),
      total_count:   (existing?.total_count   ?? 0) + 1,
      last_review:   new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id,question_id,set_id' });

  } catch (e) {
    console.warn('[progress] logAnswer failed:', e?.message);
  }
}

/* ═══════════════════════════════════════════════════════════
 * LEARNING SETS
 * ═══════════════════════════════════════════════════════════ */

export async function loadLearningSets(userId) {
  const { data, error } = await supabase
    .from('user_learning_sets')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addLearningSet(userId, setId, source, name, questionCount = 0) {
  const { error } = await supabase.from('user_learning_sets').insert({
    user_id:        userId,
    set_id:         setId,
    set_source:     source,
    set_name:       name,
    question_count: questionCount,
  });
  if (error) throw error;
}

export async function removeLearningSet(userId, setId) {
  const { error } = await supabase
    .from('user_learning_sets')
    .delete()
    .eq('user_id', userId)
    .eq('set_id', setId);
  if (error) throw error;
}

/* ═══════════════════════════════════════════════════════════
 * GROUPS
 * ═══════════════════════════════════════════════════════════ */

export async function loadGroups(userId) {
  const { data, error } = await supabase
    .from('question_set_groups')
    .select('*, question_set_group_members(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createGroup(userId, name, description = '', color = '#E8C14A') {
  const { data, error } = await supabase
    .from('question_set_groups')
    .insert({ user_id: userId, name, description: description || null, color })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function setGroupColor(groupId, color) {
  const { error } = await supabase
    .from('question_set_groups')
    .update({ color })
    .eq('id', groupId);
  if (error) throw error;
}

export async function setGroupStarred(groupId, starred) {
  const { error } = await supabase
    .from('question_set_groups')
    .update({ starred })
    .eq('id', groupId);
  if (error) throw error;
}

export async function updateGroup(groupId, name, description = '') {
  const { error } = await supabase
    .from('question_set_groups')
    .update({ name, description: description || null })
    .eq('id', groupId);
  if (error) throw error;
}

export async function deleteGroup(groupId) {
  const { error } = await supabase
    .from('question_set_groups')
    .delete()
    .eq('id', groupId);
  if (error) throw error;
}

export async function addToGroup(groupId, userId, setId, source, name, questionCount = 0) {
  const { error } = await supabase.from('question_set_group_members').insert({
    group_id:       groupId,
    user_id:        userId,
    set_id:         setId,
    set_source:     source,
    set_name:       name,
    question_count: questionCount,
  });
  if (error) throw error;
}

export async function removeFromGroup(groupId, setId) {
  const { error } = await supabase
    .from('question_set_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('set_id', setId);
  if (error) throw error;
}

/* ═══════════════════════════════════════════════════════════
 * PROGRESS CALCULATION  (pure JS, no DB calls)
 * ═══════════════════════════════════════════════════════════ */

/**
 * Calculate progress for a single set.
 * @param {string}  setId
 * @param {number}  questionCount  — total questions in the set
 * @param {Map}     srStates       — Map<questionId, srStateRow> for this set
 */
export function calcSetProgress(setId, questionCount, srStates) {
  if (!questionCount || questionCount === 0) {
    return { masteryPct: 0, seenPct: 0, duePct: 0, masteredCount: 0, seenCount: 0, dueCount: 0 };
  }
  let masteredCount = 0;
  let seenCount     = 0;
  let dueCount      = 0;

  for (const sr of (srStates?.values() ?? [])) {
    if (sr.total_count > 0) seenCount++;
    if (isMastered(sr))      masteredCount++;
    if (isDue(sr))            dueCount++;
  }

  return {
    masteredCount,
    seenCount,
    dueCount,
    masteryPct: Math.min(1, masteredCount / questionCount),
    seenPct:    Math.min(1, seenCount     / questionCount),
    duePct:     Math.min(1, dueCount      / questionCount),
  };
}

/**
 * Calculate aggregate progress for a group (or any list of set members).
 * Uses composite keys "setId:questionId" to avoid cross-set qid collisions.
 *
 * @param {Array}  members      — rows from question_set_group_members (or user_learning_sets)
 *                                each must have { set_id, question_count }
 * @param {Map}    srStatesMap  — Map<setId, Map<questionId, srStateRow>>
 */
export function calcGroupProgress(members, srStatesMap) {
  let totalQ    = 0;
  const mastered = new Set();
  const seen     = new Set();
  const due      = new Set();

  for (const member of members) {
    const qCount = member.question_count || 0;
    totalQ += qCount;
    const srMap = srStatesMap?.get?.(member.set_id);
    if (!srMap) continue;
    for (const [qid, sr] of srMap.entries()) {
      const key = `${member.set_id}:${qid}`;
      if (sr.total_count > 0) seen.add(key);
      if (isMastered(sr))      mastered.add(key);
      if (isDue(sr))            due.add(key);
    }
  }

  if (totalQ === 0) return { masteryPct: 0, seenPct: 0, duePct: 0, masteredCount: 0, seenCount: 0, dueCount: 0, totalQ: 0 };
  return {
    masteredCount: mastered.size,
    seenCount:     seen.size,
    dueCount:      due.size,
    totalQ,
    masteryPct: Math.min(1, mastered.size / totalQ),
    seenPct:    Math.min(1, seen.size     / totalQ),
    duePct:     Math.min(1, due.size      / totalQ),
  };
}

/**
 * Calculate overall progress across all learning sets.
 * Convenience wrapper around calcGroupProgress.
 */
export function calcOverallProgress(learningSets, srStatesMap) {
  return calcGroupProgress(learningSets, srStatesMap);
}

/**
 * Average FSRS difficulty (1–10) across all seen questions in a set.
 * Returns null if no questions have been seen yet.
 */
export function avgDifficulty(srStates) {
  let sum = 0, count = 0;
  for (const sr of (srStates?.values() ?? [])) {
    if (sr.total_count > 0) { sum += sr.difficulty; count++; }
  }
  return count > 0 ? sum / count : null;
}

/**
 * Count how many cards are due across a collection of srState maps.
 */
export function countDue(srStatesMap) {
  let n = 0;
  for (const srMap of (srStatesMap?.values() ?? [])) {
    for (const sr of srMap.values()) {
      if (isDue(sr)) n++;
    }
  }
  return n;
}

/**
 * Next due date across all sets (earliest upcoming due_date that is in the future).
 * Returns null if nothing is scheduled.
 */
export function nextDueDate(srStatesMap) {
  let earliest = null;
  const now = new Date();
  for (const srMap of (srStatesMap?.values() ?? [])) {
    for (const sr of srMap.values()) {
      if (!sr.due_date) continue;
      const d = new Date(sr.due_date);
      if (d > now && (!earliest || d < earliest)) earliest = d;
    }
  }
  return earliest;
}

/* ─── re-export isDue/isMastered so callers only need one import ─── */
export { isDue, isMastered, difficultyToQScore };
