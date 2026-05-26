<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { session } from '$lib/stores/session';
  import { goto } from '$app/navigation';
  import { validateQuestionSet } from '$lib/validateQuestionSet';

  let sets = $state([]);
  let profile = $state(null);
  let loading = $state(true);
  let uploading = $state(false);
  let error = $state('');
  let previewOpen = $state({});
  let deleteConfirm = $state(null);

  const TIER_LIMITS = { regular: 3, pro: 20, dev: 9999 };

  onMount(async () => {
    if (!$session) {
      goto('/auth/login');
      return;
    }
    await loadData();
  });

  async function loadData() {
    loading = true;
    const [profileRes, setsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', $session.user.id).single(),
      supabase.from('user_question_sets').select('*').eq('user_id', $session.user.id).order('updated_at', { ascending: false })
    ]);
    profile = profileRes.data;
    sets = setsRes.data || [];
    loading = false;
  }

  function atLimit() {
    if (!profile) return false;
    const limit = TIER_LIMITS[profile.tier] ?? 3;
    return sets.length >= limit;
  }

  function tierCount(data) {
    const t = data?.tiers || {};
    return ['easy','medium','hard','elite'].reduce((s, k) => s + (t[k]?.length || 0), 0);
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) { error = 'Only .json files are supported.'; return; }

    if (atLimit()) {
      error = `You've reached your limit of ${TIER_LIMITS[profile.tier]} question sets. Upgrade to Pro for more.`;
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);

        // Full v2 validation
        const issues = validateQuestionSet(data);
        if (issues.length) { error = issues[0]; uploading = false; return; }

        uploading = true;
        error = '';
        const count = tierCount(data);

        const { error: insertError } = await supabase.from('user_question_sets').insert({
          user_id: $session.user.id,
          name: data.name,
          description: data.description || null,
          data,
          question_count: count,
          is_public: false
        });

        uploading = false;
        if (insertError) {
          error = insertError.message;
        } else {
          await loadData();
        }
      } catch(err) {
        uploading = false;
        error = 'Could not parse JSON: ' + err.message;
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
    a.href = url;
    a.download = set.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function editInGenerator(set) {
    // Store the set data in sessionStorage so the generator can pick it up
    sessionStorage.setItem('mcchimp_gen_load', JSON.stringify({
      libraryId: set.id,
      data: set.data
    }));
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
          <p class="lib-upgrade">Upgrade to Pro for up to 20 sets and the ability to make sets public.</p>
        {/if}
      </div>
      <label class="btn-upload" class:disabled={atLimit() || uploading}>
        {uploading ? 'Uploading…' : '⬆ Upload JSON'}
        <input type="file" accept=".json" onchange={handleFileUpload} style="display:none;" disabled={atLimit() || uploading}>
      </label>
    </div>

    {#if error}
      <div class="lib-error">{error}</div>
    {/if}

    <!-- SETS -->
    {#if sets.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <div class="empty-title">No sets yet</div>
        <p class="empty-desc">Upload a JSON question set to store it here. You can then use it in any McChimp game.</p>
      </div>
    {:else}
      <div class="sets-grid">
        {#each sets as set}
          <div class="set-card">
            <div class="set-card-top">
              <div class="set-name">{set.name}</div>
              <span class="set-count">{set.question_count} q</span>
            </div>
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
        {/each}
      </div>
    {/if}

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
  .lib-error { background: rgba(217,64,64,0.08); border: 1px solid rgba(217,64,64,0.3); border-radius: 3px; padding: 12px 16px; font-size: 13px; color: #E88A8A; margin-bottom: 20px; }

  .btn-upload {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    background: var(--gold); color: var(--black); border: none;
    padding: 11px 22px; border-radius: 3px; cursor: pointer;
    transition: background .15s; white-space: nowrap; flex-shrink: 0; display: inline-block;
  }
  .btn-upload:hover:not(.disabled) { background: var(--gold2); }
  .btn-upload.disabled { opacity: .4; cursor: not-allowed; }

  .empty-state { background: var(--surface); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 48px; text-align: center; }
  .empty-icon { font-size: 36px; margin-bottom: 16px; }
  .empty-title { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: .04em; color: var(--white); margin-bottom: 8px; }
  .empty-desc { font-size: 14px; color: var(--muted); line-height: 1.6; max-width: 400px; margin: 0 auto; }

  .sets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2px; max-width: 1100px; }
  .set-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.04); padding: 28px; display: flex; flex-direction: column; gap: 8px; }
  .set-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .set-name { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: .04em; color: var(--white); line-height: 1.1; }
  .set-count { font-size: 12px; color: var(--muted); white-space: nowrap; padding-top: 4px; }
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
