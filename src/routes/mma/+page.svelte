<!-- src/routes/mma/+page.svelte -->
<script>
  import { onMount }  from 'svelte';
  import { get }      from 'svelte/store';
  import { session }  from '$lib/stores/session.js';
  import { supabase } from '$lib/supabase.js';
  import {
    loadSave  as platformLoadSave,
    exportSave as platformExportSave,
    deleteSave as platformDeleteSave,
    archiveCareer,
  }                   from '$lib/saves.js';
  import { fetchIndex, fetchSet } from '$lib/questions.js';

  import { state as gs }    from '$lib/mma/state.svelte.js';
  import { initState, initSparringState, calcLegacyTitle } from '$lib/mma/career.js';
  import { exportSave, loadSave } from '$lib/mma/saves.js';

  import MenuScreen      from '$lib/mma/screens/MenuScreen.svelte';
  import NamingScreen    from '$lib/mma/screens/NamingScreen.svelte';
  import PrefightScreen  from '$lib/mma/screens/PrefightScreen.svelte';
  import QuestionScreen  from '$lib/mma/screens/QuestionScreen.svelte';
  import ResultScreen    from '$lib/mma/screens/ResultScreen.svelte';
  import CareerEndScreen from '$lib/mma/screens/CareerEndScreen.svelte';
  import EndScreen       from '$lib/mma/screens/EndScreen.svelte';
  import CareerPanel     from '$lib/mma/screens/CareerPanel.svelte';
  import BoutHistory     from '$lib/mma/screens/BoutHistory.svelte';

  import { gf }          from '$lib/mma/fighters.js';
  import {
    CHAMP_SLOT, RANKED_START,
    DIFF_LABELS, DIFF_COLORS, DIFF_BG,
  }                      from '$lib/mma/constants.js';
  import { getPhaseDef, getPlayerSlot, calloutSuccessPct } from '$lib/mma/career.js';
  import { divisionSlotToOpponent }  from '$lib/mma/fighters.js';

  // ── Sidebar: ranking rows ─────────────────────────────
  const rankingRows = $derived((() => {
    const cs = gs.career;
    if (!cs?.division || gs.sparring) return [];
    const { slots, playerSlot } = cs.division;
    const rows = [];
    for (let i = slots.length - 1; i >= 0; i--) {
      const fid      = slots[i];
      const isPlayer = fid === 'player' || i === playerSlot;
      const f = isPlayer
        ? { name: cs.fighterName, record: `${gs.wins}-${gs.losses}`, wins: gs.wins, losses: gs.losses, draws: gs.draws || 0, isPlayer: true }
        : gf(fid);
      if (!f) continue;
      const rankNum = i === CHAMP_SLOT ? 'C' : i < RANKED_START ? '–' : `#${CHAMP_SLOT - i}`;
      const isNext  = !isPlayer && gs.currentOpponent && typeof gs.currentOpponent.divisionSlot === 'number' && i === gs.currentOpponent.divisionSlot;
      // Movement — only meaningful on prefight screen after NPC round
      let mv = null;
      if (!isPlayer && f.prevSlot != null && f.prevSlot !== i) {
        mv = { delta: Math.abs(i - f.prevSlot), dir: i > f.prevSlot ? 'up' : 'down' };
      }
      const isNew = !isPlayer && !!f.isNew;
      rows.push({ i, f, fid, isPlayer, isChamp: i === CHAMP_SLOT, isNext, rankNum, mv, isNew });
    }
    return rows;
  })());

  // ── Sidebar: callout (result screen only) ─────────────
  let calloutTargetSlot = $state(null);
  let calloutFighter    = $state(null);
  let calloutPct        = $state(0);
  let calloutOddsDesc   = $state('');
  let calloutResult     = $state(null);
  let calloutResultText = $state('');
  let calloutAccepted   = $state(false);

  const canCallout = $derived(
    gs.screen === 'result' &&
    !gs.calloutUsed &&
    !!gs.fightResult &&
    !gs.fightResult?.isLast
  );

  function openCallout(slotIdx) {
    if (!canCallout) return;
    const cs = gs.career;
    if (!cs?.division) return;
    const fid = cs.division.slots[slotIdx];
    if (!fid || fid === 'player') return;
    const f = gf(fid);
    if (!f) return;
    calloutTargetSlot = slotIdx;
    calloutFighter    = f;
    const playerSlot  = cs.division.playerSlot;
    const penalty     = cs.calloutRecord?.[f.name] || 0;
    const pct         = calloutSuccessPct(playerSlot, slotIdx, penalty);
    calloutPct        = Math.round(pct * 100);
    const diff        = slotIdx - playerSlot;
    if (diff <= 0)       calloutOddsDesc = diff === 0 ? 'Same rank — they have little reason to refuse.' : 'They are ranked below you.';
    else if (diff <= 3)  calloutOddsDesc = 'Close in the rankings — this is a natural matchup.';
    else if (diff <= 8)  calloutOddsDesc = 'A few spots above you — they might not see you as worthy yet.';
    else                 calloutOddsDesc = 'Far above your current ranking — expect a cold shoulder.';
    if (penalty > 0) calloutOddsDesc += ` They have lost to you ${penalty} time${penalty > 1 ? 's' : ''} — reluctant to fight again.`;
    calloutResult   = null;
    calloutAccepted = false;
  }

  function doCallout() {
    const cs = gs.career;
    if (calloutTargetSlot === null || !cs?.division) return;
    const fid    = cs.division.slots[calloutTargetSlot];
    const f      = gf(fid);
    if (!f) return;
    const penalty  = cs.calloutRecord?.[f.name] || 0;
    const pct      = calloutSuccessPct(cs.division.playerSlot, calloutTargetSlot, penalty);
    const accepted = Math.random() < pct;
    gs.calloutUsed = true;
    if (accepted) {
      calloutResult     = 'accepted';
      calloutResultText = '✓ They accepted. The fight is on.';
      calloutAccepted   = true;
      gs._calloutOpponent = divisionSlotToOpponent(fid, calloutTargetSlot, cs);
    } else {
      const reasons = [
        'Not interested. You have not earned it yet.',
        'Their team passed. Work your way up.',
        'They want bigger names first.',
        'Management declined. Try again after a win.',
      ];
      calloutResult     = 'declined';
      calloutResultText = '✗ ' + reasons[Math.floor(Math.random() * reasons.length)];
    }
  }

  function acceptCalloutFight() {
    if (!gs._calloutOpponent) return;
    gs.currentOpponent  = gs._calloutOpponent;
    gs._calloutOpponent = null;
    calloutTargetSlot   = null;
    calloutResult       = null;
    gs.calloutUsed      = false; // reset so it doesn't show "used" on next prefight
    gs.screen           = 'prefight';
  }

  function closeCallout() {
    calloutTargetSlot   = null;
    calloutResult       = null;
    gs._calloutOpponent = null;
  }

  // ── Layout flags ──────────────────────────────────────
  const IN_GAME_SCREENS = ['prefight', 'question', 'result'];
  const inGame   = $derived(IN_GAME_SCREENS.includes(gs.screen));
  const showSide = $derived(inGame && !gs.sparring && !!gs.career);

  // ── Back bar: display name ────────────────────────────
  let displayName = $state('');

  // ── Module loading ────────────────────────────────────
  async function loadModules() {
    try {
      const filenames = await fetchIndex();
      const sets = await Promise.all(filenames.map(async f => {
        try   { return { id: f.replace('.json', ''), filename: f, ...(await fetchSet(f)) }; }
        catch { return null; }
      }));
      gs.availableModules = sets.filter(Boolean);
      gs.loadedModules    = {};
      for (const m of gs.availableModules) gs.loadedModules[m.id] = m;
    } catch (e) {
      console.error('Failed to load question modules:', e);
    }
  }

  // ── Cloud save ────────────────────────────────────────
  async function saveToCloud() {
    const sess = get(session);
    if (!sess) return;
    try {
      await platformExportSave(sess.user.id, 'mma', exportSave(state));
    } catch (e) {
      console.error('Save failed:', e);
    }
  }

  // ── Career end → archive + delete active save ─────────
  async function onCareerEnd() {
    const sess = get(session);
    if (!sess || !gs.career) return;
    const legacy = calcLegacyTitle(gs.wins, gs.fightIndex);
    const record = `${gs.wins}-${gs.losses}-${gs.draws}`;
    try {
      await archiveCareer(sess.user.id, 'mma', {
        fighterName: gs.career.fighterName,
        finalRecord: record,
        legacyTitle: legacy,
      });
      await platformDeleteSave(sess.user.id, 'mma');
    } catch (e) {
      console.error('Archive failed:', e);
    }
  }

  // ── onMount ───────────────────────────────────────────
  onMount(async () => {
    await loadModules();
    const sess = get(session);
    if (sess) {
      // Fetch display name for back bar
      supabase
        .from('profiles')
        .select('display_name')
        .eq('id', sess.user.id)
        .single()
        .then(({ data }) => { if (data) displayName = data.display_name; });
      // Load save
      try {
        const blob = await platformLoadSave(sess.user.id, 'mma');
        if (blob) loadSave(gs, blob);
      } catch (e) {
        console.error('Could not load save:', e);
      }
    }
  });
</script>

<svelte:head>
  <link rel="stylesheet" href="/mma.css" />
</svelte:head>

<div class="mma-wrap" class:in-game={inGame} class:sparring={gs.sparring}>

  <div class="back-bar">
    <a href="/games" class="back-link">
      <span class="back-arrow">←</span> All Games
    </a>
    <a href="/" class="back-logo">Mc<span>Chimp</span></a>
    <div class="back-right">
      {#if $session}
        <div class="back-user-wrap">
          <a href="/account" class="back-user">{displayName || 'Account'} ▾</a>
          <div class="back-dropdown">
            <a href="/dashboard">Dashboard</a>
            <a href="/account">Settings</a>
          </div>
        </div>
      {:else}
        <a href="/auth/login" class="back-login">Login</a>
      {/if}
    </div>
  </div>

  <header class="mma-header">
    <h1 class="mma-title">MMA Career Trivia</h1>
    {#if !gs.sparring}
      <div class="score-display">
        <span class="score-w">{gs.wins}W</span>
        <span class="score-sep">–</span>
        <span class="score-l">{gs.losses}L</span>
        <span class="score-sep">–</span>
        <span class="score-d">{gs.draws}D</span>
      </div>
    {/if}
  </header>

  {#if gs.screen !== 'menu' && gs.screen !== 'end'}
    <div class="fight-meta">
      {#if gs.sparring}
        {#if gs.fightIndex > 0}
          <span class="fight-count">Round {gs.fightIndex}</span>
        {/if}
      {:else}
        <span class="fight-count">
          Fight {gs.fightIndex + 1}{gs.career?.activeLength > 0
            ? ` of ${gs.career.activeLength}`
            : ' · Until Retirement'}
        </span>
      {/if}
    </div>
  {/if}

  {#if gs.sparring && inGame}
    <div class="sparring-banner">⚡ Sparring Mode — No record tracked</div>
  {/if}

  <div class="layout-wrap">

    <div class="game-col">

      {#if gs.screen === 'menu'}
        <MenuScreen
          onstartcareer={(e) => {
            initState(gs, e.modId);
            gs.career.activeLength = e.length;
            gs.career.difficulty   = e.difficulty;
          }}
          onstartsparring={(e) => initSparringState(gs, e.modId)}
        />

      {:else if gs.screen === 'naming'}
        <NamingScreen onsave={saveToCloud} />

      {:else if gs.screen === 'prefight'}
        <PrefightScreen />

      {:else if gs.screen === 'question'}
        <QuestionScreen onsave={saveToCloud} />

      {:else if gs.screen === 'result'}
        <ResultScreen
          onsave={saveToCloud}
          oncareerend={onCareerEnd}
        />

      {:else if gs.screen === 'career_end'}
        <CareerEndScreen
          oncareerend={onCareerEnd}
        />

      {:else if gs.screen === 'end'}
        <EndScreen onrestart={() => { gs.screen = 'menu'; }} />
      {/if}

    </div>

    {#if showSide}
      <aside class="career-col">

        <!-- 1. Career panel (stats) -->
        <CareerPanel />

        <!-- 2. Next opponent card -->
        {#if gs.currentOpponent}
          {@const opp = gs.currentOpponent}
          <div class="sidebar-opp">
            <div class="so-label">Your Opponent</div>
            <div class="so-name">{opp.name}</div>
            <div class="so-row2">
              <span class="so-record">{opp.record}</span>
              {#if opp.badge}
                <span class="so-badge {opp.badgeClass}">{opp.badge}</span>
              {/if}
            </div>
            {#if opp.classLabel}
              <div class="so-class">{opp.classEmoji} {opp.classLabel}</div>
            {/if}
            {#if opp.style}
              <div class="so-style">{opp.style}</div>
            {/if}
            {#if opp.bio}
              <div class="so-bio">{opp.bio}</div>
            {/if}
            {#if opp.venue}
              <div class="so-venue">📍 {opp.venue}</div>
            {/if}
          </div>
        {/if}

        <!-- 3. Rankings table -->
        {#if gs.career?.division && rankingRows.length}
          {@const pDef = getPhaseDef(gs.career)}
          <div class="sidebar-rankings">
            <div class="rt-header">
              {pDef.promo} Rankings
              {#if gs.screen === 'result'}
                {#if canCallout}
                  <span class="rt-callout-hint">tap to call out</span>
                {:else if gs.calloutUsed}
                  <span class="rt-callout-hint used">callout used</span>
                {/if}
              {/if}
            </div>
            <table class="rt-table">
              <thead><tr><th>Rank</th><th>Fighter</th><th>Record</th></tr></thead>
              <tbody>
                {#each rankingRows as row (row.i)}
                  <tr
                    class:rt-player={row.isPlayer}
                    class:rt-champ={row.isChamp}
                    class:rt-next={row.isNext}
                    class:rt-clickable={!row.isPlayer && canCallout}
                    onclick={() => { if (!row.isPlayer && canCallout) openCallout(row.i); }}
                    role={!row.isPlayer && canCallout ? 'button' : undefined}
                    tabindex={!row.isPlayer && canCallout ? 0 : undefined}
                    onkeydown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !row.isPlayer && canCallout) openCallout(row.i); }}
                  >
                    <td class="rt-rank">{row.rankNum}</td>
                    <td class="rt-name">
                      {row.f.name}
                      {#if row.isPlayer}<span class="rt-you">YOU</span>{/if}
                      {#if row.isNext}<span class="rt-next-badge">NEXT</span>{/if}
                      {#if gs.screen === 'prefight'}
                        {#if row.isNew}<span class="rt-new">NEW</span>{/if}
                        {#if row.mv}
                          {#if row.mv.dir === 'up'}
                            <span class="rt-mv-up">▲{row.mv.delta}</span>
                          {:else}
                            <span class="rt-mv-dn">▼{row.mv.delta}</span>
                          {/if}
                        {/if}
                      {/if}
                    </td>
                    <td class="rt-rec">{row.f.record}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        <!-- 4. Bout history -->
        <BoutHistory />

      </aside>
    {/if}

  </div>

</div>

<!-- ── Callout modal (rendered at page level, above everything) ── -->
{#if calloutTargetSlot !== null}
  <div class="callout-overlay" role="dialog" aria-modal="true" tabindex="-1"
    onclick={closeCallout}
    onkeydown={(e) => e.key === 'Escape' && closeCallout()}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="callout-inner" role="document"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}>
      <div class="callout-title">Call Out</div>
      {#if calloutFighter}
        <div class="callout-fighter">{calloutFighter.name} ({calloutFighter.record})</div>
      {/if}
      <div class="callout-odds">
        {calloutOddsDesc}<br>
        <span style="color:var(--accent);font-weight:600">{calloutPct}% chance they accept.</span>
      </div>
      {#if calloutResult}
        <div class="callout-result {calloutResult}">{calloutResultText}</div>
        <div class="callout-btns">
          {#if calloutAccepted}
            <button class="btn btn-primary" onclick={acceptCalloutFight}>Fight Them</button>
          {/if}
          <button class="btn btn-ghost" onclick={closeCallout}>Close</button>
        </div>
      {:else}
        <div class="callout-btns">
          <button class="btn btn-primary" onclick={doCallout}>Call Them Out</button>
          <button class="btn btn-ghost" onclick={closeCallout}>Cancel</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .back-bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 10px 32px;
    background: rgba(10,10,10,0.97);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 200;
    flex-shrink: 0;
  }
  .back-link {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(242,239,232,0.45);
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: color 0.15s;
  }
  .back-link:hover { color: #F2EFE8; }
  .back-arrow { font-size: 16px; line-height: 1; }
  .back-logo {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 20px;
    letter-spacing: 0.06em;
    color: #E8C14A;
    text-decoration: none;
    justify-self: center;
  }
  .back-logo span { color: #F2EFE8; opacity: 0.5; }

  .back-right { margin-left: auto; justify-self: end; }

  .back-user-wrap {
    position: relative;
    display: inline-flex;
  }
  .back-user {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #E8C14A;
    border: 1px solid rgba(232,193,74,0.4);
    padding: 5px 14px;
    border-radius: 2px;
    text-decoration: none;
    transition: background 0.2s;
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-block;
  }
  .back-user:hover { background: rgba(232,193,74,0.08); }

  .back-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    width: max-content;
    background: #0F1011;
    border: 1px solid rgba(255,255,255,0.08);
    opacity: 0;
    pointer-events: none;
    transform: translateY(-4px);
    transition: opacity 0.15s, transform 0.15s;
    z-index: 300;
    box-shadow: 0 12px 32px rgba(0,0,0,0.6);
  }
  .back-user-wrap:hover .back-dropdown {
    opacity: 1;
    pointer-events: all;
    transform: translateY(0);
  }
  .back-dropdown a {
    display: block;
    padding: 12px 18px;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #F2EFE8;
    text-decoration: none;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    transition: background 0.12s;
  }
  .back-dropdown a:last-child { border-bottom: none; }
  .back-dropdown a:hover { background: #191B1D; }

  .back-login {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #E8C14A;
    border: 1px solid rgba(232,193,74,0.4);
    padding: 5px 14px;
    border-radius: 2px;
    text-decoration: none;
    transition: background 0.2s;
  }
  .back-login:hover { background: rgba(232,193,74,0.08); }

  .mma-wrap {
    width: 100%;
    display: flex; flex-direction: column; min-height: 100vh;
  }
  .mma-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 32px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    width: 100%;
  }
  .mma-title { font-family: var(--font-display); font-size: 26px; letter-spacing: 0.04em; color: var(--accent); }
  .score-display { display: flex; gap: 16px; font-family: var(--font-display); font-size: 20px; letter-spacing: 0.03em; }
  .score-w  { color: var(--green); }
  .score-sep { color: var(--text-muted); }
  .score-d  { color: var(--amber); }
  .score-l  { color: var(--red); }
  .fight-meta  { padding: 8px 32px 0; }
  .fight-count { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); }
  .sparring-banner {
    font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #b44ae8;
    background: rgba(180,74,232,0.10); border: 1px solid rgba(180,74,232,0.25);
    border-radius: var(--radius); padding: 6px 14px; margin: 8px 32px 0; text-align: center;
  }
  .layout-wrap {
    display: flex; flex: 1; min-height: 0; align-items: stretch;
    width: 100%; max-width: 1400px; margin: 0 auto;
  }
  .mma-wrap:not(.in-game) .layout-wrap { display: block; padding: 0 24px; max-width: 860px; }
  .mma-wrap:not(.in-game) .game-col    { max-width: 100%; padding: 0; }
  .game-col {
    flex: 1;
    min-width: 0;
    padding: 28px 28px 40px;
  }
  .career-col {
    flex: 1 1 38%;
    min-width: 300px;
    max-width: 480px;
    border-left: 1px solid var(--border);
    padding: 20px 16px 40px;
    position: sticky;
    top: 0;
    max-height: 100vh;
    overflow-y: auto;
  }
  .mma-wrap.sparring.in-game .career-col { display: none; }
  .mma-wrap.sparring.in-game .game-col   { max-width: 760px; margin: 0 auto; }

  /* Sidebar: opponent card */
  .sidebar-opp {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 12px 14px; margin-bottom: 14px;
  }
  .so-label  { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 3px; }
  .so-name   { font-family: var(--font-display); font-size: 20px; letter-spacing: 0.04em; line-height: 1.1; margin-bottom: 4px; word-break: break-word; }
  .so-row2   { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 3px; }
  .so-record { font-family: var(--font-display); font-size: 12px; color: var(--text-muted); }
  .so-badge  { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; font-weight: 600; }
  .oc-badge-ranked    { background: rgba(232,193,74,0.15); color: var(--accent); }
  .oc-badge-champ     { background: rgba(232,193,74,0.25); color: var(--accent); border: 1px solid var(--accent); }
  .oc-badge-contender { background: rgba(232,74,74,0.12);  color: var(--red); }
  .so-class  { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 2px; color: var(--accent); }
  .so-style  { font-size: 10px; color: var(--text-muted); font-style: italic; margin-bottom: 4px; }
  .so-bio    { font-size: 10px; color: var(--text-muted); line-height: 1.5; }
  .so-venue  { font-size: 9px; color: var(--text-muted); margin-top: 6px; letter-spacing: 0.05em; border-top: 1px solid var(--border); padding-top: 6px; }

  /* Sidebar: rankings */
  .sidebar-rankings { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 14px; }
  .rt-header { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); padding: 8px 12px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  .rt-callout-hint { font-size: 9px; letter-spacing: 0.08em; color: var(--accent); opacity: 0.8; }
  .rt-callout-hint.used { color: var(--text-muted); opacity: 0.4; }
  .rt-table  { width: 100%; border-collapse: collapse; font-size: 11px; }
  .rt-table thead th { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); padding: 4px 12px; text-align: left; border-bottom: 1px solid var(--border); }
  .rt-table tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); }
  .rt-table tbody tr:last-child { border-bottom: none; }
  .rt-table td { padding: 5px 12px; }
  .rt-rank { font-family: var(--font-display); font-size: 12px; letter-spacing: 0.04em; color: var(--text-muted); width: 32px; }
  .rt-name { color: var(--text); font-size: 11px; }
  .rt-rec  { color: var(--text-muted); font-size: 10px; text-align: right; }
  .rt-player { background: rgba(232,193,74,0.06); }
  .rt-player .rt-rank { color: var(--accent); }
  .rt-player .rt-name { color: var(--accent); font-weight: 600; }
  .rt-champ  .rt-rank { color: var(--accent); }
  .rt-next   { background: rgba(232,74,74,0.04); }
  .rt-next   .rt-rank { color: var(--red); }
  .rt-clickable { cursor: pointer; }
  .rt-clickable:hover td { background: rgba(255,255,255,0.04); }
  .rt-clickable:hover .rt-name { color: var(--accent); }
  .rt-you        { font-size: 7px; letter-spacing: 0.1em; text-transform: uppercase; background: var(--accent); color: #0d0d0f; padding: 1px 4px; border-radius: 2px; font-weight: 700; margin-left: 5px; vertical-align: middle; }
  .rt-next-badge { font-size: 7px; letter-spacing: 0.1em; text-transform: uppercase; background: rgba(232,74,74,0.2); color: var(--red); border: 1px solid rgba(232,74,74,0.4); padding: 1px 4px; border-radius: 2px; font-weight: 700; margin-left: 5px; vertical-align: middle; }
  .rt-new        { font-size: 9px; font-weight: 700; color: var(--blue); margin-left: 4px; letter-spacing: 0.08em; text-transform: uppercase; vertical-align: middle; }
  .rt-mv-up      { font-size: 10px; font-weight: 700; color: var(--green); margin-left: 4px; vertical-align: middle; }
  .rt-mv-dn      { font-size: 10px; font-weight: 700; color: var(--red);   margin-left: 4px; vertical-align: middle; }

  /* Callout modal */
  .callout-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.80); display: flex; align-items: center; justify-content: center; z-index: 9999; }
  .callout-inner   { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px 24px 20px; max-width: 360px; width: 90%; }
  .callout-title   { font-family: var(--font-display); font-size: 26px; letter-spacing: 0.04em; color: var(--accent); margin-bottom: 6px; }
  .callout-fighter { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .callout-odds    { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5; }
  .callout-result  { font-size: 13px; font-weight: 600; margin-bottom: 14px; padding: 8px 12px; border-radius: 4px; }
  .callout-result.accepted { background: rgba(74,232,122,0.12); color: var(--green); }
  .callout-result.declined { background: rgba(232,74,74,0.12);  color: var(--red); }
  .callout-btns { display: flex; gap: 10px; flex-wrap: wrap; }

  @media (max-width: 768px) {
    .mma-header    { padding: 14px 16px 12px; }
    .score-display { font-size: 16px; gap: 10px; }
    .fight-meta    { padding: 8px 16px 0; }
    .sparring-banner { margin: 8px 16px 0; }
    .layout-wrap   { flex-direction: column; }
    .game-col      { max-width: 100%; padding: 16px 16px 24px; }
    .career-col    { flex: none; width: 100%; max-width: 100%; min-width: 0; border-left: none; border-top: 1px solid var(--border); padding: 16px 16px 24px; position: static; max-height: none; overflow-y: visible; }
    .mma-wrap:not(.in-game) .layout-wrap { padding: 0 16px; }
  }
</style>
