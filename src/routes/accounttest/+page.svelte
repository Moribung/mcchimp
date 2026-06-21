<script>
  import { supabase } from '$lib/supabase';
  import { session } from '$lib/stores/session';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';
  import { TIER_LABELS, PAID_PLANS } from '$lib/tiers';

  // ── Hidden Paddle sandbox test page. Not linked anywhere; gated to the owner. ──
  // Access: these emails, or dev/admin tiers. Everyone else is bounced to home.
  const ALLOWED_EMAILS = ['moritz.bung@gmail.com'];

  // Paddle config from public env (add to .env.local / Cloudflare vars):
  //   PUBLIC_PADDLE_ENV          = sandbox   (or 'production' later)
  //   PUBLIC_PADDLE_CLIENT_TOKEN = test_xxxxx (client-side token from Paddle)
  //   PUBLIC_PADDLE_PRICE_PRO    = pri_...
  //   PUBLIC_PADDLE_PRICE_MAX    = pri_...
  const PADDLE_ENV = env.PUBLIC_PADDLE_ENV || 'sandbox';
  const CLIENT_TOKEN = env.PUBLIC_PADDLE_CLIENT_TOKEN || '';
  const PRICE_FOR = { pro: env.PUBLIC_PADDLE_PRICE_PRO || '', max: env.PUBLIC_PADDLE_PRICE_MAX || '' };

  let profile = $state(null);
  let loading = $state(true);
  let allowed = $state(false);
  let paddleReady = $state(false);
  let status = $state('');

  function loadPaddleScript() {
    return new Promise((resolve, reject) => {
      if (window.Paddle) return resolve(window.Paddle);
      const s = document.createElement('script');
      s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
      s.onload = () => resolve(window.Paddle);
      s.onerror = () => reject(new Error('Failed to load Paddle.js'));
      document.head.appendChild(s);
    });
  }

  async function refreshProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', $session.user.id).single();
    if (data) profile = data;
  }

  onMount(async () => {
    if (!$session) { goto('/auth/login'); return; }

    await refreshProfile();
    allowed =
      ALLOWED_EMAILS.includes($session.user.email) ||
      profile?.tier === 'dev' ||
      profile?.tier === 'admin';

    if (!allowed) { goto('/'); return; }
    loading = false;

    if (!CLIENT_TOKEN) { status = 'No PUBLIC_PADDLE_CLIENT_TOKEN set yet.'; return; }
    try {
      const Paddle = await loadPaddleScript();
      Paddle.Environment.set(PADDLE_ENV);
      Paddle.Initialize({
        token: CLIENT_TOKEN,
        eventCallback: (ev) => {
          if (ev?.name === 'checkout.completed') {
            status = 'Payment completed — waiting for webhook to update your tier…';
            // Give the webhook a moment, then re-read the profile.
            setTimeout(refreshProfile, 2500);
          }
        }
      });
      paddleReady = true;
    } catch (e) {
      status = e.message;
    }
  });

  function buy(planKey) {
    const priceId = PRICE_FOR[planKey];
    if (!window.Paddle || !priceId) { status = `No price id configured for ${planKey}.`; return; }
    window.Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customData: { user_id: $session.user.id },
      customer: { email: $session.user.email }
    });
  }
</script>

<svelte:head>
  <title>Account Test — McChimp</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="wrap">
  <div class="inner">
    <div class="banner">⚠️ Paddle sandbox test page · {PADDLE_ENV}</div>

    {#if loading}
      <div class="loading">Checking access…</div>
    {:else}
      <h1>Checkout test</h1>
      <p class="sub">
        Signed in as <strong>{$session?.user?.email}</strong> · current tier:
        <strong>{TIER_LABELS[profile?.tier] || 'Free'}</strong>
      </p>

      {#if status}<div class="status">{status}</div>{/if}

      <div class="plans">
        {#each PAID_PLANS as plan (plan.key)}
          <div class="card">
            <div class="name">{plan.label}</div>
            <ul>
              {#each plan.perks as perk}<li>{perk}</li>{/each}
            </ul>
            <button
              onclick={() => buy(plan.key)}
              disabled={!paddleReady || !PRICE_FOR[plan.key]}>
              {PRICE_FOR[plan.key] ? `Buy ${plan.label} (sandbox)` : `${plan.label} — no price id`}
            </button>
          </div>
        {/each}
      </div>

      <button class="refresh" onclick={refreshProfile}>Refresh tier</button>
    {/if}
  </div>
</div>

<style>
  .wrap { min-height: 100vh; padding: 120px 48px 80px; }
  .inner { max-width: 680px; }
  .banner {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase;
    color: #E8C14A; background: rgba(232,193,74,0.1);
    border: 1px solid rgba(232,193,74,0.3); border-radius: 3px;
    padding: 8px 14px; display: inline-block; margin-bottom: 28px;
  }
  h1 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(36px, 5vw, 56px); line-height: 1; letter-spacing: .03em;
    color: var(--white); margin: 0 0 12px;
  }
  .sub { font-size: 14px; color: var(--muted); margin-bottom: 24px; }
  .sub strong { color: var(--white); }
  .loading { color: var(--muted); font-size: 14px; }
  .status {
    font-size: 13px; color: #E8C14A;
    background: rgba(232,193,74,0.08); border: 1px solid rgba(232,193,74,0.25);
    border-radius: 3px; padding: 10px 14px; margin-bottom: 20px;
  }
  .plans { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .card {
    border: 1px solid rgba(255,255,255,0.08); border-radius: 4px;
    padding: 22px 20px; background: var(--surface);
    display: flex; flex-direction: column;
  }
  .name {
    font-family: 'Bebas Neue', sans-serif; font-size: 26px;
    letter-spacing: .04em; color: var(--white); margin-bottom: 14px;
  }
  ul { list-style: none; padding: 0; margin: 0 0 20px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
  li { font-size: 13px; color: var(--white); line-height: 1.4; padding-left: 18px; position: relative; }
  li::before { content: '✓'; position: absolute; left: 0; color: var(--gold); font-weight: 700; }
  button {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    background: var(--gold); color: var(--black); border: none;
    padding: 11px 18px; border-radius: 3px; cursor: pointer; transition: background .15s;
  }
  button:hover:not(:disabled) { background: var(--gold2); }
  button:disabled { opacity: .45; cursor: not-allowed; }
  .refresh {
    margin-top: 20px; background: transparent; color: var(--muted);
    border: 1px solid rgba(255,255,255,0.1);
  }
  .refresh:hover:not(:disabled) { color: var(--white); border-color: rgba(255,255,255,0.3); background: transparent; }
  @media (max-width: 600px) { .wrap { padding: 100px 20px 60px; } .plans { grid-template-columns: 1fr; } }
</style>
