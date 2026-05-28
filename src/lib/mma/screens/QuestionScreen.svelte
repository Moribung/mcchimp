<!-- src/lib/mma/screens/QuestionScreen.svelte -->
<!-- Timer lives here. Renders all supported question types. -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { state as gs }  from '$lib/mma/state.svelte.js';
  import { resolveResult } from '$lib/mma/combat.js';
  import { scoreQuestion } from '$lib/mma/questions.js';
  import { DIFF_LABELS, DIFF_COLORS } from '$lib/mma/constants.js';

  const { onsave } = $props();

  const q        = $derived(gs.currentQuestion);
  const qtype    = $derived(q?.type || 'multi_select');
  const selected = $derived(new Set(gs.selectedOptions));

  // ── Score meter (sparring) ────────────────────────────
  const meterData = $derived((() => {
    if (!q || selected.size === 0) return { pct: 0, color: 'rgba(255,255,255,0.1)', hint: 'Select answers' };
    const { ratio } = scoreQuestion(q, selected);
    const pct = Math.round(ratio * 100);
    if (ratio === 1)  return { pct, color: 'var(--green)', hint: 'Win' };
    if (ratio >= 0.5) return { pct, color: 'var(--amber)', hint: 'Draw' };
    if (ratio > 0)    return { pct, color: 'var(--red)',   hint: 'Loss' };
    return             { pct: 0, color: '#a0001a',          hint: 'Finish' };
  })());

  // ── Timer ─────────────────────────────────────────────
  const timerPct   = $derived(gs.effectiveTimer > 0 ? gs.timeLeft / gs.effectiveTimer : 1);
  const timerColor = $derived(timerPct < 0.3 ? 'var(--red)' : timerPct < 0.6 ? '#e8944a' : 'var(--accent)');

  const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  // ── Reveal state ──────────────────────────────────────
  let revealed = $state(false);

  // ── typed / fill_gap state ────────────────────────────
  let typedInputs  = $state([]);  // array of strings, one per required_count
  let gapInputs    = $state([]);  // array of strings, one per ___ in template

  // Initialise inputs when question changes
  $effect(() => {
    if (!q) return;
    if (qtype === 'typed') {
      const count = q.required_count ?? (q.answers?.length ?? 1);
      typedInputs = Array(count).fill('');
    }
    if (qtype === 'fill_gap') {
      const count = (q.template?.match(/___/g) || []).length;
      gapInputs = Array(count).fill('');
    }
  });

  // ── Option state after reveal ─────────────────────────
  function getOptionState(idx) {
    if (!revealed || !q) return 'default';
    const correctSet = new Set(q.answers);
    const sel = selected.has(idx);
    const cor = correctSet.has(idx);
    if (sel && cor)  return 'correct';
    if (sel && !cor) return 'wrong';
    if (!sel && cor) return 'missed';
    return 'default';
  }

  // ── Hint text per type ────────────────────────────────
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

  // ── Toggle / select helpers ───────────────────────────
  function toggleOption(idx) {
    if (revealed) return;
    if (qtype === 'multiple_choice' || qtype === 'true_false') {
      // Radio: replace selection
      gs.selectedOptions = [idx];
    } else {
      // Checkbox: toggle
      const next = [...selected];
      gs.selectedOptions = selected.has(idx)
        ? next.filter(i => i !== idx)
        : [...next, idx];
    }
  }

  // ── Typed / fill_gap scoring ──────────────────────────
  function buildTypedSelected() {
    // Returns a synthetic "selected" Set where each matched answer is an index
    const pool    = (q.answers || []).map(a => String(a).toLowerCase().trim());
    const inputs  = qtype === 'typed' ? typedInputs : gapInputs;
    const matched = new Set();
    if (qtype === 'fill_gap') {
      // Positional: each input must match the answer at that position
      inputs.forEach((val, i) => {
        const expected = String(pool[i] || '').toLowerCase().trim();
        const given    = val.toLowerCase().trim();
        if (expected && given === expected) matched.add(i);
      });
    } else {
      // Pool: each input must match any unmatched answer
      const remaining = [...pool];
      inputs.forEach(val => {
        const given = val.toLowerCase().trim();
        if (!given) return;
        const idx = remaining.indexOf(given);
        if (idx !== -1) {
          matched.add(pool.indexOf(remaining[idx]));
          remaining.splice(idx, 1);
        }
      });
    }
    return matched;
  }

  // ── Check if can submit ───────────────────────────────
  const canSubmit = $derived((() => {
    if (revealed) return false;
    if (qtype === 'typed')    return typedInputs.some(v => v.trim());
    if (qtype === 'fill_gap') return gapInputs.some(v => v.trim());
    return selected.size > 0;
  })());

  // ── Submit ────────────────────────────────────────────
  function submit() {
    if (revealed || !canSubmit) return;
    stopTimer();
    doResolve();
  }

  function doResolve() {
    if (!q) return;
    const T       = gs.effectiveTimer || 45;
    const pctUsed = 1 - gs.timeLeft / T;
    // Build the selection set
    let sel;
    if (qtype === 'typed' || qtype === 'fill_gap') {
      sel = buildTypedSelected();
      // Write back to gs.selectedOptions as array for scoring
      gs.selectedOptions = [...sel];
    } else {
      sel = selected;
    }
    revealed = true;
    setTimeout(() => {
      const activeLength = gs.career?.activeLength ?? 0;
      const { resultClass, rolled, score, maxPts, ratio, isLast, event } =
        resolveResult(gs, gs.career, q, sel, pctUsed, activeLength);
      gs.fightResult = { resultClass, rolled, score, maxPts, ratio, isLast, event, q };
      onsave?.();
      gs.screen = 'result';
    }, 450);
  }

  // ── Timer ─────────────────────────────────────────────
  let timerHandle = null;

  function startTimer() {
    const T         = gs.effectiveTimer || 45;
    const startTime = Date.now();
    timerHandle = setInterval(() => {
      const elapsed   = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, T - elapsed);
      gs.timeLeft     = remaining;
      if (remaining <= 0) {
        stopTimer();
        if (!revealed) doResolve();
      }
    }, 80);
  }

  function stopTimer() {
    clearInterval(timerHandle);
    timerHandle = null;
    gs.timerRunning = false;
  }

  onMount(() => {
    revealed = false;
    gs.timerRunning = true;
    startTimer();
  });

  onDestroy(() => clearInterval(timerHandle));

  // ── Enter key ─────────────────────────────────────────
  function onKeydown(e) {
    if (e.key !== 'Enter') return;
    // Don't intercept Enter inside text inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (document.activeElement) document.activeElement.blur();
    if (!revealed) submit();
    e.preventDefault();
  }

  // ── fill_gap: split template into parts ──────────────
  const gapParts = $derived(
    qtype === 'fill_gap' && q?.template
      ? q.template.split('___')
      : []
  );

  // ── Typed reveal: which inputs were correct ───────────
  const typedCorrect = $derived(
    revealed && (qtype === 'typed' || qtype === 'fill_gap')
      ? buildTypedSelected()
      : new Set()
  );
</script>

<svelte:window onkeydown={onKeydown} />

{#if q}
  <!-- Header -->
  <div class="question-header">
    <p class="question-meta">
      Fight {gs.fightIndex + 1}
      {#if gs.career?.activeLength > 0} of {gs.career.activeLength}{/if}
    </p>
    <p class="question-diff" style="color:{DIFF_COLORS[q._tier]}">
      {DIFF_LABELS[q._tier]} question
    </p>
  </div>

  <!-- Question text -->
  <p class="question-text">{q.question || ''}</p>
  <p class="question-hint">{hint}</p>

  <!-- Timer -->
  <div class="timer-wrap">
    <div class="timer-bar-bg">
      <div class="timer-bar"
        style="width:{timerPct * 100}%;background:{timerColor};transition:width 0.1s linear,background 0.3s">
      </div>
    </div>
    <div class="timer-label">{Math.ceil(gs.timeLeft)}s</div>
  </div>

  <!-- Score meter (sparring) -->
  {#if gs.sparring && (qtype === 'multi_select' || qtype === 'multiple_choice' || qtype === 'true_false')}
    <div class="score-meter">
      <div class="meter-track">
        <div class="meter-fill"
          style="width:{meterData.pct}%;background:{meterData.color};transition:width 0.2s,background 0.2s">
        </div>
      </div>
      <div class="meter-label" style="color:{meterData.color}">
        {selected.size === 0 ? '–' : meterData.pct + '%'}
      </div>
      <div class="meter-hint">{meterData.hint}</div>
    </div>
  {/if}

  <!-- ══ TYPE RENDERERS ══════════════════════════════════ -->

  <!-- multi_select / multiple_choice / true_false -->
  {#if qtype === 'multi_select' || qtype === 'multiple_choice' || qtype === 'true_false'}
    <div class="options" class:options-tf={qtype === 'true_false'}>
      {#each q.options as opt, idx}
        {@const st = getOptionState(idx)}
        <button
          class="option-btn"
          class:selected={selected.has(idx) && !revealed}
          class:reveal-correct={st === 'correct'}
          class:reveal-wrong={st === 'wrong'}
          class:reveal-missed={st === 'missed'}
          class:tf-btn={qtype === 'true_false'}
          disabled={revealed}
          onclick={() => toggleOption(idx)}
        >
          {#if qtype !== 'true_false'}
            <span class="opt-label">{LABELS[idx]}</span>
          {/if}
          <span class="opt-text">{opt}</span>
          {#if qtype !== 'true_false'}
            <span class="opt-check">
              {#if selected.has(idx) && !revealed}✓{/if}
            </span>
          {/if}
        </button>
      {/each}
    </div>

  <!-- typed -->
  {:else if qtype === 'typed'}
    <div class="typed-inputs">
      {#each typedInputs as _, i}
        <div class="typed-row"
          class:typed-correct={revealed && typedCorrect.has(i)}
          class:typed-wrong={revealed && !typedCorrect.has(i) && typedInputs[i].trim() !== ''}>
          <span class="typed-num">{i + 1}</span>
          <input
            class="typed-field"
            type="text"
            placeholder="Your answer…"
            disabled={revealed}
            bind:value={typedInputs[i]}
            onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); if (i < typedInputs.length - 1) e.target.closest('.typed-inputs').querySelectorAll('.typed-field')[i + 1]?.focus(); else submit(); } }}
          />
          {#if revealed}
            <span class="typed-icon">{typedCorrect.has(i) ? '✓' : '✗'}</span>
          {/if}
        </div>
      {/each}
      {#if revealed}
        <div class="typed-accepted">
          <span class="typed-accepted-label">Accepted answers:</span>
          {(q.answers || []).join(', ')}
        </div>
      {/if}
    </div>

  <!-- fill_gap -->
  {:else if qtype === 'fill_gap'}
    <div class="fill-gap-wrap">
      <div class="fill-gap-sentence">
        {#each gapParts as part, i}
          <span class="gap-text">{part}</span>
          {#if i < gapParts.length - 1}
            <span class="gap-input-wrap"
              class:gap-correct={revealed && gapInputs[i] && typedCorrect.has(i)}
              class:gap-wrong={revealed && gapInputs[i] && !typedCorrect.has(i)}
              class:gap-missed={revealed && !gapInputs[i]}>
              <input
                class="gap-field"
                type="text"
                placeholder="___"
                disabled={revealed}
                bind:value={gapInputs[i]}
                onkeydown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
              />
            </span>
          {/if}
        {/each}
      </div>
      {#if revealed}
        <div class="typed-accepted">
          <span class="typed-accepted-label">Answers:</span>
          {(q.answers || []).join(' · ')}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Explanation (after reveal) -->
  {#if revealed && q.explanation}
    <div class="explanation">{q.explanation}</div>
  {/if}

  <!-- Submit bar -->
  <div class="submit-bar">
    <span class="selected-count">
      {#if !revealed}
        {#if qtype === 'typed'}
          {typedInputs.filter(v => v.trim()).length} / {typedInputs.length} filled
        {:else if qtype === 'fill_gap'}
          {gapInputs.filter(v => v.trim()).length} / {gapInputs.length} filled
        {:else if selected.size > 0}
          {selected.size} selected
        {/if}
      {/if}
    </span>
    <button
      class="btn btn-primary"
      disabled={revealed || !canSubmit}
      onclick={submit}
    >Lock In</button>
  </div>
{/if}

<style>
  .question-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 12px; margin-bottom: 6px;
  }
  .question-meta { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
  .question-diff { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; }
  .question-text { font-size: 18px; font-weight: 500; line-height: 1.5; margin-bottom: 6px; }
  .question-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 20px; font-style: italic; }

  .timer-wrap   { margin-bottom: 24px; }
  .timer-bar-bg { height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; margin-bottom: 6px; }
  .timer-bar    { height: 100%; border-radius: 2px; }
  .timer-label  { font-family: var(--font-display); font-size: 15px; color: var(--text-muted); letter-spacing: 0.04em; }

  .score-meter { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding: 12px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); }
  .meter-track { flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
  .meter-fill  { height: 100%; border-radius: 3px; }
  .meter-label { font-family: var(--font-display); font-size: 18px; letter-spacing: 0.04em; min-width: 44px; text-align: right; }
  .meter-hint  { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; min-width: 70px; text-align: right; }

  /* Options: multi_select / multiple_choice */
  .options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
  .options-tf { flex-direction: row; gap: 12px; }

  .option-btn {
    background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
    color: var(--text); font-family: var(--font-body); font-size: 14px; font-weight: 500;
    padding: 13px 16px; text-align: left; cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
    display: flex; align-items: center; gap: 12px; line-height: 1.4; width: 100%;
  }
  .option-btn:hover:not(:disabled):not(.reveal-correct):not(.reveal-wrong):not(.reveal-missed) {
    border-color: var(--border-hover); background: rgba(255,255,255,0.04);
  }
  .option-btn:disabled { cursor: default; }
  .option-btn.selected        { border-color: var(--accent); background: var(--accent-dim); }
  .option-btn.reveal-correct  { border-color: var(--green);  background: var(--green-dim); }
  .option-btn.reveal-wrong    { border-color: var(--red);    background: var(--red-dim); }
  .option-btn.reveal-missed   { border-color: var(--amber);  background: var(--amber-dim); }
  .option-btn.selected .opt-label        { color: var(--accent); }
  .option-btn.reveal-correct .opt-label  { color: var(--green); }
  .option-btn.reveal-wrong .opt-label    { color: var(--red); }
  .option-btn.reveal-missed .opt-label   { color: var(--amber); }
  .opt-label { font-family: var(--font-display); font-size: 13px; color: var(--text-muted); min-width: 18px; flex-shrink: 0; transition: color 0.12s; }
  .opt-text  { flex: 1; }
  .opt-check { margin-left: auto; width: 16px; height: 16px; border: 1px solid var(--border); border-radius: 3px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; }
  .option-btn.selected .opt-check { background: var(--accent); border-color: var(--accent); color: #0d0d0f; }

  /* True/False big buttons */
  .tf-btn { flex: 1; justify-content: center; font-size: 20px; padding: 22px 16px; font-family: var(--font-display); letter-spacing: 0.06em; }

  /* Typed inputs */
  .typed-inputs  { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
  .typed-row     { display: flex; align-items: center; gap: 10px; }
  .typed-num     { font-family: var(--font-display); font-size: 16px; color: var(--text-muted); min-width: 20px; text-align: right; }
  .typed-field   {
    flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
    color: var(--text); font-family: var(--font-body); font-size: 15px; padding: 11px 14px;
    outline: none; transition: border-color 0.15s;
  }
  .typed-field:focus { border-color: var(--accent); }
  .typed-field:disabled { opacity: 0.7; cursor: default; }
  .typed-icon  { font-size: 16px; min-width: 20px; text-align: center; }
  .typed-row.typed-correct .typed-field { border-color: var(--green); background: var(--green-dim); }
  .typed-row.typed-wrong   .typed-field { border-color: var(--red);   background: var(--red-dim); }
  .typed-accepted { font-size: 11px; color: var(--text-muted); margin-top: 6px; font-style: italic; line-height: 1.6; }
  .typed-accepted-label { font-weight: 600; color: var(--accent); margin-right: 6px; }

  /* Fill gap */
  .fill-gap-wrap     { margin-bottom: 20px; }
  .fill-gap-sentence { font-size: 18px; line-height: 2.2; font-weight: 500; }
  .gap-text          { vertical-align: middle; }
  .gap-input-wrap    { display: inline-block; vertical-align: middle; margin: 0 4px; }
  .gap-field {
    background: var(--surface2); border: none; border-bottom: 2px solid var(--accent);
    color: var(--text); font-family: var(--font-body); font-size: 17px; font-weight: 600;
    padding: 4px 8px; outline: none; width: 140px; text-align: center;
    transition: border-color 0.15s, background 0.15s;
  }
  .gap-field:focus { background: var(--accent-dim); }
  .gap-field:disabled { opacity: 0.8; cursor: default; }
  .gap-input-wrap.gap-correct .gap-field { border-color: var(--green); background: var(--green-dim); }
  .gap-input-wrap.gap-wrong   .gap-field { border-color: var(--red);   background: var(--red-dim); }
  .gap-input-wrap.gap-missed  .gap-field { border-color: var(--amber); background: var(--amber-dim); }

  /* Explanation */
  .explanation {
    background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 12px 16px; font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 20px;
  }

  .submit-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .selected-count { font-size: 12px; color: var(--text-muted); }

  @media (max-width: 768px) {
    .option-btn  { padding: 12px 12px; }
    .timer-label { font-size: 13px; }
    .options-tf  { flex-direction: column; }
    .fill-gap-sentence { font-size: 16px; }
    .gap-field   { width: 100px; font-size: 15px; }
  }
</style>
