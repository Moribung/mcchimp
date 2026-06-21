<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { session } from '$lib/stores/session';
  import { goto } from '$app/navigation';
  import { validateQuestionSet } from '$lib/validateQuestionSet';
  import { TIER_SET_LIMITS as TIER_LIMITS, TIER_GROUP_LIMITS as GROUP_LIMITS } from '$lib/tiers';
  import {
    loadLearningSets, addLearningSet, removeLearningSet,
    loadGroups, createGroup, deleteGroup, addToGroup, removeFromGroup, setGroupColor, setGroupStarred,
  } from '$lib/progress.js';

  const GROUP_COLORS = ['#E8C14A', '#4F9CF0', '#3FB98C', '#A77BF0', '#F0894F', '#E86A9E', '#56C2C2', '#D94040'];

  let sets        = $state([]);
  let profile     = $state(null);
  let loading     = $state(true);
  let uploading   = $state(false);
  let error       = $state('');
  let previewOpen = $state({});
  let deleteConfirm = $state(null);

  // Learning sets
  let learningSetIds = $state(new Set());

  // Groups
  let groups          = $state([]);
  let newGroupName    = $state('');
  let newGroupColor   = $state('#E8C14A');
  let groupError      = $state('');
  let creatingGroup   = $state(false);
  let deleteGroupConfirm = $state(null);
  let groupPopover    = $state(null); // setId for which popover is open
  let colorPickerFor  = $state(null); // groupId whose colour swatches are open
  let addSetsFor      = $state(null); // groupId whose "add sets" picker modal is open
  const addSetsGroup  = $derived(addSetsFor ? groups.find(g => g.id === addSetsFor) : null);

  // Group display filter: a Set of 'all' | 'ungrouped' | groupId
  let setFilters = $state(new Set(['all']));
  const showAll  = $derived(setFilters.has('all') || setFilters.size === 0);


  onMount(async () => {
    if (!$session) { goto('/auth/login'); return; }
    await loadData();
  });

  async function loadData() {
    loading = true;
    const [profileRes, setsRes, learnRes, groupRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', $session.user.id).single(),
      supabase.from('user_question_sets').select('*').eq('user_id', $session.user.id).eq('staged', false).order('updated_at', { ascending: false }),
      loadLearningSets($session.user.id),
      loadGroups($session.user.id),
    ]);
    profile        = profileRes.data;
    sets           = (setsRes.data || []).sort(byStarred);
    learningSetIds = new Set(learnRes.map(r => r.set_id));
    groups         = (groupRes || []).sort(byStarred);
    loading        = false;
  }

  function atLimit() {
    if (!profile) return false;
    return sets.length >= (TIER_LIMITS[profile.tier] ?? 3);
  }

  function atGroupLimit() {
    if (!profile) return false;
    return groups.length >= (GROUP_LIMITS[profile.tier] ?? 3);
  }

  function tierCount(data) {
    const t = data?.tiers || {};
    return ['easy','medium','hard','elite'].reduce((s, k) => s + (t[k]?.length || 0), 0);
  }

  // Starred items first (stable otherwise — input is already ordered).
  function byStarred(a, b) { return (b.starred ? 1 : 0) - (a.starred ? 1 : 0); }

  // ── Favourite (star) toggles ──────────────────────────
  async function toggleStarSet(set) {
    const next = !set.starred;
    sets = sets.map(s => s.id === set.id ? { ...s, starred: next } : s).sort(byStarred);
    const { error: e } = await supabase.from('user_question_sets').update({ starred: next }).eq('id', set.id);
    if (e) { error = e.message; sets = sets.map(s => s.id === set.id ? { ...s, starred: !next } : s).sort(byStarred); }
  }

  async function toggleStarGroup(group) {
    const next = !group.starred;
    groups = groups.map(g => g.id === group.id ? { ...g, starred: next } : g).sort(byStarred);
    try { await setGroupStarred(group.id, next); }
    catch (e) { groupError = e.message; groups = groups.map(g => g.id === group.id ? { ...g, starred: !next } : g).sort(byStarred); }
  }

  // ── Group-level "Learn" toggle (all member sets) ──────
  function groupAllLearning(group) {
    const members = group.question_set_group_members || [];
    return members.length > 0 && members.every(m => learningSetIds.has(m.set_id));
  }

  async function toggleGroupLearning(group) {
    const members = group.question_set_group_members || [];
    if (members.length === 0) return;
    const allIn = groupAllLearning(group);
    try {
      if (allIn) {
        for (const m of members) if (learningSetIds.has(m.set_id)) await removeLearningSet($session.user.id, m.set_id);
        const ids = new Set(members.map(m => m.set_id));
        learningSetIds = new Set([...learningSetIds].filter(id => !ids.has(id)));
      } else {
        for (const m of members) if (!learningSetIds.has(m.set_id)) {
          await addLearningSet($session.user.id, m.set_id, m.set_source, m.set_name, m.question_count);
        }
        learningSetIds = new Set([...learningSetIds, ...members.map(m => m.set_id)]);
      }
    } catch (e) { error = e.message; }
  }

  // ── Learning set toggle ───────────────────────────────
  async function toggleLearning(set) {
    const setId = set.id;
    try {
      if (learningSetIds.has(setId)) {
        await removeLearningSet($session.user.id, setId);
        learningSetIds = new Set([...learningSetIds].filter(id => id !== setId));
      } else {
        await addLearningSet($session.user.id, setId, 'library', set.name, set.question_count);
        learningSetIds = new Set([...learningSetIds, setId]);
      }
    } catch (e) {
      error = e.message;
    }
  }

  // ── Groups ────────────────────────────────────────────
  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    if (atGroupLimit()) {
      groupError = `You've reached the group limit for your tier.`;
      return;
    }
    creatingGroup = true;
    groupError    = '';
    try {
      const id = await createGroup($session.user.id, newGroupName.trim(), '', newGroupColor);
      groups = [...groups, { id, user_id: $session.user.id, name: newGroupName.trim(), description: null, color: newGroupColor, created_at: new Date().toISOString(), question_set_group_members: [] }];
      newGroupName = '';
      newGroupColor = '#E8C14A';
    } catch (e) {
      groupError = e.message;
    }
    creatingGroup = false;
  }

  async function changeGroupColor(group, color) {
    const prev = group.color;
    groups = groups.map(g => g.id === group.id ? { ...g, color } : g);
    colorPickerFor = null;
    try {
      await setGroupColor(group.id, color);
    } catch (e) {
      groupError = e.message;
      groups = groups.map(g => g.id === group.id ? { ...g, color: prev } : g);
    }
  }

  async function handleDeleteGroup(groupId) {
    try {
      await deleteGroup(groupId);
      groups = groups.filter(g => g.id !== groupId);
      deleteGroupConfirm = null;
    } catch (e) {
      groupError = e.message;
    }
  }

  function isInGroup(groupId, setId) {
    const g = groups.find(g => g.id === groupId);
    return g?.question_set_group_members?.some(m => m.set_id === setId) ?? false;
  }

  async function toggleGroupMembership(group, set) {
    const inGroup = isInGroup(group.id, set.id);
    try {
      if (inGroup) {
        await removeFromGroup(group.id, set.id);
        groups = groups.map(g => g.id === group.id
          ? { ...g, question_set_group_members: g.question_set_group_members.filter(m => m.set_id !== set.id) }
          : g);
      } else {
        await addToGroup(group.id, $session.user.id, set.id, 'library', set.name, set.question_count);
        const newMember = { group_id: group.id, user_id: $session.user.id, set_id: set.id, set_source: 'library', set_name: set.name, question_count: set.question_count };
        groups = groups.map(g => g.id === group.id
          ? { ...g, question_set_group_members: [...g.question_set_group_members, newMember] }
          : g);
      }
    } catch (e) {
      groupError = e.message;
    }
  }

  function setGroupLabels(setId) {
    return groups
      .filter(g => g.question_set_group_members?.some(m => m.set_id === setId))
      .map(g => ({ name: g.name, color: g.color || '#E8C14A' }));
  }

  // ── Group display filter ──────────────────────────────
  function toggleFilter(key) {
    if (key === 'all') { setFilters = new Set(['all']); return; }
    const next = new Set(setFilters);
    next.delete('all');
    if (next.has(key)) next.delete(key); else next.add(key);
    if (next.size === 0) next.add('all');
    setFilters = next;
  }

  function setsInGroup(group) {
    const ids = new Set((group.question_set_group_members || []).map(m => m.set_id));
    return sets.filter(s => ids.has(s.id));
  }

  function ungroupedSets() {
    const grouped = new Set();
    for (const g of groups) for (const m of (g.question_set_group_members || [])) grouped.add(m.set_id);
    return sets.filter(s => !grouped.has(s.id));
  }

  // Sections shown inside the "Add sets" picker: Ungrouped, All, then groups A–Z.
  function pickerSections() {
    const out = [
      { key: 'ungrouped', title: 'Ungrouped', color: '#6B6B6B', sets: ungroupedSets() },
      { key: 'all',       title: 'All Sets',  color: '#6B6B6B', sets },
    ];
    const sorted = [...groups].sort((a, b) => a.name.localeCompare(b.name));
    for (const g of sorted) {
      out.push({ key: g.id, title: g.name, color: g.color || '#E8C14A', sets: setsInGroup(g) });
    }
    return out;
  }

  // Sections rendered when not showing all — groups (in order) then ungrouped.
  // A set in several selected groups intentionally appears under each.
  const filterSections = $derived.by(() => {
    if (showAll) return [];
    const out = [];
    for (const g of groups) {
      if (setFilters.has(g.id)) out.push({ key: g.id, title: g.name, color: g.color || '#E8C14A', sets: setsInGroup(g) });
    }
    if (setFilters.has('ungrouped')) out.push({ key: 'ungrouped', title: 'Ungrouped Sets', color: '#6B6B6B', sets: ungroupedSets() });
    return out;
  });

  // ── Upload / delete / edit (unchanged) ───────────────
  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) { error = 'Only .json files are supported.'; return; }

    if (atLimit()) {
      error = `You've reached your limit of ${TIER_LIMITS[profile.tier]} question sets. Upgrade your plan for more.`;
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        const issues = validateQuestionSet(data);
        if (issues.length) { error = issues[0]; uploading = false; return; }

        uploading = true; error = '';
        const count = tierCount(data);

        const { error: insertError } = await supabase.from('user_question_sets').insert({
          user_id: $session.user.id, name: data.name,
          description: data.description || null, data, question_count: count, is_public: false
        });

        uploading = false;
        if (insertError) { error = insertError.message; } else { await loadData(); }
      } catch(err) {
        uploading = false; error = 'Could not parse JSON: ' + err.message;
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function deleteSet(id) {
    const { error: delError } = await supabase.from('user_question_sets').delete().eq('id', id);
    if (delError) { error = delError.message; return; }
    deleteConfirm = null;
    await loadData();
  }

  function downloadSet(set) {
    const blob = new Blob([JSON.stringify(set.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = set.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.json';
    a.click(); URL.revokeObjectURL(url);
  }

  function editInGenerator(set) {
    sessionStorage.setItem('mcchimp_gen_load', JSON.stringify({ libraryId: set.id, data: set.data }));
    goto('/questions/generator');
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>My Library — Questions — McChimp</title>
</svelte:head>

<div class="library-wrap">

  {#if loading}
    <p class="lib-loading">Loading your library…</p>
  {:else}

    <!-- HEADER -->
    <div class="lib-header">
      <div>
        <div class="lib-count">
          {sets.length} / {TIER_LIMITS[profile?.tier] ?? 3} sets
          <span class="tier-badge tier-{profile?.tier}">{profile?.tier || 'regular'}</span>
        </div>
        {#if profile?.tier === 'regular'}
          <p class="lib-upgrade"><a href="/account" class="upgrade-link">Upgrade your plan</a> for more sets and the ability to make sets public.</p>
        {/if}
      </div>
      <div class="header-actions">
        <a href="/learn" class="btn-learn-link">Learning Progress</a>
        <label class="btn-upload" class:disabled={atLimit() || uploading}>
          {uploading ? 'Uploading…' : '⬆ Upload JSON'}
          <input type="file" accept=".json" onchange={handleFileUpload} style="display:none;" disabled={atLimit() || uploading}>
        </label>
      </div>
    </div>

    {#if error}
      <div class="lib-error">{error}</div>
    {/if}

    <!-- GROUPS (rendered below the sets) -->
    {#snippet groupsSection()}
    <div class="groups-section">
      <div class="groups-header">
        <span class="groups-title">Groups</span>
        <span class="groups-sub">{groups.length} / {GROUP_LIMITS[profile?.tier] ?? 3}</span>
      </div>

      {#if groupError}
        <div class="lib-error" style="margin-bottom:12px">{groupError}</div>
      {/if}

      {#if groups.length > 0}
        <div class="groups-list">
          {#each groups as group}
            <div class="group-card" style="--gc:{group.color || '#E8C14A'}">
              <div class="group-card-top">
                <button
                  class="group-color-dot"
                  style="background:{group.color || '#E8C14A'}"
                  onclick={() => colorPickerFor = colorPickerFor === group.id ? null : group.id}
                  title="Change group colour"
                  aria-label="Change group colour"
                ></button>
                <span class="group-name">{group.name}</span>
                <span class="group-count">{group.question_set_group_members?.length ?? 0} sets</span>
                <button class="btn-star" class:active={group.starred}
                  onclick={() => toggleStarGroup(group)}
                  title={group.starred ? 'Unfavourite group' : 'Favourite group'}
                  aria-label="Favourite group">{group.starred ? '★' : '☆'}</button>
                {#if deleteGroupConfirm === group.id}
                  <div class="delete-inline">
                    <span class="delete-q">Delete?</span>
                    <button class="btn-confirm-delete" onclick={() => handleDeleteGroup(group.id)}>Yes</button>
                    <button class="btn-cancel" onclick={() => deleteGroupConfirm = null}>No</button>
                  </div>
                {:else}
                  <button class="btn-icon-delete" onclick={() => deleteGroupConfirm = group.id} title="Delete group">×</button>
                {/if}
              </div>
              {#if colorPickerFor === group.id}
                <div class="color-swatches">
                  {#each GROUP_COLORS as c}
                    <button
                      class="swatch"
                      class:selected={(group.color || '#E8C14A') === c}
                      style="background:{c}"
                      onclick={() => changeGroupColor(group, c)}
                      aria-label="Set colour {c}"
                    ></button>
                  {/each}
                </div>
              {/if}
              {#if group.question_set_group_members?.length > 0}
                <div class="group-members">
                  {#each group.question_set_group_members as m}
                    <span class="member-chip">{m.set_name}</span>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- New group form -->
      {#if !atGroupLimit()}
        <form class="new-group-form" onsubmit={(e) => { e.preventDefault(); handleCreateGroup(); }}>
          <input
            class="group-input"
            type="text"
            placeholder="New group name…"
            bind:value={newGroupName}
            maxlength="60"
          >
          <div class="color-swatches inline">
            {#each GROUP_COLORS as c}
              <button
                type="button"
                class="swatch"
                class:selected={newGroupColor === c}
                style="background:{c}"
                onclick={() => newGroupColor = c}
                aria-label="Choose colour {c}"
              ></button>
            {/each}
          </div>
          <button class="btn-create-group" type="submit" disabled={creatingGroup || !newGroupName.trim()}>
            {creatingGroup ? '…' : '+ Create'}
          </button>
        </form>
      {:else}
        <p class="lib-upgrade">Group limit reached. <a href="/account" class="upgrade-link">Upgrade your plan</a> for more.</p>
      {/if}
    </div>
    {/snippet}

    <!-- SET CARD (reusable snippet) -->
    {#snippet setCard(set)}
          <div class="set-card">
            <div class="set-card-top">
              <div class="set-name">{set.name}</div>
              <div class="set-top-actions">
                <!-- Favourite -->
                <button
                  class="btn-star"
                  class:active={set.starred}
                  onclick={() => toggleStarSet(set)}
                  title={set.starred ? 'Unfavourite set' : 'Favourite set'}
                  aria-label="Favourite set"
                >{set.starred ? '★' : '☆'}</button>
                <!-- Learning toggle -->
                <button
                  class="btn-learn-toggle"
                  class:active={learningSetIds.has(set.id)}
                  onclick={() => toggleLearning(set)}
                  title={learningSetIds.has(set.id) ? 'Remove from your learning plan' : 'Add to your learning plan'}
                >
                  {#if learningSetIds.has(set.id)}
                    <span class="lt-icon">&#127891;</span> Learning
                  {:else}
                    <span class="lt-icon">&#43;</span> Learn
                  {/if}
                </button>
                <!-- Groups popover trigger -->
                {#if groups.length > 0}
                  <button
                    class="btn-group-tag"
                    onclick={() => groupPopover = groupPopover === set.id ? null : set.id}
                    title="Assign to groups"
                  >⊞</button>
                {/if}
                <span class="set-count">{set.question_count} q</span>
              </div>
            </div>

            <!-- Group chips -->
            {#if setGroupLabels(set.id).length > 0}
              <div class="set-group-chips">
                {#each setGroupLabels(set.id) as label}
                  <span class="group-chip" style="--chip:{label.color}">{label.name}</span>
                {/each}
              </div>
            {/if}

            <!-- Group assignment popover -->
            {#if groupPopover === set.id}
              <div class="group-popover">
                <div class="popover-title">Assign to groups</div>
                {#each groups as group}
                  <label class="popover-row">
                    <input
                      type="checkbox"
                      checked={isInGroup(group.id, set.id)}
                      onchange={() => toggleGroupMembership(group, set)}
                    >
                    <span>{group.name}</span>
                  </label>
                {/each}
                <button class="popover-close" onclick={() => groupPopover = null}>Done</button>
              </div>
            {/if}

            {#if set.description}<p class="set-desc">{set.description}</p>{/if}
            <div class="set-meta">
              <span>Uploaded {formatDate(set.created_at)}</span>
              {#if set.is_public}<span class="pub-badge">Public</span>{/if}
            </div>
            <div class="set-actions">
              <button class="btn-dl" onclick={() => downloadSet(set)}>&#11015; Download</button>
              <button class="btn-edit" onclick={() => editInGenerator(set)}>Edit</button>
              <button class="btn-delete" onclick={() => deleteConfirm = set.id}>Delete</button>
            </div>

            {#if deleteConfirm === set.id}
              <div class="delete-confirm">
                <p>Delete <strong>{set.name}</strong>? This cannot be undone.</p>
                <div class="delete-actions">
                  <button class="btn-confirm-delete" onclick={() => deleteSet(set.id)}>Yes, Delete</button>
                  <button class="btn-cancel" onclick={() => deleteConfirm = null}>Cancel</button>
                </div>
              </div>
            {/if}
          </div>
    {/snippet}

    <!-- SETS -->
    {#if sets.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <div class="empty-title">No sets yet</div>
        <p class="empty-desc">Upload a JSON question set to store it here. You can then use it in any McChimp game.</p>
      </div>
    {:else}
      <!-- Group filter bar -->
      {#if groups.length > 0}
        <div class="filter-bar">
          <button class="filter-chip" class:active={showAll} onclick={() => toggleFilter('all')}>All Sets</button>
          <button class="filter-chip" class:active={setFilters.has('ungrouped')} onclick={() => toggleFilter('ungrouped')}>Ungrouped</button>
          <span class="filter-divider"></span>
          {#each groups as g}
            <button
              class="filter-chip"
              class:active={setFilters.has(g.id)}
              style="--chip:{g.color || '#E8C14A'}"
              onclick={() => toggleFilter(g.id)}
            >
              <span class="filter-dot" style="background:{g.color || '#E8C14A'}"></span>{g.name}
            </button>
          {/each}
        </div>
      {/if}

      {#if showAll}
        <div class="sets-grid">
          {#each sets as set (set.id)}
            {@render setCard(set)}
          {/each}
        </div>
      {:else}
        {#each filterSections as section (section.key)}
          {@const grp = section.key !== 'ungrouped' ? groups.find(g => g.id === section.key) : null}
          <div class="set-section">
            <div class="set-section-head" style="--chip:{section.color}">
              <span class="filter-dot" style="background:{section.color}"></span>
              <h2 class="set-section-title">{section.title}</h2>
              <span class="set-section-count">{section.sets.length} set{section.sets.length !== 1 ? 's' : ''}</span>
              {#if grp}
                <button class="btn-add-sets" onclick={() => addSetsFor = grp.id} title="Add sets to this group">+ Add sets</button>
                <button class="btn-add-sets btn-learn-pill" class:active={groupAllLearning(grp)}
                  onclick={() => toggleGroupLearning(grp)}
                  title="Mark every set in this group as learning material">
                  {groupAllLearning(grp) ? '🎓 Learning' : '+ Learn'}
                </button>
                <button class="btn-star" class:active={grp.starred}
                  onclick={() => toggleStarGroup(grp)}
                  title={grp.starred ? 'Unfavourite group' : 'Favourite group'}
                  aria-label="Favourite group">{grp.starred ? '★' : '☆'}</button>
              {/if}
            </div>
            {#if section.sets.length === 0}
              <p class="set-section-empty">No sets here yet.</p>
            {:else}
              <div class="sets-grid">
                {#each section.sets as set (section.key + '_' + set.id)}
                  {@render setCard(set)}
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    {/if}

    <!-- GROUPS section, below the set cards -->
    {@render groupsSection()}

  {/if}

  <!-- ADD-SETS PICKER -->
  {#if addSetsFor && addSetsGroup}
    <div class="picker-overlay" role="dialog" aria-modal="true" tabindex="-1"
      onclick={() => addSetsFor = null}
      onkeydown={(e) => e.key === 'Escape' && (addSetsFor = null)}>
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="picker-modal" role="document"
        onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
        <div class="picker-head" style="--gc:{addSetsGroup.color || '#E8C14A'}">
          <div class="picker-title">
            <span class="filter-dot" style="background:{addSetsGroup.color || '#E8C14A'}"></span>
            Add sets to <strong>{addSetsGroup.name}</strong>
          </div>
          <button class="picker-close" onclick={() => addSetsFor = null} aria-label="Close">&#10005;</button>
        </div>
        <div class="picker-body">
          {#each pickerSections() as section (section.key)}
            <div class="picker-section">
              <div class="picker-section-label">
                <span class="filter-dot" style="background:{section.color}"></span>{section.title}
                <span class="picker-section-count">{section.sets.length}</span>
              </div>
              {#if section.sets.length === 0}
                <p class="picker-empty">None.</p>
              {:else}
                {#each section.sets as set (section.key + '_' + set.id)}
                  <label class="picker-row">
                    <input
                      type="checkbox"
                      checked={isInGroup(addSetsFor, set.id)}
                      onchange={() => toggleGroupMembership(addSetsGroup, set)}
                    >
                    <span class="picker-row-name">{set.name}</span>
                    <span class="picker-row-meta">{set.question_count} q</span>
                  </label>
                {/each}
              {/if}
            </div>
          {/each}
        </div>
        <div class="picker-footer">
          <button class="btn-create-group" onclick={() => addSetsFor = null}>Done</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .library-wrap { padding: 48px; }
  .lib-loading { color: var(--muted); font-size: 14px; }
  .lib-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
  .lib-count {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px; font-weight: 700; letter-spacing: .08em;
    text-transform: uppercase; color: var(--white);
    display: flex; align-items: center; gap: 10px; margin-bottom: 6px;
  }
  .tier-badge {
    font-size: 10px; padding: 2px 8px; border-radius: 2px;
    font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  }
  .tier-regular { background: rgba(107,107,107,0.15); color: var(--muted); border: 1px solid rgba(107,107,107,0.2); }
  .tier-pro { background: rgba(232,193,74,0.12); color: var(--gold); border: 1px solid rgba(232,193,74,0.3); }
  .tier-dev { background: rgba(180,74,232,0.12); color: #C07AEA; border: 1px solid rgba(180,74,232,0.3); }
  .lib-upgrade { font-size: 12px; color: var(--muted); max-width: 360px; }
  .upgrade-link { color: var(--gold); text-decoration: none; }
  .upgrade-link:hover { text-decoration: underline; }
  .lib-error { background: rgba(217,64,64,0.08); border: 1px solid rgba(217,64,64,0.3); border-radius: 3px; padding: 12px 16px; font-size: 13px; color: #E88A8A; margin-bottom: 20px; }

  .header-actions { display: flex; gap: 12px; align-items: center; flex-shrink: 0; flex-wrap: wrap; }
  .btn-learn-link {
    font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase; color: var(--gold);
    border: 1px solid rgba(232,193,74,0.3); padding: 10px 18px; border-radius: 3px;
    text-decoration: none; transition: border-color .15s;
  }
  .btn-learn-link:hover { border-color: var(--gold); }

  .btn-upload {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    background: var(--gold); color: var(--black); border: none;
    padding: 11px 22px; border-radius: 3px; cursor: pointer;
    transition: background .15s; white-space: nowrap; display: inline-block;
  }
  .btn-upload:hover:not(.disabled) { background: var(--gold2); }
  .btn-upload.disabled { opacity: .4; cursor: not-allowed; }

  /* ── Groups ─────────────────────────────────────────── */
  .groups-section { margin-bottom: 36px; max-width: 1100px; }
  .groups-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .groups-title {
    font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase; color: var(--white);
  }
  .groups-sub { font-size: 12px; color: var(--muted); }
  .groups-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .group-card {
    --gc: #E8C14A;
    background: var(--surface); border: 1px solid rgba(255,255,255,0.06);
    border-left: 3px solid var(--gc);
    border-radius: 3px; padding: 14px 16px; min-width: 200px; max-width: 320px;
  }
  .group-card-top { display: flex; align-items: center; gap: 10px; }
  .group-color-dot {
    width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.25); cursor: pointer; padding: 0;
    transition: transform .12s;
  }
  .group-color-dot:hover { transform: scale(1.15); }
  .group-name { font-size: 14px; font-weight: 600; color: var(--white); flex: 1; }
  .group-count { font-size: 11px; color: var(--muted); }
  .btn-add-sets {
    font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700;
    letter-spacing: .08em; text-transform: uppercase;
    background: transparent; color: var(--gold); border: 1px solid rgba(232,193,74,0.3);
    padding: 4px 9px; border-radius: 999px; cursor: pointer; transition: all .15s; white-space: nowrap;
  }
  .btn-add-sets:hover { border-color: var(--gold); background: rgba(232,193,74,0.1); }
  .btn-icon-delete { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 18px; line-height: 1; padding: 0 2px; }
  .btn-icon-delete:hover { color: var(--red); }

  /* ── Add-sets picker modal ───────────────────────────── */
  .picker-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
  .picker-modal { background: var(--off); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; width: 100%; max-width: 480px; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
  .picker-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); border-top: 3px solid var(--gc); }
  .picker-title { display: flex; align-items: center; gap: 8px; font-size: 15px; color: var(--white); }
  .picker-title strong { color: var(--white); }
  .picker-close { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 16px; padding: 2px 6px; transition: color .15s; }
  .picker-close:hover { color: var(--white); }
  .picker-body { overflow-y: auto; padding: 8px 12px 12px; }
  .picker-section { margin-top: 12px; }
  .picker-section-label { display: flex; align-items: center; gap: 7px; font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); padding: 4px 8px; }
  .picker-section-count { margin-left: auto; color: rgba(107,107,107,0.8); }
  .picker-empty { font-size: 12px; color: var(--muted); padding: 2px 8px 6px; }
  .picker-row { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 3px; cursor: pointer; transition: background .12s; }
  .picker-row:hover { background: var(--surface); }
  .picker-row input { accent-color: var(--gold); cursor: pointer; flex-shrink: 0; }
  .picker-row-name { font-size: 13px; color: var(--white); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .picker-row-meta { font-size: 11px; color: var(--muted); flex-shrink: 0; }
  .picker-footer { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: flex-end; }
  .delete-inline { display: flex; align-items: center; gap: 6px; }
  .delete-q { font-size: 12px; color: #E88A8A; }
  .group-members { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .member-chip {
    font-size: 11px;
    background: color-mix(in srgb, var(--gc) 10%, transparent);
    color: var(--gc);
    border: 1px solid color-mix(in srgb, var(--gc) 30%, transparent);
    border-radius: 2px; padding: 2px 7px;
  }

  /* ── Colour swatches ─────────────────────────────────── */
  .color-swatches { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .color-swatches.inline { margin-top: 0; }
  .swatch {
    width: 18px; height: 18px; border-radius: 50%; cursor: pointer; padding: 0;
    border: 2px solid transparent; transition: transform .12s;
  }
  .swatch:hover { transform: scale(1.15); }
  .swatch.selected { border-color: var(--white); box-shadow: 0 0 0 1px rgba(0,0,0,0.5); }

  .new-group-form { display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
  .group-input {
    flex: 1; max-width: 260px; background: var(--surface); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 3px; padding: 9px 12px; color: var(--white); font-size: 13px;
  }
  .group-input:focus { outline: none; border-color: rgba(232,193,74,0.4); }
  .group-input::placeholder { color: var(--muted); }
  .btn-create-group {
    font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700;
    letter-spacing: .08em; text-transform: uppercase;
    background: transparent; color: var(--gold); border: 1px solid rgba(232,193,74,0.3);
    padding: 9px 16px; border-radius: 3px; cursor: pointer; transition: all .15s;
  }
  .btn-create-group:hover:not(:disabled) { border-color: var(--gold); }
  .btn-create-group:disabled { opacity: .4; cursor: not-allowed; }

  /* ── Group filter bar ────────────────────────────────── */
  .filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 24px; max-width: 1100px; }
  .filter-chip {
    --chip: #6B6B6B;
    display: inline-flex; align-items: center; gap: 6px;
    font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700;
    letter-spacing: .08em; text-transform: uppercase;
    background: transparent; color: var(--muted);
    border: 1px solid rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 999px;
    cursor: pointer; transition: all .15s;
  }
  .filter-chip:hover { color: var(--white); border-color: rgba(255,255,255,0.3); }
  .filter-chip.active {
    color: var(--chip);
    border-color: color-mix(in srgb, var(--chip) 55%, transparent);
    background: color-mix(in srgb, var(--chip) 12%, transparent);
  }
  .filter-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .filter-divider { width: 1px; height: 18px; background: rgba(255,255,255,0.12); margin: 0 2px; }

  /* ── Set sections (filtered view) ────────────────────── */
  .set-section { margin-bottom: 32px; max-width: 1100px; }
  .set-section-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid color-mix(in srgb, var(--chip) 30%, rgba(255,255,255,0.06)); }
  .set-section-head .btn-star { margin-left: auto; }
  .btn-learn-pill {
    color: #6FCF97 !important; border-color: rgba(46,139,87,0.4) !important;
  }
  .btn-learn-pill:hover { background: rgba(46,139,87,0.12) !important; border-color: #6FCF97 !important; }
  .btn-learn-pill.active { background: #2E8B57 !important; color: #fff !important; border-color: #2E8B57 !important; }
  .btn-star {
    background: none; border: none; cursor: pointer; font-size: 16px; line-height: 1;
    color: var(--muted); padding: 2px 4px; transition: color .15s; flex-shrink: 0;
  }
  .btn-star:hover { color: var(--gold); }
  .btn-star.active { color: var(--gold); }
  .set-section-title { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: .03em; color: var(--white); margin: 0; }
  .set-section-count { font-size: 12px; color: var(--muted); }
  .set-section-empty { font-size: 13px; color: var(--muted); padding: 8px 0; }

  /* ── Set card ────────────────────────────────────────── */
  .empty-state { background: var(--surface); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 48px; text-align: center; }
  .empty-icon { font-size: 36px; margin-bottom: 16px; }
  .empty-title { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: .04em; color: var(--white); margin-bottom: 8px; }
  .empty-desc { font-size: 14px; color: var(--muted); line-height: 1.6; max-width: 400px; margin: 0 auto; }

  .sets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2px; max-width: 1100px; }
  .set-card {
    background: var(--surface); border: 1px solid rgba(255,255,255,0.04);
    padding: 28px; display: flex; flex-direction: column; gap: 8px; position: relative;
    transition: transform .15s, box-shadow .15s;
  }
  .set-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.35); }
  .set-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .set-name { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: .04em; color: var(--white); line-height: 1.1; }
  .set-top-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; padding-top: 4px; }
  .set-count { font-size: 12px; color: var(--muted); white-space: nowrap; }

  .btn-learn-toggle {
    display: inline-flex; align-items: center; gap: 5px;
    font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700;
    letter-spacing: .08em; text-transform: uppercase;
    background: transparent; color: #6FCF97;
    border: 1px solid rgba(46,139,87,0.4); padding: 5px 10px; border-radius: 999px;
    cursor: pointer; transition: all .15s; white-space: nowrap;
  }
  .btn-learn-toggle:hover { background: rgba(46,139,87,0.12); border-color: #6FCF97; }
  .btn-learn-toggle.active { background: #2E8B57; color: #fff; border-color: #2E8B57; }
  .btn-learn-toggle.active:hover { background: #267349; }
  .lt-icon { font-size: 12px; line-height: 1; }

  .btn-group-tag {
    background: none; border: none; cursor: pointer; font-size: 15px; line-height: 1;
    color: var(--muted); padding: 2px; transition: color .15s;
  }
  .btn-group-tag:hover { color: var(--white); }

  .set-group-chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .group-chip {
    --chip: #E8C14A;
    font-size: 10px;
    background: color-mix(in srgb, var(--chip) 12%, transparent);
    color: var(--chip);
    border: 1px solid color-mix(in srgb, var(--chip) 28%, transparent);
    border-radius: 2px; padding: 2px 6px;
    font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: .06em;
  }

  .group-popover {
    background: var(--off); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px; padding: 14px; display: flex; flex-direction: column; gap: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  .popover-title { font-size: 11px; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .popover-row { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: var(--white); }
  .popover-row input { accent-color: var(--gold); cursor: pointer; }
  .popover-close { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: transparent; color: var(--muted); border: 1px solid rgba(255,255,255,0.1); padding: 6px 14px; border-radius: 2px; cursor: pointer; margin-top: 4px; transition: color .15s; align-self: flex-start; }
  .popover-close:hover { color: var(--white); }

  .set-desc { font-size: 13px; color: rgba(242,239,232,0.45); line-height: 1.5; }
  .set-meta { font-size: 11px; color: var(--muted); display: flex; gap: 12px; align-items: center; }
  .pub-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: rgba(46,139,87,0.12); color: #4CAF85; border: 1px solid rgba(46,139,87,0.25); padding: 2px 6px; border-radius: 2px; }
  .set-actions { display: flex; gap: 8px; margin-top: 4px; }
  .btn-dl { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: var(--gold); color: var(--black); border: none; padding: 8px 14px; border-radius: 2px; cursor: pointer; transition: background .15s; }
  .btn-dl:hover { background: var(--gold2); }
  .btn-edit { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: transparent; color: var(--muted); border: 1px solid rgba(255,255,255,0.08); padding: 8px 14px; border-radius: 2px; cursor: pointer; transition: all .15s; }
  .btn-edit:hover { color: var(--white); border-color: rgba(255,255,255,0.3); }
  .btn-delete { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: transparent; color: var(--muted); border: 1px solid rgba(255,255,255,0.08); padding: 8px 14px; border-radius: 2px; cursor: pointer; transition: all .15s; }
  .btn-delete:hover { color: #D94040; border-color: rgba(217,64,64,0.3); }
  .delete-confirm { background: rgba(217,64,64,0.06); border: 1px solid rgba(217,64,64,0.2); border-radius: 3px; padding: 14px; margin-top: 8px; }
  .delete-confirm p { font-size: 13px; color: var(--muted); margin-bottom: 10px; }
  .delete-confirm strong { color: var(--white); }
  .delete-actions { display: flex; gap: 8px; }
  .btn-confirm-delete { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: rgba(217,64,64,0.12); color: #D94040; border: 1px solid rgba(217,64,64,0.3); padding: 7px 14px; border-radius: 2px; cursor: pointer; transition: all .15s; }
  .btn-confirm-delete:hover { background: rgba(217,64,64,0.2); }
  .btn-cancel { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: transparent; color: var(--muted); border: 1px solid rgba(255,255,255,0.08); padding: 7px 12px; border-radius: 2px; cursor: pointer; transition: color .15s; }
  .btn-cancel:hover { color: var(--white); }

  @media (max-width: 900px) { .library-wrap { padding: 32px 24px; } }
</style>
