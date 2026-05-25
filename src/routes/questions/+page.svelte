<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { fetchAllSets } from '$lib/questions';

  // ── TAB STATE ──
  const TABS = ['overview', 'ai-guide', 'sets', 'generator'];
  let activeTab = $state('overview');

  function switchTab(name) {
    activeTab = name;
    try {
      const url = name === 'overview' ? '/questions' : '/questions#' + name;
      history.replaceState(null, '', url);
    } catch(e) {}
    if (name === 'sets' && !setsLoaded) loadSets();
  }

  onMount(() => {
    const hash = window.location.hash.replace('#', '');
    if (TABS.includes(hash)) activeTab = hash;
    if (hash === 'sets') loadSets();

    function handleHash() {
      const h = window.location.hash.replace('#', '');
      if (TABS.includes(h)) switchTab(h);
      else switchTab('overview');
    }
    window.addEventListener('hashchange', handleHash);

    const blob = new Blob([GUIDE_MD], { type: 'text/markdown' });
    guideDownloadUrl = URL.createObjectURL(blob);

    return () => window.removeEventListener('hashchange', handleHash);
  });

  // ── QUESTION SETS ──
  let setsLoaded = false;
  let sets = $state([]);
  let setsStatus = $state('idle');
  let previewOpen = $state({});

  async function loadSets() {
    setsLoaded = true;
    setsStatus = 'loading';
    try {
      sets = await fetchAllSets();
      setsStatus = 'done';
    } catch(e) {
      setsStatus = 'error';
    }
  }

  function togglePreview(filename) {
    previewOpen[filename] = !previewOpen[filename];
  }

  function tierCounts(data) {
    const t = data?.tiers || {};
    return {
      easy:   (t.easy   || []).length,
      medium: (t.medium || []).length,
      hard:   (t.hard   || []).length,
      elite:  (t.elite  || []).length,
    };
  }

  function sampleQuestion(data) {
    for (const t of ['easy','medium','hard','elite']) {
      if (data?.tiers?.[t]?.length) return data.tiers[t][0];
    }
    return null;
  }

  // ── AI GUIDE ──
  const GUIDE_MD = "# McChimp — Question File Guide\n\n## File format\n\nA question module is a single .json file:\n\n{\n  \"name\": \"Module Name\",\n  \"description\": \"One-line description (optional)\",\n  \"tiers\": {\n    \"easy\":   [ ...questions ],\n    \"medium\": [ ...questions ],\n    \"hard\":   [ ...questions ],\n    \"elite\":  [ ...questions ]\n  }\n}\n\nYou do not need all four tiers.\n\n## Question object\n\n{\n  \"id\": \"PREFIX-TI-001\",\n  \"question\": \"What is the question text?\",\n  \"options\": [\"Option A\", \"Option B\", \"Option C\", \"Option D\"],\n  \"answers\": [0],\n  \"explanation\": \"Shown after the answer is revealed. Optional.\"\n}\n\nFields:\n- id (recommended): stable string, unique within module. Format: ABC-EA-001\n- question (required): plain text\n- options (required): array of 2-7 strings\n- answers (required): array of zero-based indices. At least one.\n- explanation (optional): shown after reveal\n\n## Difficulty tiers\n\neasy   -> early career / lower-ranked opponents\nmedium -> mid-career / mid-ranked opponents\nhard   -> top organisations / ranked opponents\nelite  -> title fights and championships\n\nThe game shifts effective tier at runtime based on player history (+1 correct, -1 wrong). Write each question at its genuine difficulty.\n\n## Single-answer vs multi-select\n\nSingle: \"answers\": [2]\nMulti:  \"answers\": [0, 2, 3, 4]\n        Question text should say \"Select all that apply.\"\n        Wrong selections subtract a point - guessing is penalised.\n\n## ID format: PREFIX-TI-NNN\n\nPREFIX: 2-4 uppercase letters (MMA, HIS, SCI)\nTI: EA (easy) / ME (medium) / HA (hard) / EL (elite)\nNNN: zero-padded number (001, 002...)\nExample: SCI-HA-007\n\nIDs must be unique within a module.\n\n## Quantity guidelines\n\n| Tier   | Minimum | Comfortable |\n|--------|---------|-------------|\n| easy   | 10      | 20+         |\n| medium | 10      | 20+         |\n| hard   | 10      | 20+         |\n| elite  | 5       | 15+         |\n\nFewer than ~40 total questions will cause repeats in a long career.\n\n## Minimal valid example\n\n{\n  \"name\": \"My Module\",\n  \"tiers\": {\n    \"easy\": [\n      {\n        \"id\": \"MY-EA-001\",\n        \"question\": \"What does MMA stand for?\",\n        \"options\": [\"Mixed Martial Arts\", \"Modern Martial Arts\", \"Mixed Match Athletics\"],\n        \"answers\": [0],\n        \"explanation\": \"MMA stands for Mixed Martial Arts.\"\n      }\n    ]\n  }\n}\n";

  let guideDownloadUrl = $state('');
  let copiedGuide = $state(false);

  function copyGuide() {
    navigator.clipboard.writeText(GUIDE_MD).then(() => {
      copiedGuide = true;
      setTimeout(() => copiedGuide = false, 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = GUIDE_MD;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copiedGuide = true;
      setTimeout(() => copiedGuide = false, 2000);
    });
  }

  // ── GENERATOR ──
  const TIER_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', elite: 'Elite' };
  const TIER_TI = { easy: 'EA', medium: 'ME', hard: 'HA', elite: 'EL' };

  let genTiers = $state({ easy: [], medium: [], hard: [], elite: [] });
  let activeTier = $state('easy');
  let genName = $state('');
  let genPrefix = $state('');
  let genDesc = $state('');
  let genQText = $state('');
  let genExplanation = $state('');
  let genDiff = $state('easy');
  let genOptions = $state([
    { text: '', correct: false },
    { text: '', correct: false },
    { text: '', correct: false },
    { text: '', correct: false },
  ]);
  let genAddErr = $state('');
  let genValidationIssues = $state([]);
  let editingQ = $state(null);
  let editText = $state('');
  let editOptions = $state([]);
  let editExplanation = $state('');

  function genTotal() {
    return Object.values(genTiers).reduce((s, a) => s + a.length, 0);
  }

  function genSwitchTier(tier) {
    activeTier = tier;
    genDiff = tier;
  }

  function genNameChanged() {
    if (!genPrefix) {
      genPrefix = genName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    }
  }

  function genMakeId(tier) {
    const prefix = genPrefix || genName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'SET';
    const ti = TIER_TI[tier] || 'EA';
    const count = genTiers[tier].length + 1;
    return `${prefix}-${ti}-${String(count).padStart(3, '0')}`;
  }

  function genAddOption() {
    if (genOptions.length >= 7) return;
    genOptions = [...genOptions, { text: '', correct: false }];
  }

  function genRemoveOption(idx) {
    if (genOptions.length <= 2) return;
    genOptions = genOptions.filter((_, i) => i !== idx);
  }

  function genToggleCorrect(idx) {
    genOptions = genOptions.map((o, i) => i === idx ? { ...o, correct: !o.correct } : o);
  }

  function genAddQuestion() {
    genAddErr = '';
    const text = genQText.trim();
    const tier = genDiff;
    const filledOpts = genOptions.filter(o => o.text.trim());
    const answers = genOptions.map((o, i) => o.correct ? i : -1).filter(i => i >= 0);

    if (!text) { genAddErr = 'Question text is required.'; return; }
    if (filledOpts.length < 2) { genAddErr = 'At least 2 options are required.'; return; }
    if (answers.length === 0) { genAddErr = 'At least one correct answer must be marked.'; return; }
    for (const ai of answers) {
      if (!genOptions[ai]?.text.trim()) { genAddErr = 'A marked correct answer has no text.'; return; }
    }

    const id = genMakeId(tier);
    const q = { id, question: text, options: genOptions.map(o => o.text), answers };
    if (genExplanation.trim()) q.explanation = genExplanation.trim();

    genTiers = { ...genTiers, [tier]: [...genTiers[tier], q] };
    activeTier = tier;
    genSwitchTier(tier);
    genQText = '';
    genExplanation = '';
    genOptions = [
      { text: '', correct: false },
      { text: '', correct: false },
      { text: '', correct: false },
      { text: '', correct: false },
    ];
  }

  function genDeleteQ(tier, idx) {
    genTiers = { ...genTiers, [tier]: genTiers[tier].filter((_, i) => i !== idx) };
  }

  function genStartEdit(tier, idx) {
    const q = genTiers[tier][idx];
    editingQ = { tier, idx };
    editText = q.question;
    editExplanation = q.explanation || '';
    editOptions = q.options.map((text, i) => ({ text, correct: q.answers.includes(i) }));
  }

  function genSaveEdit() {
    if (!editingQ) return;
    const { tier, idx } = editingQ;
    const q = { ...genTiers[tier][idx] };
    q.question = editText;
    q.options = editOptions.map(o => o.text);
    q.answers = editOptions.map((o, i) => o.correct ? i : -1).filter(i => i >= 0);
    if (editExplanation.trim()) q.explanation = editExplanation.trim();
    else delete q.explanation;
    genTiers = { ...genTiers, [tier]: genTiers[tier].map((item, i) => i === idx ? q : item) };
    editingQ = null;
  }

  function genCancelEdit() { editingQ = null; }

  function genValidate() {
    const issues = [];
    if (!genName.trim()) issues.push('Set name is required.');
    let total = 0;
    for (const t of ['easy', 'medium', 'hard', 'elite']) {
      const qs = genTiers[t];
      total += qs.length;
      qs.forEach((q, i) => {
        if (!q.question.trim()) issues.push(`${TIER_LABELS[t]} Q${i+1}: question text is empty.`);
        if ((q.options || []).filter(o => o.trim()).length < 2) issues.push(`${TIER_LABELS[t]} Q${i+1}: needs at least 2 options.`);
        if (!(q.answers || []).length) issues.push(`${TIER_LABELS[t]} Q${i+1}: no correct answer marked.`);
      });
    }
    if (total === 0) issues.push('Add at least one question before downloading.');
    return issues;
  }

  function genDownload() {
    const issues = genValidate();
    genValidationIssues = issues;
    if (issues.length) return;

    const out = { name: genName.trim() };
    if (genDesc.trim()) out.description = genDesc.trim();
    out.tiers = {};
    for (const t of ['easy', 'medium', 'hard', 'elite']) {
      if (genTiers[t].length) out.tiers[t] = genTiers[t];
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = genName.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function genHandleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.name) genName = data.name;
        if (data.description) genDesc = data.description;
        const firstQ = (data.tiers?.easy || data.tiers?.medium || data.tiers?.hard || data.tiers?.elite || [])[0];
        if (firstQ?.id) {
          genPrefix = firstQ.id.split('-')[0] || '';
        } else {
          genNameChanged();
        }
        genTiers = { easy: [], medium: [], hard: [], elite: [] };
        for (const t of ['easy', 'medium', 'hard', 'elite']) {
          if (Array.isArray(data.tiers?.[t])) {
            genTiers[t] = data.tiers[t].map(q => ({
              id: q.id || '',
              question: q.question || '',
              options: q.options || [],
              answers: q.answers || [],
              ...(q.explanation ? { explanation: q.explanation } : {})
            }));
          }
        }
        genTiers = { ...genTiers };
        e.target.value = '';
      } catch(err) {
        alert('Could not parse JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function genClear() {
    genTiers = { easy: [], medium: [], hard: [], elite: [] };
    genName = ''; genPrefix = ''; genDesc = '';
    genQText = ''; genExplanation = '';
    genValidationIssues = [];
    genOptions = [
      { text: '', correct: false },
      { text: '', correct: false },
      { text: '', correct: false },
      { text: '', correct: false },
    ];
    activeTier = 'easy';
    genDiff = 'easy';
  }
</script>

<svelte:head>
  <title>Questions — McChimp</title>
  <meta name="description" content="Make, browse and generate question sets for McChimp trivia games." />
</svelte:head>

<!-- PAGE HERO -->
<div class="page-hero">
  <div class="page-hero-tag">Question Sets</div>
  <h1>Make Your<br>Own Questions</h1>
  <p>Every McChimp game runs on a modular question engine. Swap in any topic, any language — as long as it follows the schema, it works instantly.</p>
</div>

<!-- TAB BAR -->
<div class="tab-bar">
  {#each [['overview','Overview'],['ai-guide','AI Guide'],['sets','Question Sets'],['generator','Generator']] as [id, label]}
    <button class="tab-btn" class:active={activeTab === id} onclick={() => switchTab(id)}>{label}</button>
  {/each}
</div>

<!-- OVERVIEW TAB -->
{#if activeTab === 'overview'}
<div class="overview">
  <div class="overview-intro">
    <h2>How the Question System Works</h2>
    <p>McChimp games don't have fixed question banks hardcoded into them. Instead, every game loads questions from a <strong>modular JSON file</strong> — a structured document you can write yourself, generate with AI, or download from our library.</p>
    <p>This means you can play any game with <strong>any topic</strong>. An MMA career with driving theory questions. A football career tested on economics. The game engine doesn't care — it only cares about the structure of the file.</p>

    <h2 style="margin-top:40px;">Difficulty Tiers <span class="mma-badge">MMA Game</span></h2>
    <p>Every question set is organised into four difficulty tiers. The game selects questions based on your current rank and career phase.</p>
    <div class="tier-pills">
      <span class="pill pill-easy">Easy</span>
      <span class="pill pill-medium">Medium</span>
      <span class="pill pill-hard">Hard</span>
      <span class="pill pill-elite">Elite</span>
    </div>
    <p>The game also tracks your personal score on each question (+1 correct, −1 wrong) and <strong>adjusts the effective difficulty dynamically</strong>. A hard question you've answered correctly twice becomes medium difficulty for you specifically.</p>

    <h2 style="margin-top:40px;">Fighter-Owned Questions <span class="mma-badge">MMA Game</span></h2>
    <p>Each opponent in the division owns a specific question. You face the same question when you rematch them — until you beat them <strong>twice consecutively</strong>, at which point they get a fresh one.</p>
  </div>

  <div class="tab-cards">
    <button class="tab-card" onclick={() => switchTab('ai-guide')}>
      <div class="tc-title">AI Guide</div>
      <p class="tc-desc">Learn how to prompt an AI assistant to generate a fully compatible question set. Includes a downloadable instruction file.</p>
      <div class="tc-arrow">Go to AI Guide</div>
    </button>
    <button class="tab-card" onclick={() => switchTab('sets')}>
      <div class="tc-title">Question Sets</div>
      <p class="tc-desc">Browse and download our native question sets. Each is ready to drop into any McChimp game immediately.</p>
      <div class="tc-arrow">Browse Sets</div>
    </button>
    <button class="tab-card" onclick={() => switchTab('generator')}>
      <div class="tc-title">Generator</div>
      <p class="tc-desc">Build a question set from scratch in the browser. Add questions, set difficulty, mark correct answers, then download as JSON.</p>
      <div class="tc-arrow">Open Generator</div>
    </button>
  </div>
</div>
{/if}

<!-- AI GUIDE TAB -->
{#if activeTab === 'ai-guide'}
<div class="guide-wrap" id="ai-guide">
  <div class="guide-section">
    <h3>How to prompt an AI to make a question set</h3>
    <p>Any major AI assistant — ChatGPT, Claude, Gemini — can generate a fully compatible McChimp question set if you give it the right instructions. Download the guide below, paste it into your AI chat, describe your topic, and it will produce a ready-to-use JSON file.</p>
    <p>The guide covers the exact schema, field rules, difficulty tiers, ID format, and quantity guidelines. The AI does the rest.</p>
  </div>

  <div class="guide-actions">
    <a class="btn-gold" href={guideDownloadUrl} download="mcchimp_question_guide.md">&#11015; Download Guide (.md)</a>
    <button class="btn-outline" class:copied={copiedGuide} onclick={copyGuide}>
      {copiedGuide ? '✓ Copied!' : 'Copy to Clipboard'}
    </button>
  </div>

  <div class="guide-section">
    <h3>File Format</h3>
    <p>A question module is a single <code>.json</code> file. You do not need all four tiers.</p>
    <div class="guide-code">{`{
  "name": "Module Name",
  "description": "One-line description (optional)",
  "tiers": {
    "easy":   [ ...questions ],
    "medium": [ ...questions ],
    "hard":   [ ...questions ],
    "elite":  [ ...questions ]
  }
}`}</div>
  </div>

  <div class="guide-section">
    <h3>Question Object</h3>
    <div class="guide-code">{`{
  "id": "PREFIX-TI-001",
  "question": "What is the question text?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answers": [0],
  "explanation": "Shown after the answer is revealed. Optional."
}`}</div>
    <table class="guide-table">
      <thead><tr><th>Field</th><th>Required</th><th>Rules</th></tr></thead>
      <tbody>
        <tr><td>id</td><td><span class="field-req field-rec">Recommended</span></td><td>Stable string, unique within module. Format: ABC-EA-001</td></tr>
        <tr><td>question</td><td><span class="field-req field-yes">Required</span></td><td>Plain text. No length limit but keep it readable.</td></tr>
        <tr><td>options</td><td><span class="field-req field-yes">Required</span></td><td>Array of 2–7 strings.</td></tr>
        <tr><td>answers</td><td><span class="field-req field-yes">Required</span></td><td>Array of zero-based indices into options. At least one.</td></tr>
        <tr><td>explanation</td><td><span class="field-req field-no">Optional</span></td><td>Shown after the answer is revealed.</td></tr>
      </tbody>
    </table>
  </div>

  <div class="guide-section">
    <h3>Difficulty Tiers</h3>
    <table class="guide-table">
      <thead><tr><th>Tier</th><th>When it appears</th></tr></thead>
      <tbody>
        <tr><td>easy</td><td>Early career, lower-ranked opponents</td></tr>
        <tr><td>medium</td><td>Mid-career, mid-ranked opponents</td></tr>
        <tr><td>hard</td><td>Top organisations, ranked opponents</td></tr>
        <tr><td>elite</td><td>Title fights and championship bouts</td></tr>
      </tbody>
    </table>
  </div>

  <div class="guide-section">
    <h3>Single-Answer vs Multi-Select</h3>
    <p>Questions can have one or more correct answers. Wrong selections subtract a point — guessing is penalised.</p>
    <div class="guide-code">{`// Single answer
"answers": [2]

// Multi-select — question text should say "Select all that apply."
"answers": [0, 2, 3, 4]`}</div>
  </div>

  <div class="guide-section">
    <h3>ID Format Convention</h3>
    <p><code>PREFIX-TI-NNN</code> — e.g. <code>SCI-HA-007</code></p>
    <table class="guide-table">
      <thead><tr><th>Part</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td>PREFIX</td><td>2–4 uppercase letters for the module (MMA, HIS, SCI)</td></tr>
        <tr><td>TI</td><td>EA (easy) · ME (medium) · HA (hard) · EL (elite)</td></tr>
        <tr><td>NNN</td><td>Zero-padded number: 001, 002…</td></tr>
      </tbody>
    </table>
  </div>

  <div class="guide-section">
    <h3>Quantity Guidelines</h3>
    <p>More questions means less repetition in long careers. A module with fewer than ~40 total will see repeats.</p>
    <table class="guide-table">
      <thead><tr><th>Tier</th><th>Minimum useful</th><th>Comfortable</th></tr></thead>
      <tbody>
        <tr><td>easy</td><td>10</td><td>20+</td></tr>
        <tr><td>medium</td><td>10</td><td>20+</td></tr>
        <tr><td>hard</td><td>10</td><td>20+</td></tr>
        <tr><td>elite</td><td>5</td><td>15+</td></tr>
      </tbody>
    </table>
  </div>
</div>
{/if}

<!-- QUESTION SETS TAB -->
{#if activeTab === 'sets'}
<div class="sets-wrap" id="sets">
  {#if setsStatus === 'idle' || setsStatus === 'loading'}
    <p class="sets-loading">Loading question sets…</p>
  {:else if setsStatus === 'error'}
    <p class="sets-error">Could not load question sets. Make sure index.json exists in /questions/.</p>
  {:else}
    <div class="sets-grid">
      {#each sets as { filename, data }}
        {#if !data}
          <div class="set-card">
            <div class="set-name">{filename}</div>
            <p class="set-desc" style="color:#D94040">Could not load this file.</p>
          </div>
        {:else}
          {@const counts = tierCounts(data)}
          {@const total = counts.easy + counts.medium + counts.hard + counts.elite}
          {@const sample = sampleQuestion(data)}
          <div class="set-card">
            <div class="set-card-top">
              <div class="set-name">{data.name || filename}</div>
              <span style="font-size:13px;color:var(--muted);white-space:nowrap;">{total} q</span>
            </div>
            {#if data.description}<p class="set-desc">{data.description}</p>{/if}
            <div class="set-tiers">
              {#if counts.easy}  <span class="set-tier tier-e">Easy · {counts.easy}</span>{/if}
              {#if counts.medium}<span class="set-tier tier-m">Medium · {counts.medium}</span>{/if}
              {#if counts.hard}  <span class="set-tier tier-h">Hard · {counts.hard}</span>{/if}
              {#if counts.elite} <span class="set-tier tier-x">Elite · {counts.elite}</span>{/if}
            </div>
            <div class="set-actions">
              <a class="set-dl" href="/questions/{filename}" download={filename}>&#11015; Download JSON</a>
              <button class="set-preview-btn" onclick={() => togglePreview(filename)}>
                {previewOpen[filename] ? 'Hide' : 'Preview'}
              </button>
            </div>
            {#if previewOpen[filename] && sample}
              <div class="set-preview open">
                <div class="preview-label">Sample question</div>
                <div class="preview-q">{sample.question}</div>
                <div class="preview-opts">
                  {#each sample.options as opt, i}
                    <div class="preview-opt" class:correct={(sample.answers || []).includes(i)}>
                      {(sample.answers || []).includes(i) ? '✓ ' : ''}{opt}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
{/if}

<!-- GENERATOR TAB -->
{#if activeTab === 'generator'}
<div class="gen-wrap" id="generator">

  <!-- SIDEBAR -->
  <div class="gen-sidebar">
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div class="gen-section-label">Total: {genTotal()} questions</div>
      <label class="gen-action-btn" style="cursor:pointer;">
        &#11014; Upload JSON
        <input type="file" accept=".json" onchange={genHandleUpload} style="display:none;">
      </label>
      <button class="gen-action-btn gen-dl-btn" onclick={genDownload}>&#11015; Download JSON</button>
      <button class="gen-action-btn gen-clear-btn" onclick={genClear}>Clear All</button>
    </div>

    <div>
      <div class="gen-section-label">Set Details</div>
      <div class="gen-field">
        <label class="gen-label" for="gen-name">Name</label>
        <input id="gen-name" class="gen-input" bind:value={genName} oninput={genNameChanged} placeholder="e.g. European History">
      </div>
      <div class="gen-field">
        <label class="gen-label" for="gen-prefix">ID Prefix <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;">(3–4 letters)</span></label>
        <input id="gen-prefix" class="gen-input" bind:value={genPrefix} placeholder="e.g. HIS" maxlength="4" style="text-transform:uppercase;" oninput={() => genPrefix = genPrefix.toUpperCase().replace(/[^A-Z]/g,'')}>
      </div>
      <div class="gen-field">
        <label class="gen-label" for="gen-desc">Description</label>
        <textarea id="gen-desc" class="gen-textarea" bind:value={genDesc} placeholder="One sentence describing the set"></textarea>
      </div>
    </div>

    <div>
      <div class="gen-section-label">Difficulty Tier</div>
      <div class="tier-switch">
        {#each ['easy','medium','hard','elite'] as tier}
          <button
            class="tier-switch-btn t{tier[0]}"
            class:active={activeTier === tier}
            onclick={() => genSwitchTier(tier)}
          >
            {TIER_LABELS[tier]}
            <span class="tier-count">{genTiers[tier].length}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- MAIN -->
  <div class="gen-main">

    <!-- VALIDATION -->
    {#if genValidationIssues.length}
      <div class="gen-validation visible">
        <div class="gen-validation-title">Please fix these issues before downloading</div>
        <ul>
          {#each genValidationIssues as issue}<li>{issue}</li>{/each}
        </ul>
      </div>
    {/if}

    <!-- ADD FORM -->
    <div class="gen-form">
      <div class="gen-form-title">Add Question</div>

      <div class="gen-field">
        <label class="gen-label" for="gen-qtext">Question Text</label>
        <textarea id="gen-qtext" class="gen-textarea" bind:value={genQText} placeholder="Enter your question here…" style="min-height:72px;"></textarea>
      </div>

      <div class="gen-field">
        <label class="gen-label" for="gen-options">Answer Options <span style="color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;">— click checkmark to mark correct</span></label>
        <div id="gen-options" class="options-list">
          {#each genOptions as opt, i}
            <div class="option-row">
              <button
                type="button"
                class="option-correct"
                class:marked={opt.correct}
                onclick={() => genToggleCorrect(i)}
                aria-label="Mark as correct answer"
              ></button>
              <input class="option-text" bind:value={opt.text} placeholder="Option {i + 1}">
              <button type="button" class="option-del" onclick={() => genRemoveOption(i)}>&#215;</button>
            </div>
          {/each}
        </div>
        {#if genOptions.length < 7}
          <button class="add-option-btn" onclick={genAddOption}>+ Add Option</button>
        {/if}
        <p class="options-hint">At least 2 options required. At least 1 must be marked correct.</p>
      </div>

      <div class="gen-row">
        <div class="gen-field" style="margin-bottom:0">
          <label class="gen-label" for="gen-diff">Difficulty</label>
          <select id="gen-diff" class="diff-select" bind:value={genDiff}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="elite">Elite</option>
          </select>
        </div>
        <div class="gen-field" style="margin-bottom:0">
          <label class="gen-label" for="gen-explanation">Explanation <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;">(optional)</span></label>
          <input id="gen-explanation" class="gen-input" bind:value={genExplanation} placeholder="Shown after answer reveal">
        </div>
      </div>

      <button class="gen-add-btn" onclick={genAddQuestion}>Add Question</button>
      {#if genAddErr}<div style="color:#D94040;font-size:12px;margin-top:8px;">{genAddErr}</div>{/if}
    </div>

    <!-- QUESTION LIST -->
    <div class="gen-section-label">{TIER_LABELS[activeTier]} questions</div>
    <div class="q-list">
      {#if genTiers[activeTier].length === 0}
        <div class="q-empty">No questions yet. Add one above.</div>
      {:else}
        {#each genTiers[activeTier] as q, i}
          <div class="q-item">
            <div class="q-num">{i + 1}</div>
            <div class="q-body">
              <div class="q-text">{q.question}</div>
              <div class="q-opts">
                {#each q.options as opt, oi}
                  <span class="q-opt" class:ans={q.answers.includes(oi)}>{opt}</span>
                {/each}
              </div>
              <div class="q-id">{q.id}</div>

              {#if editingQ?.tier === activeTier && editingQ?.idx === i}
                <div class="inline-edit">
                  <div class="inline-edit-label">Question</div>
                  <textarea bind:value={editText} style="min-height:56px;"></textarea>
                  <div class="inline-edit-label" style="margin-top:8px;">Options</div>
                  <div class="inline-edit-opts">
                    {#each editOptions as opt, oi}
                      <div class="option-row">
                        <button
                          type="button"
                          class="option-correct"
                          class:marked={opt.correct}
                          onclick={() => editOptions = editOptions.map((o,j) => j===oi ? {...o,correct:!o.correct} : o)}
                          aria-label="Mark as correct answer"
                        ></button>
                        <input class="option-text" bind:value={opt.text}>
                      </div>
                    {/each}
                  </div>
                  <div class="inline-edit-label" style="margin-top:8px;">Explanation (optional)</div>
                  <input bind:value={editExplanation} placeholder="Shown after answer reveal">
                  <div class="inline-edit-actions">
                    <button class="ie-save" onclick={genSaveEdit}>Save</button>
                    <button class="ie-cancel" onclick={genCancelEdit}>Cancel</button>
                  </div>
                </div>
              {/if}
            </div>
            <div class="q-item-actions">
              <button class="q-edit-btn" onclick={() => editingQ?.idx === i ? genCancelEdit() : genStartEdit(activeTier, i)}>
                {editingQ?.tier === activeTier && editingQ?.idx === i ? 'Cancel' : 'Edit'}
              </button>
              <button class="q-del" onclick={() => genDeleteQ(activeTier, i)}>&#215;</button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>
{/if}

<style>
  .page-hero {
    padding: 120px 48px 40px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .page-hero-tag {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .18em;
    text-transform: uppercase; color: var(--gold); margin-bottom: 14px;
  }
  .page-hero h1 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(52px, 8vw, 96px);
    line-height: .92; letter-spacing: .02em; color: var(--white); margin-bottom: 16px;
  }
  .page-hero p { font-size: 15px; color: rgba(242,239,232,0.45); max-width: 520px; line-height: 1.65; }

  .tab-bar {
    display: flex; border-bottom: 1px solid rgba(255,255,255,0.06);
    padding: 0 48px; position: sticky; top: 64px; z-index: 100;
    background: rgba(10,10,10,0.96); backdrop-filter: blur(12px);
  }
  .tab-btn {
    font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700;
    letter-spacing: .12em; text-transform: uppercase; color: var(--muted);
    background: none; border: none; border-bottom: 2px solid transparent;
    padding: 16px 20px; cursor: pointer; transition: color .15s, border-color .15s;
    white-space: nowrap; margin-bottom: -1px;
  }
  .tab-btn:hover { color: var(--white); }
  .tab-btn.active { color: var(--gold); border-bottom-color: var(--gold); }

  /* OVERVIEW */
  .overview { padding: 72px 48px; }
  .overview-intro { max-width: 680px; margin-bottom: 64px; }
  .overview-intro h2 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(32px,4vw,52px); letter-spacing: .04em; color: var(--white); margin-bottom: 16px; line-height: 1; }
  .overview-intro p { font-size: 15px; color: rgba(242,239,232,0.55); line-height: 1.75; margin-bottom: 14px; }
  .overview-intro strong { color: var(--white); }
  .tier-pills { display: flex; gap: 8px; flex-wrap: wrap; margin: 20px 0; }
  .pill { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; padding: 5px 12px; border-radius: 2px; }
  .pill-easy { background: rgba(46,139,87,0.15); color: #4CAF85; border: 1px solid rgba(46,139,87,0.3); }
  .pill-medium { background: rgba(232,193,74,0.12); color: var(--gold); border: 1px solid rgba(232,193,74,0.3); }
  .pill-hard { background: rgba(42,94,173,0.15); color: #6B9FE4; border: 1px solid rgba(42,94,173,0.3); }
  .pill-elite { background: rgba(180,74,232,0.12); color: #C07AEA; border: 1px solid rgba(180,74,232,0.3); }
  .mma-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: rgba(232,193,74,0.1); color: var(--gold); border: 1px solid rgba(232,193,74,0.25); padding: 3px 8px; border-radius: 2px; vertical-align: middle; margin-left: 8px; }
  .tab-cards { display: grid; grid-template-columns: repeat(3,1fr); gap: 2px; max-width: 1000px; }
  .tab-card { background: var(--surface); padding: 36px; border: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: background .2s; text-align: left; width: 100%; display: block; }
  .tab-card:hover { background: #1E2023; }
  .tab-card:hover .tc-arrow { transform: translate(3px,-3px); }
  .tc-title { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: .04em; color: var(--white); margin-bottom: 8px; }
  .tc-desc { font-size: 13px; color: rgba(242,239,232,0.45); line-height: 1.6; margin-bottom: 20px; }
  .tc-arrow { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--gold); transition: transform .2s; display: inline-block; }

  /* AI GUIDE */
  .guide-wrap { padding: 64px 48px; max-width: 900px; }
  .guide-actions { display: flex; gap: 12px; margin-bottom: 48px; flex-wrap: wrap; }
  .btn-gold { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: var(--gold); color: var(--black); border: none; padding: 12px 24px; border-radius: 2px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: background .15s; }
  .btn-gold:hover { background: var(--gold2); }
  .btn-outline { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: transparent; color: var(--white); border: 1px solid rgba(255,255,255,0.2); padding: 12px 24px; border-radius: 2px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: border-color .15s, color .15s; }
  .btn-outline:hover { border-color: rgba(255,255,255,0.5); }
  .btn-outline.copied { border-color: var(--green); color: #4CAF85; }
  .guide-section { margin-bottom: 48px; }
  .guide-section h3 { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: .04em; color: var(--white); margin-bottom: 14px; line-height: 1; }
  .guide-section p { font-size: 14px; color: rgba(242,239,232,0.55); line-height: 1.75; margin-bottom: 12px; }
  .guide-section code { color: var(--gold); font-family: monospace; }
  .guide-code { background: var(--off); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 20px 24px; font-family: monospace; font-size: 12.5px; color: rgba(242,239,232,0.7); line-height: 1.75; overflow-x: auto; white-space: pre; margin: 16px 0; }
  .guide-table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0; }
  .guide-table th { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); text-align: left; padding: 8px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .guide-table td { padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.03); color: rgba(242,239,232,0.6); vertical-align: top; }
  .guide-table td:first-child { font-family: monospace; color: var(--gold); font-size: 12px; }
  .guide-table tr:last-child td { border-bottom: none; }
  .field-req { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 2px 6px; border-radius: 2px; }
  .field-yes { background: rgba(46,139,87,0.15); color: #4CAF85; }
  .field-rec { background: rgba(232,193,74,0.1); color: var(--gold); }
  .field-no { background: rgba(107,107,107,0.15); color: var(--muted); }

  /* SETS */
  .sets-wrap { padding: 64px 48px; }
  .sets-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(300px,1fr)); gap: 2px; max-width: 1100px; }
  .set-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.04); padding: 32px; display: flex; flex-direction: column; }
  .set-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
  .set-name { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: .04em; color: var(--white); line-height: 1.1; }
  .set-desc { font-size: 13px; color: rgba(242,239,232,0.45); line-height: 1.6; margin-bottom: 16px; flex: 1; }
  .set-tiers { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
  .set-tier { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 3px 8px; border-radius: 2px; }
  .tier-e { background: rgba(46,139,87,0.12); color: #4CAF85; border: 1px solid rgba(46,139,87,0.25); }
  .tier-m { background: rgba(232,193,74,0.10); color: var(--gold); border: 1px solid rgba(232,193,74,0.25); }
  .tier-h { background: rgba(42,94,173,0.12); color: #6B9FE4; border: 1px solid rgba(42,94,173,0.25); }
  .tier-x { background: rgba(180,74,232,0.10); color: #C07AEA; border: 1px solid rgba(180,74,232,0.25); }
  .set-actions { display: flex; gap: 8px; align-items: center; margin-top: auto; }
  .set-dl { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: var(--gold); color: var(--black); border: none; padding: 9px 18px; border-radius: 2px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: background .15s; white-space: nowrap; }
  .set-dl:hover { background: var(--gold2); }
  .set-preview-btn { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: transparent; color: var(--muted); border: 1px solid rgba(255,255,255,0.1); padding: 9px 16px; border-radius: 2px; cursor: pointer; transition: color .15s, border-color .15s; }
  .set-preview-btn:hover { color: var(--white); border-color: rgba(255,255,255,0.3); }
  .set-preview { margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); }
  .preview-label { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
  .preview-q { font-size: 13px; color: var(--white); margin-bottom: 8px; line-height: 1.5; }
  .preview-opt { font-size: 12px; color: rgba(242,239,232,0.45); padding: 4px 0; }
  .preview-opt.correct { color: #4CAF85; }
  .sets-loading { color: var(--muted); font-size: 14px; padding: 64px 0; }
  .sets-error { color: #D94040; font-size: 13px; padding: 32px 0; }

  /* GENERATOR */
  .gen-wrap { display: grid; grid-template-columns: 280px 1fr; min-height: 60vh; max-width: 1200px; }
  .gen-sidebar { border-right: 1px solid rgba(255,255,255,0.06); padding: 32px 24px; display: flex; flex-direction: column; gap: 24px; }
  .gen-main { padding: 32px 40px; }
  .gen-section-label { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; }
  .gen-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  .gen-label { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .gen-input, .gen-textarea { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 3px; color: var(--white); font-family: 'Barlow', sans-serif; font-size: 13px; padding: 9px 12px; outline: none; transition: border-color .15s; width: 100%; }
  .gen-input:focus, .gen-textarea:focus { border-color: rgba(232,193,74,0.5); }
  .gen-input::placeholder, .gen-textarea::placeholder { color: var(--muted); opacity: .5; }
  .gen-textarea { resize: vertical; min-height: 60px; line-height: 1.5; }
  .tier-switch { display: flex; flex-direction: column; gap: 2px; }
  .tier-switch-btn { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 3px; border: 1px solid transparent; cursor: pointer; background: transparent; color: var(--muted); font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; transition: all .15s; width: 100%; text-align: left; }
  .tier-switch-btn:hover { background: rgba(255,255,255,0.04); color: var(--white); }
  .tier-switch-btn.active { color: var(--white); border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.06); }
  .tier-switch-btn.te.active { border-color: rgba(46,139,87,0.4); background: rgba(46,139,87,0.08); color: #4CAF85; }
  .tier-switch-btn.tm.active { border-color: rgba(232,193,74,0.4); background: rgba(232,193,74,0.08); color: var(--gold); }
  .tier-switch-btn.th.active { border-color: rgba(42,94,173,0.4); background: rgba(42,94,173,0.08); color: #6B9FE4; }
  .tier-switch-btn.tx.active { border-color: rgba(180,74,232,0.4); background: rgba(180,74,232,0.08); color: #C07AEA; }
  .tier-count { font-size: 11px; opacity: .6; font-weight: 400; }
  .gen-form { background: var(--surface); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 24px; margin-bottom: 28px; }
  .gen-form-title { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: .04em; color: var(--white); margin-bottom: 20px; }
  .gen-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  .options-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
  .option-row { display: flex; align-items: center; gap: 8px; }
  .option-correct { width: 20px; height: 20px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.06); background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .15s; }
  .option-correct.marked { background: rgba(46,139,87,0.2); border-color: rgba(46,139,87,0.5); }
  .option-correct.marked::after { content: '✓'; font-size: 11px; color: #4CAF85; }
  .option-text { flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 3px; color: var(--white); font-family: 'Barlow', sans-serif; font-size: 13px; padding: 7px 10px; outline: none; transition: border-color .15s; }
  .option-text:focus { border-color: rgba(232,193,74,0.4); }
  .option-del { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 16px; padding: 4px 6px; line-height: 1; transition: color .15s; flex-shrink: 0; }
  .option-del:hover { color: #D94040; }
  .add-option-btn { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: transparent; border: 1px dashed rgba(255,255,255,0.12); border-radius: 3px; color: var(--muted); padding: 7px 12px; cursor: pointer; transition: all .15s; width: 100%; margin-bottom: 12px; }
  .add-option-btn:hover { border-color: rgba(255,255,255,0.3); color: var(--white); }
  .options-hint { font-size: 11px; color: var(--muted); margin-bottom: 16px; }
  .diff-select { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 3px; color: var(--white); font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: .06em; padding: 9px 12px; outline: none; cursor: pointer; width: 100%; transition: border-color .15s; }
  .diff-select:focus { border-color: rgba(232,193,74,0.5); }
  .diff-select option { background: #1A1C1E; }
  .gen-add-btn { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: var(--gold); color: var(--black); border: none; padding: 11px 24px; border-radius: 3px; cursor: pointer; transition: background .15s; width: 100%; margin-top: 4px; }
  .gen-add-btn:hover { background: var(--gold2); }
  .q-list { display: flex; flex-direction: column; gap: 6px; }
  .q-item { background: var(--surface); border: 1px solid rgba(255,255,255,0.04); border-radius: 4px; padding: 16px 18px; display: flex; align-items: flex-start; gap: 14px; position: relative; }
  .q-item:hover { border-color: rgba(255,255,255,0.1); }
  .q-num { font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: var(--muted); min-width: 28px; text-align: right; margin-top: 2px; }
  .q-body { flex: 1; min-width: 0; }
  .q-text { font-size: 14px; color: var(--white); line-height: 1.5; margin-bottom: 6px; }
  .q-opts { display: flex; flex-wrap: wrap; gap: 4px; }
  .q-opt { font-size: 11px; padding: 2px 8px; border-radius: 2px; background: rgba(255,255,255,0.04); color: var(--muted); }
  .q-opt.ans { background: rgba(46,139,87,0.12); color: #4CAF85; }
  .q-del { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 18px; padding: 2px; line-height: 1; transition: color .15s; flex-shrink: 0; }
  .q-del:hover { color: #D94040; }
  .q-empty { font-size: 13px; color: var(--muted); padding: 32px 0; text-align: center; }
  .q-id { font-family: monospace; font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 4px; }
  .q-edit-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 2px 6px; line-height: 1; transition: color .15s; flex-shrink: 0; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .q-edit-btn:hover { color: var(--gold); }
  .q-item-actions { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
  .inline-edit { background: var(--off); border: 1px solid rgba(232,193,74,0.3); border-radius: 4px; padding: 16px; margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
  .inline-edit textarea, .inline-edit input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 3px; color: var(--white); font-family: 'Barlow', sans-serif; font-size: 13px; padding: 7px 10px; outline: none; width: 100%; }
  .inline-edit textarea { resize: vertical; min-height: 56px; }
  .inline-edit-label { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
  .inline-edit-actions { display: flex; gap: 8px; margin-top: 4px; }
  .ie-save { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: var(--gold); color: var(--black); border: none; padding: 8px 18px; border-radius: 3px; cursor: pointer; transition: background .15s; }
  .ie-save:hover { background: var(--gold2); }
  .ie-cancel { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: transparent; color: var(--muted); border: 1px solid rgba(255,255,255,0.06); padding: 8px 14px; border-radius: 3px; cursor: pointer; transition: all .15s; }
  .ie-cancel:hover { color: var(--white); border-color: rgba(255,255,255,0.3); }
  .gen-validation { background: rgba(217,64,64,0.08); border: 1px solid rgba(217,64,64,0.3); border-radius: 4px; padding: 14px 18px; margin-bottom: 16px; }
  .gen-validation-title { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #D94040; margin-bottom: 8px; }
  .gen-validation ul { list-style: none; display: flex; flex-direction: column; gap: 4px; }
  .gen-validation li { font-size: 12px; color: rgba(217,64,64,0.8); }
  .gen-validation li::before { content: '— '; }
  .gen-action-btn { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 3px; color: var(--muted); padding: 9px 14px; cursor: pointer; transition: all .15s; width: 100%; text-align: center; display: block; }
  .gen-action-btn:hover { border-color: rgba(255,255,255,0.2); color: var(--white); }
  .gen-dl-btn { background: rgba(232,193,74,0.08); border-color: rgba(232,193,74,0.2); color: var(--gold); }
  .gen-dl-btn:hover { background: rgba(232,193,74,0.15); border-color: rgba(232,193,74,0.4); }
  .gen-clear-btn:hover { border-color: rgba(217,64,64,0.4); color: #D94040; }

  @media (max-width: 900px) {
    .page-hero, .overview, .tab-bar { padding-left: 24px; padding-right: 24px; }
    .tab-cards { grid-template-columns: 1fr; }
    .guide-wrap, .sets-wrap { padding: 40px 24px; }
    .gen-wrap { grid-template-columns: 1fr; }
    .gen-sidebar { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); padding: 24px; }
    .gen-main { padding: 24px; }
    .gen-row { grid-template-columns: 1fr; }
  }
  @media (max-width: 600px) {
    .page-hero h1 { font-size: 52px; }
    .tab-btn { padding: 14px 12px; font-size: 11px; }
  }
</style>