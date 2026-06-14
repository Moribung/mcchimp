<!-- src/lib/racing/screens/QuestionCard.svelte -->
<!-- Renders one question (all supported types) and emits the scored answer.
     timerMs > 0 adds a countdown that auto-submits on expiry (used in the pit). -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { scoreQuestion, scoreTypedInputs, scoreFillGapInputs } from '$lib/racing/questions.js';
  import { DIFF_LABELS, DIFF_COLORS } from '$lib/racing/constants.js';
  import { isAdvanceKey } from '$lib/uiKeys.js';

  const {
    q,
    tier         = null,
    timerMs      = 0,
    submitLabel  = 'Lock In',
    accent       = 'var(--accent)',
    onanswer,
  } = $props();

  const qtype = $derived(q?.type || 'multi_select');
  const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  let selected    = $state([]);    // option indices
  let typedInputs = $state([]);
  let gapInputs   = $state([]);
  let submitted   = $state(false);
  let startTime   = 0;

  // (Re)initialise when the question changes.
  $effect(() => {
    if (!q) return;
    q.id; // track identity
    selected = [];
    submitted = false;
    startTime = Date.now();
    if (qtype === 'typed') {
      const count = q.required_count ?? (q.answers?.length ?? 1);
      typedInputs = Array(count).fill('');
    }
    if (qtype === 'fill_gap') {
      const count = (q.template?.match(/___/g) || []).length;
      gapInputs = Array(count).fill('');
    }
  });

  const gapParts = $derived(qtype === 'fill_gap' && q?.template ? q.template.split('___') : []);

  const hint = $derived((() => {
    if (!q) return '';
    switch (qtype) {
      case 'true_false':      return 'True or False?';
      case 'multiple_choice': return 'Select one answer.';
      case 'typed':           return `Name ${q.required_count ?? q.answers?.length ?? 1} answer${(q.required_count ?? 1) > 1 ? 's' : ''}.`;
      case 'fill_gap':        return 'Fill in the blanks.';
      default:                return q.answers?.length === 1 ? 'Select one answer.' : 'Select all that apply.';
    }
  })());

  function toggleOption(idx) {
    if (submitted) return;
    if (qtype === 'multiple_choice' || qtype === 'true_false') {
      selected = [idx];
    } else {
      selected = selected.includes(idx) ? selected.filter(i => i !== idx) : [...selected, idx];
    }
  }

  const canSubmit = $derived((() => {
    if (submitted) return false;
    if (qtype === 'typed')    return typedInputs.some(v => v.trim());
    if (qtype === 'fill_gap') return gapInputs.some(v => v.trim());
    return selected.length > 0;
  })());

  function submit(force = false) {
    if (submitted) return;
    if (!force && !canSubmit) return;
    submitted = true;
    stopTimer();

    let selectedSet;
    if (qtype === 'typed')      selectedSet = scoreTypedInputs(q, typedInputs);
    else if (qtype === 'fill_gap') selectedSet = scoreFillGapInputs(q, gapInputs);
    else                        selectedSet = new Set(selected);

    const { score, maxPts, ratio } = scoreQuestion(q, selectedSet);
    const answerMs = Date.now() - startTime;
    onanswer?.({ ratio, correct: ratio >= 1, score, maxPts, answerMs });
  }

  // ── Timer (optional) ──────────────────────────────────
  let timeLeft = $state(0);
  let handle   = null;
  const timerPct   = $derived(timerMs > 0 ? timeLeft / timerMs : 1);
  const timerColor = $derived(timerPct < 0.3 ? 'var(--red)' : timerPct < 0.6 ? '#e8944a' : accent);

  function startTimer() {
    if (timerMs <= 0) return;
    const start = Date.now();
    handle = setInterval(() => {
      timeLeft = Math.max(0, timerMs - (Date.now() - start));
      if (timeLeft <= 0) { stopTimer(); submit(true); }
    }, 60);
  }
  function stopTimer() { if (handle) { clearInterval(handle); handle = null; } }

  onMount(() => { startTime = Date.now(); timeLeft = timerMs; startTimer(); });
  onDestroy(stopTimer);

  function onKeydown(e) {
    if (!isAdvanceKey(e)) return;
    if (document.activeElement) document.activeElement.blur();
    if (!submitted) submit();
    e.preventDefault();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if q}
  {#if tier}
    <p class="q-diff" style="color:{DIFF_COLORS[tier]}">{DIFF_LABELS[tier]} question</p>
  {/if}

  <p class="q-text">{q.question || ''}</p>
  <p class="q-hint">{hint}</p>

  {#if timerMs > 0}
    <div class="timer-wrap">
      <div class="timer-bg">
        <div class="timer-bar" style="width:{timerPct * 100}%;background:{timerColor};transition:width .06s linear,background .3s"></div>
      </div>
      <div class="timer-label">{(timeLeft / 1000).toFixed(1)}s</div>
    </div>
  {/if}

  {#if qtype === 'multi_select' || qtype === 'multiple_choice' || qtype === 'true_false'}
    <div class="options" class:options-tf={qtype === 'true_false'}>
      {#each q.options as opt, idx}
        <button class="option-btn" class:selected={selected.includes(idx)} class:tf-btn={qtype === 'true_false'}
          disabled={submitted} onclick={() => toggleOption(idx)}>
          {#if qtype !== 'true_false'}<span class="opt-label">{LABELS[idx]}</span>{/if}
          <span class="opt-text">{opt}</span>
        </button>
      {/each}
    </div>

  {:else if qtype === 'typed'}
    <div class="typed-inputs">
      {#each typedInputs as _, i}
        <div class="typed-row">
          <span class="typed-num">{i + 1}</span>
          <input class="typed-field" type="text" placeholder="Your answer…" disabled={submitted}
            bind:value={typedInputs[i]}
            onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); submit(); } }} />
        </div>
      {/each}
    </div>

  {:else if qtype === 'fill_gap'}
    <div class="fill-gap">
      <div class="fill-gap-sentence">
        {#each gapParts as part, i}
          <span class="gap-text">{part}</span>
          {#if i < gapParts.length - 1}
            <span class="gap-input-wrap">
              <input class="gap-field" type="text" placeholder="___" disabled={submitted}
                bind:value={gapInputs[i]}
                onkeydown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }} />
            </span>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <div class="submit-bar">
    <button class="btn btn-primary" style="--btn:{accent}" disabled={!canSubmit} onclick={() => submit()}>{submitLabel}</button>
  </div>
{/if}

<style>
  .q-diff { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; font-weight: 600; margin-bottom: 6px; }
  .q-text { font-size: 18px; font-weight: 500; line-height: 1.5; margin-bottom: 6px; }
  .q-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 18px; font-style: italic; }

  .timer-wrap  { margin-bottom: 20px; }
  .timer-bg    { height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; margin-bottom: 6px; }
  .timer-bar   { height: 100%; border-radius: 3px; }
  .timer-label { font-family: var(--font-display); font-size: 16px; color: var(--text-muted); letter-spacing: .04em; }

  .options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
  .options-tf { flex-direction: row; gap: 12px; }
  .option-btn {
    background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
    color: var(--text); font-family: var(--font-body); font-size: 14px; font-weight: 500;
    padding: 13px 16px; text-align: left; cursor: pointer; transition: border-color .12s, background .12s;
    display: flex; align-items: center; gap: 12px; line-height: 1.4; width: 100%;
  }
  .option-btn:hover:not(:disabled) { border-color: var(--border-hover); background: rgba(255,255,255,0.04); }
  .option-btn:disabled { cursor: default; opacity: .8; }
  .option-btn.selected { border-color: var(--accent); background: var(--accent-dim); }
  .opt-label { font-family: var(--font-display); font-size: 13px; color: var(--text-muted); min-width: 18px; flex-shrink: 0; }
  .option-btn.selected .opt-label { color: var(--accent); }
  .opt-text { flex: 1; }
  .tf-btn { flex: 1; justify-content: center; font-size: 20px; padding: 22px 16px; font-family: var(--font-display); letter-spacing: .06em; }

  .typed-inputs { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
  .typed-row { display: flex; align-items: center; gap: 10px; }
  .typed-num { font-family: var(--font-display); font-size: 16px; color: var(--text-muted); min-width: 20px; text-align: right; }
  .typed-field {
    flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
    color: var(--text); font-family: var(--font-body); font-size: 15px; padding: 11px 14px; outline: none; transition: border-color .15s;
  }
  .typed-field:focus { border-color: var(--accent); }
  .typed-field:disabled { opacity: .7; }

  .fill-gap { margin-bottom: 20px; }
  .fill-gap-sentence { font-size: 18px; line-height: 2.2; font-weight: 500; }
  .gap-text { vertical-align: middle; }
  .gap-input-wrap { display: inline-block; vertical-align: middle; margin: 0 4px; }
  .gap-field {
    background: var(--surface2); border: none; border-bottom: 2px solid var(--accent);
    color: var(--text); font-family: var(--font-body); font-size: 17px; font-weight: 600;
    padding: 4px 8px; outline: none; width: 140px; text-align: center;
  }
  .gap-field:focus { background: var(--accent-dim); }

  .submit-bar { display: flex; justify-content: flex-end; }
  .btn { display: inline-flex; align-items: center; justify-content: center; padding: 11px 26px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; }
  .btn:hover { opacity: .85; }
  .btn:disabled { opacity: .35; cursor: not-allowed; }
  .btn-primary { background: var(--btn, var(--accent)); color: #0a0a0c; }

  @media (max-width: 768px) {
    .options-tf { flex-direction: column; }
    .gap-field { width: 100px; font-size: 15px; }
  }
</style>
