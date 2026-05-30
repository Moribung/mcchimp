<script>
  import { page } from '$app/stores';
  import { session } from '$lib/stores/session';
  import { supabase } from '$lib/supabase';

  let { children } = $props();

  let mobileNavOpen = $state(false);
  let displayName   = $state('');

  function toggleMobileNav() {
    mobileNavOpen = !mobileNavOpen;
  }

  $effect(() => {
    if ($session) {
      supabase
        .from('profiles')
        .select('display_name')
        .eq('id', $session.user.id)
        .single()
        .then(({ data }) => {
          if (data) displayName = data.display_name;
        });
    } else {
      displayName = '';
    }
  });

  // Add/remove game-page class on body based on route.
  // The /mma route manages its own layout — hide the global header there.
  $effect(() => {
    const isGamePage = $page.url.pathname.startsWith('/mma') ||
                       $page.url.pathname.startsWith('/football');
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('game-page', isGamePage);
    }
  });
</script>

<svelte:head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>McChimp — Know Your Sport</title>
  <meta name="description" content="Sports trivia games that actually test you. MMA, Football and more." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500&display=swap" rel="stylesheet" />
</svelte:head>

<header>
  <a class="logo" href="/">Mc<span>Chimp</span></a>
  <nav>
    <div class="nav-item">
      <a class="nav-link-q" href="/games">Games&#8202;<span class="chevron">&#9662;</span></a>
      <div class="dropdown">
        <a href="/mma"><span class="dd-label">MMA Game</span></a>
        <a href="/football"><span class="dd-label">Football Game</span></a>
      </div>
    </div>
    <a href="/#how">How it works</a>
    <div class="nav-item">
      <a class="nav-link-q" href="/questions">Questions&#8202;<span class="chevron">&#9662;</span></a>
      <div class="dropdown">
        <a href="/questions/sets"><span class="dd-label">Question Sets</span></a>
        <a href="/questions/guide"><span class="dd-label">AI Guide</span></a>
        <a href="/questions/generator"><span class="dd-label">Generator</span></a>
        {#if $session}
          <a href="/questions/library"><span class="dd-label">My Library</span></a>
        {/if}
      </div>
    </div>
    <a href="/#contact">Contact</a>
    {#if $session}
      <div class="nav-item">
        <a class="nav-link-q nav-login" href="/account">{displayName || 'Account'}&#8202;<span class="chevron">&#9662;</span></a>
        <div class="dropdown">
          <a href="/dashboard"><span class="dd-label">Dashboard</span></a>
          <a href="/account"><span class="dd-label">Settings</span></a>
        </div>
      </div>
    {:else}
      <a href="/auth/login" class="nav-login">Login</a>
    {/if}
  </nav>
  <button class="hamburger" class:open={mobileNavOpen} onclick={toggleMobileNav} aria-label="Menu">
    <span></span><span></span><span></span>
  </button>
</header>

<div class="mobile-nav" class:open={mobileNavOpen}>
  <button class="mobile-nav-close" onclick={toggleMobileNav}>&#215;</button>
  <a href="/games" onclick={toggleMobileNav}>Games</a>
  <a href="/mma"      onclick={toggleMobileNav} style="font-size:20px;color:var(--muted);padding:3px 0;padding-left:12px;">MMA Game</a>
  <a href="/football" onclick={toggleMobileNav} style="font-size:20px;color:var(--muted);padding:3px 0;padding-left:12px;">Football Game</a>
  <a href="/#how" onclick={toggleMobileNav}>How It Works</a>
  <a href="/questions" onclick={toggleMobileNav}>Questions</a>
  <a href="/questions/sets"      onclick={toggleMobileNav} style="font-size:20px;color:var(--muted);padding:3px 0;padding-left:12px;">Question Sets</a>
  <a href="/questions/guide"     onclick={toggleMobileNav} style="font-size:20px;color:var(--muted);padding:3px 0;padding-left:12px;">AI Guide</a>
  <a href="/questions/generator" onclick={toggleMobileNav} style="font-size:20px;color:var(--muted);padding:3px 0;padding-left:12px;">Generator</a>
  {#if $session}
    <a href="/questions/library" onclick={toggleMobileNav} style="font-size:20px;color:var(--muted);padding:3px 0;padding-left:12px;">My Library</a>
  {/if}
  <a href="/#contact" onclick={toggleMobileNav}>Contact</a>
  {#if $session}
    <a href="/dashboard" onclick={toggleMobileNav} style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{displayName || 'Account'}</a>
    <a href="/dashboard" onclick={toggleMobileNav} style="font-size:20px;color:var(--muted);padding:3px 0;padding-left:12px;">Dashboard</a>
    <a href="/account"   onclick={toggleMobileNav} style="font-size:20px;color:var(--muted);padding:3px 0;padding-left:12px;">Settings</a>
  {:else}
    <a href="/auth/login" onclick={toggleMobileNav} class="mobile-login">Login</a>
  {/if}
</div>

{@render children()}

<footer>
  <div class="footer-logo">McChimp</div>
  <div class="footer-links">
    <a href="/mma">MMA Trivia</a>
    <a href="/games">Games</a>
    <a href="/#contact">Contact</a>
    <a href="/privacy">Privacy Policy</a>
  </div>
  <div class="footer-copy">© 2026 McChimp</div>
</footer>

<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :global(:root) {
    --black: #0A0A0A;
    --off: #111213;
    --surface: #191B1D;
    --gold: #E8C14A;
    --gold2: #C89A20;
    --white: #F2EFE8;
    --muted: #6B6B6B;
    --red: #D94040;
    --blue: #2A5EAD;
    --green: #2E8B57;
  }

  :global(html) { scroll-behavior: smooth; }

  :global(body) {
    background: var(--black);
    color: var(--white);
    font-family: 'Barlow', sans-serif;
    font-size: 16px;
    line-height: 1.6;
    overflow-x: hidden;
  }

  :global(body)::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
    opacity: 0.028;
    pointer-events: none;
    z-index: 999;
  }

  header {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 48px;
    padding-top: max(20px, env(safe-area-inset-top));
    background: rgba(10,10,10,0.97);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    backdrop-filter: blur(12px);
  }

  .logo {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 28px;
    letter-spacing: .06em;
    color: var(--gold);
    text-decoration: none;
  }
  .logo span { color: var(--white); opacity: .5; }

  nav { display: flex; gap: 32px; align-items: center; }
  nav a {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--muted);
    text-decoration: none;
    transition: color .2s;
  }
  nav a:hover { color: var(--white); }

  .nav-item { position: relative; display: inline-flex; }
  .nav-link-q {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--muted);
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: color .15s;
  }
  .nav-link-q:hover, .nav-item:hover .nav-link-q { color: var(--white); }
  .chevron { font-size: 9px; opacity: .5; transition: transform .2s; }
  .nav-item:hover .chevron { transform: rotate(180deg); }
  .dropdown {
    position: absolute;
    top: 100%; right: 0;
    width: max-content;
    background: #0F1011;
    border: 1px solid rgba(255,255,255,0.08);
    opacity: 0;
    pointer-events: none;
    transform: translateY(-4px);
    transition: opacity .15s, transform .15s;
    z-index: 300;
    box-shadow: 0 12px 32px rgba(0,0,0,0.6);
  }
  .nav-item:hover .dropdown { opacity: 1; pointer-events: all; transform: translateY(0); }
  .dropdown a {
    display: flex;
    flex-direction: column;
    padding: 14px 20px;
    text-decoration: none;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    transition: background .12s;
  }
  .dropdown a:last-child { border-bottom: none; }
  .dropdown a:hover { background: #191B1D; }
  .dd-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--white);
  }

  .hamburger {
    display: none;
    flex-direction: column;
    gap: 5px;
    cursor: pointer;
    background: none;
    border: none;
    padding: 4px;
  }
  .hamburger span {
    display: block;
    width: 22px;
    height: 2px;
    background: var(--white);
    border-radius: 2px;
    transition: all .25s;
  }
  .hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .hamburger.open span:nth-child(2) { opacity: 0; }
  .hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  .mobile-nav {
    display: none;
    position: fixed;
    top: 0; right: 0;
    background: rgba(10,10,10,0.98);
    border-left: 1px solid rgba(255,255,255,0.06);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    z-index: 150;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    padding: 80px 40px 32px;
    min-width: 220px;
  }
  .mobile-nav.open { display: flex; }
  .mobile-nav a, .mobile-nav button {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 26px;
    letter-spacing: .06em;
    color: var(--white);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 0;
    transition: color .15s;
    display: block;
    width: 100%;
  }
  .mobile-nav a:hover, .mobile-nav button:hover { color: var(--gold); }
  .mobile-nav-close {
    position: absolute;
    top: 20px; right: 20px;
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 22px;
    line-height: 1;
    transition: color .15s;
  }
  .mobile-nav-close:hover { color: var(--white); }

  footer {
    padding: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .footer-logo {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 22px;
    letter-spacing: .06em;
    color: var(--gold);
    opacity: .6;
  }
  .footer-links { display: flex; gap: 28px; }
  .footer-links a {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--muted);
    text-decoration: none;
    transition: color .2s;
  }
  .footer-links a:hover { color: var(--white); }
  .footer-copy { font-size: 12px; color: rgba(107,107,107,0.6); letter-spacing: .04em; }

  .nav-login {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px !important;
    font-weight: 700 !important;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--gold) !important;
    border: 1px solid rgba(232,193,74,0.4);
    padding: 7px 18px !important;
    border-radius: 2px;
    text-decoration: none;
    transition: background .2s, border-color .2s;
    margin-left: 8px;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-block;
  }
  .nav-login:hover {
    background: rgba(232,193,74,0.08) !important;
    border-color: var(--gold);
    color: var(--gold) !important;
  }
  .mobile-login { color: var(--gold) !important; }

  @media (max-width: 900px) {
    header { padding: 16px 24px; }
    footer { flex-direction: column; gap: 24px; text-align: center; padding: 40px 24px; }
    .footer-links { flex-wrap: wrap; justify-content: center; }
  }
  @media (max-width: 768px) {
    nav > a, nav > .nav-item, nav > .nav-login { display: none; }
    .hamburger { display: flex; }
  }

  /* Hide global header + footer on game pages — they manage their own layout */
  :global(body.game-page) header { display: none; }
  :global(body.game-page) footer { display: none; }
</style>
