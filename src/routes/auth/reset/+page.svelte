<script>
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let password = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let loading = $state(false);
  let ready = $state(false);

  onMount(async () => {
    // Supabase puts the token in the URL hash — getSession picks it up automatically
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      ready = true;
    } else {
      goto('/auth/forgot');
    }
  });

  async function handleSubmit() {
    error = '';
    if (!password) { error = 'Please enter a new password.'; return; }
    if (password.length < 8) { error = 'Password must be at least 8 characters.'; return; }
    if (password !== confirmPassword) { error = 'Passwords do not match.'; return; }

    loading = true;
    const { error: updateError } = await supabase.auth.updateUser({ password });
    loading = false;

    if (updateError) {
      error = updateError.message;
    } else {
      goto('/account');
    }
  }
</script>

<svelte:head>
  <title>Reset Password — McChimp</title>
</svelte:head>

<div class="auth-wrap">
  <div class="auth-card">

    <a href="/" class="auth-logo">Mc<span>Chimp</span></a>

    {#if !ready}
      <p class="auth-sub">Verifying your reset link…</p>
    {:else}
      <h1>New Password</h1>
      <p class="auth-sub">Enter your new password below.</p>

      <div class="auth-form">
        {#if error}
          <div class="auth-error">{error}</div>
        {/if}

        <div class="field">
          <label for="password">New Password</label>
          <input
            id="password"
            type="password"
            bind:value={password}
            placeholder="Min. 8 characters"
            autocomplete="new-password"
          />
        </div>

        <div class="field">
          <label for="confirm">Confirm Password</label>
          <input
            id="confirm"
            type="password"
            bind:value={confirmPassword}
            placeholder="Repeat new password"
            autocomplete="new-password"
          />
        </div>

        <button class="btn-submit" onclick={handleSubmit} disabled={loading}>
          {loading ? 'Saving…' : 'Set New Password'}
        </button>
      </div>
    {/if}

  </div>
</div>

<style>
  .auth-wrap {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 100px 24px 60px;
  }
  .auth-card {
    width: 100%;
    max-width: 420px;
    background: var(--surface);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 4px;
    padding: 48px 40px;
  }
  .auth-logo {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 24px;
    letter-spacing: .06em;
    color: var(--gold);
    text-decoration: none;
    display: block;
    margin-bottom: 32px;
  }
  .auth-logo span { color: var(--white); opacity: .5; }
  h1 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 36px;
    letter-spacing: .04em;
    color: var(--white);
    margin-bottom: 8px;
  }
  .auth-sub { font-size: 14px; color: var(--muted); margin-bottom: 32px; line-height: 1.5; }
  .auth-form { display: flex; flex-direction: column; gap: 16px; }
  .auth-error {
    background: rgba(217,64,64,0.08);
    border: 1px solid rgba(217,64,64,0.3);
    border-radius: 3px;
    padding: 12px 16px;
    font-size: 13px;
    color: #E88A8A;
  }
  .field { display: flex; flex-direction: column; gap: 6px; }
  label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  input {
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
  input:focus { border-color: rgba(232,193,74,0.5); }
  input::placeholder { color: var(--muted); opacity: .5; }
  .btn-submit {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    background: var(--gold);
    color: var(--black);
    border: none;
    padding: 13px;
    border-radius: 3px;
    cursor: pointer;
    transition: background .15s;
    margin-top: 4px;
  }
  .btn-submit:hover:not(:disabled) { background: var(--gold2); }
  .btn-submit:disabled { opacity: .5; cursor: not-allowed; }
</style>