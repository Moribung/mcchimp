<!-- Classic oscillating swing meter: press to start, press again to lock power. -->
<script>
  let {
    active = false,           // meter is interactive
    maxYd = 250,              // full-meter distance preview
    isPutt = false,
    value = $bindable(0),     // 0..1, exposed so the golfer windup can track it
    onlock = () => {},
  } = $props();

  let running = $state(false);
  let raf = 0;
  let startT = 0;

  const period = $derived(isPutt ? 1800 : 1400);

  $effect(() => {
    // reset when (re)activated
    if (active) { running = false; value = 0; }
    return () => cancelAnimationFrame(raf);
  });

  function valueAt(now) {
    const t = ((now - startT) % period) / period;     // 0..1 sawtooth
    return t < 0.5 ? t * 2 : (1 - t) * 2;             // triangle 0→1→0
  }

  function tick(now) {
    if (!running) return;
    value = valueAt(now);
    raf = requestAnimationFrame(tick);
  }

  function press() {
    if (!active) return;
    if (!running) {
      running = true;
      startT = performance.now();
      raf = requestAnimationFrame(tick);
    } else {
      running = false;
      cancelAnimationFrame(raf);
      // compute from the clock, not the last painted frame — exact even if
      // rendering is throttled (hidden tab, slow device)
      value = valueAt(performance.now());
      onlock(Math.max(0.05, value));
    }
  }

  function onKey(e) {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); press(); }
  }
</script>

<svelte:window onkeydown={active ? onKey : undefined} />

<div class="meter-wrap">
  <div class="meter-track" role="button" tabindex="0" onpointerdown={press} onkeydown={onKey}>
    <div class="meter-fill" style="width: {value * 100}%"></div>
    <div class="meter-needle" style="left: {value * 100}%"></div>
  </div>
  <div class="meter-row">
    <span class="meter-yd">{Math.round(maxYd * value)} yd</span>
    <span class="meter-hint">
      {#if !running}{isPutt ? 'Tap to start the stroke' : 'Tap to start the swing'}{:else}Tap to strike!{/if}
    </span>
    <span class="meter-max">{Math.round(maxYd)} yd</span>
  </div>
</div>

<style>
  .meter-wrap { width: 100%; }
  .meter-track {
    position: relative; height: 26px; border-radius: 3px; cursor: pointer;
    background: linear-gradient(90deg,
      rgba(62,207,106,.25) 0%, rgba(232,153,74,.25) 60%, rgba(224,82,82,.3) 100%);
    border: 1px solid var(--border);
    overflow: hidden;
    touch-action: manipulation;
  }
  .meter-fill {
    position: absolute; inset: 0 auto 0 0;
    background: linear-gradient(90deg, var(--green), var(--gold));
    opacity: .75;
  }
  .meter-needle {
    position: absolute; top: -2px; bottom: -2px; width: 2px;
    background: #fff; transform: translateX(-1px);
    box-shadow: 0 0 6px rgba(255,255,255,.7);
  }
  .meter-row {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-top: 6px;
  }
  .meter-yd  { font-family: var(--font-display); font-size: 18px; color: var(--gold); min-width: 64px; }
  .meter-max { font-size: 11px; color: var(--muted); }
  .meter-hint { font-size: 11px; color: var(--text-dim); letter-spacing: .06em; text-transform: uppercase; }
</style>
