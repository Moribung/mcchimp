<!-- src/routes/golf/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import { supabase } from '$lib/supabase.js';
  import { fetchSet, fetchPublicCatalog } from '$lib/questions.js';
  import { createSave, updateSave, loadAllSaves, deleteSave } from '$lib/saves.js';
  import { logAnswer } from '$lib/progress.js';

  import { state as gs } from '$lib/golf/state.svelte.js';
  import {
    saveGame, loadGame, peekSave, clearSave, clearRound, loadCareer,
    freshCareer, exportSave, importSave, saveLabel,
  } from '$lib/golf/saves.js';
  import {
    buildPool, selectShotQuestion, scoreQuestion, scoreTypedInputs,
    scoreFillGapInputs, updateQScore, effectiveTier, bumpTier, qidOf,
  } from '$lib/golf/questions.js';
  import { HOLES } from '$lib/golf/holes.js';
  import { buildGrid } from '$lib/golf/terrain.js';
  import {
    resolveShot, suggestClub, angleToPin, yardsToPin, lieOf,
  } from '$lib/golf/physics.js';
  import { restoreActiveModule } from '$lib/golf/modules.js';
  import { CLUB_BY_ID, PHYS, MAX_STROKES_OVER_PAR, parLabel } from '$lib/golf/constants.js';

  import MenuScreen       from '$lib/golf/screens/MenuScreen.svelte';
  import RoundSetupScreen from '$lib/golf/screens/RoundSetupScreen.svelte';
  import HoleScreen       from '$lib/golf/screens/HoleScreen.svelte';
  import ScorecardScreen  from '$lib/golf/screens/ScorecardScreen.svelte';
  import RoundEndScreen   from '$lib/golf/screens/RoundEndScreen.svelte';

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

    await loadModules();

    // Restore: prefer localStorage; fall back to most recent cloud save
    const hasLocal = loadGame(gs);
    if (hasLocal && gs.round) {
      await restorePool();
      gs.screen = gs.currentHole ? 'hole' : 'scorecard';
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
    if (!userId || !gs.round) return false;
    try {
      const blob = exportSave(gs);
      if (gs.saveId) {
        await updateSave(gs.saveId, blob, saveLabel(gs));
      } else {
        const existing = await loadAllSaves(userId, 'golf');
        const limit    = golfSaveLimit();
        if (existing.length >= limit) {
          const oldest = existing.filter(s => !s.starred).pop();
          if (!oldest) {
            saveError = 'Save limit reached. Delete or un-star a round to make room.';
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
    gs.screen = gs.currentHole ? 'hole' : gs.round ? 'scorecard' : 'menu';
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
    // Purge active round from memory — localStorage retains it for Continue
    gs.course      = null;
    gs.round       = null;
    gs.currentHole = null;
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
    if (!d?.round) return null;
    return {
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
        gs.screen = gs.currentHole ? 'hole' : gs.round ? 'scorecard' : 'menu';
      }
    } else if (cloudContinueSave) {
      if (importSave(gs, cloudContinueSave.save_data)) {
        gs.saveId = cloudContinueSave.id;
        await restorePool();
        saveGame(gs);
        cloudContinueSave = null;
        savedInfo = peekSave();
        gs.screen = gs.currentHole ? 'hole' : gs.round ? 'scorecard' : 'menu';
      }
    }
  }

  /* ── New round ───────────────────────────────────────── */
  function startRound({ holeCount, modId }) {
    clearRound();
    gs.saveId = null;

    gs.course = { name: 'Pixel Pines', holeCount };
    gs.round  = { holeIdx: 0, scorecard: [], totalStrokes: 0, totalPar: 0, toPar: 0 };
    gs.career = gs.career || loadCareer() || freshCareer();

    rebuildPool(modId);
    startHole(0);
    save();
    gs.screen = 'hole';
  }

  function startHole(holeIdx) {
    const layout = HOLES[holeIdx % HOLES.length];
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
  function lockAnswer(selectedOptions = [], typedInputs = []) {
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
      ball:     [...ch.ball],
      aimAngle: ch.aim.angle,
      power:    value,
      club,
      ratio:    ch.pending.ratio ?? 0,
      lie:      ch.lie,
      grid:     gridFor(layout),
      hole:     layout,
    });

    ch.lastShot = {
      events:         res.events,
      travelYd:       res.travelYd,
      errDeg:         res.errDeg,
      duffed:         res.duffed,
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
      finishHole();
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

    // Career hole tallies
    if (gs.career) {
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

  async function finishRound() {
    if (gs.career) {
      gs.career.roundsPlayed++;
      gs.career.totalStrokes += gs.round.totalStrokes;
      gs.career.totalHoles   += gs.course.holeCount;
      if (gs.career.bestToPar === null || gs.round.toPar < gs.career.bestToPar) {
        gs.career.bestToPar = gs.round.toPar;
      }
    }
    save();
    if (userId && gs.saveId) {
      // Final cloud update so the slot shows the finished round
      try { await updateSave(gs.saveId, exportSave(gs), `${gs.course.holeCount} Holes — Final ${gs.round.toPar === 0 ? 'E' : gs.round.toPar > 0 ? '+' + gs.round.toPar : gs.round.toPar}`); }
      catch (e) { console.warn('[golf] final cloud save failed', e); }
    }
    gs.screen = 'round_end';
  }

  function endToMenu() {
    clearRound();
    returnToMenu();
  }
</script>

<svelte:head>
  <title>Quiz Golf — McChimp</title>
  <meta name="description" content="Answer questions to hit your line. Aim, swing, and hole out in as few strokes as you can — knowledge is accuracy." />
</svelte:head>

<!-- Back bar -->
<div class="back-bar">
  <a href="/games" class="back-btn">← Games</a>
  <span class="back-title">Golf</span>
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
        oncontinue={(savedInfo || cloudContinueSave) ? continueGame : undefined}
        savedInfo={savedInfo || (cloudContinueSave ? cloudSavedInfo(cloudContinueSave) : null)}
        onstartsetup={() => gs.screen = 'round_setup'}
        onloadsave={onLoadsave}
        onsavedeleted={onSaveDeleted}
        {userId}
        {userTier}
      />
    </div>

  {:else if gs.screen === 'round_setup'}
    <div class="screen-wrap">
      <RoundSetupScreen
        onstartround={startRound}
        onback={() => gs.screen = 'menu'}
      />
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
      onsavequit={saveAndExit}
      saving={savingExit}
    />
    {#if saveError}
      <p class="save-error">{saveError}</p>
    {/if}

  {:else if gs.screen === 'scorecard'}
    <div class="screen-wrap">
      <ScorecardScreen
        oncontinue={scorecardContinue}
        onsavequit={saveAndExit}
        onswitchmodule={(modId) => { rebuildPool(modId); save(); }}
        saving={savingExit}
      />
      {#if saveError}
        <p class="save-error">{saveError}</p>
      {/if}
    </div>

  {:else if gs.screen === 'round_end'}
    <div class="screen-wrap">
      <RoundEndScreen onmenu={endToMenu} />
    </div>
  {/if}
</div>

<style>
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

  .save-error {
    max-width: 576px; margin: 8px auto 0; padding: 0 16px;
    font-size: 12px; color: var(--red); text-align: center;
  }
</style>
