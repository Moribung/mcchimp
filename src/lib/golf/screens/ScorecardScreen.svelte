<!-- src/lib/golf/screens/ScorecardScreen.svelte -->
<!-- Shown after each completed hole: the running scorecard. -->
<script>
  import { state as gs } from '$lib/golf/state.svelte.js';
  import { parLabel, toParStr } from '$lib/golf/constants.js';
  import QuestionSetPicker from '$lib/golf/QuestionSetPicker.svelte';

  const { oncontinue, onsavequit, onswitchmodule = null, saving = false } = $props();

  const round = $derived(gs.round);
  const last  = $derived(round?.scorecard?.length ? round.scorecard[round.scorecard.length - 1] : null);
  const isLastHole = $derived(round && round.holeIdx + 1 >= (gs.course?.holeCount ?? 9));

  let showQsets = $state(false);
  const activeModName = $derived(gs.loadedModules?.[gs.activeModId]?.name || '—');

  function diffClass(strokes, par) {
    const d = strokes - par;
    if (d < 0)  return 'under';
    if (d === 0) return 'even';
    return 'over';
  }
</script>

{#if round && last}
<div class="card-wrap">
  <div class="hole-result">
    <div class="hr-label">Hole {last.num}</div>
    <div class="hr-score {diffClass(last.strokes, last.par)}">{parLabel(last.strokes, last.par)}</div>
    <div class="hr-sub">{last.strokes} strokes · Par {last.par}</div>
  </div>

  <div class="scorecard">
    <div class="sc-title">Scorecard</div>
    <table>
      <thead>
        <tr>
          <th>Hole</th>
          {#each round.scorecard as h}
            <th>{h.num}{#if round.scorecard.filter(x => x.num === h.num).length > 1}&nbsp;{/if}</th>
          {/each}
          <th class="tot">Tot</th>
        </tr>
        <tr>
          <th>Par</th>
          {#each round.scorecard as h}
            <th>{h.par}</th>
          {/each}
          <th class="tot">{round.scorecard.reduce((s, h) => s + h.par, 0)}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>You</td>
          {#each round.scorecard as h}
            <td class={diffClass(h.strokes, h.par)}>{h.strokes}</td>
          {/each}
          <td class="tot">{round.totalStrokes}</td>
        </tr>
      </tbody>
    </table>
    <div class="sc-topar">Running: <strong>{toParStr(round.toPar)}</strong></div>
  </div>

  <!-- Question set switcher (between holes) -->
  {#if onswitchmodule && !isLastHole}
    <div class="qset-section">
      <button class="qset-toggle" onclick={() => showQsets = !showQsets}>
        <span class="qset-toggle-label">Question Set</span>
        <span class="qset-toggle-current">{activeModName}</span>
        <span class="qset-toggle-chev">{showQsets ? '▾' : '▸'}</span>
      </button>
      {#if showQsets}
        <div class="qset-body">
          <p class="qset-note">Switching takes effect from the next hole.</p>
          <QuestionSetPicker selectedId={gs.activeModId} onselect={onswitchmodule} />
        </div>
      {/if}
    </div>
  {/if}

  <div class="actions">
    <button class="btn btn-ghost btn-sm" onclick={onsavequit} disabled={saving}>
      {saving ? 'Saving…' : 'Save & Quit'}
    </button>
    <button class="btn btn-primary btn-lg" onclick={oncontinue}>
      {isLastHole ? 'Finish Round →' : `Hole ${round.holeIdx + 2} →`}
    </button>
  </div>
</div>
{/if}

<style>
  .card-wrap { max-width: 480px; margin: 0 auto; padding: 40px 0 48px; display: flex; flex-direction: column; gap: 18px; }

  .hole-result {
    text-align: center; background: var(--surface); border: 1px solid var(--border);
    border-radius: 4px; padding: 26px 20px;
  }
  .hr-label { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
  .hr-score { font-family: var(--font-display); font-size: 52px; line-height: 1; letter-spacing: .02em; }
  .hr-score.under { color: var(--green); }
  .hr-score.even  { color: var(--gold); }
  .hr-score.over  { color: var(--red); }
  .hr-sub { font-size: 12px; color: var(--muted); margin-top: 8px; }

  .scorecard { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 16px; overflow-x: auto; }
  .sc-title { font-size: 10px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
  table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
  th, td { font-size: 12px; padding: 5px 6px; text-align: center; border-bottom: 1px solid var(--surface2); }
  th { color: var(--muted); font-weight: 600; }
  th:first-child, td:first-child { text-align: left; color: var(--muted); }
  td.under { color: var(--green); font-weight: 700; }
  td.even  { color: var(--gold); }
  td.over  { color: var(--red); }
  .tot { font-weight: 700; color: var(--text); border-left: 1px solid var(--border); }
  .sc-topar { font-size: 13px; color: var(--text-dim); margin-top: 10px; }
  .sc-topar strong { color: var(--gold); font-family: var(--font-display); font-size: 16px; }

  .qset-section { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; }
  .qset-toggle {
    width: 100%; display: flex; align-items: center; gap: 10px;
    background: none; border: none; cursor: pointer; padding: 12px 16px;
    color: var(--text); font-family: var(--font-body);
  }
  .qset-toggle-label { font-size: 10px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
  .qset-toggle-current { font-size: 13px; font-weight: 600; flex: 1; text-align: right; color: var(--gold); }
  .qset-toggle-chev { color: var(--muted); font-size: 11px; }
  .qset-body { padding: 0 16px 16px; }
  .qset-note { font-size: 11px; color: var(--muted); font-style: italic; margin-bottom: 10px; }

  .actions { display: flex; justify-content: space-between; align-items: center; }

  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; white-space: nowrap; }
  .btn:hover  { opacity: .85; }
  .btn:disabled { opacity: .35; cursor: not-allowed; }
  .btn-primary { background: var(--gold); color: #0a0a0c; }
  .btn-ghost   { background: transparent; color: var(--text-dim); border: 1px solid var(--border); }
  .btn-lg { padding: 14px 32px; font-size: 15px; letter-spacing: .1em; }
  .btn-sm { padding: 6px 12px; font-size: 11px; }
</style>
