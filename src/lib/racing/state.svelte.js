/**
 * Single reactive source of truth for Quiz Racing (Svelte 5 $state rune).
 * MVP: a single race, no cloud saves.
 */

export const state = $state({
  screen: 'menu',                 // menu | setup | race | result
  setup: { stance: 'balanced', trackId: 'random' },  // baseline difficulty + circuit

  // Active race — created by startRace(), shape documented in +page.svelte.
  // race.phase: running | break | question | resolve | pit | done
  race: null,

  // Question system (not serialised)
  activeModId: null,
  loadedModules: {},
  availableModules: [],
  _qPool: null,                   // { easy:[], medium:[], hard:[], elite:[] }
  _qById: null,                   // { [qid]: question }
  _qScores: {},                   // { [qid]: score } — adaptive difficulty
  _qUsed: [],                     // recently used qids (ring buffer)
});
