<svelte:head>
  <title>How It Works — McChimp</title>
  <meta name="description" content="A quick guide to using McChimp — uploading questions, building sets, starting a career, and tracking your progress." />
</svelte:head>

<div class="guide">

  <div class="guide-label">How It Works</div>

  <div class="step">
    <div class="step-num">01</div>
    <div class="step-body">
      <h2>Get a question set</h2>
      <p>
        Every game runs on a question set — a JSON file grouped into four difficulty tiers (easy, medium, hard, elite).
        Browse what's already available on the <a href="/questions/sets">question sets page</a>; built-in sets cover MMA, football, animal biology, and economics.
        If you want something custom, use the <a href="/questions/generator">question set builder</a> to write your own directly in the browser.
        Alternatively, download the <a href="/questions/guide">format guide</a> and drop it into any LLM — it contains the full spec so the model outputs a correctly structured file you can import straight away.
      </p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">02</div>
    <div class="step-body">
      <h2>Save and organise sets in your library</h2>
      <p>
        Once you have a question set, save it to your <a href="/questions/library">library</a> (requires a free account).
        Your library is where all your uploaded and generated sets live. From there you can review them, edit individual questions,
        and organise sets before loading them into a game. You can have multiple sets saved — one per topic, one per subject, whatever makes sense for how you use it.
      </p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">03</div>
    <div class="step-body">
      <h2>Start a game and pick your set</h2>
      <p>
        Head to <a href="/mma">MMA Career</a> or <a href="/football">Football Career Manager</a> and start a new career or sparring session.
        Before the first fight you'll choose which question set to play with — your saved library sets appear alongside the built-in ones.
        Pick a set, choose your career length and difficulty, and go.
        Each match resolves through a question: answer correctly and your side converts; answer wrong and the opponent does.
      </p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">04</div>
    <div class="step-body">
      <h2>The game tracks what you know</h2>
      <p>
        As you play, every question you answer is recorded. Questions you consistently get right become harder;
        ones you miss regularly ease back down. This happens automatically in the background — you don't configure it.
        The difficulty of each question shifts individually based on your personal history with it.
      </p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">05</div>
    <div class="step-body">
      <h2>Review your progress</h2>
      <p>
        Your <a href="/dashboard">dashboard</a> shows career stats — records, titles, fight history across all saved careers.
        The <a href="/learn">learning progress page</a> shows how your knowledge is developing per question set:
        which questions you've mastered, which are still shaky, and how many are in active learning.
        If you want to study outside the game, the <a href="/learn/study">study mode</a> lets you drill questions directly from any set in your library.
      </p>
    </div>
  </div>

  <div class="guide-footer">
    <p>Detailed guides for the MMA career mode and football manager are coming. For now, the best way to learn the game mechanics is to play — careers save automatically, so nothing is lost if you close mid-session.</p>
    <div class="guide-ctas">
      <a href="/mma" class="btn-primary">Play MMA</a>
      <a href="/questions/sets" class="btn-ghost">Browse Question Sets</a>
    </div>
  </div>

</div>

<style>
  .guide {
    max-width: 720px;
    margin: 0 auto;
    padding: 120px 48px 100px;
  }

  .guide-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .2em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 56px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .guide-label::before {
    content: '';
    display: block;
    width: 24px;
    height: 1px;
    background: var(--gold);
  }

  .step {
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 24px;
    margin-bottom: 56px;
    padding-bottom: 56px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .step:last-of-type {
    border-bottom: none;
  }

  .step-num {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 13px;
    letter-spacing: .12em;
    color: var(--gold);
    padding-top: 6px;
    opacity: .7;
  }

  h2 {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: .04em;
    color: var(--white);
    margin-bottom: 14px;
    text-transform: uppercase;
  }

  p {
    font-size: 15px;
    color: rgba(242,239,232,0.55);
    line-height: 1.75;
  }

  /* Inline highlighted links */
  a {
    color: var(--gold);
    text-decoration: none;
    border-bottom: 1px solid rgba(232,193,74,0.35);
    transition: border-color .15s, color .15s;
  }
  a:hover {
    color: #F2EFE8;
    border-bottom-color: rgba(242,239,232,0.4);
  }

  .guide-footer {
    margin-top: 16px;
    padding-top: 48px;
    border-top: 1px solid rgba(255,255,255,0.05);
  }
  .guide-footer p {
    margin-bottom: 32px;
    font-size: 14px;
    color: rgba(242,239,232,0.35);
    font-style: italic;
  }
  .guide-ctas {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
  }

  .btn-primary {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    background: var(--gold);
    color: var(--black);
    border: none;
    border-bottom: none;
    padding: 14px 32px;
    border-radius: 2px;
    text-decoration: none;
    transition: background .2s, transform .15s;
    display: inline-block;
  }
  .btn-primary:hover {
    background: var(--gold2);
    transform: translateY(-1px);
    color: var(--black);
    border-bottom: none;
  }

  .btn-ghost {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: .1em;
    text-transform: uppercase;
    background: transparent;
    color: var(--white);
    border: 1px solid rgba(242,239,232,0.2);
    border-bottom: 1px solid rgba(242,239,232,0.2);
    padding: 13px 32px;
    border-radius: 2px;
    text-decoration: none;
    transition: border-color .2s, color .2s;
    display: inline-block;
  }
  .btn-ghost:hover {
    border-color: rgba(242,239,232,0.5);
    color: var(--white);
  }

  @media (max-width: 600px) {
    .guide { padding: 100px 24px 60px; }
    .step { grid-template-columns: 36px 1fr; gap: 16px; margin-bottom: 40px; padding-bottom: 40px; }
  }
</style>
