<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { session } from '$lib/stores/session';
  import { supabase } from '$lib/supabase';
  import {
    loadLearningSets, loadSrStatesForSets,
    logAnswer, isDue,
  } from '$lib/progress.js';
  import { scoreQuestion } from '$lib/mma/questions.js';
  import { prepareQuestion } from '$lib/mma/combat.js';
  import { gradeFromRatio } from '$lib/fsrs.js';

  // ── State ─────────────────────────────────────────────
  let loading      = $state(true);
  let error        = $state('');
  let queue        = $state([]);  // { q, setMeta, questionCount }
  let queueIdx     = $state(0);
  let phase        = $state('question'); // 'question' | 'feedback' | 'done'

  let preparedQ    = $state(null);  // shuffled question with remapped answers
  let selectedOpts = $state([]);    // indices selected by user
  let typedInputs  = $state([]);    // for typed/fill_gap
  let gapInputs    = $state([]);
  let lastResult   = $state(null);  // { ratio, score, maxPts, correct }

  const current = $derived(queue[queueIdx] ?? null);
  const q       = $derived(current?.q ?? null);
  const qtype   = $derived(q?.type || 'multi_select');
  const total   = $derived(queue.length);

  onMount(async () => {
    if (!$session) { goto('/auth/login'); return; }
    try {
      await buildQueue();
    } catch (e) {
      error = e.message;
    }
    loading = false;
  });

  async function buildQueue() {
    const uid   = $session.user.id;
    const ls    = await loadLearningSets(uid);
    if (!ls.length) { queue = []; return; }

    const setIds     = ls.map(r => r.set_id);
    const srStatesMap = await loadSrStatesForSets(uid, setIds);

    // Fetch question data for sets that have due cards
    const allCards = [];

    for (const lsRow of ls) {
      const srMap = srStatesMap.get(lsRow.set_id) ?? new Map();
      // Determine source-appropriate fetch
      let qData = null;
      if (lsRow.set_source === 'library') {
        const { data } = await supabase
          .from('user_question_sets')
          .select('data')
          .eq('id', lsRow.set_id)
          .single();
        qData = data?.data;
      } else {
        // public / builtin — static JSON
        try {
          const res = await fetch(`/questions/${lsRow.set_id}`);
          if (res.ok) qData = await res.json();
        } catch {}
      }

      if (!qData?.tiers) continue;

      // Flatten all questions
      const allQ = Object.values(qData.tiers).flat();

      // Collect due cards
      const now = Date.now();
      for (const question of allQ) {
        const qid = String(question.id ?? question._id ?? question.question ?? '');
        const sr  = srMap.get(qid);
        if (!sr || isDue(sr)) {
          allCards.push({
            q:          question,
            setMeta:    { setId: lsRow.set_id, source: lsRow.set_source, name: lsRow.set_name },
            dueMs:      sr?.due_date ? new Date(sr.due_date).getTime() : 0,
          });
        }
      }
    }

    // Sort: most overdue first, new cards last
    allCards.sort((a, b) => a.dueMs - b.dueMs);
    queue = allCards;
    loadCurrentQuestion();
  }

  function loadCurrentQuestion() {
    if (!queue[queueIdx]) return;
    const rawQ = queue[queueIdx].q;
    preparedQ    = prepareQuestion(rawQ);
    selectedOpts = [];
    typedInputs  = preparedQ?.type === 'typed'
      ? Array(preparedQ.required_count ?? preparedQ.answers?.length ?? 1).fill('')
      : [];
    gapInputs    = preparedQ?.type === 'fill_gap'
      ? Array(preparedQ.answers?.length ?? 0).fill('')
      : [];
    lastResult   = null;
    phase        = 'question';
  }

  // ── Answer logic ──────────────────────────────────────
  function toggleOption(idx) {
    if (qtype === 'multiple_choice' || qtype === 'true_false') {
      selectedOpts = [idx];
    } else {
      const s = new Set(selectedOpts);
      s.has(idx) ? s.delete(idx) : s.add(idx);
      selectedOpts = [...s];
    }
  }

  const canSubmit = $derived(() => {
    if (qtype === 'typed')    return typedInputs.some(v => v.trim());
    if (qtype === 'fill_gap') return gapInputs.some(v => v.trim());
    return selectedOpts.length > 0;
  });

  async function submitAnswer() {
    if (!preparedQ || phase !== 'question') return;
    let selectedSet;
    if (qtype === 'typed' || qtype === 'fill_gap') {
      const inputs = qtype === 'typed' ? typedInputs : gapInputs;
      // For typed: match each input against answer list (case/accent tolerant)
      if (qtype === 'typed') {
        const matched = new Set();
        for (const inp of inputs) {
          const t = inp.trim().toLowerCase();
          if (!t) continue;
          const idx = preparedQ.answers.findIndex(a =>
            a.toLowerCase() === t
          );
          if (idx >= 0) matched.add(idx);
        }
        selectedSet = matched;
      } else {
        // fill_gap: match positionally
        selectedSet = new Set();
        for (let i = 0; i < gapInputs.length; i++) {
          if (gapInputs[i].trim().toLowerCase() === (preparedQ.answers[i] ?? '').toLowerCase()) {
            selectedSet.add(i);
          }
        }
      }
    } else {
      selectedSet = new Set(selectedOpts);
    }

    const { score, maxPts, ratio } = scoreQuestion(preparedQ, selectedSet);
    const correct = ratio >= 1.0;
    lastResult = { ratio, score, maxPts, correct };
    phase = 'feedback';

    // Fire-and-forget log + FSRS update
    const sess = $session;
    if (sess && current?.setMeta) {
      logAnswer(sess.user.id, q, current.setMeta, 'study', ratio, score, maxPts);
    }
  }

  function nextCard() {
    const next = queueIdx + 1;
    if (next >= queue.length) {
      phase = 'done';
    } else {
      queueIdx = next;
      loadCurrentQuestion();
    }
  }

  // ── Fill-gap: split template into text + gap parts ────
  function fillGapParts(template) {
    if (!template) return [];
    const parts = [];
    let remaining = template;
    while (remaining.includes('___')) {
      const idx = remaining.indexOf('___');
      parts.push({ type: 'text', text: remaining.slice(0, idx) });
      parts.push({ type: 'gap' });
      remaining = remaining.slice(idx + 3);
    }
    if (remaining) parts.push({ type: 'text', text: remaining });
    return parts;
  }
  const gapParts = $derived(qtype === 'fill_gap' ? fillGapParts(preparedQ?.template) : []);
  let gapIdx = 0; // used during rendering to assign gap indices

  // Self-grade buttons (for study mode, map to FSRS grades)
  const SELF_GRADE = [
    { label: 'Again',  grade: 1, cls: 'grade-again' },
    { label: 'Hard',   grade: 2, cls: 'grade-hard'  },
    { label: 'Good',   grade: 3, cls: 'grade-good'  },
    { label: 'Easy',   grade: 4, cls: 'grade-easy'  },
  ];

  // Override grade if user self-selects (post-feedback only)
  async function applyGrade(grade) {
    // Re-log with overridden grade (fire-and-forget)
    const sess = $session;
    if (sess && current?.setMeta && q) {
      const ratio = grade >= 3 ? 1.0 : grade === 2 ? 0.5 : 0;
      logAnswer(sess.user.id, q, current.setMeta, 'study', ratio,
        lastResult?.score ?? 0, lastResult?.maxPts ?? 1);
    }
    nextCard();
  }
</script>

<svelte:head>
  <title>Study — McChimp</title>
</svelte:head>

<div class="study-wrap">
  <div class="study-nav">
    <a href="/learn" class="back-link">← Progress</a>
    {#if !loading && queue.length > 0 && phase !== 'done'}
      <span class="card-counter">{queueIdx + 1} / {total}</span>
    {/if}
  </div>

  {#if loading}
    <p class="muted">Loading your due cards…</p>

  {:else if error}
    <div class="alert-error">{error}</div>

  {:else if queue.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🎉</div>
      <div class="empty-title">All caught up!</div>
      <p class="empty-desc">No cards are due right now. Come back later or add more sets to your learning list.</p>
      <a href="/learn" class="btn-back">Back to Progress</a>
    </div>

  {:else if phase === 'done'}
    <div class="empty-state">
      <div class="empty-icon">✓</div>
      <div class="empty-title">Session complete</div>
      <p class="empty-desc">You reviewed {total} card{total !== 1 ? 's' : ''}. FSRS has scheduled your next review.</p>
      <a href="/learn" class="btn-back">Back to Progress</a>
    </div>

  {:else if preparedQ}
    <!-- Progress bar -->
    <div class="progress-bar-outer">
      <div class="progress-bar-fill" style="width:{((queueIdx) / total * 100).toFixed(1)}%"></div>
    </div>

    <div class="card">
      <!-- Question -->
      <div class="q-header">
        {#if qtype === 'true_false'}
          <span class="q-hint">True or False?</span>
        {:else if qtype === 'multiple_choice'}
          <span class="q-hint">Select one answer.</span>
        {:else if qtype === 'typed'}
          <span class="q-hint">Name {preparedQ.required_count ?? preparedQ.answers?.length ?? 1} answer{(preparedQ.required_count ?? 1) !== 1 ? 's' : ''}.</span>
        {:else if qtype === 'fill_gap'}
          <span class="q-hint">Fill in the blanks.</span>
        {:else}
          <span class="q-hint">Select all correct answers.</span>
        {/if}
      </div>

      {#if qtype === 'fill_gap' && preparedQ.template}
        <div class="q-text fill-gap-template">
          {#each gapParts as part, pi}
            {#if part.type === 'text'}
              {part.text}
            {:else}
              {@const gi = gapParts.slice(0, pi).filter(p => p.type === 'gap').length}
              <input
                class="gap-input"
                class:correct={phase === 'feedback' && gapInputs[gi]?.trim().toLowerCase() === (preparedQ.answers[gi] ?? '').toLowerCase()}
                class:wrong={phase === 'feedback' && gapInputs[gi]?.trim() && gapInputs[gi]?.trim().toLowerCase() !== (preparedQ.answers[gi] ?? '').toLowerCase()}
                type="text"
                bind:value={gapInputs[gi]}
                disabled={phase === 'feedback'}
                placeholder="___"
              >
            {/if}
          {/each}
        </div>
      {:else}
        <div class="q-text">{preparedQ.question}</div>
      {/if}

      <!-- Options (multi/mc/tf) -->
      {#if qtype !== 'typed' && qtype !== 'fill_gap' && preparedQ.options}
        <div class="options">
          {#each preparedQ.options as opt, i}
            {@const chosen = selectedOpts.includes(i)}
            {@const isCorrect = phase === 'feedback' && preparedQ.answers.includes(i)}
            {@const isWrong   = phase === 'feedback' && chosen && !preparedQ.answers.includes(i)}
            <button
              class="option"
              class:selected={chosen}
              class:correct={isCorrect}
              class:wrong={isWrong}
              disabled={phase === 'feedback'}
              onclick={() => toggleOption(i)}
            >
              <span class="opt-marker">{String.fromCharCode(65 + i)}</span>
              <span class="opt-text">{opt}</span>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Typed inputs -->
      {#if qtype === 'typed'}
        <div class="typed-inputs">
          {#each typedInputs as _, i}
            <input
              class="typed-input"
              type="text"
              bind:value={typedInputs[i]}
              disabled={phase === 'feedback'}
              placeholder={`Answer ${i + 1}`}
            >
          {/each}
        </div>
      {/if}

      <!-- Feedback -->
      {#if phase === 'feedback' && lastResult}
        <div class="feedback" class:correct={lastResult.correct} class:wrong={!lastResult.correct}>
          <span class="feedback-label">{lastResult.correct ? 'Correct!' : lastResult.ratio > 0 ? 'Partial' : 'Incorrect'}</span>
          {#if !lastResult.correct}
            <div class="correct-answer">
              Correct: {Array.isArray(preparedQ.answers)
                ? preparedQ.answers.map(a => typeof a === 'number' ? preparedQ.options?.[a] : a).join(', ')
                : preparedQ.answers}
            </div>
          {/if}
        </div>

        <!-- Self-grade buttons -->
        <div class="self-grade">
          <span class="self-grade-label">How well did you know this?</span>
          <div class="grade-buttons">
            {#each SELF_GRADE as sg}
              <button class="btn-grade {sg.cls}" onclick={() => applyGrade(sg.grade)}>
                {sg.label}
              </button>
            {/each}
          </div>
        </div>
      {:else if phase === 'question'}
        <button class="btn-submit" disabled={!canSubmit()} onclick={submitAnswer}>
          Check Answer
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .study-wrap { padding: 120px 48px 80px; max-width: 700px; margin: 0 auto; }
  .study-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
  .back-link { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); text-decoration: none; transition: color .15s; }
  .back-link:hover { color: var(--white); }
  .card-counter { font-size: 13px; color: var(--muted); }

  .progress-bar-outer { height: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; margin-bottom: 32px; overflow: hidden; }
  .progress-bar-fill { height: 100%; background: var(--gold); border-radius: 2px; transition: width .3s; }

  .muted { color: var(--muted); font-size: 14px; }
  .alert-error { background: rgba(217,64,64,0.08); border: 1px solid rgba(217,64,64,0.3); border-radius: 3px; padding: 12px 16px; font-size: 13px; color: #E88A8A; }

  .empty-state { text-align: center; padding: 64px 32px; }
  .empty-icon { font-size: 48px; margin-bottom: 20px; }
  .empty-title { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: .04em; color: var(--white); margin-bottom: 12px; }
  .empty-desc { font-size: 14px; color: var(--muted); line-height: 1.6; max-width: 380px; margin: 0 auto 24px; }
  .btn-back { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: var(--gold); color: var(--black); border: none; padding: 12px 24px; border-radius: 3px; text-decoration: none; display: inline-block; transition: background .15s; }
  .btn-back:hover { background: var(--gold2); }

  /* ── Card ────────────────────────────────────────────── */
  .card { background: var(--surface); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 32px; display: flex; flex-direction: column; gap: 20px; }
  .q-header { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  .q-hint { }
  .q-text { font-size: 20px; color: var(--white); line-height: 1.5; }
  .fill-gap-template { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; font-size: 18px; line-height: 1.8; }

  /* ── Options ─────────────────────────────────────────── */
  .options { display: flex; flex-direction: column; gap: 8px; }
  .option {
    display: flex; align-items: flex-start; gap: 12px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 3px; padding: 14px 16px; cursor: pointer; text-align: left;
    transition: border-color .15s, background .15s;
  }
  .option:hover:not(:disabled) { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); }
  .option.selected { border-color: var(--gold); background: rgba(232,193,74,0.08); }
  .option.correct  { border-color: #2E8B57; background: rgba(46,139,87,0.1); }
  .option.wrong    { border-color: var(--red); background: rgba(217,64,64,0.08); }
  .option:disabled { cursor: default; }
  .opt-marker { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .08em; color: var(--muted); min-width: 18px; padding-top: 2px; }
  .opt-text { font-size: 15px; color: var(--white); line-height: 1.4; }

  /* ── Typed / fill-gap ─────────────────────────────────── */
  .typed-inputs { display: flex; flex-direction: column; gap: 8px; }
  .typed-input, .gap-input {
    background: var(--off); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 3px; padding: 12px 14px; color: var(--white); font-size: 15px;
    font-family: 'Barlow', sans-serif;
  }
  .typed-input:focus, .gap-input:focus { outline: none; border-color: rgba(232,193,74,0.5); }
  .typed-input::placeholder, .gap-input::placeholder { color: var(--muted); }
  .gap-input { width: 100px; padding: 6px 10px; font-size: 14px; display: inline-block; }
  .gap-input.correct { border-color: #2E8B57; background: rgba(46,139,87,0.08); }
  .gap-input.wrong   { border-color: var(--red); background: rgba(217,64,64,0.06); }

  /* ── Submit ──────────────────────────────────────────── */
  .btn-submit {
    font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase;
    background: var(--gold); color: var(--black); border: none;
    padding: 14px 28px; border-radius: 3px; cursor: pointer; transition: background .15s; align-self: flex-start;
  }
  .btn-submit:hover:not(:disabled) { background: var(--gold2); }
  .btn-submit:disabled { opacity: .4; cursor: not-allowed; }

  /* ── Feedback ────────────────────────────────────────── */
  .feedback { border-radius: 3px; padding: 14px 16px; }
  .feedback.correct { background: rgba(46,139,87,0.1); border: 1px solid rgba(46,139,87,0.3); }
  .feedback.wrong   { background: rgba(217,64,64,0.08); border: 1px solid rgba(217,64,64,0.25); }
  .feedback-label { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: .08em; }
  .feedback.correct .feedback-label { color: #4CAF85; }
  .feedback.wrong   .feedback-label { color: #E88A8A; }
  .correct-answer { font-size: 13px; color: rgba(242,239,232,0.6); margin-top: 6px; line-height: 1.5; }

  /* ── Self-grade ──────────────────────────────────────── */
  .self-grade { display: flex; flex-direction: column; gap: 10px; }
  .self-grade-label { font-size: 12px; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .grade-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
  .btn-grade {
    font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700;
    letter-spacing: .08em; text-transform: uppercase;
    border: 1px solid; border-radius: 3px; padding: 9px 18px; cursor: pointer; transition: all .15s;
  }
  .grade-again { background: rgba(217,64,64,0.08);   color: #E88A8A; border-color: rgba(217,64,64,0.3); }
  .grade-again:hover { background: rgba(217,64,64,0.18); }
  .grade-hard  { background: rgba(232,193,74,0.06);  color: #C89A20; border-color: rgba(232,193,74,0.2); }
  .grade-hard:hover { background: rgba(232,193,74,0.14); }
  .grade-good  { background: rgba(46,139,87,0.08);   color: #4CAF85; border-color: rgba(46,139,87,0.25); }
  .grade-good:hover { background: rgba(46,139,87,0.16); }
  .grade-easy  { background: rgba(42,94,173,0.08);   color: #7aaee8; border-color: rgba(42,94,173,0.25); }
  .grade-easy:hover { background: rgba(42,94,173,0.15); }

  @media (max-width: 700px) {
    .study-wrap { padding: 28px 20px; }
    .card { padding: 24px 20px; }
    .q-text { font-size: 17px; }
  }
</style>
