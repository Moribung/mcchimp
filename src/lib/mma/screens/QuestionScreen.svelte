<!-- src/lib/mma/screens/QuestionScreen.svelte -->
<!-- Timer (setInterval here), options, multi-select, submit -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { state as gs }           from '$lib/mma/state.svelte.js';
  import { resolveResult }   from '$lib/mma/combat.js';
  import { scoreQuestion }   from '$lib/mma/questions.js';
  import { DIFF_LABELS, DIFF_COLORS } from '$lib/mma/constants.js';

  const { onsave } = $props();
  const q        = $derived(gs.currentQuestion);
  const selected = $derived(new Set(gs.selectedOptions));

  // ── Live score meter ──────────────────────────────────
  const meterData = $derived(
    (() => {
      if (!q || selected.size === 0) return { pct: 0, color: 'rgba(255,255,255,0.1)', hint: 'Select answers' };
      const { ratio } = scoreQuestion(q, selected);
      const pct = Math.round(ratio * 100);
      if (ratio === 1)  return { pct, color: 'var(--green)', hint: 'Win' };
      if (ratio >= 0.5) return { pct, color: 'var(--amber)', hint: 'Draw' };
      if (ratio > 0)    return { pct, color: 'var(--red)',   hint: 'Loss' };
      return             { pct: 0, color: '#a0001a',          hint: 'Finish' };
    })()
  );

  // ── Timer bar colour ──────────────────────────────────
  const timerPct   = $derived(gs.effectiveTimer > 0 ? gs.timeLeft / gs.effectiveTimer : 1);
  const timerColor = $derived(timerPct < 0.3 ? 'var(--red)' : timerPct < 0.6 ? '#e8944a' : 'var(--accent)');

  const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  // ── Reveal state (after submit) ───────────────────────
  let revealed = $state(false);
  let optionStates = $state([]);   // 'default' | 'correct' | 'wrong' | 'missed'

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

  // ── Toggle option ─────────────────────────────────────
  function toggleOption(idx) {
    if (revealed) return;
    const next = [...selected];
    if (selected.has(idx)) {
      gs.selectedOptions = next.filter(i => i !== idx);
    } else {
      gs.selectedOptions = [...next, idx];
    }
  }

  // ── Submit ────────────────────────────────────────────
  function submit() {
    if (revealed) return;
    stopTimer();
    doResolve();
  }

  function doResolve() {
    if (!q) return;
    const T       = gs.effectiveTimer || 45;
    const pctUsed = 1 - gs.timeLeft / T;
    revealed = true;
    // Small delay then resolve (gives reveal animation time to register)
    setTimeout(() => {
      const activeLength = gs.career?.activeLength ?? 0;
      const { resultClass, rolled, score, maxPts, ratio, isLast, event } =
        resolveResult(gs, gs.career, q, selected, pctUsed, activeLength);
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
      gs.timeLeft  = remaining;
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

  onDestroy(() => {
    clearInterval(timerHandle);
  });

  // ── Enter key: submit ─────────────────────────────────
  function onKeydown(e) {
    if (e.key !== 'Enter') return;
    if (document.activeElement) document.activeElement.blur();
    if (!revealed) submit();
    e.preventDefault();
  }
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

  <p class="question-text">{q.question}</p>
  <p class="question-hint">
    {q.answers.length === 1 ? 'Select one answer.' : 'Select all that apply.'}
  </p>

  <!-- Timer -->
  <div class="timer-wrap">
    <div class="timer-bar-bg">
      <div
        class="timer-bar"
        style="width:{timerPct * 100}%;background:{timerColor};transition:width 0.1s linear,background 0.3s"
      ></div>
    </div>
    <div class="timer-label">{Math.ceil(gs.timeLeft)}s</div>
  </div>

  <!-- Score meter (sparring only) -->
  {#if gs.sparring}
    <div class="score-meter">
      <div class="meter-track">
        <div
          class="meter-fill"
          style="width:{meterData.pct}%;background:{meterData.color};transition:width 0.2s,background 0.2s"
        ></div>
      </div>
      <div class="meter-label" style="color:{meterData.color}">
        {selected.size === 0 ? '–' : meterData.pct + '%'}
      </div>
      <div class="meter-hint">{meterData.hint}</div>
    </div>
  {/if}

  <!-- Options -->
  <div class="options">
    {#each q.options as opt, idx}
      {@const st = getOptionState(idx)}
      <button
        class="option-btn"
        class:selected={selected.has(idx) && !revealed}
        class:reveal-correct={st === 'correct'}
        class:reveal-wrong={st === 'wrong'}
        class:reveal-missed={st === 'missed'}
        disabled={revealed}
        onclick={() => toggleOption(idx)}
      >
        <span class="opt-label">{LABELS[idx]}</span>
        <span class="opt-text">{opt}</span>
        <span class="opt-check">
          {#if selected.has(idx) && !revealed}✓{/if}
        </span>
      </button>
    {/each}
  </div>

  <!-- Submit bar -->
  <div class="submit-bar">
    <span class="selected-count">
      {selected.size > 0 ? `${selected.size} selected` : ''}
    </span>
    <button
      class="btn btn-primary"
      disabled={revealed}
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
  .timer-bar    { height: 100%; border-radius: 2px; width: 100%; }
  .timer-label  { font-family: var(--font-display); font-size: 15px; color: var(--text-muted); letter-spacing: 0.04em; }

  .score-meter { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding: 12px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); }
  .meter-track { flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
  .meter-fill  { height: 100%; border-radius: 3px; width: 0%; }
  .meter-label { font-family: var(--font-display); font-size: 18px; letter-spacing: 0.04em; min-width: 44px; text-align: right; }
  .meter-hint  { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; min-width: 70px; text-align: right; }

  .options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }

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

  .submit-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .selected-count { font-size: 12px; color: var(--text-muted); }

  @media (max-width: 768px) {
    .option-btn { padding: 12px 12px; }
    .timer-label { font-size: 13px; }
  }
</style>
