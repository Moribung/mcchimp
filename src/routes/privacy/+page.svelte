<script>
  import { onMount } from 'svelte';

  const sections = [
    ['overview', '01', 'Overview'],
    ['what-we-collect', '02', 'What We Collect'],
    ['how-we-use', '03', 'How We Use Your Data'],
    ['lawful-basis', '04', 'Lawful Basis'],
    ['retention', '05', 'Retention'],
    ['sharing', '06', 'Sharing & Processors'],
    ['cookies', '07', 'Cookies'],
    ['your-rights', '08', 'Your Rights'],
    ['ai', '09', 'AI & Question Generation'],
    ['security', '10', 'Security'],
    ['children', '11', 'Children'],
    ['automated', '12', 'Automated Decision-Making'],
    ['dpo', '13', 'Data Protection Officer'],
    ['transfer', '14', 'Business Transfer'],
    ['changes', '15', 'Policy Changes'],
    ['contact', '16', 'Contact Us'],
  ];

  let activeSection = $state('overview');

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
  <title>Privacy Policy — McChimp</title>
</svelte:head>

<div class="hero">
  <div class="hero-inner">
    <div class="hero-eyebrow">Legal</div>
    <h1 class="hero-title">Privacy Policy</h1>
    <div class="hero-meta">
      <span class="hero-meta-item">Effective: <strong>20 May 2026</strong></span>
      <span class="dot"></span>
      <span class="hero-meta-item">Jurisdiction: <strong>European Union (GDPR)</strong></span>
      <span class="dot"></span>
      <span class="hero-meta-item">Controller: <strong>mcchimp.com</strong></span>
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

    <section class="section" id="overview">
      <div class="section-header"><span class="section-num">01</span><h2 class="section-title">Overview</h2></div>
      <p>This Privacy Policy explains how mcchimp.com ("we", "us", "our") collects, uses, stores, and protects personal data when you use our platform. It applies to all users of mcchimp.com, regardless of where you are located.</p>
      <p>We are committed to processing your personal data lawfully, fairly, and transparently in accordance with the <strong>General Data Protection Regulation (GDPR)</strong> and applicable EU member state law.</p>
      <p>If you have questions not answered here, contact us at <a href="mailto:multiplechoicechimp@gmail.com">multiplechoicechimp@gmail.com</a>.</p>
    </section>

    <section class="section" id="what-we-collect">
      <div class="section-header"><span class="section-num">02</span><h2 class="section-title">What We Collect</h2></div>
      <h3>Account data (when you register)</h3>
      <ul>
        <li><strong>Email address</strong> — used for login, account recovery, and service communications</li>
        <li><strong>Password</strong> — stored as a bcrypt hash; we never see your plaintext password</li>
        <li><strong>Display name</strong> — shown on your profile and leaderboards</li>
      </ul>
      <h3>Game data (when you play)</h3>
      <ul>
        <li><strong>Career save states</strong> — your fighter record, division, ranks, and fight history</li>
        <li><strong>Question progress scores</strong> — per-question correct/wrong counts used for adaptive difficulty</li>
        <li><strong>Career history</strong> — completed career records stored permanently after retirement</li>
      </ul>
      <h3>Technical data (automatically collected)</h3>
      <ul>
        <li><strong>Server and error logs</strong> — IP address, browser type, pages visited, error events. Used for security and debugging. PII stripped before storage; deleted after 90 days.</li>
        <li><strong>Analytics data</strong> — only collected with your consent via our cookie banner</li>
      </ul>
      <h3>AI-generated content (optional feature)</h3>
      <ul>
        <li>Text you paste or upload to generate quiz questions</li>
        <li>This content is sent to Anthropic's API for processing and is not stored on our servers beyond the active session unless you explicitly save the output</li>
      </ul>
    </section>

    <section class="section" id="how-we-use">
      <div class="section-header"><span class="section-num">03</span><h2 class="section-title">How We Use Your Data</h2></div>
      <ul>
        <li><strong>Provide the service:</strong> Authenticate your account, save game progress, and store question banks</li>
        <li><strong>Improve the platform:</strong> Understand how features are used to fix bugs and prioritise development (only with analytics consent)</li>
        <li><strong>Communicate with you:</strong> Send account-related emails (password reset, security notices) — never marketing without separate opt-in</li>
        <li><strong>Ensure security:</strong> Detect abuse, prevent fraud, enforce our terms of service</li>
        <li><strong>AI question generation:</strong> Pass your submitted text to our AI provider solely to return generated questions to you</li>
      </ul>
      <p>We do <strong>not</strong> sell your data to third parties, use it for advertising, or share it with data brokers.</p>
    </section>

    <section class="section" id="lawful-basis">
      <div class="section-header"><span class="section-num">04</span><h2 class="section-title">Lawful Basis for Processing</h2></div>
      <p>Under GDPR Article 6, every category of data we process must have a lawful basis:</p>
      <table class="data-table">
        <thead><tr><th>Data type</th><th>Lawful basis</th><th>Reason</th></tr></thead>
        <tbody>
          <tr><td><strong>Email &amp; password hash</strong></td><td><span class="basis-tag tag-contract">Contract</span></td><td>Necessary to provide the account and login service</td></tr>
          <tr><td><strong>Display name</strong></td><td><span class="basis-tag tag-contract">Contract</span></td><td>Required to identify you within the platform</td></tr>
          <tr><td><strong>Game progress &amp; records</strong></td><td><span class="basis-tag tag-contract">Contract</span></td><td>Core product feature — saving progress is the service</td></tr>
          <tr><td><strong>Question bank uploads</strong></td><td><span class="basis-tag tag-contract">Contract</span></td><td>Storing content you explicitly created</td></tr>
          <tr><td><strong>Analytics &amp; usage data</strong></td><td><span class="basis-tag tag-consent">Consent</span></td><td>Only processed after you opt in via our cookie banner</td></tr>
          <tr><td><strong>AI input content</strong></td><td><span class="basis-tag tag-consent">Consent</span></td><td>You submit content voluntarily to use the AI feature</td></tr>
          <tr><td><strong>Server &amp; error logs</strong></td><td><span class="basis-tag tag-legit">Legitimate interest</span></td><td>Security monitoring and bug detection. PII stripped before storage; logs deleted after 90 days.</td></tr>
        </tbody>
      </table>
    </section>

    <section class="section" id="retention">
      <div class="section-header"><span class="section-num">05</span><h2 class="section-title">How Long We Keep Your Data</h2></div>
      <table class="data-table">
        <thead><tr><th>Data type</th><th>Retention period</th></tr></thead>
        <tbody>
          <tr><td><strong>Account data (email, display name)</strong></td><td>Until you delete your account</td></tr>
          <tr><td><strong>Game states &amp; progress</strong></td><td>Until you delete your account</td></tr>
          <tr><td><strong>Question banks</strong></td><td>Until you delete them or your account</td></tr>
          <tr><td><strong>Analytics data</strong></td><td>Maximum 13 months, then automatically purged</td></tr>
          <tr><td><strong>Server &amp; error logs</strong></td><td>Maximum 90 days, then automatically deleted</td></tr>
          <tr><td><strong>AI input (submitted text)</strong></td><td>Not stored — processed in-session only</td></tr>
        </tbody>
      </table>
      <p>When you delete your account, all associated personal data is permanently removed from our systems within 30 days.</p>
    </section>

    <section class="section" id="sharing">
      <div class="section-header"><span class="section-num">06</span><h2 class="section-title">Sharing &amp; Data Processors</h2></div>
      <p>We do not sell or trade your personal data. We share data with the following third-party processors under data processing agreements:</p>
      <h3>Supabase (database &amp; authentication)</h3>
      <ul>
        <li>Hosts our database and manages authentication</li>
        <li>Data stored in <strong>Frankfurt, Germany (EU)</strong> — never transferred outside the EEA</li>
        <li>Privacy policy: <a href="https://supabase.com/privacy" target="_blank" rel="noopener">supabase.com/privacy</a></li>
      </ul>
      <h3>Cloudflare Pages (hosting)</h3>
      <ul>
        <li>Hosts the mcchimp.com web application</li>
        <li>Privacy policy: <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">cloudflare.com/privacypolicy</a></li>
      </ul>
      <h3>Anthropic (AI question generation — optional)</h3>
      <ul>
        <li>Receives text content you submit when using the AI question generation feature</li>
        <li>Content is not used to train Anthropic's models under our API agreement</li>
        <li>Privacy policy: <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener">anthropic.com/legal/privacy</a></li>
      </ul>
      <div class="callout warn"><p>We may disclose personal data to law enforcement or regulatory authorities where legally required. We will notify you of such requests unless prohibited by law.</p></div>
    </section>

    <section class="section" id="cookies">
      <div class="section-header"><span class="section-num">07</span><h2 class="section-title">Cookies</h2></div>
      <p>We use two categories of cookies:</p>
      <h3>Strictly necessary (no consent required)</h3>
      <ul>
        <li><strong>sb-auth-token</strong> — Supabase session cookie; keeps you logged in. Duration: session / up to 7 days.</li>
      </ul>
      <h3>Analytics (opt-in only)</h3>
      <ul>
        <li>Only set after you click "Accept" on our cookie banner. Withdraw consent at any time from the footer.</li>
        <li>Analytics data is anonymised and never combined with your account identity.</li>
      </ul>
      <p>We do not use advertising, tracking, or third-party marketing cookies.</p>
    </section>

    <section class="section" id="your-rights">
      <div class="section-header"><span class="section-num">08</span><h2 class="section-title">Your Rights</h2></div>
      <p>Under GDPR, you have the following rights. Exercise most of them from your account settings, or by emailing <a href="mailto:multiplechoicechimp@gmail.com">multiplechoicechimp@gmail.com</a>.</p>
      <div class="rights-grid">
        <div class="right-card">
          <div class="right-card-icon"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
          <div class="right-card-title">Right to Access</div>
          <div class="right-card-desc">Request a full export of all personal data we hold about you.</div>
        </div>
        <div class="right-card">
          <div class="right-card-icon"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
          <div class="right-card-title">Right to Rectify</div>
          <div class="right-card-desc">Correct inaccurate data in your account settings at any time.</div>
        </div>
        <div class="right-card">
          <div class="right-card-icon"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></div>
          <div class="right-card-title">Right to Erasure</div>
          <div class="right-card-desc">Delete your account and all data from Account Settings → Delete Account.</div>
        </div>
        <div class="right-card">
          <div class="right-card-icon"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
          <div class="right-card-title">Right to Portability</div>
          <div class="right-card-desc">Download your data as a structured JSON file from Account Settings.</div>
        </div>
        <div class="right-card">
          <div class="right-card-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></div>
          <div class="right-card-title">Right to Object</div>
          <div class="right-card-desc">Object to processing based on legitimate interest by contacting us.</div>
        </div>
        <div class="right-card">
          <div class="right-card-icon"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
          <div class="right-card-title">Right to Restrict</div>
          <div class="right-card-desc">Request that we restrict how we process your data in certain circumstances.</div>
        </div>
      </div>
      <p>We will respond to all rights requests within <strong>30 days</strong>. We may ask you to verify your identity before acting on a request.</p>
      <p>You also have the right to lodge a complaint with your national data protection authority at any time.</p>
    </section>

    <section class="section" id="ai">
      <div class="section-header"><span class="section-num">09</span><h2 class="section-title">AI &amp; Question Generation</h2></div>
      <p>mcchimp.com offers an optional feature allowing you to submit text to generate custom quiz questions using Anthropic's Claude AI.</p>
      <ul>
        <li><strong>What is sent:</strong> The text content you submit to the generation tool</li>
        <li><strong>Where it goes:</strong> Anthropic's API, processed in their infrastructure</li>
        <li><strong>What we store:</strong> Only the generated questions (output), not your submitted text (input)</li>
        <li><strong>Model training:</strong> Submitted content is not used to train Anthropic's models under our API agreement</li>
        <li><strong>Your choice:</strong> This feature is entirely optional</li>
      </ul>
      <div class="callout warn"><p>Do not submit text containing personal information about yourself or others to the AI question tool.</p></div>
    </section>

    <section class="section" id="security">
      <div class="section-header"><span class="section-num">10</span><h2 class="section-title">Security</h2></div>
      <ul>
        <li><strong>Encryption in transit:</strong> All data transmitted over HTTPS/TLS</li>
        <li><strong>Encryption at rest:</strong> Database storage encrypted by Supabase</li>
        <li><strong>Password hashing:</strong> Stored using bcrypt — we never store or see your plaintext password</li>
        <li><strong>Row-level security:</strong> Database-level access controls ensure your data can only be accessed by your authenticated session</li>
        <li><strong>EU data storage:</strong> All personal data stored in Frankfurt, Germany</li>
      </ul>
      <p>In the event of a data breach, we will notify the relevant supervisory authority within 72 hours and inform affected users without undue delay.</p>
    </section>

    <section class="section" id="children">
      <div class="section-header"><span class="section-num">11</span><h2 class="section-title">Children</h2></div>
      <p>mcchimp.com is not directed at children under the age of 16. We do not knowingly collect personal data from anyone under 16. If you believe a child under 16 has created an account, please contact us at <a href="mailto:multiplechoicechimp@gmail.com">multiplechoicechimp@gmail.com</a> and we will delete the account promptly.</p>
    </section>

    <section class="section" id="automated">
      <div class="section-header"><span class="section-num">12</span><h2 class="section-title">Automated Decision-Making</h2></div>
      <p>We do not use automated decision-making or profiling that produces legal or similarly significant effects on you under Article 22 of the GDPR.</p>
      <p>Game outcomes are determined by your quiz answers and are part of the core product experience — they carry no legal, financial, or significant practical consequence outside the platform.</p>
    </section>

    <section class="section" id="dpo">
      <div class="section-header"><span class="section-num">13</span><h2 class="section-title">Data Protection Officer</h2></div>
      <p>As mcchimp.com does not carry out large-scale systematic monitoring of individuals and does not process special category data on a large scale, we are <strong>not currently required to appoint a Data Protection Officer</strong>.</p>
      <p>All data protection enquiries are handled directly by the team at <a href="mailto:multiplechoicechimp@gmail.com">multiplechoicechimp@gmail.com</a>.</p>
    </section>

    <section class="section" id="transfer">
      <div class="section-header"><span class="section-num">14</span><h2 class="section-title">Business Transfer</h2></div>
      <p>If mcchimp.com is involved in a merger, acquisition, or asset sale, your personal data may be transferred to the successor entity. We will notify you before your data is transferred and you will retain all rights described in Section 08.</p>
    </section>

    <section class="section" id="changes">
      <div class="section-header"><span class="section-num">15</span><h2 class="section-title">Policy Changes</h2></div>
      <p>We may update this Privacy Policy from time to time. For material changes, we will notify registered users by email and display a notice on the platform. Continued use after the effective date constitutes acceptance of the updated policy.</p>
    </section>

    <section class="section" id="contact">
      <div class="section-header"><span class="section-num">16</span><h2 class="section-title">Contact Us</h2></div>
      <p>For any questions, requests, or complaints relating to this Privacy Policy:</p>
      <div class="contact-block">
        <p><strong>Data Controller:</strong> mcchimp.com</p>
        <p><strong>Privacy enquiries:</strong> <a href="mailto:multiplechoicechimp@gmail.com">multiplechoicechimp@gmail.com</a></p>
        <p style="margin-top:14px;color:var(--muted)">We aim to respond to all enquiries within 5 business days.</p>
      </div>
      <p style="margin-top:16px">You also have the right to lodge a complaint with your national data protection authority:</p>
      <ul>
        <li><strong>Netherlands:</strong> <a href="https://autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener">autoriteitpersoonsgegevens.nl</a></li>
        <li><strong>Belgium:</strong> <a href="https://gegevensbeschermingsautoriteit.be" target="_blank" rel="noopener">gegevensbeschermingsautoriteit.be</a></li>
        <li><strong>EU-wide directory:</strong> <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noopener">edpb.europa.eu</a></li>
      </ul>
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
  h3 {
    font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700;
    letter-spacing: .16em; text-transform: uppercase; color: var(--muted);
    margin: 28px 0 10px;
  }
  ul { list-style: none; margin-bottom: 16px; }
  ul li { font-size: 15px; color: var(--muted); padding: 5px 0 5px 18px; position: relative; line-height: 1.6; }
  ul li::before { content: '–'; position: absolute; left: 0; color: var(--gold); }
  ul li strong { color: var(--white); font-weight: 500; }
  ul li a { color: var(--blue); text-decoration: none; }
  ul li a:hover { text-decoration: underline; }

  .data-table { width: 100%; border-collapse: collapse; margin: 16px 0 24px; font-size: 13px; }
  .data-table thead tr { background: var(--surface); }
  .data-table th { text-align: left; padding: 10px 14px; font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); border: 1px solid rgba(255,255,255,0.06); }
  .data-table td { padding: 10px 14px; color: var(--muted); border: 1px solid rgba(255,255,255,0.06); vertical-align: top; line-height: 1.5; }
  .data-table td strong { color: var(--white); font-weight: 500; }
  .data-table tbody tr:hover td { background: var(--surface); }
  .basis-tag { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 3px; font-weight: 500; white-space: nowrap; font-family: 'Barlow Condensed', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
  .tag-contract { background: rgba(42,94,173,0.18); color: #6B9FE4; }
  .tag-consent { background: rgba(232,193,74,0.18); color: var(--gold); }
  .tag-legit { background: rgba(107,107,107,0.18); color: var(--muted); }

  .callout { border-left: 3px solid var(--blue); background: rgba(42,94,173,0.08); border-radius: 0 6px 6px 0; padding: 14px 18px; margin: 16px 0; }
  .callout p { margin-bottom: 0; font-size: 14px; }
  .callout.warn { border-left-color: var(--gold); background: rgba(232,193,74,0.07); }
  .callout.warn p { color: rgba(232,193,74,0.8); }

  .rights-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 16px 0 24px; }
  .right-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 16px; }
  .right-card-title { font-size: 13px; font-weight: 500; color: var(--white); margin-bottom: 6px; font-family: 'Barlow Condensed', sans-serif; letter-spacing: .04em; text-transform: uppercase; }
  .right-card-desc { font-size: 12px; color: var(--muted); line-height: 1.5; }
  .right-card-icon { width: 28px; height: 28px; border-radius: 4px; background: rgba(232,193,74,0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
  .right-card-icon svg { width: 14px; height: 14px; stroke: var(--gold); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

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