<!-- src/lib/golf/screens/MenuScreen.svelte -->
<script>
  import { loadAllSaves, deleteSave, toggleSaveStar } from '$lib/saves.js';
  import { toParStr } from '$lib/golf/constants.js';
  import { handicapLabel } from '$lib/golf/handicap.js';

  const {
    oncontinue    = null,
    savedInfo     = null,
    onstartcareer,
    onquickround,
    onpastrounds  = null,
    onloadsave,
    onsavedeleted = null,
    pastCount     = 0,
    userId        = null,
    userTier      = 'regular',
  } = $props();

  const continueIsCareer = $derived(savedInfo?.mode === 'career');

  const saveLimit = $derived(userTier === 'pro' || userTier === 'dev' ? 20 : 5);

  // ── Saved rounds modal ────────────────────────────────
  let showSaved    = $state(false);
  let dbSaves      = $state([]);
  let loadingSaves = $state(false);
  let savesError   = $state('');
  let deleting     = $state(null);

  // Eagerly load the saved-games count once the user is known, so the menu badge
  // shows the real count without first opening the modal.
  let _countLoaded = false;
  $effect(() => {
    if (userId && !_countLoaded) {
      _countLoaded = true;
      loadAllSaves(userId, 'golf').then(d => { dbSaves = d; }).catch(() => {});
    }
  });

  async function openSaved() {
    showSaved  = true;
    savesError = '';
    if (!userId) return;
    loadingSaves = true;
    try {
      dbSaves = await loadAllSaves(userId, 'golf');
    } catch (e) {
      savesError = 'Could not load saved rounds.';
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
    if (d.mode === 'career' && d.career) {
      parts.push(`Hcp ${handicapLabel(d.career.handicap)}`);
      parts.push(`${d.career.roundsPlayed ?? 0} rounds`);
      if (d.round) parts.push(`mid-round · Hole ${d.currentHole?.displayNum ?? d.round.holeIdx + 1}`);
      return parts.join(' · ');
    }
    if (d.course?.holeCount) parts.push(`${d.course.holeCount} holes`);
    if (d.currentHole?.holeNum) parts.push(`Hole ${d.currentHole.holeNum}`);
    if (d.round) parts.push(toParStr(d.round.toPar ?? 0));
    return parts.join(' · ');
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && showSaved) closeSaved();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="menu-wrap">
  <div class="start-header">
    <h1>FAIRWAY</h1>
    <p>Quiz Golf — every shot is a question</p>
  </div>

  <!-- Continue current game -->
  <button class="menu-btn"
    class:menu-btn-active={!!savedInfo}
    disabled={!oncontinue || !savedInfo}
    onclick={oncontinue ?? (() => {})}>
    <div class="menu-btn-icon">▶</div>
    <div class="menu-btn-body">
      <div class="menu-btn-title">{continueIsCareer ? 'Continue Career' : 'Continue Round'}</div>
      <div class="menu-btn-sub">
        {#if savedInfo && continueIsCareer}
          {savedInfo.careerName} · Hcp {handicapLabel(savedInfo.handicap)}{savedInfo.idle ? '' : ' · mid-round'}
        {:else if savedInfo}
          {savedInfo.courseName} · {savedInfo.holeCount} holes · {toParStr(savedInfo.toPar)}
        {:else}
          No game in progress
        {/if}
      </div>
    </div>
    {#if savedInfo}
      <div class="menu-btn-badge">{continueIsCareer ? (savedInfo.idle ? 'CAREER' : `H${savedInfo.holeNum}`) : `H${savedInfo.holeNum}`}</div>
    {/if}
  </button>

  <!-- New career -->
  <button class="menu-btn menu-btn-new" onclick={onstartcareer}>
    <div class="menu-btn-icon">★</div>
    <div class="menu-btn-body">
      <div class="menu-btn-title">New Career</div>
      <div class="menu-btn-sub">Create a golfer and track your handicap</div>
    </div>
  </button>

  <!-- Quick round -->
  <button class="menu-btn" onclick={onquickround}>
    <div class="menu-btn-icon">+</div>
    <div class="menu-btn-body">
      <div class="menu-btn-title">Quick Round</div>
      <div class="menu-btn-sub">One-off round — pick holes and a question set</div>
    </div>
  </button>

  <!-- Saved games -->
  <button class="menu-btn" onclick={openSaved}>
    <div class="menu-btn-icon">≡</div>
    <div class="menu-btn-body">
      <div class="menu-btn-title">Saved Games</div>
      <div class="menu-btn-sub">
        {#if !userId}
          Log in to access saved games
        {:else}
          Careers and saved rounds
        {/if}
      </div>
    </div>
    {#if userId}
      <div class="menu-btn-badge">{dbSaves.length > 0 ? `${dbSaves.length} / ${saveLimit}` : `0 / ${saveLimit}`}</div>
    {/if}
  </button>

  <!-- Past games -->
  <button class="menu-btn" onclick={() => onpastrounds?.()}>
    <div class="menu-btn-icon">🏆</div>
    <div class="menu-btn-body">
      <div class="menu-btn-title">Past Games</div>
      <div class="menu-btn-sub">
        {#if !userId}Log in to record completed rounds{:else}Your finished scorecards{/if}
      </div>
    </div>
    {#if userId && pastCount > 0}<div class="menu-btn-badge">{pastCount}</div>{/if}
  </button>
</div>

<!-- Saved rounds modal -->
{#if showSaved}
  <div class="overlay" role="presentation" onclick={closeSaved}>
    <div class="modal" role="presentation" onclick={e => e.stopPropagation()}>
      <div class="modal-header">
        <span class="modal-title">Saved Games</span>
        {#if userId}
          <span class="modal-count">{dbSaves.length} / {saveLimit}</span>
        {/if}
        <button class="modal-close" onclick={closeSaved}>✕</button>
      </div>

      <div class="modal-body">
        {#if !userId}
          <div class="empty-state">
            Log in to save and load rounds across devices.
            <a href="/auth/login" class="login-link">Log In →</a>
          </div>
        {:else if loadingSaves}
          <div class="empty-state">Loading…</div>
        {:else if savesError}
          <div class="empty-state error">{savesError}</div>
        {:else if dbSaves.length === 0}
          <div class="empty-state">
            No saved games yet.<br>
            <span style="font-size:11px;color:var(--muted)">Start a career or use "Save & Quit" in-game to save here.</span>
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
                  <div class="save-name">
                    <span class="type-tag" class:tag-career={save.save_data?.mode === 'career'}>{save.save_data?.mode === 'career' ? 'Career' : 'Round'}</span>
                    {save.fighter_name || 'Unnamed'}
                  </div>
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
          Save limit reached. Star rounds to protect them from auto-deletion.
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .menu-wrap { max-width: 480px; margin: 0 auto; padding: 56px 0 48px; display: flex; flex-direction: column; gap: 10px; }

  .start-header { text-align: center; margin-bottom: 40px; }
  .start-header h1 { font-family: var(--font-display); font-size: 96px; line-height: 0.9; color: var(--accent); letter-spacing: .02em; }
  .start-header p  { color: var(--muted); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; margin-top: 8px; }

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
  .menu-btn.menu-btn-active:hover { border-color: var(--accent); }
  .menu-btn.menu-btn-new { border-color: rgba(212,168,71,.3); }
  .menu-btn.menu-btn-new:hover { border-color: var(--accent); background: color-mix(in srgb,var(--accent) 6%,var(--surface)); }

  .menu-btn-icon {
    font-family: var(--font-display); font-size: 22px; color: var(--accent);
    width: 32px; text-align: center; flex-shrink: 0; line-height: 1;
  }
  .menu-btn-body { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .menu-btn-title { font-family: var(--font-display); font-size: 18px; letter-spacing: .04em; color: var(--text); }
  .menu-btn-sub   { font-size: 12px; color: var(--muted); }
  .menu-btn-badge { font-family: var(--font-display); font-size: 14px; color: var(--accent); flex-shrink: 0; }

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
  .login-link { color: var(--accent); text-decoration: none; font-size: 13px; }
  .login-link:hover { text-decoration: underline; }

  .saves-list { display: flex; flex-direction: column; gap: 6px; }

  .save-row {
    display: flex; align-items: center; gap: 10px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 4px; padding: 12px 14px;
    transition: border-color .15s;
  }
  .save-row:hover { border-color: rgba(255,255,255,0.2); }
  .save-row.save-row-starred { border-left: 3px solid var(--accent); }

  .star-btn {
    background: none; border: none; cursor: pointer; font-size: 16px;
    color: var(--muted); padding: 0 2px; flex-shrink: 0; line-height: 1;
    transition: color .15s;
  }
  .star-btn:hover  { color: var(--accent); }
  .star-btn.starred { color: var(--accent); }

  .save-info { flex: 1; cursor: pointer; min-width: 0; }
  .save-info:hover .save-name { color: var(--accent); }
  .save-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color .15s; display: flex; align-items: center; gap: 7px; }
  .type-tag { font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; background: rgba(255,255,255,.08); color: var(--muted); flex-shrink: 0; }
  .type-tag.tag-career { background: rgba(212,168,71,.18); color: var(--accent); }
  .save-meta { font-size: 11px; color: var(--muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .save-load-btn {
    background: var(--surface); border: 1px solid var(--border); border-radius: 3px;
    color: var(--text); font-family: var(--font-body); font-size: 11px; font-weight: 600;
    letter-spacing: .08em; text-transform: uppercase; padding: 5px 12px; cursor: pointer;
    flex-shrink: 0; transition: border-color .15s, color .15s;
  }
  .save-load-btn:hover { border-color: var(--accent); color: var(--accent); }

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
