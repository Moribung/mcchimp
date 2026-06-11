/**
 * Single reactive source of truth for Quiz Golf.
 * Uses Svelte 5 $state rune.
 *
 * screen values:
 *   'menu' | 'round_setup' | 'hole' | 'scorecard' | 'round_end'
 *
 * currentHole.phase values (per-stroke state machine):
 *   'overview' | 'question' | 'aim' | 'power' | 'flight' | 'result'
 */

export const state = $state({
  screen: 'menu',

  // ── Round ─────────────────────────────────────────────
  course: null,        // { name, holeCount }
  round:  null,        // { holeIdx, scorecard: [{num,par,strokes,label}], totalStrokes, totalPar, toPar }

  // ── Current hole / stroke ─────────────────────────────
  currentHole: null,   // {
                       //   holeNum, ball: [x,y], lie, strokes, penalties,
                       //   phase, pending: { q, ratio, correct, score, maxPts, selected, typed, tier },
                       //   aim: { angle, clubId }, power,
                       //   lastShot: { events, travelYd, errDeg, duffed, holed },
                       //   shotPath: [{x,y,mode}],
                       // }

  // ── Career totals ─────────────────────────────────────
  career: null,        // { roundsPlayed, totalStrokes, totalHoles, bestToPar,
                       //   holesInOne, eagles, birdies, pars, bogeys }

  // ── DB save ID (set after first cloud save) ───────────
  saveId: null,

  // ── Question system ───────────────────────────────────
  activeModId: null,
  loadedModules: {},
  availableModules: [],

  // Question pool (internal, not saved)
  _qPool:    null,     // { easy: [], medium: [], hard: [], elite: [] }
  _qById:    null,     // { [qid]: question }
  _qScores:  {},       // { [qid]: score }  adaptive difficulty
  _qUsed:    [],       // recently used qids (ring buffer)
});
