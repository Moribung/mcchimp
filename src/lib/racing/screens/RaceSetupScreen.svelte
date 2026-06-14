<!-- src/lib/racing/screens/RaceSetupScreen.svelte -->
<script>
  import { state as gs } from '$lib/racing/state.svelte.js';
  import { STANCES, STANCE_ORDER, TIER_ORDER, DIFF_LABELS, DIFF_COLORS, DIFF_BG, FIELD_SIZE, COMMITMENTS } from '$lib/racing/constants.js';
  import { TRACKS } from '$lib/racing/tracks.js';

  const { onstartrace, onback } = $props();

  let stance        = $state(gs.setup.stance || 'balanced');
  let trackId       = $state(gs.setup.trackId || 'random');
  let selectedModId = $state(null);

  const sets = $derived(gs.availableModules);

  function totalQs(mod) { return TIER_ORDER.reduce((n, t) => n + (mod.tiers?.[t]?.length || 0), 0); }
  function countTiers(mod) { return TIER_ORDER.filter(t => (mod.tiers?.[t] || []).length > 0); }

  $effect(() => { if (selectedModId === null && sets.length) selectedModId = sets[0].id; });

  const canStart = $derived(!!selectedModId);
  function start() { if (canStart) onstartrace?.({ modId: selectedModId, stance, trackId }); }
</script>

<div class="setup-wrap">
  <div class="setup-header">
    <h2>Race Setup</h2>
    <p>{FIELD_SIZE}-car grid. Duels break out as you race — your answers decide each one.</p>
  </div>

  <!-- Circuit -->
  <div class="section">
    <div class="section-label">Circuit</div>
    <div class="track-row">
      {#each TRACKS as t}
        <button class="track-btn" class:active={trackId === t.id} onclick={() => trackId = t.id}>
          <span class="track-name">{t.name}</span>
          <span class="track-meta">{t.corners} corners · {t.laps} laps</span>
          <span class="track-blurb">{t.blurb}</span>
        </button>
      {/each}
      <button class="track-btn track-random" class:active={trackId === 'random'} onclick={() => trackId = 'random'}>
        <span class="track-name">Random</span>
        <span class="track-meta">surprise me</span>
        <span class="track-blurb">Draw a circuit at the line.</span>
      </button>
    </div>
  </div>

  <!-- Stance / baseline difficulty -->
  <div class="section">
    <div class="section-label">Baseline Stance</div>
    <p class="section-note">Sets the default question difficulty each duel. You can still push harder or play it safe in the moment.</p>
    <div class="stance-row">
      {#each STANCE_ORDER as id}
        {@const s = STANCES[id]}
        {@const def = COMMITMENTS[s.default]}
        <button class="stance-btn" class:active={stance === id} onclick={() => stance = id}>
          <div class="stance-top">
            <span class="stance-name">{s.label}</span>
            <span class="stance-tier" style="background:{DIFF_BG[def.tier]};color:{DIFF_COLORS[def.tier]}">{DIFF_LABELS[def.tier]}</span>
          </div>
          <span class="stance-blurb">{s.blurb}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Question set -->
  <div class="section">
    <div class="section-label">Question Set</div>
    {#if sets.length === 0}
      <div class="loading">Loading question sets…</div>
    {:else}
      <div class="qset-grid">
        {#each sets as mod (mod.id)}
          <button class="qset-card" class:selected={selectedModId === mod.id} onclick={() => selectedModId = mod.id}>
            <div class="qset-card-name">{mod.icon ? mod.icon + ' ' : ''}{mod.name}</div>
            <div class="qset-card-desc">{mod.description ?? ''}</div>
            <div class="qset-stats">
              {#each countTiers(mod) as t}
                <span class="tier-badge" style="background:{DIFF_BG[t]};color:{DIFF_COLORS[t]}">{DIFF_LABELS[t]} ×{mod.tiers[t].length}</span>
              {/each}
              <span class="qset-total">{totalQs(mod)} q</span>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="actions">
    <button class="btn btn-ghost" onclick={onback}>← Back</button>
    <button class="btn btn-primary btn-lg" disabled={!canStart} onclick={start}>Lights Out →</button>
  </div>
</div>

<style>
  .setup-wrap { max-width: 480px; margin: 0 auto; padding: 40px 0 48px; }
  .setup-header { margin-bottom: 28px; }
  .setup-header h2 { font-family: var(--font-display); font-size: 42px; letter-spacing: .03em; color: var(--accent); }
  .setup-header p  { font-size: 13px; color: var(--muted); margin-top: 4px; }

  .section { margin-bottom: 26px; }
  .section-label { font-size: 10px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
  .section-note { font-size: 12px; color: var(--muted); margin-bottom: 10px; line-height: 1.4; }
  .loading { font-size: 13px; color: var(--muted); padding: 20px; text-align: center; }

  .track-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .track-btn { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 12px 14px; cursor: pointer; color: var(--text); text-align: left; display: flex; flex-direction: column; gap: 3px; transition: border-color .15s, background .15s; }
  .track-btn:hover { border-color: var(--accent-border); }
  .track-btn.active { border-color: var(--accent); background: rgba(212,168,71,.08); }
  .track-random { border-style: dashed; }
  .track-name { font-family: var(--font-display); font-size: 17px; letter-spacing: .03em; color: var(--accent); }
  .track-meta { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .track-blurb { font-size: 11px; color: var(--text-muted); line-height: 1.4; }

  .stance-row { display: flex; flex-direction: column; gap: 8px; }
  .stance-btn { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 12px 14px; cursor: pointer; color: var(--text); text-align: left; transition: border-color .15s, background .15s; }
  .stance-btn:hover { border-color: var(--accent-border); }
  .stance-btn.active { border-color: var(--accent); background: rgba(212,168,71,.08); }
  .stance-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
  .stance-name { font-family: var(--font-display); font-size: 17px; letter-spacing: .03em; color: var(--accent); }
  .stance-tier { font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; padding: 2px 7px; border-radius: 2px; }
  .stance-blurb { font-size: 12px; color: var(--muted); line-height: 1.4; }

  .qset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .qset-card { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 12px 14px; cursor: pointer; text-align: left; color: var(--text); font-family: var(--font-body); transition: border-color .15s, background .15s; }
  .qset-card:hover { border-color: var(--accent-border); }
  .qset-card.selected { border-color: var(--accent); background: color-mix(in srgb,var(--accent) 10%,var(--surface2)); }
  .qset-card-name { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
  .qset-card-desc { font-size: 11px; color: var(--text-muted); line-height: 1.4; }
  .qset-stats { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; margin-top: 6px; }
  .tier-badge { font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; padding: 2px 6px; border-radius: 2px; }
  .qset-total { font-size: 10px; color: var(--muted); margin-left: auto; }

  .actions { display: flex; justify-content: space-between; align-items: center; margin-top: 32px; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; white-space: nowrap; }
  .btn:hover { opacity: .85; }
  .btn:disabled { opacity: .35; cursor: not-allowed; }
  .btn-primary { background: var(--accent); color: #0a0a0c; }
  .btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }
  .btn-lg { padding: 14px 32px; font-size: 15px; letter-spacing: .1em; }

  @media (max-width: 560px) { .qset-grid, .track-row { grid-template-columns: 1fr; } }
</style>
