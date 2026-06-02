<!-- src/lib/mma/screens/MenuScreen.svelte -->
<script>
  import { get }      from 'svelte/store';
  import { session }  from '$lib/stores/session.js';
  import { supabase } from '$lib/supabase.js';
  import { state as gs } from '$lib/mma/state.svelte.js';
  import { DIFF_LABELS, DIFF_COLORS, DIFF_BG, TIER_ORDER } from '$lib/mma/constants.js';
  import { gf } from '$lib/mma/fighters.js';
  import { ensureQPool, assignDivisionQuestions } from '$lib/mma/questions.js';
  import { fetchPublicCatalog, fetchSet } from '$lib/questions.js';
  import { loadSrStates, loadSrStatesForSets, difficultyToQScore, loadGroups } from '$lib/progress.js';

  const {
    onstartcareer, onstartsparring,
    onsavedcareers, onpastcareers,
    saveCount = 0, historyCount = 0,
    userLimits = { maxActiveSaves: 10, maxPastCareers: 10 },
  } = $props();

  // ── Local UI state ────────────────────────────────────
  let mode       = $state('career');
  let difficulty = $state('medium');
  let length     = $state(0);
  let selectedId = $state(null);

  // Mid-career switcher
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
  function modTagLabel(mod) {
    return mod?.tag === 'group' ? 'Group' : mod?.tag === 'library' ? 'Library' : 'Public';
  }
  function modTagClass(mod) {
    return mod?.tag === 'group' ? 'tag-group' : mod?.tag === 'library' ? 'tag-library' : 'tag-public';
  }

  // ── Selected module display ───────────────────────────
  const selectedMod = $derived(selectedId ? gs.loadedModules?.[selectedId] : null);
  // Non-default sets to surface in the switcher: the active module and any browsed pick.
  const switcherExtraMods = $derived.by(() => {
    const seen = new Set();
    const mods = [];
    for (const id of [gs.activeModId, switcherSelectedId]) {
      if (!id || seen.has(id)) continue;
      const m = gs.loadedModules?.[id];
      if (m && m.tag && !bundledSets.find(b => b.id === id)) {
        seen.add(id);
        mods.push(m);
      }
    }
    return mods;
  });

  // ── Browse modal ──────────────────────────────────────
  let browseOpen    = $state(false);
  let browseTab     = $state('public');   // 'public' | 'library'
  let browsePicked  = $state(null);

  // Bundled default sets (no tag) — auto-loaded, shown in the menu's "Default Sets" list.
  const bundledSets = $derived(gs.availableModules.filter(m => !m.tag));

  // Public catalog — extra static public sets, browseable + imported on demand (not auto-loaded).
  let catalogSets   = $state([]);
  let catalogLoaded = $state(false);

  async function loadCatalog() {
    if (catalogLoaded) return;
    catalogLoaded = true;
    try {
      const filenames = await fetchPublicCatalog();
      const sets = await Promise.all(filenames.map(async f => {
        try   { return { id: f.replace('.json', ''), filename: f, tag: 'public', ...(await fetchSet(f)) }; }
        catch { return null; }
      }));
      catalogSets = sets.filter(Boolean);
    } catch {
      catalogSets = [];
    }
  }

  // Library tab state
  let libLoading = $state(false);
  let libError   = $state('');
  let libItems   = $state([]);
  let libGroups  = $state([]);
  let building   = $state(false); // assembling a group module

  async function openBrowse(tab = 'public') {
    browseTab   = tab;
    browsePicked = null;
    browseOpen  = true;
    if (tab === 'library') await loadLibrary();
    else                   await loadCatalog();
  }

  async function loadLibrary() {
    const sess = get(session);
    if (!sess) { libError = 'Log in to access your library.'; return; }
    libLoading = true; libError = ''; libItems = [];
    try {
      const [setsRes, groupsRes] = await Promise.all([
        supabase
          .from('user_question_sets')
          .select('id, name, description, question_count, data, starred')
          .eq('user_id', sess.user.id)
          .order('created_at', { ascending: false }),
        loadGroups(sess.user.id),
      ]);
      if (setsRes.error) throw setsRes.error;
      const byStar = (a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
      libItems  = (setsRes.data || []).sort(byStar);
      libGroups = (groupsRes || []).filter(g => (g.question_set_group_members || []).length > 0).sort(byStar);
    } catch (e) {
      libError = '⚠ Could not load library: ' + e.message;
    } finally {
      libLoading = false;
    }
  }

  function pickGroup(group) { browsePicked = { source: 'group', group }; }

  // Assemble all member sets of a group into one combined module.
  // Each question is tagged with its origin set so progress is attributed correctly.
  // Handles library / public / builtin members (public + builtin = future-proofing).
  async function buildGroupModule(group) {
    const members = group.question_set_group_members || [];
    const merged  = {};
    for (const m of members) {
      let data = null;
      if (m.set_source === 'library') {
        const { data: row } = await supabase
          .from('user_question_sets').select('data').eq('id', m.set_id).maybeSingle();
        data = row?.data;
      } else if (m.set_source === 'public') {
        try { data = await fetchSet(m.set_id.endsWith('.json') ? m.set_id : m.set_id + '.json'); } catch { /* skip */ }
      } else {
        data = gs.loadedModules?.[m.set_id] || gs.loadedModules?.[m.set_id.replace('.json', '')];
        if (!data) { try { data = await fetchSet(m.set_id); } catch { /* skip */ } }
      }
      if (!data?.tiers) continue;
      for (const t of TIER_ORDER) {
        const qs = data.tiers[t] || [];
        if (!qs.length) continue;
        (merged[t] ||= []).push(
          ...qs.map(q => ({ ...q, __setId: m.set_id, __setSource: m.set_source, __setName: m.set_name }))
        );
      }
    }
    return {
      id: 'grp_' + group.id,
      tag: 'group',
      name: group.name,
      description: `${members.length} set${members.length !== 1 ? 's' : ''}`,
      tiers: merged,
      __group: { id: group.id, color: group.color, members },
    };
  }

  async function switchTab(tab) {
    browseTab    = tab;
    browsePicked = null;
    if (tab === 'library' && libItems.length === 0 && !libError) await loadLibrary();
    if (tab === 'public') await loadCatalog();
  }

  function pickPublicSet(mod) { browsePicked = { source: 'public', mod }; }

  function pickLibraryItem(item) { browsePicked = { source: 'library', item }; }

  async function confirmBrowsePick() {
    if (!browsePicked) return;
    let pickedId;
    if (browsePicked.source === 'group') {
      building = true; libError = '';
      try {
        const mod = await buildGroupModule(browsePicked.group);
        if (totalQuestions(mod) === 0) { libError = 'This group has no questions yet.'; return; }
        if (!gs.loadedModules[mod.id]) gs.availableModules = [...gs.availableModules, mod];
        gs.loadedModules[mod.id] = mod; // refresh in case membership changed
        pickedId = mod.id;
      } catch (e) {
        libError = '⚠ Could not build group: ' + e.message; return;
      } finally {
        building = false;
      }
    } else if (browsePicked.source === 'public') {
      const mod = browsePicked.mod;
      // Catalog sets aren't auto-loaded — import on first use.
      if (!gs.loadedModules[mod.id]) {
        gs.availableModules = [...gs.availableModules, mod];
        gs.loadedModules[mod.id] = mod;
      }
      pickedId = mod.id;
    } else {
      const item = browsePicked.item;
      const id   = 'lib_' + item.id;
      if (!gs.loadedModules[id]) {
        const mod = { id, filename: null, tag: 'library', name: item.name,
          description: item.description ?? '', ...item.data };
        gs.availableModules = [...gs.availableModules, mod];
        gs.loadedModules[id] = mod;
      }
      pickedId = id;
    }
    if (isSwitcher) {
      switcherSelectedId = pickedId;
    } else {
      selectedId = pickedId;
    }
    browseOpen   = false;
    browsePicked = null;
  }

  function closeBrowse() { browseOpen = false; browsePicked = null; }

  // ── Set meta + FSRS seed ──────────────────────────────
  function applySetMeta(modId) {
    const mod = gs.loadedModules?.[modId];
    if (!mod) return;
    const sess = get(session);

    // Group module: questions carry their own __setId; preload FSRS across all members.
    if (mod.tag === 'group') {
      const members = mod.__group?.members || [];
      gs.activeSetMeta = {
        setId: modId, source: 'group', name: mod.name, isGroup: true,
        members: members.map(m => ({ setId: m.set_id, source: m.set_source })),
      };
      if (sess) {
        loadSrStatesForSets(sess.user.id, members.map(m => m.set_id)).then(perSet => {
          const flat = new Map();
          for (const [, qmap] of perSet) for (const [qid, sr] of qmap) flat.set(qid, sr);
          gs._srStates = flat;
          for (const [qid, sr] of flat) gs._qScores[qid] = difficultyToQScore(sr.difficulty);
        }).catch(() => {});
      }
      return;
    }

    const source = !mod.tag ? 'builtin' : mod.tag === 'library' ? 'library' : 'public';
    const setId  = mod.tag === 'library'
      ? modId.replace(/^lib_/, '')
      : (mod.filename || modId);
    gs.activeSetMeta = { setId, source, name: mod.name };

    if (sess) {
      loadSrStates(sess.user.id, setId).then(srMap => {
        gs._srStates = srMap;
        for (const [qid, sr] of srMap.entries()) {
          gs._qScores[qid] = difficultyToQScore(sr.difficulty);
        }
      }).catch(() => {}); // non-fatal
    }
  }

  // ── Start ─────────────────────────────────────────────
  function onStart() {
    if (!selectedId) return;
    applySetMeta(selectedId);
    if (mode === 'sparring') {
      onstartsparring?.({ modId: selectedId });
    } else {
      onstartcareer?.({ modId: selectedId, length, difficulty });
    }
  }

  // ── Switcher ──────────────────────────────────────────
  function onSwitchConfirm() {
    if (!switcherSelectedId || switcherSelectedId === gs.activeModId) return;
    applySetMeta(switcherSelectedId);
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

  function onKeydown(e) {
    if (e.key === 'Escape' && browseOpen) closeBrowse();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- ══ MID-CAREER SWITCHER ════════════════════════════════ -->
{#if isSwitcher}
  <div class="msw-wrap">
    <div class="msw-headline">Switch Module</div>
    <p class="msw-sub">Current: {gs.loadedModules[gs.activeModId]?.name ?? '—'}. Career continues.</p>

    <!-- Default sets -->
    <div class="msw-section-label">Default Sets</div>
    <div class="msw-list">
      {#each bundledSets as mod (mod.id)}
        <button class="msw-card" class:selected={switcherSelectedId === mod.id}
          onclick={() => switcherSelectedId = mod.id}>
          <div class="msw-card-name">{mod.name}</div>
          <div class="msw-card-desc">{totalQuestions(mod)} questions</div>
        </button>
      {/each}

      <!-- Active / browsed non-default sets shown inline with the list -->
      {#each switcherExtraMods as mod (mod.id)}
        <button class="msw-card" class:selected={switcherSelectedId === mod.id}
          onclick={() => switcherSelectedId = mod.id}>
          <div class="msw-card-name">
            {mod.name}
            <span class="module-tag {modTagClass(mod)}">{modTagLabel(mod)}</span>
            {#if mod.id === gs.activeModId}<span class="msw-active-tag">Active</span>{/if}
          </div>
          <div class="msw-card-desc">{totalQuestions(mod)} questions</div>
        </button>
      {/each}
    </div>

    <!-- Browse more -->
    <button class="browse-btn-full" onclick={() => openBrowse('public')}>
      <span class="browse-btn-icon">🌐</span>
      <span class="browse-btn-text">
        <strong>Browse More Sets</strong>
        <span>Public &amp; library sets</span>
      </span>
      <span style="color:var(--text-muted)">→</span>
    </button>

    <div class="msw-divider"></div>
    <div class="msw-actions">
      <button class="btn btn-primary"
        disabled={!switcherSelectedId || switcherSelectedId === gs.activeModId}
        onclick={onSwitchConfirm}>Switch &amp; Resume</button>
      <button class="btn btn-ghost" onclick={onResume}>Resume Without Switching</button>
      <button class="btn btn-ghost btn-danger" onclick={onReset}>Reset Career</button>
    </div>
  </div>

<!-- ══ MAIN MENU ════════════════════════════════════════════ -->
{:else}
  <div class="menu-wrap">
    <h1 class="module-headline">Choose Your<br>Question Module</h1>
    <p class="module-sub">Select a topic. Your career rides on it.</p>

    <!-- Default sets -->
    <div class="section-label">Default Sets</div>
    <div class="module-list">
      {#each bundledSets as mod (mod.id)}
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
            <span class="module-tag tag-default">Default</span>
            <span class="module-q-count">{totalQuestions(mod)} q</span>
          </div>
        </button>
      {/each}
      {#if gs.availableModules.length === 0}
        <p class="loading-hint">Loading modules…</p>
      {/if}

      <!-- Selected non-default set shown inline with the list -->
      {#if selectedMod && selectedMod.tag !== 'default' && selectedMod.tag !== undefined && !bundledSets.find(m => m.id === selectedId)}
        {@const tiers = countTiers(selectedMod)}
        <button class="module-card selected" onclick={() => {}}>
          <div class="module-card-left">
            <div class="module-card-name">{selectedMod.name}</div>
            <div class="module-card-desc">{selectedMod.description ?? ''}</div>
            <div class="tier-badges">
              {#each tiers as t}
                <span class="tier-badge"
                  style="background:{DIFF_BG[t]};color:{DIFF_COLORS[t]}"
                >{DIFF_LABELS[t]} ×{selectedMod.tiers[t].length}</span>
              {/each}
            </div>
          </div>
          <div class="module-card-meta">
            <span class="module-tag {modTagClass(selectedMod)}">{modTagLabel(selectedMod)}</span>
            <span class="module-q-count">{totalQuestions(selectedMod)} q</span>
            <span class="selected-clear" role="button" tabindex="0"
              onclick={(e) => { e.stopPropagation(); selectedId = null; }}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); selectedId = null; } }}
              aria-label="Clear">✕</span>
          </div>
        </button>
      {/if}
    </div>

    <!-- Browse more -->
    <div class="browse-row">
      <button class="browse-btn-full" onclick={() => openBrowse('public')}>
        <span class="browse-btn-icon">🌐</span>
        <span class="browse-btn-text">
          <strong>Public Sets</strong>
          <span>Community question sets</span>
        </span>
        <span style="color:var(--text-muted)">→</span>
      </button>
      <button class="browse-btn-full" onclick={() => openBrowse('library')}>
        <span class="browse-btn-icon">📚</span>
        <span class="browse-btn-text">
          <strong>My Library</strong>
          <span>Your saved question sets</span>
        </span>
        <span style="color:var(--text-muted)">→</span>
      </button>
    </div>

    <!-- Career save panels (logged-in users only) -->
    {#if $session}
      <div class="saves-row">
        <button class="saves-card" onclick={() => onsavedcareers?.()}>
          <div class="saves-card-icon">▶</div>
          <div class="saves-card-body">
            <div class="saves-card-title">Continue a Career</div>
            <div class="saves-card-sub">Active saves</div>
          </div>
          <div class="saves-card-badge">{saveCount} / {userLimits.maxActiveSaves}</div>
        </button>
        <button class="saves-card" onclick={() => onpastcareers?.()}>
          <div class="saves-card-icon">📜</div>
          <div class="saves-card-body">
            <div class="saves-card-title">Past Careers</div>
            <div class="saves-card-sub">Completed careers</div>
          </div>
          <div class="saves-card-badge">{historyCount} career{historyCount !== 1 ? 's' : ''}</div>
        </button>
      </div>
    {:else}
      <div class="saves-guest-hint">Log in to save careers and track your history.</div>
    {/if}

    <!-- Mode toggle -->
    <div class="mode-row">
      <button class="mode-btn" class:active={mode === 'career'} onclick={() => mode = 'career'}>
        <div class="mode-btn-title">Career</div>
        <div class="mode-btn-desc">Configurable length · difficulty ramps · record tracked</div>
      </button>
      <button class="mode-btn sparring-btn" class:active={mode === 'sparring'} onclick={() => mode = 'sparring'}>
        <div class="mode-btn-title">Sparring</div>
        <div class="mode-btn-desc">Unlimited · all tiers · score meter · no record</div>
      </button>
    </div>

    <!-- Difficulty + length (career) -->
    {#if mode === 'career'}
      <div class="config-section">
        <div class="config-label">Difficulty</div>
        <div class="diff-row">
          {#each [['easy','Easy','60s'],['medium','Medium','45s'],['hard','Hard','30s']] as [d, label, sub]}
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

    <div class="btn-row" style="margin-top:28px;">
      <button class="btn btn-primary" disabled={!selectedId} onclick={onStart}>
        {mode === 'sparring' ? 'Start Sparring' : 'Start Career'}
      </button>
    </div>
  </div>
{/if}

<!-- ══ BROWSE MODAL ═════════════════════════════════════════ -->
{#if browseOpen}
  <div class="lib-overlay" role="dialog" aria-modal="true" tabindex="-1"
    onclick={closeBrowse} onkeydown={(e) => e.key === 'Escape' && closeBrowse()}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="lib-modal" onclick={(e) => e.stopPropagation()}
      role="document" onkeydown={(e) => e.stopPropagation()}>

      <div class="lib-header">
        <div class="lib-tabs">
          <button class="lib-tab" class:active={browseTab === 'public'}
            onclick={() => switchTab('public')}>🌐 Public Sets</button>
          <button class="lib-tab" class:active={browseTab === 'library'}
            onclick={() => switchTab('library')}>📚 My Library</button>
        </div>
        <button class="lib-close" onclick={closeBrowse}>✕</button>
      </div>

      <!-- Public sets tab -->
      {#if browseTab === 'public'}
        {#if bundledSets.length === 0 && catalogSets.length === 0}
          <div class="lib-empty">No public sets available yet.</div>
        {:else}
          <div class="lib-list">
            {#each bundledSets as mod (mod.id)}
              {@const tiers = countTiers(mod)}
              <button class="lib-item"
                class:selected={browsePicked?.source === 'public' && browsePicked?.mod?.id === mod.id}
                onclick={() => pickPublicSet(mod)}>
                <div class="lib-item-name">{mod.name}</div>
                <div class="lib-item-meta">
                  {mod.description ?? ''} · {totalQuestions(mod)} questions
                  <div class="tier-badges" style="margin-top:4px;">
                    {#each tiers as t}
                      <span class="tier-badge" style="background:{DIFF_BG[t]};color:{DIFF_COLORS[t]}">{DIFF_LABELS[t]}</span>
                    {/each}
                  </div>
                </div>
              </button>
            {/each}
            {#each catalogSets as mod (mod.id)}
              {@const tiers = countTiers(mod)}
              <button class="lib-item"
                class:selected={browsePicked?.source === 'public' && browsePicked?.mod?.id === mod.id}
                onclick={() => pickPublicSet(mod)}>
                <div class="lib-item-name">
                  {mod.name}
                  <span class="import-tag">{gs.loadedModules?.[mod.id] ? 'Imported' : 'Import'}</span>
                </div>
                <div class="lib-item-meta">
                  {mod.description ?? ''} · {totalQuestions(mod)} questions
                  <div class="tier-badges" style="margin-top:4px;">
                    {#each tiers as t}
                      <span class="tier-badge" style="background:{DIFF_BG[t]};color:{DIFF_COLORS[t]}">{DIFF_LABELS[t]}</span>
                    {/each}
                  </div>
                </div>
              </button>
            {/each}
          </div>
        {/if}

      <!-- Library tab -->
      {:else}
        {#if libLoading}
          <div class="lib-loading">Loading your library…</div>
        {:else if libError}
          <div class="lib-error">{libError}</div>
          {#if !get(session)}
            <a href="/auth/login" class="btn btn-primary" style="margin:14px 20px;display:inline-block">Log In</a>
          {/if}
        {:else if libItems.length === 0}
          <div class="lib-empty">
            <p>No sets in your library yet.</p>
            <a href="/questions/library" target="_blank" class="lib-link">Go to My Library →</a>
          </div>
        {:else}
          <div class="lib-list">
            {#if libGroups.length > 0}
              <div class="lib-sublabel">Groups</div>
              {#each libGroups as group (group.id)}
                {@const memberCount = (group.question_set_group_members || []).length}
                <button class="lib-item lib-group-item"
                  style="--gc:{group.color || '#E8C14A'}"
                  class:selected={browsePicked?.source === 'group' && browsePicked?.group?.id === group.id}
                  onclick={() => pickGroup(group)}>
                  <div class="lib-item-name">
                    {#if group.starred}<span class="star-ind">★</span>{/if}
                    <span class="lib-group-dot" style="background:{group.color || '#E8C14A'}"></span>{group.name}
                    <span class="import-tag" style="background:color-mix(in srgb,{group.color || '#E8C14A'} 18%,transparent);color:{group.color || '#E8C14A'}">Group</span>
                  </div>
                  <div class="lib-item-meta">
                    Plays every set in this group · {memberCount} set{memberCount !== 1 ? 's' : ''}
                  </div>
                </button>
              {/each}
              <div class="lib-sublabel">Individual Sets</div>
            {/if}
            {#each libItems as item (item.id)}
              <button class="lib-item"
                class:selected={browsePicked?.source === 'library' && browsePicked?.item?.id === item.id}
                onclick={() => pickLibraryItem(item)}>
                <div class="lib-item-name">{#if item.starred}<span class="star-ind">★</span>{/if}{item.name}</div>
                <div class="lib-item-meta">
                  {item.description ?? ''}
                  {#if item.question_count} · {item.question_count} questions{/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      {/if}

      <div class="lib-footer">
        <button class="btn btn-primary" disabled={!browsePicked || building} onclick={confirmBrowsePick}>
          {building ? 'Building…' : browsePicked?.source === 'group' ? 'Use This Group' : 'Use This Set'}
        </button>
        <button class="btn btn-ghost" onclick={closeBrowse}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .menu-wrap { max-width: 560px; margin: 0 auto; padding: 32px 0 48px; }

  .module-headline { font-family: var(--font-display); font-size: 42px; letter-spacing: 0.02em; line-height: 1.05; margin-bottom: 6px; }
  .module-sub { color: var(--text-muted); font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 20px; }

  /* Section label */
  .section-label { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px; margin-top: 4px; }

  /* Module list */
  .module-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
  .module-card {
    background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px 16px; cursor: pointer; transition: border-color 0.15s, background 0.15s;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    text-align: left; width: 100%; color: var(--text); font-family: var(--font-body);
  }
  .module-card:hover    { border-color: var(--border-hover); }
  .module-card.selected { border-color: var(--accent); background: var(--accent-dim); }
  .module-card-left  { flex: 1; }
  .module-card-name  { font-family: var(--font-display); font-size: 17px; letter-spacing: 0.04em; margin-bottom: 2px; }
  .module-card-desc  { font-size: 11px; color: var(--text-muted); line-height: 1.4; }
  .module-card-meta  { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .module-tag        { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 8px; border-radius: 3px; font-weight: 600; }
  .tag-default  { background: rgba(74,158,232,0.15); color: var(--blue); }
  .tag-library  { background: rgba(74,232,122,0.15); color: var(--green); }
  .tag-public   { background: rgba(180,74,232,0.15); color: #b44ae8; }
  .tag-group    { background: rgba(232,193,74,0.15); color: var(--accent); }
  .import-tag   { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; padding: 2px 6px; border-radius: 3px; margin-left: 8px; vertical-align: middle; background: rgba(180,74,232,0.15); color: #b44ae8; }
  .module-q-count { font-size: 11px; color: var(--text-muted); }
  .selected-clear {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 14px; padding: 2px 4px; transition: color 0.15s; line-height: 1;
  }
  .selected-clear:hover { color: var(--red); }
  .tier-badges  { display: flex; gap: 4px; margin-top: 5px; flex-wrap: wrap; }
  .tier-badge   { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 5px; border-radius: 2px; font-weight: 600; }
  .loading-hint { color: var(--text-muted); font-size: 13px; }

  /* Browse buttons — match module card style */
  .browse-row { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
  .browse-btn-full {
    flex: 1; min-width: 200px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px 16px; cursor: pointer;
    display: flex; align-items: center; gap: 12px; font-family: var(--font-body);
    text-align: left; color: var(--text); transition: border-color 0.15s, background 0.15s;
  }
  .browse-btn-full:hover { border-color: var(--border-hover); background: rgba(255,255,255,0.03); }
  .browse-btn-icon { font-size: 18px; flex-shrink: 0; }
  .browse-btn-text { flex: 1; display: flex; flex-direction: column; gap: 1px; }
  .browse-btn-text strong { font-size: 14px; font-weight: 600; color: var(--text); font-family: var(--font-display); letter-spacing: 0.04em; }
  .browse-btn-text span   { font-size: 11px; color: var(--text-muted); }

  /* Mode */
  .mode-row { display: flex; gap: 10px; margin-bottom: 24px; }
  .mode-btn { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; cursor: pointer; font-family: var(--font-body); font-size: 13px; font-weight: 500; color: var(--text-muted); text-align: left; transition: border-color 0.15s, background 0.15s; }
  .mode-btn:hover  { border-color: var(--border-hover); color: var(--text); }
  .mode-btn.active { border-color: var(--accent); background: var(--accent-dim); color: var(--text); }
  .mode-btn.sparring-btn.active { border-color: #b44ae8; background: rgba(180,74,232,0.12); }
  .mode-btn-title { font-family: var(--font-display); font-size: 17px; letter-spacing: 0.04em; margin-bottom: 3px; color: var(--text); }
  .mode-btn-desc  { font-size: 11px; color: var(--text-muted); line-height: 1.4; }
  .mode-btn.active .mode-btn-title { color: var(--accent); }
  .mode-btn.sparring-btn.active .mode-btn-title { color: #b44ae8; }

  /* Config */
  .config-section { margin-bottom: 4px; }
  .config-label { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px; }
  .diff-row  { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
  .length-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .diff-btn { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 14px; cursor: pointer; font-family: var(--font-body); font-size: 13px; font-weight: 500; color: var(--text-muted); transition: border-color 0.15s; flex: 1; min-width: 80px; text-align: center; }
  .diff-btn:hover { border-color: var(--border-hover); color: var(--text); }
  .diff-btn.active-easy   { border-color: var(--green);  background: rgba(74,232,122,0.10); color: var(--green);  font-weight: 600; }
  .diff-btn.active-medium { border-color: var(--accent); background: var(--accent-dim);     color: var(--accent); font-weight: 600; }
  .diff-btn.active-hard   { border-color: var(--red);    background: rgba(232,74,74,0.10);  color: var(--red);    font-weight: 600; }
  .diff-btn-label { font-family: var(--font-display); font-size: 18px; letter-spacing: 0.04em; display: block; margin-bottom: 1px; }
  .diff-btn-sub   { font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); }
  .length-btn { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 14px; cursor: pointer; font-family: var(--font-body); font-size: 13px; font-weight: 500; color: var(--text-muted); flex: 1; min-width: 70px; text-align: center; transition: border-color 0.15s; }
  .length-btn:hover  { border-color: var(--border-hover); color: var(--text); }
  .length-btn.active { border-color: var(--accent); background: var(--accent-dim); color: var(--accent); font-weight: 600; }
  .length-btn-fights { font-family: var(--font-display); font-size: 20px; letter-spacing: 0.04em; display: block; margin-bottom: 1px; color: var(--text); }
  .length-btn.active .length-btn-fights { color: var(--accent); }
  .length-btn-sub { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.07em; }

  /* Switcher */
  .msw-wrap { max-width: 520px; }
  .msw-headline { font-family: var(--font-display); font-size: 32px; letter-spacing: 0.04em; margin-bottom: 6px; }
  .msw-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }
  .msw-section-label { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; }
  .msw-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
  .msw-card { position: relative; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; cursor: pointer; transition: border-color 0.15s; text-align: left; width: 100%; color: var(--text); font-family: var(--font-body); }
  .msw-card:hover    { border-color: var(--border-hover); }
  .msw-card.selected { border-color: var(--accent); background: var(--accent-dim); }
  .msw-card-name { font-weight: 600; font-size: 13px; margin-bottom: 1px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .msw-active-tag { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; padding: 2px 6px; border-radius: 3px; background: var(--accent-dim); color: var(--accent); }
  .msw-card-desc { font-size: 11px; color: var(--text-muted); }
  .msw-divider   { height: 1px; background: var(--border); margin: 16px 0; }
  .msw-actions   { display: flex; flex-direction: column; gap: 10px; }
  .btn-danger    { border-color: rgba(232,74,74,0.35) !important; color: var(--red) !important; }

  /* Browse/library modal */
  .lib-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.80); display: flex; align-items: center; justify-content: center; z-index: 9999; }
  .lib-modal   { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); width: 90%; max-width: 520px; max-height: 82vh; display: flex; flex-direction: column; overflow: hidden; }
  .lib-header  { display: flex; align-items: center; justify-content: space-between; padding: 0 16px 0 0; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .lib-tabs    { display: flex; flex: 1; }
  .lib-tab     { flex: 1; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-family: var(--font-body); font-size: 13px; font-weight: 600; padding: 14px 16px; cursor: pointer; transition: color 0.15s, border-color 0.15s; }
  .lib-tab:hover { color: var(--text); }
  .lib-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .lib-close   { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 18px; transition: color 0.15s; padding: 4px 8px; }
  .lib-close:hover { color: var(--text); }
  .lib-loading { padding: 32px 20px; text-align: center; color: var(--text-muted); font-size: 13px; }
  .lib-error   { padding: 20px; color: var(--red); font-size: 13px; }
  .lib-empty   { padding: 32px 20px; text-align: center; color: var(--text-muted); font-size: 13px; }
  .lib-link    { display: inline-block; margin-top: 10px; color: var(--accent); font-size: 13px; text-decoration: none; }
  .lib-link:hover { text-decoration: underline; }
  .lib-list    { flex: 1; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
  .lib-list::-webkit-scrollbar { width: 4px; }
  .lib-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  .lib-item    { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; cursor: pointer; text-align: left; width: 100%; color: var(--text); font-family: var(--font-body); transition: border-color 0.15s, background 0.15s; }
  .lib-item:hover    { border-color: var(--border-hover); }
  .lib-item.selected { border-color: var(--accent); background: var(--accent-dim); }
  .lib-item-name { font-weight: 600; font-size: 14px; margin-bottom: 3px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  .lib-item-meta { font-size: 11px; color: var(--text-muted); }
  .lib-sublabel { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); margin: 4px 2px 2px; }
  .lib-sublabel:first-child { margin-top: 0; }
  .lib-group-item { border-left: 3px solid var(--gc); }
  .lib-group-item.selected { border-color: var(--gc); }
  .lib-group-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .star-ind { color: var(--accent); font-size: 12px; flex-shrink: 0; }
  .lib-footer  { display: flex; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--border); flex-shrink: 0; }

  /* Save panels */
  .saves-row {
    display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap;
  }
  .saves-card {
    flex: 1; min-width: 200px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px 16px; cursor: pointer;
    display: flex; align-items: center; gap: 12px; font-family: var(--font-body);
    text-align: left; color: var(--text); transition: border-color 0.15s, background 0.15s;
  }
  .saves-card:hover { border-color: var(--accent); background: var(--accent-dim); }
  .saves-card-icon  { font-size: 18px; flex-shrink: 0; }
  .saves-card-body  { flex: 1; display: flex; flex-direction: column; gap: 1px; }
  .saves-card-title { font-family: var(--font-display); font-size: 15px; letter-spacing: 0.04em; color: var(--text); }
  .saves-card-sub   { font-size: 11px; color: var(--text-muted); }
  .saves-card-badge {
    font-family: var(--font-display); font-size: 14px; letter-spacing: 0.04em;
    color: var(--accent); flex-shrink: 0;
  }
  .saves-guest-hint {
    font-size: 12px; color: var(--text-muted); text-align: center;
    padding: 14px 16px; border: 1px dashed var(--border); border-radius: var(--radius);
    margin-bottom: 24px;
  }

  @media (max-width: 768px) {
    .menu-wrap { padding: 20px 0 32px; }
    .browse-row { flex-direction: column; }
    .diff-row, .length-row { gap: 6px; }
    .diff-btn, .length-btn { padding: 8px 10px; min-width: 0; }
    .saves-row { flex-direction: column; }
  }
</style>
