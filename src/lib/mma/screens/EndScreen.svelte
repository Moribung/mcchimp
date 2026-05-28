<!-- src/lib/mma/screens/EndScreen.svelte -->
<!-- Final career summary: record, stat cards, legacy tier, restart / new module -->
<script>

  import { state as gs }             from '$lib/mma/state.svelte.js';
  import { calcLegacyTitle, initState, initSparringState } from '$lib/mma/career.js';

  const { onrestart } = $props();  // ── Derived summary ───────────────────────────────────
  const total    = $derived(gs.fightIndex);
  const winPct   = $derived(total > 0 ? Math.round((gs.wins / total) * 100) : 0);
  const legacy   = $derived(calcLegacyTitle(gs.wins, total));

  const endTitle = $derived(
    gs.retiredVoluntarily ? 'Hung Up The Gloves' :
    gs.retiredDurability  ? 'Forced Into Retirement' :
    gs.career?.forceRetire ? 'Career Ended' :
    "That's a Wrap"
  );

  // ── Restart with same module ──────────────────────────
  function runItBack() {
    const modId = gs.activeModId;
    if (gs.sparring) {
      initSparringState(gs, modId);
    } else {
      const prevLength     = gs.career?.activeLength ?? 0;
      const prevDifficulty = gs.career?.difficulty   ?? 'medium';
      initState(gs, modId);
      if (gs.career) {
        gs.career.activeLength = prevLength;
        gs.career.difficulty   = prevDifficulty;
      }
    }
  }

  // ── New module ────────────────────────────────────────
  function newModule() {
    gs.career = null;
    gs.screen = 'menu';
    onrestart?.();
  }
</script>

<div class="end-wrap">

  <div class="end-title">{endTitle}</div>
  <div class="end-record">{gs.wins}–{gs.draws}–{gs.losses}</div>
  <div class="end-subtitle">Final Record</div>

  <!-- Stat cards -->
  <div class="end-stats">
    <div class="stat-card">
      <div class="stat-num" style="color:var(--green)">{gs.wins}</div>
      <div class="stat-label">Wins</div>
    </div>
    <div class="stat-card">
      <div class="stat-num" style="color:var(--amber)">{gs.draws}</div>
      <div class="stat-label">Draws</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">{gs.losses - gs.finishes}</div>
      <div class="stat-label">Losses</div>
    </div>
    <div class="stat-card">
      <div class="stat-num" style="color:var(--red)">{gs.finishes}</div>
      <div class="stat-label">Finishes</div>
    </div>
  </div>

  <!-- Extra stats row -->
  <div class="end-stats end-stats-2">
    <div class="stat-card">
      <div class="stat-num">{total}</div>
      <div class="stat-label">Fights</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">{winPct}%</div>
      <div class="stat-label">Win Rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">{gs.bestStreak}</div>
      <div class="stat-label">Best Streak</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">
        {(gs.winsByKO || 0) + (gs.winsByTKO || 0) + (gs.winsBySub || 0)}
      </div>
      <div class="stat-label">Finishes</div>
    </div>
  </div>

  <!-- Legacy -->
  <div class="end-legacy">
    <div class="end-legacy-label">Career Legacy</div>
    <div class="end-legacy-title">{legacy}</div>
  </div>

  <!-- Bout history teaser (last 5) -->
  {#if (gs.boutHistory || []).length > 0}
    <div class="end-history">
      <div class="eh-header">Recent Fights</div>
      {#each gs.boutHistory.slice(0, 5) as b}
        {@const rc = b.rc || 'loss'}
        <div class="eh-row">
          <span class="bh-dot {rc}"></span>
          <span class="eh-name">{b.oppName || 'Unknown'}</span>
          <span class="eh-outcome">{b.outcome || ''}</span>
          <span class="eh-method">{b.method || ''}</span>
        </div>
      {/each}
    </div>
  {/if}

  <div class="btn-row">
    <button class="btn btn-primary" onclick={runItBack}>Run It Back</button>
    <button class="btn btn-ghost"   onclick={newModule}>New Module</button>
  </div>

</div>

<style>
  .end-wrap { max-width: 600px; margin: 0 auto; padding: 28px 0 40px; }

  .end-title { font-family: var(--font-display); font-size: 46px; letter-spacing: 0.04em; color: var(--accent); margin-bottom: 6px; }
  .end-record { font-family: var(--font-display); font-size: 56px; letter-spacing: 0.04em; line-height: 1; margin-bottom: 6px; }
  .end-subtitle { color: var(--text-muted); font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 32px; }

  .end-stats { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px; }
  .end-stats-2 { margin-bottom: 28px; }

  .stat-card  { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; text-align: center; }
  .stat-num   { font-family: var(--font-display); font-size: 28px; color: var(--text); line-height: 1; margin-bottom: 4px; }
  .stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }

  .end-legacy { background: var(--surface); border: 1px solid var(--accent); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 32px; }
  .end-legacy-label { font-size: 10px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.14em; margin-bottom: 4px; }
  .end-legacy-title { font-family: var(--font-display); font-size: 24px; letter-spacing: 0.04em; color: var(--text); }

  .end-history { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; margin-bottom: 28px; }
  .eh-header { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px; }
  .eh-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 12px; }
  .eh-row:last-child { border-bottom: none; }
  .bh-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .bh-dot.win    { background: var(--green); }
  .bh-dot.draw   { background: var(--amber); }
  .bh-dot.loss   { background: var(--red); }
  .bh-dot.finish { background: #8b0000; }
  .eh-name    { font-weight: 500; flex: 1; }
  .eh-outcome { color: var(--text); white-space: nowrap; }
  .eh-method  { color: var(--text-muted); font-style: italic; font-size: 11px; white-space: nowrap; }

  .btn-row { display: flex; gap: 12px; flex-wrap: wrap; }

  @media (max-width: 600px) {
    .end-record { font-size: 42px; }
    .end-title  { font-size: 34px; }
    .stat-num   { font-size: 22px; }
  }
</style>
