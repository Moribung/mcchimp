<svelte:head>
  <title>Questions — McChimp</title>
  <meta name="description" content="Browse, build and manage question sets for McChimp trivia games." />
</svelte:head>

<div class="overview">

  <!-- INTRO -->
  <div class="overview-intro">
    <h2>How the Question System Works</h2>
    <p>McChimp games don't have fixed question banks hardcoded into them. Instead, every game loads questions from a <strong>modular JSON file</strong> — a structured document you can write yourself, generate with AI, or download from our library.</p>
    <p>This means you can play any game with <strong>any topic</strong>. An MMA career with driving theory questions. A football career tested on economics. The game engine doesn't care — it only cares about the structure of the file.</p>
  </div>

  <!-- QUESTION TYPES -->
  <div class="section-block">
    <h2>Question Types</h2>
    <p>Seven question formats are supported. The first five are live — write them now and they'll render immediately. The last two are defined in the schema and can be authored, but the renderer isn't built yet.</p>
    <div class="types-grid">
      <div class="type-card type-live">
        <div class="type-name">Multi Select</div>
        <div class="type-desc">Select all correct answers. Wrong selections subtract points. <span class="type-default">Default type.</span></div>
        <span class="type-badge badge-live">✓ Live</span>
      </div>
      <div class="type-card type-live">
        <div class="type-name">Multiple Choice</div>
        <div class="type-desc">One correct answer only. Clicking a new option unticks the previous.</div>
        <span class="type-badge badge-live">✓ Live</span>
      </div>
      <div class="type-card type-live">
        <div class="type-name">True / False</div>
        <div class="type-desc">Binary question. Two options only — True or False.</div>
        <span class="type-badge badge-live">✓ Live</span>
      </div>
      <div class="type-card type-live">
        <div class="type-name">Typed Answer</div>
        <div class="type-desc">User types one or more answers. Checked against a pool of accepted values. Order irrelevant.</div>
        <span class="type-badge badge-live">✓ Live</span>
      </div>
      <div class="type-card type-live">
        <div class="type-name">Fill the Gap</div>
        <div class="type-desc">A sentence with ___ placeholders. User types each missing value in order. Multiple gaps supported.</div>
        <span class="type-badge badge-live">✓ Live</span>
      </div>
      <div class="type-card type-soon">
        <div class="type-name">Ordered</div>
        <div class="type-desc">User arranges items into the correct sequence. Each item can have a description shown after reveal.</div>
        <span class="type-badge badge-soon">⏳ Coming Soon</span>
      </div>
      <div class="type-card type-soon">
        <div class="type-name">Image</div>
        <div class="type-desc">An image is shown to the user, answered as multiple choice. Requires Storage setup.</div>
        <span class="type-badge badge-soon">⏳ Needs Storage</span>
      </div>
    </div>
  </div>

  <!-- DIFFICULTY TIERS -->
  <div class="section-block">
    <h2>Difficulty Tiers <span class="game-badge">All Games</span></h2>
    <p>Every question set is organised into four difficulty tiers. The game selects questions based on your current rank and career phase.</p>
    <div class="tier-pills">
      <div class="tier-pill pill-easy">
        <span class="pill-name">Easy</span>
        <span class="pill-desc">Early career · lower-ranked opponents</span>
      </div>
      <div class="tier-pill pill-medium">
        <span class="pill-name">Medium</span>
        <span class="pill-desc">Mid-career · mid-ranked opponents</span>
      </div>
      <div class="tier-pill pill-hard">
        <span class="pill-name">Hard</span>
        <span class="pill-desc">Top organisations · ranked opponents</span>
      </div>
      <div class="tier-pill pill-elite">
        <span class="pill-name">Elite</span>
        <span class="pill-desc">Title fights · championship bouts</span>
      </div>
    </div>
  </div>

  <!-- ADAPTIVE DIFFICULTY -->
  <div class="section-block">
    <h2>Adaptive Difficulty <span class="game-badge">All Games</span></h2>
    <p>The game tracks your personal score on every question — <strong>+1 for correct, −1 for wrong</strong>. When your score on a question crosses a threshold, its effective difficulty shifts up or down for you specifically.</p>
    <p>A hard question you've answered correctly twice becomes medium difficulty for you. A medium question you keep getting wrong gets harder. The difficulty is shaped by your own history, not a fixed curve — meaning the game gets harder in exactly the areas where you're weakest.</p>
    <p>This also means two players using the same question set will experience different difficulty progressions.</p>
  </div>

  <!-- GAME-SPECIFIC NOTES -->
  <div class="section-block">
    <h2>Fighter-Owned Questions <span class="game-badge game-badge-mma">MMA Game</span></h2>
    <p>In the MMA game, each opponent in the division owns a specific question from the pool. You face the same question every time you fight that opponent — until you beat them <strong>twice consecutively</strong>, at which point they draw a fresh question.</p>
    <p>This means rematches are meaningful. If you lost because you didn't know the answer, you'll need to learn it before the rematch counts.</p>
  </div>

  <!-- NAV CARDS -->
  <div class="tab-cards">
    <a href="/questions/sets" class="tab-card">
      <div class="tc-title">Question Sets</div>
      <p class="tc-desc">Browse and download our native question sets. Each is ready to drop into any McChimp game immediately.</p>
      <div class="tc-arrow">Browse Sets →</div>
    </a>
    <a href="/questions/guide" class="tab-card">
      <div class="tc-title">AI Guide</div>
      <p class="tc-desc">Learn how to prompt an AI assistant to generate a fully compatible question set. Includes a downloadable instruction file.</p>
      <div class="tc-arrow">Go to AI Guide →</div>
    </a>
    <a href="/questions/generator" class="tab-card">
      <div class="tc-title">Generator</div>
      <p class="tc-desc">Build a question set from scratch in the browser. Add questions, set difficulty, mark correct answers, then download as JSON.</p>
      <div class="tc-arrow">Open Generator →</div>
    </a>
  </div>

</div>

<style>
  .overview { padding: 72px 48px; }

  .overview-intro { max-width: 680px; margin-bottom: 56px; }
  .overview-intro h2 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(32px,4vw,52px); letter-spacing: .04em; color: var(--white); margin-bottom: 16px; line-height: 1; }
  .overview-intro p { font-size: 15px; color: rgba(242,239,232,0.55); line-height: 1.75; margin-bottom: 14px; }
  .overview-intro strong { color: var(--white); }

  .section-block { max-width: 900px; margin-bottom: 56px; }
  .section-block h2 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(28px,3.5vw,44px); letter-spacing: .04em; color: var(--white); margin-bottom: 14px; line-height: 1; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .section-block p { font-size: 15px; color: rgba(242,239,232,0.55); line-height: 1.75; margin-bottom: 14px; max-width: 680px; }
  .section-block p strong { color: var(--white); }

  .game-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: rgba(107,107,107,0.12); color: var(--muted); border: 1px solid rgba(107,107,107,0.2); padding: 3px 8px; border-radius: 2px; vertical-align: middle; }
  .game-badge-mma { background: rgba(232,193,74,0.1); color: var(--gold); border-color: rgba(232,193,74,0.25); }

  /* TYPES GRID */
  .types-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 2px; margin-top: 20px; }
  .type-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.04); padding: 20px; display: flex; flex-direction: column; gap: 6px; position: relative; }
  .type-live { border-left: 2px solid rgba(46,139,87,0.4); }
  .type-soon { border-left: 2px solid rgba(107,107,107,0.2); opacity: .7; }
  .type-name { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: .04em; color: var(--white); }
  .type-desc { font-size: 12px; color: rgba(242,239,232,0.45); line-height: 1.5; flex: 1; }
  .type-default { color: var(--gold); }
  .type-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 2px 8px; border-radius: 2px; margin-top: 8px; align-self: flex-start; }
  .badge-live { background: rgba(46,139,87,0.12); color: #4CAF85; border: 1px solid rgba(46,139,87,0.25); }
  .badge-soon { background: rgba(107,107,107,0.1); color: var(--muted); border: 1px solid rgba(107,107,107,0.2); }

  /* TIER PILLS */
  .tier-pills { display: flex; gap: 2px; flex-wrap: wrap; margin-top: 20px; }
  .tier-pill { display: flex; flex-direction: column; gap: 4px; padding: 16px 20px; border-radius: 2px; min-width: 160px; flex: 1; }
  .pill-easy { background: rgba(46,139,87,0.08); border: 1px solid rgba(46,139,87,0.2); }
  .pill-medium { background: rgba(232,193,74,0.08); border: 1px solid rgba(232,193,74,0.2); }
  .pill-hard { background: rgba(42,94,173,0.08); border: 1px solid rgba(42,94,173,0.2); }
  .pill-elite { background: rgba(180,74,232,0.08); border: 1px solid rgba(180,74,232,0.2); }
  .pill-name { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: .04em; }
  .pill-easy .pill-name { color: #4CAF85; }
  .pill-medium .pill-name { color: var(--gold); }
  .pill-hard .pill-name { color: #6B9FE4; }
  .pill-elite .pill-name { color: #C07AEA; }
  .pill-desc { font-size: 12px; color: rgba(242,239,232,0.4); line-height: 1.4; }

  /* NAV CARDS */
  .tab-cards { display: grid; grid-template-columns: repeat(3,1fr); gap: 2px; max-width: 1000px; margin-top: 56px; }
  .tab-card { background: var(--surface); padding: 36px; border: 1px solid rgba(255,255,255,0.04); text-decoration: none; display: block; transition: background .2s; }
  .tab-card:hover { background: #1E2023; }
  .tab-card:hover .tc-arrow { transform: translate(3px,-3px); }
  .tc-title { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: .04em; color: var(--white); margin-bottom: 8px; }
  .tc-desc { font-size: 13px; color: rgba(242,239,232,0.45); line-height: 1.6; margin-bottom: 20px; }
  .tc-arrow { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--gold); transition: transform .2s; display: inline-block; }

  @media (max-width: 900px) {
    .overview { padding: 48px 24px; }
    .tab-cards { grid-template-columns: 1fr; }
    .tier-pills { flex-direction: column; }
    .types-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 600px) {
    .types-grid { grid-template-columns: 1fr; }
  }
</style>
