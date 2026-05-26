<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  let displayName = $state('');
  let loggedIn = $state(false);

  onMount(async () => {
    document.body.classList.add('game-page');

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      loggedIn = true;
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .single();
      if (data) displayName = data.display_name;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        loggedIn = true;
        const { data } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', session.user.id)
          .single();
        if (data) displayName = data.display_name;
      } else {
        loggedIn = false;
        displayName = '';
      }
    });

    return () => {
      document.body.classList.remove('game-page');
      subscription.unsubscribe();
    };
  });
</script>

<svelte:head>
  <title>MMA Career Trivia — McChimp</title>
  <meta name="description" content="Build a fighter from the regional circuit to world champion. Every fight decided by trivia." />
</svelte:head>

<div class="back-bar">
  <a href="/games" class="back-btn">← Back to Games</a>
  <span class="back-title">MMA Career Trivia</span>
  {#if loggedIn}
    <a href="/account" class="back-login" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{displayName || 'Account'}</a>
  {:else}
    <a href="/auth/login" class="back-login">Login</a>
  {/if}
</div>

<div class="game-wrap">
  <iframe src="/embeds/mma.html" title="MMA Career Trivia" allowfullscreen></iframe>
</div>

<style>
  .back-bar {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 44px;
    background: rgba(10,10,10,0.97);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    z-index: 200;
    backdrop-filter: blur(12px);
  }
  .back-btn {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--muted);
    text-decoration: none;
    transition: color .15s;
  }
  .back-btn:hover { color: var(--white); }
  .back-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 18px;
    letter-spacing: .06em;
    color: var(--white);
  }
  .back-login {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--gold);
    border: 1px solid rgba(232,193,74,0.4);
    padding: 5px 14px;
    border-radius: 2px;
    text-decoration: none;
    transition: background .2s;
  }
  .back-login:hover { background: rgba(232,193,74,0.08); }
  .game-wrap { padding-top: 44px; height: 100vh; background: #0A0A0A; }
  iframe { width: 100%; height: 100%; border: none; display: block; }
</style>
