<script>
  let email = $state('');
  let error = $state('');
  let submitted = $state(false);
  let loading = $state(false);

  function handleSubmit() {
    error = '';
    if (!email) { error = 'Please enter your email address.'; return; }
    loading = true;
    // Phase 1: Supabase password reset goes here
    setTimeout(() => {
      loading = false;
      submitted = true;
    }, 600);
  }
</script>

<svelte:head>
  <title>Reset Password — McChimp</title>
</svelte:head>

<div class="auth-wrap">
  <div class="auth-card">

    <a href="/" class="auth-logo">Mc<span>Chimp</span></a>

    {#if submitted}
      <div class="success-state">
        <div class="success-icon">✓</div>
        <h1>Check your email</h1>
        <p>If an account exists for <strong>{email}</strong>, we've sent a password reset link. Check your inbox and spam folder.</p>
        <a href="/auth/login" class="btn-back">Back to Login</a>
      </div>
    {:else}
      <h1>Reset password</h1>
      <p class="auth-sub">Enter your email and we'll send you a reset link.</p>

      <div class="auth-form">
        {#if error}
          <div class="auth-error">{error}</div>
        {/if}

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

        <button class="btn-submit" onclick={handleSubmit} disabled={loading}>
          {loading ? 'Sending…' : 'Send Reset Link'}
        </button>
      </div>

      <div class="auth-footer">
        <a href="/auth/login">← Back to Login</a>
      </div>

      <div class="coming-soon-note">
        ⚡ Accounts are coming soon. Games are fully playable without an account.
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
  .auth-footer {
    text-align: center;
    font-size: 13px;
    color: var(--muted);
    margin-top: 28px;
  }
  .auth-footer a { color: var(--muted); text-decoration: none; transition: color .15s; }
  .auth-footer a:hover { color: var(--white); }
  .coming-soon-note {
    margin-top: 20px;
    padding: 12px 16px;
    background: rgba(232,193,74,0.05);
    border: 1px solid rgba(232,193,74,0.15);
    border-radius: 3px;
    font-size: 12px;
    color: rgba(232,193,74,0.6);
    text-align: center;
    line-height: 1.5;
  }
  .success-state { text-align: center; }
  .success-icon {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(46,139,87,0.15);
    border: 1px solid rgba(46,139,87,0.3);
    color: #4CAF85;
    font-size: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
  }
  .success-state h1 { margin-bottom: 12px; }
  .success-state p { font-size: 14px; color: var(--muted); line-height: 1.6; margin-bottom: 32px; }
  .success-state p strong { color: var(--white); }
  .btn-back {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    background: transparent;
    color: var(--white);
    border: 1px solid rgba(255,255,255,0.15);
    padding: 12px 32px;
    border-radius: 3px;
    text-decoration: none;
    display: inline-block;
    transition: border-color .15s;
  }
  .btn-back:hover { border-color: rgba(255,255,255,0.4); }
</style>
