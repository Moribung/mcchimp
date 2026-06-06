<!-- src/lib/mma/screens/PastCareersScreen.svelte -->
<!-- Read-only registry of completed careers with expandable stat breakdown -->
<script>
  import { get }      from 'svelte/store';
  import { session }  from '$lib/stores/session.js';
  import { supabase } from '$lib/supabase.js';
  import {
    loadPastCareers, toggleHistoryStar, deleteHistory, getUserLimits,
  } from '$lib/saves.js';
  import { state as gs } from '$lib/mma/state.svelte.js';
  import FighterAvatar from '$lib/avatar/FighterAvatar.svelte';

  const { onback } = $props();

  let careers  = $state([]);
  let profile  = $state(null);
  let loading  = $state(true);
  let error    = $state('');
  let expanded = $state(new Set());

  const limits = $derived(getUserLimits(profile));

  async function reload() {
    const sess = get(session);
    if (!sess) { loading = false; return; }
    loading = true; error = '';
    try {
      const [careersData, profileData] = await Promise.all([
        loadPastCareers(sess.user.id, 'mma'),
        supabase.from('profiles').select('tier').eq('id', sess.user.id).single().then(r => r.data),
      ]);
      profile = profileData;
      careers = careersData;
      // Highlight newly archived entry
      if (gs._newHistoryId) {
        expanded = new Set([gs._newHistoryId]);
        gs._newHistoryId = null;
      }
    } catch (e) {
      error = 'Could not load career history.';
    } finally {
      loading = false;
    }
  }

  reload();

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function toggleExpand(id) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expanded = next;
  }

  async function onStar(career) {
    const next = !career.starred;
    // Immutable update — guarantees the list re-renders the star toggle both ways.
    careers = careers.map(c => c.id === career.id ? { ...c, starred: next } : c);
    try {
      await toggleHistoryStar(career.id, next);
      error = '';
    } catch (e) {
      careers = careers.map(c => c.id === career.id ? { ...c, starred: !next } : c);
      error = 'Could not update star: ' + (e?.message || e?.code || 'unknown error');
    }
  }

  let deleting = $state(null);
  async function onDelete(career) {
    if (!confirm(`Permanently delete the past career "${career.fighter_name || 'this fighter'}"? This cannot be undone.`)) return;
    deleting = career.id;
    const prev = careers;
    careers = careers.filter(c => c.id !== career.id); // optimistic
    try {
      await deleteHistory(career.id);
      error = '';
    } catch (e) {
      careers = prev; // revert
      error = 'Could not delete career: ' + (e?.message || e?.code || 'unknown error');
    } finally {
      deleting = null;
    }
  }
</script>

<div class="pc-wrap">
  <div class="pc-topbar">
    <button class="btn btn-ghost pc-back" onclick={() => onback?.()}>← Back</button>
    <div class="pc-title">Past Careers</div>
    <span class="pc-count-badge">{careers.length} / {limits.maxPastCareers}</span>
  </div>

  {#if error}
    <div class="pc-error">{error}</div>
  {/if}

  {#if loading}
    <div class="pc-loading">Loading…</div>
  {:else if careers.length === 0}
    <div class="pc-empty">
      <div class="pc-empty-icon">📜</div>
      <div class="pc-empty-title">No completed careers yet</div>
      <p class="pc-empty-sub">Retired or ended careers appear here permanently.</p>
    </div>
  {:else}
    <div class="pc-list">
      {#each careers as career (career.id)}
        {@const isNew = gs._newHistoryId === career.id}
        <div class="pc-card" class:pc-card-new={isNew || expanded.has(career.id)}>
          <!-- Row summary -->
          <div class="pc-row">
            <button
              class="pc-star"
              class:starred={career.starred}
              title={career.starred ? 'Unstar' : 'Star'}
              onclick={() => onStar(career)}
            >★</button>

            <div class="pc-avatar">
              <FighterAvatar
                avatar={career.stat_breakdown?.avatar}
                beltType={career.stat_breakdown?.highestBeltType ?? null}
                gloveColor="#8f1f1f"
                size={48}
              />
            </div>

            <div class="pc-info">
              <div class="pc-name">{career.fighter_name || '—'}</div>
              <div class="pc-meta">
                <span class="pc-record">{career.final_record ?? '—'}</span>
                {#if career.legacy_title}
                  <span class="pc-sep">·</span>
                  <span class="pc-legacy">{career.legacy_title}</span>
                {/if}
                {#if career.highest_org}
                  <span class="pc-sep">·</span>
                  <span class="pc-org">{career.highest_org}</span>
                {/if}
                <span class="pc-sep">·</span>
                <span class="pc-date">{formatDate(career.ended_at)}</span>
              </div>
            </div>

            <button
              class="pc-del-btn"
              disabled={deleting === career.id}
              onclick={() => onDelete(career)}
              title="Delete this past career"
            >Delete</button>

            <button
              class="pc-expand-btn"
              onclick={() => toggleExpand(career.id)}
              title={expanded.has(career.id) ? 'Collapse' : 'Expand'}
            >{expanded.has(career.id) ? '▲' : '▼'}</button>
          </div>

          <!-- Expandable stat breakdown -->
          {#if expanded.has(career.id)}
            {@const sb = career.stat_breakdown}
            {#if sb}
              <div class="pc-breakdown">
                <div class="pb-grid">
                  <div class="pb-stat">
                    <div class="pb-num" style="color:var(--green)">{sb.wins ?? 0}</div>
                    <div class="pb-label">Wins</div>
                  </div>
                  <div class="pb-stat">
                    <div class="pb-num" style="color:var(--amber)">{sb.draws ?? 0}</div>
                    <div class="pb-label">Draws</div>
                  </div>
                  <div class="pb-stat">
                    <div class="pb-num" style="color:var(--red)">{sb.losses ?? 0}</div>
                    <div class="pb-label">Losses</div>
                  </div>
                  <div class="pb-stat">
                    <div class="pb-num">{sb.fightIndex ?? 0}</div>
                    <div class="pb-label">Fights</div>
                  </div>
                  <div class="pb-stat">
                    <div class="pb-num">{sb.bestStreak ?? 0}</div>
                    <div class="pb-label">Best Streak</div>
                  </div>
                  <div class="pb-stat">
                    <div class="pb-num">{sb.champCount ?? 0}</div>
                    <div class="pb-label">Title Reigns</div>
                  </div>
                  <div class="pb-stat">
                    <div class="pb-num">{sb.defenseStreak ?? 0}</div>
                    <div class="pb-label">Max Defenses</div>
                  </div>
                  <div class="pb-stat">
                    <div class="pb-num">{(sb.winsByKO ?? 0) + (sb.winsByTKO ?? 0) + (sb.winsBySub ?? 0)}</div>
                    <div class="pb-label">Finishes</div>
                  </div>
                </div>
                <div class="pb-finish-row">
                  <span class="pb-finish-badge ko">KO ×{sb.winsByKO ?? 0}</span>
                  <span class="pb-finish-badge tko">TKO ×{sb.winsByTKO ?? 0}</span>
                  <span class="pb-finish-badge sub">Sub ×{sb.winsBySub ?? 0}</span>
                  <span class="pb-finish-badge dec">Dec ×{sb.winsByDec ?? 0}</span>
                </div>

                {#if sb.titles?.length}
                  <div class="pb-titles-label">Championships</div>
                  <div class="pb-titles">
                    {#each sb.titles as t}
                      <div class="pb-title-row">
                        <span class="pb-title-belt">🏆 {t.belt}</span>
                        <span class="pb-title-meta">
                          {t.reigns}× reign{t.reigns > 1 ? 's' : ''}{t.bestDefenseStreak > 0
                            ? ` · ${t.bestDefenseStreak} def` : ''}
                        </span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else}
              <div class="pc-breakdown pc-no-stats">No detailed stats recorded for this career.</div>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .pc-wrap { max-width: 680px; margin: 0 auto; padding: 8px 0 40px; }

  .pc-topbar {
    display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
  }
  .pc-title  { font-family: var(--font-display); font-size: 28px; letter-spacing: 0.04em; flex: 1; }
  .pc-back   { padding: 6px 14px; font-size: 12px; white-space: nowrap; }
  .pc-count-badge {
    font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--text-muted); background: var(--surface2);
    border: 1px solid var(--border); border-radius: 3px; padding: 3px 10px;
    white-space: nowrap;
  }

  .pc-loading { color: var(--text-muted); font-size: 13px; padding: 20px 0; }
  .pc-error   { color: var(--red); font-size: 13px; padding: 8px 0; }

  .pc-empty { text-align: center; padding: 48px 0; }
  .pc-empty-icon  { font-size: 36px; margin-bottom: 12px; }
  .pc-empty-title { font-family: var(--font-display); font-size: 22px; letter-spacing: 0.04em; margin-bottom: 6px; }
  .pc-empty-sub   { font-size: 13px; color: var(--text-muted); }

  .pc-list { display: flex; flex-direction: column; gap: 6px; }

  .pc-card {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden;
    transition: border-color 0.15s;
  }
  .pc-card-new { border-color: var(--accent); }

  .pc-row {
    display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  }

  .pc-star {
    background: none; border: none; font-size: 18px; cursor: pointer; padding: 0 2px;
    color: var(--border); transition: color 0.15s; line-height: 1; flex-shrink: 0;
  }
  .pc-star:hover  { color: var(--accent); }
  .pc-star.starred { color: var(--accent); }

  .pc-avatar { flex-shrink: 0; }

  .pc-info { flex: 1; min-width: 0; }
  .pc-name {
    font-family: var(--font-display); font-size: 18px; letter-spacing: 0.04em;
    margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pc-meta { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 11px; color: var(--text-muted); }
  .pc-sep    { opacity: 0.4; }
  .pc-record { font-family: var(--font-display); font-size: 11px; color: var(--text); }
  .pc-legacy { color: var(--accent); font-weight: 600; }
  .pc-org    { color: var(--text-muted); }
  .pc-date   { color: var(--text-muted); }

  .pc-del-btn {
    background: none; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px;
    color: var(--text-muted); cursor: pointer; flex-shrink: 0;
    font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 4px 10px; font-family: var(--font-body); transition: border-color 0.15s, color 0.15s;
  }
  .pc-del-btn:hover { border-color: var(--red); color: var(--red); }
  .pc-del-btn:disabled { opacity: 0.5; cursor: default; }

  .pc-expand-btn {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 12px; padding: 4px 8px; transition: color 0.15s; flex-shrink: 0;
  }
  .pc-expand-btn:hover { color: var(--text); }

  /* Breakdown panel */
  .pc-breakdown { padding: 14px 16px 16px; border-top: 1px solid var(--border); background: var(--surface); }
  .pc-no-stats  { font-size: 12px; color: var(--text-muted); font-style: italic; }

  .pb-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;
  }
  .pb-stat   { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px; text-align: center; }
  .pb-num    { font-family: var(--font-display); font-size: 22px; line-height: 1; margin-bottom: 3px; color: var(--text); }
  .pb-label  { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }

  .pb-finish-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .pb-finish-badge {
    font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 2px 8px; border-radius: 3px; font-weight: 600;
  }
  .pb-finish-badge.ko  { background: rgba(232,74,74,0.15);  color: var(--red); }
  .pb-finish-badge.tko { background: rgba(232,74,74,0.10);  color: var(--red); opacity: 0.8; }
  .pb-finish-badge.sub { background: rgba(180,74,232,0.15); color: #b44ae8; }
  .pb-finish-badge.dec { background: rgba(74,158,232,0.15); color: var(--blue); }

  .pb-titles-label { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); margin: 12px 0 6px; }
  .pb-titles { display: flex; flex-direction: column; gap: 4px; }
  .pb-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 10px; }
  .pb-title-belt { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; color: var(--accent); }
  .pb-title-meta { font-size: 10px; color: var(--text-muted); letter-spacing: 0.04em; white-space: nowrap; }

  @media (max-width: 600px) {
    .pc-topbar { flex-wrap: wrap; }
    .pb-grid   { grid-template-columns: repeat(2, 1fr); }
    .pc-meta   { gap: 3px; }
  }
</style>
