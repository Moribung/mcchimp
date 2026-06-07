<!-- src/lib/football/screens/CareerSetupScreen.svelte -->
<script>
  import { get }      from 'svelte/store';
  import { session }  from '$lib/stores/session.js';
  import { supabase } from '$lib/supabase.js';
  import { state as gs } from '$lib/football/state.svelte.js';
  import { KIT_COLOURS, TIER_ORDER, DIFF_LABELS, DIFF_COLORS, DIFF_BG } from '$lib/football/constants.js';
  import { randomClubName } from '$lib/football/names.js';
  import { fetchSet } from '$lib/questions.js';
  import { loadGroups } from '$lib/progress.js';

  const { onstartgame, onback } = $props();

  // ── Form state ────────────────────────────────────────
  let clubName       = $state('');
  let selectedKit    = $state(0);
  let startRating    = $state(57);
  let teamCount      = $state(18);
  let returnFixtures = $state(true);
  let selectedModId  = $state(null);

  // ── Module helpers ────────────────────────────────────
  function totalQs(mod) {
    return TIER_ORDER.reduce((n, t) => n + (mod.tiers?.[t] || []).length, 0);
  }
  function countTiers(mod) {
    return TIER_ORDER.filter(t => (mod.tiers?.[t] || []).length > 0);
  }
  function modTagLabel(mod) {
    return mod?.tag === 'uploaded' ? 'Custom' : mod?.tag === 'library' ? 'Library' : mod?.tag === 'public' ? 'Public' : 'Default';
  }
  function modTagClass(mod) {
    if (mod?.tag === 'uploaded') return 'tag-custom';
    if (mod?.tag === 'library')  return 'tag-library';
    if (mod?.tag === 'public')   return 'tag-public';
    return 'tag-default';
  }

  const bundledSets = $derived(gs.availableModules.filter(m => !m.tag));
  const selectedMod = $derived(selectedModId ? gs.loadedModules?.[selectedModId] : null);

  $effect(() => {
    if (selectedModId === null && bundledSets.length) {
      const fb = bundledSets.find(m => m.id === 'football_questions');
      selectedModId = fb ? fb.id : bundledSets[0].id;
    }
  });

  // ── Browse modal ──────────────────────────────────────
  let browseOpen   = $state(false);
  let browseTab    = $state('public');
  let browsePicked = $state(null);
  let libItems     = $state([]);
  let libGroups    = $state([]);
  let libLoading   = $state(false);
  let libError     = $state('');
  let building     = $state(false);

  const publicSets = $derived(gs.availableModules.filter(m => !m.tag || m.tag === 'public'));

  async function openBrowse(tab = 'public') {
    browseTab = tab; browsePicked = null; browseOpen = true;
    if (tab === 'library') await loadLibrary();
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

  async function buildGroupModule(group) {
    const members = group.question_set_group_members || [];
    const merged  = {};
    for (const m of members) {
      let data = null;
      if (m.set_source === 'library') {
        const { data: row } = await supabase.from('user_question_sets').select('data').eq('id', m.set_id).maybeSingle();
        data = row?.data;
      } else if (m.set_source === 'public') {
        try { data = await fetchSet(m.set_id.endsWith('.json') ? m.set_id : m.set_id + '.json'); } catch { /* skip */ }
      } else {
        data = gs.loadedModules?.[m.set_id] || gs.loadedModules?.[m.set_id?.replace('.json', '')];
        if (!data) { try { data = await fetchSet(m.set_id); } catch { /* skip */ } }
      }
      if (!data?.tiers) continue;
      for (const t of TIER_ORDER) {
        const qs = data.tiers[t] || [];
        if (!qs.length) continue;
        (merged[t] ||= []).push(...qs);
      }
    }
    return { id: 'grp_' + group.id, tag: 'group', name: group.name,
             description: `${members.length} set${members.length !== 1 ? 's' : ''}`, tiers: merged };
  }

  async function switchTab(tab) {
    browseTab = tab; browsePicked = null;
    if (tab === 'library' && !libItems.length && !libGroups.length && !libError) await loadLibrary();
  }

  async function confirmBrowsePick() {
    if (!browsePicked) return;
    let pickedId;
    if (browsePicked.source === 'group') {
      building = true; libError = '';
      try {
        const mod = await buildGroupModule(browsePicked.group);
        const total = TIER_ORDER.reduce((n, t) => n + (mod.tiers?.[t] || []).length, 0);
        if (total === 0) { libError = 'This group has no questions yet.'; return; }
        if (!gs.loadedModules[mod.id]) gs.availableModules = [...gs.availableModules, mod];
        gs.loadedModules[mod.id] = mod;
        pickedId = mod.id;
      } catch (e) {
        libError = '⚠ Could not build group: ' + e.message; return;
      } finally {
        building = false;
      }
    } else if (browsePicked.source === 'public') {
      const mod = browsePicked.mod;
      if (!gs.loadedModules[mod.id]) { gs.availableModules = [...gs.availableModules, mod]; gs.loadedModules[mod.id] = mod; }
      pickedId = mod.id;
    } else {
      const item = browsePicked.item;
      const id   = 'lib_' + item.id;
      if (!gs.loadedModules[id]) {
        const mod = { id, tag: 'library', name: item.name, description: item.description ?? '', ...item.data };
        gs.availableModules = [...gs.availableModules, mod];
        gs.loadedModules[id] = mod;
      }
      pickedId = id;
    }
    selectedModId = pickedId;
    browseOpen    = false;
    browsePicked  = null;
  }

  function validateTeamCount(v) {
    v = Math.max(6, Math.min(20, Math.round(v)));
    if (v % 2 !== 0) v = Math.min(20, v + 1);
    teamCount = v;
  }

  function startGame() {
    if (!selectedModId || !clubName.trim()) return;
    onstartgame?.({ clubName: clubName.trim(), kitColour: KIT_COLOURS[selectedKit].hex,
                    startRating, teamCount, returnFixtures, modId: selectedModId });
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && browseOpen) { browseOpen = false; browsePicked = null; }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="setup-wrap">
  <div class="setup-nav">
    <button class="back-link" onclick={onback}>← Back</button>
    <span class="setup-title">New Career</span>
  </div>

  <!-- Club setup -->
  <div class="card mb-24">
    <div class="form-group">
      <label class="form-label" for="club-name-inp">Club Name</label>
      <div class="input-row">
        <input id="club-name-inp" type="text" bind:value={clubName}
          placeholder="Enter your club name…" maxlength="40" />
        <button class="btn btn-secondary" onclick={() => clubName = randomClubName()}>Randomise</button>
      </div>
    </div>
    <div class="form-group mb-0">
      <label class="form-label">Kit Colour</label>
      <div class="kit-picker">
        {#each KIT_COLOURS as kit, i}
          <button class="kit-swatch" class:selected={i === selectedKit}
            style="background:{kit.hex}" title={kit.name} onclick={() => selectedKit = i}></button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Match settings -->
  <div class="card mb-24">
    <div class="form-group">
      <label class="form-label" for="start-rating-inp">
        Starting Team Rating
        <span class="rating-val">{startRating}</span>
      </label>
      <input id="start-rating-inp" type="range" min="50" max="75" bind:value={startRating} />
    </div>
    <div class="form-group">
      <label class="form-label" for="team-count-inp">Teams per Division</label>
      <input id="team-count-inp" type="number" min="6" max="20"
        value={teamCount} oninput={e => validateTeamCount(+e.target.value)} />
      {#if teamCount % 2 !== 0}
        <div class="field-note">Adjusted to {teamCount} (must be even)</div>
      {/if}
    </div>
    <div class="form-group mb-0">
      <label class="form-label">Return Fixtures</label>
      <div class="toggle-row">
        <label class="toggle-switch">
          <input type="checkbox" bind:checked={returnFixtures} />
          <span class="toggle-knob"></span>
        </label>
        <span style="font-size:12px;color:var(--text-dim)">
          {returnFixtures ? 'Each pair plays home and away' : 'Each pair plays once'}
        </span>
      </div>
    </div>
  </div>

  <!-- Question set picker -->
  <div class="card mb-24">
    <div class="section-label">Question Set</div>
    <div class="qset-grid">
      {#each bundledSets as mod (mod.id)}
        <button class="qset-card" class:selected={selectedModId === mod.id}
          onclick={() => selectedModId = mod.id}>
          <div class="qset-card-name">{mod.name}</div>
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

    {#if selectedMod && selectedMod.tag}
      <button class="qset-card qset-card-full selected" onclick={() => {}}>
        <div class="qset-card-top">
          <span class="module-tag {modTagClass(selectedMod)}">{modTagLabel(selectedMod)}</span>
          <span class="selected-clear" role="button" tabindex="0"
            onclick={(e) => { e.stopPropagation(); selectedModId = null; }}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); selectedModId = null; } }}>✕</span>
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
      </button>
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
  </div>

  <button class="btn btn-primary btn-lg btn-full"
    disabled={!selectedModId || !clubName.trim()}
    onclick={startGame}>
    Begin Season 1
  </button>
</div>

<!-- Browse modal -->
{#if browseOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="lib-overlay" onclick={() => { browseOpen = false; browsePicked = null; }}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="lib-modal" onclick={e => e.stopPropagation()}>
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
  .setup-wrap { max-width: 560px; margin: 0 auto; padding: 28px 0 48px; }

  .setup-nav {
    display: flex; align-items: center; gap: 16px; margin-bottom: 32px;
  }
  .back-link {
    background: none; border: none; color: var(--muted); cursor: pointer;
    font-family: var(--font-body); font-size: 12px; font-weight: 600;
    letter-spacing: .1em; text-transform: uppercase; padding: 0;
    transition: color .15s;
  }
  .back-link:hover { color: var(--text); }
  .setup-title {
    font-family: var(--font-display); font-size: 28px; color: var(--text); letter-spacing: .04em;
  }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 20px; }
  .mb-24 { margin-bottom: 24px; }
  .form-group { margin-bottom: 16px; }
  .form-label {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 11px; font-weight: 600; letter-spacing: .1em;
    text-transform: uppercase; color: var(--muted); margin-bottom: 6px;
  }
  .rating-val { font-family: var(--font-display); font-size: 22px; color: var(--gold); }
  .mb-0 { margin-bottom: 0 !important; }

  .input-row { display: flex; gap: 8px; }
  .input-row input { flex: 1; }

  input[type="text"], input[type="number"] {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 3px;
    color: var(--text); font-family: var(--font-body); font-size: 14px;
    padding: 10px 14px; width: 100%; outline: none; transition: border-color .15s;
  }
  input[type="text"]:focus, input[type="number"]:focus { border-color: var(--gold); }
  input[type="text"]::placeholder { color: var(--muted); }
  input[type="range"] { width: 100%; accent-color: var(--gold); margin-top: 6px; cursor: pointer; }
  .field-note { font-size: 11px; color: var(--amber); margin-top: 4px; }

  .toggle-row { display: flex; align-items: center; gap: 12px; }
  .toggle-switch { position: relative; display: inline-block; width: 42px; height: 22px; flex-shrink: 0; }
  .toggle-switch input { opacity: 0; width: 0; height: 0; }
  .toggle-knob {
    position: absolute; inset: 0; background: var(--surface2);
    border: 1px solid var(--border); border-radius: 22px; cursor: pointer;
    transition: background .2s, border-color .2s;
  }
  .toggle-knob::before {
    content: ''; position: absolute; width: 16px; height: 16px; left: 2px; bottom: 2px;
    background: var(--muted); border-radius: 50%; transition: transform .2s, background .2s;
  }
  .toggle-switch input:checked + .toggle-knob { background: color-mix(in srgb,var(--gold) 20%,transparent); border-color: var(--gold); }
  .toggle-switch input:checked + .toggle-knob::before { transform: translateX(20px); background: var(--gold); }

  .kit-picker { display: flex; gap: 10px; flex-wrap: wrap; }
  .kit-swatch {
    width: 36px; height: 36px; border-radius: 50%; border: 2px solid transparent;
    cursor: pointer; transition: transform .15s, border-color .15s;
  }
  .kit-swatch:hover { transform: scale(1.1); }
  .kit-swatch.selected { border-color: var(--text); transform: scale(1.1); }

  .section-label { font-size: 10px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }

  .qset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .qset-card {
    background: var(--surface2); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
    padding: 12px 14px; cursor: pointer; transition: border-color .15s, background .15s;
    text-align: left; color: var(--text); font-family: var(--font-body); position: relative;
  }
  .qset-card:hover    { border-color: var(--gold-dim); }
  .qset-card.selected { border-color: var(--gold); background: color-mix(in srgb,var(--gold) 10%,var(--surface2)); }
  .qset-card-full { width: 100%; display: block; }
  .qset-card-name { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
  .qset-card-desc { font-size: 11px; color: var(--text-dim); line-height: 1.4; }
  .qset-card-top  { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .qset-stats { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; margin-top: 6px; }
  .tier-badge { font-size: 9px; letter-spacing: .08em; text-transform: uppercase; padding: 2px 6px; border-radius: 2px; font-weight: 600; }
  .qset-total { font-size: 11px; color: var(--text-dim); margin-left: 4px; }

  .module-tag { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; padding: 2px 6px; border-radius: 2px; font-weight: 600; }
  .tag-default { background: rgba(74,158,232,.15); color: #5ab0e0; }
  .tag-library { background: rgba(74,232,122,.15); color: var(--green); }
  .tag-public  { background: rgba(180,74,232,.15); color: #b44ae8; }
  .tag-custom  { background: rgba(74,232,122,.15); color: var(--green); }
  .selected-clear { margin-left: auto; background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 14px; padding: 0 2px; line-height: 1; }
  .selected-clear:hover { color: var(--red); }

  .browse-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .browse-btn {
    flex: 1; min-width: 160px; background: var(--surface2); border: 1px solid var(--border);
    border-radius: 4px; padding: 12px 14px; cursor: pointer; display: flex;
    align-items: center; gap: 10px; font-family: var(--font-body); text-align: left;
    color: var(--text); transition: border-color .15s;
  }
  .browse-btn:hover { border-color: var(--gold-dim); }
  .browse-btn-text { flex: 1; display: flex; flex-direction: column; gap: 1px; }
  .browse-btn-text strong { font-size: 13px; font-weight: 600; }
  .browse-btn-text span   { font-size: 11px; color: var(--muted); }

  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 10px 20px; border: none; border-radius: 3px;
    font-family: var(--font-body); font-size: 13px; font-weight: 600;
    letter-spacing: .06em; text-transform: uppercase; cursor: pointer;
    transition: opacity .15s; white-space: nowrap;
  }
  .btn:hover  { opacity: .85; }
  .btn:disabled { opacity: .35; cursor: not-allowed; }
  .btn-primary   { background: var(--gold); color: #0a0a0c; }
  .btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
  .btn-ghost     { background: transparent; color: var(--text-dim); border: 1px solid var(--border); }
  .btn-lg  { padding: 14px 32px; font-size: 15px; letter-spacing: .1em; }
  .btn-full { width: 100%; }

  /* Browse modal */
  .lib-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.8); display: flex; align-items: center; justify-content: center; z-index: 9999; }
  .lib-modal   { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; width: 90%; max-width: 500px; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; }
  .lib-header  { display: flex; align-items: center; justify-content: space-between; padding: 0 12px 0 0; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .lib-tabs    { display: flex; flex: 1; }
  .lib-tab     { flex: 1; background: none; border: none; border-bottom: 2px solid transparent; color: var(--muted); font-family: var(--font-body); font-size: 13px; font-weight: 600; padding: 14px 16px; cursor: pointer; transition: color .15s, border-color .15s; }
  .lib-tab:hover { color: var(--text); }
  .lib-tab.active { color: var(--gold); border-bottom-color: var(--gold); }
  .lib-close   { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 18px; padding: 4px 8px; }
  .lib-list    { flex: 1; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
  .lib-item    { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 12px 14px; cursor: pointer; text-align: left; width: 100%; color: var(--text); font-family: var(--font-body); transition: border-color .15s; }
  .lib-item:hover    { border-color: var(--gold-dim); }
  .lib-item.selected { border-color: var(--gold); background: color-mix(in srgb,var(--gold) 8%,var(--surface2)); }
  .lib-item-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  .lib-item-meta { font-size: 11px; color: var(--muted); }
  .lib-empty   { padding: 32px 20px; text-align: center; color: var(--muted); font-size: 13px; }
  .lib-footer  { display: flex; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .lib-sublabel { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: 4px 2px 2px; }
  .lib-group-item { border-left: 3px solid var(--gc); }
  .lib-group-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .group-tag { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; font-weight: 700; padding: 2px 6px; border-radius: 2px; background: rgba(212,168,71,.15); color: var(--gold); margin-left: 4px; }
  .default-tag { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; font-weight: 700; padding: 2px 6px; border-radius: 2px; background: rgba(74,158,232,.15); color: #5ab0e0; margin-left: 4px; }
  .star-ind { color: var(--gold); font-size: 12px; flex-shrink: 0; }
  .lib-login { display: inline-block; margin-top: 10px; color: var(--gold); font-size: 13px; text-decoration: none; }
  .lib-login:hover { text-decoration: underline; }

  @media (max-width: 640px) {
    .browse-row { flex-direction: column; }
    .qset-grid { grid-template-columns: 1fr; }
  }
</style>
