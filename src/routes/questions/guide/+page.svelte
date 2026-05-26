<script>
  import { onMount } from 'svelte';

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

  let guideDownloadUrl = $state('');
  let copiedGuide = $state(false);

  onMount(() => {
    const blob = new Blob([GUIDE_MD], { type: 'text/markdown' });
    guideDownloadUrl = URL.createObjectURL(blob);
  });

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
</script>

<svelte:head>
  <title>AI Guide — Questions — McChimp</title>
</svelte:head>

<div class="guide-wrap">
  <div class="guide-section">
    <h3>How to prompt an AI to make a question set</h3>
    <p>Any major AI assistant — ChatGPT, Claude, Gemini — can generate a fully compatible McChimp question set if you give it the right instructions. Download the guide below, paste it into your AI chat, describe your topic, and it will produce a ready-to-use JSON file.</p>
    <p>The guide covers the full v2 schema including all question types, field rules, difficulty tiers, ID format, and quantity guidelines.</p>
  </div>

  <div class="guide-actions">
    <a class="btn-gold" href={guideDownloadUrl} download="mcchimp_question_guide_v2.md">&#11015; Download Guide v2 (.md)</a>
    <button class="btn-outline" class:copied={copiedGuide} onclick={copyGuide}>
      {copiedGuide ? '✓ Copied!' : 'Copy to Clipboard'}
    </button>
  </div>

  <!-- DEFAULT TYPE -->
  <div class="guide-section">
    <h3>Default Type</h3>
    <p>If you omit the <code>type</code> field, the question defaults to <code>multi_select</code>. All v1 question sets remain valid without modification.</p>
  </div>

  <!-- FILE FORMAT -->
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

  <!-- COMMON FIELDS -->
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

  <!-- TYPE SUMMARY -->
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
        <tr><td>ordered</td><td>All in order</td><td>No</td><td><span class="status-soon">⏳ Coming soon</span></td></tr>
        <tr><td>image</td><td>One only</td><td>No</td><td><span class="status-soon">⏳ Needs Storage</span></td></tr>
      </tbody>
    </table>
  </div>

  <!-- MULTI SELECT -->
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

  <!-- MULTIPLE CHOICE -->
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

  <!-- TRUE FALSE -->
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

  <!-- TYPED -->
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

  <!-- FILL GAP -->
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

  <!-- ORDERED -->
  <div class="guide-section">
    <h3>ordered <span class="soon-badge">Coming Soon</span></h3>
    <p>User arranges answers into the correct sequence. Each answer has an optional description shown after the reveal. You can write these now — the renderer will support them in a future update.</p>
    <div class="guide-code">{`{
  "id": "MMA-HA-001",
  "type": "ordered",
  "question": "Put these champions in order of first title win.",
  "answers": [
    { "value": "Brock Lesnar", "description": "Won title in 2008" },
    { "value": "Cain Velasquez", "description": "Won title in 2010" },
    { "value": "Stipe Miocic", "description": "Won title in 2016" },
    { "value": "Francis Ngannou", "description": "Won title in 2021" }
  ]
}`}</div>
  </div>

  <!-- IMAGE -->
  <div class="guide-section">
    <h3>image <span class="soon-badge">Needs Storage</span></h3>
    <p>An image is shown to the user, answered as multiple choice. Requires Supabase Storage to be configured. You can write these now — they will be skipped by the renderer until Storage is set up.</p>
    <div class="guide-code">{`{
  "id": "MMA-HA-002",
  "type": "image",
  "question": "Who is this fighter?",
  "image_url": "https://your-storage-url/fighter.jpg",
  "options": ["Jon Jones", "Daniel Cormier", "Alexander Gustafsson", "Glover Teixeira"],
  "answers": [0]
}`}</div>
  </div>

  <!-- ID FORMAT -->
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

  <!-- QUANTITY -->
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

<style>
  .guide-wrap { padding: 64px 48px; max-width: 900px; }
  .guide-actions { display: flex; gap: 12px; margin-bottom: 48px; flex-wrap: wrap; }
  .btn-gold { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: var(--gold); color: var(--black); border: none; padding: 12px 24px; border-radius: 2px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: background .15s; }
  .btn-gold:hover { background: var(--gold2); }
  .btn-outline { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: transparent; color: var(--white); border: 1px solid rgba(255,255,255,0.2); padding: 12px 24px; border-radius: 2px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: border-color .15s, color .15s; }
  .btn-outline:hover { border-color: rgba(255,255,255,0.5); }
  .btn-outline.copied { border-color: var(--green); color: #4CAF85; }
  .guide-section { margin-bottom: 48px; }
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
  .soon-badge { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: rgba(107,107,107,0.1); color: var(--muted); border: 1px solid rgba(107,107,107,0.2); padding: 3px 8px; border-radius: 2px; vertical-align: middle; }
  .status-live { color: #4CAF85; font-size: 12px; }
  .status-soon { color: var(--muted); font-size: 12px; }

  @media (max-width: 900px) { .guide-wrap { padding: 40px 24px; } }
</style>
