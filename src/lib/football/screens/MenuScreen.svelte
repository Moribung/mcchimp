<!-- src/lib/football/screens/MenuScreen.svelte -->
<script>
  import { loadAllSaves, deleteSave, toggleSaveStar } from '$lib/saves.js';
  import { divName } from '$lib/football/utils.js';

  const {
    oncontinue    = null,
    savedInfo     = null,
    onstartsetup,
    onloadsave,
    onsavedeleted = null,
    userId        = null,
    userTier      = 'regular',
  } = $props();

  const saveLimit = $derived((userTier === 'max' || userTier === 'admin') ? 100 : (userTier === 'pro' || userTier === 'dev') ? 20 : 5);

  // ── Saved careers modal ───────────────────────────────
  let showSaved    = $state(false);
  let dbSaves      = $state([]);
  let loadingSaves = $state(false);
  let savesError   = $state('');
  let deleting     = $state(null); // id of save being deleted

  async function openSaved() {
    showSaved  = true;
    savesError = '';
    if (!userId) return;
    loadingSaves = true;
    try {
      dbSaves = await loadAllSaves(userId, 'football');
    } catch (e) {
      savesError = 'Could not load saved careers.';
    } finally {
      loadingSaves = false;
    }
  }

  function closeSaved() { showSaved = false; }

  async function handleDelete(save) {
    if (deleting) return;
    deleting = save.id;
    try {
      await deleteSave(save.id);
      dbSaves = dbSaves.filter(s => s.id !== save.id);
      onsavedeleted?.(save.id);
    } catch (e) {
      savesError = 'Delete failed.';
    } finally {
      deleting = null;
    }
  }

  async function handleStar(save) {
    try {
      await toggleSaveStar(save.id, !save.starred);
      dbSaves = dbSaves.map(s => s.id === save.id ? { ...s, starred: !s.starred } : s);
    } catch { /* silent */ }
  }

  function handleLoad(save) {
    onloadsave?.(save.id, save.save_data);
    showSaved = false;
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function saveSubtitle(save) {
    const d = save.save_data;
    if (!d) return '';
    const parts = [];
    if (d.division) parts.push(divName(d.division));
    if (d.season)   parts.push(`Season ${d.season}`);
    const c = d.career;
    if (c) parts.push(`${c.wins ?? 0}W ${c.draws ?? 0}D ${c.losses ?? 0}L`);
    return parts.join(' · ');
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && showSaved) closeSaved();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="menu-wrap">
  <div class="start-header">
    <h1>ANSTOSS</h1>
    <p>Football Career Manager</p>
  </div>

  <!-- Continue current career -->
  <button class="menu-btn"
    class:menu-btn-active={!!savedInfo}
    disabled={!oncontinue || !savedInfo}
    onclick={oncontinue ?? (() => {})}>
    <div class="menu-btn-icon">▶</div>
    <div class="menu-btn-body">
      <div class="menu-btn-title">Continue Career</div>
      <div class="menu-btn-sub">
        {#if savedInfo}
          {savedInfo.clubName} · {divName(savedInfo.division)} · Season {savedInfo.season}
        {:else}
          No active career
        {/if}
      </div>
    </div>
    {#if savedInfo}
      <div class="menu-btn-badge">MD {savedInfo.matchday}</div>
    {/if}
  </button>

  <!-- Saved careers -->
  <button class="menu-btn" onclick={openSaved}>
    <div class="menu-btn-icon">≡</div>
    <div class="menu-btn-body">
      <div class="menu-btn-title">Saved Careers</div>
      <div class="menu-btn-sub">
        {#if !userId}
          Log in to access saved careers
        {:else}
          Your career save slots
        {/if}
      </div>
    </div>
    {#if userId}
      <div class="menu-btn-badge">{dbSaves.length > 0 ? `${dbSaves.length} / ${saveLimit}` : `0 / ${saveLimit}`}</div>
    {/if}
  </button>

  <!-- Start new career -->
  <button class="menu-btn menu-btn-new" onclick={onstartsetup}>
    <div class="menu-btn-icon">+</div>
    <div class="menu-btn-body">
      <div class="menu-btn-title">Start New Career</div>
      <div class="menu-btn-sub">Configure club, settings and question set</div>
    </div>
  </button>
</div>

<!-- Saved careers modal -->
{#if showSaved}
  <div class="overlay" role="presentation" onclick={closeSaved}>
    <div class="modal" role="presentation" onclick={e => e.stopPropagation()}>
      <div class="modal-header">
        <span class="modal-title">Saved Careers</span>
        {#if userId}
          <span class="modal-count">{dbSaves.length} / {saveLimit}</span>
        {/if}
        <button class="modal-close" onclick={closeSaved}>✕</button>
      </div>

      <div class="modal-body">
        {#if !userId}
          <div class="empty-state">
            Log in to save and load careers across devices.
            <a href="/auth/login" class="login-link">Log In →</a>
          </div>
        {:else if loadingSaves}
          <div class="empty-state">Loading…</div>
        {:else if savesError}
          <div class="empty-state error">{savesError}</div>
        {:else if dbSaves.length === 0}
          <div class="empty-state">
            No saved careers yet.<br>
            <span style="font-size:11px;color:var(--muted)">Use "Save & Exit" in-game to save a career here.</span>
          </div>
        {:else}
          <div class="saves-list">
            {#each dbSaves as save (save.id)}
              <div class="save-row" class:save-row-starred={save.starred}>
                <button class="star-btn" class:starred={save.starred}
                  onclick={() => handleStar(save)} title={save.starred ? 'Unstar' : 'Star'}>
                  {save.starred ? '★' : '☆'}
                </button>
                <div class="save-info" role="button" tabindex="0"
                  onclick={() => handleLoad(save)}
                  onkeydown={e => (e.key === 'Enter' || e.key === ' ') && handleLoad(save)}>
                  <div class="save-name">{save.fighter_name || 'Unnamed Club'}</div>
                  <div class="save-meta">{saveSubtitle(save)} · {fmtDate(save.updated_at)}</div>
                </div>
                <button class="save-load-btn" onclick={() => handleLoad(save)}>Load</button>
                <button class="save-del-btn"
                  disabled={deleting === save.id}
                  onclick={() => handleDelete(save)}
                  title="Delete">✕</button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      {#if dbSaves.length >= saveLimit && userId}
        <div class="modal-footer-note">
          Save limit reached. Star careers to protect them from auto-deletion.
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .menu-wrap { max-width: 480px; margin: 0 auto; padding: 56px 0 48px; display: flex; flex-direction: column; gap: 10px; }

  .start-header { text-align: center; margin-bottom: 40px; }
  .start-header h1 { font-family: var(--font-display); font-size: 96px; line-height: 0.9; color: var(--gold); letter-spacing: .02em; }
  .start-header p  { color: var(--muted); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; margin-top: 8px; }

  /* ── Menu buttons ──────────────────────────────────── */
  .menu-btn {
    width: 100%; background: var(--surface); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 4px; padding: 18px 20px; cursor: pointer;
    display: flex; align-items: center; gap: 16px;
    font-family: var(--font-body); text-align: left; color: var(--text);
    transition: border-color .15s, background .15s;
  }
  .menu-btn:hover:not(:disabled) { border-color: rgba(255,255,255,0.25); background: var(--surface2); }
  .menu-btn:disabled { opacity: .38; cursor: not-allowed; }
  .menu-btn.menu-btn-active { border-color: rgba(255,255,255,0.2); }
  .menu-btn.menu-btn-active:hover { border-color: var(--gold); }
  .menu-btn.menu-btn-new { border-color: rgba(212,168,71,.3); }
  .menu-btn.menu-btn-new:hover { border-color: var(--gold); background: color-mix(in srgb,var(--gold) 6%,var(--surface)); }

  .menu-btn-icon {
    font-family: var(--font-display); font-size: 22px; color: var(--gold);
    width: 32px; text-align: center; flex-shrink: 0; line-height: 1;
  }
  .menu-btn-body { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .menu-btn-title { font-family: var(--font-display); font-size: 18px; letter-spacing: .04em; color: var(--text); }
  .menu-btn-sub   { font-size: 12px; color: var(--muted); }
  .menu-btn-badge { font-family: var(--font-display); font-size: 14px; color: var(--gold); flex-shrink: 0; }

  /* ── Modal ─────────────────────────────────────────── */
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.8); display: flex; align-items: center; justify-content: center; z-index: 9999; }
  .modal   {
    background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
    width: 90%; max-width: 520px; max-height: 80vh;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .modal-header {
    display: flex; align-items: center; gap: 10px; padding: 16px 20px;
    border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .modal-title  { font-family: var(--font-display); font-size: 18px; letter-spacing: .04em; flex: 1; }
  .modal-count  { font-size: 12px; color: var(--muted); }
  .modal-close  { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 18px; padding: 4px 8px; }
  .modal-close:hover { color: var(--text); }
  .modal-body   { flex: 1; overflow-y: auto; padding: 12px 16px; }
  .modal-footer-note {
    padding: 10px 20px; border-top: 1px solid var(--border);
    font-size: 11px; color: var(--amber); text-align: center; flex-shrink: 0;
  }

  .empty-state {
    padding: 40px 20px; text-align: center; color: var(--muted);
    font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .empty-state.error { color: var(--red); }
  .login-link { color: var(--gold); text-decoration: none; font-size: 13px; }
  .login-link:hover { text-decoration: underline; }

  .saves-list { display: flex; flex-direction: column; gap: 6px; }

  .save-row {
    display: flex; align-items: center; gap: 10px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 4px; padding: 12px 14px;
    transition: border-color .15s;
  }
  .save-row:hover { border-color: rgba(255,255,255,0.2); }
  .save-row.save-row-starred { border-left: 3px solid var(--gold); }

  .star-btn {
    background: none; border: none; cursor: pointer; font-size: 16px;
    color: var(--muted); padding: 0 2px; flex-shrink: 0; line-height: 1;
    transition: color .15s;
  }
  .star-btn:hover  { color: var(--gold); }
  .star-btn.starred { color: var(--gold); }

  .save-info { flex: 1; cursor: pointer; min-width: 0; }
  .save-info:hover .save-name { color: var(--gold); }
  .save-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color .15s; }
  .save-meta { font-size: 11px; color: var(--muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .save-load-btn {
    background: var(--surface); border: 1px solid var(--border); border-radius: 3px;
    color: var(--text); font-family: var(--font-body); font-size: 11px; font-weight: 600;
    letter-spacing: .08em; text-transform: uppercase; padding: 5px 12px; cursor: pointer;
    flex-shrink: 0; transition: border-color .15s, color .15s;
  }
  .save-load-btn:hover { border-color: var(--gold); color: var(--gold); }

  .save-del-btn {
    background: none; border: none; color: var(--muted); cursor: pointer;
    font-size: 14px; padding: 4px 6px; flex-shrink: 0; transition: color .15s;
  }
  .save-del-btn:hover:not(:disabled) { color: var(--red); }
  .save-del-btn:disabled { opacity: .4; cursor: not-allowed; }

  @media (max-width: 640px) {
    .start-header h1 { font-size: 72px; }
  }
</style>
