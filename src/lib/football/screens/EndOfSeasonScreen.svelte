<!-- src/lib/football/screens/EndOfSeasonScreen.svelte -->
<script>
  import { state as gs }       from '$lib/football/state.svelte.js';
  import { ordinal, divName }  from '$lib/football/utils.js';
  import { isAdvanceKey }      from '$lib/uiKeys.js';

  const { oncontinue } = $props();

  const d = $derived(gs._eosData);

  const statusInfo = $derived.by(() => {
    if (!d) return null;
    if (d.status === 'promoted')  return { title: 'PROMOTED!', cls: 'promotion',  body: `${gs.club.name} go up to ${divName(d.finishDiv - 1)}!` };
    if (d.status === 'relegated') return { title: 'RELEGATED', cls: 'relegation', body: `${gs.club.name} drop to ${divName(d.finishDiv + 1)}.` };
    if (d.finishPos === 1)        return { title: 'CHAMPIONS!', cls: 'promotion', body: `${gs.club.name} win ${divName(d.finishDiv)}!` };
    return { title: ordinal(d.finishPos) + ' PLACE', cls: 'safe', body: 'Another season in the books. Push on.' };
  });

  // Final table for the player's division (the one just played)
  const finalTable = $derived(d ? (d.finishDiv === 1 ? d.finalDiv1 : d.finalDiv2) : []);

  let showFullTable = $state(false);
  const visibleTable = $derived(showFullTable ? finalTable : finalTable.slice(0, 6));

  function onKeydown(e) {
    if (isAdvanceKey(e)) { e.preventDefault(); oncontinue?.(); }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if d && statusInfo}
<div class="eos-screen">
  <!-- Header -->
  <div class="eos-header">
    <div class="eos-season">Season {d.season} · {divName(d.finishDiv)}</div>
    <div class="eos-subtitle">End of Season Report</div>
  </div>

  <!-- Status banner -->
  <div class="status-banner {statusInfo.cls}">
    <div class="status-title">{statusInfo.title}</div>
    <div class="status-body">{statusInfo.body}</div>
  </div>

  <!-- Awards -->
  <div class="awards-grid">
    <div class="award-card">
      <div class="award-label">⚽ Top Scorer</div>
      {#if d.topScorer}
        <div class="award-name">{d.topScorer.name}</div>
        <div class="award-detail">{d.topScorer.goals} goals · {d.topScorer.position}</div>
      {:else}
        <div class="award-detail muted">No goals scored</div>
      {/if}
    </div>
    <div class="award-card">
      <div class="award-label">★ Player of the Season</div>
      {#if d.playerOfSeason}
        <div class="award-name">{d.playerOfSeason.name}</div>
        <div class="award-detail">Rating {d.playerOfSeason.rating} · {d.playerOfSeason.position}</div>
      {:else}
        <div class="award-detail muted">—</div>
      {/if}
    </div>
  </div>

  <!-- Squad development -->
  {#if d.development.length}
    <div class="card mb-16">
      <div class="section-label">Squad Development</div>
      <div class="dev-list">
        {#each d.development.slice(0, 8) as p}
          <div class="dev-row">
            <span class="dev-name">{p.name}</span>
            <span class="dev-pos">{p.position}</span>
            <span class="dev-age">{p.age}y</span>
            <span class="dev-rating">{p.rating}</span>
            <span class="dev-change" class:up={p.change > 0} class:down={p.change < 0}>
              {p.change > 0 ? '+' : ''}{p.change}
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Retirements -->
  {#if d.retired.length}
    <div class="card mb-16">
      <div class="section-label">Retirements</div>
      <div class="retire-list">
        {#each d.retired as p}
          <div class="retire-row">
            <span class="retire-name">{p.name}</span>
            <span class="retire-detail">{p.position} · Age {p.age} · Rtg {p.rating}</span>
            <span class="retire-tag">Retired — youth promoted</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Final table -->
  <div class="card card-flush mb-20">
    <div class="table-head">Final Table — {divName(d.finishDiv)}</div>
    <table class="final-table">
      <thead>
        <tr>
          <th class="pos">#</th>
          <th>Club</th>
          <th class="num">W</th>
          <th class="num">D</th>
          <th class="num">L</th>
          <th class="num">Pts</th>
        </tr>
      </thead>
      <tbody>
        {#each visibleTable as row}
          <tr class:player-row={row.id === 'player'}>
            <td class="pos">{row.pos}</td>
            <td class="club-name">{row.name}</td>
            <td class="num">{row.w}</td>
            <td class="num">{row.d}</td>
            <td class="num">{row.l}</td>
            <td class="num pts">{row.pts}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if finalTable.length > 6}
      <button class="table-toggle" onclick={() => showFullTable = !showFullTable}>
        {showFullTable ? 'Show less' : `Show all ${finalTable.length}`}
      </button>
    {/if}
  </div>

  <!-- Continue -->
  <div class="eos-actions">
    <button class="btn btn-primary btn-lg" onclick={() => oncontinue?.()}>
      Begin Season {gs.season} →
    </button>
  </div>
</div>
{/if}

<style>
  .eos-screen { max-width: 540px; margin: 0 auto; padding: 32px 20px 48px; }

  .eos-header { text-align: center; margin-bottom: 20px; }
  .eos-season   { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .12em; }
  .eos-subtitle { font-family: var(--font-display); font-size: 24px; color: var(--text); letter-spacing: .04em; margin-top: 4px; }

  /* Status banner */
  .status-banner {
    text-align: center; border-radius: 4px; padding: 20px;
    margin-bottom: 24px; border: 1px solid var(--border);
  }
  .status-banner.promotion  { background: rgba(62,207,106,.1);  border-color: rgba(62,207,106,.3); }
  .status-banner.relegation { background: rgba(224,82,82,.1);   border-color: rgba(224,82,82,.3); }
  .status-banner.safe       { background: var(--surface); }
  .status-title {
    font-family: var(--font-display); font-size: 40px; letter-spacing: .04em; line-height: 1;
  }
  .status-banner.promotion  .status-title { color: var(--green); }
  .status-banner.relegation .status-title { color: var(--red); }
  .status-banner.safe       .status-title { color: var(--gold); }
  .status-body { font-size: 13px; color: var(--text-dim); margin-top: 8px; }

  /* Awards */
  .awards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .award-card { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 14px 16px; }
  .award-label  { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
  .award-name   { font-family: var(--font-display); font-size: 18px; color: var(--gold); letter-spacing: .02em; }
  .award-detail { font-size: 12px; color: var(--text-dim); margin-top: 2px; }
  .award-detail.muted { color: var(--muted); }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 14px 16px; }
  .card-flush { padding: 0; overflow: hidden; }
  .mb-16 { margin-bottom: 16px; }
  .mb-20 { margin-bottom: 20px; }
  .section-label { font-size: 10px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }

  /* Development */
  .dev-list { display: flex; flex-direction: column; gap: 2px; }
  .dev-row  { display: flex; align-items: center; gap: 10px; padding: 5px 0; border-bottom: 1px solid var(--surface2); font-size: 13px; }
  .dev-row:last-child { border-bottom: none; }
  .dev-name   { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dev-pos    { font-size: 10px; color: var(--muted); min-width: 28px; }
  .dev-age    { font-size: 11px; color: var(--muted); min-width: 28px; text-align: right; }
  .dev-rating { font-variant-numeric: tabular-nums; min-width: 24px; text-align: right; color: var(--text-dim); }
  .dev-change { font-variant-numeric: tabular-nums; min-width: 32px; text-align: right; font-weight: 600; }
  .dev-change.up   { color: var(--green); }
  .dev-change.down { color: var(--red); }

  /* Retirements */
  .retire-list { display: flex; flex-direction: column; gap: 6px; }
  .retire-row  { display: flex; align-items: center; gap: 10px; font-size: 13px; flex-wrap: wrap; }
  .retire-name { font-weight: 500; }
  .retire-detail { font-size: 11px; color: var(--muted); }
  .retire-tag  { font-size: 10px; color: var(--amber); margin-left: auto; }

  /* Final table */
  .table-head { padding: 8px 14px; border-bottom: 1px solid var(--border); font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .final-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .final-table th { font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); padding: 6px 10px; text-align: left; }
  .final-table th.num { text-align: right; }
  .final-table td { padding: 7px 10px; border-top: 1px solid var(--surface2); font-variant-numeric: tabular-nums; }
  .final-table td.num { text-align: right; color: var(--text-dim); }
  .final-table .pos { color: var(--muted); width: 24px; }
  .final-table .club-name { font-weight: 500; }
  .final-table .pts { color: var(--text); font-weight: 600; }
  .final-table tr.player-row td { color: var(--gold); background: rgba(212,168,71,.07); }
  .table-toggle { width: 100%; background: var(--surface2); border: none; border-top: 1px solid var(--border); color: var(--muted); font-family: var(--font-body); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; padding: 8px; cursor: pointer; transition: color .15s; }
  .table-toggle:hover { color: var(--text); }

  .eos-actions { text-align: center; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 24px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; }
  .btn:hover { opacity: .85; }
  .btn-primary { background: var(--gold); color: #0a0a0c; }
  .btn-lg { padding: 14px 32px; font-size: 15px; letter-spacing: .1em; }

  @media (max-width: 560px) {
    .awards-grid { grid-template-columns: 1fr; }
    .status-title { font-size: 32px; }
  }
</style>
