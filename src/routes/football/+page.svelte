<!-- src/routes/football/+page.svelte -->
<script>
  import { onMount }    from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import { supabase }   from '$lib/supabase.js';
  import { fetchSet, fetchPublicCatalog } from '$lib/questions.js';

  import { state as gs }    from '$lib/football/state.svelte.js';
  import { saveGame, loadGame, peekSave, clearSave, freshCareer, exportSave, importSave } from '$lib/football/saves.js';
  import { createSave, updateSave, loadAllSaves } from '$lib/saves.js';
  import { logAnswer } from '$lib/progress.js';
  import { generateSquad, calcTeamRating, assignStatuses, newPlayer } from '$lib/football/squad.js';
  import { buildPool }      from '$lib/football/questions.js';
  import {
    buildInitialTables, generateFixtures, sortTable,
    updateTableRow, simulateMatchday, getTableRow, getClubName,
    resolvePromotionRelegation, driftClubRatings, getPlayerMatch,
  } from '$lib/football/league.js';
  import { ordinal, randInt, clamp } from '$lib/football/utils.js';
  import { applyIPUpgrades } from '$lib/football/squad.js';
  import {
    getQuestionCount, getDifficultyMix, selectMatchQuestions,
    scoreTypedInputs, scoreFillGapInputs, updateQScore, effectiveTier,
  } from '$lib/football/questions.js';
  import { relegationCount } from '$lib/football/constants.js';
  import { randomName } from '$lib/football/names.js';

  import { deleteSave } from '$lib/saves.js';

  import MenuScreen        from '$lib/football/screens/MenuScreen.svelte';
  import CareerSetupScreen from '$lib/football/screens/CareerSetupScreen.svelte';
  import HubScreen         from '$lib/football/screens/HubScreen.svelte';
  import PreMatchScreen    from '$lib/football/screens/PreMatchScreen.svelte';
  import MatchScreen       from '$lib/football/screens/MatchScreen.svelte';
  import MatchReportScreen from '$lib/football/screens/MatchReportScreen.svelte';
  import EndOfSeasonScreen from '$lib/football/screens/EndOfSeasonScreen.svelte';

  // ── Back bar auth ─────────────────────────────────────
  let displayName = $state('');
  let loggedIn    = $state(false);
  let userId      = $state(null);
  let userTier    = $state('regular');

  // ── Save state ────────────────────────────────────────
  let saveError   = $state(null);
  let savingExit  = $state(false);

  beforeNavigate(() => document.body.classList.remove('game-page'));

  onMount(async () => {
    document.body.classList.add('game-page');

    // Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      loggedIn = true;
      userId   = session.user.id;
      const { data } = await supabase.from('profiles').select('display_name, tier').eq('id', session.user.id).single();
      if (data) { displayName = data.display_name; userTier = data.tier || 'regular'; }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, sess) => {
      if (sess) {
        loggedIn = true;
        userId   = sess.user.id;
        const { data } = await supabase.from('profiles').select('display_name, tier').eq('id', sess.user.id).single();
        if (data) { displayName = data.display_name; userTier = data.tier || 'regular'; }
      } else { loggedIn = false; displayName = ''; userId = null; userTier = 'regular'; }
    });

    // Load question modules from /questions/
    await loadModules();

    // Restore save: prefer localStorage (active session); fall back to cloud if empty
    const hasLocal = loadGame(gs);
    if (hasLocal) {
      if (gs.activeModId && gs.loadedModules[gs.activeModId]) rebuildPool(gs.activeModId);
      if (gs.currentMatch) {
        gs.screen = gs.currentMatch.phase === 'matchreport' ? 'matchreport' : 'match';
      } else {
        gs.screen = 'hub';
      }
    } else if (userId) {
      // No local save — surface the most recent cloud save as the Continue option
      try {
        const dbSaves = await loadAllSaves(userId, 'football');
        if (dbSaves.length > 0) {
          cloudContinueSave = dbSaves[0];
          savedInfo = cloudSavedInfo(cloudContinueSave);
        }
      } catch (e) {
        console.warn('[football] cloud save check on mount failed', e);
      }
    }

    return () => {
      document.body.classList.remove('game-page');
      subscription.unsubscribe();
    };
  });

  /* ── Module loading ──────────────────────────────────── */
  // Every set in the shared public catalog is loaded. The ones listed here are
  // flagged as this game's "defaults" (no tag → shown as menu grid cards and
  // pre-selectable); all others are tagged 'public'. All of them — defaults
  // included — appear in the Public Sets browser.
  const FOOTBALL_DEFAULTS = ['football_questions.json', 'animal_facts.json'];

  async function loadModules() {
    try {
      const catalog = await fetchPublicCatalog();
      const sets = await Promise.all(catalog.map(async fname => {
        try {
          const data = await fetchSet(fname);
          return {
            ...data,
            id: fname.replace('.json', ''),
            filename: fname,
            tag: FOOTBALL_DEFAULTS.includes(fname) ? undefined : 'public',
          };
        } catch { return null; }
      }));
      const valid = sets.filter(Boolean);
      gs.availableModules = valid;
      valid.forEach(m => { gs.loadedModules[m.id] = m; });
    } catch(e) {
      console.warn('[football] loadModules failed', e);
    }
  }

  /* ── Set metadata for progress reporting ────────────── */
  function buildSetMeta(modId) {
    const mod = gs.loadedModules?.[modId];
    if (!mod) return null;
    const source = !mod.tag ? 'builtin'
                 : mod.tag === 'library' ? 'library'
                 : 'public';
    const setId  = mod.tag === 'library'
      ? modId.replace(/^lib_/, '')
      : (mod.filename || modId);
    return { setId, source, name: mod.name };
  }

  /* ── Question pool ───────────────────────────────────── */
  function rebuildPool(modId) {
    const mod = gs.loadedModules[modId];
    if (!mod) return;
    const { pool, byId } = buildPool(mod);
    gs._qPool  = pool;
    gs._qById  = byId;
    gs._qUsed  = [];
    gs.activeModId = modId;
  }

  /* ── Save ────────────────────────────────────────────── */
  function save() { saveGame(gs); }

  /* ── Cloud save ──────────────────────────────────────── */
  function footballSaveLimit() {
    return (userTier === 'pro' || userTier === 'dev') ? 20 : 5;
  }

  async function saveToCloud() {
    if (!userId || !gs.club) return false;
    try {
      const blob = exportSave(gs);
      if (gs.saveId) {
        await updateSave(gs.saveId, blob, gs.club.name);
      } else {
        // Check limit; auto-delete oldest non-starred if needed
        const existing = await loadAllSaves(userId, 'football');
        const limit    = footballSaveLimit();
        if (existing.length >= limit) {
          const oldest = existing.filter(s => !s.starred).pop();
          if (!oldest) {
            saveError = 'Save limit reached. Delete or un-star a career to make room.';
            return false;
          }
          await deleteSave(oldest.id);
        }
        const id = await createSave(userId, 'football', blob, gs.club.name);
        gs.saveId = id;
        saveGame(gs);
      }
      saveError = null;
      return true;
    } catch (e) {
      saveError = `Save failed: ${e?.message || 'unknown error'}`;
      return false;
    }
  }

  /* ── Load a specific cloud save ──────────────────────── */
  async function onLoadsave(saveId, blob) {
    if (!importSave(gs, blob)) return;
    gs.saveId = saveId;
    if (gs.activeModId && gs.loadedModules[gs.activeModId]) rebuildPool(gs.activeModId);
    saveGame(gs);
    savedInfo = peekSave();
    gs.screen = 'hub';
  }

  /* ── Handle deletion from the saves modal ────────────── */
  function onSaveDeleted(id) {
    if (gs.saveId === id) {
      gs.saveId = null;
      saveGame(gs);
    }
  }

  async function saveAndExit() {
    if (savingExit) return;
    savingExit = true;
    try {
      save();
      if (userId) {
        const ok = await saveToCloud();
        if (!ok) return;
      }
      returnToMenu();
    } finally {
      savingExit = false;
    }
  }

  function returnToMenu() {
    // Purge active game from memory — localStorage retains the save for Continue
    gs.club         = null;
    gs.squad        = [];
    gs.division     = 2;
    gs.season       = 1;
    gs.matchday     = 1;
    gs.table        = null;
    gs.fixtures     = null;
    gs.form         = [];
    gs.career       = null;
    gs.currentMatch = null;
    gs._qPool       = null;
    gs._qById       = null;
    gs._qUsed       = [];
    gs.saveId       = null;
    cloudContinueSave = null;
    savedInfo = peekSave();
    gs.screen = 'menu';
  }

  /* ── Continue (from menu) ────────────────────────────── */
  let savedInfo        = $state(peekSave());
  let cloudContinueSave = $state(null); // DB row used when localStorage is empty

  function cloudSavedInfo(row) {
    const d = row?.save_data;
    if (!d) return null;
    return {
      clubName: row.fighter_name || d.club?.name || '—',
      season:   d.season   ?? 1,
      matchday: d.matchday ?? 1,
      division: d.division ?? 2,
    };
  }

  function continueGame() {
    if (peekSave()) {
      // Load from localStorage (normal path)
      if (loadGame(gs)) {
        if (gs.activeModId && gs.loadedModules[gs.activeModId]) rebuildPool(gs.activeModId);
        gs.screen = gs.currentMatch?.phase === 'matchreport' ? 'matchreport' : gs.currentMatch ? 'match' : 'hub';
      }
    } else if (cloudContinueSave) {
      // No local save — load from the last cloud save
      if (importSave(gs, cloudContinueSave.save_data)) {
        gs.saveId = cloudContinueSave.id;
        if (gs.activeModId && gs.loadedModules[gs.activeModId]) rebuildPool(gs.activeModId);
        saveGame(gs);
        cloudContinueSave = null;
        savedInfo = peekSave();
        gs.screen = gs.currentMatch ? 'match' : 'hub';
      }
    }
  }

  /* ── New game ────────────────────────────────────────── */
  function startGame({ clubName, kitColour, startRating, teamCount, returnFixtures, modId }) {
    clearSave();
    gs.saveId = null; // each new career gets a fresh DB record

    // Club
    gs.club         = { name: clubName, kitColour, rating: startRating };
    gs.squad        = generateSquad(startRating);
    gs.club.rating  = calcTeamRating(gs.squad);

    // League
    gs.division       = 2; // always start in Seconda
    gs.season         = 1;
    gs.matchday       = 1;
    gs.teamCount      = teamCount;
    gs.returnFixtures = returnFixtures;
    gs.matchdays      = returnFixtures ? (teamCount - 1) * 2 : teamCount - 1;
    gs.tactic         = 'moderate';
    gs.form           = [];

    gs.table    = buildInitialTables(gs.club, teamCount, gs.division);
    gs.fixtures = {
      div1: generateFixtures(gs.table.div1, returnFixtures),
      div2: generateFixtures(gs.table.div2, returnFixtures),
    };

    // Career
    gs.career     = freshCareer();
    gs.currentMatch = null;

    // Questions
    gs._qScores = {};
    rebuildPool(modId);

    save();
    gs.screen = 'hub';
  }

  /* ── Hub helpers ─────────────────────────────────────── */
  function tableMap() {
    const m = {};
    [...(gs.table?.div1 || []), ...(gs.table?.div2 || [])].forEach(r => { m[r.id] = r; });
    return m;
  }

  function currentDivTable() {
    return gs.table?.[`div${gs.division}`] || [];
  }

  function currentFixtures() {
    return gs.fixtures?.[`div${gs.division}`] || [];
  }

  function playerMatch() {
    return getPlayerMatch(gs.fixtures || {}, gs.matchday, gs.division);
  }

  /* ── Pre-match ───────────────────────────────────────── */
  function goToPreMatch() { gs.screen = 'prematch'; }

  function startMatch() {
    const pm     = playerMatch();
    if (!pm) { gs.screen = 'hub'; return; }
    const isHome = pm.homeId === 'player';
    const oppId  = isHome ? pm.awayId : pm.homeId;
    const oppRow = getTableRow(oppId, gs.table.div1, gs.table.div2);
    const rGap   = gs.club.rating - (oppRow?.rating || 60);
    const fScore = gs.form.slice(-5).reduce((s, r) => s + (r==='W'?1:r==='L'?-1:0), 0);
    const mix    = getDifficultyMix(rGap, fScore, gs.season);
    const count  = getQuestionCount(rGap, gs.tactic);

    const pool = gs._qPool || {};
    const byId = gs._qById || {};
    const qs   = selectMatchQuestions(pool, byId, gs._qScores, gs._qUsed, count, mix);

    // Track used question IDs so they won't repeat in the next few matches
    const usedIds = qs.map(q => q.id || q.question).filter(Boolean);
    gs._qUsed = [...gs._qUsed, ...usedIds].slice(-30);

    const sortedBefore = sortTable(currentDivTable());
    gs.currentMatch = {
      opponentId:        oppId,
      isHome,
      questions:         qs,
      currentQIdx:       0,
      playerGoals:       0,
      oppGoals:          0,
      goalScorers:       [],
      phase:             'answering',
      selectedOptions:   [],
      _typedInputs:      [],
      lastAnswerCorrect: null,
      tierChanges:       [],
      positionBefore:    sortedBefore.findIndex(r => r.id === 'player') + 1,
    };

    save();
    gs.screen = 'match';
  }

  /* ── Match logic — called by MatchScreen callbacks ──── */
  function currentQ() {
    return gs.currentMatch?.questions?.[gs.currentMatch.currentQIdx] || null;
  }

  // Called by MatchScreen when player submits (or timer runs out).
  // selectedOptions: number[] for click-based types; typedInputs: string[] for text types.
  function lockIn(selectedOptions = [], typedInputs = []) {
    const cm = gs.currentMatch;
    if (!cm || cm.phase === 'revealed') return;
    const q     = currentQ();
    if (!q) return;
    const qtype = q.type || 'multi_select';
    let correct;

    if (qtype === 'typed' || qtype === 'fill_gap') {
      const matched = qtype === 'typed'
        ? scoreTypedInputs(q, typedInputs)
        : scoreFillGapInputs(q, typedInputs);
      const required = qtype === 'typed' ? (q.required_count ?? q.answers.length ?? 1) : (q.answers || []).length;
      correct = matched.size >= required;
    } else {
      const sel = new Set(selectedOptions);
      const ans = new Set(q.answers);
      correct = sel.size === ans.size && [...sel].every(i => ans.has(i));
    }

    cm.phase             = 'revealed';
    cm.lastAnswerCorrect = correct;

    const qid       = q.id || q.question;
    const baseTier  = q._tier || q.difficulty || 'medium';
    const effBefore = effectiveTier(gs._qScores, qid, baseTier);
    if (qid) updateQScore(gs._qScores, qid, correct);
    const effAfter  = effectiveTier(gs._qScores, qid, baseTier);
    if (effBefore !== effAfter) {
      cm.tierChanges = cm.tierChanges || [];
      cm.tierChanges.push({ base: baseTier, from: effBefore, to: effAfter });
    }

    // Fire-and-forget progress report — never blocks game flow
    if (userId) {
      const setMeta = buildSetMeta(gs.activeModId);
      if (setMeta) logAnswer(userId, q, setMeta, 'football', correct ? 1 : 0, correct ? 1 : 0, 1);
    }

    resolveMatchQuestion(correct, cm, q);
    save();
  }

  function resolveMatchQuestion(correct, cm, q) {
    const oppRow = getTableRow(cm.opponentId, gs.table.div1, gs.table.div2);
    const pEff   = gs.club.rating + (cm.isHome ? 3 : 0);
    const oEff   = (oppRow?.rating || 60) + (cm.isHome ? 0 : 3);
    const conv   = clamp(0.50 + (pEff - oEff) / 100, 0.15, 0.90);

    if (correct) {
      const cand    = pickScorer();
      const scored  = Math.random() < conv;
      const minute  = pickMinute(cm);
      if (scored) {
        cand.goalsThisSeason++;
        cand.goalsCareer++;
        cm.playerGoals++;
        cm.goalScorers.push({ name: cand.name, minute, isPlayer: true });
      }
      cm.lastNarrative = { playerName: cand.name.split(' ').pop(), scored, wasPlayerPhase: true };
    } else {
      const name   = randomName();
      const scored = Math.random() < (1 - conv);
      const minute = pickMinute(cm);
      if (scored) {
        cm.oppGoals++;
        cm.goalScorers.push({ name, minute, isPlayer: false });
      }
      cm.lastNarrative = { playerName: name.split(' ').pop(), scored, wasPlayerPhase: false };
    }
  }

  function pickScorer() {
    const starters = gs.squad.filter(p => p.status === 'Starter' && p.position !== 'GK');
    if (!starters.length) return gs.squad[0];
    const r = Math.random();
    const pool = r < 0.70 ? starters.filter(p => p.position === 'FWD') || starters
               : r < 0.90 ? starters.filter(p => p.position === 'MID') || starters
               : starters.filter(p => p.position === 'DEF') || starters;
    const actual = (pool.length ? pool : starters);
    return actual[Math.floor(Math.random() * actual.length)];
  }

  function pickMinute(cm) {
    const n   = cm.questions.length || 1;
    const seg = 90 / n;
    const lo  = Math.round(cm.currentQIdx * seg) + 1;
    const hi  = Math.round((cm.currentQIdx + 1) * seg);
    const used = new Set(cm.goalScorers.map(g => g.minute));
    let m, tries = 0;
    do { m = randInt(lo, hi); tries++; } while (used.has(m) && tries < 20);
    return m;
  }

  function nextQuestion() {
    const cm = gs.currentMatch;
    if (!cm) return;
    cm.currentQIdx++;
    if (cm.currentQIdx >= cm.questions.length) {
      finaliseMatch();
      return;
    }
    cm.phase           = 'answering';
    cm.selectedOptions = [];
    cm._typedInputs    = [];
    // Timer is restarted by MatchScreen's $effect on currentQIdx
  }

  /* ── Match finalisation ──────────────────────────────── */
  function finaliseMatch() {
    const cm = gs.currentMatch;
    if (!cm) { gs.screen = 'hub'; return; }

    const result = cm.playerGoals > cm.oppGoals ? 'W' : cm.playerGoals < cm.oppGoals ? 'L' : 'D';
    const tbl    = gs.table[`div${gs.division}`];

    // Update table rows
    const plRow  = getTableRow('player', gs.table.div1, gs.table.div2);
    const oppRow = getTableRow(cm.opponentId, gs.table.div1, gs.table.div2);
    if (plRow)  updateTableRow(plRow,  cm.playerGoals, cm.oppGoals);
    if (oppRow) updateTableRow(oppRow, cm.oppGoals,    cm.playerGoals);

    // Form
    gs.form.push(result);
    if (gs.form.length > 5) gs.form.shift();

    // Mark fixture played
    const mdIdx = gs.matchday - 1;
    const md    = gs.fixtures?.[`div${gs.division}`]?.[mdIdx];
    if (md) {
      const pm = md.matches.find(m => m.homeId === 'player' || m.awayId === 'player');
      if (pm) {
        pm.played = true;
        pm.hg = cm.isHome ? cm.playerGoals : cm.oppGoals;
        pm.ag = cm.isHome ? cm.oppGoals    : cm.playerGoals;
      }
    }

    // Simulate all remaining NPC matches for this matchday
    const tm = tableMap();
    simulateMatchday(gs.fixtures[`div${gs.division}`], mdIdx, tm);

    // Update team rating & career
    gs.club.rating = calcTeamRating(gs.squad);
    if (plRow) plRow.rating = gs.club.rating;

    gs.career.totalGoals = (gs.career.totalGoals || 0) + cm.playerGoals;
    if (result === 'W')      gs.career.wins   = (gs.career.wins   || 0) + 1;
    else if (result === 'D') gs.career.draws  = (gs.career.draws  || 0) + 1;
    else                     gs.career.losses = (gs.career.losses || 0) + 1;

    // Player IP (improvement points)
    const cleanSheet = cm.oppGoals === 0;
    const starterIds = new Set(gs.squad.filter(p => p.status === 'Starter').map(p => p.id));
    gs.squad.forEach(p => {
      if (!p.improvementPoints) p.improvementPoints = 0;
      const played = starterIds.has(p.id);
      if (played) p.improvementPoints += 1;
      if (cleanSheet && played) {
        if (p.position === 'GK')       p.improvementPoints += 4;
        else if (p.position === 'DEF') p.improvementPoints += 3;
        else if (p.position === 'MID') p.improvementPoints += 1;
      }
      if (result === 'W') p.improvementPoints += 1;
      if (result === 'L') p.improvementPoints -= 1;
    });
    cm.goalScorers.filter(g => g.isPlayer).forEach(g => {
      const scorer = gs.squad.find(p => p.name === g.name);
      if (scorer) scorer.improvementPoints = (scorer.improvementPoints || 0) + 5;
    });

    gs.squad.forEach(p => applyIPUpgrades(p, gs.matchdays));
    gs.squad.forEach(p => {
      if (p.improvementPoints < 0) {
        p.rating = Math.max(40, p.rating - 1);
        p.improvementPoints = -1;
      }
    });

    gs.club.rating = calcTeamRating(gs.squad);
    if (plRow) plRow.rating = gs.club.rating;

    cm.phase   = 'matchreport';
    cm._result = result;
    save();
    gs.screen  = 'matchreport';
  }

  /* ── Advance matchday ────────────────────────────────── */
  function advanceMatchday() {
    gs.currentMatch = null;
    if (gs.matchday >= gs.matchdays) {
      save();
      beginEndOfSeason();
      return;
    }
    gs.matchday++;
    save();
    gs.screen = 'hub';
  }

  /* ── End of season ───────────────────────────────────── */
  function beginEndOfSeason() {
    const div1Sorted = sortTable(gs.table.div1);
    const div2Sorted = sortTable(gs.table.div2);
    const playerDiv  = gs.division;

    let finishPos, status = 'safe';
    if (playerDiv === 1) {
      finishPos = div1Sorted.findIndex(r => r.id === 'player') + 1;
      const rel = relegationCount(div1Sorted.length);
      if (finishPos > div1Sorted.length - rel) status = 'relegated';
    } else {
      finishPos = div2Sorted.findIndex(r => r.id === 'player') + 1;
      const rel = relegationCount(div2Sorted.length);
      if (finishPos <= rel) status = 'promoted';
    }

    gs.career.seasonsPlayed = (gs.career.seasonsPlayed || 0) + 1;
    if (playerDiv === 1 && finishPos === 1) gs.career.championships = (gs.career.championships || 0) + 1;
    if (playerDiv === 1 && (!gs.career.highestDiv1Finish || finishPos < gs.career.highestDiv1Finish))
      gs.career.highestDiv1Finish = finishPos;
    if (playerDiv === 2 && (!gs.career.highestDiv2Finish || finishPos < gs.career.highestDiv2Finish))
      gs.career.highestDiv2Finish = finishPos;

    // Awards (computed on the season just finished, before reset)
    const maxGs          = Math.max(0, ...gs.squad.map(p => p.goalsThisSeason));
    const topScorer      = maxGs > 0 ? gs.squad.find(p => p.goalsThisSeason === maxGs) : null;
    const topScorerSnap  = topScorer ? { name: topScorer.name, goals: topScorer.goalsThisSeason, position: topScorer.position } : null;
    const playerOfSeason = [...gs.squad].sort((a,b) => b.rating - a.rating)[0];
    const potmSnap       = playerOfSeason ? { name: playerOfSeason.name, rating: playerOfSeason.rating, position: playerOfSeason.position } : null;

    // Player development: apply IP upgrades + age decline, capturing the change
    gs.squad.forEach(p => {
      applyIPUpgrades(p, gs.matchdays);
      const before = p.rating;
      if (p.age >= 35)      p.rating = Math.max(40, p.rating - 3);
      else if (p.age >= 30) p.rating = Math.max(40, p.rating - 1);
      p.ratingChangeThisSeason = (p.ratingChangeThisSeason || 0) + (p.rating - before);
      p.age++;
    });

    // Development snapshot — biggest movers (after upgrades/decline, before reset)
    const development = gs.squad
      .map(p => ({ name: p.name, position: p.position, age: p.age, rating: p.rating, change: p.ratingChangeThisSeason || 0 }))
      .filter(p => p.change !== 0)
      .sort((a, b) => b.change - a.change);

    // Retire aged 37+, replace with youth; record who left
    const retired = [];
    gs.squad.forEach((p, idx) => {
      if (p.age >= 37) {
        retired.push({ name: p.name, position: p.position, age: p.age, rating: p.rating });
        const repl = newPlayer(p.position, 45, 60);
        repl.age = 18;
        repl.improvementPoints = 0;
        repl.status = 'Rotation';
        gs.squad[idx] = repl;
      }
    });
    assignStatuses(gs.squad);

    resolvePromotionRelegation(gs.table.div1, gs.table.div2);
    if (status === 'relegated') gs.division = 2;
    if (status === 'promoted')  gs.division = 1;
    driftClubRatings(gs.table.div1, gs.table.div2);

    // Reset for new season
    [...gs.table.div1, ...gs.table.div2].forEach(r =>
      Object.assign(r, { pld:0, w:0, d:0, l:0, gf:0, ga:0, pts:0, form:[] })
    );
    gs.squad.forEach(p => { p.goalsThisSeason = 0; p.ratingChangeThisSeason = 0; });
    gs.season++;
    gs.matchday  = 1;
    gs.form      = [];

    gs.fixtures = {
      div1: generateFixtures(gs.table.div1, gs.returnFixtures),
      div2: generateFixtures(gs.table.div2, gs.returnFixtures),
    };

    gs.club.rating = calcTeamRating(gs.squad);
    const plRow = getTableRow('player', gs.table.div1, gs.table.div2);
    if (plRow) plRow.rating = gs.club.rating;

    // Snapshot final tables for the report (the season just played)
    const finalDiv1 = div1Sorted.map((r, i) => ({ pos: i + 1, name: r.name, id: r.id, pts: r.pts, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga }));
    const finalDiv2 = div2Sorted.map((r, i) => ({ pos: i + 1, name: r.name, id: r.id, pts: r.pts, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga }));

    // Store EOS data for the screen
    gs._eosData = {
      season: gs.season - 1, finishPos, finishDiv: playerDiv, status,
      topScorer: topScorerSnap, playerOfSeason: potmSnap,
      development, retired,
      finalDiv1, finalDiv2,
      newDivision: gs.division,
    };

    save();
    gs.screen = 'endofseason';
  }

  /* ── Reactive helpers for screens ────────────────────── */
  const divTable   = $derived(sortTable(currentDivTable()));
  const plRow      = $derived(divTable.find(r => r.id === 'player') || null);
  const playerPos  = $derived(divTable.findIndex(r => r.id === 'player') + 1);

</script>


<svelte:head>
  <title>Football Career Manager — McChimp</title>
  <meta name="description" content="Guide a club through the football pyramid. Tactics, transfers, league tables — all driven by knowledge." />
</svelte:head>

<!-- Back bar -->
<div class="back-bar">
  <a href="/games" class="back-btn">← Games</a>
  <span class="back-title">Football</span>
  {#if loggedIn}
    <a href="/account" class="back-login" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{displayName || 'Account'}</a>
  {:else}
    <a href="/auth/login" class="back-login">Login</a>
  {/if}
</div>

<!-- Game body -->
<div class="game-body">
  {#if gs.screen === 'menu'}
    <div class="screen-wrap">
      <MenuScreen
        oncontinue={savedInfo ? continueGame : undefined}
        {savedInfo}
        onstartsetup={() => gs.screen = 'career_setup'}
        onloadsave={onLoadsave}
        onsavedeleted={onSaveDeleted}
        {userId}
        {userTier}
      />
    </div>

  {:else if gs.screen === 'career_setup'}
    <div class="screen-wrap">
      <CareerSetupScreen
        onstartgame={startGame}
        onback={() => gs.screen = 'menu'}
      />
    </div>

  {:else if gs.screen === 'hub'}
    <HubScreen
      onsave={save}
      onplaymatch={goToPreMatch}
      onmenu={() => { clearSave(); returnToMenu(); }}
      onsaveandquit={saveAndExit}
      saving={savingExit}
      {saveError}
      onswitchmodule={(modId) => { rebuildPool(modId); save(); }}
    />

  {:else if gs.screen === 'prematch'}
    <div class="screen-wrap">
      <PreMatchScreen
        onkickoff={startMatch}
        onhub={() => gs.screen = 'hub'}
      />
    </div>

  {:else if gs.screen === 'match'}
    <MatchScreen
      onlockin={lockIn}
      onnext={nextQuestion}
    />

  {:else if gs.screen === 'matchreport'}
    <MatchReportScreen oncontinue={advanceMatchday} />

  {:else if gs.screen === 'endofseason'}
    <EndOfSeasonScreen oncontinue={() => { gs._eosData = null; gs.screen = 'hub'; }} />
  {/if}
</div>


<style>
  /* ── Layout ─────────────────────────────────────────── */
  :global(body.game-page) { overflow: hidden; }

  .back-bar {
    position: fixed; top: 0; left: 0; right: 0; height: 44px;
    background: rgba(10,10,10,.97); border-bottom: 1px solid rgba(255,255,255,.06);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 24px; z-index: 200; backdrop-filter: blur(12px);
  }
  .back-btn {
    font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase; color: var(--muted);
    text-decoration: none; transition: color .15s;
  }
  .back-btn:hover { color: var(--white); }
  .back-title { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: .06em; color: var(--white); }
  .back-login {
    font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase; color: var(--gold);
    border: 1px solid rgba(232,193,74,.4); padding: 5px 14px; border-radius: 2px;
    text-decoration: none; transition: background .2s;
  }
  .back-login:hover { background: rgba(232,193,74,.08); }

  .game-body { padding-top: 44px; height: 100vh; overflow-y: auto; background: #0a0a0c; }
  .screen-wrap { max-width: 560px; margin: 0 auto; padding: 0 16px; }

  /* ── League table ────────────────────────────────────── */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 20px; }
  .mb-16 { margin-bottom: 16px; }

  .section-label { font-size: 10px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }

  .league-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .league-table th { font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); }
  .league-table th.num { text-align: right; }
  .league-table td { padding: 9px 10px; border-bottom: 1px solid var(--surface2); font-variant-numeric: tabular-nums; }
  .league-table td.num { text-align: right; color: var(--text-dim); }
  .league-table tr:last-child td { border-bottom: none; }
  .league-table .pos { color: var(--muted); width: 28px; }
  .league-table .club-name { font-weight: 500; }
  :global(.league-table tr.player-row td) { color: var(--gold); background: rgba(212,168,71,.07); }
  .league-table .pts { color: var(--text); font-weight: 600; }
  .league-table .gd-pos { color: var(--green); }
  .league-table .gd-neg { color: var(--red); }

  /* ── Buttons ─────────────────────────────────────────── */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 10px 20px; border: none; border-radius: 3px;
    font-family: var(--font-body); font-size: 13px; font-weight: 600;
    letter-spacing: .06em; text-transform: uppercase; cursor: pointer;
    transition: opacity .15s; white-space: nowrap;
  }
  .btn:hover  { opacity: .85; }
  .btn:disabled { opacity: .35; cursor: not-allowed; }
  .btn-primary { background: var(--gold); color: #0a0a0c; }
  .btn-ghost   { background: transparent; color: var(--text-dim); border: 1px solid var(--border); }
  .btn-lg  { padding: 14px 32px; font-size: 15px; letter-spacing: .1em; }
  .btn-full { width: 100%; }
  .btn-sm  { padding: 6px 12px; font-size: 12px; }

  /* ── Result badge ────────────────────────────────────── */
  .result-badge {
    display: inline-block; padding: 4px 14px; border-radius: 3px;
    font-family: var(--font-display); font-size: 18px; letter-spacing: .08em;
    font-weight: 700;
  }
  .result-badge.win  { background: rgba(62,207,106,.15); color: var(--green); }
  .result-badge.draw { background: rgba(232,153,74,.15); color: var(--amber); }
  .result-badge.loss { background: rgba(224,82,82,.15);  color: var(--red);   }

  /* ── Match layout ────────────────────────────────────── */
  .match-layout {
    display: grid; grid-template-columns: 1fr 280px;
    height: calc(100vh - 44px); overflow: hidden;
  }
  .match-left {
    padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 0;
    border-right: 1px solid var(--border);
  }
  .match-right { padding: 20px; overflow-y: auto; }

  .match-progress { display: flex; gap: 4px; margin-bottom: 16px; }
  .pip { width: 100%; height: 4px; border-radius: 2px; background: var(--surface3); flex: 1; }
  .pip.done    { background: var(--green); }
  .pip.current { background: var(--gold); }

  .timer-wrap   { margin-bottom: 16px; }
  .timer-track  { height: 4px; background: rgba(255,255,255,.08); border-radius: 2px; overflow: hidden; margin-bottom: 4px; }
  .timer-fill   { height: 100%; border-radius: 2px; transition: width .08s linear, background .3s; }
  .timer-label  { font-family: var(--font-display); font-size: 13px; color: var(--muted); }

  .inline-score { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 12px 16px; margin-bottom: 16px; }
  .inline-score-digits { font-family: var(--font-display); font-size: 28px; letter-spacing: .04em; }
  .inline-score-clubs  { font-size: 11px; color: var(--muted); display: flex; gap: 16px; margin-top: 2px; }
  .narrative { font-size: 12px; color: var(--text-dim); margin-top: 8px; font-style: italic; }

  .diff-badge { display: inline-block; padding: 2px 7px; border-radius: 2px; font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px; }

  .question-text { font-size: 18px; font-weight: 500; line-height: 1.5; margin-bottom: 6px; }
  .question-hint { font-size: 12px; color: var(--muted); margin-bottom: 16px; font-style: italic; }

  .options    { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
  .options-tf { flex-direction: row; }
  .option-btn {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 3px;
    color: var(--text); font-family: var(--font-body); font-size: 14px; font-weight: 500;
    padding: 12px 14px; text-align: left; cursor: pointer;
    transition: border-color .12s, background .12s;
    display: flex; align-items: center; gap: 10px; width: 100%;
  }
  .option-btn:hover:not(:disabled) { border-color: var(--gold-dim); }
  .option-btn:disabled { cursor: default; }
  .option-btn.selected        { border-color: var(--gold); background: rgba(212,168,71,.1); }
  .option-btn.reveal-correct  { border-color: var(--green); background: rgba(62,207,106,.1); }
  .option-btn.reveal-wrong    { border-color: var(--red);   background: rgba(224,82,82,.1); }
  .option-btn.reveal-missed   { border-color: var(--amber); background: rgba(232,153,74,.1); }
  .opt-label { font-family: var(--font-display); font-size: 13px; color: var(--muted); min-width: 18px; flex-shrink: 0; }
  .opt-text  { flex: 1; }
  .opt-check { margin-left: auto; width: 16px; height: 16px; border: 1px solid var(--border); border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; }
  .option-btn.selected .opt-check { background: var(--gold); border-color: var(--gold); color: #0a0a0c; }
  .tf-btn { flex: 1; justify-content: center; font-size: 20px; padding: 20px 14px; font-family: var(--font-display); letter-spacing: .06em; }

  .typed-inputs { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
  .typed-row    { display: flex; align-items: center; gap: 10px; }
  .typed-num    { font-family: var(--font-display); font-size: 16px; color: var(--muted); min-width: 20px; }
  .typed-field  {
    flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 3px;
    color: var(--text); font-family: var(--font-body); font-size: 15px; padding: 10px 14px; outline: none;
    transition: border-color .15s;
  }
  .typed-field:focus { border-color: var(--gold); }
  .typed-field:disabled { opacity: .7; }
  .typed-row.typed-correct .typed-field { border-color: var(--green); background: rgba(62,207,106,.1); }
  .typed-row.typed-wrong   .typed-field { border-color: var(--red);   background: rgba(224,82,82,.1); }
  .typed-accepted { font-size: 11px; color: var(--muted); margin-top: 6px; font-style: italic; }

  .fill-gap-wrap     { margin-bottom: 16px; }
  .fill-gap-sentence { font-size: 17px; font-weight: 500; line-height: 2.4; }
  .gap-text          { vertical-align: middle; }
  .gap-input-wrap    { display: inline-block; vertical-align: middle; margin: 0 4px; }
  .gap-field {
    background: transparent; border: none; border-bottom: 2px solid var(--gold);
    color: var(--text); font-family: var(--font-body); font-size: 16px; font-weight: 600;
    padding: 2px 6px; outline: none; width: 130px; text-align: center; transition: border-color .15s;
  }
  .gap-field:focus { background: rgba(212,168,71,.08); }
  .gap-field:disabled { opacity: .8; }
  .gap-input-wrap.gap-correct .gap-field { border-color: var(--green); background: rgba(62,207,106,.1); }
  .gap-input-wrap.gap-wrong   .gap-field { border-color: var(--red);   background: rgba(224,82,82,.1); }
  .gap-input-wrap.gap-missed  .gap-field { border-color: var(--amber); }

  .explanation { background: var(--surface2); border: 1px solid var(--border); border-radius: 3px; padding: 12px 14px; font-size: 13px; color: var(--text-dim); line-height: 1.6; margin-bottom: 16px; }

  .scoreline-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 16px; margin-bottom: 16px; text-align: center; }
  .scoreline-label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
  .scoreline-score { font-family: var(--font-display); font-size: 42px; letter-spacing: .04em; }
  .scoreline-clubs { font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; margin-top: 4px; }

  @media (max-width: 768px) {
    .match-layout { grid-template-columns: 1fr; }
    .match-right  { display: none; }
  }
</style>

