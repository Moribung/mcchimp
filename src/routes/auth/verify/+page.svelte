<script>
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>Verify Email — McChimp</title>
</svelte:head>

<div class="auth-wrap">
  <div class="auth-card">

    <a href="/" class="auth-logo">Mc<span>Chimp</span></a>

    <div class="success-icon">✉</div>
    <h1>Check your email</h1>
    <p class="auth-sub">We've sent a confirmation link to your email address. Click it to activate your account.</p>
    <p class="auth-sub" style="margin-top:8px;">Once confirmed, you can log in.</p>

    <a href="/auth/login" class="btn-submit" style="display:block;text-align:center;text-decoration:none;margin-top:32px;">
      Go to Login
    </a>

    <div class="auth-footer">
      Wrong email? <a href="/auth/signup">Sign up again</a>
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
    text-align: center;
  }
  .auth-logo {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 24px;
    letter-spacing: .06em;
    color: var(--gold);
    text-decoration: none;
    display: block;
    margin-bottom: 32px;
    text-align: left;
  }
  .auth-logo span { color: var(--white); opacity: .5; }
  .success-icon {
    font-size: 40px;
    margin-bottom: 20px;
  }
  h1 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 36px;
    letter-spacing: .04em;
    color: var(--white);
    margin-bottom: 12px;
  }
  .auth-sub { font-size: 14px; color: var(--muted); line-height: 1.6; }
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
  }
  .btn-submit:hover { background: var(--gold2); }
  .auth-footer {
    text-align: center;
    font-size: 13px;
    color: var(--muted);
    margin-top: 24px;
  }
  .auth-footer a {
    color: var(--gold);
    text-decoration: none;
    font-weight: 600;
  }
  .auth-footer a:hover { text-decoration: underline; }
</style>