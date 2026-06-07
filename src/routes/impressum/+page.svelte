<script>
  // Impressum / Legal Notice — required under § 5 DDG (formerly § 5 TMG).
  // TODO: Replace the placeholder values below with the operator's real legal details.
  // An Impressum must contain an actual name and a physical postal address
  // (a P.O. box is not sufficient) plus a means of rapid electronic contact.
  const operator = {
    name: 'Moritz Bungenberg',
    addressLine1: 'Pirmasenser Straße 3',
    addressLine2: '30559 Hannover',
    country: 'Deutschland',
    email: 'multiplechoicechimp@gmail.com',
  };
</script>

<svelte:head>
  <title>Impressum — McChimp</title>
</svelte:head>

<div class="hero">
  <div class="hero-inner">
    <div class="hero-eyebrow">Legal</div>
    <h1 class="hero-title">Impressum</h1>
    <div class="hero-meta">
      <span class="hero-meta-item">Legal notice under <strong>§ 5 DDG</strong></span>
      <span class="dot"></span>
      <span class="hero-meta-item">Operator: <strong>mcchimp.com</strong></span>
    </div>
  </div>
</div>

<div class="layout">
  <main class="content">

    <section class="section" id="provider">
      <div class="section-header"><span class="section-num">01</span><h2 class="section-title">Information pursuant to § 5 DDG</h2></div>
      <p>This website (mcchimp.com) is operated by:</p>
      <div class="contact-block">
        <p><strong>{operator.name}</strong></p>
        <p>{operator.addressLine1}</p>
        <p>{operator.addressLine2}</p>
        <p>{operator.country}</p>
      </div>
    </section>

    <section class="section" id="contact">
      <div class="section-header"><span class="section-num">02</span><h2 class="section-title">Contact</h2></div>
      <div class="contact-block">
        <p><strong>Email:</strong> <a href="mailto:{operator.email}">{operator.email}</a></p>
      </div>
    </section>

    <section class="section" id="responsible">
      <div class="section-header"><span class="section-num">03</span><h2 class="section-title">Responsible for Content</h2></div>
      <p>Responsible for the content of this website pursuant to § 18 (2) MStV:</p>
      <div class="contact-block">
        <p><strong>{operator.name}</strong></p>
        <p>{operator.addressLine1}</p>
        <p>{operator.addressLine2}</p>
      </div>
    </section>

    <section class="section" id="liability">
      <div class="section-header"><span class="section-num">04</span><h2 class="section-title">Liability for Content &amp; Links</h2></div>
      <p>As a service provider, we are responsible for our own content on these pages in accordance with general law. We are not, however, obliged to monitor transmitted or stored third-party information, or to investigate circumstances that indicate illegal activity. Obligations to remove or block the use of information under general law remain unaffected; any liability in this regard begins only from the time we become aware of a specific infringement, and we will remove such content promptly.</p>
      <p>Our site may contain links to external websites over whose content we have no control. We therefore cannot accept any responsibility for this third-party content. The respective provider or operator of the linked pages is always responsible for their content. Linked pages were checked for possible legal violations at the time of linking; no unlawful content was apparent at that time.</p>
    </section>

    <section class="section" id="copyright">
      <div class="section-header"><span class="section-num">05</span><h2 class="section-title">Copyright</h2></div>
      <p>The content and works created by the site operator on these pages are subject to copyright law. Reproduction, editing, distribution, and any kind of use beyond the limits of copyright require the written consent of the respective author or creator. Downloads and copies of this site are permitted for private, non-commercial use only.</p>
    </section>

    <section class="section" id="dispute">
      <div class="section-header"><span class="section-num">06</span><h2 class="section-title">Dispute Resolution</h2></div>
      <p>The European Commission provides a platform for online dispute resolution (ODR) at <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">ec.europa.eu/consumers/odr</a>. We are not obliged and not generally willing to participate in dispute resolution proceedings before a consumer arbitration board.</p>
    </section>

  </main>
</div>

<style>
  .hero {
    padding: 120px 48px 48px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    position: relative;
  }
  .hero::before {
    content: '';
    position: absolute;
    top: 64px; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--gold), var(--blue), transparent);
  }
  .hero-inner { max-width: 760px; }
  .hero-eyebrow {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .2em;
    text-transform: uppercase; color: var(--gold); margin-bottom: 12px;
  }
  .hero-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(42px, 6vw, 72px);
    line-height: 1; letter-spacing: .03em; color: var(--white); margin-bottom: 20px;
  }
  .hero-meta { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
  .hero-meta-item { font-size: 13px; color: var(--muted); }
  .hero-meta-item strong { color: var(--white); font-weight: 500; }
  .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--muted); display: inline-block; }

  .layout {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 48px;
  }
  .content { padding: 48px 0 80px; min-width: 0; }

  .section { margin-bottom: 56px; scroll-margin-top: 90px; }
  .section-header {
    display: flex; align-items: baseline; gap: 14px;
    margin-bottom: 20px; padding-bottom: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .section-num {
    font-family: 'Bebas Neue', sans-serif; font-size: 13px;
    letter-spacing: .12em; color: var(--gold); flex-shrink: 0;
  }
  .section-title {
    font-family: 'Bebas Neue', sans-serif; font-size: 26px;
    letter-spacing: .04em; color: var(--white); line-height: 1.1;
  }
  .section p { color: var(--muted); margin-bottom: 16px; font-size: 15px; line-height: 1.75; }
  .section p strong { color: var(--white); font-weight: 500; }
  .section p a { color: var(--blue); text-decoration: none; border-bottom: 1px solid transparent; transition: border-color .2s; }
  .section p a:hover { border-bottom-color: var(--blue); }

  .contact-block { background: var(--surface); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 24px; margin-top: 4px; }
  .contact-block p { font-size: 14px; margin-bottom: 6px; color: var(--muted); }
  .contact-block p:last-child { margin-bottom: 0; }
  .contact-block a { color: var(--blue); text-decoration: none; }

  @media (max-width: 900px) {
    .layout { padding: 0 24px; }
    .content { padding: 32px 0 60px; }
    .hero { padding: 100px 24px 40px; }
  }
</style>
