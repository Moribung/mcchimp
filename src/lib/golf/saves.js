/**
 * Golf save system — localStorage (working copy) + Supabase (cloud backup).
 * Keys: 'golf_state', 'golf_qscores', 'golf_career', 'golf_modules'
 *
 * A stroke is atomic: currentHole is saved WITHOUT phase/pending/question, so
 * a restored round resumes at the start of the current stroke with a fresh
 * question (never re-shows a half-answered one).
 */

import { deepCopy } from './utils.js';

const SAVE_VERSION = '1.0';

const KEYS = {
  state:   'golf_state',
  qscores: 'golf_qscores',
  career:  'golf_career',
  modules: 'golf_modules',
};

// Safe localStorage wrapper (handles sandboxed iframes / private browsing)
const _store = (() => {
  let _mem = {};
  let _hasLS = null;
  function check() {
    if (_hasLS !== null) return _hasLS;
    try { localStorage.setItem('_gf','1'); localStorage.removeItem('_gf'); _hasLS = true; }
    catch(e) { _hasLS = false; }
    return _hasLS;
  }
  return {
    set(k, v)  { try { if (check()) localStorage.setItem(k, v); else _mem[k] = v; } catch(e) { _mem[k] = v; } },
    get(k)     { try { if (check()) return localStorage.getItem(k); return _mem[k] ?? null; } catch(e) { return _mem[k] ?? null; } },
    remove(k)  { try { if (check()) localStorage.removeItem(k); else delete _mem[k]; } catch(e) { delete _mem[k]; } },
  };
})();

function holeSnapshot(ch) {
  if (!ch) return null;
  return {
    holeNum:    ch.holeNum,     // layout number (geometry)
    displayNum: ch.displayNum,  // 1..18 position in the round
    ball:       [...ch.ball],
    lie:        ch.lie,
    strokes:    ch.strokes,
    penalties:  ch.penalties,
  };
}

/* ── DB blob: export / import ───────────────────────────── */
export function exportSave(gs) {
  return {
    version:     SAVE_VERSION,
    course:      deepCopy(gs.course),
    round:       deepCopy(gs.round),
    career:      deepCopy(gs.career),
    activeModId: gs.activeModId,
    currentHole: holeSnapshot(gs.currentHole),
    qScores:     { ...(gs._qScores || {}) },
  };
}

export function importSave(gs, blob) {
  if (!blob || blob.version !== SAVE_VERSION) return false;
  try {
    gs.course      = blob.course;
    gs.round       = blob.round;
    gs.career      = blob.career || freshCareer();
    gs.activeModId = blob.activeModId;
    gs.currentHole = blob.currentHole
      ? { ...blob.currentHole, phase: 'overview', pending: null, aim: null, power: 0, lastShot: null, shotPath: null, shotAnim: null }
      : null;
    gs._qScores    = blob.qScores || {};
    return true;
  } catch (e) {
    console.warn('[golf/saves] importSave failed', e);
    return false;
  }
}

/* ── Local save (state → localStorage) ─────────────────── */
export function saveGame(gs) {
  const snap = {
    course:      deepCopy(gs.course),
    round:       deepCopy(gs.round),
    activeModId: gs.activeModId,
    currentHole: holeSnapshot(gs.currentHole),
    saveId:      gs.saveId || null,
  };
  _store.set(KEYS.state,   JSON.stringify(snap));
  _store.set(KEYS.qscores, JSON.stringify(gs._qScores || {}));
  _store.set(KEYS.career,  JSON.stringify(gs.career));

  const uploaded = Object.values(gs.loadedModules || {}).filter(m => m.tag === 'uploaded');
  _store.set(KEYS.modules, JSON.stringify(uploaded));
}

/* ── Import (storage → state) ──────────────────────────── */
export function loadGame(gs) {
  try {
    const raw = _store.get(KEYS.state);
    if (!raw) return false;
    const snap = JSON.parse(raw);

    gs.course      = snap.course;
    gs.round       = snap.round;
    gs.activeModId = snap.activeModId;
    gs.currentHole = snap.currentHole
      ? { ...snap.currentHole, phase: 'overview', pending: null, aim: null, power: 0, lastShot: null, shotPath: null, shotAnim: null }
      : null;
    gs.saveId      = snap.saveId || null;

    gs._qScores = JSON.parse(_store.get(KEYS.qscores) || '{}');
    gs.career   = JSON.parse(_store.get(KEYS.career)  || 'null') || freshCareer();

    const uploaded = JSON.parse(_store.get(KEYS.modules) || '[]');
    uploaded.forEach(m => {
      if (!gs.loadedModules[m.id]) {
        gs.availableModules = [...gs.availableModules, m];
        gs.loadedModules[m.id] = m;
      }
    });

    return true;
  } catch(e) {
    console.warn('[golf/saves] loadGame failed', e);
    return false;
  }
}

/* ── Clear save ────────────────────────────────────────── */
export function clearSave() {
  Object.values(KEYS).forEach(k => _store.remove(k));
}

/* ── Peek at save (for menu continue card) ─────────────── */
export function peekSave() {
  try {
    const raw = _store.get(KEYS.state);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap.round) return null;
    return {
      courseName: snap.course?.name || 'Round',
      holeCount:  snap.course?.holeCount ?? 9,
      holeNum:    snap.currentHole?.displayNum ?? (snap.round.holeIdx + 1),
      toPar:      snap.round?.toPar ?? 0,
    };
  } catch { return null; }
}

/* ── Career without a round save (lifetime stats persist) ─ */
export function loadCareer() {
  try { return JSON.parse(_store.get(KEYS.career) || 'null'); } catch { return null; }
}

/* ── Clear only the active round (career survives) ─────── */
export function clearRound() {
  _store.remove(KEYS.state);
}

/* ── Round label for the cloud save row ────────────────── */
export function saveLabel(gs) {
  const toPar = gs.round?.toPar ?? 0;
  const tp = toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : `${toPar}`;
  const holeNum = gs.currentHole?.displayNum ?? ((gs.round?.holeIdx ?? 0) + 1);
  return `${gs.course?.holeCount ?? 9} Holes — Hole ${holeNum}, ${tp}`;
}

/* ── Fresh career record ───────────────────────────────── */
export function freshCareer() {
  return {
    roundsPlayed: 0,
    totalStrokes: 0,
    totalHoles:   0,
    bestToPar:    null,
    holesInOne:   0,
    eagles:       0,
    birdies:      0,
    pars:         0,
    bogeys:       0,
  };
}
