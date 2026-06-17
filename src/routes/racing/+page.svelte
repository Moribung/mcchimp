<!-- src/routes/racing/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import { supabase } from '$lib/supabase.js';
  import { fetchSet, fetchPublicCatalog } from '$lib/questions.js';
  import { logAnswer } from '$lib/progress.js';

  import { state as gs } from '$lib/racing/state.svelte.js';
  import {
    buildPool, selectQuestion, effectiveTier, updateQScore, qidOf,
  } from '$lib/racing/questions.js';
  import {
    initField, advanceField, resortField, triggerType, duelOutcome, applyOutcome,
    exitRating, pitOutcome, applyPitDropDist,
  } from '$lib/racing/race.js';
  import { trackById, randomTrackId } from '$lib/racing/tracks.js';
  import {
    COMMITMENTS, STANCES, FIELD_SIZE, DUEL_TIMER_MS, tyresToChange, SIM,
  } from '$lib/racing/constants.js';

  import MenuScreen      from '$lib/racing/screens/MenuScreen.svelte';
  import RaceSetupScreen from '$lib/racing/screens/RaceSetupScreen.svelte';
  import RaceScreen      from '$lib/racing/screens/RaceScreen.svelte';
  import PitStopScreen   from '$lib/racing/screens/PitStopScreen.svelte';
  import ResultScreen    from '$lib/racing/screens/ResultScreen.svelte';

  // ── Back bar auth ─────────────────────────────────────
  let displayName = $state('');
  let loggedIn    = $state(false);
  let userId      = $state(null);

  beforeNavigate(() => document.body.classList.remove('game-page'));

  onMount(() => {
    document.body.classList.add('game-page');

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loggedIn = true; userId = session.user.id;
        supabase.from('profiles').select('display_name').eq('id', session.user.id).single()
          .then(({ data }) => { if (data) displayName = data.display_name; });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, sess) => {
      if (sess) {
        loggedIn = true; userId = sess.user.id;
        supabase.from('profiles').select('display_name').eq('id', sess.user.id).single()
          .then(({ data }) => { if (data) displayName = data.display_name; });
      } else { loggedIn = false; displayName = ''; userId = null; }
    });

    loadModules();
    simRaf = requestAnimationFrame(simFrame);

    return () => {
      document.body.classList.remove('game-page');
      subscription.unsubscribe();
      cancelAnimationFrame(simRaf);
    };
  });

  /* ── Sim loop: cars run on the track until a duel triggers ──── */
  let simRaf, simLast = null;

  function resync() {
    const r = gs.race;
    resortField(r.field);
    r.field = [...r.field];                       // new ref so standings re-render
    r.playerIdx = r.field.findIndex(c => c.isPlayer);
  }

  // Nearest racing (non-pitting) car ahead / behind the player.
  function aheadCar(field, idx)  { for (let j = idx - 1; j >= 0; j--) if (!field[j].pitting) return field[j]; return null; }
  function behindCar(field, idx) { for (let j = idx + 1; j < field.length; j++) if (!field[j].pitting) return field[j]; return null; }

  function simFrame(t) {
    const r = gs.race;
    if (r && r.phase === 'running') {
      if (simLast == null) simLast = t;
      const dt = Math.min(0.05, (t - simLast) / 1000); simLast = t;
      advanceField(r.field, dt, r.playerBoost ?? 0);

      // Hold station — the player can't pass (or be passed) on track without a
      // duel. Clamp BEFORE re-sorting so no silent place change ever happens.
      // Cars parked in the pit bay are skipped (you race straight past them).
      const pIdx = r.playerIdx;
      const me = r.field[pIdx];
      const carAhead  = aheadCar(r.field, pIdx);
      const carBehind = behindCar(r.field, pIdx);
      if (carAhead && me.dist > carAhead.dist - SIM.DRAFT) me.dist = carAhead.dist - SIM.DRAFT;
      if (carBehind && carBehind.dist > me.dist - SIM.DRAFT) carBehind.dist = me.dist - SIM.DRAFT;
      resync();

      const player = r.field[r.playerIdx];

      // Crossed the start/finish line → new lap. Finish the race or offer the pit.
      const laps = Math.floor(player.dist / SIM.LAP_DIST);
      if (laps > r.lapsCovered) {
        r.lapsCovered = laps;
        if (laps >= r.totalLaps) { finishRace(); simRaf = requestAnimationFrame(simFrame); return; }
        if (laps + 1 >= SIM.PIT_OPEN_LAP && r.tireWear >= SIM.PIT_WEAR_PROMPT) {
          r.phase = 'pitdecision'; simRaf = requestAnimationFrame(simFrame); return;
        }
      }

      // A duel breaks out once you've raced a real stretch and a neighbour is in
      // the draft (you've caught them, or they've caught you).
      const run = player.dist - (r.lastDuelDist ?? 0);
      const a = aheadCar(r.field, r.playerIdx);
      const b = behindCar(r.field, r.playerIdx);
      const gA = a ? a.dist - player.dist : Infinity;
      const gB = b ? player.dist - b.dist : Infinity;
      if (run >= SIM.MIN_RUN_DIST && (gA <= SIM.DRAFT || gB <= SIM.DRAFT)) triggerDuel();
      else if (run >= SIM.MAX_RUN_DIST) triggerDuel();
    } else {
      simLast = null;
    }
    simRaf = requestAnimationFrame(simFrame);
  }

  // running → break: a neighbour is in range, the cars halt, you pick commitment.
  function triggerDuel() {
    const r = gs.race;
    if (!r || r.phase !== 'running') return;
    const t = triggerType(r.field, r.playerIdx);
    r.duel = {
      type: t.type, ahead: t.ahead, behind: t.behind,
      commitment: null, q: null, tier: null, ratio: null, band: null, posDelta: 0,
      exit: r.lastExit ?? 0.5,
    };
    r.phase = 'break';
  }

  function skipToDuel() { triggerDuel(); }

  // Lights out → go racing (the grid stagger eases into the racing line).
  function lightsOut() {
    const r = gs.race;
    if (r?.phase === 'grid') r.phase = 'running';
  }

  // Resume racing after a duel/pit — momentum from the last exit, reset the
  // distance gate so the next duel is a full stretch away.
  function resumeRunning(exit = 0.5) {
    const r = gs.race;
    r.playerBoost  = (exit - 0.5) * SIM.PLAYER_BOOST;
    r.lastDuelDist = r.field[r.playerIdx].dist;
    r.duel  = null;
    r.phase = 'running';
  }

  /* ── Module loading ──────────────────────────────────── */
  async function loadModules() {
    try {
      const catalog = await fetchPublicCatalog();
      const sets = await Promise.all(catalog.map(async fname => {
        try {
          const data = await fetchSet(fname);
          return { ...data, id: fname.replace('.json', ''), filename: fname };
        } catch { return null; }
      }));
      const valid = sets.filter(Boolean);
      gs.availableModules = valid;
      valid.forEach(m => { gs.loadedModules[m.id] = m; });
    } catch (e) {
      console.warn('[racing] loadModules failed', e);
    }
  }

  function buildSetMeta(modId) {
    const mod = gs.loadedModules?.[modId];
    if (!mod) return null;
    return { setId: mod.filename || modId, source: 'builtin', name: mod.name };
  }

  function rebuildPool(modId) {
    const mod = gs.loadedModules[modId];
    if (!mod) return;
    const { pool, byId } = buildPool(mod);
    gs._qPool = pool; gs._qById = byId; gs._qUsed = []; gs._qScores = {};
    gs.activeModId = modId;
  }

  function pickQuestion(tier) {
    const q = selectQuestion(gs._qPool || {}, gs._qScores, gs._qUsed, tier);
    if (q) gs._qUsed = [...gs._qUsed, qidOf(q)].slice(-30);
    return q;
  }

  /* ── Race lifecycle ──────────────────────────────────── */
  function startRace({ modId, stance, trackId }) {
    rebuildPool(modId);
    const { field, playerIdx } = initField(FIELD_SIZE);
    const resolvedTrackId = (!trackId || trackId === 'random') ? randomTrackId() : trackId;
    const track = trackById(resolvedTrackId);
    gs.setup.stance = stance;
    gs.setup.trackId = trackId ?? 'random';
    gs.race = {
      field,
      playerIdx,
      trackId:     resolvedTrackId,
      startPos:    playerIdx + 1,
      totalLaps:   track.laps,
      lapsCovered: Math.floor(field[playerIdx].dist / SIM.LAP_DIST),
      tireWear:    0,
      stance,
      phase:       'grid',
      duel:        null,
      lastDuelDist: field[playerIdx].dist,
      playerBoost: 0,
      lastExit:    0.5,
      pit:         null,
      pitsMade:    0,
      finishPos:   null,
      recap: { overtakes: 0, lost: 0, pitTimeMs: 0, bestStreak: 0, streak: 0 },
    };
    gs.screen = 'race';
  }

  // Commitment chosen on the break screen → load the question.
  function pickCommitment(commit) {
    const r = gs.race;
    if (!r || r.phase !== 'break') return;
    const cfg = COMMITMENTS[commit] || COMMITMENTS.push;
    const q = pickQuestion(cfg.tier);
    if (!q) return;
    r.duel.commitment = commit;
    r.duel.q = q;
    r.duel.tier = effectiveTier(gs._qScores, qidOf(q), q._tier || cfg.tier);
    r.duel.ratio = null;
    r.duel.band = null;
    r.duel.posDelta = 0;
    r.phase = 'question';
  }

  function answerDuel({ ratio, correct, score, maxPts, answerMs }) {
    const r = gs.race;
    if (!r?.duel?.q || r.phase !== 'question') return;
    const q = r.duel.q;

    const qid = qidOf(q);
    if (qid) updateQScore(gs._qScores, qid, correct);
    if (userId) {
      const meta = buildSetMeta(gs.activeModId);
      if (meta) logAnswer(userId, q, meta, 'racing', ratio, score, maxPts);
    }

    // Work out the result now (for the banner) but DON'T move anyone yet — the
    // position change plays out on the track when we zoom back out.
    const out = duelOutcome({
      type: r.duel.type, commitment: r.duel.commitment, ratio,
      playerIdx: r.playerIdx, fieldLen: r.field.length,
    });

    const cfg = COMMITMENTS[r.duel.commitment] || COMMITMENTS.push;
    r.tireWear = Math.min(1, r.tireWear + cfg.wearRate * trackById(r.trackId).wearMult);

    if (out.posDelta > 0) {
      r.recap.overtakes += out.posDelta;
      r.recap.streak    += out.posDelta;
      r.recap.bestStreak = Math.max(r.recap.bestStreak, r.recap.streak);
    } else if (out.posDelta < 0) {
      r.recap.lost  += -out.posDelta;
      r.recap.streak = 0;
    }

    const answerSpeed = Math.min(1, answerMs / DUEL_TIMER_MS);
    const exit = exitRating({ band: out.band, answerSpeed, commitment: r.duel.commitment });
    r.lastExit = exit;
    Object.assign(r.duel, {
      ratio, band: out.band, gains: out.gains, posDelta: out.posDelta,
      newPos: (r.playerIdx - out.posDelta) + 1, exit,
    });
    r.phase = 'resolve';
  }

  function continueAfterResolve() {
    const r = gs.race;
    if (!r || r.phase !== 'resolve') return;
    // Now apply the result — the pass plays out as the camera zooms out.
    applyOutcome({ field: r.field, playerIdx: r.playerIdx, band: r.duel.band, type: r.duel.type, gains: r.duel.gains });
    resync();
    // Race end is lap-based (handled when crossing the line) — just race on.
    resumeRunning(r.lastExit ?? 0.5);
  }

  /* ── Pit stops (offered only at the start/finish line) ── */
  function enterPit() {
    const r = gs.race;
    if (!r || r.phase !== 'pitdecision') return;
    r.field.forEach(c => { c.pitting = false; });   // clear any AI mid-bay (TrackScene unmounts now)
    r.pit = { tiresToChange: tyresToChange(r.tireWear), tireIdx: 0, results: [], q: pickQuestion('easy'), done: false };
    r.phase = 'pit';
  }

  function pitStay() {
    const r = gs.race;
    if (!r || r.phase !== 'pitdecision') return;
    resumeRunning(0.5);
  }

  function pitAnswer({ correct, answerMs }) {
    const r = gs.race;
    if (!r?.pit) return;
    const qid = qidOf(r.pit.q);
    if (qid) updateQScore(gs._qScores, qid, correct);
    r.pit.results = [...r.pit.results, { correct, answerMs }];
    if (r.pit.results.length < r.pit.tiresToChange) {
      r.pit.tireIdx += 1;
      r.pit.q = pickQuestion('easy');
    } else {
      // All tyres done — the bay animation drives out, then calls pitComplete().
      r.pit.done = true;
    }
  }

  function pitComplete() { finishPit(); }

  function finishPit() {
    const r = gs.race;
    const { timeLostMs, positionsLost } = pitOutcome({ tireResults: r.pit.results });
    applyPitDropDist(r.field, r.playerIdx, positionsLost);
    resync();
    r.recap.pitTimeMs += timeLostMs;
    r.recap.lost      += positionsLost;
    r.recap.streak     = 0;
    r.tireWear         = 0;
    r.pitsMade        += 1;
    r.pit              = null;
    // Rejoin behind the cars that stayed out.
    resumeRunning(0.5);
  }

  /* ── Finish ──────────────────────────────────────────── */
  function finishRace() {
    const r = gs.race;
    r.finishPos = r.playerIdx + 1;
    r.phase = 'done';
    gs.screen = 'result';
  }

  function raceAgain() { startRace({ modId: gs.activeModId, stance: gs.setup.stance, trackId: gs.setup.trackId }); }
  function toMenu()    { gs.race = null; gs.screen = 'menu'; }
  function toSetup()   { gs.screen = 'setup'; }
</script>

<svelte:head>
  <title>Quiz Racing — McChimp</title>
  <meta name="description" content="Duels break out across the field — attack, defend, or both. The race halts, you pick how hard to commit, then answer against the clock. Knowledge is pace." />
  <link rel="stylesheet" href="/mma.css" />
</svelte:head>

<div class="racing-wrap" class:in-game={gs.screen === 'race'}>
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

  <div class="game-body">
    {#if gs.screen === 'menu'}
      <div class="screen-wrap"><MenuScreen onstart={toSetup} /></div>

    {:else if gs.screen === 'setup'}
      <div class="screen-wrap"><RaceSetupScreen onstartrace={startRace} onback={toMenu} /></div>

    {:else if gs.screen === 'race'}
      {#if gs.race?.phase === 'pit'}
        <div class="screen-wrap"><PitStopScreen onpitanswer={pitAnswer} onpitcomplete={pitComplete} /></div>
      {:else}
        <RaceScreen
          onskip={skipToDuel}
          onlightsout={lightsOut}
          onpickcommitment={pickCommitment}
          onanswer={answerDuel}
          oncontinue={continueAfterResolve}
          onpitbox={enterPit}
          onpitstay={pitStay}
          onquit={toMenu}
        />
      {/if}

    {:else if gs.screen === 'result'}
      <div class="screen-wrap"><ResultScreen onagain={raceAgain} onmenu={toMenu} /></div>
    {/if}
  </div>
</div>

<style>
  :global(body.game-page) { overflow: hidden; }

  .racing-wrap { width: 100%; display: flex; flex-direction: column; height: 100vh; height: 100dvh; background: var(--bg, #0d0d0f); color: var(--text, #f0ede6); }

  .back-bar {
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    padding: 10px 24px; background: rgba(10,10,10,.97);
    border-bottom: 1px solid rgba(255,255,255,.06); backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 200; flex-shrink: 0;
  }
  .back-link { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: rgba(242,239,232,.45); text-decoration: none; display: flex; align-items: center; gap: 8px; transition: color .15s; }
  .back-link:hover { color: #F2EFE8; }
  .back-arrow { font-size: 16px; line-height: 1; }
  .back-logo { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: .06em; color: #E8C14A; text-decoration: none; justify-self: center; }
  .back-logo span { color: #F2EFE8; opacity: .5; }
  .back-right { justify-self: end; }
  .back-user, .back-login { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #E8C14A; text-decoration: none; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .back-login { border: 1px solid rgba(232,193,74,.4); padding: 5px 14px; border-radius: 2px; transition: background .2s; }
  .back-login:hover { background: rgba(232,193,74,.08); }

  .game-body { flex: 1; overflow-y: auto; min-height: 0; }
  .screen-wrap { max-width: 560px; margin: 0 auto; padding: 24px 16px 40px; width: 100%; }
</style>
