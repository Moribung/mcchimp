<script>
  import { browser } from '$app/environment';

  const GUIDE_MD = `# McChimp — Question File Guide v2.0

## File format

A question module is a single .json file:

{
  "name": "Module Name",
  "description": "One-line description (optional)",
  "version": "2.0",
  "tiers": {
    "easy":   [ ...questions ],
    "medium": [ ...questions ],
    "hard":   [ ...questions ],
    "elite":  [ ...questions ]
  }
}

You do not need all four tiers.

## Common fields

Every question object shares these fields:

- id (recommended): stable string, unique within module. Format: PREFIX-TI-NNN
- type (optional): defaults to multi_select if omitted
- question (required*): plain text. *optional for fill_gap
- explanation (optional): shown after the answer is revealed

## Question types

### multi_select (DEFAULT)

Checkboxes. Multiple answers selectable. Wrong selections subtract a point.
This is the default when type is omitted.

{
  "id": "MMA-EA-001",
  "question": "Select all fighters who have held the UFC lightweight title.",
  "options": ["Khabib Nurmagomedov", "Nate Diaz", "BJ Penn", "Conor McGregor"],
  "answers": [0, 2, 3]
}

### multiple_choice

Radio buttons. Only one answer selectable. Clicking a new answer unticks the previous.

{
  "id": "MMA-EA-002",
  "type": "multiple_choice",
  "question": "Who was the first UFC heavyweight champion?",
  "options": ["Mark Coleman", "Dan Severn", "Bas Rutten", "Randy Couture"],
  "answers": [0]
}

### true_false

Binary. Always two options. options can be omitted — renderer fills in ["True", "False"].

{
  "id": "MMA-EA-003",
  "type": "true_false",
  "question": "Conor McGregor has never lost by KO.",
  "answers": [1],
  "explanation": "McGregor was knocked out by Dustin Poirier at UFC 257."
}

answers: [0] = True, [1] = False.

### typed

User types one or more short answers. Checked against a pool of accepted values. Order does not matter.

{
  "id": "MMA-ME-001",
  "type": "typed",
  "question": "Name three fighters who have held the UFC heavyweight title.",
  "answers": ["Stipe Miocic", "Francis Ngannou", "Jon Jones", "Cain Velasquez", "Brock Lesnar"],
  "required_count": 3,
  "case_sensitive": false,
  "tolerance": 0
}

- answers: full pool of accepted values
- required_count: how many the user must get right (defaults to answers.length)
- case_sensitive: defaults to false
- tolerance: for numeric answers, accepted +/- range (defaults to 0)

### fill_gap

A sentence with one or more ___ placeholders. User types the missing value into each gap in order.

{
  "id": "MMA-ME-002",
  "type": "fill_gap",
  "question": "Complete the sentence:",
  "template": "___ defeated ___ at UFC 229 to win the lightweight title.",
  "answers": ["Khabib Nurmagomedov", "Conor McGregor"],
  "case_sensitive": false,
  "tolerance": 0
}

- question: optional instruction shown above the template
- template: sentence with ___ as placeholders
- answers: one per ___, in order. Length must match ___ count exactly
- tolerance: for numeric gaps, accepted +/- range

### ordered (schema only — renderer coming soon)

User arranges answers into the correct sequence. Each answer has an optional description shown after reveal.

{
  "id": "MMA-HA-001",
  "type": "ordered",
  "question": "Put these champions in order of first title win.",
  "answers": [
    { "value": "Brock Lesnar", "description": "Won title in 2008" },
    { "value": "Cain Velasquez", "description": "Won title in 2010" },
    { "value": "Stipe Miocic", "description": "Won title in 2016" },
    { "value": "Francis Ngannou", "description": "Won title in 2021" }
  ]
}

### image (schema only — requires Supabase Storage)

{
  "id": "MMA-HA-002",
  "type": "image",
  "question": "Who is this fighter?",
  "image_url": "https://your-storage-url/fighter.jpg",
  "options": ["Jon Jones", "Daniel Cormier", "Alexander Gustafsson"],
  "answers": [0]
}

## Difficulty tiers

easy   -> early career / lower-ranked opponents
medium -> mid-career / mid-ranked opponents
hard   -> top organisations / ranked opponents
elite  -> title fights and championships

The game shifts effective tier at runtime based on player history (+1 correct, -1 wrong).

## ID format: PREFIX-TI-NNN

PREFIX: 2-4 uppercase letters (MMA, HIS, SCI)
TI: EA (easy) / ME (medium) / HA (hard) / EL (elite)
NNN: zero-padded number (001, 002...)
Example: MMA-HA-007

IDs must be unique within a module.

## Quantity guidelines

| Tier   | Minimum | Comfortable |
|--------|---------|-------------|
| easy   | 10      | 20+         |
| medium | 10      | 20+         |
| hard   | 10      | 20+         |
| elite  | 5       | 15+         |

Fewer than ~40 total questions will cause repeats in a long career.

## Backward compatibility

- type omitted -> treated as multi_select
- version omitted -> treated as v1
- Unknown types -> skipped by renderer with a warning
- All v1 questions remain valid without modification

## Minimal valid example

{
  "name": "My Module",
  "version": "2.0",
  "tiers": {
    "easy": [
      {
        "id": "MY-EA-001",
        "question": "What does MMA stand for?",
        "options": ["Mixed Martial Arts", "Modern Martial Arts", "Mixed Match Athletics"],
        "answers": [0],
        "explanation": "MMA stands for Mixed Martial Arts."
      }
    ]
  }
}

Note: no type field — defaults to multi_select.
`;

  // ── BUILDER STATE (mirrors the AI Create selector) ──
  const QUESTION_TYPES = [
    { value: 'multi_select',    label: 'Multi Select' },
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'true_false',      label: 'True / False' },
    { value: 'typed',           label: 'Typed Answer' },
    { value: 'fill_gap',        label: 'Fill the Gap' },
  ];
  const TIERS = [
    { key: 'easy',   label: 'Easy',   cls: 'te' },
    { key: 'medium', label: 'Medium', cls: 'tm' },
    { key: 'hard',   label: 'Hard',   cls: 'th' },
    { key: 'elite',  label: 'Elite',  cls: 'tx' },
  ];
  const MAX_PER_TIER = 25;
  const DEFAULT_PER_TIER = 10;
  const TYPE_VALUES = QUESTION_TYPES.map((t) => t.value);

  const PREFS_KEY = 'mcchimp_guide_prefs';
  const DEFAULTS = {
    prompt: '',
    selectedTypes: { multi_select: false, multiple_choice: true, true_false: false, typed: false, fill_gap: false },
    weights: { multi_select: 0, multiple_choice: 100, true_false: 0, typed: 0, fill_gap: 0 },
    counts: { easy: DEFAULT_PER_TIER, medium: DEFAULT_PER_TIER, hard: DEFAULT_PER_TIER, elite: DEFAULT_PER_TIER },
    autoTypes: false,
    autoCounts: false
  };
  const saved = (() => {
    if (!browser) return null;
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) || 'null'); } catch { return null; }
  })();

  let prompt = $state(saved?.prompt ?? DEFAULTS.prompt);
  let selectedTypes = $state({ ...DEFAULTS.selectedTypes, ...(saved?.selectedTypes || {}) });
  let weights = $state({ ...DEFAULTS.weights, ...(saved?.weights || {}) });
  let counts = $state({ ...DEFAULTS.counts, ...(saved?.counts || {}) });
  let autoTypes = $state(saved?.autoTypes ?? DEFAULTS.autoTypes);
  let autoCounts = $state(saved?.autoCounts ?? DEFAULTS.autoCounts);

  // Persist the form to this browser so it survives reloads.
  $effect(() => {
    const snap = JSON.stringify({ prompt, selectedTypes, weights, counts, autoTypes, autoCounts });
    if (!browser) return;
    try { localStorage.setItem(PREFS_KEY, snap); } catch { /* ignore */ }
  });

  const totalCount = $derived(TIERS.reduce((s, t) => s + (Number(counts[t.key]) || 0), 0));
  const anyType = $derived(Object.values(selectedTypes).some(Boolean));
  const enabledCount = $derived(TYPE_VALUES.filter((t) => selectedTypes[t]).length);
  const typesOk = $derived(autoTypes || anyType);
  const countsOk = $derived(autoCounts || totalCount > 0);
  const hasTopic = $derived(prompt.trim().length > 0);
  const canBuild = $derived(hasTopic && typesOk && countsOk);

  // Round float shares to integers that sum exactly to `target` (largest-remainder).
  function distribute(target, keys, floatMap) {
    const out = {}; let used = 0;
    const fracs = [];
    for (const k of keys) { const f = Math.floor(floatMap[k]); out[k] = f; used += f; fracs.push([k, floatMap[k] - f]); }
    fracs.sort((a, b) => b[1] - a[1]);
    const rem = target - used;
    for (let i = 0; i < rem; i++) out[fracs[i][0]]++;
    return out;
  }
  function normalizeWeights() {
    const enabled = TYPE_VALUES.filter((t) => selectedTypes[t]);
    const total = enabled.reduce((s, t) => s + (weights[t] || 0), 0);
    const floatMap = {};
    for (const t of enabled) floatMap[t] = total === 0 ? 100 / enabled.length : ((weights[t] || 0) / total) * 100;
    const ints = distribute(100, enabled, floatMap);
    const w = {};
    for (const t of TYPE_VALUES) w[t] = selectedTypes[t] ? ints[t] : 0;
    weights = w;
  }
  function toggleType(v) {
    const sel = { ...selectedTypes, [v]: !selectedTypes[v] };
    if (TYPE_VALUES.filter((t) => sel[t]).length === 0) return;
    if (sel[v] && (weights[v] || 0) === 0) {
      weights = { ...weights, [v]: Math.round(100 / TYPE_VALUES.filter((t) => sel[t]).length) };
    }
    selectedTypes = sel;
    normalizeWeights();
  }
  function setWeight(type, raw) {
    if (!selectedTypes[type]) return;
    const others = TYPE_VALUES.filter((t) => selectedTypes[t] && t !== type);
    let v = Math.round(Number(raw));
    if (!Number.isFinite(v) || v < 0) v = 0;
    if (v > 100) v = 100;
    if (others.length === 0) { weights = { ...weights, [type]: 100 }; return; }
    const remaining = 100 - v;
    const otherTotal = others.reduce((s, t) => s + (weights[t] || 0), 0);
    const floatMap = {};
    for (const t of others) floatMap[t] = otherTotal === 0 ? remaining / others.length : ((weights[t] || 0) / otherTotal) * remaining;
    const ints = distribute(remaining, others, floatMap);
    const w = { ...weights, [type]: v };
    for (const t of others) w[t] = ints[t];
    for (const t of TYPE_VALUES) if (!selectedTypes[t]) w[t] = 0;
    weights = w;
  }
  function clampCount(key) {
    let n = Math.round(Number(counts[key]) || 0);
    if (n < 0) n = 0;
    if (n > MAX_PER_TIER) n = MAX_PER_TIER;
    counts = { ...counts, [key]: n };
  }

  // ── PROMPT COMPOSITION ──
  function typeLabel(v) { return QUESTION_TYPES.find((t) => t.value === v)?.label || v; }

  // The request header — the part the user configures. The full schema is appended on export.
  const promptHead = $derived.by(() => {
    const lines = [];
    lines.push('# McChimp Question Set — Generation Request');
    lines.push('');
    lines.push('Act as a question-set author for McChimp. Using the topic and specifications below, produce a single valid `.json` question module that follows the schema in the reference at the end of this document. Output **only** the JSON file content — no commentary, no markdown code fences.');
    lines.push('');
    lines.push('## Topic');
    lines.push('');
    lines.push(prompt.trim() || '(describe your topic here)');
    lines.push('');
    lines.push('## Specifications');
    lines.push('');
    if (autoTypes) {
      lines.push('- **Question types & mix:** choose the types and proportions that best fit the topic.');
    } else {
      const parts = TYPE_VALUES.filter((t) => selectedTypes[t]).map((t) => `${typeLabel(t)} (${weights[t]}%)`);
      lines.push(`- **Question types & mix:** ${parts.join(', ')}. Follow this mix as closely as the question count allows.`);
    }
    if (autoCounts) {
      lines.push('- **Questions per tier:** decide a sensible number for each difficulty tier (easy, medium, hard, elite).');
    } else {
      const parts = TIERS.filter((t) => (Number(counts[t.key]) || 0) > 0).map((t) => `${t.label.toLowerCase()} ${counts[t.key]}`);
      lines.push(`- **Questions per tier:** ${parts.join(', ')} (total ${totalCount}).`);
    }
    lines.push('');
    lines.push('## Output rules');
    lines.push('');
    lines.push('- Return one JSON object only, matching the schema below.');
    lines.push('- Use the id format `PREFIX-TI-NNN` and keep every id unique within the module.');
    lines.push('- Give the module a clear `name` and a one-line `description`.');
    lines.push('- Vary the questions — avoid duplicates or near-duplicates.');
    lines.push('- Add a short `explanation` to each question where it helps.');
    return lines.join('\n');
  });

  const fullPrompt = $derived(`${promptHead}\n\n---\n\n${GUIDE_MD}`);

  function slug(s) {
    return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  }
  const fileName = $derived(`mcchimp_prompt_${slug(prompt) || 'set'}.md`);

  // ── EXPORT ──
  let copiedPrompt = $state(false);
  let copiedGuide = $state(false);
  let guideDownloadUrl = $state('');

  function copyText(text, set) {
    const done = () => { set(true); setTimeout(() => set(false), 2000); };
    navigator.clipboard.writeText(text).then(done).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    });
  }
  function copyPrompt() { copyText(fullPrompt, (v) => copiedPrompt = v); }
  function copyGuide() { copyText(GUIDE_MD, (v) => copiedGuide = v); }

  function downloadPrompt() {
    const blob = new Blob([fullPrompt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $effect(() => {
    if (!browser) return;
    const blob = new Blob([GUIDE_MD], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    guideDownloadUrl = url;
    return () => URL.revokeObjectURL(url);
  });
</script>

<svelte:head>
  <title>AI Guide — Questions — McChimp</title>
</svelte:head>

<div class="guide-wrap">
  <div class="builder-intro">
    <div class="gen-section-label">Prompt Builder</div>
    <h2 class="builder-title">Build an AI Prompt</h2>
    <p class="builder-sub">Describe your topic, pick the question types and how many per tier, then export a ready-to-paste prompt. It bundles the full McChimp schema with your specifications — paste it into ChatGPT, Claude or Gemini and you'll get a compatible <code>.json</code> set back.</p>
  </div>

  <div class="gen-form">
    <div class="gen-field">
      <label class="gen-label" for="topic-prompt">Topic</label>
      <textarea id="topic-prompt" class="gen-textarea" bind:value={prompt}
        placeholder="e.g. The causes and key events of the French Revolution, suitable for high-school students" style="min-height:90px;"></textarea>
    </div>

    <div class="gen-field">
      <div class="field-head">
        <span class="gen-label">Question types &amp; mix <span class="hint">(at least one — weights total 100%)</span></span>
        <button type="button" class="ctx-toggle" class:on={autoTypes} onclick={() => autoTypes = !autoTypes}>{autoTypes ? '✓ ' : ''}Let the AI decide</button>
      </div>
      {#if autoTypes}
        <div class="ctx-note">The AI will choose the question types and mix from your topic.</div>
      {:else}
        <div class="type-list">
          {#each QUESTION_TYPES as t}
            <div class="type-chip" class:marked={selectedTypes[t.value]}>
              <button type="button" class="type-chip-label" onclick={() => toggleType(t.value)}>{t.label}</button>
              {#if selectedTypes[t.value]}
                <span class="type-chip-weight">
                  <input type="number" class="chip-weight-input" min="0" max="100" step="1"
                    value={weights[t.value]} disabled={enabledCount <= 1}
                    oninput={(e) => setWeight(t.value, e.target.value)}>
                  <span class="chip-pct">%</span>
                </span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="gen-field">
      <div class="field-head">
        <span class="gen-label">Questions per tier <span class="hint">(0–{MAX_PER_TIER} each)</span></span>
        <button type="button" class="ctx-toggle" class:on={autoCounts} onclick={() => autoCounts = !autoCounts}>{autoCounts ? '✓ ' : ''}Let the AI decide</button>
      </div>
      {#if autoCounts}
        <div class="ctx-note">The AI will decide how many questions per difficulty tier.</div>
      {:else}
        <div class="count-grid">
          {#each TIERS as t}
            <div class="count-cell {t.cls}">
              <span class="count-tier">{t.label}</span>
              <input type="number" class="count-input" min="0" max={MAX_PER_TIER} step="1"
                bind:value={counts[t.key]} oninput={() => clampCount(t.key)}>
            </div>
          {/each}
        </div>
        <div class="count-total">Total: <strong>{totalCount}</strong> question{totalCount === 1 ? '' : 's'} <span class="hint">(max {MAX_PER_TIER * 4})</span></div>
      {/if}
    </div>

    <div class="gen-field">
      <span class="gen-label">Prompt preview <span class="hint">(full schema appended on export)</span></span>
      <div class="prompt-preview">{promptHead}</div>
    </div>

    <div class="guide-actions">
      <button class="btn-gold" onclick={downloadPrompt} disabled={!canBuild}>&#11015; Download prompt (<span class="fname">{fileName}</span>)</button>
      <button class="btn-outline" class:copied={copiedPrompt} onclick={copyPrompt} disabled={!canBuild}>
        {copiedPrompt ? '✓ Copied!' : 'Copy to clipboard'}
      </button>
    </div>
    {#if !canBuild}
      <div class="build-hint">
        {#if !hasTopic}Add a topic to build your prompt.{:else if !typesOk}Select at least one question type (or let the AI decide).{:else if !countsOk}Set at least one tier above zero (or let the AI decide).{/if}
      </div>
    {/if}
  </div>

  <!-- SCHEMA REFERENCE (foldable, collapsed by default) -->
  <details class="guide-details">
    <summary class="guide-summary">
      <span class="summary-title">Schema reference</span>
      <span class="summary-hint">Full v2 spec — every question type, field rule and example</span>
      <span class="summary-chevron" aria-hidden="true">▾</span>
    </summary>

    <div class="guide-details-body">
      <div class="guide-actions guide-actions-inner">
        <a class="btn-outline" href={guideDownloadUrl} download="mcchimp_question_guide_v2.md">&#11015; Download schema (.md)</a>
        <button class="btn-outline" class:copied={copiedGuide} onclick={copyGuide}>
          {copiedGuide ? '✓ Copied!' : 'Copy schema'}
        </button>
      </div>

      <div class="guide-section">
        <h3>Default Type</h3>
        <p>If you omit the <code>type</code> field, the question defaults to <code>multi_select</code>. All v1 question sets remain valid without modification.</p>
      </div>

      <div class="guide-section">
        <h3>File Format</h3>
        <p>A question module is a single <code>.json</code> file. You do not need all four tiers.</p>
        <div class="guide-code">{`{
  "name": "Module Name",
  "description": "One-line description (optional)",
  "version": "2.0",
  "tiers": {
    "easy":   [ ...questions ],
    "medium": [ ...questions ],
    "hard":   [ ...questions ],
    "elite":  [ ...questions ]
  }
}`}</div>
      </div>

      <div class="guide-section">
        <h3>Common Fields</h3>
        <table class="guide-table">
          <thead><tr><th>Field</th><th>Required</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>id</td><td><span class="field-req field-rec">Recommended</span></td><td>Stable string, unique within module. Format: PREFIX-TI-NNN</td></tr>
            <tr><td>type</td><td><span class="field-req field-no">Optional</span></td><td>Defaults to multi_select if omitted</td></tr>
            <tr><td>question</td><td><span class="field-req field-yes">Required*</span></td><td>Plain text. *Optional for fill_gap</td></tr>
            <tr><td>explanation</td><td><span class="field-req field-no">Optional</span></td><td>Shown after the answer is revealed</td></tr>
          </tbody>
        </table>
      </div>

      <div class="guide-section">
        <h3>Question Types</h3>
        <table class="guide-table">
          <thead><tr><th>Type</th><th>Selection</th><th>Text input</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>multi_select</td><td>Multiple</td><td>No</td><td><span class="status-live">✅ Default</span></td></tr>
            <tr><td>multiple_choice</td><td>One only</td><td>No</td><td><span class="status-live">✅ Live</span></td></tr>
            <tr><td>true_false</td><td>One only</td><td>No</td><td><span class="status-live">✅ Live</span></td></tr>
            <tr><td>typed</td><td>N answers</td><td>Yes</td><td><span class="status-live">✅ Live</span></td></tr>
            <tr><td>fill_gap</td><td>N gaps</td><td>Yes</td><td><span class="status-live">✅ Live</span></td></tr>
          </tbody>
        </table>
      </div>

      <div class="guide-section">
        <h3>multi_select <span class="default-badge">Default</span></h3>
        <p>Checkboxes. Multiple answers selectable. Wrong selections subtract a point — guessing is penalised.</p>
        <div class="guide-code">{`{
  "id": "MMA-EA-001",
  "question": "Select all fighters who have held the UFC lightweight title.",
  "options": ["Khabib Nurmagomedov", "Nate Diaz", "BJ Penn", "Conor McGregor"],
  "answers": [0, 2, 3]
}`}</div>
      </div>

      <div class="guide-section">
        <h3>multiple_choice</h3>
        <p>Radio buttons. Only one answer selectable — clicking a new answer unticks the previous one.</p>
        <div class="guide-code">{`{
  "id": "MMA-EA-002",
  "type": "multiple_choice",
  "question": "Who was the first UFC heavyweight champion?",
  "options": ["Mark Coleman", "Dan Severn", "Bas Rutten", "Randy Couture"],
  "answers": [0]
}`}</div>
      </div>

      <div class="guide-section">
        <h3>true_false</h3>
        <p>Binary question. <code>options</code> can be omitted — renderer fills in <code>["True", "False"]</code> automatically. Use <code>[0]</code> for True, <code>[1]</code> for False.</p>
        <div class="guide-code">{`{
  "id": "MMA-EA-003",
  "type": "true_false",
  "question": "Conor McGregor has never lost by KO.",
  "answers": [1],
  "explanation": "McGregor was knocked out by Dustin Poirier at UFC 257."
}`}</div>
      </div>

      <div class="guide-section">
        <h3>typed</h3>
        <p>User types one or more short answers into text inputs. Checked against a pool of accepted values. Order does not matter.</p>
        <div class="guide-code">{`{
  "id": "MMA-ME-001",
  "type": "typed",
  "question": "Name three fighters who have held the UFC heavyweight title.",
  "answers": ["Stipe Miocic", "Francis Ngannou", "Jon Jones", "Cain Velasquez", "Brock Lesnar"],
  "required_count": 3,
  "case_sensitive": false,
  "tolerance": 0
}`}</div>
        <table class="guide-table">
          <thead><tr><th>Field</th><th>Required</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>answers</td><td><span class="field-req field-yes">Required</span></td><td>Full pool of accepted values</td></tr>
            <tr><td>required_count</td><td><span class="field-req field-no">Optional</span></td><td>How many the user must get right. Defaults to answers.length</td></tr>
            <tr><td>case_sensitive</td><td><span class="field-req field-no">Optional</span></td><td>Defaults to false</td></tr>
            <tr><td>tolerance</td><td><span class="field-req field-no">Optional</span></td><td>For numeric answers, accepted ±range. Defaults to 0</td></tr>
          </tbody>
        </table>
      </div>

      <div class="guide-section">
        <h3>fill_gap</h3>
        <p>A sentence with one or more <code>___</code> placeholders. User types the missing value into each gap in order. Multiple gaps supported.</p>
        <div class="guide-code">{`{
  "id": "MMA-ME-002",
  "type": "fill_gap",
  "question": "Complete the sentence:",
  "template": "___ defeated ___ at UFC 229 to win the lightweight title.",
  "answers": ["Khabib Nurmagomedov", "Conor McGregor"],
  "case_sensitive": false,
  "tolerance": 0,
  "explanation": "Khabib won by submission in round 4."
}`}</div>
        <table class="guide-table">
          <thead><tr><th>Field</th><th>Required</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>question</td><td><span class="field-req field-no">Optional</span></td><td>Instruction shown above the template</td></tr>
            <tr><td>template</td><td><span class="field-req field-yes">Required</span></td><td>Sentence with ___ as placeholders</td></tr>
            <tr><td>answers</td><td><span class="field-req field-yes">Required</span></td><td>One per ___, in order. Count must match exactly</td></tr>
            <tr><td>tolerance</td><td><span class="field-req field-no">Optional</span></td><td>For numeric gaps, accepted ±range. Defaults to 0</td></tr>
          </tbody>
        </table>
      </div>

      <div class="guide-section">
        <h3>ID Format</h3>
        <p><code>PREFIX-TI-NNN</code> — e.g. <code>MMA-HA-007</code></p>
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
  </details>
</div>

<style>
  .guide-wrap { padding: 64px 48px; max-width: 900px; }

  /* ── Builder ── */
  .builder-intro { margin-bottom: 24px; }
  .gen-section-label { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--gold); margin-bottom: 10px; }
  .builder-title { font-family: 'Bebas Neue', sans-serif; font-size: 34px; letter-spacing: .03em; color: var(--white); margin-bottom: 8px; }
  .builder-sub { font-size: 14px; color: rgba(242,239,232,0.55); line-height: 1.7; max-width: 620px; }
  .builder-sub code { color: var(--gold); font-family: monospace; }

  .gen-form { background: var(--surface); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 24px; margin-bottom: 40px; }
  .gen-field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
  .field-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .ctx-toggle {
    font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700;
    letter-spacing: .08em; text-transform: uppercase;
    background: transparent; color: var(--muted); border: 1px solid rgba(255,255,255,0.12);
    padding: 5px 10px; border-radius: 999px; cursor: pointer; transition: all .15s; white-space: nowrap;
  }
  .ctx-toggle:hover { color: var(--white); border-color: rgba(255,255,255,0.3); }
  .ctx-toggle.on { background: rgba(232,193,74,0.12); border-color: rgba(232,193,74,0.45); color: var(--gold); }
  .ctx-note {
    font-size: 12px; color: var(--muted); line-height: 1.5;
    background: rgba(232,193,74,0.06); border: 1px dashed rgba(232,193,74,0.25);
    border-radius: 3px; padding: 10px 12px;
  }
  .gen-label { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .hint { font-weight: 400; text-transform: none; letter-spacing: 0; font-size: 10px; opacity: .8; }
  .gen-textarea { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 3px; color: var(--white); font-family: 'Barlow', sans-serif; font-size: 13px; padding: 9px 12px; outline: none; transition: border-color .15s; width: 100%; resize: vertical; line-height: 1.5; }
  .gen-textarea:focus { border-color: rgba(232,193,74,0.5); }
  .gen-textarea::placeholder { color: var(--muted); opacity: .5; }

  .type-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .type-chip { display: inline-flex; align-items: stretch; border: 1px solid rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; background: rgba(255,255,255,0.04); transition: all .15s; }
  .type-chip.marked { border-color: rgba(232,193,74,0.4); background: rgba(232,193,74,0.1); }
  .type-chip-label { background: transparent; border: none; color: var(--muted); font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 8px 12px; cursor: pointer; transition: color .15s; white-space: nowrap; }
  .type-chip-label::before { content: '○'; margin-right: 7px; font-size: 10px; opacity: .6; }
  .type-chip-label:hover { color: var(--white); }
  .type-chip.marked .type-chip-label { color: var(--gold); }
  .type-chip.marked .type-chip-label::before { content: '●'; opacity: 1; }
  .type-chip-weight { display: inline-flex; align-items: center; gap: 1px; border-left: 1px solid rgba(232,193,74,0.25); padding: 0 8px 0 6px; }
  .chip-weight-input { width: 48px; text-align: right; background: transparent; border: none; color: var(--white); font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 600; padding: 6px 0; outline: none; }
  .chip-weight-input:disabled { opacity: .5; cursor: not-allowed; }
  .chip-pct { font-size: 11px; color: var(--muted); }

  .count-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .count-cell { display: flex; flex-direction: column; gap: 6px; padding: 12px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }
  .count-cell.te { border-color: rgba(46,139,87,0.25); }
  .count-cell.tm { border-color: rgba(232,193,74,0.25); }
  .count-cell.th { border-color: rgba(42,94,173,0.3); }
  .count-cell.tx { border-color: rgba(180,74,232,0.3); }
  .count-tier { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .count-cell.te .count-tier { color: #4CAF85; }
  .count-cell.tm .count-tier { color: var(--gold); }
  .count-cell.th .count-tier { color: #6B9FE4; }
  .count-cell.tx .count-tier { color: #C07AEA; }
  .count-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 3px; color: var(--white); font-family: 'Barlow', sans-serif; font-size: 15px; font-weight: 600; padding: 7px 10px; outline: none; width: 100%; transition: border-color .15s; }
  .count-input:focus { border-color: rgba(232,193,74,0.5); }
  .count-total { font-size: 12px; color: var(--muted); margin-top: 10px; }
  .count-total strong { color: var(--white); }

  .prompt-preview {
    background: var(--off); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px;
    padding: 16px 18px; font-family: monospace; font-size: 12px; color: rgba(242,239,232,0.7);
    line-height: 1.7; white-space: pre-wrap; word-break: break-word; max-height: 320px; overflow-y: auto;
  }

  .guide-actions { display: flex; gap: 12px; flex-wrap: wrap; }
  .btn-gold { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: var(--gold); color: var(--black); border: none; padding: 12px 24px; border-radius: 2px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: background .15s; }
  .btn-gold:hover:not(:disabled) { background: var(--gold2); }
  .btn-gold:disabled { opacity: .4; cursor: not-allowed; }
  .fname { font-family: monospace; font-size: 11px; text-transform: none; letter-spacing: 0; font-weight: 600; opacity: .85; }
  .btn-outline { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: transparent; color: var(--white); border: 1px solid rgba(255,255,255,0.2); padding: 12px 24px; border-radius: 2px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: border-color .15s, color .15s; text-decoration: none; }
  .btn-outline:hover:not(:disabled) { border-color: rgba(255,255,255,0.5); }
  .btn-outline:disabled { opacity: .4; cursor: not-allowed; }
  .btn-outline.copied { border-color: var(--green); color: #4CAF85; }
  .build-hint { font-size: 11px; color: var(--muted); margin-top: 10px; }

  /* ── Foldable schema reference ── */
  .guide-details { border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; background: rgba(255,255,255,0.015); }
  .guide-summary {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 18px 22px; cursor: pointer; list-style: none; user-select: none;
  }
  .guide-summary::-webkit-details-marker { display: none; }
  .summary-title { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: .04em; color: var(--white); line-height: 1; }
  .summary-hint { font-size: 12px; color: var(--muted); flex: 1; }
  .summary-chevron { color: var(--gold); font-size: 14px; transition: transform .2s; }
  .guide-details[open] .summary-chevron { transform: rotate(180deg); }
  .guide-summary:hover .summary-title { color: var(--gold); }
  .guide-details-body { padding: 4px 22px 28px; border-top: 1px solid rgba(255,255,255,0.06); }
  .guide-actions-inner { margin: 24px 0 36px; }

  .guide-section { margin-bottom: 48px; }
  .guide-section:last-child { margin-bottom: 0; }
  .guide-section h3 { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: .04em; color: var(--white); margin-bottom: 14px; line-height: 1; display: flex; align-items: center; gap: 12px; }
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
  .default-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: rgba(46,139,87,0.15); color: #4CAF85; border: 1px solid rgba(46,139,87,0.3); padding: 3px 8px; border-radius: 2px; vertical-align: middle; }
  .status-live { color: #4CAF85; font-size: 12px; }

  @media (max-width: 900px) {
    .guide-wrap { padding: 40px 24px; }
    .count-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
