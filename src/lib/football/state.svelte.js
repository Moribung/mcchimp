/**
 * Single reactive source of truth for Football Career Manager.
 * Uses Svelte 5 $state rune.
 *
 * screen values:
 *   'menu' | 'hub' | 'prematch' | 'match' | 'matchreport' | 'endofseason'
 */

export const state = $state({
  screen: 'menu',

  // ── Club ──────────────────────────────────────────────
  club: null,          // { name, kitColour, rating }
  squad: [],           // array of player objects

  // ── League ────────────────────────────────────────────
  division: 2,         // 1 = Prima, 2 = Seconda
  season:   1,
  matchday: 1,
  matchdays: 36,       // set on new game from team count
  returnFixtures: true,
  teamCount: 18,
  tactic: 'moderate',  // 'offensive' | 'moderate' | 'defensive'

  // Table: { div1: Row[], div2: Row[] }
  table: null,
  // Fixtures: { div1: Matchday[], div2: Matchday[] }
  fixtures: null,
  form: [],            // last 5 results ['W','D','L',...]

  // ── Career totals ─────────────────────────────────────
  career: null,        // { seasonsPlayed, championships, highestDiv1Finish, wins, draws, losses, totalGoals }

  // ── Current match ─────────────────────────────────────
  currentMatch: null,  // set during a live match

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
