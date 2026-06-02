<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { session } from '$lib/stores/session';
  import {
    loadLearningSets, loadGroups,
    loadSrStatesForSets,
    calcSetProgress, calcGroupProgress, calcOverallProgress,
    avgDifficulty, countDue, nextDueDate,
    isDue, isMastered,
  } from '$lib/progress.js';

  let learningSets  = $state([]);
  let groups        = $state([]);
  let srStatesMap   = $state(new Map()); // Map<setId, Map<qid, srState>>
  let loading       = $state(true);
  let error         = $state('');

  onMount(async () => {
    if (!$session) { goto('/auth/login'); return; }
    try {
      const uid = $session.user.id;
      const [ls, gr] = await Promise.all([loadLearningSets(uid), loadGroups(uid)]);
      learningSets = ls;
      groups       = gr;

      // Collect all set IDs we need SR states for
      const setIds = [...new Set([
        ...ls.map(r => r.set_id),
        ...gr.flatMap(g => (g.question_set_group_members || []).map(m => m.set_id)),
      ])];

      if (setIds.length) {
        srStatesMap = await loadSrStatesForSets(uid, setIds);
      }
    } catch (e) {
      error = e.message;
    }
    loading = false;
  });

  // ── Derived progress ──────────────────────────────────
  const overall = $derived(calcOverallProgress(learningSets, srStatesMap));
  const totalDue = $derived(countDue(srStatesMap));
  const upcomingDate = $derived(nextDueDate(srStatesMap));

  function setProgress(ls) {
    return calcSetProgress(ls.set_id, ls.question_count, srStatesMap.get(ls.set_id));
  }

  function groupProgress(group) {
    return calcGroupProgress(group.question_set_group_members || [], srStatesMap);
  }

  function diffStars(srMap) {
    const avg = avgDifficulty(srMap);
    if (avg === null) return null;
    return Math.round(avg / 2); // 1–5 stars from 1–10 scale
  }

  function fmtPct(n) { return Math.round(n * 100) + '%'; }
  function fmtDate(d) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function sourceBadgeClass(source) {
    return source === 'library' ? 'badge-library' : source === 'public' ? 'badge-public' : 'badge-default';
  }
  function sourceLabel(source) {
    return source === 'library' ? 'Library' : source === 'public' ? 'Public' : 'Default';
  }

  // Groups expanded state
  let expandedGroups = $state(new Set());
  function toggleGroup(id) {
    const s = new Set(expandedGroups);
    s.has(id) ? s.delete(id) : s.add(id);
    expandedGroups = s;
  }
</script>

<svelte:head>
  <title>Learning Progress — McChimp</title>
</svelte:head>

<div class="learn-wrap">
  <div class="learn-header">
    <div>
      <h1 class="learn-title">Learning Progress</h1>
      <p class="learn-sub">Track your mastery across question sets.</p>
    </div>
    <a href="/learn/study" class="btn-study">Study Due Cards{totalDue > 0 ? ` (${totalDue})` : ''}</a>
  </div>

  {#if loading}
    <p class="muted">Loading…</p>
  {:else if error}
    <div class="alert-error">{error}</div>
  {:else if learningSets.length === 0 && groups.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📚</div>
      <div class="empty-title">Nothing tracked yet</div>
      <p class="empty-desc">
        Mark question sets as &ldquo;Learn&rdquo; in your <a href="/questions/library" class="link">Library</a> to track your learning progress here.
      </p>
    </div>
  {:else}

    <!-- OVERALL SUMMARY -->
    {#if learningSets.length > 0}
      <div class="summary-card">
        <div class="summary-row">
          <div class="summary-stat">
            <span class="stat-value">{fmtPct(overall.masteryPct)}</span>
            <span class="stat-label">Mastered</span>
          </div>
          <div class="summary-stat">
            <span class="stat-value">{fmtPct(overall.seenPct)}</span>
            <span class="stat-label">Seen</span>
          </div>
          <div class="summary-stat">
            <span class="stat-value">{overall.totalQ ?? 0}</span>
            <span class="stat-label">Total Questions</span>
          </div>
          <div class="summary-stat">
            <span class="stat-value{totalDue > 0 ? ' due-highlight' : ''}">{totalDue}</span>
            <span class="stat-label">Due Now</span>
          </div>
        </div>
        <div class="bar-outer">
          <div class="bar-seen"    style="width:{fmtPct(overall.seenPct)}"></div>
          <div class="bar-mastered" style="width:{fmtPct(overall.masteryPct)}"></div>
        </div>
        <div class="bar-legend">
          <span class="legend-mastered">■ Mastered ({overall.masteredCount ?? 0})</span>
          <span class="legend-seen">■ Seen ({overall.seenCount ?? 0})</span>
          {#if upcomingDate && totalDue === 0}
            <span class="legend-muted">Next review: {fmtDate(upcomingDate)}</span>
          {/if}
        </div>
      </div>
    {/if}

    <!-- LEARNING SETS -->
    {#if learningSets.length > 0}
      <section class="section">
        <h2 class="section-title">Learning Sets</h2>
        <div class="sets-list">
          {#each learningSets as ls}
            {@const p = setProgress(ls)}
            {@const srMap = srStatesMap.get(ls.set_id)}
            {@const stars = diffStars(srMap)}
            <div class="set-row">
              <div class="set-row-top">
                <span class="set-row-name">{ls.set_name}</span>
                <span class="source-badge {sourceBadgeClass(ls.set_source)}">{sourceLabel(ls.set_source)}</span>
                {#if stars !== null}
                  <span class="diff-stars" title="Average difficulty">
                    {#each {length: 5} as _, i}
                      <span class:filled={i < stars}>★</span>
                    {/each}
                  </span>
                {/if}
                {#if p.dueCount > 0}
                  <span class="due-badge">{p.dueCount} due</span>
                {/if}
              </div>
              <div class="bar-outer small">
                <div class="bar-seen"    style="width:{fmtPct(p.seenPct)}"></div>
                <div class="bar-mastered" style="width:{fmtPct(p.masteryPct)}"></div>
              </div>
              <div class="set-row-stats">
                <span>{p.masteredCount} / {ls.question_count} mastered ({fmtPct(p.masteryPct)})</span>
                <span class="muted">·</span>
                <span class="muted">{p.seenCount} seen</span>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- GROUPS -->
    {#if groups.length > 0}
      <section class="section">
        <h2 class="section-title">Groups</h2>
        <div class="groups-list">
          {#each groups as group}
            {@const gp = groupProgress(group)}
            <div class="group-card" style="--gc:{group.color || '#E8C14A'}">
              <button class="group-header" onclick={() => toggleGroup(group.id)}>
                <span class="group-dot" style="background:{group.color || '#E8C14A'}"></span>
                <span class="group-name">{group.name}</span>
                <span class="group-count">{(group.question_set_group_members || []).length} sets</span>
                <div class="bar-outer micro">
                  <div class="bar-seen"    style="width:{fmtPct(gp.seenPct)}"></div>
                  <div class="bar-mastered" style="width:{fmtPct(gp.masteryPct)}"></div>
                </div>
                <span class="group-pct">{fmtPct(gp.masteryPct)}</span>
                <span class="expand-icon">{expandedGroups.has(group.id) ? '▲' : '▼'}</span>
              </button>

              {#if expandedGroups.has(group.id)}
                <div class="group-members">
                  {#each (group.question_set_group_members || []) as member}
                    {@const mp = calcSetProgress(member.set_id, member.question_count, srStatesMap.get(member.set_id))}
                    <div class="member-row">
                      <span class="member-name">{member.set_name}</span>
                      <span class="source-badge {sourceBadgeClass(member.set_source)}">{sourceLabel(member.set_source)}</span>
                      <div class="bar-outer micro">
                        <div class="bar-seen"    style="width:{fmtPct(mp.seenPct)}"></div>
                        <div class="bar-mastered" style="width:{fmtPct(mp.masteryPct)}"></div>
                      </div>
                      <span class="member-pct">{fmtPct(mp.masteryPct)}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/if}

  {/if}
</div>

<style>
  .learn-wrap { padding: 120px 48px 80px; max-width: 900px; }
  .learn-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 36px; flex-wrap: wrap; }
  .learn-title { font-family: 'Bebas Neue', sans-serif; font-size: 40px; letter-spacing: .04em; color: var(--white); margin: 0 0 6px; }
  .learn-sub { font-size: 14px; color: var(--muted); margin: 0; }

  .btn-study {
    font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase;
    background: var(--gold); color: var(--black); border: none;
    padding: 12px 24px; border-radius: 3px; text-decoration: none; white-space: nowrap;
    transition: background .15s; flex-shrink: 0;
  }
  .btn-study:hover { background: var(--gold2); }

  .muted { color: var(--muted); font-size: 14px; }
  .link { color: var(--gold); text-decoration: none; }
  .link:hover { text-decoration: underline; }
  .alert-error { background: rgba(217,64,64,0.08); border: 1px solid rgba(217,64,64,0.3); border-radius: 3px; padding: 12px 16px; font-size: 13px; color: #E88A8A; }

  .empty-state { background: var(--surface); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 64px; text-align: center; }
  .empty-icon { font-size: 40px; margin-bottom: 16px; }
  .empty-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: .04em; color: var(--white); margin-bottom: 10px; }
  .empty-desc { font-size: 14px; color: var(--muted); line-height: 1.6; max-width: 420px; margin: 0 auto; }

  /* ── Summary card ──────────────────────────────────── */
  .summary-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 28px; margin-bottom: 36px; }
  .summary-row { display: flex; gap: 32px; flex-wrap: wrap; margin-bottom: 20px; }
  .summary-stat { display: flex; flex-direction: column; gap: 2px; }
  .stat-value { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: .04em; color: var(--white); line-height: 1; }
  .stat-value.due-highlight { color: var(--gold); }
  .stat-label { font-size: 11px; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }

  /* ── Progress bars ─────────────────────────────────── */
  .bar-outer { position: relative; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; margin-bottom: 8px; }
  .bar-outer.small { height: 4px; margin: 6px 0 4px; }
  .bar-outer.micro { height: 3px; width: 80px; margin: 0; flex-shrink: 0; }
  .bar-seen { position: absolute; top: 0; left: 0; height: 100%; background: rgba(232,193,74,0.25); border-radius: 3px; transition: width .3s; }
  .bar-mastered { position: absolute; top: 0; left: 0; height: 100%; background: var(--gold); border-radius: 3px; transition: width .3s; }
  .bar-legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; }
  .legend-mastered { color: var(--gold); }
  .legend-seen { color: rgba(232,193,74,0.5); }
  .legend-muted { color: var(--muted); }

  /* ── Sections ──────────────────────────────────────── */
  .section { margin-bottom: 36px; }
  .section-title {
    font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700;
    letter-spacing: .12em; text-transform: uppercase; color: var(--muted);
    margin: 0 0 16px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;
  }

  /* ── Learning set rows ─────────────────────────────── */
  .sets-list { display: flex; flex-direction: column; gap: 14px; }
  .set-row { background: var(--surface); border: 1px solid rgba(255,255,255,0.04); border-radius: 3px; padding: 18px 20px; }
  .set-row-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
  .set-row-name { font-size: 15px; font-weight: 600; color: var(--white); flex: 1; min-width: 120px; }
  .set-row-stats { font-size: 12px; color: var(--white); display: flex; gap: 8px; }

  .source-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; border-radius: 2px; padding: 2px 7px; flex-shrink: 0; }
  .badge-library { background: rgba(232,193,74,0.07); color: var(--gold); border: 1px solid rgba(232,193,74,0.2); }
  .badge-public  { background: rgba(42,94,173,0.08); color: #7aaee8; border: 1px solid rgba(42,94,173,0.2); }
  .badge-default { background: rgba(107,107,107,0.1); color: var(--muted); border: 1px solid rgba(107,107,107,0.2); }

  .diff-stars { font-size: 12px; color: var(--muted); letter-spacing: 1px; }
  .diff-stars :global(.filled) { color: var(--gold); }
  .diff-stars span.filled { color: var(--gold); }
  .diff-stars span { color: rgba(107,107,107,0.5); }

  .due-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: rgba(232,193,74,0.15); color: var(--gold); border: 1px solid rgba(232,193,74,0.3); padding: 2px 8px; border-radius: 2px; }

  /* ── Groups ────────────────────────────────────────── */
  .groups-list { display: flex; flex-direction: column; gap: 8px; }
  .group-card { --gc: #E8C14A; background: var(--surface); border: 1px solid rgba(255,255,255,0.04); border-left: 3px solid var(--gc); border-radius: 3px; overflow: hidden; }
  .group-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .group-header { width: 100%; background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 14px; padding: 16px 20px; text-align: left; }
  .group-header:hover { background: rgba(255,255,255,0.02); }
  .group-name { font-size: 15px; font-weight: 600; color: var(--white); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .group-count { white-space: nowrap; flex-shrink: 0; }
  .group-count { font-size: 12px; color: var(--muted); }
  .group-pct { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; color: var(--gold); min-width: 38px; text-align: right; }
  .expand-icon { font-size: 10px; color: var(--muted); }

  .group-members { border-top: 1px solid rgba(255,255,255,0.04); padding: 12px 20px; display: flex; flex-direction: column; gap: 10px; }
  .member-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .member-name { font-size: 13px; color: rgba(242,239,232,0.7); flex: 1; min-width: 100px; }
  .member-pct { font-size: 12px; color: var(--gold); font-family: 'Barlow Condensed', sans-serif; font-weight: 700; min-width: 36px; text-align: right; }

  @media (max-width: 700px) {
    .learn-wrap { padding: 100px 20px 60px; }
    .summary-row { gap: 20px; }
    .stat-value { font-size: 26px; }
  }
</style>
