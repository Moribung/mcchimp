<!-- src/lib/golf/screens/PastRoundsScreen.svelte -->
<!-- Read-only registry of completed rounds with expandable scorecard. -->
<script>
  import { get }      from 'svelte/store';
  import { session }  from '$lib/stores/session.js';
  import { supabase } from '$lib/supabase.js';
  import { loadPastCareers, toggleHistoryStar, deleteHistory, getUserLimits } from '$lib/saves.js';
  import { parLabel, toParStr } from '$lib/golf/constants.js';

  const { onback, newId = null } = $props();

  let rounds   = $state([]);
  let profile  = $state(null);
  let loading  = $state(true);
  let error    = $state('');
  let expanded = $state(new Set());
  let deleting = $state(null);

  const limits = $derived(getUserLimits(profile));

  async function reload() {
    const sess = get(session);
    if (!sess) { loading = false; return; }
    loading = true; error = '';
    try {
      const [data, prof] = await Promise.all([
        loadPastCareers(sess.user.id, 'golf'),
        supabase.from('profiles').select('tier').eq('id', sess.user.id).single().then(r => r.data),
      ]);
      profile = prof;
      rounds  = data;
      if (newId) expanded = new Set([newId]);
    } catch (e) {
      error = 'Could not load round history.';
    } finally {
      loading = false;
    }
  }
  reload();

  function fmtDate(s) { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

  function toggleExpand(id) {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    expanded = next;
  }

  async function onStar(r) {
    const next = !r.starred;
    rounds = rounds.map(x => x.id === r.id ? { ...x, starred: next } : x);
    try { await toggleHistoryStar(r.id, next); error = ''; }
    catch (e) { rounds = rounds.map(x => x.id === r.id ? { ...x, starred: !next } : x); error = 'Could not update star.'; }
  }

  async function onDelete(r) {
    if (!confirm('Permanently delete this round? This cannot be undone.')) return;
    deleting = r.id;
    const prev = rounds;
    rounds = rounds.filter(x => x.id !== r.id);
    try { await deleteHistory(r.id); error = ''; }
    catch (e) { rounds = prev; error = 'Could not delete round.'; }
    finally { deleting = null; }
  }

  function diffClass(strokes, par) {
    const d = strokes - par;
    return d < 0 ? 'under' : d === 0 ? 'even' : 'over';
  }
  function toParColor(toPar) {
    return toPar < 0 ? 'var(--green)' : toPar > 0 ? 'var(--red)' : 'var(--accent)';
  }
</script>

<div class="pc-wrap">
  <div class="pc-topbar">
    <button class="btn btn-ghost pc-back" onclick={() => onback?.()}>← Back</button>
    <div class="pc-title">Past Rounds</div>
    <span class="pc-count-badge">{rounds.length} / {limits.maxPastCareers}</span>
  </div>

  {#if error}<div class="pc-error">{error}</div>{/if}

  {#if loading}
    <div class="pc-loading">Loading…</div>
  {:else if rounds.length === 0}
    <div class="pc-empty">
      <div class="pc-empty-icon">⛳</div>
      <div class="pc-empty-title">No completed rounds yet</div>
      <p class="pc-empty-sub">Finished rounds are recorded here permanently.</p>
    </div>
  {:else}
    <div class="pc-list">
      {#each rounds as r (r.id)}
        {@const sb = r.stat_breakdown}
        <div class="pc-card" class:pc-card-new={newId === r.id || expanded.has(r.id)}>
          <div class="pc-row">
            <button class="pc-star" class:starred={r.starred} title={r.starred ? 'Unstar' : 'Star'} onclick={() => onStar(r)}>★</button>
            <div class="pc-score" style="color:{toParColor(sb?.toPar ?? 0)}">{toParStr(sb?.toPar ?? 0)}</div>
            <div class="pc-info">
              <div class="pc-name">{r.fighter_name || 'Round'}</div>
              <div class="pc-meta">
                <span class="pc-record">{sb?.totalStrokes ?? '—'} strokes</span>
                {#if r.legacy_title}<span class="pc-sep">·</span><span class="pc-legacy">{r.legacy_title}</span>{/if}
                <span class="pc-sep">·</span><span class="pc-date">{fmtDate(r.ended_at)}</span>
              </div>
            </div>
            <button class="pc-del-btn" disabled={deleting === r.id} onclick={() => onDelete(r)}>Delete</button>
            <button class="pc-expand-btn" onclick={() => toggleExpand(r.id)}>{expanded.has(r.id) ? '▲' : '▼'}</button>
          </div>

          {#if expanded.has(r.id)}
            {#if sb}
              <div class="pc-breakdown">
                <div class="pb-grid">
                  <div class="pb-stat"><div class="pb-num">{sb.holeCount ?? '—'}</div><div class="pb-label">Holes</div></div>
                  <div class="pb-stat"><div class="pb-num" style="color:var(--green)">{sb.birdies ?? 0}</div><div class="pb-label">Birdies</div></div>
                  <div class="pb-stat"><div class="pb-num" style="color:var(--accent)">{sb.pars ?? 0}</div><div class="pb-label">Pars</div></div>
                  <div class="pb-stat"><div class="pb-num" style="color:var(--red)">{sb.bogeys ?? 0}</div><div class="pb-label">Bogeys</div></div>
                  {#if (sb.eagles ?? 0) + (sb.holesInOne ?? 0) > 0}
                    <div class="pb-stat"><div class="pb-num" style="color:#a855f7">{(sb.eagles ?? 0) + (sb.holesInOne ?? 0)}</div><div class="pb-label">Eagles+</div></div>
                  {/if}
                </div>
                {#if sb.scorecard?.length}
                  <div class="pb-card-label">Scorecard{sb.setName ? ` · ${sb.setName}` : ''}</div>
                  <div class="pb-scorecard">
                    {#each sb.scorecard as h}
                      <div class="pb-chip {diffClass(h.strokes, h.par)}" title="Hole {h.num}: {parLabel(h.strokes, h.par)}">
                        <span class="pb-chip-h">{h.num}</span><span class="pb-chip-s">{h.strokes}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else}
              <div class="pc-breakdown pc-no-stats">No detailed stats recorded for this round.</div>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .pc-wrap { max-width: 680px; margin: 0 auto; padding: 8px 0 40px; }
  .pc-topbar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .pc-title  { font-family: var(--font-display); font-size: 28px; letter-spacing: .04em; flex: 1; }
  .pc-back   { padding: 6px 14px; font-size: 12px; white-space: nowrap; }
  .pc-count-badge { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--text-muted); background: var(--surface2); border: 1px solid var(--border); border-radius: 3px; padding: 3px 10px; white-space: nowrap; }

  .pc-loading { color: var(--text-muted); font-size: 13px; padding: 20px 0; }
  .pc-error   { color: var(--red); font-size: 13px; padding: 8px 0; }
  .pc-empty { text-align: center; padding: 48px 0; }
  .pc-empty-icon  { font-size: 36px; margin-bottom: 12px; }
  .pc-empty-title { font-family: var(--font-display); font-size: 22px; letter-spacing: .04em; margin-bottom: 6px; }
  .pc-empty-sub   { font-size: 13px; color: var(--text-muted); }

  .pc-list { display: flex; flex-direction: column; gap: 6px; }
  .pc-card { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; transition: border-color .15s; }
  .pc-card-new { border-color: var(--accent); }
  .pc-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
  .pc-star { background: none; border: none; font-size: 18px; cursor: pointer; padding: 0 2px; color: var(--border); transition: color .15s; line-height: 1; flex-shrink: 0; }
  .pc-star:hover, .pc-star.starred { color: var(--accent); }
  .pc-score { font-family: var(--font-display); font-size: 28px; min-width: 48px; text-align: center; flex-shrink: 0; }
  .pc-info { flex: 1; min-width: 0; }
  .pc-name { font-family: var(--font-display); font-size: 18px; letter-spacing: .04em; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pc-meta { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 11px; color: var(--text-muted); }
  .pc-sep { opacity: .4; }
  .pc-record { font-family: var(--font-display); font-size: 11px; color: var(--text); }
  .pc-legacy { color: var(--accent); font-weight: 600; }
  .pc-del-btn { background: none; border: 1px solid rgba(255,255,255,.12); border-radius: 3px; color: var(--text-muted); cursor: pointer; flex-shrink: 0; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; padding: 4px 10px; font-family: var(--font-body); transition: border-color .15s, color .15s; }
  .pc-del-btn:hover { border-color: var(--red); color: var(--red); }
  .pc-del-btn:disabled { opacity: .5; cursor: default; }
  .pc-expand-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 12px; padding: 4px 8px; transition: color .15s; flex-shrink: 0; }
  .pc-expand-btn:hover { color: var(--text); }

  .pc-breakdown { padding: 14px 16px 16px; border-top: 1px solid var(--border); background: var(--surface); }
  .pc-no-stats { font-size: 12px; color: var(--text-muted); font-style: italic; }
  .pb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 8px; margin-bottom: 12px; }
  .pb-stat { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px; text-align: center; }
  .pb-num { font-family: var(--font-display); font-size: 22px; line-height: 1; margin-bottom: 3px; color: var(--text); }
  .pb-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .08em; }
  .pb-card-label { font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; }
  .pb-scorecard { display: flex; flex-wrap: wrap; gap: 4px; }
  .pb-chip { display: flex; flex-direction: column; align-items: center; min-width: 24px; padding: 4px 5px; border-radius: 3px; background: var(--surface2); border: 1px solid var(--border); }
  .pb-chip-h { font-size: 8px; color: var(--text-muted); }
  .pb-chip-s { font-family: var(--font-display); font-size: 15px; line-height: 1; }
  .pb-chip.under .pb-chip-s { color: var(--green); }
  .pb-chip.even .pb-chip-s  { color: var(--accent); }
  .pb-chip.over .pb-chip-s  { color: var(--red); }

  @media (max-width: 600px) { .pc-topbar { flex-wrap: wrap; } }
</style>
