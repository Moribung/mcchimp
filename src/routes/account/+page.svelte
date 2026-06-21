<script>
  import { supabase } from '$lib/supabase';
  import { session } from '$lib/stores/session';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { PUBLIC_SUPABASE_URL } from '$env/static/public';
  import { TIER_LABELS, PAID_PLANS, PLAN_RANK, ownsPlan } from '$lib/tiers';

  let profile = $state(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let success = $state('');

  // Edit states
  let editingName = $state(false);
  let newDisplayName = $state('');

  // Password change
  let changingPassword = $state(false);
  let newPassword = $state('');
  let confirmPassword = $state('');
  let passwordError = $state('');
  let passwordSuccess = $state(false);

  // Delete account
  let showDeleteModal = $state(false);
  let deleteConfirm = $state('');
  let deleting = $state(false);

  onMount(async () => {
    if (!$session) {
      goto('/auth/login');
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', $session.user.id)
      .single();

    if (fetchError) {
      error = fetchError.message;
    } else {
      profile = data;
      newDisplayName = data.display_name;
    }
    loading = false;
  });

  async function saveDisplayName() {
    saving = true;
    error = '';
    success = '';
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: newDisplayName })
      .eq('id', $session.user.id);

    if (updateError) {
      error = updateError.message;
    } else {
      profile = { ...profile, display_name: newDisplayName };
      success = 'Display name updated.';
      editingName = false;
    }
    saving = false;
  }

  async function savePassword() {
    passwordError = '';
    passwordSuccess = false;
    if (!newPassword) { passwordError = 'Please enter a new password.'; return; }
    if (newPassword.length < 8) { passwordError = 'Password must be at least 8 characters.'; return; }
    if (newPassword !== confirmPassword) { passwordError = 'Passwords do not match.'; return; }

    saving = true;
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    saving = false;

    if (updateError) {
      passwordError = updateError.message;
    } else {
      passwordSuccess = true;
      newPassword = '';
      confirmPassword = '';
      changingPassword = false;
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    goto('/');
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE') return;
    deleting = true;

    const { data: { session: currentSession } } = await supabase.auth.getSession();

    const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentSession.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await res.json();

    if (result.success) {
      await supabase.auth.signOut();
      goto('/');
    } else {
      deleting = false;
      error = result.error || 'Could not delete account. Please contact support.';
      showDeleteModal = false;
    }
  }

  async function downloadData() {
    const { data: saves } = await supabase
      .from('career_saves')
      .select('*')
      .eq('user_id', $session.user.id);

    const { data: history } = await supabase
      .from('career_history')
      .select('*')
      .eq('user_id', $session.user.id);

    const { data: progress } = await supabase
      .from('question_progress')
      .select('*')
      .eq('user_id', $session.user.id);

    const { data: srState } = await supabase
      .from('question_sr_state')
      .select('*')
      .eq('user_id', $session.user.id);

    const { data: answerLog } = await supabase
      .from('question_answer_log')
      .select('*')
      .eq('user_id', $session.user.id);

    const { data: learningSets } = await supabase
      .from('user_learning_sets')
      .select('*')
      .eq('user_id', $session.user.id);

    const blob = new Blob([JSON.stringify({
      profile,
      career_saves: saves,
      career_history: history,
      question_progress: progress,
      question_sr_state: srState,
      question_answer_log: answerLog,
      user_learning_sets: learningSets,
      exported_at: new Date().toISOString()
    }, null, 2)], { type: 'application/json' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mcchimp_data.json';
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<svelte:head>
  <title>Account — McChimp</title>
</svelte:head>

<div class="account-wrap">
  <div class="account-inner">

    <div class="page-eyebrow">Your Account</div>
    <h1 class="page-title">
      {#if loading}Settings{:else}{profile?.display_name || 'Settings'}{/if}
    </h1>

    {#if loading}
      <div class="loading">Loading your profile…</div>
    {:else}

      {#if error}
        <div class="alert alert-error">{error}</div>
      {/if}
      {#if success}
        <div class="alert alert-success">{success}</div>
      {/if}

      <!-- PROFILE -->
      <div class="section">
        <div class="section-label">Profile</div>

        <div class="field-row">
          <div class="field-info">
            <div class="field-name">Display Name</div>
            {#if !editingName}
              <div class="field-value">{profile?.display_name}</div>
            {:else}
              <input class="inline-input" bind:value={newDisplayName} maxlength="32" />
            {/if}
          </div>
          {#if !editingName}
            <button class="btn-secondary" onclick={() => editingName = true}>Edit</button>
          {:else}
            <div class="btn-group">
              <button class="btn-primary" onclick={saveDisplayName} disabled={saving}>Save</button>
              <button class="btn-ghost" onclick={() => { editingName = false; newDisplayName = profile.display_name; }}>Cancel</button>
            </div>
          {/if}
        </div>

        <div class="field-row">
          <div class="field-info">
            <div class="field-name">Email</div>
            <div class="field-value">{$session?.user?.email}</div>
          </div>
        </div>
      </div>

      <!-- PASSWORD -->
      <div class="section">
        <div class="section-label">Security</div>

        {#if !changingPassword}
          <div class="field-row">
            <div class="field-info">
              <div class="field-name">Password</div>
              <div class="field-value">••••••••</div>
            </div>
            <button class="btn-secondary" onclick={() => changingPassword = true}>Change</button>
          </div>
        {:else}
          <div class="password-form">
            {#if passwordError}
              <div class="alert alert-error">{passwordError}</div>
            {/if}
            {#if passwordSuccess}
              <div class="alert alert-success">Password updated successfully.</div>
            {/if}
            <div class="field">
              <label for="newpass">New Password</label>
              <input id="newpass" type="password" bind:value={newPassword} placeholder="Min. 8 characters" />
            </div>
            <div class="field">
              <label for="confirmpass">Confirm Password</label>
              <input id="confirmpass" type="password" bind:value={confirmPassword} placeholder="Repeat new password" />
            </div>
            <div class="btn-group">
              <button class="btn-primary" onclick={savePassword} disabled={saving}>Save Password</button>
              <button class="btn-ghost" onclick={() => { changingPassword = false; newPassword = ''; confirmPassword = ''; passwordError = ''; }}>Cancel</button>
            </div>
          </div>
        {/if}
      </div>

      <!-- MEMBERSHIP -->
      <div class="section">
        <div class="section-label">Membership</div>
        <div class="field-row">
          <div class="field-info">
            <div class="field-name">Plan</div>
            <div class="field-desc">Your current account tier.</div>
          </div>
          <span class="tier-badge tier-{profile?.tier || 'regular'}">{TIER_LABELS[profile?.tier] || (profile?.tier ?? 'Free')}</span>
        </div>

        {#if PLAN_RANK[profile?.tier ?? 'regular'] !== undefined}
          <div class="plans">
            {#each PAID_PLANS as plan (plan.key)}
              {@const owned = ownsPlan(profile?.tier ?? 'regular', plan.rank)}
              <div class="plan-card" class:plan-featured={plan.featured} class:plan-owned={owned}>
                {#if plan.featured}<div class="plan-tag">Most Popular</div>{/if}
                <div class="plan-head">
                  <div class="plan-name">{plan.label}</div>
                  <div class="plan-tagline">{plan.tagline}</div>
                </div>
                <ul class="plan-perks">
                  {#each plan.perks as perk}<li>{perk}</li>{/each}
                </ul>
                {#if owned}
                  <button class="btn-secondary plan-btn" disabled>Current Plan</button>
                {:else}
                  <button class="btn-primary btn-soon plan-btn" disabled aria-disabled="true">Upgrade — Coming Soon</button>
                {/if}
              </div>
            {/each}
          </div>
          <div class="plans-note">Payments are coming soon — these plans aren't purchasable yet.</div>
        {/if}
      </div>

      <!-- DATA -->
      <div class="section">
        <div class="section-label">Your Data</div>
        <div class="field-row">
          <div class="field-info">
            <div class="field-name">Download your data</div>
            <div class="field-desc">Export all your saves, career history, and question progress as JSON.</div>
          </div>
          <button class="btn-secondary" onclick={downloadData}>Download</button>
        </div>
      </div>

      <!-- LOGOUT -->
      <div class="section">
        <div class="section-label">Session</div>
        <div class="field-row">
          <div class="field-info">
            <div class="field-name">Log out</div>
            <div class="field-desc">You'll need to log in again to access your saves.</div>
          </div>
          <button class="btn-secondary" onclick={handleLogout}>Log Out</button>
        </div>
      </div>

      <!-- DELETE -->
      <div class="section section-danger">
        <div class="section-label" style="color:#D94040">Danger Zone</div>
        <div class="field-row">
          <div class="field-info">
            <div class="field-name">Delete account</div>
            <div class="field-desc">Permanently deletes your account, all saves, career history, and question progress. This cannot be undone.</div>
          </div>
          <button class="btn-danger" onclick={() => showDeleteModal = true}>Delete</button>
        </div>
      </div>

    {/if}
  </div>
</div>

<!-- DELETE MODAL -->
{#if showDeleteModal}
  <div class="modal-overlay" onclick={() => showDeleteModal = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-title">Delete Account</div>
      <p class="modal-desc">This will permanently delete your account and all associated data. Type <strong>DELETE</strong> to confirm.</p>
      <input class="modal-input" bind:value={deleteConfirm} placeholder="Type DELETE to confirm" />
      <div class="modal-actions">
        <button class="btn-danger" onclick={handleDeleteAccount} disabled={deleteConfirm !== 'DELETE' || deleting}>
          {deleting ? 'Deleting…' : 'Delete My Account'}
        </button>
        <button class="btn-ghost" onclick={() => { showDeleteModal = false; deleteConfirm = ''; }}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .account-wrap {
    min-height: 100vh;
    padding: 120px 48px 80px;
  }
  .account-inner { max-width: 680px; }

  .page-eyebrow {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .2em;
    text-transform: uppercase; color: var(--gold); margin-bottom: 12px;
  }
  .page-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(42px, 6vw, 72px);
    line-height: 1; letter-spacing: .03em; color: var(--white); margin-bottom: 48px;
  }

  .loading { color: var(--muted); font-size: 14px; }

  .alert {
    padding: 12px 16px; border-radius: 3px; font-size: 13px;
    margin-bottom: 16px;
  }
  .alert-error { background: rgba(217,64,64,0.08); border: 1px solid rgba(217,64,64,0.3); color: #E88A8A; }
  .alert-success { background: rgba(46,139,87,0.08); border: 1px solid rgba(46,139,87,0.3); color: #4CAF85; }

  .section {
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 4px;
    padding: 28px 32px;
    margin-bottom: 16px;
    background: var(--surface);
  }
  .section-danger { border-color: rgba(217,64,64,0.2); background: rgba(217,64,64,0.03); }
  .section-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 10px; font-weight: 700; letter-spacing: .2em;
    text-transform: uppercase; color: var(--muted); margin-bottom: 20px;
  }

  .field-row {
    display: flex; align-items: center; justify-content: space-between; gap: 24px;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .field-row:last-child { border-bottom: none; padding-bottom: 0; }
  .field-row:first-of-type { padding-top: 0; }

  .field-info { flex: 1; min-width: 0; }
  .field-name { font-size: 14px; color: var(--white); font-weight: 500; margin-bottom: 2px; }
  .field-value { font-size: 13px; color: var(--muted); }
  .field-desc { font-size: 13px; color: var(--muted); line-height: 1.5; margin-top: 2px; }

  .inline-input {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(232,193,74,0.4);
    border-radius: 3px;
    color: var(--white);
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    padding: 7px 10px;
    outline: none;
    width: 100%;
    margin-top: 4px;
  }

  .password-form { display: flex; flex-direction: column; gap: 12px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11px; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: var(--muted);
  }
  input[type="password"] {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 3px;
    color: var(--white);
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    padding: 11px 14px;
    outline: none;
    transition: border-color .15s;
    width: 100%;
  }
  input[type="password"]:focus { border-color: rgba(232,193,74,0.5); }

  .btn-group { display: flex; gap: 8px; flex-shrink: 0; }

  .tier-badge {
    display: inline-flex; align-items: center; flex-shrink: 0;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    padding: 6px 14px; border-radius: 3px; border: 1px solid;
  }
  .tier-regular { color: var(--muted); border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); }
  .tier-pro { color: var(--gold); border-color: rgba(232,193,74,0.4); background: rgba(232,193,74,0.1); }
  .tier-max { color: #E8EDF4; border-color: rgba(232,237,244,0.45); background: rgba(232,237,244,0.12); }
  .tier-dev { color: #6B9FE4; border-color: rgba(42,94,173,0.45); background: rgba(42,94,173,0.12); }
  .tier-admin { color: #C07AEA; border-color: rgba(180,74,232,0.45); background: rgba(180,74,232,0.12); }

  .btn-primary {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    background: var(--gold); color: var(--black); border: none;
    padding: 9px 18px; border-radius: 3px; cursor: pointer; transition: background .15s;
    white-space: nowrap;
  }
  .btn-primary:hover:not(:disabled) { background: var(--gold2); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; }

  .btn-soon {
    background: rgba(255,255,255,0.06);
    color: var(--muted);
    border: 1px solid rgba(255,255,255,0.1);
    cursor: not-allowed;
  }
  .btn-soon:hover { background: rgba(255,255,255,0.06); }

  .plans {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
    margin-top: 20px;
  }
  .plan-card {
    position: relative;
    display: flex; flex-direction: column;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 4px;
    padding: 22px 20px;
    background: rgba(255,255,255,0.015);
  }
  .plan-featured { border-color: rgba(232,193,74,0.35); background: rgba(232,193,74,0.04); }
  .plan-owned { opacity: .72; }
  .plan-tag {
    position: absolute; top: -10px; left: 20px;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
    color: var(--black); background: var(--gold);
    padding: 3px 10px; border-radius: 3px;
  }
  .plan-head { margin-bottom: 16px; }
  .plan-name {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 26px; letter-spacing: .04em; color: var(--white); line-height: 1;
  }
  .plan-tagline { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .plan-perks {
    list-style: none; padding: 0; margin: 0 0 20px;
    display: flex; flex-direction: column; gap: 9px; flex: 1;
  }
  .plan-perks li {
    font-size: 13px; color: var(--white); line-height: 1.4;
    padding-left: 20px; position: relative;
  }
  .plan-perks li::before {
    content: '✓'; position: absolute; left: 0;
    color: var(--gold); font-size: 12px; font-weight: 700;
  }
  .plan-btn { width: 100%; text-align: center; }
  .plans-note { font-size: 12px; color: var(--muted); margin-top: 14px; }

  @media (max-width: 600px) {
    .plans { grid-template-columns: 1fr; }
  }

  .btn-secondary {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    background: transparent; color: var(--muted);
    border: 1px solid rgba(255,255,255,0.1);
    padding: 9px 18px; border-radius: 3px; cursor: pointer;
    transition: all .15s; white-space: nowrap; flex-shrink: 0;
  }
  .btn-secondary:hover { color: var(--white); border-color: rgba(255,255,255,0.3); }

  .btn-ghost {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    background: transparent; color: var(--muted); border: none;
    padding: 9px 12px; border-radius: 3px; cursor: pointer; transition: color .15s;
  }
  .btn-ghost:hover { color: var(--white); }

  .btn-danger {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    background: rgba(217,64,64,0.12); color: #D94040;
    border: 1px solid rgba(217,64,64,0.3);
    padding: 9px 18px; border-radius: 3px; cursor: pointer;
    transition: all .15s; white-space: nowrap; flex-shrink: 0;
  }
  .btn-danger:hover:not(:disabled) { background: rgba(217,64,64,0.2); border-color: #D94040; }
  .btn-danger:disabled { opacity: .4; cursor: not-allowed; }

  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 500; padding: 24px;
  }
  .modal {
    background: var(--surface); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 4px; padding: 36px; max-width: 420px; width: 100%;
  }
  .modal-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 28px; letter-spacing: .04em; color: var(--white); margin-bottom: 12px;
  }
  .modal-desc { font-size: 14px; color: var(--muted); line-height: 1.6; margin-bottom: 20px; }
  .modal-desc strong { color: var(--white); }
  .modal-input {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(217,64,64,0.3);
    border-radius: 3px; color: var(--white);
    font-family: 'Barlow', sans-serif; font-size: 14px;
    padding: 11px 14px; outline: none; width: 100%; margin-bottom: 20px;
  }
  .modal-actions { display: flex; gap: 10px; }

  @media (max-width: 600px) {
    .account-wrap { padding: 100px 20px 60px; }
    .section { padding: 20px; }
    .field-row { flex-direction: column; align-items: flex-start; gap: 12px; }
  }
</style>
