<!-- src/lib/golf/QuestionSetPicker.svelte -->
<!-- Question set picker: default set cards + Public/Library browse modal.
     Used on round setup and (between holes) on the scorecard screen. -->
<script>
  import { get } from 'svelte/store';
  import { session } from '$lib/stores/session.js';
  import { supabase } from '$lib/supabase.js';
  import { state as gs } from '$lib/golf/state.svelte.js';
  import { TIER_ORDER, DIFF_LABELS, DIFF_COLORS, DIFF_BG } from '$lib/golf/constants.js';
  import { loadGroups } from '$lib/progress.js';
  import { registerModule, libraryModule, buildGroupModule, totalQs } from '$lib/golf/modules.js';

  const {
    selectedId = null,
    onselect = () => {},   // (modId) — module is already registered when called
  } = $props();

  function countTiers(mod) {
    return TIER_ORDER.filter(t => (mod.tiers?.[t] || []).length > 0);
  }
  function modTagLabel(mod) {
    if (mod?.tag === 'library') return 'Library';
    if (mod?.tag === 'public')  return 'Public';
    if (mod?.tag === 'group')   return 'Group';
    return 'Default';
  }
  function modTagClass(mod) {
    if (mod?.tag === 'library') return 'tag-library';
    if (mod?.tag === 'public')  return 'tag-public';
    if (mod?.tag === 'group')   return 'tag-group';
    return 'tag-default';
  }

  const bundledSets = $derived(gs.availableModules.filter(m => !m.tag));
  const publicSets  = $derived(gs.availableModules.filter(m => !m.tag || m.tag === 'public'));
  const selectedMod = $derived(selectedId ? gs.loadedModules?.[selectedId] : null);
  const selectedNonDefault = $derived(!!selectedMod && !!selectedMod.tag);

  function pick(modId) {
    if (!modId || modId === selectedId) return;
    onselect(modId);
  }

  // ── Browse modal ──────────────────────────────────────
  let browseOpen   = $state(false);
  let browseTab    = $state('public');
  let browsePicked = $state(null);
  let libItems     = $state([]);
  let libGroups    = $state([]);
  let libLoading   = $state(false);
  let libError     = $state('');
  let building     = $state(false);

  async function openBrowse(tab = 'public') {
    browseTab = tab; browsePicked = null; browseOpen = true;
    if (tab === 'library') await loadLibrary();
  }

  async function switchTab(tab) {
    browseTab = tab; browsePicked = null;
    if (tab === 'library' && !libItems.length && !libGroups.length && !libError) await loadLibrary();
  }

  async function loadLibrary() {
    let sess = get(session);
    if (!sess) {
      const { data } = await supabase.auth.getSession();
      sess = data?.session || null;
    }
    if (!sess) { libError = 'Log in to access your library.'; return; }
    libLoading = true; libError = ''; libItems = []; libGroups = [];
    try {
      const [setsRes, groupsRes] = await Promise.all([
        supabase.from('user_question_sets')
          .select('id, name, description, question_count, data, starred')
          .eq('user_id', sess.user.id)
          .eq('staged', false)
          .order('created_at', { ascending: false }),
        loadGroups(sess.user.id),
      ]);
      if (setsRes.error) throw setsRes.error;
      const byStar = (a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
      libItems  = (setsRes.data || []).sort(byStar);
      libGroups = (groupsRes || []).filter(g => (g.question_set_group_members || []).length > 0).sort(byStar);
    } catch(e) {
      libError = '⚠ Could not load library: ' + e.message;
    } finally {
      libLoading = false;
    }
  }

  async function confirmBrowsePick() {
    if (!browsePicked) return;
    let pickedId;
    if (browsePicked.source === 'group') {
      building = true; libError = '';
      try {
        const mod = await buildGroupModule(browsePicked.group, gs);
        if (totalQs(mod) === 0) { libError = 'This group has no questions yet.'; return; }
        registerModule(gs, mod);
        pickedId = mod.id;
      } catch (e) {
        libError = '⚠ Could not build group: ' + e.message; return;
      } finally {
        building = false;
      }
    } else if (browsePicked.source === 'public') {
      registerModule(gs, browsePicked.mod);
      pickedId = browsePicked.mod.id;
    } else {
      const mod = libraryModule(browsePicked.item);
      registerModule(gs, mod);
      pickedId = mod.id;
    }
    browseOpen   = false;
    browsePicked = null;
    pick(pickedId);
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && browseOpen) { browseOpen = false; browsePicked = null; }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="qset-grid">
  {#each bundledSets as mod (mod.id)}
    <button class="qset-card" class:selected={selectedId === mod.id} onclick={() => pick(mod.id)}>
      <div class="qset-card-name">{mod.icon ? mod.icon + ' ' : ''}{mod.name}</div>
      <div class="qset-card-desc">{mod.description ?? ''}</div>
      <div class="qset-stats">
        {#each countTiers(mod) as t}
          <span class="tier-badge" style="background:{DIFF_BG[t]};color:{DIFF_COLORS[t]}">
            {DIFF_LABELS[t]} ×{mod.tiers[t].length}
          </span>
        {/each}
        <span class="qset-total">{totalQs(mod)} q</span>
      </div>
    </button>
  {/each}
</div>

<!-- Selected non-default set -->
{#if selectedNonDefault}
  <div class="qset-card qset-card-full selected">
    <div class="qset-card-top">
      <span class="module-tag {modTagClass(selectedMod)}">{modTagLabel(selectedMod)}</span>
      <span class="qset-clear" role="button" tabindex="0"
        onclick={() => pick(bundledSets[0]?.id)}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') pick(bundledSets[0]?.id); }}>✕</span>
    </div>
    <div class="qset-card-name">{selectedMod.name}</div>
    <div class="qset-card-desc">{selectedMod.description ?? ''}</div>
    <div class="qset-stats">
      {#each countTiers(selectedMod) as t}
        <span class="tier-badge" style="background:{DIFF_BG[t]};color:{DIFF_COLORS[t]}">
          {DIFF_LABELS[t]} ×{selectedMod.tiers[t].length}
        </span>
      {/each}
      <span class="qset-total">{totalQs(selectedMod)} questions</span>
    </div>
  </div>
{/if}

<div class="browse-row">
  <button class="browse-btn" onclick={() => openBrowse('public')}>
    <span class="browse-btn-text"><strong>Public Sets</strong><span>Community question sets</span></span>
    <span style="color:var(--muted)">→</span>
  </button>
  <button class="browse-btn" onclick={() => openBrowse('library')}>
    <span class="browse-btn-text"><strong>My Library</strong><span>Your saved sets</span></span>
    <span style="color:var(--muted)">→</span>
  </button>
</div>

<!-- Browse modal -->
{#if browseOpen}
  <div class="lib-overlay" role="presentation" onclick={() => { browseOpen = false; browsePicked = null; }}>
    <div class="lib-modal" role="presentation" onclick={e => e.stopPropagation()}>
      <div class="lib-header">
        <div class="lib-tabs">
          <button class="lib-tab" class:active={browseTab === 'public'} onclick={() => switchTab('public')}>Public</button>
          <button class="lib-tab" class:active={browseTab === 'library'} onclick={() => switchTab('library')}>Library</button>
        </div>
        <button class="lib-close" onclick={() => { browseOpen = false; browsePicked = null; }}>✕</button>
      </div>

      {#if browseTab === 'public'}
        {#if publicSets.length === 0}
          <div class="lib-empty">No public sets available.</div>
        {:else}
          <div class="lib-list">
            {#each publicSets as mod (mod.id)}
              <button class="lib-item"
                class:selected={browsePicked?.mod?.id === mod.id}
                onclick={() => browsePicked = { source: 'public', mod }}>
                <div class="lib-item-name">
                  {mod.name}
                  {#if !mod.tag}<span class="default-tag">Default</span>{/if}
                </div>
                <div class="lib-item-meta">{mod.description ?? ''} · {totalQs(mod)} questions</div>
              </button>
            {/each}
          </div>
        {/if}
      {:else}
        {#if libLoading}
          <div class="lib-empty">Loading…</div>
        {:else if libError}
          <div class="lib-empty" style="color:var(--red)">{libError}</div>
          {#if !get(session)}
            <div style="text-align:center"><a href="/auth/login" class="lib-login">Log In →</a></div>
          {/if}
        {:else if libItems.length === 0 && libGroups.length === 0}
          <div class="lib-empty">
            No sets in your library yet.
            <div><a href="/questions/library" target="_blank" class="lib-login">Go to My Library →</a></div>
          </div>
        {:else}
          <div class="lib-list">
            {#if libGroups.length > 0}
              <div class="lib-sublabel">Groups</div>
              {#each libGroups as group (group.id)}
                {@const memberCount = (group.question_set_group_members || []).length}
                <button class="lib-item lib-group-item"
                  style="--gc:{group.color || '#d4a847'}"
                  class:selected={browsePicked?.source === 'group' && browsePicked?.group?.id === group.id}
                  onclick={() => browsePicked = { source: 'group', group }}>
                  <div class="lib-item-name">
                    {#if group.starred}<span class="star-ind">★</span>{/if}
                    <span class="lib-group-dot" style="background:{group.color || '#d4a847'}"></span>{group.name}
                    <span class="group-tag">Group</span>
                  </div>
                  <div class="lib-item-meta">Plays every set in this group · {memberCount} set{memberCount !== 1 ? 's' : ''}</div>
                </button>
              {/each}
              <div class="lib-sublabel">Individual Sets</div>
            {/if}
            {#each libItems as item (item.id)}
              <button class="lib-item"
                class:selected={browsePicked?.source === 'library' && browsePicked?.item?.id === item.id}
                onclick={() => browsePicked = { source: 'library', item }}>
                <div class="lib-item-name">{#if item.starred}<span class="star-ind">★</span>{/if}{item.name}</div>
                <div class="lib-item-meta">{item.description ?? ''}{item.question_count ? ` · ${item.question_count} questions` : ''}</div>
              </button>
            {/each}
          </div>
        {/if}
      {/if}

      <div class="lib-footer">
        <button class="btn btn-primary" disabled={!browsePicked || building} onclick={confirmBrowsePick}>
          {building ? 'Building…' : browsePicked?.source === 'group' ? 'Use This Group' : 'Use This Set'}
        </button>
        <button class="btn btn-ghost" onclick={() => { browseOpen = false; browsePicked = null; }}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .qset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .qset-card {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 4px;
    padding: 12px 14px; cursor: pointer; text-align: left; color: var(--text);
    font-family: var(--font-body); transition: border-color .15s, background .15s;
  }
  .qset-card:hover    { border-color: var(--accent-border); }
  .qset-card.selected { border-color: var(--accent); background: color-mix(in srgb,var(--accent) 10%,var(--surface2)); }
  .qset-card-full { width: 100%; display: block; margin-bottom: 10px; }
  .qset-card-name { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
  .qset-card-desc { font-size: 11px; color: var(--text-muted); line-height: 1.4; }
  .qset-card-top  { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .qset-stats { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; margin-top: 6px; }
  .tier-badge { font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; padding: 2px 6px; border-radius: 2px; }
  .qset-total { font-size: 10px; color: var(--muted); margin-left: auto; }
  .qset-clear { margin-left: auto; color: var(--muted); cursor: pointer; font-size: 13px; padding: 0 2px; }
  .qset-clear:hover { color: var(--red); }

  .module-tag { font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 2px 7px; border-radius: 2px; }
  .tag-default { background: rgba(212,168,71,.15); color: var(--accent); }
  .tag-public  { background: rgba(91,184,245,.15); color: #5bb8f5; }
  .tag-library { background: rgba(168,85,247,.15); color: #a855f7; }
  .tag-group   { background: rgba(62,207,106,.15); color: var(--green); }

  .browse-row { display: flex; gap: 10px; }
  .browse-btn {
    flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 8px;
    background: var(--surface2); border: 1px dashed var(--border); border-radius: 4px;
    padding: 10px 14px; cursor: pointer; color: var(--text);
    font-family: var(--font-body); transition: border-color .15s;
  }
  .browse-btn:hover { border-color: var(--accent-border); }
  .browse-btn-text { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; text-align: left; }
  .browse-btn-text strong { font-size: 12px; font-weight: 600; }
  .browse-btn-text span:not(strong) { font-size: 10px; color: var(--muted); }

  /* ── Modal ─────────────────────────────────────────── */
  .lib-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.8); display: flex; align-items: center; justify-content: center; z-index: 9999; }
  .lib-modal {
    background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
    width: 92%; max-width: 520px; max-height: 78vh;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .lib-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .lib-tabs { display: flex; gap: 4px; }
  .lib-tab {
    background: none; border: 1px solid transparent; border-radius: 3px; cursor: pointer;
    color: var(--muted); font-family: var(--font-body); font-size: 12px; font-weight: 600;
    letter-spacing: .08em; text-transform: uppercase; padding: 6px 14px;
  }
  .lib-tab.active { color: var(--accent); border-color: rgba(212,168,71,.4); background: rgba(212,168,71,.06); }
  .lib-close { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 16px; padding: 4px 8px; }
  .lib-close:hover { color: var(--text); }

  .lib-list { flex: 1; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
  .lib-sublabel { font-size: 9px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); padding: 6px 2px 0; }
  .lib-item {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 4px;
    padding: 10px 12px; cursor: pointer; text-align: left; color: var(--text);
    font-family: var(--font-body); transition: border-color .15s;
  }
  .lib-item:hover { border-color: var(--accent-border); }
  .lib-item.selected { border-color: var(--accent); background: color-mix(in srgb,var(--accent) 8%,var(--surface2)); }
  .lib-item-name { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .lib-item-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .lib-group-item { border-left: 3px solid var(--gc, var(--accent)); }
  .lib-group-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .group-tag, .default-tag { font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 1px 6px; border-radius: 2px; background: var(--surface3, rgba(255,255,255,.08)); color: var(--muted); }
  .star-ind { color: var(--accent); font-size: 11px; }
  .lib-empty { padding: 32px 20px; text-align: center; color: var(--muted); font-size: 13px; display: flex; flex-direction: column; gap: 10px; }
  .lib-login { color: var(--accent); text-decoration: none; font-size: 13px; }
  .lib-login:hover { text-decoration: underline; }
  .lib-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid var(--border); flex-shrink: 0; }

  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 9px 18px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; white-space: nowrap; }
  .btn:hover  { opacity: .85; }
  .btn:disabled { opacity: .35; cursor: not-allowed; }
  .btn-primary { background: var(--accent); color: #0a0a0c; }
  .btn-ghost   { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }

  @media (max-width: 560px) {
    .qset-grid { grid-template-columns: 1fr; }
    .browse-row { flex-direction: column; }
  }
</style>
