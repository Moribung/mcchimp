<!-- src/lib/football/screens/PreMatchScreen.svelte -->
<script>
  import { state as gs }                 from '$lib/football/state.svelte.js';
  import { sortTable, getTableRow, getClubName } from '$lib/football/league.js';
  import { getQuestionCount, getDifficultyMix }  from '$lib/football/questions.js';
  import { ordinal, divName }                    from '$lib/football/utils.js';
  import { relegationCount }                     from '$lib/football/constants.js';

  const { onkickoff, onhub } = $props();

  // ── Match data ────────────────────────────────────────
  const pm = $derived(
    gs.fixtures?.[`div${gs.division}`]?.[gs.matchday - 1]?.matches
      ?.find(m => m.homeId === 'player' || m.awayId === 'player') || null
  );
  const isHome  = $derived(pm?.homeId === 'player');
  const oppId   = $derived(pm ? (isHome ? pm.awayId : pm.homeId) : null);
  const oppRow  = $derived(oppId ? getTableRow(oppId, gs.table?.div1||[], gs.table?.div2||[]) : null);
  const divTable = $derived(sortTable(gs.table?.[`div${gs.division}`] || []));
  const plPos   = $derived(divTable.findIndex(r => r.id === 'player') + 1);
  const oppPos  = $derived(divTable.findIndex(r => r.id === oppId) + 1);
  const total   = $derived(divTable.length);

  const rGap    = $derived(gs.club.rating - (oppRow?.rating || 60));
  const fScore  = $derived(gs.form.slice(-5).reduce((s, r) => s + (r==='W'?1:r==='L'?-1:0), 0));
  const qCount  = $derived(getQuestionCount(rGap, gs.tactic));
  const mix     = $derived(getDifficultyMix(rGap, fScore, gs.season));

  const difficulty = $derived(
    rGap >= 10  ? 'Comfortable'
  : rGap >= 1   ? 'Favourable'
  : rGap >= -9  ? 'Competitive'
  : rGap >= -10 ? 'Tough'
  :               'Very Tough'
  );

  const diffColor = $derived(
    rGap >= 5  ? 'var(--green)'
  : rGap >= -4 ? 'var(--amber)'
  :              'var(--red)'
  );

  function oppLabel(pos, total, div) {
    const rel = relegationCount(total);
    const pct = pos / total;
    if (pos > total - rel)  return { label: 'Relegation Zone', cls: 'tag-red' };
    if (div === 2 && pos <= rel) return { label: 'Promotion Spot', cls: 'tag-green' };
    if (pct <= 0.17)        return { label: 'Title Contenders', cls: 'tag-gold' };
    if (pct <= 0.44)        return { label: 'Strong Side',       cls: 'tag-strong' };
    if (pct <= 0.67)        return { label: 'Mid-table',         cls: 'tag-mid' };
    return                         { label: 'Relegation Battle', cls: 'tag-mid' };
  }

  const oppLbl = $derived(oppPos ? oppLabel(oppPos, total, gs.division) : null);

  // ── Kit bar ───────────────────────────────────────────
  function kitBar(row) {
    if (!row) return '';
    if (row.id === 'player') {
      const col = gs.club?.kitColour || '#888';
      return `<span class="kit-bar"><span style="background:${col};flex:1;height:100%"></span></span>`;
    }
    const segs = (row.colours || []).map(c => `<span style="background:${c};flex:1;height:100%"></span>`).join('');
    return `<span class="kit-bar">${segs}</span>`;
  }

  // ── Form dots ─────────────────────────────────────────
  function formDots(form) {
    return (form || []).slice(-5).map(r =>
      `<span class="form-dot ${r==='W'?'fw':r==='D'?'fd':'fl'}"></span>`
    ).join('');
  }

  // ── Difficulty mix label ──────────────────────────────
  const mixLabel = $derived.by(() => {
    const [e, m, h, x] = mix;
    if (x > 0.3)  return 'Elite-heavy';
    if (h > 0.4)  return 'Hard-weighted';
    if (e > 0.4)  return 'Easy-weighted';
    return              'Mixed';
  });
</script>

<div class="prematch-screen">
  <!-- Season / matchday label -->
  <div class="prematch-meta">
    <span>Season {gs.season}</span>
    <span class="dot">·</span>
    <span>{divName(gs.division)}</span>
    <span class="dot">·</span>
    <span>Matchday {gs.matchday} of {gs.matchdays}</span>
  </div>

  {#if pm}
    <!-- Teams -->
    <div class="prematch-teams">
      <!-- Player club -->
      <div class="prematch-team">
        {@html kitBar(getTableRow('player', gs.table?.div1||[], gs.table?.div2||[]))}
        <div class="prematch-team-name player">{gs.club.name}</div>
        <div class="prematch-badges">
          <span class="badge {isHome ? 'badge-home' : 'badge-away'}">{isHome ? 'HOME' : 'AWAY'}</span>
        </div>
        <div class="prematch-detail">{ordinal(plPos)} place · Rtg {gs.club.rating}</div>
        <div class="form-dots">{@html formDots(gs.form)}</div>
      </div>

      <div class="prematch-vs">VS</div>

      <!-- Opponent -->
      <div class="prematch-team right">
        {#if oppRow}{@html kitBar(oppRow)}{/if}
        <div class="prematch-team-name">{oppRow?.name || '?'}</div>
        <div class="prematch-badges">
          {#if oppLbl}<span class="badge {oppLbl.cls}">{oppLbl.label}</span>{/if}
          <span class="badge {isHome ? 'badge-away' : 'badge-home'}">{isHome ? 'AWAY' : 'HOME'}</span>
        </div>
        <div class="prematch-detail">{ordinal(oppPos)} place · Rtg {oppRow?.rating ?? '?'}</div>
        <div class="form-dots">{@html formDots(oppRow?.form)}</div>
      </div>
    </div>

    <!-- Match stats -->
    <div class="prematch-stats">
      <div class="stat-card">
        <div class="stat-label">Difficulty</div>
        <div class="stat-val" style="color:{diffColor}">{difficulty}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Questions</div>
        <div class="stat-val">{qCount}</div>
        <div class="stat-sub">{mixLabel}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Tactic</div>
        <div class="stat-val" style="text-transform:capitalize">{gs.tactic}</div>
        <div class="stat-sub">Change in Squad tab</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Your Form</div>
        <div class="stat-val" style="font-size:16px">{@html formDots(gs.form)}</div>
      </div>
    </div>

    <!-- Rating comparison bar -->
    <div class="rating-compare">
      <div class="rc-label">{gs.club.name}</div>
      <div class="rc-bar">
        <div class="rc-fill" style="
          width:{Math.max(20,Math.min(80, 50 + rGap * 2))}%;
          background:{rGap >= 0 ? 'var(--green)' : 'var(--red)'};
          margin-left:auto
        "></div>
        <div class="rc-fill rc-right" style="
          width:{Math.max(20,Math.min(80, 50 - rGap * 2))}%;
          background:var(--surface3)
        "></div>
      </div>
      <div class="rc-label right">{oppRow?.name || '?'}</div>
    </div>
    <div class="rating-nums">
      <span style="font-family:var(--font-display);font-size:20px;color:{rGap>=0?'var(--green)':'var(--red)'}">{gs.club.rating}</span>
      <span style="font-size:11px;color:var(--muted)">{rGap >= 0 ? `+${rGap}` : rGap} rating</span>
      <span style="font-family:var(--font-display);font-size:20px">{oppRow?.rating ?? '?'}</span>
    </div>
  {:else}
    <div style="text-align:center;color:var(--muted);padding:40px">No match found for this matchday.</div>
  {/if}

  <!-- Buttons -->
  <div class="prematch-actions">
    <button class="btn btn-ghost" onclick={onhub}>← Back to Hub</button>
    <button class="btn btn-primary btn-lg" onclick={onkickoff} disabled={!pm}>⚽ Kick Off</button>
  </div>
</div>

<style>
  .prematch-screen { max-width: 640px; margin: 0 auto; padding: 32px 20px 40px; }

  .prematch-meta {
    display: flex; align-items: center; gap: 8px; justify-content: center;
    font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em;
    margin-bottom: 32px;
  }
  .dot { color: var(--border); }

  /* ── Teams ───────────────────────────────────────────── */
  .prematch-teams {
    display: grid; grid-template-columns: 1fr auto 1fr;
    gap: 16px; align-items: center; margin-bottom: 28px;
  }
  .prematch-team { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
  .prematch-team.right { align-items: center; }
  .prematch-team-name { font-family: var(--font-display); font-size: 22px; letter-spacing: .04em; color: var(--text); }
  .prematch-team-name.player { color: var(--gold); }
  .prematch-vs { font-family: var(--font-display); font-size: 30px; color: var(--muted); letter-spacing: .04em; }
  .prematch-badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
  .prematch-detail { font-size: 12px; color: var(--text-dim); }

  :global(.kit-bar) { display: inline-flex; width: 22px; height: 16px; border-radius: 2px; overflow: hidden; vertical-align: middle; }

  /* Badges */
  .badge { font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 2px 7px; border-radius: 2px; }
  .badge-home   { background: rgba(62,207,106,.15); color: var(--green); }
  .badge-away   { background: var(--surface2); color: var(--muted); }
  .tag-gold     { background: rgba(212,168,71,.15); color: var(--gold); }
  .tag-green    { background: rgba(62,207,106,.15); color: var(--green); }
  .tag-red      { background: rgba(224,82,82,.15);  color: var(--red); }
  .tag-strong   { background: rgba(168,85,247,.12); color: var(--purple); }
  .tag-mid      { background: var(--surface2); color: var(--text-dim); }

  /* Form dots */
  .form-dots { display: flex; gap: 3px; justify-content: center; }
  :global(.form-dot) { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
  :global(.form-dot.fw) { background: var(--green); }
  :global(.form-dot.fd) { background: var(--amber); }
  :global(.form-dot.fl) { background: var(--red); }

  /* ── Stats row ───────────────────────────────────────── */
  .prematch-stats {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 10px; margin-bottom: 24px;
  }
  .stat-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
    padding: 12px; text-align: center;
  }
  .stat-label { font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
  .stat-val   { font-family: var(--font-display); font-size: 20px; letter-spacing: .04em; }
  .stat-sub   { font-size: 10px; color: var(--muted); margin-top: 2px; }

  /* ── Rating comparison ───────────────────────────────── */
  .rating-compare { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .rc-label { font-size: 11px; color: var(--muted); flex-shrink: 0; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rc-label.right { text-align: right; }
  .rc-bar { flex: 1; height: 8px; background: var(--surface3); border-radius: 4px; overflow: hidden; display: flex; }
  .rc-fill { height: 100%; border-radius: 4px; transition: width .3s; }
  .rating-nums { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }

  /* ── Actions ─────────────────────────────────────────── */
  .prematch-actions { display: flex; gap: 12px; justify-content: center; }

  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; white-space: nowrap; }
  .btn:hover  { opacity: .85; }
  .btn:disabled { opacity: .35; cursor: not-allowed; }
  .btn-primary { background: var(--gold); color: #0a0a0c; }
  .btn-ghost   { background: transparent; color: var(--text-dim); border: 1px solid var(--border); }
  .btn-lg { padding: 14px 32px; font-size: 15px; }

  @media (max-width: 560px) {
    .prematch-stats { grid-template-columns: 1fr 1fr; }
    .prematch-team-name { font-size: 18px; }
  }
</style>
