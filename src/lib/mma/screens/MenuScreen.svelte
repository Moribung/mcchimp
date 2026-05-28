<!-- src/lib/mma/screens/MenuScreen.svelte -->
<script>
  import { get }      from 'svelte/store';
  import { session }  from '$lib/stores/session.js';
  import { supabase } from '$lib/supabase.js';
  import { state as gs } from '$lib/mma/state.svelte.js';
  import { DIFF_LABELS, DIFF_COLORS, DIFF_BG, TIER_ORDER } from '$lib/mma/constants.js';
  import { gf } from '$lib/mma/fighters.js';
  import { ensureQPool, assignDivisionQuestions } from '$lib/mma/questions.js';

  const { onstartcareer, onstartsparring } = $props();

  // ── Local UI state ────────────────────────────────────
  let mode       = $state('career');
  let difficulty = $state('medium');
  let length     = $state(0);
  let selectedId = $state(null);

  // Module switcher (mid-career)
  let switcherSelectedId = $state(null);

  const inCareer   = $derived(gs.career !== null && gs.screen !== 'end');
  const isSwitcher = $derived(inCareer && gs.screen === 'menu');

  const LENGTHS = [
    { value: 0,  label: '∞',  sub: 'Retirement' },
    { value: 10, label: '10', sub: 'Short run'  },
    { value: 25, label: '25', sub: 'Full camp'  },
    { value: 50, label: '50', sub: 'Legacy run' },
  ];

  // ── Module helpers ────────────────────────────────────
  function countTiers(mod) {
    return TIER_ORDER.filter(t => (mod.tiers?.[t] || []).length > 0);
  }
  function totalQuestions(mod) {
    return TIER_ORDER.reduce((n, t) => n + (mod.tiers?.[t] || []).length, 0);
  }

  // ── Library picker ────────────────────────────────────
  let libraryOpen    = $state(false);
  let libraryLoading = $state(false);
  let libraryError   = $state('');
  let libraryItems   = $state([]);
  let libraryPicked  = $state(null);  // { id, name, data }

  async function openLibrary() {
    const sess = get(session);
    if (!sess) { libraryError = 'Log in to access your library.'; libraryOpen = true; return; }
    libraryOpen    = true;
    libraryLoading = true;
    libraryError   = '';
    libraryItems   = [];
    try {
      const { data, error } = await supabase
        .from('user_question_sets')
        .select('id, name, description, question_count, data')
        .eq('user_id', sess.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      libraryItems = data || [];
    } catch (e) {
      libraryError = '⚠ Could not load library: ' + e.message;
    } finally {
      libraryLoading = false;
    }
  }

  function pickLibraryItem(item) {
    libraryPicked = item;
  }

  function confirmLibraryPick() {
    if (!libraryPicked) return;
    const id  = 'lib_' + libraryPicked.id;
    const mod = { id, filename: null, tag: 'library', name: libraryPicked.name,
      description: libraryPicked.description ?? '', ...libraryPicked.data };
    // Add to available modules if not already there
    if (!gs.loadedModules[id]) {
      gs.availableModules = [...gs.availableModules, mod];
      gs.loadedModules[id] = mod;
    }
    selectedId    = id;
    libraryOpen   = false;
    libraryPicked = null;
  }

  function closeLibrary() {
    libraryOpen   = false;
    libraryPicked = null;
    libraryError  = '';
  }

  // ── Start ─────────────────────────────────────────────
  function onStart() {
    if (!selectedId) return;
    if (mode === 'sparring') {
      onstartsparring?.({ modId: selectedId });
    } else {
      onstartcareer?.({ modId: selectedId, length, difficulty });
    }
  }

  // ── Switcher actions ──────────────────────────────────
  function onSwitchConfirm() {
    if (!switcherSelectedId || switcherSelectedId === gs.activeModId) return;
    gs.activeModId = switcherSelectedId;
    gs._qPool = null; gs._qUsed = null; gs._qById = null; gs.lastQid = null;
    if (gs.career?.divisions) {
      ensureQPool(gs);
      for (const [ph, div] of Object.entries(gs.career.divisions)) {
        div.slots.forEach(fid => {
          if (!fid || fid === 'player') return;
          const f = gf(fid);
          if (f) f.questionId = null;
        });
        assignDivisionQuestions(gs, div, parseInt(ph));
      }
    }
    gs.screen = gs.sparring ? 'prefight'
      : (gs.wins + gs.draws + gs.losses + gs.finishes) > 0 ? 'result' : 'prefight';
  }

  function onResume() {
    gs.screen = gs.sparring ? 'prefight'
      : (gs.wins + gs.draws + gs.losses + gs.finishes) > 0 ? 'result' : 'prefight';
  }

  function onReset() {
    if (!confirm('Your career progress will be lost. Return to the main menu?')) return;
    gs.career  = null;
    gs.screen  = 'menu';
    selectedId = null;
  }

  // ── Keyboard: Escape closes library ──────────────────
  function onKeydown(e) {
    if (e.key === 'Escape' && libraryOpen) closeLibrary();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- ══ MODULE SWITCHER ═══════════════════════════════════ -->
{#if isSwitcher}
  <div class="msw-wrap">
    <div class="msw-headline">Switch Module</div>
    <p class="msw-sub">
      Current: {gs.loadedModules[gs.activeModId]?.name ?? '—'}.
      Your career continues unchanged.
    </p>
    <div class="msw-list">
      {#each gs.availableModules as mod (mod.id)}
        <button class="msw-card" class:selected={switcherSelectedId === mod.id}
          onclick={() => switcherSelectedId = mod.id}>
          <div class="msw-card-name">{mod.name}</div>
          <div class="msw-card-desc">{mod.description ?? ''} · {totalQuestions(mod)} questions</div>
        </button>
      {/each}
    </div>
    <div class="msw-divider"></div>
    <div class="msw-actions">
      <button class="btn btn-primary"
        disabled={!switcherSelectedId || switcherSelectedId === gs.activeModId}
        onclick={onSwitchConfirm}>Switch &amp; Resume</button>
      <button class="btn btn-ghost" onclick={onResume}>Resume Without Switching</button>
      <button class="btn btn-ghost btn-danger" onclick={onReset}>Reset &amp; Return to Main Menu</button>
    </div>
  </div>

<!-- ══ MAIN MENU ═════════════════════════════════════════ -->
{:else}
  <div class="menu-wrap">
    <h1 class="module-headline">Choose Your<br>Question Module</h1>
    <p class="module-sub">Select a topic. Your career rides on it.</p>

    <!-- Built-in modules -->
    <div class="module-list">
      {#each gs.availableModules as mod (mod.id)}
        {@const tiers = countTiers(mod)}
        <button class="module-card" class:selected={selectedId === mod.id}
          onclick={() => selectedId = mod.id}>
          <div class="module-card-left">
            <div class="module-card-name">{mod.name}</div>
            <div class="module-card-desc">{mod.description ?? ''}</div>
            <div class="tier-badges">
              {#each tiers as t}
                <span class="tier-badge"
                  style="background:{DIFF_BG[t]};color:{DIFF_COLORS[t]}"
                >{DIFF_LABELS[t]} ×{mod.tiers[t].length}</span>
              {/each}
            </div>
          </div>
          <div class="module-card-meta">
            <span class="module-tag" class:tag-builtin={mod.tag !== 'library' && mod.tag !== 'uploaded'}
              class:tag-library={mod.tag === 'library'}
              class:tag-uploaded={mod.tag === 'uploaded'}>
              {mod.tag === 'library' ? 'Library' : mod.tag === 'uploaded' ? 'Uploaded' : 'Built-in'}
            </span>
            <span class="module-q-count">{totalQuestions(mod)} questions</span>
          </div>
        </button>
      {/each}

      {#if gs.availableModules.length === 0}
        <p class="loading-hint">Loading modules…</p>
      {/if}
    </div>

    <!-- Library picker button -->
    <button class="library-btn" onclick={openLibrary}>
      <span class="library-btn-icon">📚</span>
      <span class="library-btn-text">
        <strong>Use a set from My Library</strong>
        <span>Browse your saved question sets</span>
      </span>
      <span class="library-btn-arrow">→</span>
    </button>

    <!-- Mode selector -->
    <div class="mode-row">
      <button class="mode-btn" class:active={mode === 'career'} onclick={() => mode = 'career'}>
        <div class="mode-btn-title">Career</div>
        <div class="mode-btn-desc">Configurable length · difficulty ramps · record tracked</div>
      </button>
      <button class="mode-btn sparring-btn" class:active={mode === 'sparring'} onclick={() => mode = 'sparring'}>
        <div class="mode-btn-title">Sparring</div>
        <div class="mode-btn-desc">Unlimited · all tiers · score meter visible · no record</div>
      </button>
    </div>

    <!-- Difficulty + length (career only) -->
    {#if mode === 'career'}
      <div class="config-section">
        <div class="config-label">Difficulty</div>
        <div class="diff-row">
          {#each [['easy','Easy','60 seconds'],['medium','Medium','45 seconds'],['hard','Hard','30 seconds']] as [d, label, sub]}
            <button class="diff-btn"
              class:active-easy={d === 'easy' && difficulty === 'easy'}
              class:active-medium={d === 'medium' && difficulty === 'medium'}
              class:active-hard={d === 'hard' && difficulty === 'hard'}
              onclick={() => difficulty = d}>
              <span class="diff-btn-label">{label}</span>
              <span class="diff-btn-sub">{sub}</span>
            </button>
          {/each}
        </div>

        <div class="config-label">Career length</div>
        <div class="length-row">
          {#each LENGTHS as opt}
            <button class="length-btn" class:active={length === opt.value}
              onclick={() => length = opt.value}>
              <span class="length-btn-fights">{opt.label}</span>
              <span class="length-btn-sub">{opt.sub}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="btn-row">
      <button class="btn btn-primary" disabled={!selectedId} onclick={onStart}>
        {mode === 'sparring' ? 'Start Sparring' : 'Start Career'}
      </button>
    </div>
  </div>
{/if}

<!-- ══ LIBRARY MODAL ════════════════════════════════════ -->
{#if libraryOpen}
  <div class="lib-overlay" role="dialog" aria-modal="true"
    onclick={closeLibrary} onkeydown={(e) => e.stopPropagation()}>
    <div class="lib-modal" onclick={(e) => e.stopPropagation()}
      role="document" onkeydown={(e) => e.stopPropagation()}>

      <div class="lib-header">
        <div class="lib-title">My Library</div>
        <button class="lib-close" onclick={closeLibrary}>✕</button>
      </div>

      {#if libraryLoading}
        <div class="lib-loading">Loading your question sets…</div>

      {:else if libraryError}
        <div class="lib-error">{libraryError}</div>
        {#if !get(session)}
          <a href="/auth/login" class="btn btn-primary" style="margin-top:14px;display:inline-block">Log In</a>
        {/if}

      {:else if libraryItems.length === 0}
        <div class="lib-empty">
          <p>No question sets in your library yet.</p>
          <a href="/questions/library" target="_blank" class="lib-link">Go to My Library →</a>
        </div>

      {:else}
        <div class="lib-list">
          {#each libraryItems as item}
            <button class="lib-item" class:selected={libraryPicked?.id === item.id}
              onclick={() => pickLibraryItem(item)}>
              <div class="lib-item-name">{item.name}</div>
              <div class="lib-item-meta">
                {item.description ?? ''}
                {#if item.question_count}
                  · {item.question_count} questions
                {/if}
              </div>
            </button>
          {/each}
        </div>

        <div class="lib-footer">
          <button class="btn btn-primary" disabled={!libraryPicked} onclick={confirmLibraryPick}>
            Use This Set
          </button>
          <button class="btn btn-ghost" onclick={closeLibrary}>Cancel</button>
        </div>
      {/if}

    </div>
  </div>
{/if}

<style>
  /* ── Page layout ─────────────────────────────────────── */
  .menu-wrap {
    max-width: 560px;
    margin: 0 auto;
    padding: 32px 0 48px;
  }

  .module-headline {
    font-family: var(--font-display);
    font-size: 42px;
    letter-spacing: 0.02em;
    line-height: 1.05;
    margin-bottom: 6px;
  }
  .module-sub {
    color: var(--text-muted);
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 28px;
  }

  /* ── Module list ─────────────────────────────────────── */
  .module-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }

  .module-card {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px 18px; cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    text-align: left; width: 100%; color: var(--text); font-family: var(--font-body);
  }
  .module-card:hover    { border-color: var(--border-hover); }
  .module-card.selected { border-color: var(--accent); background: var(--accent-dim); }
  .module-card-left  { flex: 1; }
  .module-card-name  { font-family: var(--font-display); font-size: 18px; letter-spacing: 0.04em; margin-bottom: 3px; }
  .module-card-desc  { font-size: 12px; color: var(--text-muted); line-height: 1.4; }
  .module-card-meta  { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .module-tag        { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; font-weight: 600; }
  .tag-builtin  { background: rgba(74,158,232,0.15); color: var(--blue); }
  .tag-library  { background: rgba(74,232,122,0.15); color: var(--green); }
  .tag-uploaded { background: rgba(180,74,232,0.15); color: #b44ae8; }
  .module-q-count    { font-size: 11px; color: var(--text-muted); letter-spacing: 0.06em; }
  .tier-badges  { display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; }
  .tier-badge   { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 6px; border-radius: 2px; font-weight: 600; }
  .loading-hint { color: var(--text-muted); font-size: 13px; }

  /* ── Library button ──────────────────────────────────── */
  .library-btn {
    width: 100%; background: var(--surface2); border: 1px dashed var(--border-hover);
    border-radius: var(--radius); padding: 14px 18px; cursor: pointer; margin-bottom: 28px;
    display: flex; align-items: center; gap: 14px; font-family: var(--font-body);
    text-align: left; color: var(--text); transition: border-color 0.15s, background 0.15s;
  }
  .library-btn:hover { border-color: var(--accent-border); background: var(--accent-dim); }
  .library-btn-icon { font-size: 20px; flex-shrink: 0; }
  .library-btn-text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .library-btn-text strong { font-size: 13px; font-weight: 600; color: var(--accent); }
  .library-btn-text span   { font-size: 11px; color: var(--text-muted); }
  .library-btn-arrow { color: var(--text-muted); font-size: 14px; }

  /* ── Mode toggle ─────────────────────────────────────── */
  .mode-row { display: flex; gap: 10px; margin-bottom: 28px; }
  .mode-btn {
    flex: 1; background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px 16px; cursor: pointer;
    font-family: var(--font-body); font-size: 13px; font-weight: 500;
    color: var(--text-muted); text-align: left; transition: border-color 0.15s, background 0.15s;
  }
  .mode-btn:hover  { border-color: var(--border-hover); color: var(--text); }
  .mode-btn.active { border-color: var(--accent); background: var(--accent-dim); color: var(--text); }
  .mode-btn.sparring-btn.active { border-color: #b44ae8; background: rgba(180,74,232,0.12); }
  .mode-btn-title { font-family: var(--font-display); font-size: 17px; letter-spacing: 0.04em; margin-bottom: 3px; color: var(--text); }
  .mode-btn-desc  { font-size: 11px; color: var(--text-muted); line-height: 1.4; }
  .mode-btn.active .mode-btn-title { color: var(--accent); }
  .mode-btn.sparring-btn.active .mode-btn-title { color: #b44ae8; }

  /* ── Config section ──────────────────────────────────── */
  .config-section { margin-bottom: 28px; }
  .config-label { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px; }
  .diff-row  { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
  .length-row { display: flex; gap: 8px; flex-wrap: wrap; }

  .diff-btn {
    background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 10px 14px; cursor: pointer; font-family: var(--font-body); font-size: 13px;
    font-weight: 500; color: var(--text-muted); transition: border-color 0.15s, background 0.15s, color 0.15s;
    flex: 1; min-width: 80px; text-align: center;
  }
  .diff-btn:hover        { border-color: var(--border-hover); color: var(--text); }
  .diff-btn.active-easy   { border-color: var(--green);  background: rgba(74,232,122,0.10); color: var(--green);  font-weight: 600; }
  .diff-btn.active-medium { border-color: var(--accent); background: var(--accent-dim);     color: var(--accent); font-weight: 600; }
  .diff-btn.active-hard   { border-color: var(--red);    background: rgba(232,74,74,0.10);  color: var(--red);    font-weight: 600; }
  .diff-btn-label { font-family: var(--font-display); font-size: 18px; letter-spacing: 0.04em; display: block; margin-bottom: 2px; }
  .diff-btn-sub   { font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); }

  .length-btn {
    background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 10px 14px; cursor: pointer; font-family: var(--font-body); font-size: 13px;
    font-weight: 500; color: var(--text-muted); flex: 1; min-width: 70px; text-align: center;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .length-btn:hover  { border-color: var(--border-hover); color: var(--text); }
  .length-btn.active { border-color: var(--accent); background: var(--accent-dim); color: var(--accent); font-weight: 600; }
  .length-btn-fights { font-family: var(--font-display); font-size: 20px; letter-spacing: 0.04em; display: block; margin-bottom: 2px; color: var(--text); }
  .length-btn.active .length-btn-fights { color: var(--accent); }
  .length-btn-sub { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.07em; }

  .btn-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 28px; }

  /* ── Module switcher ─────────────────────────────────── */
  .msw-wrap    { max-width: 520px; }
  .msw-headline { font-family: var(--font-display); font-size: 32px; letter-spacing: 0.04em; margin-bottom: 6px; }
  .msw-sub     { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }
  .msw-list    { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
  .msw-card {
    background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px 16px; cursor: pointer; transition: border-color 0.15s;
    text-align: left; width: 100%; color: var(--text); font-family: var(--font-body);
  }
  .msw-card:hover    { border-color: var(--border-hover); }
  .msw-card.selected { border-color: var(--accent); background: var(--accent-dim); }
  .msw-card-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
  .msw-card-desc { font-size: 11px; color: var(--text-muted); }
  .msw-divider   { height: 1px; background: var(--border); margin: 16px 0; }
  .msw-actions   { display: flex; flex-direction: column; gap: 10px; }
  .btn-danger    { border-color: rgba(232,74,74,0.35) !important; color: var(--red) !important; }

  /* ── Library modal ───────────────────────────────────── */
  .lib-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.80);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999;
  }
  .lib-modal {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); width: 90%; max-width: 480px;
    max-height: 80vh; display: flex; flex-direction: column;
    overflow: hidden;
  }
  .lib-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .lib-title  { font-family: var(--font-display); font-size: 26px; letter-spacing: 0.04em; color: var(--accent); }
  .lib-close  {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 18px; line-height: 1; transition: color 0.15s; padding: 4px;
  }
  .lib-close:hover { color: var(--text); }
  .lib-loading { padding: 32px 20px; text-align: center; color: var(--text-muted); font-size: 13px; }
  .lib-error   { padding: 20px; color: var(--red); font-size: 13px; }
  .lib-empty   { padding: 32px 20px; text-align: center; color: var(--text-muted); font-size: 13px; }
  .lib-link    { display: inline-block; margin-top: 12px; color: var(--accent); font-size: 13px; text-decoration: none; }
  .lib-link:hover { text-decoration: underline; }

  .lib-list {
    flex: 1; overflow-y: auto; padding: 12px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .lib-list::-webkit-scrollbar { width: 4px; }
  .lib-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  .lib-item {
    background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px 16px; cursor: pointer; text-align: left; width: 100%;
    color: var(--text); font-family: var(--font-body); transition: border-color 0.15s, background 0.15s;
  }
  .lib-item:hover    { border-color: var(--border-hover); }
  .lib-item.selected { border-color: var(--accent); background: var(--accent-dim); }
  .lib-item-name { font-weight: 600; font-size: 14px; margin-bottom: 3px; }
  .lib-item-meta { font-size: 11px; color: var(--text-muted); }

  .lib-footer {
    display: flex; gap: 10px; padding: 14px 20px;
    border-top: 1px solid var(--border); flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .menu-wrap  { padding: 20px 0 32px; }
    .diff-row, .length-row { gap: 6px; }
    .diff-btn, .length-btn { padding: 8px 10px; min-width: 0; }
  }
</style>
