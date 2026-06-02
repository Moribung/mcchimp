<script>
  import { page } from '$app/stores';
  import { session } from '$lib/stores/session';

  let { children } = $props();

  const tabs = [
    { href: '/questions', label: 'Overview', exact: true },
    { href: '/questions/sets', label: 'Question Sets' },
    { href: '/questions/guide', label: 'AI Guide' },
    { href: '/questions/generator', label: 'Generator' },
  ];

  function isActive(tab) {
    if (tab.exact) return $page.url.pathname === tab.href;
    return $page.url.pathname.startsWith(tab.href);
  }
</script>

<div class="questions-hero">
  <div class="page-hero-tag">Question Sets</div>
  <h1>Make Your<br>Own Questions</h1>
  <p>Every McChimp game runs on a modular question engine. Swap in any topic, any language — as long as it follows the schema, it works instantly.</p>
</div>

<div class="tab-bar">
  {#each tabs as tab}
    <a href={tab.href} class="tab-btn" class:active={isActive(tab)}>{tab.label}</a>
  {/each}
  {#if $session}
    <a href="/questions/library" class="tab-btn" class:active={$page.url.pathname.startsWith('/questions/library')}>My Library</a>
  {/if}
</div>

{@render children()}

<style>
  .questions-hero {
    padding: 120px 48px 40px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .page-hero-tag {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .18em;
    text-transform: uppercase; color: var(--gold); margin-bottom: 14px;
  }
  .questions-hero h1 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(52px, 8vw, 96px);
    line-height: .92; letter-spacing: .02em; color: var(--white); margin-bottom: 16px;
  }
  .questions-hero p { font-size: 15px; color: rgba(242,239,232,0.45); max-width: 520px; line-height: 1.65; }

  .tab-bar {
    display: flex; border-bottom: 1px solid rgba(255,255,255,0.06);
    padding: 0 48px; position: sticky; top: 64px; z-index: 50;
    background: rgba(10,10,10,0.96); backdrop-filter: blur(12px);
  }
  .tab-btn {
    font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700;
    letter-spacing: .12em; text-transform: uppercase; color: var(--muted);
    background: none; border: none; border-bottom: 2px solid transparent;
    padding: 16px 20px; cursor: pointer; transition: color .15s, border-color .15s;
    white-space: nowrap; margin-bottom: -1px; text-decoration: none;
  }
  .tab-btn:hover { color: var(--white); }
  .tab-btn.active { color: var(--gold); border-bottom-color: var(--gold); }

  @media (max-width: 900px) {
    .questions-hero { padding: 100px 24px 32px; }
    .tab-bar { padding: 0 24px; overflow-x: auto; }
    .tab-btn { padding: 14px 14px; font-size: 11px; }
  }
</style>