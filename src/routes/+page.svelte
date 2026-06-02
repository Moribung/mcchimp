<script>
  import { onMount } from 'svelte';

  onMount(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(el => {
        if (el.isIntersecting) {
          el.target.style.opacity = '1';
          el.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.game-card, .how-card').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity .6s ease, transform .6s ease';
      obs.observe(el);
    });
  });
</script>

<!-- HERO -->
<section class="hero">
  <div class="hero-bg"></div>
  <div class="hero-tag fade-up">Sports Trivia Platform</div>
  <h1 class="fade-up delay-1">Know Your<br><em>Sport</em></h1>
  <p class="hero-sub fade-up delay-2">Multiple-choice trivia games built around real sports careers. Answer questions. Climb the rankings. Win the belt.</p>
  <div class="hero-actions fade-up delay-3">
    <a href="/mma" class="btn-primary">Play MMA Trivia</a>
    <a href="/embeds/football.html" class="btn-primary" style="background:var(--blue)">Play Football Demo</a>
    <a href="#games" class="btn-ghost">See All Games</a>
  </div>
</section>

<!-- TICKER -->
<div class="ticker-wrap">
  <div class="ticker">
    <div class="ticker-item"><span>MMA Career Trivia</span> Now Live</div>
    <div class="ticker-item"><span>Football Trivia</span> In Development</div>
    <div class="ticker-item"><span>Multiple Choice</span> Gameplay</div>
    <div class="ticker-item"><span>Career Mode</span> Included</div>
    <div class="ticker-item"><span>Sparring Mode</span> Practice Free</div>
    <div class="ticker-item"><span>Question Sets</span> Modular</div>
    <div class="ticker-item"><span>MMA Career Trivia</span> Now Live</div>
    <div class="ticker-item"><span>Football Trivia</span> In Development</div>
    <div class="ticker-item"><span>Multiple Choice</span> Gameplay</div>
    <div class="ticker-item"><span>Career Mode</span> Included</div>
    <div class="ticker-item"><span>Sparring Mode</span> Practice Free</div>
    <div class="ticker-item"><span>Question Sets</span> Modular</div>
  </div>
</div>

<!-- GAMES -->
<section class="section" id="games">
  <div class="section-label">The Games</div>
  <div class="section-title">Pick Your Sport</div>
  <div class="games-grid">

    <a href="/mma" class="game-card">
      <div class="card-num">01</div>
      <div class="card-tag tag-live">● Live Now</div>
      <div class="card-title">MMA Career<br>Trivia</div>
      <p class="card-desc">Build a fighter from the regional circuit to world champion. Every fight is decided by a trivia question. How far can your knowledge take you?</p>
      <div class="card-arrow">Play Now</div>
      <div class="card-accent accent-gold"></div>
    </a>

    <a href="/embeds/football.html" class="game-card">
      <div class="card-num">02</div>
      <div class="card-tag tag-ongoing">● Ongoing</div>
      <div class="card-title">Football<br>Trivia</div>
      <p class="card-desc">Manage a career across the football pyramid. Tactics, transfers, and trivia — your knowledge of the game determines everything.</p>
      <p class="card-notice">Demo only — progress is not saved and question uploads are not supported.</p>
      <div class="card-arrow">Play Demo</div>
      <div class="card-accent accent-green"></div>
    </a>

  </div>
</section>

<!-- HOW IT WORKS -->
<section class="section" id="how" style="padding-top:0">
  <div class="section-label">The Format</div>
  <div class="section-title">How It Works</div>
  <div class="how-grid">

    <div class="how-card">
      <div class="how-num">01 / Answer</div>
      <div class="how-title">Every Match is a Question</div>
      <p class="how-desc">Answer a trivia question under a countdown timer. Get it right and your team converts. Get it wrong and the opponent does. Speed and accuracy determine the scoreline — not luck.</p>
    </div>

    <div class="how-card">
      <div class="how-num">02 / Compete</div>
      <div class="how-title">Build a Real Career</div>
      <p class="how-desc">Fight your way up from the regional circuit to a world title, or guide a club from the second division to the top of the table. Every promotion, every win, every trophy — earned through knowledge.</p>
    </div>

    <div class="how-card">
      <div class="how-num">03 / Adapt</div>
      <div class="how-title">Questions Learn From You</div>
      <p class="how-desc">Questions you get right become easier over time. Questions you miss get harder. The difficulty calibrates to your knowledge — not a fixed curve, but a moving target shaped by your own history.</p>
    </div>

    <div class="how-card">
      <div class="how-num">04 / Decide</div>
      <div class="how-title">Tactics Change Everything</div>
      <p class="how-desc">Play aggressive and face more questions per match — higher risk, higher reward. Sit back defensively and face fewer. Every game lets you choose how much you want to stake on your knowledge.</p>
    </div>

  </div>
</section>

<!-- CONTACT -->
<section class="signup-section" id="contact">
  <div class="signup-left">
    <div class="section-label" style="margin-bottom:12px">Contact</div>
    <h2>Questions?<br>Say Hello.</h2>
    <p>If you have questions, suggestions or just want to reach out — we'd love to hear from you.</p>
  </div>
  <a href="mailto:multiplechoicechimp@gmail.com" class="btn-primary" style="font-size:15px;padding:18px 32px;align-self:center;white-space:nowrap;">
    multiplechoicechimp@gmail.com
  </a>
</section>

<style>
 .hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 80px 48px 60px;
  position: relative;
  overflow: hidden;
}
  .hero-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 80% 50%, rgba(232,193,74,0.06) 0%, transparent 70%),
      radial-gradient(ellipse 40% 60% at 10% 80%, rgba(42,94,173,0.08) 0%, transparent 60%);
  }
  .hero-tag {
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
  .hero-tag::before {
    content: '';
    display: block;
    width: 32px;
    height: 2px;
    background: var(--gold);
  }
  h1 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(72px, 11vw, 160px);
    line-height: .92;
    letter-spacing: .02em;
    color: var(--white);
    max-width: 900px;
    position: relative;
    z-index: 1;
  }
  h1 em {
    font-style: normal;
    color: var(--gold);
    position: relative;
    display: inline-block;
  }
  h1 em::after {
    content: '';
    position: absolute;
    left: 0; bottom: -4px; right: 0;
    height: 4px;
    background: var(--gold);
    border-radius: 2px;
  }
  .hero-sub {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: clamp(18px, 2.2vw, 26px);
    font-weight: 400;
    color: rgba(242,239,232,0.55);
    margin-top: 36px;
    max-width: 520px;
    line-height: 1.4;
    position: relative;
    z-index: 1;
  }
  .hero-actions {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-top: 48px;
    flex-wrap: wrap;
    position: relative;
    z-index: 1;
  }
  .btn-primary {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    background: var(--gold);
    color: var(--black);
    border: none;
    padding: 16px 36px;
    border-radius: 2px;
    cursor: pointer;
    text-decoration: none;
    transition: background .2s, transform .15s;
    display: inline-block;
  }
  .btn-primary:hover { background: var(--gold2); transform: translateY(-1px); }
  .btn-ghost {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: .1em;
    text-transform: uppercase;
    background: transparent;
    color: var(--white);
    border: 1px solid rgba(242,239,232,0.2);
    padding: 15px 36px;
    border-radius: 2px;
    cursor: pointer;
    text-decoration: none;
    transition: border-color .2s, color .2s;
    display: inline-block;
  }
  .btn-ghost:hover { border-color: rgba(242,239,232,0.5); }

  .ticker-wrap {
    overflow: hidden;
    border-top: 1px solid rgba(232,193,74,0.2);
    border-bottom: 1px solid rgba(232,193,74,0.2);
    padding: 14px 0;
    background: rgba(232,193,74,0.03);
    margin-top: 80px;
  }
  .ticker {
    display: flex;
    white-space: nowrap;
    animation: ticker 28s linear infinite;
  }
  .ticker-item {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: .16em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 0 40px;
  }
  .ticker-item span { color: var(--gold); margin-right: 40px; }
  @keyframes ticker {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  .section { padding: 120px 48px; }
  .section-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .2em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 16px;
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
    margin-bottom: 60px;
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
  .card-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 48px;
    letter-spacing: .04em;
    line-height: 1.05;
    color: var(--white);
    margin-bottom: 16px;
  }
  .card-desc {
    font-size: 14px;
    color: rgba(242,239,232,0.45);
    line-height: 1.6;
    max-width: 320px;
  }
  .card-notice {
    font-size: 11px;
    color: rgba(242,239,232,0.3);
    line-height: 1.4;
    margin-top: 10px;
    font-style: italic;
  }
  .card-arrow {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--gold);
    margin-top: 32px;
    transition: transform .2s;
  }
  .card-accent {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
  }
  .accent-gold { background: var(--gold); }
  .accent-green { background: var(--green); }

  .how-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    max-width: 1100px;
  }
  .how-card {
    background: var(--surface);
    padding: 40px;
    border: 1px solid rgba(255,255,255,0.04);
  }
  .how-num {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .2em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 16px;
  }
  .how-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 28px;
    letter-spacing: .04em;
    color: var(--white);
    margin-bottom: 12px;
  }
  .how-desc { font-size: 14px; color: rgba(242,239,232,0.45); line-height: 1.6; }

  .signup-section {
    padding: 100px 48px;
    border-top: 1px solid rgba(255,255,255,0.04);
    border-bottom: 1px solid rgba(255,255,255,0.04);
    display: flex;
    gap: 80px;
    align-items: center;
    justify-content: space-between;
  }
  .signup-left h2 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(36px, 5vw, 64px);
    letter-spacing: .03em;
    line-height: 1;
    color: var(--white);
    margin-bottom: 12px;
  }
  .signup-left p { font-size: 15px; color: rgba(242,239,232,0.45); max-width: 360px; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp .7s cubic-bezier(0.22,1,0.36,1) both; }
  .delay-1 { animation-delay: .1s; }
  .delay-2 { animation-delay: .2s; }
  .delay-3 { animation-delay: .35s; }

@media (max-width: 900px) {
  .hero { padding: 100px 24px 60px; }
  .section { padding: 80px 24px; }
  .games-grid { grid-template-columns: 1fr; }
  .how-grid { grid-template-columns: 1fr 1fr; }
  .signup-section { flex-direction: column; gap: 40px; padding: 80px 24px; align-items: flex-start; }
}
@media (max-width: 600px) {
  .how-grid { grid-template-columns: 1fr; }
}
</style>