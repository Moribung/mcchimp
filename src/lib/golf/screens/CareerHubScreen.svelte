<!-- src/lib/golf/screens/CareerHubScreen.svelte -->
<!-- The never-ending home for a golf career: handicap, stats, and round launch. -->
<script>
  import GolferScene from '$lib/golf/GolferScene.svelte';
  import { toParStr } from '$lib/golf/constants.js';
  import { handicapLabel, roundsRemaining, ROUNDS_TO_ESTABLISH } from '$lib/golf/handicap.js';

  const { career, onplaynext, onpractice, onsaveexit, saving = false } = $props();

  const established = $derived(career?.handicap !== null && career?.handicap !== undefined);
  const remaining   = $derived(roundsRemaining(career?.differentials?.length ?? 0));
  const recent      = $derived((career?.differentials ?? []).slice(-10).reverse());

  function diffCls(d) { return d < 0 ? 'under' : d === 0 ? 'even' : 'over'; }
</script>

{#if career}
<div class="hub-wrap">
  <!-- Identity card -->
  <div class="id-card">
    <div class="id-avatar"><GolferScene anim="idle" colors={career.avatar} /></div>
    <div class="id-info">
      <div class="id-name">{career.name}</div>
      <div class="id-sub">Career · {career.roundsPlayed} ranked round{career.roundsPlayed === 1 ? '' : 's'}</div>
      <div class="hcp-block">
        <span class="hcp-label">Handicap</span>
        {#if established}
          <span class="hcp-val">{handicapLabel(career.handicap)}</span>
        {:else}
          <span class="hcp-est">Establishing · {remaining} more round{remaining === 1 ? '' : 's'}</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Stat grid -->
  <div class="stat-grid">
    <div class="stat"><span class="stat-num">{career.bestToPar === null ? '—' : toParStr(career.bestToPar)}</span><span class="stat-lab">Best round</span></div>
    <div class="stat"><span class="stat-num">{career.holesInOne}</span><span class="stat-lab">Aces</span></div>
    <div class="stat"><span class="stat-num">{career.eagles}</span><span class="stat-lab">Eagles</span></div>
    <div class="stat"><span class="stat-num">{career.birdies}</span><span class="stat-lab">Birdies</span></div>
    <div class="stat"><span class="stat-num">{career.pars}</span><span class="stat-lab">Pars</span></div>
    <div class="stat"><span class="stat-num">{career.bogeys}</span><span class="stat-lab">Bogeys+</span></div>
  </div>

  <!-- Recent ranked rounds -->
  {#if recent.length}
    <div class="recent">
      <div class="recent-title">Recent ranked rounds</div>
      <div class="recent-row">
        {#each recent as d}
          <span class="recent-chip {diffCls(d)}">{toParStr(d)}</span>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Actions -->
  <button class="play-btn" onclick={onplaynext}>
    <div class="play-icon">⛳</div>
    <div class="play-body">
      <div class="play-title">Play Next Round</div>
      <div class="play-sub">18 holes · ranked · counts toward handicap</div>
    </div>
    <div class="play-arrow">→</div>
  </button>

  <div class="practice-block">
    <div class="practice-label">Practice — doesn't affect your handicap</div>
    <div class="practice-row">
      <button class="practice-btn" onclick={() => onpractice?.(9)}>Practice 9</button>
      <button class="practice-btn" onclick={() => onpractice?.(18)}>Practice 18</button>
    </div>
  </div>

  <button class="exit-btn" onclick={onsaveexit} disabled={saving}>
    {saving ? 'Saving…' : 'Save & Exit to Menu'}
  </button>
</div>
{/if}

<style>
  .hub-wrap { max-width: 480px; margin: 0 auto; padding: 36px 0 48px; display: flex; flex-direction: column; gap: 16px; }

  .id-card { display: flex; gap: 16px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 16px; }
  .id-avatar { width: 100px; flex-shrink: 0; }
  .id-info { flex: 1; min-width: 0; }
  .id-name { font-family: var(--font-display); font-size: 30px; letter-spacing: .02em; color: var(--text); line-height: 1; }
  .id-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .hcp-block { display: flex; align-items: baseline; gap: 10px; margin-top: 14px; }
  .hcp-label { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
  .hcp-val { font-family: var(--font-display); font-size: 34px; color: var(--accent); line-height: 1; }
  .hcp-est { font-size: 12px; color: var(--amber); font-style: italic; }

  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .stat { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 10px 4px; text-align: center; display: flex; flex-direction: column; gap: 2px; }
  .stat-num { font-family: var(--font-display); font-size: 22px; line-height: 1; }
  .stat-lab { font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }

  .recent { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 12px 14px; }
  .recent-title { font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
  .recent-row { display: flex; flex-wrap: wrap; gap: 5px; }
  .recent-chip { font-family: var(--font-display); font-size: 14px; padding: 3px 8px; border-radius: 3px; background: var(--surface); border: 1px solid var(--border); }
  .recent-chip.under { color: var(--green); }
  .recent-chip.even  { color: var(--accent); }
  .recent-chip.over  { color: var(--red); }

  .play-btn {
    width: 100%; display: flex; align-items: center; gap: 16px; text-align: left;
    background: color-mix(in srgb, var(--accent) 8%, var(--surface));
    border: 1px solid rgba(212,168,71,.4); border-radius: 6px; padding: 18px 20px;
    cursor: pointer; color: var(--text); transition: border-color .15s, background .15s;
  }
  .play-btn:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
  .play-icon { font-size: 24px; flex-shrink: 0; }
  .play-body { flex: 1; }
  .play-title { font-family: var(--font-display); font-size: 20px; letter-spacing: .03em; }
  .play-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .play-arrow { font-family: var(--font-display); font-size: 22px; color: var(--accent); }

  .practice-block { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 14px 16px; }
  .practice-label { font-size: 11px; color: var(--muted); margin-bottom: 10px; }
  .practice-row { display: flex; gap: 10px; }
  .practice-btn {
    flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
    color: var(--text); font-family: var(--font-body); font-size: 13px; font-weight: 600;
    letter-spacing: .06em; text-transform: uppercase; padding: 11px; cursor: pointer;
    transition: border-color .15s, color .15s;
  }
  .practice-btn:hover { border-color: var(--accent); color: var(--accent); }

  .exit-btn {
    width: 100%; background: transparent; border: 1px solid var(--border); border-radius: 4px;
    color: var(--text-muted); font-family: var(--font-body); font-size: 12px; font-weight: 600;
    letter-spacing: .08em; text-transform: uppercase; padding: 11px; cursor: pointer; margin-top: 4px;
    transition: border-color .15s, color .15s;
  }
  .exit-btn:hover:not(:disabled) { border-color: var(--border-hover); color: var(--text); }
  .exit-btn:disabled { opacity: .5; cursor: not-allowed; }
</style>
