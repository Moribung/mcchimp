<script>
  import { session } from '$lib/stores/session';
  import { supabase } from '$lib/supabase';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import QuestionSetCard from '$lib/components/QuestionSetCard.svelte';
  import { hasAiAccess, isAiElevated } from '$lib/ai/access';

  // ── ACCESS (dev tier only) + remembered settings ──
  let tier = $state(null);
  let tierLoaded = $state(false);
  let prefsLoaded = $state(false);
  let setLimit = $state(3);
  const elevated = $derived(isAiElevated(tier));
  let lastSaved = null;   // last snapshot written to the DB (avoids redundant writes)
  let saveTimer;
  $effect(() => {
    const s = $session;
    if (!s) { tier = null; tierLoaded = true; prefsLoaded = true; return; }
    tierLoaded = false;
    supabase.from('profiles').select('tier, create_prefs, set_limit').eq('id', s.user.id).single()
      .then(({ data }) => {
        tier = data?.tier ?? null;
        setLimit = data?.set_limit ?? 3;
        const p = data?.create_prefs;
        if (p && typeof p === 'object') {
          if (typeof p.prompt === 'string') prompt = p.prompt;
          if (p.selectedTypes) selectedTypes = { ...DEFAULTS.selectedTypes, ...p.selectedTypes };
          if (p.weights) weights = { ...DEFAULTS.weights, ...p.weights };
          if (p.counts) counts = { ...DEFAULTS.counts, ...p.counts };
          if (typeof p.autoTypes === 'boolean') autoTypes = p.autoTypes;
          if (typeof p.autoCounts === 'boolean') autoCounts = p.autoCounts;
        }
        lastSaved = JSON.stringify({ prompt, selectedTypes, weights, counts, autoTypes, autoCounts });
        tierLoaded = true;
        prefsLoaded = true;
        if (hasAiAccess(tier)) { loadStaged(); fetchUsage(); }
      });
  });

  // ── FORM STATE ──
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

  // Remembered form settings (per browser). The dropped file is not persisted.
  const PREFS_KEY = 'mcchimp_create_prefs';
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
  // Weighted mix (%) — enabled types always sum to 100.
  let selectedTypes = $state({ ...DEFAULTS.selectedTypes, ...(saved?.selectedTypes || {}) });
  let weights = $state({ ...DEFAULTS.weights, ...(saved?.weights || {}) });
  let counts = $state({ ...DEFAULTS.counts, ...(saved?.counts || {}) });
  // "Get from context" — leave types/mix or counts to the AI based on the input.
  let autoTypes = $state(saved?.autoTypes ?? DEFAULTS.autoTypes);
  let autoCounts = $state(saved?.autoCounts ?? DEFAULTS.autoCounts);

  // Persist settings whenever they change: localStorage immediately (instant,
  // offline), the DB debounced (syncs across devices). No save button.
  $effect(() => {
    const snap = JSON.stringify({ prompt, selectedTypes, weights, counts, autoTypes, autoCounts });
    if (!browser) return;
    try { localStorage.setItem(PREFS_KEY, snap); } catch { /* ignore quota/availability */ }
    if (!prefsLoaded || !$session || snap === lastSaved) return;
    lastSaved = snap;
    const id = $session.user.id;
    const payload = { prompt, selectedTypes, weights, counts, autoTypes, autoCounts };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      supabase.from('profiles').update({ create_prefs: payload }).eq('id', id);
    }, 800);
  });

  // file
  let fileName = $state('');
  let fileSize = $state(0);
  let fileText = $state('');     // extracted text (.txt / .md / .docx)
  let pdfBase64 = $state(null);  // base64 (.pdf — Claude reads PDFs natively)
  let fileError = $state('');
  let dragging = $state(false);
  let largeDocument = $state(false);

  // generation
  let generating = $state(false);
  let genError = $state('');
  let genIssues = $state([]);
  let genResult = $state(null);
  let genNote = $state('');
  let usage = $state({ monthly: { used: 0, cap: 30 }, daily: { used: 0, cap: 50 } });
  let account = $state({ input: 0, output: 0, total: 0, generations: 0 });

  function applyUsage(out) {
    if (out?.monthly) usage = { ...usage, monthly: out.monthly };
    if (out?.daily) usage = { ...usage, daily: out.daily };
  }
  async function fetchUsage() {
    if (!$session) return;
    try {
      const res = await fetch('/api/generate', { headers: { Authorization: `Bearer ${$session.access_token}` } });
      if (res.ok) { const u = await res.json(); applyUsage(u); if (u.account) account = u.account; }
    } catch { /* ignore */ }
  }

  const totalCount = $derived(TIERS.reduce((s, t) => s + (Number(counts[t.key]) || 0), 0));
  const anyType = $derived(Object.values(selectedTypes).some(Boolean));
  const enabledCount = $derived(TYPE_VALUES.filter((t) => selectedTypes[t]).length);
  const hasInput = $derived(prompt.trim().length > 0 || fileText.trim().length > 0 || !!pdfBase64);
  const typesOk = $derived(autoTypes || anyType);
  const countsOk = $derived(autoCounts || totalCount > 0);
  const canGenerate = $derived(typesOk && countsOk && hasInput && !generating && !fileError);

  // Rough token estimate for the current input (~4 chars/token; ~120 tokens/question out).
  const estInputTokens = $derived(Math.ceil((prompt.length + fileText.length) / 4));
  const estOutputTokens = $derived(autoCounts ? null : totalCount * 120);
  // Credit cost of this request: prompt 1, document 5, large document 10.
  const hasDocument = $derived(!!pdfBase64 || fileText.trim().length > 0);
  const requestCredits = $derived(hasDocument ? (largeDocument ? 10 : 5) : 1);

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

  // Re-scale enabled weights so they sum to 100 (disabled → 0), preserving proportions.
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
    if (TYPE_VALUES.filter((t) => sel[t]).length === 0) return; // keep at least one enabled
    if (sel[v] && (weights[v] || 0) === 0) {
      // seed a share for a newly enabled type before normalizing
      weights = { ...weights, [v]: Math.round(100 / TYPE_VALUES.filter((t) => sel[t]).length) };
    }
    selectedTypes = sel;
    normalizeWeights();
  }

  // Edit one weight; remaining enabled types absorb the difference proportionally → still sums to 100.
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

  function readAsBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function captureFile(file) {
    if (!file) return;
    fileError = ''; fileText = ''; pdfBase64 = null;
    fileName = file.name; fileSize = file.size;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    try {
      if (ext === 'txt' || ext === 'md') {
        fileText = await file.text();
      } else if (ext === 'docx') {
        const m = await import('mammoth/mammoth.browser');
        const mammoth = m.default || m;
        const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        fileText = value || '';
      } else if (ext === 'pdf') {
        pdfBase64 = await readAsBase64(file);
      } else {
        fileError = 'Unsupported file type — use .txt, .md, .pdf, or .docx.';
      }
    } catch {
      fileError = 'Could not read that file.';
    }
  }
  function onFilePick(e) { captureFile(e.target.files?.[0]); }
  function onDrop(e) { e.preventDefault(); dragging = false; captureFile(e.dataTransfer?.files?.[0]); }
  function clearFile() { fileName = ''; fileSize = 0; fileText = ''; pdfBase64 = null; fileError = ''; largeDocument = false; }

  async function generate() {
    if (!canGenerate) return;
    generating = true; genError = ''; genIssues = []; genResult = null; genNote = '';
    try {
      const types = TYPE_VALUES.filter((t) => selectedTypes[t]);
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${$session?.access_token}` },
        body: JSON.stringify({ mode: 'generate', prompt, text: fileText, pdfBase64, types, weights, counts, autoTypes, autoCounts, largeDocument })
      });
      const out = await res.json().catch(() => ({}));
      applyUsage(out);
      if (!res.ok) genError = out.error || `Generation failed (${res.status}).`;
      else if (!out.ok) { genIssues = out.issues || []; genNote = out.note || ''; }
      else { genResult = out.set; genNote = out.note || ''; loadStaged(); }
    } catch (e) {
      genError = e?.message || 'Network error.';
    } finally {
      generating = false;
      fetchUsage();
    }
  }

  // ── DRAFTS (staged sets) ──
  let staged = $state([]);
  let actionError = $state('');
  let busyId = $state(null);
  let repromptFor = $state(null);
  let repromptComment = $state('');
  let deleteFor = $state(null);

  async function loadStaged() {
    if (!$session) return;
    const { data } = await supabase.from('user_question_sets')
      .select('*').eq('user_id', $session.user.id).eq('staged', true)
      .order('updated_at', { ascending: false });
    staged = data || [];
  }

  function viewInEditor(set) {
    sessionStorage.setItem('mcchimp_gen_load', JSON.stringify({ libraryId: set.id, data: set.data, staged: true }));
    goto('/questions/generator');
  }

  async function addToLibrary(set) {
    actionError = ''; busyId = set.id;
    const { count } = await supabase.from('user_question_sets')
      .select('id', { count: 'exact', head: true }).eq('user_id', $session.user.id).eq('staged', false);
    if ((count ?? 0) >= setLimit) {
      actionError = `Library limit reached (${setLimit}). Remove a set or upgrade before adding more.`;
      busyId = null; return;
    }
    const { error } = await supabase.from('user_question_sets')
      .update({ staged: false }).eq('id', set.id).eq('user_id', $session.user.id);
    if (error) actionError = error.message;
    else staged = staged.filter((s) => s.id !== set.id);
    busyId = null;
  }

  function startReprompt(set) { deleteFor = null; repromptFor = set.id; repromptComment = ''; }

  async function submitReprompt(set) {
    actionError = ''; busyId = set.id;
    try {
      const types = TYPE_VALUES.filter((t) => selectedTypes[t]);
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${$session?.access_token}` },
        body: JSON.stringify({ mode: 'reprompt', setId: set.id, comment: repromptComment, types, weights, counts, autoTypes, autoCounts })
      });
      const out = await res.json().catch(() => ({}));
      applyUsage(out);
      if (!res.ok) actionError = out.error || `Reprompt failed (${res.status}).`;
      else if (!out.ok) actionError = (out.issues || ['Reprompt produced no valid questions.']).join(' ');
      else { staged = staged.map((s) => (s.id === set.id ? out.set : s)); repromptFor = null; repromptComment = ''; }
    } catch (e) {
      actionError = e?.message || 'Network error.';
    } finally {
      busyId = null;
      fetchUsage();
    }
  }

  async function deleteStaged(set) {
    actionError = ''; busyId = set.id;
    const { error } = await supabase.from('user_question_sets')
      .delete().eq('id', set.id).eq('user_id', $session.user.id);
    if (error) actionError = error.message;
    else { staged = staged.filter((s) => s.id !== set.id); deleteFor = null; }
    busyId = null;
  }
</script>

<svelte:head><title>Create with AI — McChimp</title></svelte:head>

{#if !tierLoaded}
  <div class="state-msg">Loading…</div>
{:else if !$session}
  <div class="state-msg">
    <h2>Sign in required</h2>
    <p>You need to be signed in to use the AI generator.</p>
    <a class="state-link" href="/auth/login">Sign in</a>
  </div>
{:else if !hasAiAccess(tier)}
  <div class="state-msg">
    <h2>Not available yet</h2>
    <p>AI question generation isn't available on your account. <a class="state-link" href="/account">Upgrade your plan</a> to unlock it.</p>
  </div>
{:else}
  <div class="create-wrap">
    <div class="create-intro">
      <div class="gen-section-label">AI Generator</div>
      <h2 class="create-title">Generate a Question Set</h2>
      <p class="create-sub">Describe a topic or drop in source material. Pick the question types and how many you want per difficulty tier.</p>
      <div class="usage-line">Monthly credits: <strong>{usage.monthly.used}</strong> / {usage.monthly.cap} <span class="hint">· prompt = 1, document = 5, large document = 10</span></div>
      {#if elevated}
        <div class="usage-line">Platform today: <strong>{usage.daily.used}</strong> / {usage.daily.cap} credits</div>
        <div class="usage-line">Tokens (this account): <strong>{account.total.toLocaleString()}</strong> <span class="hint">· {account.input.toLocaleString()} in · {account.output.toLocaleString()} out · {account.generations} gen{account.generations === 1 ? '' : 's'}</span></div>
      {/if}
    </div>

    <div class="gen-form">
      <div class="gen-field">
        <label class="gen-label" for="ai-prompt">Prompt</label>
        <textarea id="ai-prompt" class="gen-textarea" bind:value={prompt}
          placeholder="e.g. The causes and key events of the French Revolution, suitable for high-school students" style="min-height:90px;"></textarea>
      </div>

      <div class="gen-field">
        <span class="gen-label">Source file <span class="hint">(optional — .txt, .md, .pdf, .docx)</span></span>
        {#if fileName}
          <div class="file-chip">
            <span class="file-chip-name">{fileName}</span>
            <span class="file-chip-size">{(fileSize / 1024).toFixed(0)} KB</span>
            <button type="button" class="file-chip-del" onclick={clearFile} aria-label="Remove file">×</button>
          </div>
        {:else}
          <label class="dropzone" class:dragging
            ondragover={(e) => { e.preventDefault(); dragging = true; }}
            ondragleave={() => dragging = false}
            ondrop={onDrop}>
            <span class="dropzone-text">Drop a file here, or <span class="dropzone-link">browse</span></span>
            <input type="file" accept=".txt,.md,.pdf,.docx" onchange={onFilePick} style="display:none;">
          </label>
        {/if}
        {#if fileName}
          <label class="large-doc">
            <input type="checkbox" bind:checked={largeDocument}>
            Large document <span class="hint">— allows a bigger file; costs 10 credits instead of 5</span>
          </label>
        {/if}
      </div>

      <div class="gen-field">
        <div class="field-head">
          <span class="gen-label">Question types &amp; mix <span class="hint">(at least one — weights total 100%)</span></span>
          <button type="button" class="ctx-toggle" class:on={autoTypes} onclick={() => autoTypes = !autoTypes}>{autoTypes ? '✓ ' : ''}Get from context</button>
        </div>
        {#if autoTypes}
          <div class="ctx-note">The AI will choose the question types and mix from your prompt and file.</div>
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
          <button type="button" class="ctx-toggle" class:on={autoCounts} onclick={() => autoCounts = !autoCounts}>{autoCounts ? '✓ ' : ''}Get from context</button>
        </div>
        {#if autoCounts}
          <div class="ctx-note">The AI will decide how many questions per difficulty tier from your input.</div>
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

      {#if fileError}<div class="gen-error">{fileError}</div>{/if}
      {#if genError}<div class="gen-error">{genError}</div>{/if}
      {#if genIssues.length}
        <div class="gen-error">
          <strong>The generated set didn't validate:</strong>
          <ul>{#each genIssues as i}<li>{i}</li>{/each}</ul>
        </div>
      {/if}
      {#if genResult}
        <div class="gen-success">
          Generated “{genResult.name}” — {genResult.question_count} question{genResult.question_count === 1 ? '' : 's'}, saved as a draft.
          {#if genNote}<div class="gen-note-line">Note: {genNote}</div>{/if}
        </div>
      {:else if genNote}
        <div class="gen-note-line">Note: {genNote}</div>
      {/if}

      {#if hasInput}
        <div class="est-line">
          This request: <strong>{requestCredits}</strong> credit{requestCredits === 1 ? '' : 's'}
          {#if elevated} · est. ~{estInputTokens.toLocaleString()} input{#if pdfBase64} + document{/if} · ~{estOutputTokens == null ? '?' : estOutputTokens.toLocaleString()} output tokens (rough){/if}
        </div>
      {/if}
      <button class="gen-add-btn" onclick={generate} disabled={!canGenerate}>
        {#if generating}<span class="spinner"></span>Generating…{:else}Generate{/if}
      </button>
      {#if generating}
        <div class="gen-working"><span class="spinner spinner-muted"></span>Working on your set — this can take up to a couple of minutes. Keep this tab open.</div>
      {/if}
      {#if !generating && !canGenerate}
        <div class="gen-disabled-hint">
          {#if !hasInput}Add a prompt or a file to begin.{:else if !typesOk}Select at least one question type (or use "Get from context").{:else if !countsOk}Set at least one tier above zero (or use "Get from context").{/if}
        </div>
      {/if}
    </div>

    {#snippet cardActions(set)}
      <div class="card-btn-row">
        <button class="card-btn" onclick={() => viewInEditor(set)}>View in editor</button>
        <button class="card-btn card-add" onclick={() => addToLibrary(set)} disabled={busyId === set.id}>Add to library</button>
        <button class="card-btn" onclick={() => startReprompt(set)} disabled={busyId === set.id}>Reprompt</button>
        <button class="card-btn card-del-btn" onclick={() => { deleteFor = set.id; repromptFor = null; }} disabled={busyId === set.id}>Delete</button>
      </div>
      {#if repromptFor === set.id}
        <div class="card-sub">
          <textarea class="gen-textarea" bind:value={repromptComment} placeholder="What should change? (e.g. make them harder, focus on key dates)" style="min-height:60px;"></textarea>
          <div class="card-btn-row">
            <button class="card-btn card-add" onclick={() => submitReprompt(set)} disabled={busyId === set.id}>{#if busyId === set.id}<span class="spinner"></span>Reprompting…{:else}Submit reprompt{/if}</button>
            <button class="card-btn" onclick={() => { repromptFor = null; repromptComment = ''; }}>Cancel</button>
          </div>
        </div>
      {/if}
      {#if deleteFor === set.id}
        <div class="card-sub">
          <span class="card-confirm-text">Delete this draft? This can't be undone.</span>
          <div class="card-btn-row">
            <button class="card-btn card-del-btn" onclick={() => deleteStaged(set)} disabled={busyId === set.id}>Yes, delete</button>
            <button class="card-btn" onclick={() => deleteFor = null}>Cancel</button>
          </div>
        </div>
      {/if}
    {/snippet}

    {#if staged.length}
      <div class="drafts">
        <div class="gen-section-label">Drafts ({staged.length})</div>
        <p class="drafts-hint">Saved automatically. They stay here until you add them to your library.</p>
        {#if actionError}<div class="gen-error">{actionError}</div>{/if}
        <div class="drafts-grid">
          {#each staged as set (set.id)}
            <QuestionSetCard {set} actions={cardActions} />
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .state-msg { max-width: 520px; margin: 0 auto; padding: 80px 24px; text-align: center; }
  .state-msg h2 { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: .03em; color: var(--white); margin-bottom: 12px; }
  .state-msg p { font-size: 14px; color: var(--muted); line-height: 1.6; }
  .state-link { display: inline-block; margin-top: 18px; font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: var(--gold); color: var(--black); padding: 10px 22px; border-radius: 3px; text-decoration: none; }

  .create-wrap { max-width: 720px; margin: 0 auto; padding: 40px 40px 80px; }
  .create-intro { margin-bottom: 24px; }
  .gen-section-label { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--gold); margin-bottom: 10px; }
  .create-title { font-family: 'Bebas Neue', sans-serif; font-size: 34px; letter-spacing: .03em; color: var(--white); margin-bottom: 8px; }
  .create-sub { font-size: 14px; color: var(--muted); line-height: 1.6; max-width: 560px; }
  .usage-line { margin-top: 8px; font-size: 12px; color: var(--muted); }
  .usage-line strong { color: var(--white); }
  .est-line { font-size: 11px; color: var(--muted); text-align: center; margin-bottom: 10px; }
  .est-line strong { color: var(--white); }
  .large-doc { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); margin-top: 10px; cursor: pointer; }
  .large-doc input { accent-color: var(--gold); cursor: pointer; }

  .gen-form { background: var(--surface); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 24px; }
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

  .dropzone { display: flex; align-items: center; justify-content: center; padding: 22px; border: 1px dashed rgba(255,255,255,0.14); border-radius: 4px; cursor: pointer; transition: all .15s; }
  .dropzone:hover, .dropzone.dragging { border-color: rgba(232,193,74,0.5); background: rgba(232,193,74,0.04); }
  .dropzone-text { font-size: 13px; color: var(--muted); }
  .dropzone-link { color: var(--gold); }
  .file-chip { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px; }
  .file-chip-name { font-size: 13px; color: var(--white); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-chip-size { font-size: 11px; color: var(--muted); }
  .file-chip-del { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 18px; line-height: 1; padding: 0 2px; }
  .file-chip-del:hover { color: #D94040; }

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

  .gen-add-btn { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: var(--gold); color: var(--black); border: none; padding: 12px 24px; border-radius: 3px; cursor: pointer; transition: background .15s; width: 100%; }
  .gen-add-btn:hover:not(:disabled) { background: var(--gold2); }
  .gen-add-btn:disabled { opacity: .4; cursor: not-allowed; }
  .gen-disabled-hint { font-size: 11px; color: var(--muted); text-align: center; margin-top: 8px; }
  .spinner {
    display: inline-block; width: 12px; height: 12px; margin-right: 7px; vertical-align: -2px;
    border: 2px solid rgba(0,0,0,0.25); border-top-color: rgba(0,0,0,0.85);
    border-radius: 50%; animation: spin .7s linear infinite;
  }
  .spinner-muted { border-color: rgba(255,255,255,0.2); border-top-color: var(--gold); }
  @keyframes spin { to { transform: rotate(360deg); } }
  .gen-working { display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--muted); margin-top: 10px; text-align: center; }
  .gen-error { background: rgba(217,64,64,0.08); border: 1px solid rgba(217,64,64,0.3); border-radius: 3px; padding: 10px 12px; font-size: 12px; color: #E88A8A; margin-bottom: 16px; line-height: 1.5; }
  .gen-error ul { list-style: none; margin-top: 6px; display: flex; flex-direction: column; gap: 3px; }
  .gen-error li::before { content: '— '; }
  .gen-success { background: rgba(46,139,87,0.08); border: 1px solid rgba(46,139,87,0.3); border-radius: 3px; padding: 10px 12px; font-size: 13px; color: #4CAF85; margin-bottom: 16px; line-height: 1.5; }
  .gen-note-line { font-size: 12px; color: var(--muted); margin-top: 6px; }

  .drafts { margin-top: 40px; }
  .drafts-hint { font-size: 12px; color: var(--muted); margin: -4px 0 16px; }
  .drafts-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
  .card-btn-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .card-btn {
    font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase;
    background: transparent; color: var(--muted); border: 1px solid rgba(255,255,255,0.08);
    padding: 8px 14px; border-radius: 2px; cursor: pointer; transition: all .15s;
  }
  .card-btn:hover:not(:disabled) { color: var(--white); border-color: rgba(255,255,255,0.3); }
  .card-btn:disabled { opacity: .45; cursor: not-allowed; }
  .card-add { background: var(--gold); color: var(--black); border-color: var(--gold); }
  .card-add:hover:not(:disabled) { background: var(--gold2); border-color: var(--gold2); color: var(--black); }
  .card-del-btn:hover:not(:disabled) { color: #D94040; border-color: rgba(217,64,64,0.4); }
  .card-sub { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid rgba(255,255,255,0.06); border-radius: 3px; background: rgba(255,255,255,0.02); }
  .card-confirm-text { font-size: 13px; color: var(--muted); }

  @media (max-width: 700px) {
    .create-wrap { padding: 28px 20px 64px; }
    .count-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
