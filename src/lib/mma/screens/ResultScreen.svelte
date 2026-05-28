<!-- src/lib/mma/screens/ResultScreen.svelte -->
<!-- Fight outcome, event banner, explanation, Next Fight / career choice modal -->
<script>

  import { state as gs }          from '$lib/mma/state.svelte.js';
  import { buildDivision, divisionSlotToOpponent } from '$lib/mma/fighters.js';
  import { PHASES }               from '$lib/mma/constants.js';
  import { getPhaseDef }          from '$lib/mma/career.js';
  import { setupNextFight }       from '$lib/mma/combat.js';
  import { ensureQPool, assignDivisionQuestions } from '$lib/mma/questions.js';

  const { onsave, oncareerend } = $props();

  const result = $derived(gs.fightResult);
  const cs     = $derived(gs.career);

  // ── Career choice modal ───────────────────────────────
  let choiceModalType = $state(null);

  const labelClass = $derived(result ? result.resultClass : '');

  // ── Next Fight ────────────────────────────────────────
  function onNextFight() {
    if (!cs) { gs.screen = 'prefight'; return; }
    if (result?.isLast) { onSeeRecord(); return; }
    const ev = cs.pendingEvent;
    if (ev?.choiceType) { choiceModalType = ev.choiceType; return; }
    if (cs.forceRetire) { onSeeRecord(); return; }
    // If callout was accepted, _calloutOpponent is set — setupNextFight handles it
    const pinned = gs._calloutOpponent || null;
    gs.currentOpponent  = setupNextFight(gs, cs, pinned);
    gs._calloutOpponent = null;
    gs.calloutUsed      = false;
    gs.screen           = 'prefight';
  }

  function onSeeRecord() {
    oncareerend?.();
    gs.screen = 'end';
  }

  // ── Career choice modal actions ───────────────────────
  function choiceStay() {
    cs.pendingEvent       = null;
    cs.advancementPending = false;
    choiceModalType       = null;
    gs.currentOpponent = setupNextFight(gs, cs, null);
    gs.screen          = 'prefight';
  }

  function choiceMove() {
    cs.phase          = Math.min(3, cs.phase + 1);
    cs.phaseWins      = 0; cs.phaseLosses = 0;
    cs.titleHeld      = false; cs.titleName = null;
    cs.advancementPending = false;
    if (!cs.divisions) cs.divisions = {};
    const newDiv = buildDivision(PHASES[cs.phase], cs.fighterName);
    cs.divisions[cs.phase] = newDiv;
    cs.division            = newDiv;
    cs.division.playerSlot = 0;
    ensureQPool(gs);
    assignDivisionQuestions(gs, newDiv, cs.phase);
    cs.pendingEvent   = null;
    cs.freshDivision  = true;
    const firstFid    = newDiv.slots[1];
    gs.currentOpponent = (firstFid && firstFid !== 'player')
      ? divisionSlotToOpponent(firstFid, 1, cs) : null;
    choiceModalType = null;
    onsave?.();
    gs.screen = 'prefight';
  }

  function choiceSign() {
    cs.phase       = Math.max(1, cs.phase - 1);
    cs.phaseWins   = 0; cs.phaseLosses = 0; cs.phaseStreak = 0;
    cs.titleHeld   = false; cs.titleName = null;
    cs.cutPending  = false;
    if (!cs.divisions) cs.divisions = {};
    if (!cs.divisions[cs.phase]) {
      cs.divisions[cs.phase] = buildDivision(PHASES[cs.phase], cs.fighterName);
    }
    cs.division = cs.divisions[cs.phase];
    cs.division.playerSlot = 0;
    cs.division.slots[0]   = 'player';
    ensureQPool(gs);
    assignDivisionQuestions(gs, cs.division, cs.phase);
    cs.pendingEvent  = null;
    cs.freshDivision = true;
    const firstFid   = cs.division.slots[1];
    gs.currentOpponent = (firstFid && firstFid !== 'player')
      ? divisionSlotToOpponent(firstFid, 1, cs) : null;
    choiceModalType = null;
    onsave?.();
    gs.screen = 'prefight';
  }

  function choiceRetire() {
    gs.retiredVoluntarily = true;
    choiceModalType = null;
    onSeeRecord();
  }

  // ── Change module ─────────────────────────────────────
  function changeModule() {
    gs.screen = 'menu';
  }

  // ── Enter key: next fight ─────────────────────────────
  function onKeydown(e) {
    if (e.key !== 'Enter' || e.target.tagName === 'BUTTON') return;
    onNextFight();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if result}
  <!-- Result header -->
  <div class="result-icon">{result.rolled.icon}</div>
  <div class="result-label {result.resultClass}">{result.rolled.outcome}</div>
  {#if result.rolled.method}
    <div class="result-method">{result.rolled.method}</div>
  {/if}
  <div class="result-score">
    {result.score} / {result.maxPts} points · {Math.round(result.ratio * 100)}%
  </div>
  <div class="result-desc">{result.rolled.desc}</div>

  <!-- Explanation -->
  {#if result.q?.explanation}
    <div class="result-explanation">{result.q.explanation}</div>
  {/if}

  <!-- Event banner (from this fight) -->
  {#if !gs.sparring && cs?.pendingEvent && !cs.pendingEvent.choiceType}
    {@const ev = cs.pendingEvent}
    <div class="event-banner {ev.type}">
      <div class="ev-label">{ev.label}</div>
      <div class="ev-text">{ev.text}</div>
    </div>
  {/if}

  <!-- Buttons -->
  <div class="btn-row">
    {#if result.isLast}
      <button class="btn btn-primary" onclick={onSeeRecord}>See Final Record</button>
    {:else if gs.sparring}
      <button class="btn btn-primary" onclick={onNextFight}>Next Round</button>
    {:else}
      <button class="btn btn-primary" onclick={onNextFight}>Next Fight</button>
    {/if}
    <button class="btn btn-ghost" onclick={changeModule}>Change Module</button>
  </div>
{/if}

<!-- ── Career choice modal ────────────────────────────── -->
{#if choiceModalType}
  <div class="ccm-overlay">
    <div class="ccm-inner">
      {#if choiceModalType === 'promotion'}
        {@const nextPhase = PHASES[cs.phase + 1]}
        <div class="ccm-icon">📋</div>
        <div class="ccm-title">Contract Offer</div>
        <div class="ccm-text">
          {nextPhase.promo} wants to sign you. You're the champion here — you can stay and keep building
          your legacy, or make the jump.
        </div>
        <div class="ccm-row">
          <button class="btn btn-ghost" onclick={choiceStay}>Stay in {PHASES[cs.phase].promo}</button>
          <button class="btn btn-primary" onclick={choiceMove}>Sign with {nextPhase.promo}</button>
        </div>
      {:else}
        {@const lowerPhase = cs.phase > 1 ? PHASES[cs.phase - 1] : null}
        <div class="ccm-icon">✂️</div>
        <div class="ccm-title">Released</div>
        <div class="ccm-text">
          You've been cut from {PHASES[cs.phase].promo}.
          {lowerPhase
            ? `${lowerPhase.promo} will take you — or you can hang up the gloves.`
            : 'No one is booking you. It might be time to walk away.'}
        </div>
        <div class="ccm-row">
          {#if lowerPhase}
            <button class="btn btn-ghost" onclick={choiceSign}>Sign with {lowerPhase.promo}</button>
          {/if}
          <button class="btn btn-primary" onclick={choiceRetire}>Retire</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .result-icon  { font-size: 52px; line-height: 1; margin-bottom: 12px; }
  .result-label { font-family: var(--font-display); font-size: 48px; letter-spacing: 0.04em; line-height: 1; margin-bottom: 6px; }
  .result-label.win    { color: var(--green); }
  .result-label.draw   { color: var(--amber); }
  .result-label.loss   { color: var(--red); }
  .result-label.finish { color: var(--red); }
  .result-method { font-size: 14px; color: var(--text-muted); margin-bottom: 4px; font-style: italic; }
  .result-score  { font-family: var(--font-display); font-size: 20px; letter-spacing: 0.06em; margin-bottom: 6px; color: var(--text-muted); }
  .result-desc   { color: var(--text-muted); font-size: 14px; margin-bottom: 16px; line-height: 1.5; }
  .result-explanation {
    background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 12px 16px; font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 28px;
  }

  .btn-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }

  /* Event banner */
  .event-banner { border-radius: var(--radius); padding: 12px 16px; margin-bottom: 16px; border: 1px solid; }
  .event-banner.ev-contract  { background: rgba(74,232,122,0.08);  border-color: rgba(74,232,122,0.3); }
  .event-banner.ev-interim   { background: rgba(232,193,74,0.08);  border-color: rgba(232,193,74,0.3); }
  .event-banner.ev-title     { background: rgba(232,74,74,0.08);   border-color: rgba(232,74,74,0.3); }
  .event-banner.ev-cut       { background: rgba(180,74,232,0.08);  border-color: rgba(180,74,232,0.3); }
  .event-banner.ev-mainevent { background: rgba(74,158,232,0.08);  border-color: rgba(74,158,232,0.3); }
  .ev-label { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
  .event-banner.ev-contract .ev-label  { color: var(--green); }
  .event-banner.ev-interim .ev-label   { color: var(--accent); }
  .event-banner.ev-title .ev-label     { color: var(--red); }
  .event-banner.ev-cut .ev-label       { color: #b44ae8; }
  .event-banner.ev-mainevent .ev-label { color: var(--blue); }
  .ev-text { font-size: 13px; color: var(--text); line-height: 1.5; }

  /* Career choice modal */
  .ccm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.80); display: flex; align-items: center; justify-content: center; z-index: 9999; }
  .ccm-inner   { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px 28px 24px; max-width: 400px; width: 90%; text-align: center; }
  .ccm-icon    { font-size: 36px; margin-bottom: 12px; }
  .ccm-title   { font-family: var(--font-display); font-size: 28px; letter-spacing: 0.04em; color: var(--accent); margin-bottom: 8px; }
  .ccm-text    { font-size: 14px; color: var(--text-muted); line-height: 1.6; margin-bottom: 24px; }
  .ccm-row     { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
</style>
