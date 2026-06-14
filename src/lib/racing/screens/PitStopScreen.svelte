<!-- src/lib/racing/screens/PitStopScreen.svelte -->
<!-- The pit stop: one EASY question per worn tyre, each on a tight countdown.
     Fast + correct = quick change; slow or wrong = lost time. -->
<script>
  import { state as gs } from '$lib/racing/state.svelte.js';
  import { PIT_TIMER_MS } from '$lib/racing/constants.js';
  import QuestionCard from './QuestionCard.svelte';

  const { onpitanswer } = $props();

  const r       = $derived(gs.race);
  const pit     = $derived(r.pit);
  const tyreNum = $derived(pit.tireIdx + 1);
</script>

<div class="pit">
  <div class="pit-header">
    <div class="pit-title">PIT STOP</div>
    <div class="pit-sub">Quick! Change tyre {tyreNum} of {pit.tiresToChange}</div>
  </div>

  <!-- Tyre progress -->
  <div class="tyres">
    {#each Array(pit.tiresToChange) as _, i}
      {@const res = pit.results[i]}
      <div class="tyre-dot"
        class:done-good={res?.correct}
        class:done-bad={res && !res.correct}
        class:active={i === pit.tireIdx}>
        {#if res}{res.correct ? '✓' : '✗'}{:else}🛞{/if}
      </div>
    {/each}
  </div>

  <div class="pit-panel">
    {#key pit.tireIdx}
      <QuestionCard
        q={pit.q}
        timerMs={PIT_TIMER_MS}
        submitLabel="Fit Tyre"
        accent="var(--green)"
        onanswer={onpitanswer} />
    {/key}
  </div>

  <p class="pit-foot">A fast, correct answer fits the tyre clean. Fumble it and you lose places in the lane.</p>
</div>

<style>
  .pit { max-width: 480px; margin: 0 auto; padding: 24px 0 40px; }
  .pit-header { text-align: center; margin-bottom: 18px; }
  .pit-title { font-family: var(--font-display); font-size: 44px; letter-spacing: .06em; color: var(--green); line-height: 1; }
  .pit-sub { font-size: 13px; color: var(--text-muted); margin-top: 6px; text-transform: uppercase; letter-spacing: .08em; }

  .tyres { display: flex; justify-content: center; gap: 12px; margin-bottom: 20px; }
  .tyre-dot {
    width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--surface2); border: 1px solid var(--border); font-size: 16px; transition: all .2s;
  }
  .tyre-dot.active { border-color: var(--green); box-shadow: 0 0 0 3px rgba(62,207,106,.15); }
  .tyre-dot.done-good { border-color: var(--green); color: var(--green); background: var(--green-dim); }
  .tyre-dot.done-bad  { border-color: var(--red);   color: var(--red);   background: var(--red-dim); }

  .pit-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 18px; }
  .pit-foot { font-size: 11px; color: var(--muted); text-align: center; margin-top: 14px; font-style: italic; line-height: 1.5; }
</style>
