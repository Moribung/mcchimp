/**
 * src/lib/mma/state.svelte.js
 * ─────────────────────────────────────────
 * Single reactive source of truth for MMA Career Trivia.
 * Uses Svelte 5 $state rune.
 *
 * Rules:
 *  - FIGHTERS Map lives in fighters.js — NOT here (too large/mutable).
 *  - _qPool, _qUsed, _qById are internal — NOT serialised to save.
 *  - Everything else that needs to survive a save goes through saves.js.
 */

export const state = $state({
  screen: 'menu',  // 'menu' | 'saved_careers' | 'past_careers' | 'naming' | 'prefight' | 'question' | 'result' | 'career_end' | 'end'

  // ── Career ────────────────────────────────────────────
  career: null,           // set by initState(); contains fighterName, phase, divisions etc.
  currentOpponent: null,  // set before each fight
  activeModId: null,      // which question module is loaded
  calloutUsed: false,     // one callout allowed per result screen

  // ── Fight ─────────────────────────────────────────────
  currentQuestion: null,
  selectedOptions: [],    // array for Svelte binding; convert to Set when scoring
  timerValue: 0,
  timerRunning: false,
  fightResult: null,      // set after answer submitted

  // ── Global record ─────────────────────────────────────
  wins:      0,
  losses:    0,
  draws:     0,
  finishes:  0,
  results:   [],          // array of 'win'|'loss'|'draw'|'finish'
  boutHistory: [],

  // ── Streaks ───────────────────────────────────────────
  currentStreak:      0,  // positive = win streak, negative = loss streak
  bestStreak:         0,
  finishStreak:       0,
  unbeatenStreak:     0,
  bestUnbeatenStreak: 0,

  // ── Finish type tallies ───────────────────────────────
  winsByKO: 0, winsByTKO: 0, winsBySub: 0, winsByDec: 0,
  lossByKO: 0, lossByTKO: 0, lossBySub: 0, lossByDec: 0,
  methodWeights:       { KO: 1, TKO: 1, Submission: 1 },
  specificMethodCounts: {},

  // ── Question pool (internal — not serialised to save) ─
  _qPool:   null,   // { easy: [...], medium: [...], hard: [...], elite: [...] }
  _qUsed:   null,   // Set of used question IDs
  _qById:   null,   // { [qid]: question } — fast lookup cache
  _qScores: {},     // { [qid]: score } — adaptive difficulty; +1 win, -1 loss
  lastQid:  null,   // last question served — never repeat immediately
  fightIndex: 0,

  // ── Sparring ──────────────────────────────────────────
  sparring:      false,
  sparringPool:  null,  // shuffled flat pool for sparring mode
  sparringPtr:   0,     // current position in sparring pool

  // ── Timer (managed by QuestionScreen.svelte) ──────────
  effectiveTimer: 30,   // seconds — set at fight start from durability
  timeLeft:       30,

  // ── Module list ───────────────────────────────────────
  availableModules: [],         // loaded from static/questions/ via $lib/questions.js
  loadedModules:    {},         // { [modId]: moduleData }

  // ── Misc ──────────────────────────────────────────────
  winsVsFighter:    {},         // { [fid]: count } — question rotation tracker
  lastResultSlot:   null,
  retiredVoluntarily: false,
  retiredDurability:  false,
  retiredForcefully:  false,
  _calloutOpponent:   null,     // set when callout is accepted, consumed by acceptCalloutFight

  // ── Save slot ─────────────────────────────────────────
  saveId:         null,         // UUID of the current active save row in career_saves
  _newHistoryId:  null,         // UUID of a freshly archived career — highlights it in past_careers screen
});
