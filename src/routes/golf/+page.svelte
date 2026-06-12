<!-- src/routes/golf/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import { supabase } from '$lib/supabase.js';
  import { fetchSet, fetchPublicCatalog } from '$lib/questions.js';
  import { createSave, updateSave, loadAllSaves, deleteSave, archiveCareer, loadPastCareers } from '$lib/saves.js';
  import { logAnswer } from '$lib/progress.js';

  import { state as gs } from '$lib/golf/state.svelte.js';
  import {
    saveGame, loadGame, peekSave, clearSave, clearRound, loadCareer,
    newCareer, DEFAULT_AVATAR, exportSave, importSave, saveLabel,
  } from '$lib/golf/saves.js';
  import { computeHandicap, scoreDifferential, MAX_DIFFERENTIALS } from '$lib/golf/handicap.js';
  import {
    buildPool, selectShotQuestion, scoreQuestion, scoreTypedInputs,
    scoreFillGapInputs, updateQScore, effectiveTier, bumpTier, qidOf,
  } from '$lib/golf/questions.js';
  import { HOLES, buildHoleOrder } from '$lib/golf/holes.js';
  import { buildGrid } from '$lib/golf/terrain.js';
  import {
    resolveShot, suggestClub, angleToPin, yardsToPin, lieOf,
  } from '$lib/golf/physics.js';
  import { restoreActiveModule } from '$lib/golf/modules.js';
  import { CLUB_BY_ID, PHYS, MAX_STROKES_OVER_PAR, parLabel, toParStr } from '$lib/golf/constants.js';

  import MenuScreen         from '$lib/golf/screens/MenuScreen.svelte';
  import RoundSetupScreen   from '$lib/golf/screens/RoundSetupScreen.svelte';
  import CareerCreateScreen from '$lib/golf/screens/CareerCreateScreen.svelte';
  import CareerHubScreen    from '$lib/golf/screens/CareerHubScreen.svelte';
  import HoleScreen         from '$lib/golf/screens/HoleScreen.svelte';
  import ScorecardScreen    from '$lib/golf/screens/ScorecardScreen.svelte';
  import RoundEndScreen     from '$lib/golf/screens/RoundEndScreen.svelte';
  import PastRoundsScreen   from '$lib/golf/screens/PastRoundsScreen.svelte';

  // ── Back bar auth ─────────────────────────────────────
  let displayName = $state('');
  let loggedIn    = $state(false);
  let userId      = $state(null);
  let userTier    = $state('regular');

  // ── Save state ────────────────────────────────────────
  let saveError   = $state(null);
  let savingExit  = $state(false);
  let pastRounds  = $state([]);
  let newHistoryId = $state(null);

  // ── Round setup intent (drives RoundSetupScreen) ──────
  let setupIntent    = $state('simple');   // 'simple' | 'career_ranked' | 'career_practice'
  let setupLockHoles = $state(null);       // fixed hole count for career flows

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
    // NOTE: this callback must NOT be async and must NOT await Supabase calls
    // directly — doing so holds the auth lock and deadlocks later DB queries
    // (e.g. saveToCloud), which manifested as Save & Quit hanging on "Saving…".
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, sess) => {
      if (sess) {
        loggedIn = true;
        userId   = sess.user.id;
        supabase.from('profiles').select('display_name, tier').eq('id', sess.user.id).single()
          .then(({ data }) => { if (data) { displayName = data.display_name; userTier = data.tier || 'regular'; } });
      } else { loggedIn = false; displayName = ''; userId = null; userTier = 'regular'; }
    });

    await loadModules();

    // Restore: prefer localStorage; fall back to most recent cloud save
    const hasLocal = loadGame(gs);
    if (hasLocal && gs.round) {
      await restorePool();
      gs.screen = gs.currentHole ? 'hole' : 'scorecard';
    } else if (hasLocal && gs.mode === 'career' && gs.career) {
      // Idle career (saved & exited between rounds).
      gs.screen = 'career_hub';
    } else {
      gs.career = gs.career || loadCareer() || null;
      if (userId) {
        try {
          const dbSaves = await loadAllSaves(userId, 'golf');
          if (dbSaves.length > 0) {
            cloudContinueSave = dbSaves[0];
            savedInfo = cloudSavedInfo(cloudContinueSave);
          }
        } catch (e) {
          console.warn('[golf] cloud save check on mount failed', e);
        }
      }
    }
    if (userId) refreshPastRounds();

    return () => {
      document.body.classList.remove('game-page');
      subscription.unsubscribe();
    };
  });

  /* ── Module loading ──────────────────────────────────── */
  const GOLF_DEFAULTS = ['golf_questions.json', 'animal_facts.json'];

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
            tag: GOLF_DEFAULTS.includes(fname) ? undefined : 'public',
          };
        } catch { return null; }
      }));
      const valid = sets.filter(Boolean);
      gs.availableModules = valid;
      valid.forEach(m => { gs.loadedModules[m.id] = m; });
    } catch(e) {
      console.warn('[golf] loadModules failed', e);
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
  // Re-resolve the saved module (library/group sets are re-fetched), then build
  async function restorePool() {
    const modId = await restoreActiveModule(gs);
    if (modId) rebuildPool(modId);
  }

  function rebuildPool(modId) {
    const mod = gs.loadedModules[modId];
    if (!mod) return;
    const { pool, byId } = buildPool(mod);
    gs._qPool  = pool;
    gs._qById  = byId;
    gs._qUsed  = [];
    gs.activeModId = modId;
  }

  /* ── Terrain grid cache (per hole layout) ────────────── */
  const gridCache = {};
  function gridFor(layout) {
    if (!gridCache[layout.num]) gridCache[layout.num] = buildGrid(layout);
    return gridCache[layout.num];
  }
  function layoutOf(ch) {
    return HOLES.find(h => h.num === ch.holeNum);
  }

  /* ── Save ────────────────────────────────────────────── */
  function save() { saveGame(gs); }

  function golfSaveLimit() {
    return (userTier === 'pro' || userTier === 'dev') ? 20 : 5;
  }

  async function saveToCloud() {
    if (!userId) return false;
    // Careers can save between rounds (no active round); simple games need a round.
    if (!gs.round && !(gs.mode === 'career' && gs.career)) return false;
    try {
      const blob = exportSave(gs);
      if (gs.saveId) {
        await updateSave(gs.saveId, blob, saveLabel(gs));
      } else {
        const existing = await loadAllSaves(userId, 'golf');
        const limit    = golfSaveLimit();
        if (existing.length >= limit) {
          // Evict the oldest unstarred *simple* game first — careers are protected.
          const oldest = existing.filter(s => !s.starred && s.save_data?.mode !== 'career').pop();
          if (!oldest) {
            saveError = 'Save limit reached. Delete or un-star a saved game to make room.';
            return false;
          }
          await deleteSave(oldest.id);
        }
        const id = await createSave(userId, 'golf', blob, saveLabel(gs));
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

  async function onLoadsave(saveId, blob) {
    if (!importSave(gs, blob)) return;
    gs.saveId = saveId;
    await restorePool();
    saveGame(gs);
    savedInfo = peekSave();
    gs.screen = resumeScreen();
  }

  // Where to land after loading/continuing a game.
  function resumeScreen() {
    if (gs.currentHole) return 'hole';
    if (gs.round) return 'scorecard';
    if (gs.mode === 'career' && gs.career) return 'career_hub';
    return 'menu';
  }

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
      save(); // local save always happens first — exiting is safe even if the cloud write stalls
      if (userId) {
        // Guard against a stalled network/cloud request leaving the player
        // stuck on "Saving…": if it doesn't finish in time, exit anyway.
        const ok = await Promise.race([
          saveToCloud(),
          new Promise(res => setTimeout(() => res('timeout'), 8000)),
        ]);
        if (ok === 'timeout') saveError = 'Cloud save timed out — your round is saved locally.';
        else if (!ok) return;
      }
      returnToMenu();
    } finally {
      savingExit = false;
    }
  }

  function returnToMenu() {
    // Purge active game from memory — localStorage retains it for Continue.
    gs.course      = null;
    gs.round       = null;
    gs.currentHole = null;
    gs.career      = null;
    gs.mode        = 'simple';
    gs._qPool      = null;
    gs._qById      = null;
    gs._qUsed      = [];
    gs.saveId      = null;
    cloudContinueSave = null;
    savedInfo = peekSave();
    gs.screen = 'menu';
  }

  /* ── Continue (from menu) ────────────────────────────── */
  let savedInfo         = $state(peekSave());
  let cloudContinueSave = $state(null);

  function cloudSavedInfo(row) {
    const d = row?.save_data;
    if (!d) return null;
    if (d.mode === 'career' && d.career) {
      return {
        mode: 'career',
        careerName: d.career.name,
        handicap: d.career.handicap ?? null,
        idle: !d.round,
        holeNum: d.currentHole?.displayNum ?? (d.round ? d.round.holeIdx + 1 : null),
        toPar: d.round?.toPar ?? 0,
      };
    }
    if (!d.round) return null;
    return {
      mode: 'simple',
      courseName: d.course?.name || 'Round',
      holeCount:  d.course?.holeCount ?? 9,
      holeNum:    d.currentHole?.displayNum ?? (d.round.holeIdx + 1),
      toPar:      d.round?.toPar ?? 0,
    };
  }

  async function continueGame() {
    if (peekSave()) {
      if (loadGame(gs)) {
        await restorePool();
        gs.screen = resumeScreen();
      }
    } else if (cloudContinueSave) {
      if (importSave(gs, cloudContinueSave.save_data)) {
        gs.saveId = cloudContinueSave.id;
        await restorePool();
        saveGame(gs);
        cloudContinueSave = null;
        savedInfo = peekSave();
        gs.screen = resumeScreen();
      }
    }
  }

  /* ── Career entry points ─────────────────────────────── */
  function startNewCareer() {
    gs.mode   = 'career';
    gs.career = null;             // created on confirm in createCareer()
    gs.round  = null;
    gs.course = null;
    gs.currentHole = null;
    gs.saveId = null;
    gs.screen = 'career_create';
  }

  async function createCareer({ name, avatar }) {
    clearRound();
    gs.mode   = 'career';
    gs.career = newCareer({ name, avatar });
    gs.round  = null;
    gs.course = null;
    gs.currentHole = null;
    gs.saveId = null;
    save();
    if (userId) await saveToCloud();   // claim a cloud slot up front
    gs.screen = 'career_hub';
  }

  function startQuickRound() {
    setupIntent    = 'simple';
    setupLockHoles = null;
    gs.screen = 'round_setup';
  }

  function careerPlayNext() {
    setupIntent    = 'career_ranked';
    setupLockHoles = 18;
    gs.screen = 'round_setup';
  }

  function careerPractice(holeCount) {
    setupIntent    = 'career_practice';
    setupLockHoles = holeCount;
    gs.screen = 'round_setup';
  }

  async function careerSaveExit() {
    if (savingExit) return;
    savingExit = true;
    try {
      save();
      if (userId) {
        const ok = await Promise.race([
          saveToCloud(),
          new Promise(res => setTimeout(() => res('timeout'), 8000)),
        ]);
        if (ok === 'timeout') saveError = 'Cloud save timed out — your career is saved locally.';
        else if (!ok) return;
      }
      returnToMenu();
    } finally {
      savingExit = false;
    }
  }

  async function backToHub() {
    // Round finished — clear the round but keep the career, then persist it.
    gs.round       = null;
    gs.course      = null;
    gs.currentHole = null;
    gs._qPool      = null;
    gs._qById      = null;
    gs._qUsed      = [];
    save();
    if (userId) await saveToCloud();
    gs.screen = 'career_hub';
  }

  /* ── New round ───────────────────────────────────────── */
  function startRound({ holeCount, modId, intent = 'simple' }) {
    const isCareer = intent !== 'simple';
    const practice = intent === 'career_practice';

    clearRound();
    if (isCareer) {
      gs.mode = 'career';
      // keep gs.career and gs.saveId (the round lives inside the career slot)
    } else {
      gs.mode   = 'simple';
      gs.career = null;
      gs.saveId = null;
    }

    gs.course = { name: 'Pixel Pines', holeCount };
    // Shuffled hole order so no map repeats within a nine (#12).
    gs.round  = { holeIdx: 0, scorecard: [], totalStrokes: 0, totalPar: 0, toPar: 0,
                  holeOrder: buildHoleOrder(holeCount), practice };

    rebuildPool(modId);
    startHole(0);
    save();
    gs.screen = 'hole';
  }

  function startHole(holeIdx) {
    // Use the round's shuffled order; fall back to sequential for legacy saves.
    const order = gs.round.holeOrder;
    const layoutIdx = order ? order[holeIdx] : (holeIdx % HOLES.length);
    const layout = HOLES[layoutIdx];
    gs.currentHole = {
      holeNum:    layout.num,
      displayNum: holeIdx + 1,
      ball:       [...layout.tee],
      lie:        'tee',
      strokes:    0,
      penalties:  0,
      phase:      'overview',
      pending:    null,
      aim:        null,
      power:      0,
      lastShot:   null,
      shotAnim:   null,
    };
  }

  /* ── Per-stroke flow ─────────────────────────────────── */

  // Base difficulty mix for a normal lie
  function pickBaseTier() {
    const r = Math.random();
    if (r < 0.30) return 'easy';
    if (r < 0.75) return 'medium';
    if (r < 0.95) return 'hard';
    return 'elite';
  }

  function beginStroke() {
    const ch = gs.currentHole;
    if (!ch) return;
    const layout = layoutOf(ch);

    // Situational difficulty bumps
    let target = pickBaseTier();
    let bumped = null;
    if (ch.lie === 'sand') {
      target = bumpTier(target, 1);
      bumped = 'Bunker lie — harder question';
    } else if (ch.lastShot?.events?.includes('water')) {
      target = bumpTier(target, 1);
      bumped = 'Recovering from water — harder question';
    } else if (PHYS.LONG_PUTT_BUMP && ch.lie === 'green' && yardsToPin(ch.ball, layout) > PHYS.LONG_PUTT_YD) {
      target = bumpTier(target, 1);
      bumped = 'Long putt — harder question';
    }

    const q = selectShotQuestion(gs._qPool || {}, gs._qScores, gs._qUsed, target);
    if (!q) return; // no questions loaded — stay put
    const qid = qidOf(q);
    gs._qUsed = [...gs._qUsed, qid].slice(-30);

    ch.pending = {
      q,
      tier: effectiveTier(gs._qScores, qid, q._tier || 'medium'),
      bumped,
      ratio: null, correct: null, score: 0, maxPts: 0,
      selected: [], typed: [],
    };
    ch.lastShot = null;
    ch.phase = 'question';
  }

  // Blind lock-in: evaluate, stash, do NOT reveal.
  // answerSpeed = fraction of the timer used (0 = instant, 1 = buzzer).
  function lockAnswer(selectedOptions = [], typedInputs = [], answerSpeed = 1) {
    const ch = gs.currentHole;
    if (!ch?.pending?.q || ch.phase !== 'question') return;
    const q = ch.pending.q;
    const qtype = q.type || 'multi_select';

    let selectedSet;
    if (qtype === 'typed' || qtype === 'fill_gap') {
      selectedSet = qtype === 'typed'
        ? scoreTypedInputs(q, typedInputs)
        : scoreFillGapInputs(q, typedInputs);
    } else {
      selectedSet = new Set(selectedOptions);
    }

    const { score, maxPts, ratio } = scoreQuestion(q, selectedSet);
    const correct = ratio >= 1;

    Object.assign(ch.pending, {
      ratio, correct, score, maxPts,
      answerSpeed,
      selected: [...selectedOptions],
      typed: [...typedInputs],
    });

    const qid = qidOf(q);
    if (qid) updateQScore(gs._qScores, qid, correct);

    // Fire-and-forget progress report — real fractional ratio (partial credit counts)
    if (userId) {
      const setMeta = buildSetMeta(gs.activeModId);
      if (setMeta) logAnswer(userId, q, setMeta, 'golf', ratio, score, maxPts);
    }

    // Default aim: straight at the pin, sensible club
    const layout = layoutOf(ch);
    const dYd = yardsToPin(ch.ball, layout);
    ch.aim = {
      angle:  angleToPin(ch.ball, layout),
      clubId: suggestClub(dYd, ch.lie).id,
    };
    ch.phase = 'aim';
  }

  function aimChange(angle)   { if (gs.currentHole?.aim) gs.currentHole.aim.angle = angle; }
  function clubChange(clubId) { if (gs.currentHole?.aim) gs.currentHole.aim.clubId = clubId; }
  function lockAim()          { if (gs.currentHole) gs.currentHole.phase = 'power'; }
  function backToAim()        { if (gs.currentHole) gs.currentHole.phase = 'aim'; }

  let _animCounter = 0;

  function powerLocked(value) {
    const ch = gs.currentHole;
    if (!ch?.pending || ch.phase !== 'power') return;
    const layout = layoutOf(ch);
    const club = CLUB_BY_ID[ch.aim.clubId];

    ch.power = value;
    const res = resolveShot({
      ball:        [...ch.ball],
      aimAngle:    ch.aim.angle,
      power:       value,
      club,
      ratio:       ch.pending.ratio ?? 0,
      lie:         ch.lie,
      grid:        gridFor(layout),
      hole:        layout,
      answerSpeed: ch.pending.answerSpeed ?? 1,
    });

    ch.lastShot = {
      events:         res.events,
      travelYd:       res.travelYd,
      errDeg:         res.errDeg,
      duffed:         res.duffed,
      wild:           res.wild,
      holed:          res.holed,
      penaltyStrokes: res.penaltyStrokes,
      rest:           res.rest,
      restLie:        res.restLie,
    };
    ch.shotAnim = { path: res.path, id: ++_animCounter };
    ch.phase = 'flight';
  }

  function flightDone() {
    const ch = gs.currentHole;
    if (!ch?.lastShot || ch.phase !== 'flight') return;
    const layout = layoutOf(ch);
    const ls = ch.lastShot;

    ch.strokes   += 1 + ls.penaltyStrokes;
    ch.penalties += ls.penaltyStrokes;
    ch.ball       = [...ls.rest];
    ch.lie        = ls.restLie;
    ch.shotAnim   = null;

    if (ls.holed) {
      // Stay on the course so the celebration plays; the player taps
      // "Wrap Up the Hole" to bank the score.
      ch.phase = 'result';
      save();
      return;
    }
    // Pick-up rule: cap a disastrous hole
    if (ch.strokes >= layout.par + MAX_STROKES_OVER_PAR) {
      finishHole(true);
      return;
    }
    ch.phase = 'result';
    save();
  }

  function nextStroke() {
    beginStroke();
  }

  function wrapUpHole() {
    finishHole(false);
  }

  function finishHole(pickedUp = false) {
    const ch = gs.currentHole;
    const layout = layoutOf(ch);
    const strokes = pickedUp ? layout.par + MAX_STROKES_OVER_PAR : ch.strokes;

    gs.round.scorecard.push({
      num:     ch.displayNum,
      par:     layout.par,
      strokes,
      pickedUp,
    });
    gs.round.totalStrokes += strokes;
    gs.round.totalPar     += layout.par;
    gs.round.toPar        += strokes - layout.par;

    // Career hole tallies — ranked career rounds only (not practice / simple).
    if (gs.career && gs.mode === 'career' && !gs.round.practice) {
      const d = strokes - layout.par;
      if (strokes === 1)  gs.career.holesInOne++;
      else if (d <= -2)   gs.career.eagles++;
      else if (d === -1)  gs.career.birdies++;
      else if (d === 0)   gs.career.pars++;
      else                gs.career.bogeys++;
    }

    gs.currentHole = null;
    save();
    gs.screen = 'scorecard';
  }

  function scorecardContinue() {
    if (gs.round.holeIdx + 1 >= gs.course.holeCount) {
      finishRound();
      return;
    }
    gs.round.holeIdx++;
    startHole(gs.round.holeIdx);
    save();
    gs.screen = 'hole';
  }

  function roundVerdict(toPar) {
    if (toPar < 0)  return 'Under Par';
    if (toPar === 0) return 'Level Par';
    if (toPar <= 5) return 'Over Par';
    return 'Rough Day';
  }

  async function finishRound() {
    // Ranked career rounds count toward stats + handicap; practice never does.
    const counts      = gs.mode === 'career' && !gs.round.practice;
    // Simple games and ranked career rounds archive to Past Games; practice does not.
    const archiveThis = gs.mode === 'simple' || counts;

    if (counts && gs.career) {
      gs.career.roundsPlayed++;
      gs.career.totalStrokes += gs.round.totalStrokes;
      gs.career.totalHoles   += gs.course.holeCount;
      if (gs.career.bestToPar === null || gs.round.toPar < gs.career.bestToPar) {
        gs.career.bestToPar = gs.round.toPar;
      }
      const diff = scoreDifferential({ totalStrokes: gs.round.totalStrokes, totalPar: gs.round.totalPar });
      gs.career.differentials = [...(gs.career.differentials || []), diff].slice(-MAX_DIFFERENTIALS);
      gs.career.handicap = computeHandicap(gs.career.differentials);
    }
    save();

    // Archive the finished round into Past Games (career_history).
    if (userId && archiveThis) {
      const sc = gs.round.scorecard;
      const tally = { birdies: 0, pars: 0, bogeys: 0, eagles: 0, holesInOne: 0 };
      for (const h of sc) {
        const d = h.strokes - h.par;
        if (h.strokes === 1) tally.holesInOne++;
        else if (d <= -2) tally.eagles++;
        else if (d === -1) tally.birdies++;
        else if (d === 0)  tally.pars++;
        else if (d >= 1)   tally.bogeys++;
      }
      const isCareer = gs.mode === 'career' && gs.career;
      const statBreakdown = {
        holeCount:    gs.course.holeCount,
        totalStrokes: gs.round.totalStrokes,
        totalPar:     gs.round.totalPar,
        toPar:        gs.round.toPar,
        scorecard:    sc.map(h => ({ num: h.num, par: h.par, strokes: h.strokes })),
        ...tally,
        setName:      gs.loadedModules?.[gs.activeModId]?.name ?? null,
        career:       isCareer ? gs.career.name : null,
        handicap:     isCareer ? gs.career.handicap : null,
      };
      try {
        newHistoryId = await archiveCareer(userId, 'golf', {
          fighterName: isCareer
            ? `${gs.career.name} — ${gs.course.holeCount} Holes`
            : `${gs.course.holeCount} Holes · ${gs.course.name}`,
          finalRecord: `${toParStr(gs.round.toPar)} (${gs.round.totalStrokes})`,
          legacyTitle: roundVerdict(gs.round.toPar),
          highestOrg:  isCareer ? gs.career.name : gs.course.name,
          statBreakdown,
        });
      } catch (e) { console.warn('[golf] archive round failed', e); }
      refreshPastRounds();
    }

    // Simple games: drop the active cloud slot so it doesn't linger as a continue.
    // Careers: keep the slot — persisted as an idle career on return to the hub.
    if (userId && gs.mode === 'simple' && gs.saveId) {
      try { await deleteSave(gs.saveId); } catch (e) { console.warn('[golf] clear active save failed', e); }
      gs.saveId = null;
    }

    gs.screen = 'round_end';
  }

  async function refreshPastRounds() {
    if (!userId) return;
    try { pastRounds = await loadPastCareers(userId, 'golf'); }
    catch (e) { console.warn('[golf] loadPastRounds failed', e); }
  }

  function endToMenu() {
    clearRound();
    returnToMenu();
  }

  const inGame = $derived(gs.screen === 'hole');
</script>

<svelte:head>
  <title>Quiz Golf — McChimp</title>
  <meta name="description" content="Answer questions to hit your line. Aim, swing, and hole out in as few strokes as you can — knowledge is accuracy." />
  <link rel="stylesheet" href="/mma.css" />
</svelte:head>

<div class="golf-wrap" class:in-game={inGame}>
  <!-- Back bar -->
  <div class="back-bar">
    <a href="/games" class="back-link"><span class="back-arrow">←</span> Games</a>
    <a href="/" class="back-logo">Mc<span>Chimp</span></a>
    <div class="back-right">
      {#if loggedIn}
        <a href="/account" class="back-user">{displayName || 'Account'}</a>
      {:else}
        <a href="/auth/login" class="back-login">Login</a>
      {/if}
    </div>
  </div>

  {#if saveError && (gs.screen === 'hole' || gs.screen === 'scorecard' || gs.screen === 'career_hub')}
    <div class="save-error-banner">
      <span class="seb-text">{saveError}</span>
      <button class="seb-close" onclick={() => saveError = null}>✕</button>
    </div>
  {/if}

  <!-- Game body -->
  <div class="game-body">
    {#if gs.screen === 'menu'}
      <div class="screen-wrap">
        <MenuScreen
          oncontinue={(savedInfo || cloudContinueSave) ? continueGame : undefined}
          savedInfo={savedInfo || (cloudContinueSave ? cloudSavedInfo(cloudContinueSave) : null)}
          onstartcareer={startNewCareer}
          onquickround={startQuickRound}
          onpastrounds={() => gs.screen = 'past_rounds'}
          onloadsave={onLoadsave}
          onsavedeleted={onSaveDeleted}
          pastCount={pastRounds.length}
          {userId}
          {userTier}
        />
      </div>

    {:else if gs.screen === 'career_create'}
      <div class="screen-wrap">
        <CareerCreateScreen oncreate={createCareer} onback={() => gs.screen = 'menu'} />
      </div>

    {:else if gs.screen === 'career_hub'}
      <div class="screen-wrap">
        <CareerHubScreen
          career={gs.career}
          onplaynext={careerPlayNext}
          onpractice={careerPractice}
          onsaveexit={careerSaveExit}
          saving={savingExit}
        />
      </div>

    {:else if gs.screen === 'round_setup'}
      <div class="screen-wrap">
        <RoundSetupScreen
          onstartround={startRound}
          intent={setupIntent}
          lockHoles={setupLockHoles}
          onback={() => gs.screen = setupIntent === 'simple' ? 'menu' : 'career_hub'} />
      </div>

    {:else if gs.screen === 'past_rounds'}
      <div class="screen-wrap screen-wrap-wide">
        <PastRoundsScreen newId={newHistoryId} onback={() => { newHistoryId = null; gs.screen = 'menu'; }} />
      </div>

    {:else if gs.screen === 'hole'}
      <HoleScreen
        onbeginstroke={beginStroke}
        onlockanswer={lockAnswer}
        onaimchange={aimChange}
        onclubchange={clubChange}
        onlockaim={lockAim}
        onbacktoaim={backToAim}
        onpowerlocked={powerLocked}
        onflightdone={flightDone}
        onnextstroke={nextStroke}
        onwrapup={wrapUpHole}
        onsavequit={saveAndExit}
        saving={savingExit}
      />

    {:else if gs.screen === 'scorecard'}
      <div class="screen-wrap">
        <ScorecardScreen
          oncontinue={scorecardContinue}
          onsavequit={saveAndExit}
          onswitchmodule={(modId) => { rebuildPool(modId); save(); }}
          saving={savingExit}
        />
      </div>

    {:else if gs.screen === 'round_end'}
      <div class="screen-wrap">
        <RoundEndScreen
          onmenu={endToMenu}
          onhub={gs.mode === 'career' ? backToHub : null}
          onpastrounds={() => gs.screen = 'past_rounds'} />
      </div>
    {/if}
  </div>
</div>

<style>
  :global(body.game-page) { overflow: hidden; }

  .golf-wrap { width: 100%; display: flex; flex-direction: column; height: 100vh; height: 100dvh; background: var(--bg, #0d0d0f); color: var(--text, #f0ede6); }

  .back-bar {
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    padding: 10px 24px; background: rgba(10,10,10,.97);
    border-bottom: 1px solid rgba(255,255,255,.06); backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 200; flex-shrink: 0;
  }
  .back-link {
    font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 600;
    letter-spacing: .1em; text-transform: uppercase; color: rgba(242,239,232,.45);
    text-decoration: none; display: flex; align-items: center; gap: 8px; transition: color .15s;
  }
  .back-link:hover { color: #F2EFE8; }
  .back-arrow { font-size: 16px; line-height: 1; }
  .back-logo { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: .06em; color: #E8C14A; text-decoration: none; justify-self: center; }
  .back-logo span { color: #F2EFE8; opacity: .5; }
  .back-right { justify-self: end; }
  .back-user, .back-login {
    font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase; color: #E8C14A;
    text-decoration: none; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .back-login { border: 1px solid rgba(232,193,74,.4); padding: 5px 14px; border-radius: 2px; transition: background .2s; }
  .back-login:hover { background: rgba(232,193,74,.08); }

  .save-error-banner {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    font-size: 13px; color: var(--red, #e84a4a);
    background: rgba(232,74,74,.10); border: 1px solid rgba(232,74,74,.35);
    border-radius: var(--radius, 6px); padding: 10px 16px; margin: 12px 24px 0;
  }
  .seb-close { background: none; border: none; color: var(--red, #e84a4a); cursor: pointer; font-size: 14px; padding: 2px 6px; flex-shrink: 0; }

  .game-body { flex: 1; overflow-y: auto; min-height: 0; }
  .screen-wrap { max-width: 560px; margin: 0 auto; padding: 24px 16px 40px; }
  .screen-wrap-wide { max-width: 720px; }
</style>
