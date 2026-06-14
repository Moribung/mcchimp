<!-- src/lib/racing/screens/ResultScreen.svelte -->
<script>
  import { state as gs } from '$lib/racing/state.svelte.js';
  import { FIELD_SIZE, ordinal } from '$lib/racing/constants.js';

  const { onagain, onmenu } = $props();

  const r = $derived(gs.race);
  const finish = $derived(r.finishPos);
  const moved  = $derived(r.startPos - finish); // positive = climbed

  const verdict = $derived((() => {
    if (finish === 1) return { head: 'WINNER', sub: 'Top step of the podium.', cls: 'win' };
    if (finish <= 3)  return { head: 'PODIUM', sub: `${ordinal(finish)} place finish.`, cls: 'win' };
    if (finish <= Math.ceil(FIELD_SIZE / 2)) return { head: 'POINTS', sub: `Solid drive — ${ordinal(finish)}.`, cls: 'ok' };
    return { head: 'CHEQUERED FLAG', sub: `Finished ${ordinal(finish)}.`, cls: 'meh' };
  })());

  const movedLabel = $derived(
    moved > 0 ? `+${moved} places gained`
    : moved < 0 ? `${moved} places lost`
    : 'held your grid slot'
  );
</script>

<div class="result">
  <div class="res-header res-{verdict.cls}">
    <div class="res-finish">{ordinal(finish)}</div>
    <div class="res-head">{verdict.head}</div>
    <div class="res-sub">{verdict.sub}</div>
  </div>

  <div class="stats">
    <div class="stat">
      <span class="stat-val">{r.startPos}{moved > 0 ? ' → ' : moved < 0 ? ' → ' : ''}{moved !== 0 ? finish : ''}</span>
      <span class="stat-label">Grid → Finish</span>
    </div>
    <div class="stat">
      <span class="stat-val" class:up={moved > 0} class:down={moved < 0}>{movedLabel}</span>
      <span class="stat-label">Net</span>
    </div>
  </div>

  <div class="recap">
    <div class="recap-row"><span>Overtakes made</span><strong>{r.recap.overtakes}</strong></div>
    <div class="recap-row"><span>Best overtake streak</span><strong>{r.recap.bestStreak}</strong></div>
    <div class="recap-row"><span>Places lost</span><strong>{r.recap.lost}</strong></div>
    <div class="recap-row"><span>Pit stops</span><strong>{r.pitsMade}</strong></div>
    {#if r.pitsMade > 0}
      <div class="recap-row"><span>Time lost in pits</span><strong>{(r.recap.pitTimeMs / 1000).toFixed(1)}s</strong></div>
    {/if}
  </div>

  <div class="actions">
    <button class="btn btn-ghost" onclick={onmenu}>Menu</button>
    <button class="btn btn-primary btn-lg" onclick={onagain}>Race Again →</button>
  </div>
</div>

<style>
  .result { max-width: 440px; margin: 0 auto; padding: 40px 0; }

  .res-header { text-align: center; margin-bottom: 28px; }
  .res-finish { font-family: var(--font-display); font-size: 96px; line-height: .9; letter-spacing: .02em; }
  .res-head { font-family: var(--font-display); font-size: 28px; letter-spacing: .08em; margin-top: 4px; }
  .res-sub { font-size: 13px; color: var(--text-muted); margin-top: 6px; }
  .res-win .res-finish, .res-win .res-head { color: var(--accent); }
  .res-ok .res-finish, .res-ok .res-head { color: var(--green); }
  .res-meh .res-finish { color: var(--text); }
  .res-meh .res-head { color: var(--muted); }

  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 14px; text-align: center; display: flex; flex-direction: column; gap: 4px; }
  .stat-val { font-family: var(--font-display); font-size: 20px; letter-spacing: .02em; }
  .stat-val.up { color: var(--green); }
  .stat-val.down { color: var(--red); }
  .stat-label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; }

  .recap { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 6px 16px; margin-bottom: 24px; }
  .recap-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; font-size: 13px; color: var(--text-muted); border-bottom: 1px solid var(--border); }
  .recap-row:last-child { border-bottom: none; }
  .recap-row strong { color: var(--text); font-family: var(--font-display); font-size: 16px; }

  .actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .btn { display: inline-flex; align-items: center; justify-content: center; padding: 11px 24px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; }
  .btn:hover { opacity: .85; }
  .btn-primary { background: var(--accent); color: #0a0a0c; }
  .btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }
  .btn-lg { padding: 14px 30px; font-size: 15px; letter-spacing: .08em; }
</style>
