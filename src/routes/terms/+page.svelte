<script>
  import { onMount } from 'svelte';

  const sections = [
    ['acceptance', '01', 'Acceptance of Terms'],
    ['eligibility', '02', 'Eligibility'],
    ['account', '03', 'Your Account'],
    ['acceptable-use', '04', 'Acceptable Use'],
    ['your-content', '05', 'Your Content'],
    ['ai', '06', 'AI-Generated Questions'],
    ['ip', '07', 'Intellectual Property'],
    ['availability', '08', 'Service Availability'],
    ['disclaimers', '09', 'Disclaimers'],
    ['liability', '10', 'Limitation of Liability'],
    ['termination', '11', 'Termination'],
    ['changes', '12', 'Changes to These Terms'],
    ['law', '13', 'Governing Law'],
    ['contact', '14', 'Contact'],
  ];

  let activeSection = $state('acceptance');

  onMount(() => {
    const sectionEls = document.querySelectorAll('.section[id]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) activeSection = entry.target.id;
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    sectionEls.forEach(s => observer.observe(s));
    return () => observer.disconnect();
  });
</script>

<svelte:head>
  <title>Terms of Service — McChimp</title>
</svelte:head>

<div class="hero">
  <div class="hero-inner">
    <div class="hero-eyebrow">Legal</div>
    <h1 class="hero-title">Terms of Service</h1>
    <div class="hero-meta">
      <span class="hero-meta-item">Effective: <strong>7 June 2026</strong></span>
      <span class="dot"></span>
      <span class="hero-meta-item">Jurisdiction: <strong>European Union</strong></span>
      <span class="dot"></span>
      <span class="hero-meta-item">Operator: <strong>mcchimp.com</strong></span>
    </div>
  </div>
</div>

<div class="layout">

  <!-- SIDEBAR -->
  <aside class="sidebar">
    <div class="sidebar-label">Contents</div>
    {#each sections as [id, num, label]}
      <a class="nav-link" class:active={activeSection === id} href="#{id}">
        <span class="nav-num">{num}</span>{label}
      </a>
    {/each}
  </aside>

  <!-- CONTENT -->
  <main class="content">

    <section class="section" id="acceptance">
      <div class="section-header"><span class="section-num">01</span><h2 class="section-title">Acceptance of Terms</h2></div>
      <p>These Terms of Service ("Terms") govern your access to and use of mcchimp.com and any games, features, and content we provide (together, the "Service"), operated by mcchimp.com ("we", "us", "our").</p>
      <p>By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, you may not use the Service.</p>
      <p>These Terms work alongside our <a href="/privacy">Privacy Policy</a>, which explains how we handle your personal data.</p>
    </section>

    <section class="section" id="eligibility">
      <div class="section-header"><span class="section-num">02</span><h2 class="section-title">Eligibility</h2></div>
      <p>You must be at least <strong>16 years old</strong> to create an account and use the Service. By registering, you confirm that you are 16 or older.</p>
      <p>The Service is not directed at children under 16, and we do not knowingly allow them to create accounts. If we learn that an account belongs to someone under 16, we may remove it. See the <a href="/privacy">Privacy Policy</a> for how this is handled.</p>
    </section>

    <section class="section" id="account">
      <div class="section-header"><span class="section-num">03</span><h2 class="section-title">Your Account</h2></div>
      <ul>
        <li><strong>Accurate details:</strong> Provide a valid email address and keep your account information current.</li>
        <li><strong>Security:</strong> You are responsible for keeping your password confidential and for all activity that happens under your account.</li>
        <li><strong>One person:</strong> Your account is personal to you. Do not share it or let others use it on your behalf.</li>
        <li><strong>Notify us:</strong> Tell us promptly at <a href="mailto:multiplechoicechimp@gmail.com">multiplechoicechimp@gmail.com</a> if you suspect any unauthorised use of your account.</li>
      </ul>
      <p>You may close your account at any time from your account settings. Closing your account deletes your data as described in the <a href="/privacy">Privacy Policy</a>.</p>
    </section>

    <section class="section" id="acceptable-use">
      <div class="section-header"><span class="section-num">04</span><h2 class="section-title">Acceptable Use</h2></div>
      <p>When using the Service, you agree <strong>not</strong> to:</p>
      <ul>
        <li>Break any applicable law, or infringe the rights of others;</li>
        <li>Attempt to gain unauthorised access to the Service, other accounts, or our systems;</li>
        <li>Probe, scan, overload, disrupt, or otherwise interfere with the Service or its infrastructure;</li>
        <li>Use bots, scrapers, or automated means to access or harvest content except as expressly permitted;</li>
        <li>Reverse engineer, decompile, or attempt to extract the source code of the Service, except where the law expressly allows it;</li>
        <li>Copy, resell, or commercially exploit the Service or its content without our permission;</li>
        <li>Upload or submit content that is unlawful, malicious, or that you do not have the right to use.</li>
      </ul>
      <p>We may suspend or restrict access if we reasonably believe you are breaching these rules.</p>
    </section>

    <section class="section" id="your-content">
      <div class="section-header"><span class="section-num">05</span><h2 class="section-title">Your Content</h2></div>
      <p>The Service lets you create and store content such as custom question sets ("Your Content"). Your Content remains yours.</p>
      <ul>
        <li><strong>Private to you:</strong> The Service does not provide any way to share Your Content with other users. It is stored solely so that you can access it across your own sessions and devices.</li>
        <li><strong>Limited licence:</strong> You grant us a limited licence to store, process, and display Your Content to you for the sole purpose of operating the Service. We do not use it for any other purpose.</li>
        <li><strong>Your responsibility:</strong> You are responsible for Your Content and confirm you have the right to use any material you submit.</li>
        <li><strong>Backups:</strong> While we take reasonable care, we do not guarantee Your Content will never be lost. Keep your own copies of anything important.</li>
      </ul>
    </section>

    <section class="section" id="ai">
      <div class="section-header"><span class="section-num">06</span><h2 class="section-title">AI-Generated Questions</h2></div>
      <p>The Service offers an optional feature that generates quiz questions from text you submit, using a third-party AI provider. By using it, you understand and accept that:</p>
      <ul>
        <li><strong>Accuracy is not guaranteed:</strong> AI-generated questions and answers may be incorrect, incomplete, or misleading. Review them before relying on them.</li>
        <li><strong>Educational use only:</strong> Generated content is for entertainment and general learning. It is not professional, medical, legal, financial, or other expert advice.</li>
        <li><strong>Your input:</strong> Only submit text you have the right to use, and do not submit personal data about yourself or others, as noted in the <a href="/privacy">Privacy Policy</a>.</li>
      </ul>
    </section>

    <section class="section" id="ip">
      <div class="section-header"><span class="section-num">07</span><h2 class="section-title">Intellectual Property</h2></div>
      <p>The Service — including the game engine, adaptive difficulty system, career logic, built-in question sets, design, graphics, and the McChimp name and branding — is owned by us or our licensors and is protected by intellectual property laws.</p>
      <p>We grant you a personal, non-exclusive, non-transferable, revocable licence to use the Service for your own non-commercial enjoyment, subject to these Terms. No other rights are granted.</p>
    </section>

    <section class="section" id="availability">
      <div class="section-header"><span class="section-num">08</span><h2 class="section-title">Service Availability</h2></div>
      <ul>
        <li><strong>Provided "as is":</strong> The Service is offered free of charge and on an "as available" basis. We may change, suspend, or discontinue any part of it at any time.</li>
        <li><strong>Beta features:</strong> Some features (such as the football career mode) are in active development. They may be incomplete, unstable, and progress may not be saved.</li>
        <li><strong>Maintenance and downtime:</strong> We do not guarantee uninterrupted or error-free access and may carry out maintenance with or without notice.</li>
      </ul>
    </section>

    <section class="section" id="disclaimers">
      <div class="section-header"><span class="section-num">09</span><h2 class="section-title">Disclaimers</h2></div>
      <p>To the maximum extent permitted by applicable law, the Service is provided without warranties of any kind, whether express or implied, including fitness for a particular purpose and uninterrupted availability.</p>
      <p>Quiz content is provided for entertainment and general learning only and does not constitute professional advice of any kind.</p>
      <div class="callout warn"><p>Nothing in these Terms limits any rights you have as a consumer that cannot be excluded under applicable law.</p></div>
    </section>

    <section class="section" id="liability">
      <div class="section-header"><span class="section-num">10</span><h2 class="section-title">Limitation of Liability</h2></div>
      <p>To the maximum extent permitted by applicable law, we are not liable for indirect, incidental, or consequential losses, loss of data, or loss of expected savings arising from your use of the Service.</p>
      <p>Nothing in these Terms excludes or limits our liability for:</p>
      <ul>
        <li>death or personal injury caused by our negligence;</li>
        <li>fraud or fraudulent misrepresentation;</li>
        <li>intent or gross negligence; or</li>
        <li>any liability that cannot be excluded or limited under applicable law, including mandatory statutory consumer rights.</li>
      </ul>
      <p>Because the Service is provided free of charge, our liability for ordinary negligence is limited to foreseeable damage typical for a service of this kind, to the extent the law allows.</p>
    </section>

    <section class="section" id="termination">
      <div class="section-header"><span class="section-num">11</span><h2 class="section-title">Termination</h2></div>
      <p>You may stop using the Service and delete your account at any time from your account settings.</p>
      <p>We may suspend or terminate your access if you breach these Terms, if required by law, or if we discontinue the Service. Where reasonable and lawful, we will give you notice. On termination, the licences granted in these Terms end, though any provisions that by their nature should survive (such as intellectual property and limitation of liability) will continue to apply.</p>
    </section>

    <section class="section" id="changes">
      <div class="section-header"><span class="section-num">12</span><h2 class="section-title">Changes to These Terms</h2></div>
      <p>We may update these Terms from time to time. If we make material changes, we will update the effective date above and, where appropriate, notify you. Continuing to use the Service after changes take effect means you accept the updated Terms.</p>
    </section>

    <section class="section" id="law">
      <div class="section-header"><span class="section-num">13</span><h2 class="section-title">Governing Law</h2></div>
      <p>These Terms are governed by the laws of the Federal Republic of Germany, excluding its conflict-of-law rules. If you are a consumer, you also benefit from any mandatory protections of the law of your country of residence.</p>
      <p>The European Commission provides an online dispute resolution platform at <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">ec.europa.eu/consumers/odr</a>. We are not obliged and not generally willing to take part in dispute resolution proceedings before a consumer arbitration board.</p>
    </section>

    <section class="section" id="contact">
      <div class="section-header"><span class="section-num">14</span><h2 class="section-title">Contact</h2></div>
      <p>Questions about these Terms? Get in touch:</p>
      <div class="contact-block">
        <p><strong>Email:</strong> <a href="mailto:multiplechoicechimp@gmail.com">multiplechoicechimp@gmail.com</a></p>
        <p>We read everything and aim to respond promptly.</p>
      </div>
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
    max-width: 1060px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 220px 1fr;
    padding: 0 48px;
  }

  .sidebar {
    position: sticky;
    top: 64px;
    height: calc(100vh - 64px);
    overflow-y: auto;
    padding: 40px 24px 40px 0;
    border-right: 1px solid rgba(255,255,255,0.06);
  }
  .sidebar::-webkit-scrollbar { display: none; }
  .sidebar-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 10px; font-weight: 700; letter-spacing: .18em;
    text-transform: uppercase; color: var(--muted); margin-bottom: 12px;
  }
  .nav-link {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 7px 12px; font-size: 13px; color: var(--muted);
    text-decoration: none; border-left: 2px solid transparent;
    margin-left: -2px; transition: color .15s, border-color .15s; line-height: 1.4;
  }
  .nav-link:hover { color: var(--white); border-left-color: var(--muted); }
  .nav-link.active { color: var(--gold); border-left-color: var(--gold); }
  .nav-num {
    font-family: 'Bebas Neue', sans-serif; font-size: 10px;
    color: var(--muted); letter-spacing: .05em; padding-top: 1px; flex-shrink: 0;
  }

  .content { padding: 48px 0 80px 48px; min-width: 0; }

  .section { margin-bottom: 60px; scroll-margin-top: 90px; }
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
  ul { list-style: none; margin-bottom: 16px; }
  ul li { font-size: 15px; color: var(--muted); padding: 5px 0 5px 18px; position: relative; line-height: 1.6; }
  ul li::before { content: '–'; position: absolute; left: 0; color: var(--gold); }
  ul li strong { color: var(--white); font-weight: 500; }
  ul li a { color: var(--blue); text-decoration: none; }
  ul li a:hover { text-decoration: underline; }

  .callout { border-left: 3px solid var(--blue); background: rgba(42,94,173,0.08); border-radius: 0 6px 6px 0; padding: 14px 18px; margin: 16px 0; }
  .callout p { margin-bottom: 0; font-size: 14px; }
  .callout.warn { border-left-color: var(--gold); background: rgba(232,193,74,0.07); }
  .callout.warn p { color: rgba(232,193,74,0.8); }

  .contact-block { background: var(--surface); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 24px; margin-top: 16px; }
  .contact-block p { font-size: 14px; margin-bottom: 8px; }
  .contact-block a { color: var(--blue); text-decoration: none; }

  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; padding: 0 24px; }
    .sidebar { display: none; }
    .content { padding: 32px 0 60px; }
    .hero { padding: 100px 24px 40px; }
  }
</style>
