/**
 * src/lib/mma/saves.js
 * ─────────────────────────────────────────
 * MMA-specific save/load contract.
 * Sits between the game state and the platform saves.js (Supabase).
 *
 * exportSave(state)         → JSON blob ready for Supabase
 * loadSave(state, blob)     → restores state from blob, returns true/false
 *
 * Called from +page.svelte:
 *   after each fight:   await platformExportSave(userId, 'mma', exportSave(state))
 *   on career start:    const blob = await platformLoadSave(userId, 'mma'); loadSave(state, blob)
 *   on career end:      await platformDeleteSave(userId, 'mma')
 */

import { getFighters, resetFighters, divisionSlotToOpponent } from './fighters.js';
import { ensureQPool, assignDivisionQuestions }              from './questions.js';
import { streakSteps, ensureTitles }                         from './career.js';
import { CHAMP_SLOT }                                        from './constants.js';

const SAVE_VERSION = '2.0';

/**
 * Re-establish the upcoming opponent after a load.
 * resolveResult() nulls currentOpponent at the end of every fight, and the next
 * opponent is normally chosen on "Next Fight". Since we resume directly on the
 * prefight screen, we must restore it here:
 *  - reuse the saved opponent if it still occupies its slot (saved from prefight)
 *  - otherwise pick a fresh opponent via standard matchmaking (no NPC round)
 */
function restoreNextOpponent(state, saved) {
  const cs = state.career;
  if (!cs || !cs.division) return null;

  if (saved && saved.fid && saved.fid !== 'player'
      && typeof saved.divisionSlot === 'number'
      && cs.division.slots[saved.divisionSlot] === saved.fid) {
    return saved;
  }

  const playerSlot = cs.division.playerSlot;
  const targetSlot = playerSlot === CHAMP_SLOT
    ? CHAMP_SLOT - 1
    : Math.min(CHAMP_SLOT, playerSlot + streakSteps(cs.phaseStreak, state));
  const fid = cs.division.slots[targetSlot];
  return (fid && fid !== 'player') ? divisionSlotToOpponent(fid, targetSlot, cs) : null;
}

/* ── Export ──────────────────────────────────────────── */
export function exportSave(state) {
  return {
    version:    SAVE_VERSION,

    // Career core
    career:     state.career ? { ...state.career } : null,
    activeModId: state.activeModId,

    // Upcoming opponent (valid when saved from the prefight screen)
    currentOpponent: state.currentOpponent ? { ...state.currentOpponent } : null,

    // Fighter registry — serialise Map as [fid, fighter] pairs
    fighters:   [...getFighters().entries()],

    // Global record
    wins:       state.wins,
    losses:     state.losses,
    draws:      state.draws,
    finishes:   state.finishes,
    results:    [...(state.results || [])],
    boutHistory: [...(state.boutHistory || [])],
    fightIndex: state.fightIndex,

    // Streaks
    currentStreak:      state.currentStreak,
    bestStreak:         state.bestStreak,
    finishStreak:       state.finishStreak,
    unbeatenStreak:     state.unbeatenStreak,
    bestUnbeatenStreak: state.bestUnbeatenStreak,

    // Finish type tallies
    winsByKO:  state.winsByKO,  winsByTKO: state.winsByTKO,
    winsBySub: state.winsBySub, winsByDec: state.winsByDec,
    lossByKO:  state.lossByKO,  lossByTKO: state.lossByTKO,
    lossBySub: state.lossBySub, lossByDec: state.lossByDec,

    // Method weights (carry over fighting style tendency)
    methodWeights:        { ...state.methodWeights },
    specificMethodCounts: { ...state.specificMethodCounts },

    // Adaptive question scores — persist across sessions
    qScores:       { ...(state._qScores || {}) },

    // Question rotation tracker
    winsVsFighter: { ...(state.winsVsFighter || {}) },

    // Head-to-head record vs individual fighters
    h2h: { ...(state.h2h || {}) },
  };
}

/* ── Load ────────────────────────────────────────────── */
/**
 * Restore state from a save blob.
 * Returns true on success, false if the blob is invalid/incompatible.
 */
export function loadSave(state, blob) {
  if (!blob || blob.version !== SAVE_VERSION) return false;

  // ── Restore FIGHTERS Map ──────────────────────────────
  resetFighters();
  if (Array.isArray(blob.fighters)) {
    const fighters = getFighters();
    for (const [fid, fighter] of blob.fighters) {
      fighters.set(fid, fighter);
    }
  }

  // ── Restore state fields ──────────────────────────────
  state.career      = blob.career    || null;
  state.activeModId = blob.activeModId || null;

  // Re-alias division → divisions[phase]. JSON serialisation breaks the shared
  // object reference between career.division and career.divisions[phase]; if we
  // don't restore it, they desync and rank progress is silently discarded by
  // syncDivisionAlias on the next NPC round (player stays stuck at their slot).
  if (state.career?.divisions) {
    const ph = state.career.phase ?? 1;
    if (state.career.divisions[ph]) {
      state.career.division = state.career.divisions[ph];
    }
  }

  // Ensure per-organisation title records exist (migrates legacy single-belt saves).
  if (state.career) ensureTitles(state.career);

  state.wins        = blob.wins      || 0;
  state.losses      = blob.losses    || 0;
  state.draws       = blob.draws     || 0;
  state.finishes    = blob.finishes  || 0;
  state.results     = blob.results   || [];
  state.boutHistory = blob.boutHistory || [];
  state.fightIndex  = blob.fightIndex  || 0;

  state.currentStreak      = blob.currentStreak      || 0;
  state.bestStreak         = blob.bestStreak         || 0;
  state.finishStreak       = blob.finishStreak       || 0;
  state.unbeatenStreak     = blob.unbeatenStreak     || 0;
  state.bestUnbeatenStreak = blob.bestUnbeatenStreak || 0;

  state.winsByKO  = blob.winsByKO  || 0;
  state.winsByTKO = blob.winsByTKO || 0;
  state.winsBySub = blob.winsBySub || 0;
  state.winsByDec = blob.winsByDec || 0;
  state.lossByKO  = blob.lossByKO  || 0;
  state.lossByTKO = blob.lossByTKO || 0;
  state.lossBySub = blob.lossBySub || 0;
  state.lossByDec = blob.lossByDec || 0;

  state.methodWeights        = blob.methodWeights        || { KO: 1, TKO: 1, Submission: 1 };
  state.specificMethodCounts = blob.specificMethodCounts || {};

  state._qScores      = blob.qScores       || {};
  state.winsVsFighter = blob.winsVsFighter || {};
  state.h2h           = blob.h2h           || {};

  // ── Rebuild question pool ─────────────────────────────
  // _qPool, _qUsed, _qById are never serialised — always rebuilt on load
  state._qPool = null;
  state._qUsed = null;
  state._qById = null;
  ensureQPool(state);

  // Re-assign division questions using FIGHTERS data that was just restored
  if (state.career?.divisions) {
    for (const [ph, div] of Object.entries(state.career.divisions)) {
      assignDivisionQuestions(state, div, parseInt(ph));
    }
  } else if (state.career?.division) {
    assignDivisionQuestions(state, state.career.division, state.career.phase || 1);
  }

  // ── Reset transient flags ─────────────────────────────
  state.calloutUsed        = false;
  state._calloutOpponent   = null;
  state.retiredVoluntarily = false;
  state.retiredDurability  = false;
  state.retiredForcefully  = false;
  state.sparring           = false;
  state.fightResult        = null;
  state.currentQuestion    = null;
  state.selectedOptions    = [];
  state.timerRunning       = false;

  // A promotion/cut offer is only actionable from the result screen, but we
  // resume on prefight — so an offer that was pending at save time would be
  // orphaned and leave advancementPending/cutPending stuck true, permanently
  // disabling future offers. Clear the orphaned choice and its flags so the
  // offer simply re-rolls on the next qualifying result.
  if (state.career) {
    if (state.career.pendingEvent?.choiceType) state.career.pendingEvent = null;
    state.career.advancementPending = false;
    state.career.cutPending         = false;
  }

  // Restore (or reconstruct) the upcoming opponent so the resumed prefight
  // screen has a real opponent — otherwise the next bout records "Unknown".
  state.currentOpponent = restoreNextOpponent(state, blob.currentOpponent);

  state.screen = 'prefight';
  return true;
}
