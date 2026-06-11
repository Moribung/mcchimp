<!-- src/lib/golf/screens/RoundEndScreen.svelte -->
<script>
  import { state as gs } from '$lib/golf/state.svelte.js';
  import { toParStr } from '$lib/golf/constants.js';

  const { onmenu } = $props();

  const round  = $derived(gs.round);
  const career = $derived(gs.career);

  const tally = $derived.by(() => {
    const t = { holesInOne: 0, eagles: 0, birdies: 0, pars: 0, bogeys: 0, worse: 0 };
    for (const h of (round?.scorecard || [])) {
      const d = h.strokes - h.par;
      if (h.strokes === 1) t.holesInOne++;
      else if (d <= -2) t.eagles++;
      else if (d === -1) t.birdies++;
      else if (d === 0) t.pars++;
      else if (d === 1) t.bogeys++;
      else t.worse++;
    }
    return t;
  });

  const verdict = $derived.by(() => {
    const tp = round?.toPar ?? 0;
    if (tp < 0)   return 'Under par — a round to remember.';
    if (tp === 0) return 'Level par. Solid as they come.';
    if (tp <= 5)  return 'A few got away from you — respectable round.';
    return 'A tough day on the course. The questions won this time.';
  });
</script>

{#if round}
<div class="end-wrap">
  <div class="final-card">
    <div class="final-label">Round Complete · {gs.course?.holeCount ?? round.scorecard.length} Holes</div>
    <div class="final-score">{toParStr(round.toPar)}</div>
    <div class="final-strokes">{round.totalStrokes} strokes</div>
    <p class="final-verdict">{verdict}</p>
  </div>

  <div class="tally-grid">
    {#if tally.holesInOne}<div class="tally hio"><span class="tally-n">{tally.holesInOne}</span><span class="tally-l">Hole-in-One</span></div>{/if}
    {#if tally.eagles}<div class="tally under"><span class="tally-n">{tally.eagles}</span><span class="tally-l">Eagles</span></div>{/if}
    <div class="tally under"><span class="tally-n">{tally.birdies}</span><span class="tally-l">Birdies</span></div>
    <div class="tally even"><span class="tally-n">{tally.pars}</span><span class="tally-l">Pars</span></div>
    <div class="tally over"><span class="tally-n">{tally.bogeys}</span><span class="tally-l">Bogeys</span></div>
    <div class="tally over"><span class="tally-n">{tally.worse}</span><span class="tally-l">Worse</span></div>
  </div>

  {#if career}
    <div class="career-card">
      <div class="career-title">Career</div>
      <div class="career-grid">
        <div><span class="cnum">{career.roundsPlayed}</span><span class="clab">Rounds</span></div>
        <div><span class="cnum">{career.bestToPar === null ? '—' : toParStr(career.bestToPar)}</span><span class="clab">Best Round</span></div>
        <div><span class="cnum">{career.birdies}</span><span class="clab">Birdies</span></div>
        <div><span class="cnum">{career.eagles + career.holesInOne}</span><span class="clab">Eagles+</span></div>
      </div>
    </div>
  {/if}

  <button class="btn btn-primary btn-lg" onclick={onmenu}>Back to Clubhouse</button>
</div>
{/if}

<style>
  .end-wrap { max-width: 480px; margin: 0 auto; padding: 40px 0 48px; display: flex; flex-direction: column; gap: 16px; }

  .final-card {
    text-align: center; background: var(--surface); border: 1px solid var(--border);
    border-radius: 4px; padding: 32px 20px;
  }
  .final-label { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
  .final-score { font-family: var(--font-display); font-size: 80px; line-height: 1; color: var(--gold); }
  .final-strokes { font-size: 14px; color: var(--text-dim); margin-top: 6px; }
  .final-verdict { font-size: 13px; color: var(--muted); margin-top: 14px; font-style: italic; }

  .tally-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(86px, 1fr)); gap: 8px; }
  .tally {
    background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
    padding: 12px 8px; text-align: center; display: flex; flex-direction: column; gap: 2px;
  }
  .tally-n { font-family: var(--font-display); font-size: 26px; line-height: 1; }
  .tally-l { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .tally.hio .tally-n   { color: var(--purple, #a855f7); }
  .tally.under .tally-n { color: var(--green); }
  .tally.even .tally-n  { color: var(--gold); }
  .tally.over .tally-n  { color: var(--red); }

  .career-card { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 16px; }
  .career-title { font-size: 10px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; }
  .career-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; }
  .career-grid > div { display: flex; flex-direction: column; gap: 2px; }
  .cnum { font-family: var(--font-display); font-size: 22px; color: var(--text); }
  .clab { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }

  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; white-space: nowrap; }
  .btn:hover { opacity: .85; }
  .btn-primary { background: var(--gold); color: #0a0a0c; }
  .btn-lg { padding: 14px 32px; font-size: 15px; letter-spacing: .1em; }
</style>
