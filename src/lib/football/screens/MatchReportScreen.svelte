<!-- src/lib/football/screens/MatchReportScreen.svelte -->
<script>
  import { state as gs }            from '$lib/football/state.svelte.js';
  import { sortTable, getClubName } from '$lib/football/league.js';
  import { pickFlavour }            from '$lib/football/flavour.js';
  import { ordinal, divName }       from '$lib/football/utils.js';
  import { relegationCount, DIFF_LABELS } from '$lib/football/constants.js';
  import { isAdvanceKey }            from '$lib/uiKeys.js';

  const { oncontinue } = $props();

  const cm      = $derived(gs.currentMatch);
  const result  = $derived(cm?._result || (cm?.playerGoals > cm?.oppGoals ? 'W' : cm?.playerGoals < cm?.oppGoals ? 'L' : 'D'));
  const oppName = $derived(cm ? getClubName(cm.opponentId, gs.table?.div1 || [], gs.table?.div2 || []) : '?');
  const hName   = $derived(cm?.isHome ? gs.club?.name : oppName);
  const aName   = $derived(cm?.isHome ? oppName : gs.club?.name);
  const hG      = $derived(cm?.isHome ? cm?.playerGoals : cm?.oppGoals);
  const aG      = $derived(cm?.isHome ? cm?.oppGoals    : cm?.playerGoals);

  const playerAhead = $derived((cm?.playerGoals || 0) > (cm?.oppGoals || 0));
  const oppAhead    = $derived((cm?.oppGoals    || 0) > (cm?.playerGoals || 0));
  const hScoreCol   = $derived(cm?.isHome ? (playerAhead ? 'var(--green)' : oppAhead ? 'var(--red)' : 'var(--text)') : (oppAhead ? 'var(--red)' : 'var(--text)'));
  const aScoreCol   = $derived(cm?.isHome ? (oppAhead ? 'var(--red)' : 'var(--text)') : (playerAhead ? 'var(--green)' : oppAhead ? 'var(--red)' : 'var(--text)'));

  const divTable  = $derived(sortTable(gs.table?.[`div${gs.division}`] || []));
  const divTotal  = $derived(divTable.length);
  const relCount  = $derived(relegationCount(divTotal));
  const playerPos = $derived(divTable.findIndex(r => r.id === 'player') + 1);

  const posBefore = $derived(cm?.positionBefore || playerPos);
  const posDiff   = $derived(posBefore - playerPos);

  const flavour = $derived(cm ? pickFlavour(result, cm.playerGoals, cm.oppGoals, cm.isHome, {
    scorers: cm.goalScorers, playerPos, total: divTotal,
    matchday: gs.matchday, totalMatchdays: gs.matchdays, season: gs.season,
    opponentName: oppName, form: gs.form, division: gs.division,
  }) : '');

  const scorers = $derived(cm ? [...cm.goalScorers].sort((a, b) => a.minute - b.minute) : []);

  // ── Tier shifts grouped ───────────────────────────────
  const tierGroups = $derived.by(() => {
    const changes = cm?.tierChanges || [];
    if (!changes.length) return [];
    const tiers = ['easy', 'medium', 'hard', 'elite'];
    const groups = {};
    for (const { from, to } of changes) {
      const dir = tiers.indexOf(to) > tiers.indexOf(from) ? 'promoted' : 'demoted';
      const key = `${dir}|${to}`;
      groups[key] = (groups[key] || 0) + 1;
    }
    return Object.entries(groups).map(([key, n]) => {
      const [dir, tier] = key.split('|');
      return { dir, tier, n };
    });
  });

  // ── Kit bar ───────────────────────────────────────────
  function kitBar(clubId) {
    if (clubId === 'player') {
      const col = gs.club?.kitColour || '#888';
      return `<span class="kit-bar"><span style="background:${col};flex:1;height:100%"></span></span>`;
    }
    const row = (gs.table?.div1 || []).concat(gs.table?.div2 || []).find(r => r.id === clubId);
    const segs = (row?.colours || []).map(c => `<span style="background:${c};flex:1;height:100%"></span>`).join('');
    return segs ? `<span class="kit-bar">${segs}</span>` : '';
  }

  function posColor(pos) {
    if (pos > divTotal - relCount) return 'var(--red)';
    if (gs.division === 2 && pos <= relCount) return 'var(--green)';
    if (gs.division === 1) {
      if (pos === 1) return 'var(--gold)';
      if (pos <= (divTotal <= 8 ? 2 : divTotal <= 14 ? 3 : 4)) return 'var(--purple)';
    }
    return null;
  }

  // Mini table: top 5 + player (if outside) + relegation zone
  const miniRows = $derived.by(() => {
    const rows = [];
    const seen = new Set();
    const add = (r, pos) => { if (!seen.has(r.id)) { rows.push({ ...r, _pos: pos }); seen.add(r.id); } };
    divTable.slice(0, 5).forEach((r, i) => add(r, i + 1));
    if (playerPos > 5) {
      rows.push({ _sep: true });
      add(divTable[playerPos - 1], playerPos);
    }
    if (divTotal > 7) {
      rows.push({ _sep: true });
      divTable.slice(divTotal - relCount).forEach((r, i) => add(r, divTotal - relCount + i + 1));
    }
    return rows;
  });

  function onKeydown(e) {
    if (isAdvanceKey(e)) { e.preventDefault(); oncontinue?.(); }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if cm}
<div class="report-screen">
  <!-- Scoreline -->
  <div class="report-scoreline">
    <div class="report-score">
      <span style="color:{hScoreCol}">{hG}</span>
      <span class="score-dash">–</span>
      <span style="color:{aScoreCol}">{aG}</span>
    </div>
    <div class="report-clubs">
      <span class="report-club">{@html kitBar(cm.isHome ? 'player' : cm.opponentId)}{hName}</span>
      <span class="report-club right">{aName}{@html kitBar(cm.isHome ? cm.opponentId : 'player')}</span>
    </div>
  </div>

  <!-- Result badge -->
  <div class="report-badge-row">
    <span class="result-badge {result === 'W' ? 'win' : result === 'D' ? 'draw' : 'loss'}">
      {result === 'W' ? 'WIN' : result === 'D' ? 'DRAW' : 'LOSS'}
    </span>
  </div>

  <!-- Goalscorers -->
  <div class="card mb-14">
    <div class="section-label">Goalscorers</div>
    {#if scorers.length}
      {#each scorers as g}
        <div class="scorer-row">
          <span class="scorer-min">{g.minute}'</span>
          <span class="scorer-name" style="color:{g.isPlayer ? 'var(--gold)' : 'var(--text)'}">{g.name}</span>
          <span class="scorer-club">{g.isPlayer ? gs.club.name : oppName}</span>
        </div>
      {/each}
    {:else}
      <div class="no-goals">No goals scored.</div>
    {/if}
  </div>

  <!-- Flavour -->
  <div class="flavour">{flavour}</div>

  <!-- Tier shifts -->
  {#if tierGroups.length}
    <div class="card mb-14">
      <div class="section-label">Question Difficulty Shifts</div>
      <div class="tier-shifts">
        {#each tierGroups as g}
          <div class="tier-shift {g.dir}">
            <span class="tier-arrow">{g.dir === 'promoted' ? '▲' : '▼'}</span>
            {g.n} {g.n === 1 ? 'question' : 'questions'} {g.dir} to {DIFF_LABELS[g.tier]}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Table snapshot -->
  <div class="card card-flush mb-20">
    <div class="table-head">
      {divName(gs.division)} — {ordinal(playerPos)} place
      {#if posDiff > 0}<span class="pos-up">↑{posDiff}</span>
      {:else if posDiff < 0}<span class="pos-down">↓{Math.abs(posDiff)}</span>
      {:else}<span class="pos-same">—</span>{/if}
      · Matchday {gs.matchday}
    </div>
    <div class="mini-table">
      {#each miniRows as row}
        {#if row._sep}
          <div class="mini-sep">···</div>
        {:else}
          {@const pc = posColor(row._pos)}
          <div class="mini-row" class:mini-player={row.id === 'player'}>
            <span class="mini-pos" style={pc ? `color:${pc}` : ''}>{row._pos}</span>
            {@html kitBar(row.id)}
            <span class="mini-name">{row.name}</span>
            <span class="mini-pld">{row.pld}</span>
            <span class="mini-pts">{row.pts}</span>
          </div>
        {/if}
      {/each}
    </div>
  </div>

  <!-- Continue -->
  <div class="report-actions">
    <button class="btn btn-primary" onclick={() => oncontinue?.()}>Continue →</button>
  </div>
</div>
{/if}

<style>
  .report-screen { max-width: 540px; margin: 0 auto; padding: 28px 20px 40px; }

  /* Scoreline */
  .report-scoreline { text-align: center; margin-bottom: 16px; }
  .report-score {
    font-family: var(--font-display); font-size: 72px; line-height: 1;
    letter-spacing: .04em;
  }
  .score-dash { color: var(--muted); font-size: 44px; margin: 0 8px; vertical-align: middle; }
  .report-clubs { display: flex; justify-content: space-between; margin-top: 10px; font-size: 14px; }
  .report-club { display: flex; align-items: center; gap: 7px; color: var(--text); max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .report-club.right { justify-content: flex-end; }

  .report-badge-row { text-align: center; margin-bottom: 20px; }
  .result-badge {
    display: inline-block; padding: 5px 18px; border-radius: 3px;
    font-family: var(--font-display); font-size: 20px; letter-spacing: .1em; font-weight: 700;
  }
  .result-badge.win  { background: rgba(62,207,106,.15); color: var(--green); }
  .result-badge.draw { background: rgba(232,153,74,.15); color: var(--amber); }
  .result-badge.loss { background: rgba(224,82,82,.15);  color: var(--red);   }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 14px 16px; }
  .card-flush { padding: 0; overflow: hidden; }
  .mb-14 { margin-bottom: 14px; }
  .mb-20 { margin-bottom: 20px; }
  .section-label { font-size: 10px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }

  /* Scorers */
  .scorer-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--surface2); font-size: 13px; }
  .scorer-row:last-child { border-bottom: none; }
  .scorer-min  { color: var(--muted); font-variant-numeric: tabular-nums; min-width: 28px; }
  .scorer-name { flex: 1; }
  .scorer-club { font-size: 11px; color: var(--muted); }
  .no-goals    { color: var(--muted); font-size: 13px; padding: 6px 0; }

  /* Flavour */
  .flavour {
    background: var(--surface2); border-left: 2px solid var(--gold);
    padding: 12px 16px; font-size: 14px; color: var(--text-dim); line-height: 1.5;
    font-style: italic; margin-bottom: 14px; border-radius: 0 3px 3px 0;
  }

  /* Tier shifts */
  .tier-shifts { display: flex; flex-direction: column; gap: 5px; }
  .tier-shift  { font-size: 13px; display: flex; align-items: center; gap: 6px; }
  .tier-shift.promoted { color: var(--green); }
  .tier-shift.demoted  { color: var(--red); }
  .tier-arrow { font-size: 11px; }

  /* Table */
  .table-head {
    padding: 8px 14px; border-bottom: 1px solid var(--border);
    font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted);
  }
  .pos-up   { color: var(--green); }
  .pos-down { color: var(--red); }
  .pos-same { color: var(--muted); }
  .mini-table { padding: 6px 14px; }
  .mini-row {
    display: flex; align-items: center; gap: 8px; padding: 5px 0;
    border-bottom: 1px solid var(--surface2); font-size: 13px;
  }
  .mini-row:last-child { border-bottom: none; }
  .mini-row.mini-player { color: var(--gold); font-weight: 600; }
  .mini-pos  { font-size: 11px; color: var(--muted); min-width: 18px; text-align: right; flex-shrink: 0; }
  .mini-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mini-pld  { color: var(--muted); font-variant-numeric: tabular-nums; min-width: 20px; text-align: right; }
  .mini-pts  { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--text); min-width: 24px; text-align: right; }
  .mini-sep  { text-align: center; color: var(--muted); font-size: 11px; padding: 2px 0; }

  :global(.kit-bar) { display: inline-flex; width: 18px; height: 13px; border-radius: 2px; overflow: hidden; vertical-align: middle; flex-shrink: 0; }

  .report-actions { text-align: right; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 24px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; }
  .btn:hover { opacity: .85; }
  .btn-primary { background: var(--gold); color: #0a0a0c; }
</style>
