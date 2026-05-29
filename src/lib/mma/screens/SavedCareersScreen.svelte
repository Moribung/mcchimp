<!-- src/lib/mma/screens/SavedCareersScreen.svelte -->
<!-- Active save slot manager: list, continue, star, delete, new career -->
<script>
  import { get }      from 'svelte/store';
  import { session }  from '$lib/stores/session.js';
  import { supabase } from '$lib/supabase.js';
  import {
    loadAllSaves, deleteSave as deleteSaveRow, toggleSaveStar, getUserLimits,
  } from '$lib/saves.js';
  import { PHASES, CHAMP_SLOT, RANKED_START } from '$lib/mma/constants.js';

  const { onloadcareer, onnewcareer, onback } = $props();

  let saves       = $state([]);
  let profile     = $state(null);
  let loading     = $state(true);
  let error       = $state('');
  let deleting    = $state(null);  // saveId being deleted
  let slotFull    = $state(false); // blocking prompt

  const limits = $derived(getUserLimits(profile));

  async function reload() {
    const sess = get(session);
    if (!sess) { loading = false; return; }
    loading = true; error = '';
    try {
      const [savesData, profileData] = await Promise.all([
        loadAllSaves(sess.user.id, 'mma'),
        supabase.from('profiles').select('tier').eq('id', sess.user.id).single().then(r => r.data),
      ]);
      profile = profileData;
      saves   = savesData;
    } catch (e) {
      error = 'Could not load saves.';
    } finally {
      loading = false;
    }
  }

  reload();

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getRecord(save) {
    const d = save.save_data;
    if (!d) return '–';
    return `${d.wins ?? 0}–${d.losses ?? 0}–${d.draws ?? 0}`;
  }

  function getPhaseLabel(save) {
    const phase = save.save_data?.career?.phase ?? 1;
    return PHASES[phase]?.promo ?? 'Regional FC';
  }

  function getRankLabel(save) {
    const slot = save.save_data?.career?.division?.playerSlot ?? 0;
    if (slot === CHAMP_SLOT) return 'Champion';
    if (slot < RANKED_START) return 'Unranked';
    return `#${CHAMP_SLOT - slot}`;
  }

  async function onStar(save) {
    const next = !save.starred;
    // Immutable update — guarantees the list re-renders the star toggle both ways.
    saves = saves.map(s => s.id === save.id ? { ...s, starred: next } : s);
    try {
      await toggleSaveStar(save.id, next);
      error = '';
    } catch (e) {
      saves = saves.map(s => s.id === save.id ? { ...s, starred: !next } : s);
      error = 'Could not update star: ' + (e?.message || e?.code || 'unknown error');
    }
  }

  async function onDelete(saveId) {
    if (!confirm('Delete this save? This cannot be undone.')) return;
    deleting = saveId;
    try {
      await deleteSaveRow(saveId);
      saves = saves.filter(s => s.id !== saveId);
      slotFull = false;
    } catch {
      error = 'Delete failed.';
    } finally {
      deleting = null;
    }
  }

  function onContinue(save) {
    onloadcareer?.(save.id, save.save_data);
  }

  function onNewCareer() {
    if (saves.length >= limits.maxActiveSaves) {
      slotFull = true;
      return;
    }
    onnewcareer?.();
  }
</script>

<div class="sc-wrap">
  <div class="sc-topbar">
    <button class="btn btn-ghost sc-back" onclick={() => onback?.()}>← Back</button>
    <div class="sc-title">Continue a Career</div>
    <button class="btn btn-primary sc-new" onclick={onNewCareer}>+ New Career</button>
  </div>

  {#if error}
    <div class="sc-error">{error}</div>
  {/if}

  {#if loading}
    <div class="sc-loading">Loading…</div>
  {:else}
    <div class="sc-badge-row">
      <span class="sc-slot-badge">{saves.length} / {limits.maxActiveSaves} slots used</span>
    </div>

    {#if saves.length === 0}
      <div class="sc-empty">
        <div class="sc-empty-icon">🥊</div>
        <div class="sc-empty-title">No active careers</div>
        <p class="sc-empty-sub">Start a new career to see it here.</p>
      </div>
    {:else}
      <div class="sc-list">
        {#each saves as save (save.id)}
          <div class="sc-row">
            <button
              class="sc-star"
              class:starred={save.starred}
              title={save.starred ? 'Unstar' : 'Star'}
              onclick={() => onStar(save)}
            >★</button>

            <div class="sc-info">
              <div class="sc-name">{save.fighter_name || save.save_data?.career?.fighterName || '—'}</div>
              <div class="sc-meta">
                <span class="sc-record">{getRecord(save)}</span>
                <span class="sc-sep">·</span>
                <span class="sc-phase">{getPhaseLabel(save)}</span>
                <span class="sc-sep">·</span>
                <span class="sc-rank">{getRankLabel(save)}</span>
                <span class="sc-sep">·</span>
                <span class="sc-date">{formatDate(save.updated_at)}</span>
              </div>
            </div>

            <div class="sc-actions">
              <button
                class="btn btn-ghost sc-del"
                disabled={deleting === save.id}
                onclick={() => onDelete(save.id)}
              >Delete</button>
              <button
                class="btn btn-primary sc-cont"
                onclick={() => onContinue(save)}
              >Continue →</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<!-- Slot-full blocking prompt -->
{#if slotFull}
  <div class="sf-overlay" role="dialog" aria-modal="true"
    onclick={() => slotFull = false}
    onkeydown={(e) => e.key === 'Escape' && (slotFull = false)}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="sf-inner" role="document"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}>
      <div class="sf-title">All Slots Full</div>
      <p class="sf-text">
        You have used all {limits.maxActiveSaves} save slots. Delete an existing career to make room for a new one.
      </p>
      <button class="btn btn-primary" onclick={() => slotFull = false}>OK</button>
    </div>
  </div>
{/if}

<style>
  .sc-wrap { max-width: 680px; margin: 0 auto; padding: 8px 0 40px; }

  .sc-topbar {
    display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
  }
  .sc-title {
    font-family: var(--font-display); font-size: 28px; letter-spacing: 0.04em;
    flex: 1;
  }
  .sc-back { padding: 6px 14px; font-size: 12px; white-space: nowrap; }
  .sc-new  { padding: 8px 18px; font-size: 12px; white-space: nowrap; }

  .sc-loading { color: var(--text-muted); font-size: 13px; padding: 20px 0; }
  .sc-error   { color: var(--red); font-size: 13px; padding: 8px 0; }

  .sc-badge-row { margin-bottom: 16px; }
  .sc-slot-badge {
    font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--text-muted); background: var(--surface2);
    border: 1px solid var(--border); border-radius: 3px; padding: 3px 10px;
  }

  .sc-empty { text-align: center; padding: 48px 0; }
  .sc-empty-icon  { font-size: 36px; margin-bottom: 12px; }
  .sc-empty-title { font-family: var(--font-display); font-size: 22px; letter-spacing: 0.04em; margin-bottom: 6px; }
  .sc-empty-sub   { font-size: 13px; color: var(--text-muted); }

  .sc-list { display: flex; flex-direction: column; gap: 8px; }

  .sc-row {
    display: flex; align-items: center; gap: 12px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px 16px;
    transition: border-color 0.15s;
  }
  .sc-row:hover { border-color: var(--border-hover); }

  .sc-star {
    background: none; border: none; font-size: 18px; cursor: pointer; padding: 0 2px;
    color: var(--border); transition: color 0.15s; line-height: 1; flex-shrink: 0;
  }
  .sc-star:hover { color: var(--accent); }
  .sc-star.starred { color: var(--accent); }

  .sc-info { flex: 1; min-width: 0; }
  .sc-name {
    font-family: var(--font-display); font-size: 18px; letter-spacing: 0.04em;
    margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .sc-meta {
    display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
    font-size: 11px; color: var(--text-muted);
  }
  .sc-sep    { opacity: 0.4; }
  .sc-record { font-family: var(--font-display); font-size: 11px; color: var(--text); }
  .sc-phase  { color: var(--accent); font-weight: 600; letter-spacing: 0.05em; }
  .sc-rank   { color: var(--text-muted); }
  .sc-date   { color: var(--text-muted); }

  .sc-actions { display: flex; gap: 8px; flex-shrink: 0; }
  .sc-del  { padding: 6px 12px; font-size: 11px; }
  .sc-cont { padding: 6px 14px; font-size: 11px; }

  /* Slot-full modal */
  .sf-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.80); display: flex; align-items: center; justify-content: center; z-index: 9999; }
  .sf-inner   { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; max-width: 360px; width: 90%; }
  .sf-title   { font-family: var(--font-display); font-size: 24px; letter-spacing: 0.04em; color: var(--accent); margin-bottom: 10px; }
  .sf-text    { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 20px; }

  @media (max-width: 600px) {
    .sc-topbar   { flex-wrap: wrap; }
    .sc-row      { flex-wrap: wrap; }
    .sc-actions  { width: 100%; justify-content: flex-end; }
    .sc-meta     { gap: 3px; }
  }
</style>
