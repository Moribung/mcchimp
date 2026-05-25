<script>
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';

  let email = $state('');
  let password = $state('');
  let displayName = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit() {
    error = '';
    if (!email || !password || !displayName) { error = 'Please fill in all fields.'; return; }
    if (password.length < 8) { error = 'Password must be at least 8 characters.'; return; }
    loading = true;

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName }
      }
    });

    if (authError) {
      error = authError.message;
      loading = false;
    } else {
      goto('/auth/verify');
    }
  }
</script>

<svelte:head>
  <title>Sign Up — McChimp</title>
</svelte:head>

<div class="auth-wrap">
  <div class="auth-card">

    <a href="/" class="auth-logo">Mc<span>Chimp</span></a>
    <h1>Create account</h1>
    <p class="auth-sub">Save your careers and track your question progress across devices.</p>

    <div class="auth-form">
      {#if error}
        <div class="auth-error">{error}</div>
      {/if}

      <div class="field">
        <label for="displayName">Display Name</label>
        <input
          id="displayName"
          type="text"
          bind:value={displayName}
          placeholder="e.g. Jake The Hammer"
          autocomplete="nickname"
          maxlength="32"
        />
      </div>

      <div class="field">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="you@example.com"
          autocomplete="email"
        />
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          placeholder="Min. 8 characters"
          autocomplete="new-password"
        />
      </div>

      <p class="terms-note">
        By signing up you agree to our <a href="/privacy">Privacy Policy</a>. We don't sell your data or send marketing emails.
      </p>

      <button class="btn-submit" onclick={handleSubmit} disabled={loading}>
        {loading ? 'Creating account…' : 'Create Account'}
      </button>
    </div>

    <div class="auth-divider"><span>or</span></div>

    <div class="oauth-btns">
      <button class="btn-oauth" disabled>
        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continue with Google
      </button>
      <button class="btn-oauth" disabled>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
        Continue with Discord
      </button>
    </div>

    <div class="auth-footer">
      Already have an account? <a href="/auth/login">Login</a>
    </div>
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
  .terms-note {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.5;
    margin-top: -4px;
  }
  .terms-note a { color: var(--muted); text-decoration: underline; }
  .terms-note a:hover { color: var(--white); }
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
  .auth-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 24px 0;
    color: var(--muted);
    font-size: 12px;
  }
  .auth-divider::before, .auth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.06);
  }
  .oauth-btns { display: flex; flex-direction: column; gap: 10px; }
  .btn-oauth {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 3px;
    color: var(--white);
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    padding: 11px;
    cursor: pointer;
    transition: background .15s, border-color .15s;
  }
  .btn-oauth:hover:not(:disabled) { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
  .btn-oauth:disabled { opacity: .4; cursor: not-allowed; }
  .auth-footer {
    text-align: center;
    font-size: 13px;
    color: var(--muted);
    margin-top: 28px;
  }
  .auth-footer a {
    color: var(--gold);
    text-decoration: none;
    font-weight: 600;
  }
</style>
