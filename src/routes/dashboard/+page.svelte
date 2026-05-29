<script>
  import { supabase } from '$lib/supabase';
  import { session } from '$lib/stores/session';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getUserLimits } from '$lib/saves';

  let profile  = $state(null);
  let saves    = $state([]);
  let history  = $state([]);
  let loading  = $state(true);

  const GAME_LABELS = {
    mma:      'MMA Career Trivia',
    football: 'Football Trivia',
  };

  // Returns up to 5 entries: always the most recent, then starred (up to 4), then fill by recency.
  function getDisplayEntries(allEntries, dateField) {
    if (!allEntries.length) return [];
    const sorted = [...allEntries].sort((a, b) =>
      new Date(b[dateField]) - new Date(a[dateField])
    );
    const result = [sorted[0]];
    const rest   = sorted.slice(1);
    for (const e of rest) { if (result.length >= 5) break; if (e.starred) result.push(e); }
    for (const e of rest) { if (result.length >= 5) break; if (!result.includes(e)) result.push(e); }
    return result;
  }

  const displaySaves   = $derived(getDisplayEntries(saves,   'updated_at'));
  const displayHistory = $derived(getDisplayEntries(history, 'ended_at'));
  const limits         = $derived(getUserLimits(profile));

  onMount(async () => {
    if (!$session) { goto('/auth/login'); return; }

    const [profileRes, savesRes, historyRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', $session.user.id).single(),
      supabase.from('career_saves').select('*').eq('user_id', $session.user.id).order('updated_at', { ascending: false }),
      supabase.from('career_history').select('*').eq('user_id', $session.user.id).order('ended_at', { ascending: false }),
    ]);

    profile = profileRes.data;
    saves   = savesRes.data   || [];
    history = historyRes.data || [];
    loading = false;
  });

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getSaveRecord(save) {
    const d = save.save_data;
    if (!d) return null;
    const w = d.wins ?? d.record?.w ?? 0;
    const l = d.losses ?? d.record?.l ?? 0;
    const dr = d.draws ?? d.record?.d ?? 0;
    return `${w}W–${l}L–${dr}D`;
  }

  function getSaveFighterName(save) {
    return save.fighter_name || save.save_data?.career?.fighterName || save.save_data?.fighterName || null;
  }

  function getGameContinueLink(save) {
    // Resume this specific career directly, not the save-management screen.
    if (save.game_id === 'mma') return `/mma?continue=${save.id}`;
    return `/${save.game_id}`;
  }

  function getGameHistoryLink(gameId) {
    if (gameId === 'mma') return '/mma?screen=past_careers';
    return `/${gameId}`;
  }
</script>

<svelte:head>
  <title>Dashboard — McChimp</title>
</svelte:head>

<div class="dash-wrap">

  <!-- HEADER -->
  <div class="dash-header">
    <div>
      <div class="page-eyebrow">Dashboard</div>
      <h1 class="page-title">
        {#if loading}Welcome back{:else}Welcome back, {profile?.display_name || 'Fighter'}{/if}
      </h1>
    </div>
    <a href="/account" class="btn-account">Account Settings</a>
  </div>

  {#if loading}
    <div class="loading">Loading your data…</div>
  {:else}

    <!-- ACTIVE CAREERS -->
    <div class="section">
      <div class="section-label">Active Careers</div>

      {#if saves.length === 0}
        <div class="empty-state">
          <div class="empty-icon">🥊</div>
          <div class="empty-title">No active careers</div>
          <p class="empty-desc">Start a game to begin your career. Progress is saved automatically.</p>
          <div class="empty-actions">
            <a href="/mma" class="btn-primary">Play MMA Trivia</a>
            <a href="/football" class="btn-ghost">Play Football Trivia</a>
          </div>
        </div>
      {:else}
        {#if saves.length > 5}
          <div class="dash-note">Showing {displaySaves.length} of {saves.length} careers (most recent + starred). <a href="/mma?screen=saved_careers">Manage all →</a></div>
        {/if}
        <div class="careers-list">
          {#each displaySaves as save}
            {@const record = getSaveRecord(save)}
            {@const name = getSaveFighterName(save)}
            <a href={getGameContinueLink(save)} class="active-row" class:starred={save.starred}>
              <div class="ar-left">
                <div class="ar-game">{GAME_LABELS[save.game_id] || save.game_id}</div>
                <div class="ar-name">
                  {name || '—'}{#if save.starred}<span class="ar-star">★</span>{/if}
                </div>
              </div>
              <div class="ar-mid">
                {#if record}<span class="ar-record">{record}</span>{/if}
              </div>
              <div class="ar-right">
                <span class="ar-updated">Last played {formatDate(save.updated_at)}</span>
                <span class="ar-continue">Continue →</span>
              </div>
            </a>
          {/each}
        </div>
        {#if saves.length > 1}
          <div class="dash-link-row">
            <a href="/mma?screen=saved_careers" class="dash-manage-link">Manage all {saves.length} careers →</a>
          </div>
        {/if}
      {/if}
    </div>

    <!-- CAREER HISTORY -->
    <div class="section">
      <div class="section-label">Career History</div>

      {#if history.length === 0}
        <div class="empty-state empty-state--small">
          <div class="empty-title">No completed careers yet</div>
          <p class="empty-desc">Retired or ended careers will appear here permanently.</p>
        </div>
      {:else}
        {#if history.length > 5}
          <div class="dash-note">Showing {displayHistory.length} of {history.length} careers (most recent + starred). <a href="/mma?screen=past_careers">View all →</a></div>
        {/if}
        <div class="history-list">
          {#each displayHistory as career}
            <div class="history-row" class:starred={career.starred}>
              <div class="history-left">
                <div class="history-game">{GAME_LABELS[career.game_id] || career.game_id}</div>
                {#if career.fighter_name}
                  <div class="history-name">{career.fighter_name}</div>
                {/if}
              </div>
              <div class="history-mid">
                {#if career.final_record}
                  <span class="hist-record">{career.final_record}</span>
                {/if}
              </div>
              <div class="history-right">
                {#if career.legacy_title}
                  <span class="legacy-tag">{career.legacy_title}</span>
                {/if}
                {#if career.highest_org}
                  <span class="org-tag">{career.highest_org}</span>
                {/if}
                <div class="history-date">{formatDate(career.ended_at)}</div>
              </div>
            </div>
          {/each}
        </div>
        {#if history.length > 1}
          <div class="dash-link-row">
            <a href={getGameHistoryLink('mma')} class="dash-manage-link">View all {history.length} past careers →</a>
          </div>
        {/if}
      {/if}
    </div>

    <!-- QUICK LINKS -->
    <div class="section">
      <div class="section-label">Play</div>
      <div class="quick-grid">
        <a href="/mma" class="quick-card">
          <div class="quick-title">MMA Career Trivia</div>
          <div class="quick-arrow">Play →</div>
          <div class="quick-accent" style="background:var(--gold)"></div>
        </a>
        <a href="/football" class="quick-card">
          <div class="quick-title">Football Trivia</div>
          <div class="quick-arrow">Play →</div>
          <div class="quick-accent" style="background:var(--green)"></div>
        </a>
        <a href="/questions" class="quick-card">
          <div class="quick-title">Question Sets</div>
          <div class="quick-arrow">Browse →</div>
          <div class="quick-accent" style="background:var(--blue)"></div>
        </a>
      </div>
    </div>

  {/if}
</div>

<style>
  .dash-wrap {
    min-height: 100vh;
    padding: 120px 48px 80px;
    max-width: 1100px;
  }
  .dash-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 48px;
    gap: 24px;
    flex-wrap: wrap;
  }
  .page-eyebrow {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .2em;
    text-transform: uppercase; color: var(--gold); margin-bottom: 8px;
  }
  .page-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(42px, 6vw, 72px);
    line-height: 1; letter-spacing: .03em; color: var(--white);
  }
  .btn-account {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    background: transparent; color: var(--muted);
    border: 1px solid rgba(255,255,255,0.1);
    padding: 10px 20px; border-radius: 3px; text-decoration: none;
    transition: all .15s; white-space: nowrap; flex-shrink: 0;
  }
  .btn-account:hover { color: var(--white); border-color: rgba(255,255,255,0.3); }

  .loading { color: var(--muted); font-size: 14px; }

  .section { margin-bottom: 48px; }
  .section-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 10px; font-weight: 700; letter-spacing: .2em;
    text-transform: uppercase; color: var(--muted);
    margin-bottom: 16px;
    display: flex; align-items: center; gap: 10px;
  }
  .section-label::before { content: ''; display: block; width: 20px; height: 1px; background: var(--gold); }

  .dash-note {
    font-size: 12px; color: var(--muted); margin-bottom: 12px;
  }
  .dash-note a { color: var(--gold); text-decoration: none; }
  .dash-note a:hover { text-decoration: underline; }

  .dash-link-row { margin-top: 12px; }
  .dash-manage-link {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    color: var(--gold); text-decoration: none; transition: opacity .15s;
  }
  .dash-manage-link:hover { opacity: .7; }

  .empty-state {
    background: var(--surface);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 4px;
    padding: 48px;
    text-align: center;
  }
  .empty-state--small { padding: 32px; }
  .empty-icon { font-size: 36px; margin-bottom: 16px; }
  .empty-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 24px; letter-spacing: .04em; color: var(--white); margin-bottom: 8px;
  }
  .empty-desc { font-size: 14px; color: var(--muted); line-height: 1.6; max-width: 400px; margin: 0 auto 24px; }
  .empty-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

  .btn-primary {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    background: var(--gold); color: var(--black); border: none;
    padding: 11px 24px; border-radius: 3px; cursor: pointer;
    text-decoration: none; transition: background .15s; display: inline-block;
  }
  .btn-primary:hover { background: var(--gold2); }
  .btn-ghost {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    background: transparent; color: var(--white);
    border: 1px solid rgba(255,255,255,0.15);
    padding: 11px 24px; border-radius: 3px; cursor: pointer;
    text-decoration: none; transition: border-color .15s; display: inline-block;
  }
  .btn-ghost:hover { border-color: rgba(255,255,255,0.4); }

  /* Active careers — full-width rows, lighter gold-tinted styling */
  .careers-list { display: flex; flex-direction: column; gap: 2px; }
  .active-row {
    display: flex; align-items: center; gap: 24px;
    background: rgba(232,193,74,0.05);
    border: 1px solid rgba(232,193,74,0.16);
    padding: 18px 24px; text-decoration: none;
    transition: background .15s, border-color .15s;
  }
  .active-row:hover { background: rgba(232,193,74,0.10); border-color: rgba(232,193,74,0.32); }
  .active-row.starred { border-color: rgba(232,193,74,0.4); }
  .ar-left { flex: 1; min-width: 0; }
  .ar-game {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: var(--gold); margin-bottom: 3px;
  }
  .ar-name {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 24px; letter-spacing: .03em; color: var(--white); line-height: 1;
    display: flex; align-items: center; gap: 8px;
  }
  .ar-star { color: var(--gold); font-size: 15px; }
  .ar-mid { min-width: 90px; }
  .ar-record { font-size: 14px; color: var(--muted); }
  .ar-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .ar-updated { font-size: 11px; color: var(--muted); }
  .ar-continue {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    color: var(--gold);
  }

  .history-list { display: flex; flex-direction: column; gap: 2px; }
  .history-row {
    background: var(--surface);
    border: 1px solid rgba(255,255,255,0.04);
    padding: 16px 24px;
    display: flex; align-items: center; gap: 24px;
    transition: border-color .15s;
  }
  .history-row.starred { border-color: rgba(232,193,74,0.25); }
  .history-left { flex: 1; min-width: 0; }
  .history-game {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 2px;
  }
  .history-name { font-size: 14px; color: var(--white); font-weight: 500; }
  .history-mid  { min-width: 80px; }
  .hist-record  { font-size: 13px; color: var(--muted); }
  .history-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .legacy-tag {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    background: rgba(232,193,74,0.1); color: var(--gold);
    border: 1px solid rgba(232,193,74,0.25); padding: 2px 8px; border-radius: 2px;
  }
  .org-tag {
    font-size: 10px; color: var(--muted); letter-spacing: .05em;
  }
  .history-date { font-size: 11px; color: var(--muted); }

  .quick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; }
  .quick-card {
    background: var(--surface);
    border: 1px solid rgba(255,255,255,0.04);
    padding: 28px;
    text-decoration: none;
    display: block;
    position: relative;
    overflow: hidden;
    transition: background .2s;
  }
  .quick-card:hover { background: #1E2023; }
  .quick-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 22px; letter-spacing: .04em; color: var(--white); margin-bottom: 16px;
  }
  .quick-arrow {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    color: var(--gold);
  }
  .quick-accent { position: absolute; bottom: 0; left: 0; right: 0; height: 2px; }

  @media (max-width: 900px) {
    .dash-wrap { padding: 100px 24px 60px; }
    .quick-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 600px) {
    .dash-header { flex-direction: column; align-items: flex-start; }
    .history-row { flex-wrap: wrap; }
    .active-row  { flex-wrap: wrap; gap: 10px; }
    .ar-right    { align-items: flex-start; flex-direction: row; gap: 12px; }
  }
</style>
