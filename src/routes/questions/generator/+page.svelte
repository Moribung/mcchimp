<script>
  import { validateQuestionSet } from '$lib/validateQuestionSet';
  import { supabase } from '$lib/supabase';
  import { session } from '$lib/stores/session';
  import { onMount } from 'svelte';

  // ── LOAD FROM LIBRARY ──
  onMount(() => {
    const stored = sessionStorage.getItem('mcchimp_gen_load');
    if (stored) {
      sessionStorage.removeItem('mcchimp_gen_load');
      try {
        const { libraryId: id, data } = JSON.parse(stored);
        if (data.name) genName = data.name;
        if (data.description) genDesc = data.description;
        const firstQ = Object.values(data.tiers || {}).flat()[0];
        if (firstQ?.id) genPrefix = firstQ.id.split('-')[0] || '';
        genTiers = { easy: [], medium: [], hard: [], elite: [] };
        for (const t of ['easy', 'medium', 'hard', 'elite']) {
          if (Array.isArray(data.tiers?.[t])) genTiers[t] = data.tiers[t].map(q => ({ ...q }));
        }
        genTiers = { ...genTiers };
        libraryId = id;
        saveStatus = 'saved';
      } catch(e) {}
    }
  });

  const TIER_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', elite: 'Elite' };
  const TIER_TI = { easy: 'EA', medium: 'ME', hard: 'HA', elite: 'EL' };

  const QUESTION_TYPES = [
    { value: 'multi_select',    label: 'Multi Select (default)' },
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'true_false',      label: 'True / False' },
    { value: 'typed',           label: 'Typed Answer' },
    { value: 'fill_gap',        label: 'Fill the Gap' },
    { value: 'ordered',         label: 'Ordered (coming soon)' },
    { value: 'image',           label: 'Image (coming soon)' },
  ];

  const SOON_TYPES = ['ordered', 'image'];

  // ── SET STATE ──
  let genTiers = $state({ easy: [], medium: [], hard: [], elite: [] });
  let activeTier = $state('easy');
  let genName = $state('');
  let genPrefix = $state('');
  let genDesc = $state('');
  let genValidationIssues = $state([]);

  // ── LIBRARY / STATUS STATE ──
  let libraryId = $state(null);       // set if loaded from library
  let saveStatus = $state('unsaved'); // 'unsaved' | 'saved' | 'downloaded'
  let saving = $state(false);
  let saveError = $state('');
  let saveSuccess = $state('');

  // ── CONFIRM DIALOG ──
  let showConfirm = $state(false);
  let confirmAction = $state(null); // function to call if confirmed
  let confirmMessage = $state('');

  // ── FORM STATE ──
  let genType = $state('multi_select');
  let genDiff = $state('easy');
  let genQText = $state('');
  let genExplanation = $state('');
  let genAddErr = $state('');

  // multi_select / multiple_choice options
  let genOptions = $state([
    { text: '', correct: false },
    { text: '', correct: false },
    { text: '', correct: false },
    { text: '', correct: false },
  ]);

  // typed
  let genTypedAnswers = $state(['', '']);
  let genTypedRequired = $state('');

  // fill_gap
  let genTemplate = $state('');
  let genGapAnswers = $state(['']);

  // ordered
  let genOrderedItems = $state([
    { value: '', description: '' },
    { value: '', description: '' },
  ]);

  // ── EDIT STATE ──
  let editingQ = $state(null);
  let editText = $state('');
  let editOptions = $state([]);
  let editExplanation = $state('');
  let editType = $state('multi_select');
  let editTypedAnswers = $state([]);
  let editTypedRequired = $state('');
  let editTemplate = $state('');
  let editGapAnswers = $state([]);
  let editOrderedItems = $state([]);

  // ── HELPERS ──
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

  function resetForm() {
    genQText = '';
    genExplanation = '';
    genAddErr = '';
    genTemplate = '';
    genGapAnswers = [''];
    genTypedAnswers = ['', ''];
    genTypedRequired = '';
    genOrderedItems = [{ value: '', description: '' }, { value: '', description: '' }];
    genOptions = [
      { text: '', correct: false },
      { text: '', correct: false },
      { text: '', correct: false },
      { text: '', correct: false },
    ];
  }

  // ── TEMPLATE GAP SYNC ──
  function syncGapsFromTemplate() {
    const count = (genTemplate.match(/___/g) || []).length;
    if (count === genGapAnswers.length) return;
    if (count > genGapAnswers.length) {
      genGapAnswers = [...genGapAnswers, ...Array(count - genGapAnswers.length).fill('')];
    } else {
      genGapAnswers = genGapAnswers.slice(0, count);
    }
  }

  // ── OPTIONS ──
  function genAddOption() {
    if (genOptions.length >= 7) return;
    genOptions = [...genOptions, { text: '', correct: false }];
  }

  function genRemoveOption(idx) {
    if (genOptions.length <= 2) return;
    genOptions = genOptions.filter((_, i) => i !== idx);
  }

  function genToggleCorrect(idx) {
    if (genType === 'multiple_choice') {
      genOptions = genOptions.map((o, i) => ({ ...o, correct: i === idx ? !o.correct : false }));
    } else {
      genOptions = genOptions.map((o, i) => i === idx ? { ...o, correct: !o.correct } : o);
    }
  }

  // ── ADD QUESTION ──
  function genAddQuestion() {
    genAddErr = '';
    const tier = genDiff;
    const id = genMakeId(tier);
    let q = { id };
    if (genType !== 'multi_select') q.type = genType;
    if (genExplanation.trim()) q.explanation = genExplanation.trim();

    if (genType === 'multi_select' || genType === 'multiple_choice') {
      const text = genQText.trim();
      const filled = genOptions.filter(o => o.text.trim());
      const answers = genOptions.map((o, i) => o.correct ? i : -1).filter(i => i >= 0);
      if (!text) { genAddErr = 'Question text is required.'; return; }
      if (filled.length < 2) { genAddErr = 'At least 2 options are required.'; return; }
      if (answers.length === 0) { genAddErr = 'At least one correct answer must be marked.'; return; }
      if (genType === 'multiple_choice' && answers.length > 1) { genAddErr = 'Multiple choice only allows one correct answer.'; return; }
      q.question = text;
      q.options = genOptions.map(o => o.text);
      q.answers = answers;
    }

    else if (genType === 'true_false') {
      const text = genQText.trim();
      if (!text) { genAddErr = 'Question text is required.'; return; }
      const answers = genOptions.map((o, i) => o.correct ? i : -1).filter(i => i >= 0);
      if (answers.length !== 1) { genAddErr = 'Select True or False as the correct answer.'; return; }
      q.question = text;
      q.answers = answers;
    }

    else if (genType === 'typed') {
      const text = genQText.trim();
      const filled = genTypedAnswers.map(a => a.trim()).filter(Boolean);
      if (!text) { genAddErr = 'Question text is required.'; return; }
      if (filled.length === 0) { genAddErr = 'At least one accepted answer is required.'; return; }
      q.question = text;
      q.answers = filled;
      if (genTypedRequired.trim()) {
        const n = parseInt(genTypedRequired);
        if (!isNaN(n) && n > 0 && n <= filled.length) q.required_count = n;
      }
    }

    else if (genType === 'fill_gap') {
      const template = genTemplate.trim();
      const gapCount = (template.match(/___/g) || []).length;
      const filled = genGapAnswers.map(a => a.trim());
      if (!template) { genAddErr = 'Template is required.'; return; }
      if (gapCount === 0) { genAddErr = 'Template must contain at least one ___ placeholder.'; return; }
      if (filled.some(a => !a)) { genAddErr = 'All gap answers are required.'; return; }
      if (filled.length !== gapCount) { genAddErr = `Template has ${gapCount} gap(s) but ${filled.length} answer(s) provided.`; return; }
      if (genQText.trim()) q.question = genQText.trim();
      q.template = template;
      q.answers = filled;
    }

    else if (genType === 'ordered') {
      const text = genQText.trim();
      const items = genOrderedItems.filter(i => i.value.trim());
      if (!text) { genAddErr = 'Question text is required.'; return; }
      if (items.length < 2) { genAddErr = 'At least 2 ordered items are required.'; return; }
      q.question = text;
      q.answers = items.map(i => ({ value: i.value.trim(), ...(i.description.trim() ? { description: i.description.trim() } : {}) }));
    }

    else if (genType === 'image') {
      genAddErr = 'Image questions are not yet supported in the generator.';
      return;
    }

    genTiers = { ...genTiers, [tier]: [...genTiers[tier], q] };
    activeTier = tier;
    genSwitchTier(tier);
    resetForm();
  }

  // ── DELETE ──
  function genDeleteQ(tier, idx) {
    genTiers = { ...genTiers, [tier]: genTiers[tier].filter((_, i) => i !== idx) };
  }

  // ── EDIT ──
  function genStartEdit(tier, idx) {
    const q = genTiers[tier][idx];
    editingQ = { tier, idx };
    editType = q.type || 'multi_select';
    editText = q.question || '';
    editExplanation = q.explanation || '';
    editTemplate = q.template || '';
    editGapAnswers = Array.isArray(q.answers) && editType === 'fill_gap' ? [...q.answers] : [];
    editTypedAnswers = Array.isArray(q.answers) && editType === 'typed' ? [...q.answers] : [];
    editTypedRequired = q.required_count?.toString() || '';
    editOrderedItems = Array.isArray(q.answers) && editType === 'ordered'
      ? q.answers.map(a => ({ value: a.value || '', description: a.description || '' }))
      : [];
    editOptions = Array.isArray(q.options)
      ? q.options.map((text, i) => ({ text, correct: (q.answers || []).includes(i) }))
      : [{ text: 'True', correct: (q.answers||[])[0]===0 }, { text: 'False', correct: (q.answers||[])[0]===1 }];
  }

  function genSaveEdit() {
    if (!editingQ) return;
    const { tier, idx } = editingQ;
    const q = { ...genTiers[tier][idx] };
    if (editType !== 'multi_select') q.type = editType; else delete q.type;
    if (editExplanation.trim()) q.explanation = editExplanation.trim(); else delete q.explanation;

    if (editType === 'multi_select' || editType === 'multiple_choice') {
      q.question = editText;
      q.options = editOptions.map(o => o.text);
      q.answers = editOptions.map((o, i) => o.correct ? i : -1).filter(i => i >= 0);
      delete q.template; delete q.answers_pool;
    } else if (editType === 'true_false') {
      q.question = editText;
      q.answers = editOptions.map((o, i) => o.correct ? i : -1).filter(i => i >= 0);
      delete q.options; delete q.template;
    } else if (editType === 'typed') {
      q.question = editText;
      q.answers = editTypedAnswers.map(a => a.trim()).filter(Boolean);
      if (editTypedRequired.trim()) q.required_count = parseInt(editTypedRequired);
      else delete q.required_count;
      delete q.options; delete q.template;
    } else if (editType === 'fill_gap') {
      if (editText.trim()) q.question = editText; else delete q.question;
      q.template = editTemplate;
      q.answers = editGapAnswers.map(a => a.trim());
      delete q.options;
    } else if (editType === 'ordered') {
      q.question = editText;
      q.answers = editOrderedItems.map(i => ({ value: i.value.trim(), ...(i.description.trim() ? { description: i.description.trim() } : {}) }));
      delete q.options; delete q.template;
    }

    genTiers = { ...genTiers, [tier]: genTiers[tier].map((item, i) => i === idx ? q : item) };
    editingQ = null;
  }

  function genCancelEdit() { editingQ = null; }

  // ── HAS CONTENT ──
  function hasContent() {
    return genTotal() > 0 || genName.trim().length > 0;
  }

  // ── CONFIRM DIALOG ──
  function askConfirm(message, action) {
    confirmMessage = message;
    confirmAction = action;
    showConfirm = true;
  }

  function confirmYes() {
    showConfirm = false;
    if (confirmAction) { confirmAction(); confirmAction = null; }
  }

  function confirmNo() {
    showConfirm = false;
    confirmAction = null;
  }

  // ── BUILD OUTPUT OBJECT ──
  function buildOutput() {
    const out = { name: genName.trim() };
    if (genDesc.trim()) out.description = genDesc.trim();
    out.version = '2.0';
    out.tiers = {};
    for (const t of ['easy', 'medium', 'hard', 'elite']) {
      if (genTiers[t].length) out.tiers[t] = genTiers[t];
    }
    return out;
  }

  // ── DOWNLOAD ──
  function genDownload() {
    const out = buildOutput();
    const issues = validateQuestionSet(out);
    genValidationIssues = issues;
    if (issues.length) return;

    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = genName.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    saveStatus = 'downloaded';
  }

  // ── SAVE TO LIBRARY ──
  async function genSaveToLibrary() {
    saveError = '';
    saveSuccess = '';
    const out = buildOutput();
    const issues = validateQuestionSet(out);
    genValidationIssues = issues;
    if (issues.length) return;

    saving = true;
    const count = Object.values(out.tiers || {}).flat().length;

    if (libraryId) {
      // Update existing
      const { error } = await supabase
        .from('user_question_sets')
        .update({
          name: out.name,
          description: out.description || null,
          data: out,
          question_count: count,
          updated_at: new Date().toISOString()
        })
        .eq('id', libraryId)
        .eq('user_id', $session.user.id);
      saving = false;
      if (error) { saveError = error.message; }
      else { saveStatus = 'saved'; saveSuccess = 'Saved to library.'; setTimeout(() => saveSuccess = '', 3000); }
    } else {
      // Check limit
      const { data: profile } = await supabase.from('profiles').select('tier, set_limit').eq('id', $session.user.id).single();
      const { count: existing } = await supabase.from('user_question_sets').select('id', { count: 'exact', head: true }).eq('user_id', $session.user.id);
      const limit = profile?.set_limit ?? 3;
      if (existing >= limit) {
        saving = false;
        saveError = `You've reached your limit of ${limit} sets. Upgrade to Pro for more.`;
        return;
      }
      const { data, error } = await supabase
        .from('user_question_sets')
        .insert({
          user_id: $session.user.id,
          name: out.name,
          description: out.description || null,
          data: out,
          question_count: count,
          is_public: false
        })
        .select('id')
        .single();
      saving = false;
      if (error) { saveError = error.message; }
      else { libraryId = data.id; saveStatus = 'saved'; saveSuccess = 'Saved to library.'; setTimeout(() => saveSuccess = '', 3000); }
    }
  }

  // ── UPLOAD ──
  function doUpload(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.name) genName = data.name;
        if (data.description) genDesc = data.description;
        const firstQ = Object.values(data.tiers || {}).flat()[0];
        if (firstQ?.id) genPrefix = firstQ.id.split('-')[0] || '';
        else genNameChanged();
        genTiers = { easy: [], medium: [], hard: [], elite: [] };
        for (const t of ['easy', 'medium', 'hard', 'elite']) {
          if (Array.isArray(data.tiers?.[t])) {
            genTiers[t] = data.tiers[t].map(q => ({ ...q }));
          }
        }
        genTiers = { ...genTiers };
        libraryId = null;
        saveStatus = 'unsaved';
        genValidationIssues = [];
      } catch(err) {
        alert('Could not parse JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function genHandleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    if (hasContent()) {
      askConfirm(
        'You have unsaved work. Loading a new set will discard your current questions. Continue?',
        () => doUpload(file)
      );
    } else {
      doUpload(file);
    }
  }

  // ── NEW SET / CLEAR ──
  function doNewSet() {
    genTiers = { easy: [], medium: [], hard: [], elite: [] };
    genName = ''; genPrefix = ''; genDesc = '';
    genValidationIssues = [];
    activeTier = 'easy';
    genDiff = 'easy';
    genType = 'multi_select';
    libraryId = null;
    saveStatus = 'unsaved';
    saveError = '';
    saveSuccess = '';
    resetForm();
  }

  function genClear() {
    if (hasContent()) {
      askConfirm(
        'Start a new set? Your current questions will be lost.',
        doNewSet
      );
    } else {
      doNewSet();
    }
  }

  // ── DISPLAY HELPERS ──
  function questionSummary(q) {
    const type = q.type || 'multi_select';
    if (type === 'fill_gap') return q.template || '';
    if (type === 'typed') return `Type ${q.required_count || q.answers?.length} answer(s) from pool of ${q.answers?.length}`;
    if (type === 'ordered') return `Order ${q.answers?.length} items`;
    return q.question || '';
  }
</script>

<svelte:head>
  <title>Generator — Questions — McChimp</title>
</svelte:head>

<div class="gen-wrap">

  <!-- SIDEBAR -->
  <div class="gen-sidebar">
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div class="gen-status-row">
        <div class="gen-section-label" style="margin-bottom:0">Total: {genTotal()} questions</div>
        <span class="status-pill status-{saveStatus}">
          {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'downloaded' ? '↓ Downloaded' : '● Unsaved'}
        </span>
      </div>
      {#if genName.trim()}
        <div class="gen-set-name">{genName}</div>
      {/if}
      <label class="gen-action-btn" style="cursor:pointer;">
        &#11014; Upload JSON
        <input type="file" accept=".json" onchange={genHandleUpload} style="display:none;">
      </label>
      <button class="gen-action-btn gen-dl-btn" onclick={genDownload}>&#11015; Download JSON</button>
      {#if $session}
        <button class="gen-action-btn gen-save-btn" onclick={genSaveToLibrary} disabled={saving}>
          {saving ? 'Saving…' : libraryId ? '↑ Update Library' : '↑ Save to Library'}
        </button>
      {/if}
      <button class="gen-action-btn gen-clear-btn" onclick={genClear}>New Set</button>
    </div>

    {#if saveError}
      <div class="gen-save-error">{saveError}</div>
    {/if}
    {#if saveSuccess}
      <div class="gen-save-success">{saveSuccess}</div>
    {/if}

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
          <button class="tier-switch-btn t{tier[0]}" class:active={activeTier === tier} onclick={() => genSwitchTier(tier)}>
            {TIER_LABELS[tier]}
            <span class="tier-count">{genTiers[tier].length}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- MAIN -->
  <div class="gen-main">

    {#if genValidationIssues.length}
      <div class="gen-validation">
        <div class="gen-validation-title">Please fix these issues before downloading</div>
        <ul>{#each genValidationIssues as issue}<li>{issue}</li>{/each}</ul>
      </div>
    {/if}

    <!-- ADD FORM -->
    <div class="gen-form">
      <div class="gen-form-title">Add Question</div>

      <!-- TYPE + DIFFICULTY ROW -->
      <div class="gen-row">
        <div class="gen-field" style="margin-bottom:0">
          <label class="gen-label" for="gen-type">Question Type</label>
          <select id="gen-type" class="diff-select" bind:value={genType} onchange={resetForm}>
            {#each QUESTION_TYPES as t}
              <option value={t.value} disabled={SOON_TYPES.includes(t.value)}>{t.label}</option>
            {/each}
          </select>
        </div>
        <div class="gen-field" style="margin-bottom:0">
          <label class="gen-label" for="gen-diff">Difficulty</label>
          <select id="gen-diff" class="diff-select" bind:value={genDiff}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="elite">Elite</option>
          </select>
        </div>
      </div>

      {#if SOON_TYPES.includes(genType)}
        <div class="type-soon-notice">This type is not yet supported in the generator. You can add it manually by editing the downloaded JSON.</div>
      {:else}

        <!-- QUESTION TEXT — all types except fill_gap where it's optional -->
        {#if genType !== 'fill_gap'}
          <div class="gen-field">
            <label class="gen-label" for="gen-qtext">
              Question Text{genType === 'fill_gap' ? ' (optional)' : ''}
            </label>
            <textarea id="gen-qtext" class="gen-textarea" bind:value={genQText} placeholder="Enter your question here…" style="min-height:72px;"></textarea>
          </div>
        {:else}
          <div class="gen-field">
            <label class="gen-label" for="gen-qtext">Instruction <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;">(optional — shown above the gap text)</span></label>
            <input id="gen-qtext" class="gen-input" bind:value={genQText} placeholder="e.g. Complete the sentence:">
          </div>
        {/if}

        <!-- MULTI SELECT / MULTIPLE CHOICE OPTIONS -->
        {#if genType === 'multi_select' || genType === 'multiple_choice'}
          <div class="gen-field">
            <label class="gen-label" for="gen-options">
              Answer Options
              <span style="color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;">
                — {genType === 'multiple_choice' ? 'click to mark the one correct answer' : 'click checkmarks to mark correct answers'}
              </span>
            </label>
            <div id="gen-options" class="options-list">
              {#each genOptions as opt, i}
                <div class="option-row">
                  <button type="button" class="option-correct" class:marked={opt.correct} onclick={() => genToggleCorrect(i)} aria-label="Mark as correct answer"></button>
                  <input class="option-text" bind:value={opt.text} placeholder="Option {i + 1}">
                  <button type="button" class="option-del" onclick={() => genRemoveOption(i)}>&#215;</button>
                </div>
              {/each}
            </div>
            {#if genOptions.length < 7}
              <button class="add-option-btn" onclick={genAddOption}>+ Add Option</button>
            {/if}
            <p class="options-hint">At least 2 options required. {genType === 'multiple_choice' ? 'Exactly 1 must be correct.' : 'At least 1 must be marked correct.'}</p>
          </div>
        {/if}

        <!-- TRUE FALSE -->
        {#if genType === 'true_false'}
          <div class="gen-field">
            <label class="gen-label">Correct Answer</label>
            <div class="tf-row">
              <button
                type="button"
                class="tf-btn"
                class:marked={genOptions[0]?.correct}
                onclick={() => genOptions = [{ text: 'True', correct: true }, { text: 'False', correct: false }]}
              >True</button>
              <button
                type="button"
                class="tf-btn"
                class:marked={genOptions[1]?.correct}
                onclick={() => genOptions = [{ text: 'True', correct: false }, { text: 'False', correct: true }]}
              >False</button>
            </div>
          </div>
        {/if}

        <!-- TYPED -->
        {#if genType === 'typed'}
          <div class="gen-field">
            <label class="gen-label">Accepted Answers <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;">(pool of valid responses)</span></label>
            <div class="options-list">
              {#each genTypedAnswers as _, i}
                <div class="option-row">
                  <input class="option-text" bind:value={genTypedAnswers[i]} placeholder="Accepted answer {i + 1}">
                  {#if genTypedAnswers.length > 1}
                    <button type="button" class="option-del" onclick={() => genTypedAnswers = genTypedAnswers.filter((_, j) => j !== i)}>&#215;</button>
                  {/if}
                </div>
              {/each}
            </div>
            <button class="add-option-btn" onclick={() => genTypedAnswers = [...genTypedAnswers, '']}>+ Add Accepted Answer</button>
          </div>
          <div class="gen-field">
            <label class="gen-label" for="gen-required">Required Count <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;">(leave blank to require all)</span></label>
            <input id="gen-required" class="gen-input" type="number" min="1" bind:value={genTypedRequired} placeholder="e.g. 3">
          </div>
        {/if}

        <!-- FILL GAP -->
        {#if genType === 'fill_gap'}
          <div class="gen-field">
            <label class="gen-label" for="gen-template">
              Template <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;">— use ___ for each gap</span>
            </label>
            <textarea
              id="gen-template"
              class="gen-textarea"
              bind:value={genTemplate}
              oninput={syncGapsFromTemplate}
              placeholder="e.g. ___ defeated ___ at UFC 229 to win the ___ title."
              style="min-height:72px;"
            ></textarea>
            {#if (genTemplate.match(/___/g) || []).length > 0}
              <p class="options-hint">{(genTemplate.match(/___/g) || []).length} gap(s) detected</p>
            {/if}
          </div>
          {#if genGapAnswers.length > 0}
            <div class="gen-field">
              <label class="gen-label">Gap Answers <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;">(in order)</span></label>
              <div class="options-list">
                {#each genGapAnswers as _, i}
                  <div class="option-row">
                    <span class="gap-num">Gap {i + 1}</span>
                    <input class="option-text" bind:value={genGapAnswers[i]} placeholder="Answer for gap {i + 1}">
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/if}

        <!-- ORDERED -->
        {#if genType === 'ordered'}
          <div class="gen-field">
            <label class="gen-label">Items <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;">(in correct order)</span></label>
            <div class="options-list">
              {#each genOrderedItems as _, i}
                <div class="ordered-row">
                  <span class="gap-num">{i + 1}</span>
                  <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
                    <input class="option-text" bind:value={genOrderedItems[i].value} placeholder="Answer {i + 1}">
                    <input class="option-text" style="font-size:11px;opacity:.6;" bind:value={genOrderedItems[i].description} placeholder="Description (optional) — e.g. Won title in 2011">
                  </div>
                  {#if genOrderedItems.length > 2}
                    <button type="button" class="option-del" onclick={() => genOrderedItems = genOrderedItems.filter((_, j) => j !== i)}>&#215;</button>
                  {/if}
                </div>
              {/each}
            </div>
            <button class="add-option-btn" onclick={() => genOrderedItems = [...genOrderedItems, { value: '', description: '' }]}>+ Add Item</button>
          </div>
        {/if}

        <!-- EXPLANATION -->
        <div class="gen-field">
          <label class="gen-label" for="gen-explanation">Explanation <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;">(optional — shown after reveal)</span></label>
          <input id="gen-explanation" class="gen-input" bind:value={genExplanation} placeholder="Shown after answer reveal">
        </div>

        <button class="gen-add-btn" onclick={genAddQuestion}>Add Question</button>
        {#if genAddErr}<div style="color:#D94040;font-size:12px;margin-top:8px;">{genAddErr}</div>{/if}

      {/if}
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
              <div class="q-type-tag">{q.type || 'multi_select'}</div>
              <div class="q-text">{questionSummary(q)}</div>
              {#if q.options}
                <div class="q-opts">
                  {#each q.options as opt, oi}
                    <span class="q-opt" class:ans={(q.answers || []).includes(oi)}>{opt}</span>
                  {/each}
                </div>
              {/if}
              {#if q.answers && !q.options && (q.type === 'typed' || !q.type)}
                <div class="q-opts">
                  {#each (q.answers || []).slice(0, 4) as ans}
                    <span class="q-opt ans">{ans}</span>
                  {/each}
                  {#if (q.answers || []).length > 4}
                    <span class="q-opt">+{q.answers.length - 4} more</span>
                  {/if}
                </div>
              {/if}
              <div class="q-id">{q.id}</div>

              <!-- INLINE EDIT -->
              {#if editingQ?.tier === activeTier && editingQ?.idx === i}
                <div class="inline-edit">
                  <div class="inline-edit-label">Type</div>
                  <select class="diff-select" bind:value={editType} style="margin-bottom:8px;">
                    {#each QUESTION_TYPES as t}
                      <option value={t.value} disabled={SOON_TYPES.includes(t.value)}>{t.label}</option>
                    {/each}
                  </select>

                  {#if editType !== 'fill_gap'}
                    <div class="inline-edit-label">Question</div>
                    <textarea bind:value={editText} style="min-height:56px;"></textarea>
                  {:else}
                    <div class="inline-edit-label">Instruction (optional)</div>
                    <input bind:value={editText} placeholder="e.g. Complete the sentence:">
                    <div class="inline-edit-label" style="margin-top:8px;">Template</div>
                    <textarea bind:value={editTemplate} style="min-height:56px;" placeholder="Use ___ for gaps"></textarea>
                  {/if}

                  {#if editType === 'multi_select' || editType === 'multiple_choice'}
                    <div class="inline-edit-label" style="margin-top:8px;">Options</div>
                    <div class="inline-edit-opts">
                      {#each editOptions as opt, oi}
                        <div class="option-row">
                          <button type="button" class="option-correct" class:marked={opt.correct}
                            onclick={() => {
                              if (editType === 'multiple_choice') {
                                editOptions = editOptions.map((o,j) => ({...o, correct: j===oi ? !o.correct : false}));
                              } else {
                                editOptions = editOptions.map((o,j) => j===oi ? {...o,correct:!o.correct} : o);
                              }
                            }}
                            aria-label="Mark as correct answer"
                          ></button>
                          <input class="option-text" bind:value={opt.text}>
                        </div>
                      {/each}
                    </div>
                  {/if}

                  {#if editType === 'true_false'}
                    <div class="inline-edit-label" style="margin-top:8px;">Correct Answer</div>
                    <div class="tf-row">
                      <button type="button" class="tf-btn" class:marked={editOptions[0]?.correct}
                        onclick={() => editOptions = [{text:'True',correct:true},{text:'False',correct:false}]}>True</button>
                      <button type="button" class="tf-btn" class:marked={editOptions[1]?.correct}
                        onclick={() => editOptions = [{text:'True',correct:false},{text:'False',correct:true}]}>False</button>
                    </div>
                  {/if}

                  {#if editType === 'typed'}
                    <div class="inline-edit-label" style="margin-top:8px;">Accepted Answers</div>
                    {#each editTypedAnswers as _, ai}
                      <div class="option-row" style="margin-bottom:4px;">
                        <input class="option-text" bind:value={editTypedAnswers[ai]}>
                        <button type="button" class="option-del" onclick={() => editTypedAnswers = editTypedAnswers.filter((_,j)=>j!==ai)}>&#215;</button>
                      </div>
                    {/each}
                    <button class="add-option-btn" onclick={() => editTypedAnswers = [...editTypedAnswers, '']}>+ Add</button>
                  {/if}

                  {#if editType === 'fill_gap'}
                    <div class="inline-edit-label" style="margin-top:8px;">Gap Answers (in order)</div>
                    {#each editGapAnswers as _, gi}
                      <div class="option-row" style="margin-bottom:4px;">
                        <span class="gap-num">Gap {gi+1}</span>
                        <input class="option-text" bind:value={editGapAnswers[gi]}>
                      </div>
                    {/each}
                  {/if}

                  {#if editType === 'ordered'}
                    <div class="inline-edit-label" style="margin-top:8px;">Items (in correct order)</div>
                    {#each editOrderedItems as _, oi}
                      <div class="ordered-row" style="margin-bottom:4px;">
                        <span class="gap-num">{oi+1}</span>
                        <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
                          <input class="option-text" bind:value={editOrderedItems[oi].value} placeholder="Answer">
                          <input class="option-text" style="font-size:11px;opacity:.6;" bind:value={editOrderedItems[oi].description} placeholder="Description (optional)">
                        </div>
                      </div>
                    {/each}
                  {/if}

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

<!-- CONFIRM DIALOG -->
{#if showConfirm}
  <div class="modal-overlay" onclick={confirmNo}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-title">Are you sure?</div>
      <p class="modal-desc">{confirmMessage}</p>
      <div class="modal-actions">
        <button class="btn-confirm" onclick={confirmYes}>Yes, continue</button>
        <button class="btn-cancel" onclick={confirmNo}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
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
  .ordered-row { display: flex; align-items: flex-start; gap: 8px; }
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
  .gap-num { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); flex-shrink: 0; min-width: 44px; padding-top: 8px; }
  .tf-row { display: flex; gap: 8px; }
  .tf-btn { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px; color: var(--muted); padding: 10px 28px; cursor: pointer; transition: all .15s; flex: 1; }
  .tf-btn:hover { color: var(--white); border-color: rgba(255,255,255,0.2); }
  .tf-btn.marked { background: rgba(46,139,87,0.12); border-color: rgba(46,139,87,0.4); color: #4CAF85; }
  .type-soon-notice { background: rgba(107,107,107,0.08); border: 1px solid rgba(107,107,107,0.15); border-radius: 3px; padding: 14px 18px; font-size: 13px; color: var(--muted); margin-top: 12px; line-height: 1.5; }
  .diff-select { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 3px; color: var(--white); font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: .06em; padding: 9px 12px; outline: none; cursor: pointer; width: 100%; transition: border-color .15s; }
  .diff-select:focus { border-color: rgba(232,193,74,0.5); }
  .diff-select option { background: #1A1C1E; }
  .gen-add-btn { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: var(--gold); color: var(--black); border: none; padding: 11px 24px; border-radius: 3px; cursor: pointer; transition: background .15s; width: 100%; margin-top: 4px; }
  .gen-add-btn:hover { background: var(--gold2); }
  .q-list { display: flex; flex-direction: column; gap: 6px; }
  .q-item { background: var(--surface); border: 1px solid rgba(255,255,255,0.04); border-radius: 4px; padding: 16px 18px; display: flex; align-items: flex-start; gap: 14px; }
  .q-item:hover { border-color: rgba(255,255,255,0.1); }
  .q-num { font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: var(--muted); min-width: 28px; text-align: right; margin-top: 2px; }
  .q-body { flex: 1; min-width: 0; }
  .q-type-tag { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
  .q-text { font-size: 14px; color: var(--white); line-height: 1.5; margin-bottom: 6px; }
  .q-opts { display: flex; flex-wrap: wrap; gap: 4px; }
  .q-opt { font-size: 11px; padding: 2px 8px; border-radius: 2px; background: rgba(255,255,255,0.04); color: var(--muted); }
  .q-opt.ans { background: rgba(46,139,87,0.12); color: #4CAF85; }
  .q-id { font-family: monospace; font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 4px; }
  .q-del { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 18px; padding: 2px; line-height: 1; transition: color .15s; flex-shrink: 0; }
  .q-del:hover { color: #D94040; }
  .q-empty { font-size: 13px; color: var(--muted); padding: 32px 0; text-align: center; }
  .q-edit-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 2px 6px; line-height: 1; transition: color .15s; flex-shrink: 0; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .q-edit-btn:hover { color: var(--gold); }
  .q-item-actions { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
  .inline-edit { background: var(--off); border: 1px solid rgba(232,193,74,0.3); border-radius: 4px; padding: 16px; margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
  .inline-edit textarea, .inline-edit input, .inline-edit select { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 3px; color: var(--white); font-family: 'Barlow', sans-serif; font-size: 13px; padding: 7px 10px; outline: none; width: 100%; }
  .inline-edit textarea { resize: vertical; min-height: 56px; }
  .inline-edit-label { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
  .inline-edit-opts { display: flex; flex-direction: column; gap: 6px; }
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
  .gen-save-btn { background: rgba(46,139,87,0.08); border-color: rgba(46,139,87,0.2); color: #4CAF85; }
  .gen-save-btn:hover:not(:disabled) { background: rgba(46,139,87,0.15); border-color: rgba(46,139,87,0.4); }
  .gen-save-btn:disabled { opacity: .4; cursor: not-allowed; }
  .gen-clear-btn:hover { border-color: rgba(217,64,64,0.4); color: #D94040; }

  .gen-status-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .status-pill { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 2px 8px; border-radius: 2px; }
  .status-unsaved { background: rgba(107,107,107,0.12); color: var(--muted); border: 1px solid rgba(107,107,107,0.2); }
  .status-saved { background: rgba(46,139,87,0.12); color: #4CAF85; border: 1px solid rgba(46,139,87,0.25); }
  .status-downloaded { background: rgba(232,193,74,0.1); color: var(--gold); border: 1px solid rgba(232,193,74,0.25); }
  .gen-set-name { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: .04em; color: var(--white); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gen-save-error { background: rgba(217,64,64,0.08); border: 1px solid rgba(217,64,64,0.3); border-radius: 3px; padding: 10px 12px; font-size: 12px; color: #E88A8A; }
  .gen-save-success { background: rgba(46,139,87,0.08); border: 1px solid rgba(46,139,87,0.3); border-radius: 3px; padding: 10px 12px; font-size: 12px; color: #4CAF85; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 500; padding: 24px; }
  .modal { background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; padding: 32px; max-width: 400px; width: 100%; }
  .modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: .04em; color: var(--white); margin-bottom: 10px; }
  .modal-desc { font-size: 14px; color: var(--muted); line-height: 1.6; margin-bottom: 24px; }
  .modal-actions { display: flex; gap: 10px; }
  .btn-confirm { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: var(--gold); color: var(--black); border: none; padding: 10px 20px; border-radius: 3px; cursor: pointer; transition: background .15s; }
  .btn-confirm:hover { background: var(--gold2); }
  .btn-cancel { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: transparent; color: var(--muted); border: 1px solid rgba(255,255,255,0.08); padding: 10px 16px; border-radius: 3px; cursor: pointer; transition: color .15s; }
  .btn-cancel:hover { color: var(--white); }

  @media (max-width: 900px) {
    .gen-wrap { grid-template-columns: 1fr; }
    .gen-sidebar { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); padding: 24px; }
    .gen-main { padding: 24px; }
    .gen-row { grid-template-columns: 1fr; }
  }
</style>
