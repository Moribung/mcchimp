<!-- src/lib/racing/screens/PitStopScreen.svelte -->
<!-- Pit stop: drive into the bay, change each worn tyre (one EASY question per
     tyre on a tight countdown), then drive back out. -->
<script>
  import { onMount } from 'svelte';
  import { state as gs } from '$lib/racing/state.svelte.js';
  import { PIT_TIMER_MS } from '$lib/racing/constants.js';
  import { bakeCar } from '$lib/racing/carSprites.js';
  import QuestionCard from './QuestionCard.svelte';

  const { onpitanswer, onpitcomplete } = $props();

  const r   = $derived(gs.race);
  const pit = $derived(r.pit);
  const tyreNum = $derived(pit.tireIdx + 1);

  const player = gs.race.field.find(c => c.isPlayer);
  const carUrl = bakeCar(player?.variant ?? 0, player?.color ?? '#E8C14A');

  let phase   = $state('in');   // in | stopped | out
  let carLeft = $state(-18);    // % across the bay

  onMount(() => {
    const raf = requestAnimationFrame(() => { carLeft = 42; });   // drive in
    const t   = setTimeout(() => { phase = 'stopped'; }, 950);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  });

  // All tyres done → drive out → hand back to the race.
  let exiting = false;
  $effect(() => {
    if (pit?.done && phase === 'stopped' && !exiting) {
      exiting = true;
      phase = 'out';
      carLeft = 122;
      setTimeout(() => onpitcomplete?.(), 1000);
    }
  });

  const statusText = $derived(
    phase === 'in'  ? 'Entering the pit lane…'
    : phase === 'out' ? 'Tyres on — go, go, go!'
    : `Change tyre ${tyreNum} of ${pit.tiresToChange}`
  );
</script>

<div class="pit">
  <div class="pit-header">
    <div class="pit-title">PIT STOP</div>
    <div class="pit-sub">{statusText}</div>
  </div>

  <!-- The bay -->
  <div class="bay">
    <div class="garage"><span class="garage-sign">PIT</span></div>
    <div class="tstack"><span></span><span></span><span></span></div>
    <div class="wall"></div>
    <div class="lane"></div>
    <img class="pit-car" class:working={phase === 'stopped'} src={carUrl} alt="" style="left:{carLeft}%" />
  </div>

  <!-- Tyre progress -->
  <div class="tyres">
    {#each Array(pit.tiresToChange) as _, i}
      {@const res = pit.results[i]}
      <div class="tyre-dot"
        class:done-good={res?.correct}
        class:done-bad={res && !res.correct}
        class:active={phase === 'stopped' && i === pit.tireIdx}>
        {#if res}{res.correct ? '✓' : '✗'}{:else}●{/if}
      </div>
    {/each}
  </div>

  <div class="pit-panel">
    {#if phase === 'stopped'}
      {#key pit.tireIdx}
        <QuestionCard q={pit.q} timerMs={PIT_TIMER_MS} submitLabel="Fit Tyre" accent="var(--green)" onanswer={onpitanswer} />
      {/key}
    {:else}
      <div class="pit-wait">{phase === 'in' ? 'Pulling into the box…' : 'Pulling away…'}</div>
    {/if}
  </div>

  <p class="pit-foot">A fast, correct answer fits the tyre clean. Fumble it and you lose places in the lane.</p>
</div>

<style>
  .pit { max-width: 480px; margin: 0 auto; padding: 24px 0 40px; }
  .pit-header { text-align: center; margin-bottom: 16px; }
  .pit-title { font-family: var(--font-display); font-size: 44px; letter-spacing: .06em; color: var(--green); line-height: 1; }
  .pit-sub { font-size: 13px; color: var(--text-muted); margin-top: 6px; text-transform: uppercase; letter-spacing: .08em; }

  /* ── Pit bay ─────────────────────────────────────────── */
  .bay { position: relative; height: 120px; border-radius: 6px; overflow: hidden; background: #1b241f; border: 1px solid var(--border); margin-bottom: 18px; }
  .garage { position: absolute; left: 36%; top: 10px; width: 96px; height: 42px; background: #23282b; border: 1px solid #40464d; border-radius: 3px; display: flex; align-items: center; justify-content: center; }
  .garage-sign { font-family: var(--font-display); color: var(--green); font-size: 18px; letter-spacing: .12em; }
  .tstack { position: absolute; left: 30%; bottom: 62px; display: flex; gap: 3px; }
  .tstack span { width: 9px; height: 9px; border-radius: 50%; background: #15171b; border: 1px solid #2a2e33; }
  .wall { position: absolute; left: 0; right: 0; bottom: 56px; height: 5px; background: repeating-linear-gradient(90deg, #d94040 0 12px, #e9e6dd 12px 24px); opacity: .85; }
  .lane { position: absolute; left: 0; right: 0; bottom: 0; height: 56px; background: #3a4047; border-top: 1px solid #4a515a; }
  .pit-car { position: absolute; bottom: 16px; width: 50px; height: auto; transform: translateX(-50%); transition: left 1s ease-in-out; }
  .pit-car.working { animation: bob 0.6s ease-in-out infinite alternate; }
  @keyframes bob { from { bottom: 16px; } to { bottom: 18px; } }

  /* ── Tyre dots + question ────────────────────────────── */
  .tyres { display: flex; justify-content: center; gap: 12px; margin-bottom: 18px; }
  .tyre-dot {
    width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--surface2); border: 1px solid var(--border); font-size: 14px; color: var(--muted); transition: all .2s;
  }
  .tyre-dot.active { border-color: var(--green); color: var(--green); box-shadow: 0 0 0 3px rgba(62,207,106,.15); }
  .tyre-dot.done-good { border-color: var(--green); color: var(--green); background: var(--green-dim); }
  .tyre-dot.done-bad  { border-color: var(--red);   color: var(--red);   background: var(--red-dim); }

  .pit-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 18px; min-height: 80px; display: flex; flex-direction: column; justify-content: center; }
  .pit-wait { text-align: center; color: var(--text-muted); font-size: 14px; font-style: italic; }
  .pit-foot { font-size: 11px; color: var(--muted); text-align: center; margin-top: 14px; font-style: italic; line-height: 1.5; }
</style>
