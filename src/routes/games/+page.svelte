<svelte:head>
  <title>Games — McChimp</title>
  <meta name="description" content="Sports career simulators powered by knowledge. MMA career builder and football manager — your answers decide every result." />
</svelte:head>

<!-- PAGE HERO -->
<div class="page-hero">
  <div class="page-hero-tag">The Platform</div>
  <h1>All<br><em>Games</em></h1>
  <p>Sports career simulators where knowledge is the mechanic, not a stat. The same engine powers both games — swap in any question set and the career logic runs unchanged.</p>
</div>

<!-- GAMES GRID -->
<section class="section">
  <div class="section-label">Live Now</div>
  <div class="games-grid">

    <a href="/mma" class="game-card">
      <div class="card-num">01</div>
      <div class="card-tag tag-live">● Live Now</div>
      <div class="card-title">MMA Career<br>Simulator</div>
      <p class="card-desc">Build a fighter from unsigned prospect to world champion across three career phases. Every fight is resolved by a question — correct answers mean your fighter lands; wrong answers mean the opponent does.</p>
      <div class="card-meta">
        <span class="meta-pill">Career Mode</span>
        <span class="meta-pill">Sparring Mode</span>
        <span class="meta-pill">Adaptive Difficulty</span>
      </div>
      <div class="card-arrow">Play Now →</div>
      <div class="card-accent accent-gold"></div>
    </a>

    <a href="/embeds/football.html" class="game-card">
      <div class="card-num">02</div>
      <div class="card-tag tag-ongoing">● Ongoing</div>
      <div class="card-title">Football Career<br>Manager</div>
      <p class="card-desc">Guide a club through the football pyramid. Tactics set the match tempo — play attacking for more questions per match, or sit deep for fewer. Your answers decide the score, the table, and the season.</p>
      <p class="card-notice">Demo only — progress is not saved and question uploads are not supported.</p>
      <div class="card-meta">
        <span class="meta-pill">Career Mode</span>
        <span class="meta-pill">Adaptive Difficulty</span>
      </div>
      <div class="card-arrow">Play Demo →</div>
      <div class="card-accent accent-green"></div>
    </a>

  </div>
</section>

<!-- COMING SOON -->
<section class="section" style="padding-top:0">
  <div class="section-label">Coming Soon</div>
  <div class="games-grid">

    <div class="game-card game-card--soon">
      <div class="card-num">03</div>
      <div class="card-tag tag-soon">● In Development</div>
      <div class="card-title">More<br>Sports</div>
      <p class="card-desc">More sports, more careers, more questions. The platform is built to grow — new games drop as the question sets are ready.</p>
      <div class="card-arrow" style="color:var(--muted)">Coming Soon</div>
      <div class="card-accent" style="background:var(--muted);opacity:.2"></div>
    </div>

    <div class="game-card game-card--soon">
      <div class="card-num">04</div>
      <div class="card-tag tag-soon">● Planned</div>
      <div class="card-title">Community<br>Sets</div>
      <p class="card-desc">Upload your own question sets and challenge others. Build sets around any sport, any era, any niche — the engine handles the rest.</p>
      <div class="card-arrow" style="color:var(--muted)">Coming Soon</div>
      <div class="card-accent" style="background:var(--muted);opacity:.2"></div>
    </div>

  </div>
</section>

<!-- HOW THE ENGINE WORKS -->
<section class="section engine-section">
  <div class="section-label">Under The Hood</div>
  <div class="section-title">One Engine.<br>Any Topic.</div>
  <div class="engine-grid">
    <div class="engine-card">
      <div class="engine-num">01</div>
      <div class="engine-title">Swappable Question Sets</div>
      <p class="engine-desc">The career engine and the question sets are completely separate. Load any compatible JSON — the default sets cover MMA, football, animals, and economics, but the engine doesn't care what the questions are about.</p>
    </div>
    <div class="engine-card">
      <div class="engine-num">02</div>
      <div class="engine-title">Adaptive Difficulty</div>
      <p class="engine-desc">Each question tracks your history with it individually. Answer it right consistently and it gets harder; miss it repeatedly and it eases back down. The difficulty is never fixed — it maps to the shape of what you know.</p>
    </div>
    <div class="engine-card">
      <div class="engine-num">03</div>
      <div class="engine-title">Real Career Mechanics</div>
      <p class="engine-desc">Rankings, titles, league tables, promotions, relegations — the simulation logic runs on real sporting structure. Your knowledge performance feeds directly into a career that has actual stakes at every stage.</p>
    </div>
  </div>
</section>

<style>
  .page-hero {
    padding: 160px 48px 80px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    position: relative;
    overflow: hidden;
  }
  .page-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 50% 60% at 80% 50%, rgba(232,193,74,0.05) 0%, transparent 70%);
    pointer-events: none;
  }
  .page-hero-tag {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: .18em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .page-hero-tag::before {
    content: '';
    display: block;
    width: 32px;
    height: 2px;
    background: var(--gold);
  }
  .page-hero h1 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(64px, 10vw, 140px);
    line-height: .92;
    letter-spacing: .02em;
    color: var(--white);
    margin-bottom: 28px;
  }
  .page-hero h1 em {
    font-style: normal;
    color: var(--gold);
  }
  .page-hero p {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: clamp(16px, 2vw, 22px);
    color: rgba(242,239,232,0.45);
    max-width: 500px;
    line-height: 1.5;
  }

  .section { padding: 80px 48px; }
  .section-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .2em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 32px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-label::before { content: ''; display: block; width: 24px; height: 1px; background: var(--gold); }
  .section-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(42px, 6vw, 80px);
    line-height: 1;
    letter-spacing: .03em;
    color: var(--white);
    margin-bottom: 48px;
  }

  .games-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    max-width: 1100px;
  }
  .game-card {
    background: var(--surface);
    padding: 48px;
    position: relative;
    overflow: hidden;
    text-decoration: none;
    display: block;
    transition: background .2s;
    border: 1px solid rgba(255,255,255,0.04);
  }
  .game-card:hover { background: #1E2023; }
  .game-card:hover .card-arrow { transform: translate(4px, -4px); }
  .game-card--soon { cursor: default; }
  .game-card--soon:hover { background: var(--surface); }

  .card-num {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 96px;
    line-height: 1;
    color: rgba(255,255,255,0.04);
    position: absolute;
    top: 16px; right: 24px;
    letter-spacing: .02em;
  }
  .card-tag {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .18em;
    text-transform: uppercase;
    margin-bottom: 20px;
    display: inline-block;
    padding: 4px 10px;
    border-radius: 2px;
  }
  .tag-live { background: rgba(46,139,87,0.15); color: #4CAF85; border: 1px solid rgba(46,139,87,0.3); }
  .tag-ongoing { background: rgba(42,94,173,0.15); color: #6B9FE4; border: 1px solid rgba(42,94,173,0.35); }
  .tag-soon { background: rgba(107,107,107,0.1); color: var(--muted); border: 1px solid rgba(107,107,107,0.2); }

  .card-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 48px;
    letter-spacing: .04em;
    line-height: 1.05;
    color: var(--white);
    margin-bottom: 16px;
  }
  .card-notice {
    font-size: 11px;
    color: rgba(242,239,232,0.3);
    line-height: 1.4;
    margin-top: 10px;
    font-style: italic;
  }
  .card-desc {
    font-size: 14px;
    color: rgba(242,239,232,0.45);
    line-height: 1.6;
    max-width: 320px;
    margin-bottom: 20px;
  }
  .card-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
  .meta-pill {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: rgba(232,193,74,0.6);
    background: rgba(232,193,74,0.06);
    border: 1px solid rgba(232,193,74,0.15);
    padding: 3px 8px;
    border-radius: 2px;
  }
  .card-arrow {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--gold);
    margin-top: 24px;
    transition: transform .2s;
    display: inline-block;
  }
  .card-accent {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
  }
  .accent-gold { background: var(--gold); }
  .accent-green { background: var(--green); }

  .engine-section { border-top: 1px solid rgba(255,255,255,0.06); }
  .engine-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 2px;
    max-width: 1100px;
  }
  .engine-card {
    background: var(--surface);
    padding: 36px;
    border: 1px solid rgba(255,255,255,0.04);
  }
  .engine-num {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .2em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 14px;
  }
  .engine-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 26px;
    letter-spacing: .04em;
    color: var(--white);
    margin-bottom: 10px;
  }
  .engine-desc { font-size: 14px; color: rgba(242,239,232,0.45); line-height: 1.6; }

  @media (max-width: 900px) {
    .page-hero { padding: 120px 24px 60px; }
    .section { padding: 60px 24px; }
    .games-grid { grid-template-columns: 1fr; }
    .engine-grid { grid-template-columns: 1fr; }
  }
</style>