<!-- src/lib/mma/screens/PrefightScreen.svelte -->
<script>
  import { state as gs }        from '$lib/mma/state.svelte.js';
  import { gf } from '$lib/mma/fighters.js';
  import { isAdvanceKey } from '$lib/uiKeys.js';
  import {
    DIFF_LABELS, DIFF_COLORS, DIFF_BG, DIFFICULTY_TIMERS,
  }                       from '$lib/mma/constants.js';
  import {
    getPlayerSlot, sparringCurrentQuestion,
  }                       from '$lib/mma/career.js';
  import {
    tierForFight, drawQuestionForSlot,
  }                       from '$lib/mma/questions.js';
  import { prepareQuestion } from '$lib/mma/combat.js';

  const { onsaveexit } = $props();

  const cs  = $derived(gs.career);
  const mod = $derived(gs.activeModId ? gs.loadedModules?.[gs.activeModId] : null);

  // ── Tier badge peek ───────────────────────────────────
  const peekTier = $derived((() => {
    if (gs.sparring) {
      const q = gs.sparringPool?.[gs.sparringPtr % (gs.sparringPool?.length || 1)];
      return q?._tier ?? null;
    }
    if (!cs) return null;
    const pSlot  = getPlayerSlot(cs);
    const phase  = cs.phase;
    const oppFid = (cs.division && gs.currentOpponent && typeof gs.currentOpponent.divisionSlot === 'number')
      ? cs.division.slots[gs.currentOpponent.divisionSlot] : null;
    const oppF = oppFid ? gf(oppFid) : null;
    return tierForFight(phase, pSlot, oppF);
  })());

  // ── Start fight ───────────────────────────────────────
  function startFight() {
    let q;
    if (gs.sparring) {
      q = sparringCurrentQuestion(gs);
    } else {
      q = drawQuestionForSlot(
        gs,
        gs.currentOpponent ? (gs.currentOpponent.fid || gs.currentOpponent) : null,
        cs
      );
    }
    // No question available — end the career. Sparring has no career to archive,
    // so it goes straight to 'end'; a career routes through 'career_end' so it's archived.
    if (!q) { gs.screen = gs.sparring ? 'end' : 'career_end'; return; }

    const baseTimer = DIFFICULTY_TIMERS[cs?.difficulty ?? 'medium'] ?? 45;
    const effectiveTimer = (!gs.sparring && cs)
      ? Math.max(5, Math.min(baseTimer, 5 + (cs.durability / 100) * (baseTimer - 5)))
      : baseTimer;

    gs.effectiveTimer  = effectiveTimer;
    gs.timeLeft        = effectiveTimer;
    gs.currentQuestion = prepareQuestion(q);
    gs.selectedOptions = [];
    gs.timerRunning    = true;
    gs.screen          = 'question';
  }

  function onKeydown(e) {
    if (isAdvanceKey(e)) { e.preventDefault(); startFight(); }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- ── Top: headline + badges + CTA ─────────────────── -->
<div class="prefight-text">
  {#if gs.sparring}
    Sparring session.<br>No record. Just reps.
  {:else}
    Another fight.<br>Another question.
  {/if}
</div>
<div class="prefight-sub">
  {gs.sparring ? 'Learn the craft.' : 'Stay sharp.'}
</div>

<div class="prefight-badges">
  {#if mod}
    <span class="inline-badge" style="background:rgba(74,158,232,0.12);color:#4a9ee8">{mod.name}</span>
  {/if}
  {#if peekTier}
    <span class="inline-badge" style="background:{DIFF_BG[peekTier]};color:{DIFF_COLORS[peekTier]}">
      {DIFF_LABELS[peekTier]} difficulty
    </span>
  {/if}
</div>

<div class="prefight-btn-row">
  <button class="btn btn-primary" onclick={startFight}>
    {gs.sparring ? 'Step Into the Gym' : 'Step Into the Cage'}
  </button>
  {#if !gs.sparring && onsaveexit}
    <button class="btn btn-ghost pf-save-exit" onclick={() => onsaveexit?.()}>
      Save &amp; Exit
    </button>
  {/if}
</div>

<!-- Event notification — always below everything else -->
{#if !gs.sparring && cs?.pendingEvent && !cs.pendingEvent.choiceType}
  {@const ev = cs.pendingEvent}
  <div class="event-banner {ev.type}">
    <div class="ev-label">{ev.label}</div>
    <div class="ev-text">{ev.text}</div>
  </div>
{/if}

<style>
  .prefight-text {
    font-family: var(--font-display);
    font-size: 38px;
    letter-spacing: 0.02em;
    line-height: 1.1;
    margin-bottom: 10px;
  }
  .prefight-sub {
    color: var(--text-muted);
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .prefight-badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }
  .prefight-btn-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .pf-save-exit { font-size: 12px; padding: 8px 16px; }
  .inline-badge {
    display: inline-block;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 3px;
    font-weight: 500;
  }

  /* Event banner */
  .event-banner { border-radius: var(--radius); padding: 12px 16px; margin-top: 20px; border: 1px solid; }
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
</style>
