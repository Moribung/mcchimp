<!-- src/lib/mma/screens/EndScreen.svelte -->
<!-- Final career summary: end title, record, legacy label, badges, stats, restart -->
<script>

  import { state as gs }  from '$lib/mma/state.svelte.js';
  import {
    buildLegacyStats,
    calcLegacyTitle,
    calcEndTitle,
    calcAchievementBadges,
    HUMOROUS_BADGE_NAMES,
    getPhaseDef,
    initState,
    initSparringState,
  }                        from '$lib/mma/career.js';
  import { CHAMP_SLOT } from '$lib/mma/constants.js';

  const { onrestart } = $props();

  // ── Derived career + display values ──────────────────
  const careerFull   = $derived(buildLegacyStats(gs));
  const endTitle     = $derived(calcEndTitle(careerFull));
  const legacyTitle  = $derived(calcLegacyTitle(careerFull));
  const badges       = $derived(calcAchievementBadges(careerFull, legacyTitle));

  const neverFought  = $derived(careerFull.fights === 0);

  // Summary stats — only show non-zero / relevant values
  const winPct      = $derived(
    careerFull.fights > 0
      ? Math.round((careerFull.wins / careerFull.fights) * 100)
      : 0
  );
  const finishPct   = $derived(
    careerFull.wins > 0
      ? Math.round((careerFull.finishRate ?? 0) * 100)
      : 0
  );

  // Per-organisation championships (for the championship strip)
  const championships = $derived((() => {
    const cs = gs.career;
    const t  = cs?.titles;
    if (!t) return [];
    return [1, 2, 3].flatMap(ph => {
      const rec = t[ph];
      if (!rec || rec.reigns < 1) return [];
      // getPhaseDef applies the per-career phase-2 org override (e.g. Kings FC).
      const d = getPhaseDef({ ...cs, phase: ph });
      return [{
        org:    d.promo ?? `Phase ${ph}`,
        belt:   d.rankLabels?.[11] ?? 'Champion',
        reigns: rec.reigns,
        best:   rec.bestDefenseStreak || 0,
      }];
    });
  })());

  // Badge style: positive (gold) vs humorous/negative (muted).
  // HUMOROUS_BADGE_NAMES is exported from career.js so both files stay in sync.
  function badgeClass(b) {
    return HUMOROUS_BADGE_NAMES.has(b) ? 'badge-neg' : 'badge-pos';
  }

  // ── Restart with same module ──────────────────────────
  function runItBack() {
    const modId = gs.activeModId;
    gs.saveId = null;
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

  // ── Return to main menu ───────────────────────────────
  function toMainMenu() {
    gs.career          = null;
    gs.saveId          = null;
    gs.currentOpponent = null;
    gs.wins = 0; gs.losses = 0; gs.draws = 0; gs.finishes = 0;
    gs.results = []; gs.boutHistory = [];
    gs.fightIndex = 0;
    gs.currentStreak = 0; gs.bestStreak = 0;
    gs.finishStreak = 0;
    gs.unbeatenStreak = 0; gs.bestUnbeatenStreak = 0;
    gs.winsByKO = 0; gs.winsByTKO = 0; gs.winsBySub = 0; gs.winsByDec = 0;
    gs.lossByKO = 0; gs.lossByTKO = 0; gs.lossBySub = 0; gs.lossByDec = 0;
    gs.methodWeights = { KO: 1, TKO: 1, Submission: 1 };
    gs.specificMethodCounts = {};
    gs.winsVsFighter = {};
    gs.retiredVoluntarily = false;
    gs.retiredDurability  = false;
    gs.retiredForcefully  = false;
    gs.screen = 'menu';
    onrestart?.();
  }
</script>

<div class="end-wrap">

  <!-- ① End title — large headline -->
  <div class="end-headline">{endTitle}</div>

  <!-- ② Fighter name + final record -->
  {#if !neverFought}
    <div class="end-name">{gs.career?.fighterName ?? ''}</div>
    <div class="end-record">
      {careerFull.wins}–{careerFull.losses}–{careerFull.draws}
    </div>
    <div class="end-record-label">Final Record</div>
  {:else}
    <div class="end-name">{gs.career?.fighterName ?? ''}</div>
    <div class="end-record-label">0 fights</div>
  {/if}

  <!-- ③ Legacy title -->
  <div class="end-legacy">
    <div class="end-legacy-label">Career Legacy</div>
    {#if legacyTitle === 'Never Fought'}
      <div class="end-legacy-title end-legacy-none">No career to speak of.</div>
    {:else}
      <div class="end-legacy-title">{legacyTitle}</div>
    {/if}
  </div>

  <!-- ④ Achievement badges -->
  {#if badges.length > 0}
    <div class="end-badges">
      {#each badges as b}
        <span class="badge {badgeClass(b)}">{b}</span>
      {/each}
    </div>
  {/if}

  <!-- Championships strip -->
  {#if championships.length > 0}
    <div class="end-titles">
      <div class="et-header">Championships</div>
      {#each championships as c}
        <div class="et-row">
          <span class="et-belt">🏆 {c.belt}</span>
          <span class="et-meta">
            {c.reigns}× reign{c.reigns > 1 ? 's' : ''}{c.best > 0 ? ` · best ${c.best} defense${c.best > 1 ? 's' : ''}` : ''}
          </span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- ⑤ Career stats summary -->
  {#if !neverFought}
    <div class="end-stats-grid">
      <div class="stat-card">
        <div class="stat-num" style="color:var(--green)">{careerFull.wins}</div>
        <div class="stat-label">Wins</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color:var(--amber)">{careerFull.draws}</div>
        <div class="stat-label">Draws</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{careerFull.losses}</div>
        <div class="stat-label">Losses</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{careerFull.fights}</div>
        <div class="stat-label">Fights</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{winPct}%</div>
        <div class="stat-label">Win Rate</div>
      </div>
      {#if finishPct > 0}
        <div class="stat-card">
          <div class="stat-num">{finishPct}%</div>
          <div class="stat-label">Finish Rate</div>
        </div>
      {/if}
      {#if gs.bestStreak > 0}
        <div class="stat-card">
          <div class="stat-num">{gs.bestStreak}</div>
          <div class="stat-label">Best Streak</div>
        </div>
      {/if}
      {#if careerFull.titleDefenses > 0}
        <div class="stat-card">
          <div class="stat-num" style="color:var(--accent)">{careerFull.titleDefenses}</div>
          <div class="stat-label">Title Defs</div>
        </div>
      {/if}
      {#if careerFull.peakWinPct > 0 && Math.abs(careerFull.peakWinPct - (careerFull.wins / careerFull.fights)) > 0.04}
        <div class="stat-card">
          <div class="stat-num">{Math.round(careerFull.peakWinPct * 100)}%</div>
          <div class="stat-label">Peak Win%</div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Bout history teaser (most recent 5) -->
  {#if (gs.boutHistory || []).length > 0}
    <div class="end-history">
      <div class="eh-header">Recent Fights</div>
      {#each gs.boutHistory.slice(0, 5) as b}
        {@const rc       = b.rc || 'loss'}
        {@const oppChamp = b.oppRankSlot === CHAMP_SLOT}
        <div class="eh-row" class:eh-title={b.titleFight} title={b.titleFight ? 'Title fight' : undefined}>
          <span class="bh-dot {rc}"></span>
          {#if oppChamp}<span class="eh-belt" title="Reigning champion">🏆</span>{/if}
          <span class="eh-name">{b.oppName || 'Unknown'}</span>
          <span class="eh-outcome">{b.outcome || ''}</span>
          <span class="eh-method">{b.method || ''}</span>
        </div>
      {/each}
    </div>
  {/if}

  <div class="btn-row">
    <button class="btn btn-primary" onclick={runItBack}>Run It Back</button>
    <button class="btn btn-ghost"   onclick={toMainMenu}>Main Menu</button>
  </div>

</div>

<style>
  .end-wrap { max-width: 600px; margin: 0 auto; padding: 28px 0 40px; }

  /* ① Headline */
  .end-headline {
    font-family: var(--font-display);
    font-size: 38px; letter-spacing: 0.04em;
    color: var(--accent); margin-bottom: 12px; line-height: 1.1;
  }

  /* ② Name + record */
  .end-name   { font-size: 13px; color: var(--text-muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
  .end-record { font-family: var(--font-display); font-size: 56px; letter-spacing: 0.04em; line-height: 1; margin-bottom: 4px; }
  .end-record-label { color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 28px; }

  /* ③ Legacy label */
  .end-legacy       { background: var(--surface); border: 1px solid var(--accent); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 20px; }
  .end-legacy-label { font-size: 10px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.14em; margin-bottom: 4px; }
  .end-legacy-title { font-family: var(--font-display); font-size: 26px; letter-spacing: 0.04em; color: var(--text); }
  .end-legacy-none  { font-family: inherit; font-size: 14px; color: var(--text-muted); font-style: italic; }

  /* ④ Badges */
  .end-badges { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 24px; }
  .badge {
    font-size: 11px; font-weight: 700; letter-spacing: 0.07em;
    text-transform: uppercase; padding: 4px 10px;
    border-radius: 3px; white-space: nowrap;
  }
  .badge-pos { background: rgba(232,193,74,0.14); color: var(--accent); border: 1px solid rgba(232,193,74,0.35); }
  .badge-neg { background: rgba(255,255,255,0.06); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.12); }

  /* Championships strip */
  .end-titles  { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 18px; margin-bottom: 24px; }
  .et-header   { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px; }
  .et-row      { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .et-row:last-child { border-bottom: none; }
  .et-belt     { font-family: var(--font-display); font-size: 15px; letter-spacing: 0.04em; color: var(--accent); }
  .et-meta     { font-size: 11px; color: var(--text-muted); letter-spacing: 0.04em; white-space: nowrap; }

  /* ⑤ Stats grid */
  .end-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 28px; }
  .stat-card  { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; text-align: center; }
  .stat-num   { font-family: var(--font-display); font-size: 26px; color: var(--text); line-height: 1; margin-bottom: 4px; }
  .stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }

  /* Bout history */
  .end-history  { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; margin-bottom: 28px; }
  .eh-header    { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px; }
  .eh-row       { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 12px; }
  .eh-row:last-child { border-bottom: none; }
  .bh-dot       { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .bh-dot.win   { background: var(--green); }
  .bh-dot.draw  { background: var(--amber); }
  .bh-dot.loss  { background: var(--red); }
  .bh-dot.finish { background: #8b0000; }
  .eh-name      { font-weight: 500; flex: 1; }
  .eh-outcome   { color: var(--text); white-space: nowrap; }
  .eh-method    { color: var(--text-muted); font-style: italic; font-size: 11px; white-space: nowrap; }
  .eh-belt      { font-size: 11px; flex-shrink: 0; }
  .eh-row.eh-title { background: rgba(232,193,74,0.05); border-radius: 3px; margin: 0 -6px; padding-left: 6px; padding-right: 6px; }

  .btn-row { display: flex; gap: 12px; flex-wrap: wrap; }

  @media (max-width: 600px) {
    .end-record    { font-size: 42px; }
    .end-headline  { font-size: 28px; }
    .stat-num      { font-size: 20px; }
    .end-stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
