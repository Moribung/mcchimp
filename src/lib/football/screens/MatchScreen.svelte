<!-- src/lib/football/screens/MatchScreen.svelte -->
<!-- Full match question loop — owns the timer and all local input state. -->
<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { state as gs }  from '$lib/football/state.svelte.js';
  import { sortTable, getClubName } from '$lib/football/league.js';
  import { scoreTypedInputs, scoreFillGapInputs } from '$lib/football/questions.js';
  import { DIFF_LABELS, DIFF_COLORS, relegationCount } from '$lib/football/constants.js';

  /** onlockin(selectedOptions: number[], typedInputs: string[]) → void */
  /** onnext() → void  (page increments currentQIdx or finalises) */
  const { onlockin, onnext } = $props();

  // ── Derived match state ───────────────────────────────
  const cm       = $derived(gs.currentMatch);
  const q        = $derived(cm?.questions?.[cm?.currentQIdx] || null);
  const qtype    = $derived(q?.type || 'multi_select');
  const isMulti  = $derived(qtype === 'multi_select');
  const phase    = $derived(cm?.phase || 'answering');
  const revealed = $derived(phase === 'revealed');

  const oppName  = $derived(cm
    ? getClubName(cm.opponentId, gs.table?.div1 || [], gs.table?.div2 || [])
    : '?');
  const hName    = $derived(cm?.isHome ? gs.club?.name : oppName);
  const aName    = $derived(cm?.isHome ? oppName : gs.club?.name);
  const hG       = $derived(cm?.isHome ? cm?.playerGoals : cm?.oppGoals);
  const aG       = $derived(cm?.isHome ? cm?.oppGoals    : cm?.playerGoals);

  const playerAhead = $derived((cm?.playerGoals || 0) > (cm?.oppGoals || 0));
  const oppAhead    = $derived((cm?.oppGoals    || 0) > (cm?.playerGoals || 0));
  const scoreColor  = $derived(playerAhead ? 'var(--green)' : oppAhead ? 'var(--red)' : 'var(--text)');

  const divTable   = $derived(sortTable(gs.table?.[`div${gs.division}`] || []));
  const divTotal   = $derived(divTable.length);
  const relCount   = $derived(relegationCount(divTotal));
  const playerPos  = $derived(divTable.findIndex(r => r.id === 'player') + 1);

  // ── Timer ─────────────────────────────────────────────
  const TIMER_SECS = 30;
  let timerLeft  = $state(TIMER_SECS);
  let timerPct   = $state(1);
  let timerHandle = null;

  function startTimer() {
    clearTimer();
    timerLeft = TIMER_SECS;
    timerPct  = 1;
    const start = Date.now();
    timerHandle = setInterval(() => {
      const left = Math.max(0, TIMER_SECS - (Date.now() - start) / 1000);
      timerLeft = left;
      timerPct  = left / TIMER_SECS;
      if (left <= 0) { clearTimer(); submit(); }
    }, 80);
  }

  function clearTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }

  const timerColor = $derived(
    timerPct < 0.25 ? 'var(--red)' : timerPct < 0.5 ? 'var(--amber)' : 'var(--gold)'
  );

  // ── Local input state ─────────────────────────────────
  let localSelected = $state([]);   // number[] for option-based types
  let typedInputs   = $state([]);   // string[] for typed/fill_gap
  let goalVibrate   = $state(false);

  // Reset inputs when question index changes
  let _trackedIdx = -1;
  $effect(() => {
    const idx = cm?.currentQIdx ?? -1;
    if (idx !== _trackedIdx) {
      _trackedIdx    = idx;
      localSelected  = [];
      typedInputs    = [];
      if (phase === 'answering') startTimer();
    }
  });

  onMount(() => {
    if (phase === 'answering') startTimer();
  });
  onDestroy(clearTimer);

  // ── Goal vibrate animation ─────────────────────────────
  let _lastGoalCount = 0;
  $effect(() => {
    const goals = (cm?.playerGoals || 0) + (cm?.oppGoals || 0);
    if (goals > _lastGoalCount && revealed) {
      _lastGoalCount = goals;
      goalVibrate = true;
      setTimeout(() => { goalVibrate = false; }, 500);
    }
  });

  // ── Option toggle ─────────────────────────────────────
  function toggleOption(idx) {
    if (revealed) return;
    if (qtype === 'multiple_choice' || qtype === 'true_false') {
      localSelected = [idx];
    } else {
      const pos = localSelected.indexOf(idx);
      if (pos >= 0) localSelected = localSelected.filter((_, i) => i !== pos);
      else          localSelected = [...localSelected, idx];
    }
  }

  // ── Can submit? ───────────────────────────────────────
  const canSubmit = $derived(
    qtype === 'typed'    ? typedInputs.some(v => v.trim()) :
    qtype === 'fill_gap' ? typedInputs.some(v => v.trim()) :
    localSelected.length > 0
  );

  // ── Reveal state per option ───────────────────────────
  function optionState(idx) {
    if (!revealed || !q) return 'default';
    const cor = new Set(q.answers).has(idx);
    const sel = localSelected.includes(idx);
    if (sel && cor)  return 'correct';
    if (sel && !cor) return 'wrong';
    if (!sel && cor) return 'missed';
    return 'default';
  }

  // ── Typed reveal ──────────────────────────────────────
  const typedCorrect = $derived(
    revealed && (qtype === 'typed' || qtype === 'fill_gap')
      ? (qtype === 'typed' ? scoreTypedInputs(q, typedInputs) : scoreFillGapInputs(q, typedInputs))
      : new Set()
  );

  // ── Gap parts ─────────────────────────────────────────
  const gapParts = $derived(
    qtype === 'fill_gap' && q?.template ? q.template.split('___') : []
  );

  // ── Hint text ─────────────────────────────────────────
  const hint = $derived((() => {
    if (!q) return '';
    if (qtype === 'true_false')      return 'True or False?';
    if (qtype === 'multiple_choice') return 'Select one answer.';
    if (qtype === 'typed')           return `Name ${q.required_count ?? q.answers?.length ?? 1} answer${(q.required_count ?? 1) > 1 ? 's' : ''}.`;
    if (qtype === 'fill_gap')        return 'Fill in the blanks.';
    return q.answers?.length === 1 ? 'Select one answer.' : 'Select all that apply.';
  })());

  // ── Submit ────────────────────────────────────────────
  function submit() {
    if (revealed) return;
    clearTimer();
    onlockin?.(localSelected, typedInputs);
  }

  // ── Next ──────────────────────────────────────────────
  function next() {
    onnext?.();
    // Timer restart is handled by the $effect on currentQIdx
  }

  // ── Keyboard ──────────────────────────────────────────
  function onKeydown(e) {
    if (!cm) return;
    const isText = qtype === 'typed' || qtype === 'fill_gap';
    if (phase === 'answering') {
      if (!isText && (qtype === 'multiple_choice' || qtype === 'true_false')) {
        const idx = parseInt(e.key) - 1;
        if (!isNaN(idx) && q?.options && idx >= 0 && idx < q.options.length) {
          e.preventDefault(); toggleOption(idx);
        }
      }
      if (e.key === 'Enter' && !isText && canSubmit) { e.preventDefault(); submit(); }
    } else if (phase === 'revealed' && e.key === 'Enter') {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault(); next();
    }
  }

  // ── Narrative text ────────────────────────────────────
  function narrativeText(n) {
    if (!n) return '';
    const { playerName: name, scored, wasPlayerPhase } = n;
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    if (wasPlayerPhase && scored)   return pick([`${name} slots it home.`, `${name} fires past the keeper.`, `${name} curls a beauty in.`, `${name} taps it in — simple finish.`]);
    if (wasPlayerPhase && !scored)  return pick([`${name}'s effort is saved.`, `${name} blazes it over.`, `${name} hits the post.`, `${name}'s shot goes wide.`]);
    if (!wasPlayerPhase && scored)  return pick([`${name} punishes a lapse — it's in.`, `${name} finishes from close range.`, `${name} makes it count.`]);
    return pick([`${name}'s effort goes wide.`, `${name} skies it — let off.`, `${name} is denied by the keeper.`]);
  }

  // ── Mini table row color ──────────────────────────────
  function posColor(pos) {
    if (pos > divTotal - relCount) return 'var(--red)';
    if (gs.division === 2 && pos <= relCount) return 'var(--green)';
    if (gs.division === 1) {
      if (pos === 1) return 'var(--gold)';
      if (pos <= (divTotal <= 8 ? 2 : divTotal <= 14 ? 3 : 4)) return 'var(--purple)';
    }
    return null;
  }

  // ── Kit seg ───────────────────────────────────────────
  function kitBar(row) {
    if (!row) return '';
    if (row.id === 'player') {
      const col = gs.club?.kitColour || '#888';
      return `<span class="kit-bar"><span style="background:${col};flex:1;height:100%"></span></span>`;
    }
    const segs = (row.colours || []).map(c => `<span style="background:${c};flex:1;height:100%"></span>`).join('');
    return `<span class="kit-bar">${segs}</span>`;
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if cm && q}
<div class="match-layout">
  <!-- ═══════════════════════════════════════
       LEFT: Question area
  ═══════════════════════════════════════ -->
  <div class="match-left">

    <!-- Progress pips -->
    <div class="pips">
      {#each cm.questions as _, i}
        <div class="pip"
          class:pip-done={i < cm.currentQIdx}
          class:pip-current={i === cm.currentQIdx}
        ></div>
      {/each}
    </div>

    <!-- Timer -->
    {#if phase === 'answering'}
      <div class="timer-wrap">
        <div class="timer-track">
          <div class="timer-fill"
            style="width:{timerPct * 100}%;background:{timerColor};transition:width .08s linear,background .3s">
          </div>
        </div>
        <span class="timer-label" style="color:{timerColor}">{Math.ceil(timerLeft)}s</span>
      </div>
    {:else}
      <div class="timer-wrap">
        <div class="timer-track"><div class="timer-fill" style="width:0;background:var(--border)"></div></div>
        <span class="timer-label" style="color:var(--muted)">—</span>
      </div>
    {/if}

    <!-- Inline live score -->
    <div class="inline-score" class:goal-pulse={goalVibrate}>
      <div class="inline-score-row">
        <span class="inline-club">{hName}</span>
        <span class="inline-digits">
          <span style="color:{cm.isHome ? scoreColor : 'var(--text)'}">{hG}</span>
          <span class="inline-sep">–</span>
          <span style="color:{cm.isHome ? 'var(--text)' : scoreColor}">{aG}</span>
        </span>
        <span class="inline-club right">{aName}</span>
      </div>
      {#if revealed && cm.lastNarrative}
        <div class="narrative">
          {#if cm.lastNarrative.scored && cm.lastNarrative.wasPlayerPhase}
            <span class="narrative-goal">⚽</span>
          {:else if cm.lastNarrative.scored && !cm.lastNarrative.wasPlayerPhase}
            <span class="narrative-opp-goal">⚽</span>
          {/if}
          {narrativeText(cm.lastNarrative)}
        </div>
      {/if}
      {#if cm.goalScorers.length}
        <div class="scorers-row">
          {#each cm.goalScorers.filter(g => g.isPlayer) as g}
            <span class="scorer-chip scorer-player">{g.name.split(' ').pop()} {g.minute}'</span>
          {/each}
          {#each cm.goalScorers.filter(g => !g.isPlayer) as g}
            <span class="scorer-chip scorer-opp">{g.name.split(' ').pop()} {g.minute}'</span>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Difficulty badge -->
    <div class="q-meta-row">
      <span class="diff-badge" style="background:{DIFF_COLORS[q._tier||q.difficulty]+'22'};color:{DIFF_COLORS[q._tier||q.difficulty||'medium']}">
        {DIFF_LABELS[q._tier || q.difficulty || 'medium']}
      </span>
      <span class="q-counter">Q {cm.currentQIdx + 1} / {cm.questions.length}</span>
    </div>

    <!-- Question text -->
    {#if qtype !== 'fill_gap'}
      <p class="question-text">{q.question}</p>
    {/if}
    <p class="question-hint">{hint}</p>

    <!-- ── MULTI SELECT / MULTIPLE CHOICE / TRUE FALSE ── -->
    {#if qtype === 'multi_select' || qtype === 'multiple_choice' || qtype === 'true_false'}
      <div class="options" class:options-tf={qtype === 'true_false'}>
        {#each q.options as opt, idx}
          {@const st = optionState(idx)}
          <button
            class="option-btn"
            class:selected={localSelected.includes(idx) && !revealed}
            class:reveal-correct={st === 'correct'}
            class:reveal-wrong={st === 'wrong'}
            class:reveal-missed={st === 'missed'}
            class:tf-btn={qtype === 'true_false'}
            disabled={revealed}
            onclick={() => toggleOption(idx)}
          >
            {#if qtype !== 'true_false'}
              <span class="opt-label">{String.fromCharCode(65 + idx)}</span>
            {/if}
            <span class="opt-text">{opt}</span>
            {#if qtype !== 'true_false'}
              <span class="opt-check">{localSelected.includes(idx) && !revealed ? '✓' : ''}</span>
            {/if}
          </button>
        {/each}
      </div>

    <!-- ── TYPED ──────────────────────────────────────── -->
    {:else if qtype === 'typed'}
      {@const count = q.required_count ?? q.answers?.length ?? 1}
      <div class="typed-inputs">
        {#each Array(count) as _, i}
          {@const cor = typedCorrect.has(i)}
          {@const hasVal = (typedInputs[i] || '').trim().length > 0}
          <div class="typed-row"
            class:typed-correct={revealed && cor}
            class:typed-wrong={revealed && !cor && hasVal}
          >
            <span class="typed-num">{i + 1}</span>
            <input
              class="typed-field"
              type="text"
              placeholder="Your answer…"
              disabled={revealed}
              value={typedInputs[i] || ''}
              oninput={e => { typedInputs = typedInputs.map((v, j) => j === i ? e.target.value : v).concat(i >= typedInputs.length ? Array(i - typedInputs.length + 1).fill('') : []).slice(0, Math.max(typedInputs.length, i + 1)); typedInputs[i] = e.target.value; typedInputs = [...typedInputs]; }}
              onkeydown={e => {
                if (e.key !== 'Enter') return;
                e.stopPropagation();
                const next = document.querySelectorAll('.typed-field')[i + 1];
                if (next) next.focus(); else submit();
              }}
            />
            {#if revealed}
              <span class="typed-icon" style="color:{cor ? 'var(--green)' : 'var(--red)'}">{cor ? '✓' : '✗'}</span>
            {/if}
          </div>
        {/each}
        {#if revealed}
          <div class="typed-accepted">
            <strong>Accepted:</strong> {(q.answers || []).join(', ')}
          </div>
        {/if}
      </div>

    <!-- ── FILL GAP ────────────────────────────────────── -->
    {:else if qtype === 'fill_gap'}
      <p class="question-text">{q.question}</p>
      <div class="fill-gap-wrap">
        <div class="fill-gap-sentence">
          {#each gapParts as part, i}
            <span class="gap-text">{part}</span>
            {#if i < gapParts.length - 1}
              {@const gv  = typedInputs[i] || ''}
              {@const cor = typedCorrect.has(i)}
              <span class="gap-input-wrap"
                class:gap-correct={revealed && gv && cor}
                class:gap-wrong={revealed && gv && !cor}
                class:gap-missed={revealed && !gv}
              >
                <input
                  class="gap-field"
                  type="text"
                  placeholder="___"
                  disabled={revealed}
                  value={gv}
                  oninput={e => { const arr = [...typedInputs]; arr[i] = e.target.value; typedInputs = arr; }}
                  onkeydown={e => {
                    if (e.key !== 'Enter') return;
                    e.stopPropagation();
                    const next = document.querySelectorAll('.gap-field')[i + 1];
                    if (next) next.focus(); else submit();
                  }}
                />
              </span>
            {/if}
          {/each}
        </div>
        {#if revealed}
          <div class="typed-accepted">
            <strong>Answers:</strong> {(q.answers || []).join(' · ')}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Explanation -->
    {#if revealed && q.explanation}
      <div class="explanation">{q.explanation}</div>
    {/if}

    <!-- Action button -->
    <div class="action-row">
      {#if !revealed}
        <span class="selection-hint">
          {#if qtype === 'typed'}
            {typedInputs.filter(v => v.trim()).length}/{q.required_count ?? q.answers?.length ?? 1} filled
          {:else if qtype === 'fill_gap'}
            {typedInputs.filter(v => v.trim()).length}/{gapParts.length - 1} filled
          {:else if localSelected.length > 0}
            {localSelected.length} selected
          {/if}
        </span>
        <button class="btn btn-primary btn-action"
          disabled={!canSubmit}
          onclick={submit}>
          Lock In
        </button>
      {:else}
        <span class="result-hint" style="color:{cm.lastAnswerCorrect ? 'var(--green)' : 'var(--red)'}">
          {cm.lastAnswerCorrect ? '✓ Correct' : '✗ Wrong'}
        </span>
        <button class="btn btn-primary btn-action" onclick={next}>
          {cm.currentQIdx < cm.questions.length - 1 ? 'Next Question →' : 'Full Time →'}
        </button>
      {/if}
    </div>
  </div>

  <!-- ═══════════════════════════════════════
       RIGHT: Live score + mini table
  ═══════════════════════════════════════ -->
  <div class="match-right">
    <!-- Score panel -->
    <div class="score-panel">
      <div class="score-label">Q {cm.currentQIdx + 1} of {cm.questions.length}</div>
      <div class="score-digits" class:goal-pulse={goalVibrate}>
        <span style="color:{cm.isHome ? scoreColor : 'var(--text)'}">{hG}</span>
        <span class="score-sep">–</span>
        <span style="color:{cm.isHome ? 'var(--text)' : scoreColor}">{aG}</span>
      </div>
      <div class="score-clubs">
        <span class="score-club">{hName}</span>
        <span class="score-club right">{aName}</span>
      </div>
      {#if cm.goalScorers.length}
        <div class="scorers-list">
          {#each [...cm.goalScorers].sort((a,b) => a.minute - b.minute) as g}
            <div class="scorer-entry" style="color:{g.isPlayer ? 'var(--gold)' : 'var(--text-dim)'}">
              <span class="scorer-min">{g.minute}'</span>
              <span>{g.name.split(' ').pop()}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Mini table -->
    <div class="mini-table-wrap">
      <div class="mini-table-title">{gs.division === 1 ? 'Prima' : 'Seconda'} Divisione</div>
      {#each divTable.slice(0, 5) as row, i}
        {@const pc = posColor(i + 1)}
        <div class="mini-row" class:mini-player={row.id === 'player'}>
          <span class="mini-pos" style={pc ? `color:${pc}` : ''}>{i + 1}</span>
          {@html kitBar(row)}
          <span class="mini-name">{row.name.split(' ').slice(-1)[0]}</span>
          <span class="mini-pts">{row.pts}</span>
        </div>
      {/each}
      {#if playerPos > 5}
        <div class="mini-sep">···</div>
        {@const pRow = divTable[playerPos - 1]}
        {#if pRow}
          {@const pc = posColor(playerPos)}
          <div class="mini-row mini-player">
            <span class="mini-pos" style={pc ? `color:${pc}` : ''}>{playerPos}</span>
            {@html kitBar(pRow)}
            <span class="mini-name">{pRow.name.split(' ').slice(-1)[0]}</span>
            <span class="mini-pts">{pRow.pts}</span>
          </div>
        {/if}
      {/if}
      {#if divTotal > 7}
        <div class="mini-sep">···</div>
        {#each divTable.slice(divTotal - relCount) as row, i}
          {@const realPos = divTotal - relCount + i + 1}
          {@const pc = posColor(realPos)}
          <div class="mini-row" class:mini-player={row.id === 'player'}>
            <span class="mini-pos" style={pc ? `color:${pc}` : ''}>{realPos}</span>
            {@html kitBar(row)}
            <span class="mini-name">{row.name.split(' ').slice(-1)[0]}</span>
            <span class="mini-pts">{row.pts}</span>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>
{/if}

<style>
  /* ── Layout ──────────────────────────────────────────── */
  .match-layout {
    display: grid;
    grid-template-columns: 1fr 260px;
    height: calc(100vh - 44px);
    overflow: hidden;
  }

  .match-left {
    padding: 20px 24px 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
    border-right: 1px solid var(--border);
  }

  .match-right {
    padding: 16px;
    overflow-y: auto;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* ── Progress pips ───────────────────────────────────── */
  .pips { display: flex; gap: 4px; margin-bottom: 14px; }
  .pip {
    flex: 1; height: 4px; border-radius: 2px;
    background: var(--surface3);
    transition: background .2s;
  }
  .pip-done    { background: var(--green); }
  .pip-current { background: var(--gold); }

  /* ── Timer ───────────────────────────────────────────── */
  .timer-wrap   { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
  .timer-track  { flex: 1; height: 4px; background: rgba(255,255,255,.07); border-radius: 2px; overflow: hidden; }
  .timer-fill   { height: 100%; border-radius: 2px; }
  .timer-label  { font-family: var(--font-display); font-size: 14px; min-width: 28px; text-align: right; }

  /* ── Inline score ────────────────────────────────────── */
  .inline-score {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 4px;
    padding: 10px 14px; margin-bottom: 14px;
  }
  .inline-score-row { display: flex; align-items: center; gap: 8px; }
  .inline-club { font-size: 12px; color: var(--muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .inline-club.right { text-align: right; }
  .inline-digits { font-family: var(--font-display); font-size: 26px; letter-spacing: .04em; white-space: nowrap; flex-shrink: 0; }
  .inline-sep { color: var(--muted); margin: 0 3px; }
  .narrative { font-size: 12px; color: var(--text-dim); margin-top: 6px; font-style: italic; line-height: 1.4; }
  .narrative-goal     { color: var(--gold); margin-right: 4px; }
  .narrative-opp-goal { color: var(--red);  margin-right: 4px; }
  .scorers-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .scorer-chip { font-size: 10px; padding: 1px 6px; border-radius: 2px; }
  .scorer-player { background: rgba(212,168,71,.15); color: var(--gold); }
  .scorer-opp    { background: var(--surface3); color: var(--text-dim); }

  @keyframes pulse {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.06); }
    100% { transform: scale(1); }
  }
  .goal-pulse { animation: pulse .45s ease-out; }

  /* ── Question meta ───────────────────────────────────── */
  .q-meta-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .diff-badge { display: inline-block; padding: 2px 7px; border-radius: 2px; font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
  .q-counter  { font-size: 11px; color: var(--muted); }

  .question-text { font-size: 18px; font-weight: 500; line-height: 1.5; margin-bottom: 6px; }
  .question-hint { font-size: 12px; color: var(--muted); margin-bottom: 14px; font-style: italic; }

  /* ── Option buttons ──────────────────────────────────── */
  .options    { display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px; }
  .options-tf { flex-direction: row; gap: 10px; }

  .option-btn {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 3px;
    color: var(--text); font-family: var(--font-body); font-size: 14px; font-weight: 500;
    padding: 11px 14px; text-align: left; cursor: pointer;
    transition: border-color .1s, background .1s;
    display: flex; align-items: center; gap: 10px; width: 100%;
  }
  .option-btn:hover:not(:disabled):not(.reveal-correct):not(.reveal-wrong):not(.reveal-missed) {
    border-color: var(--gold-dim); background: rgba(255,255,255,.03);
  }
  .option-btn:disabled { cursor: default; }
  .option-btn.selected        { border-color: var(--gold);  background: rgba(212,168,71,.1); }
  .option-btn.reveal-correct  { border-color: var(--green); background: rgba(62,207,106,.1); }
  .option-btn.reveal-wrong    { border-color: var(--red);   background: rgba(224,82,82,.1); }
  .option-btn.reveal-missed   { border-color: var(--amber); background: rgba(232,153,74,.1); }
  .option-btn.selected .opt-label { color: var(--gold); }
  .option-btn.reveal-correct .opt-label { color: var(--green); }
  .option-btn.reveal-wrong   .opt-label { color: var(--red); }
  .option-btn.reveal-missed  .opt-label { color: var(--amber); }

  .opt-label { font-family: var(--font-display); font-size: 13px; color: var(--muted); min-width: 18px; flex-shrink: 0; transition: color .1s; }
  .opt-text  { flex: 1; line-height: 1.4; }
  .opt-check { margin-left: auto; width: 16px; height: 16px; border: 1px solid var(--border); border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; }
  .option-btn.selected .opt-check { background: var(--gold); border-color: var(--gold); color: #0a0a0c; }

  .tf-btn { flex: 1; justify-content: center; font-size: 20px; padding: 20px 14px; font-family: var(--font-display); letter-spacing: .06em; }

  /* ── Typed ───────────────────────────────────────────── */
  .typed-inputs { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
  .typed-row    { display: flex; align-items: center; gap: 8px; }
  .typed-num    { font-family: var(--font-display); font-size: 15px; color: var(--muted); min-width: 18px; text-align: right; flex-shrink: 0; }
  .typed-icon   { font-size: 15px; min-width: 18px; text-align: center; flex-shrink: 0; }
  .typed-field  {
    flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 3px;
    color: var(--text); font-family: var(--font-body); font-size: 15px; padding: 9px 12px;
    outline: none; transition: border-color .15s; width: 100%;
  }
  .typed-field:focus { border-color: var(--gold); }
  .typed-field:disabled { opacity: .7; cursor: default; }
  .typed-row.typed-correct .typed-field { border-color: var(--green); background: rgba(62,207,106,.1); }
  .typed-row.typed-wrong   .typed-field { border-color: var(--red);   background: rgba(224,82,82,.1); }
  .typed-accepted { font-size: 11px; color: var(--muted); margin-top: 4px; font-style: italic; line-height: 1.6; }
  .typed-accepted strong { color: var(--gold); margin-right: 4px; }

  /* ── Fill gap ────────────────────────────────────────── */
  .fill-gap-wrap     { margin-bottom: 14px; }
  .fill-gap-sentence { font-size: 18px; font-weight: 500; line-height: 2.4; }
  .gap-text          { vertical-align: middle; }
  .gap-input-wrap    { display: inline-block; vertical-align: middle; margin: 0 3px; }
  .gap-field {
    background: transparent; border: none; border-bottom: 2px solid var(--gold);
    color: var(--text); font-family: var(--font-body); font-size: 17px; font-weight: 600;
    padding: 2px 6px; outline: none; width: 120px; text-align: center;
    transition: border-color .15s, background .15s;
  }
  .gap-field:focus { background: rgba(212,168,71,.06); }
  .gap-field:disabled { opacity: .8; cursor: default; }
  .gap-input-wrap.gap-correct .gap-field { border-color: var(--green); background: rgba(62,207,106,.08); }
  .gap-input-wrap.gap-wrong   .gap-field { border-color: var(--red);   background: rgba(224,82,82,.08); }
  .gap-input-wrap.gap-missed  .gap-field { border-color: var(--amber); }

  /* ── Explanation ─────────────────────────────────────── */
  .explanation {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 3px;
    padding: 11px 14px; font-size: 13px; color: var(--text-dim); line-height: 1.6;
    margin-bottom: 14px;
  }

  /* ── Action row ──────────────────────────────────────── */
  .action-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; margin-top: auto; padding-top: 12px;
    border-top: 1px solid var(--surface2);
  }
  .selection-hint { font-size: 12px; color: var(--muted); }
  .result-hint    { font-size: 14px; font-weight: 600; }
  .btn-action { min-width: 130px; }

  /* ── Right sidebar ───────────────────────────────────── */
  .score-panel {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 4px;
    padding: 14px; text-align: center;
  }
  .score-label  { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
  .score-digits { font-family: var(--font-display); font-size: 44px; letter-spacing: .04em; line-height: 1; margin-bottom: 4px; }
  .score-sep    { color: var(--muted); font-size: 28px; margin: 0 4px; }
  .score-clubs  { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-top: 4px; }
  .score-club   { max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .score-club.right { text-align: right; }

  .scorers-list { margin-top: 8px; border-top: 1px solid var(--border); padding-top: 6px; }
  .scorer-entry { display: flex; gap: 6px; font-size: 11px; padding: 2px 0; }
  .scorer-min   { color: var(--muted); min-width: 24px; font-variant-numeric: tabular-nums; }

  .mini-table-wrap { flex: 1; }
  .mini-table-title { font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
  .mini-row {
    display: flex; align-items: center; gap: 6px; padding: 5px 0;
    border-bottom: 1px solid var(--surface2); font-size: 12px;
  }
  .mini-row:last-child { border-bottom: none; }
  .mini-row.mini-player { color: var(--gold); font-weight: 600; }
  .mini-pos  { font-size: 11px; color: var(--muted); min-width: 16px; text-align: right; flex-shrink: 0; }
  .mini-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mini-pts  { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--text-dim); min-width: 20px; text-align: right; }
  .mini-sep  { font-size: 11px; color: var(--muted); padding: 3px 0; text-align: center; }

  :global(.kit-bar) { display: inline-flex; width: 16px; height: 12px; border-radius: 2px; overflow: hidden; vertical-align: middle; flex-shrink: 0; }

  /* ── Buttons ─────────────────────────────────────────── */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; white-space: nowrap; }
  .btn:hover  { opacity: .85; }
  .btn:disabled { opacity: .35; cursor: not-allowed; }
  .btn-primary { background: var(--gold); color: #0a0a0c; }

  @media (max-width: 700px) {
    .match-layout { grid-template-columns: 1fr; }
    .match-right  { display: none; }
    .question-text { font-size: 16px; }
    .fill-gap-sentence { font-size: 15px; }
    .gap-field { width: 90px; font-size: 15px; }
    .options-tf { flex-direction: column; }
  }
</style>
