<svelte:head>
  <title>About Us — McChimp</title>
  <meta name="description" content="McChimp builds sports career simulators powered by knowledge. Find out who we are and get in touch." />
</svelte:head>

<!-- HERO -->
<div class="page-hero">
  <div class="page-hero-tag">About McChimp</div>
  <h1>Built on a<br><em>Simple Idea</em></h1>
  <p>Sports career games where your knowledge is the only stat that matters.</p>
</div>

<!-- WHAT WE'RE BUILDING -->
<section class="section">
  <div class="section-label">What We're Building</div>
  <div class="about-grid">
    <div class="about-block">
      <h2>The Idea</h2>
      <p>Most sports games simulate athletes and managers by shuffling numbers behind the scenes. We wanted something different — a game where the result of every match, every fight, every moment on the pitch comes directly from you.</p>
      <p>McChimp is a career simulation engine where knowledge is the mechanic. You don't configure stats or pick from menus to resolve a match. You answer a question. That answer — correct or wrong, fast or slow — is what happens on the field.</p>
    </div>
    <div class="about-block">
      <h2>Where It's At</h2>
      <p>The MMA career mode is live. You can build a fighter from unsigned prospect to world champion across three career phases, with adaptive difficulty, full career records, titles, and callouts.</p>
      <p>The football career manager is in active development. A demo is available — it's playable but progress isn't saved yet and the full feature set isn't in place. The recode is underway.</p>
      <p>More sports and game modes are planned. The engine is designed to be modular — any question set, any sport, any topic.</p>
    </div>
    <div class="about-block">
      <h2>The Team</h2>
      <p>McChimp is an independent project, built by a small team. We're not a studio. We're people who wanted this kind of game to exist and decided to build it.</p>
      <p>Everything — the game engine, the question format, the adaptive difficulty system, the career logic — is built in-house.</p>
    </div>
    <div class="about-block">
      <h2>Question Sets</h2>
      <p>The games ship with built-in question sets covering MMA, football, animal biology, and economics. But the engine doesn't care what the questions are about.</p>
      <p>You can upload any compatible JSON question set and run it through the same career simulation. The format is documented and the AI-assisted generator is available to help build your own.</p>
    </div>
  </div>
</section>

<!-- CONTACT -->
<section class="contact-section" id="contact">
  <div class="contact-inner">
    <div class="contact-left">
      <div class="section-label">Contact Us</div>
      <h2>Get in Touch</h2>
      <p>Questions, suggestions, bug reports, ideas for new question sets — anything at all. We read everything.</p>
    </div>
    <div class="contact-right">
      <a href="mailto:multiplechoicechimp@gmail.com" class="contact-email">
        multiplechoicechimp@gmail.com
      </a>
      <p class="contact-note">No contact form — just email us directly. We'll get back to you.</p>
    </div>
  </div>
</section>

<style>
  .page-hero {
    padding: 160px 48px 100px;
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
    font-size: clamp(56px, 8vw, 110px);
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
    font-size: clamp(18px, 2.2vw, 26px);
    color: rgba(242,239,232,0.45);
    max-width: 500px;
    line-height: 1.5;
  }

  .section {
    padding: 100px 48px;
  }
  .section-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .2em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 48px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-label::before {
    content: '';
    display: block;
    width: 24px;
    height: 1px;
    background: var(--gold);
  }

  .about-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    max-width: 1100px;
  }
  .about-block {
    background: var(--surface);
    padding: 40px;
    border: 1px solid rgba(255,255,255,0.04);
  }
  .about-block h2 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 28px;
    letter-spacing: .04em;
    color: var(--white);
    margin-bottom: 16px;
  }
  .about-block p {
    font-size: 14px;
    color: rgba(242,239,232,0.5);
    line-height: 1.7;
    margin-bottom: 12px;
  }
  .about-block p:last-child { margin-bottom: 0; }

  /* CONTACT */
  .contact-section {
    border-top: 1px solid rgba(255,255,255,0.06);
    padding: 100px 48px;
  }
  .contact-inner {
    display: flex;
    gap: 80px;
    align-items: center;
    justify-content: space-between;
    max-width: 1100px;
  }
  .contact-left h2 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(36px, 5vw, 64px);
    letter-spacing: .03em;
    line-height: 1;
    color: var(--white);
    margin-bottom: 12px;
  }
  .contact-left p {
    font-size: 15px;
    color: rgba(242,239,232,0.45);
    max-width: 360px;
    line-height: 1.6;
  }
  .contact-right {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    flex-shrink: 0;
  }
  .contact-email {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    background: var(--gold);
    color: var(--black);
    padding: 18px 32px;
    border-radius: 2px;
    text-decoration: none;
    transition: background .2s, transform .15s;
    display: inline-block;
  }
  .contact-email:hover { background: var(--gold2); transform: translateY(-1px); }
  .contact-note {
    font-size: 12px;
    color: rgba(242,239,232,0.3);
    font-style: italic;
  }

  @media (max-width: 900px) {
    .page-hero { padding: 120px 24px 60px; }
    .section { padding: 60px 24px; }
    .about-grid { grid-template-columns: 1fr; }
    .contact-section { padding: 60px 24px; }
    .contact-inner { flex-direction: column; gap: 40px; align-items: flex-start; }
  }
</style>
