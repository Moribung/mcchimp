/**
 * Football save system — localStorage (working copy) + Supabase (cloud backup).
 * Keys: 'football_state', 'football_qscores', 'football_career', 'football_modules'
 */

import { deepCopy } from './utils.js';
import { syncNextPlayerId } from './squad.js';

const SAVE_VERSION = '1.0';

const KEYS = {
  state:   'football_state',
  qscores: 'football_qscores',
  career:  'football_career',
  modules: 'football_modules',
};

// Safe localStorage wrapper (handles sandboxed iframes / private browsing)
const _store = (() => {
  let _mem = {};
  let _hasLS = null;
  function check() {
    if (_hasLS !== null) return _hasLS;
    try { localStorage.setItem('_ft','1'); localStorage.removeItem('_ft'); _hasLS = true; }
    catch(e) { _hasLS = false; }
    return _hasLS;
  }
  return {
    set(k, v)  { try { if (check()) localStorage.setItem(k, v); else _mem[k] = v; } catch(e) { _mem[k] = v; } },
    get(k)     { try { if (check()) return localStorage.getItem(k); return _mem[k] ?? null; } catch(e) { return _mem[k] ?? null; } },
    remove(k)  { try { if (check()) localStorage.removeItem(k); else delete _mem[k]; } catch(e) { delete _mem[k]; } },
  };
})();

/* ── DB blob: export / import ───────────────────────────── */
export function exportSave(gs) {
  return {
    version:        SAVE_VERSION,
    club:           deepCopy(gs.club),
    squad:          deepCopy(gs.squad),
    division:       gs.division,
    season:         gs.season,
    matchday:       gs.matchday,
    matchdays:      gs.matchdays,
    returnFixtures: gs.returnFixtures,
    teamCount:      gs.teamCount,
    tactic:         gs.tactic,
    table:          deepCopy(gs.table),
    fixtures:       deepCopy(gs.fixtures),
    form:           [...gs.form],
    activeModId:    gs.activeModId,
    currentMatch:   gs.currentMatch ? deepCopy(gs.currentMatch) : null,
    career:         deepCopy(gs.career),
    qScores:        { ...(gs._qScores || {}) },
  };
}

export function importSave(gs, blob) {
  if (!blob || blob.version !== SAVE_VERSION) return false;
  try {
    gs.club           = blob.club;
    gs.squad          = blob.squad || [];
    gs.division       = blob.division ?? 2;
    gs.season         = blob.season ?? 1;
    gs.matchday       = blob.matchday ?? 1;
    gs.matchdays      = blob.matchdays ?? 36;
    gs.returnFixtures = blob.returnFixtures ?? true;
    gs.teamCount      = blob.teamCount ?? 18;
    gs.tactic         = blob.tactic ?? 'moderate';
    gs.table          = blob.table;
    gs.fixtures       = blob.fixtures;
    gs.form           = blob.form || [];
    gs.activeModId    = blob.activeModId;
    gs.currentMatch   = blob.currentMatch || null;
    gs.career         = blob.career;
    gs._qScores       = blob.qScores || {};
    syncNextPlayerId(gs.squad);
    return true;
  } catch (e) {
    console.warn('[football/saves] importSave failed', e);
    return false;
  }
}

/* ── Local save (state → localStorage) ─────────────────── */
export function saveGame(gs) {
  const snap = {
    club:           deepCopy(gs.club),
    squad:          deepCopy(gs.squad),
    division:       gs.division,
    season:         gs.season,
    matchday:       gs.matchday,
    matchdays:      gs.matchdays,
    returnFixtures: gs.returnFixtures,
    teamCount:      gs.teamCount,
    tactic:         gs.tactic,
    table:          deepCopy(gs.table),
    fixtures:       deepCopy(gs.fixtures),
    form:           [...gs.form],
    activeModId:    gs.activeModId,
    currentMatch:   gs.currentMatch ? deepCopy(gs.currentMatch) : null,
    saveId:         gs.saveId || null,
  };
  _store.set(KEYS.state,   JSON.stringify(snap));
  _store.set(KEYS.qscores, JSON.stringify(gs._qScores || {}));
  _store.set(KEYS.career,  JSON.stringify(gs.career));

  // Persist any uploaded (non-builtin) modules
  const uploaded = Object.values(gs.loadedModules || {}).filter(m => m.tag === 'uploaded');
  _store.set(KEYS.modules, JSON.stringify(uploaded));
}

/* ── Import (storage → state) ──────────────────────────── */
export function loadGame(gs) {
  try {
    const raw = _store.get(KEYS.state);
    if (!raw) return false;
    const snap = JSON.parse(raw);

    gs.club           = snap.club;
    gs.squad          = snap.squad || [];
    gs.division       = snap.division ?? 2;
    gs.season         = snap.season ?? 1;
    gs.matchday       = snap.matchday ?? 1;
    gs.matchdays      = snap.matchdays ?? 36;
    gs.returnFixtures = snap.returnFixtures ?? true;
    gs.teamCount      = snap.teamCount ?? 18;
    gs.tactic         = snap.tactic ?? 'moderate';
    gs.table          = snap.table;
    gs.fixtures       = snap.fixtures;
    gs.form           = snap.form || [];
    gs.activeModId    = snap.activeModId;
    gs.currentMatch   = snap.currentMatch || null;
    gs.saveId         = snap.saveId || null;

    gs._qScores = JSON.parse(_store.get(KEYS.qscores) || '{}');
    gs.career   = JSON.parse(_store.get(KEYS.career)  || 'null') || freshCareer();
    syncNextPlayerId(gs.squad);

    // Restore uploaded modules into registry
    const uploaded = JSON.parse(_store.get(KEYS.modules) || '[]');
    uploaded.forEach(m => {
      if (!gs.loadedModules[m.id]) {
        gs.availableModules = [...gs.availableModules, m];
        gs.loadedModules[m.id] = m;
      }
    });

    return true;
  } catch(e) {
    console.warn('[football/saves] loadGame failed', e);
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
    return {
      clubName: snap.club?.name || '—',
      season:   snap.season ?? 1,
      matchday: snap.matchday ?? 1,
      division: snap.division ?? 2,
    };
  } catch { return null; }
}

/* ── Fresh career record ───────────────────────────────── */
export function freshCareer() {
  return {
    seasonsPlayed:     0,
    championships:     0,
    highestDiv1Finish: null,
    highestDiv2Finish: null,
    wins:   0,
    draws:  0,
    losses: 0,
    totalGoals: 0,
  };
}
