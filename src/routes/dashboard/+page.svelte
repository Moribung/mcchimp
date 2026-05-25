<script>
  import { supabase } from '$lib/supabase';
  import { session } from '$lib/stores/session';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let profile = $state(null);
  let saves = $state([]);
  let history = $state([]);
  let loading = $state(true);

  const GAME_LABELS = {
    mma: 'MMA Career Trivia',
    football: 'Football Trivia',
  };

  const GAME_LINKS = {
    mma: '/mma',
    football: '/football',
  };

  onMount(async () => {
    if (!$session) {
      goto('/auth/login');
      return;
    }

    const [profileRes, savesRes, historyRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', $session.user.id).single(),
      supabase.from('career_saves').select('*').eq('user_id', $session.user.id).order('updated_at', { ascending: false }),
      supabase.from('career_history').select('*').eq('user_id', $session.user.id).order('ended_at', { ascending: false }),
    ]);

    profile = profileRes.data;
    saves = savesRes.data || [];
    history = historyRes.data || [];
    loading = false;
  });

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getRecord(save) {
    const d = save.save_data;
    if (!d) return null;
    return d.record || d.career?.record || null;
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
          <p class="empty-desc">Start a game to begin your career. Your progress will be saved automatically once accounts are fully integrated.</p>
          <div class="empty-actions">
            <a href="/mma" class="btn-primary">Play MMA Trivia</a>
            <a href="/football" class="btn-ghost">Play Football Trivia</a>
          </div>
        </div>
      {:else}
        <div class="cards-grid">
          {#each saves as save}
            {@const record = getRecord(save)}
            <div class="career-card">
              <div class="career-card-top">
                <div class="career-game">{GAME_LABELS[save.game_id] || save.game_id}</div>
                <div class="career-updated">Last played {formatDate(save.updated_at)}</div>
              </div>
              {#if save.save_data?.fighterName || save.save_data?.name}
                <div class="career-name">{save.save_data?.fighterName || save.save_data?.name}</div>
              {/if}
              {#if record}
                <div class="career-record">
                  <span class="rec-w">{record.w ?? 0}W</span>
                  <span class="rec-sep">–</span>
                  <span class="rec-l">{record.l ?? 0}L</span>
                  {#if record.d}<span class="rec-sep">–</span><span>{record.d}D</span>{/if}
                </div>
              {/if}
              <a href={GAME_LINKS[save.game_id] || '/games'} class="career-continue">Continue →</a>
            </div>
          {/each}
        </div>
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
        <div class="history-list">
          {#each history as career}
            <div class="history-row">
              <div class="history-left">
                <div class="history-game">{GAME_LABELS[career.game_id] || career.game_id}</div>
                {#if career.fighter_name}
                  <div class="history-name">{career.fighter_name}</div>
                {/if}
              </div>
              <div class="history-mid">
                {#if career.final_record}
                  <span class="rec-w">{career.final_record.w ?? 0}W</span>
                  <span class="rec-sep">–</span>
                  <span class="rec-l">{career.final_record.l ?? 0}L</span>
                {/if}
              </div>
              <div class="history-right">
                {#if career.legacy_title}
                  <span class="legacy-tag">{career.legacy_title}</span>
                {/if}
                <div class="history-date">{formatDate(career.ended_at)}</div>
              </div>
            </div>
          {/each}
        </div>
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

  .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2px; }
  .career-card {
    background: var(--surface);
    border: 1px solid rgba(255,255,255,0.06);
    padding: 28px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .career-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .career-game {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: var(--gold);
  }
  .career-updated { font-size: 11px; color: var(--muted); }
  .career-name {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 28px; letter-spacing: .04em; color: var(--white); line-height: 1;
  }
  .career-record { display: flex; gap: 6px; align-items: center; font-size: 14px; }
  .rec-w { color: #4CAF85; font-weight: 600; }
  .rec-l { color: #D94040; font-weight: 600; }
  .rec-sep { color: var(--muted); }
  .career-continue {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    color: var(--gold); text-decoration: none; margin-top: 8px;
    transition: opacity .15s;
  }
  .career-continue:hover { opacity: .7; }

  .history-list { display: flex; flex-direction: column; gap: 2px; }
  .history-row {
    background: var(--surface);
    border: 1px solid rgba(255,255,255,0.04);
    padding: 16px 24px;
    display: flex; align-items: center; gap: 24px;
  }
  .history-left { flex: 1; min-width: 0; }
  .history-game {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 2px;
  }
  .history-name { font-size: 14px; color: var(--white); font-weight: 500; }
  .history-mid { display: flex; gap: 4px; align-items: center; font-size: 14px; min-width: 80px; }
  .history-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .legacy-tag {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    background: rgba(232,193,74,0.1); color: var(--gold);
    border: 1px solid rgba(232,193,74,0.25); padding: 2px 8px; border-radius: 2px;
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
  }
</style>