<!-- src/lib/golf/screens/HoleScreen.svelte -->
<!-- Main play screen: course map + golfer window + per-stroke phase panel. -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { state as gs } from '$lib/golf/state.svelte.js';
  import CourseScene from '$lib/golf/CourseScene.svelte';
  import GolferScene from '$lib/golf/GolferScene.svelte';
  import SwingMeter from '$lib/golf/SwingMeter.svelte';
  import { HOLES, holeYards } from '$lib/golf/holes.js';
  import { yardsToPin, meterMaxYd } from '$lib/golf/physics.js';
  import { scoreTypedInputs, scoreFillGapInputs } from '$lib/golf/questions.js';
  import { CLUBS, CLUB_BY_ID, DIFF_LABELS, DIFF_COLORS, LIE_LABELS, toParStr } from '$lib/golf/constants.js';

  const {
    onbeginstroke,        // () — overview → first question
    onlockanswer,         // (selectedOptions, typedInputs) — blind lock-in
    onaimchange,          // (angle)
    onclubchange,         // (clubId)
    onlockaim,            // () — aim → power
    onbacktoaim,          // () — power → aim
    onpowerlocked,        // (value 0..1) — resolves the shot
    onflightdone,         // () — ball animation finished
    onnextstroke,         // () — result → next question
    onsavequit,           // () — save and exit to menu
    saving = false,
  } = $props();

  // ── Derived hole/stroke state ─────────────────────────
  const ch     = $derived(gs.currentHole);
  const hole   = $derived(ch ? HOLES.find(h => h.num === ch.holeNum) : null);
  const phase  = $derived(ch?.phase || 'overview');
  const q      = $derived(ch?.pending?.q || null);
  const qtype  = $derived(q?.type || 'multi_select');
  const revealed = $derived(phase === 'result' || phase === 'flight');

  const distYd  = $derived(ch && hole ? Math.round(yardsToPin(ch.ball, hole)) : 0);
  const club    = $derived(ch?.aim?.clubId ? CLUB_BY_ID[ch.aim.clubId] : CLUBS[0]);
  const isPutt  = $derived(club?.id === 'putter');
  const meterYd = $derived(ch && hole && club ? meterMaxYd(club, ch.lie, ch.ball, hole) : 250);
  const onGreen = $derived(ch?.lie === 'green');
  const clubChoices = $derived(onGreen ? CLUBS.filter(c => c.id === 'putter') : CLUBS.filter(c => c.id !== 'putter'));

  let meterValue = $state(0);

  // ── Golfer animation selection ────────────────────────
  const golferAnim = $derived.by(() => {
    if (phase === 'power') return 'windup';
    if (phase === 'flight') {
      const ls = ch?.lastShot;
      if (ls?.duffed) return 'whiff';
      if (isPutt) return 'putt';
      return (ch?.power ?? 0) >= 0.45 ? 'swing_full' : 'swing_soft';
    }
    if (phase === 'result') {
      const ls = ch?.lastShot;
      if (ls?.holed) return 'celebrate';
      if (ls?.events?.some(e => e === 'water' || e === 'ob' || e === 'sand')) return 'frustrated';
      return 'idle';
    }
    return 'idle';
  });

  // ── Map props ─────────────────────────────────────────
  const aimVisible = $derived(phase === 'aim' || phase === 'power');
  const aimLenPx = $derived.by(() => {
    if (!hole || !ch) return 26;
    const full = meterYd / hole.scale;
    if (phase === 'power') return Math.max(6, full * Math.max(0.08, meterValue));
    return full;
  });

  // ── Question timer ────────────────────────────────────
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
      if (left <= 0) { clearTimer(); submitAnswer(); }
    }, 80);
  }
  function clearTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }
  const timerColor = $derived(
    timerPct < 0.25 ? 'var(--red)' : timerPct < 0.5 ? 'var(--amber)' : 'var(--gold)'
  );

  // ── Local answer input state ──────────────────────────
  let localSelected = $state([]);
  let typedInputs   = $state([]);

  // Reset inputs + timer when a new question arrives
  let _trackedQ = null;
  $effect(() => {
    const cur = ch?.pending?.q || null;
    if (cur !== _trackedQ) {
      _trackedQ = cur;
      localSelected = [];
      typedInputs   = [];
      if (cur && phase === 'question') startTimer();
      else clearTimer();
    }
  });

  onDestroy(clearTimer);

  function toggleOption(idx) {
    if (phase !== 'question') return;
    if (qtype === 'multiple_choice' || qtype === 'true_false') {
      localSelected = [idx];
    } else {
      const pos = localSelected.indexOf(idx);
      if (pos >= 0) localSelected = localSelected.filter((_, i) => i !== pos);
      else          localSelected = [...localSelected, idx];
    }
  }

  const canSubmit = $derived(
    qtype === 'typed' || qtype === 'fill_gap'
      ? typedInputs.some(v => (v || '').trim())
      : localSelected.length > 0
  );

  function submitAnswer() {
    if (phase !== 'question') return;
    clearTimer();
    onlockanswer?.(localSelected, typedInputs);
  }

  // ── Reveal helpers (result phase) ─────────────────────
  const revealSelected = $derived(ch?.pending?.selected || []);
  const revealTyped    = $derived(ch?.pending?.typed || []);

  function optionState(idx) {
    if (phase !== 'result' || !q) return 'default';
    const cor = new Set(q.answers).has(idx);
    const sel = revealSelected.includes(idx);
    if (sel && cor)  return 'correct';
    if (sel && !cor) return 'wrong';
    if (!sel && cor) return 'missed';
    return 'default';
  }

  const typedCorrect = $derived(
    phase === 'result' && q && (qtype === 'typed' || qtype === 'fill_gap')
      ? (qtype === 'typed' ? scoreTypedInputs(q, revealTyped) : scoreFillGapInputs(q, revealTyped))
      : new Set()
  );

  const gapParts = $derived(
    qtype === 'fill_gap' && q?.template ? q.template.split('___') : []
  );

  const hint = $derived((() => {
    if (!q) return '';
    if (qtype === 'true_false')      return 'True or False?';
    if (qtype === 'multiple_choice') return 'Select one answer.';
    if (qtype === 'typed')           return `Name ${q.required_count ?? q.answers?.length ?? 1} answer${(q.required_count ?? 1) > 1 ? 's' : ''}.`;
    if (qtype === 'fill_gap')        return 'Fill in the blanks.';
    return q.answers?.length === 1 ? 'Select one answer.' : 'Select all that apply.';
  })());

  // ── Reveal banner ─────────────────────────────────────
  const banner = $derived.by(() => {
    const p = ch?.pending;
    if (!p) return null;
    const err = ch?.lastShot?.errDeg ?? 0;
    const dir = err > 1.5 ? ' — pushed right' : err < -1.5 ? ' — pulled left' : '';
    if (p.ratio >= 1)  return { cls: 'ok',   text: '✓ Correct — pure strike!' };
    if (p.ratio > 0)   return { cls: 'mid',  text: `◐ Partially correct${dir}` };
    return { cls: 'bad', text: `✗ Wrong${dir || ' — wild swing'}` };
  });

  // ── Shot outcome lines (result phase) ─────────────────
  const outcome = $derived.by(() => {
    const ls = ch?.lastShot;
    if (!ls) return [];
    const lines = [];
    if (ls.holed) {
      lines.push({ icon: '⛳', text: 'In the hole!', cls: 'ok' });
      return lines;
    }
    lines.push({ icon: '🏌️', text: `${Math.round(ls.travelYd)} yd ${isPutt ? 'putt' : 'shot'} — now ${LIE_LABELS[ch.lie] || ch.lie}, ${distYd} yd to the pin` });
    if (ls.events.includes('water')) lines.push({ icon: '💧', text: 'Water hazard — +1 penalty stroke, ball dropped', cls: 'bad' });
    if (ls.events.includes('ob'))    lines.push({ icon: '🚫', text: 'Out of bounds — +1 penalty, replay from previous spot', cls: 'bad' });
    if (ls.events.includes('trees')) lines.push({ icon: '🌲', text: 'Caught the trees — ball dropped under the canopy', cls: 'bad' });
    if (ls.events.includes('sand'))  lines.push({ icon: '🏖️', text: 'In the bunker — next question will be harder', cls: 'warn' });
    if (ls.duffed) lines.push({ icon: '💢', text: 'Duffed it — the wrong answer cost you distance', cls: 'bad' });
    return lines;
  });

  // ── Keyboard ──────────────────────────────────────────
  function onKeydown(e) {
    if (!ch) return;
    if (phase === 'question') {
      const isText = qtype === 'typed' || qtype === 'fill_gap';
      if (!isText && (qtype === 'multiple_choice' || qtype === 'true_false')) {
        const idx = parseInt(e.key) - 1;
        if (!isNaN(idx) && q?.options && idx >= 0 && idx < q.options.length) {
          e.preventDefault(); toggleOption(idx);
        }
      }
      if (e.key === 'Enter' && !isText && canSubmit) { e.preventDefault(); submitAnswer(); }
    } else if (phase === 'aim') {
      const step = (e.shiftKey ? 5 : 1) * Math.PI / 180;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')    { e.preventDefault(); onaimchange?.(ch.aim.angle - step); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onaimchange?.(ch.aim.angle + step); }
      if (e.key === 'Enter') { e.preventDefault(); onlockaim?.(); }
    } else if (phase === 'result' && e.key === 'Enter') {
      if (e.target.tagName === 'INPUT') return;
      e.preventDefault(); onnextstroke?.();
    } else if (phase === 'overview' && e.key === 'Enter') {
      e.preventDefault(); onbeginstroke?.();
    }
  }

  const tierOf = $derived(ch?.pending?.tier || q?._tier || 'medium');
</script>

<svelte:window onkeydown={onKeydown} />

{#if ch && hole}
<div class="hole-layout">

  <!-- HUD bar -->
  <div class="hud">
    <div class="hud-left">
      <span class="hud-hole">Hole {ch.displayNum ?? hole.num}</span>
      <span class="hud-sub">Par {hole.par} · {holeYards(hole)} yd</span>
    </div>
    <div class="hud-mid">
      <span class="hud-stat"><span class="hud-label">Strokes</span> {ch.strokes}</span>
      <span class="hud-stat"><span class="hud-label">Round</span> {toParStr(gs.round?.toPar ?? 0)}</span>
    </div>
    <div class="hud-right">
      <span class="lie-badge lie-{ch.lie}">{LIE_LABELS[ch.lie] || ch.lie}</span>
      <span class="hud-sub">{distYd} yd to pin</span>
    </div>
  </div>

  <!-- Course map -->
  <CourseScene
    {hole}
    ball={ch.ball}
    aimAngle={aimVisible ? ch.aim?.angle ?? null : null}
    {aimLenPx}
    aiming={phase === 'aim'}
    onaim={(a) => onaimchange?.(a)}
    anim={ch.shotAnim || null}
    onanimdone={() => onflightdone?.()}
  />

  <!-- Bottom: golfer + phase panel -->
  <div class="bottom-row">
    <div class="golfer-col">
      <GolferScene anim={golferAnim} {meterValue} />
    </div>

    <div class="panel">

      {#if phase === 'overview'}
        <div class="panel-title">{hole.name}</div>
        <p class="panel-text">
          Par {hole.par}, {holeYards(hole)} yards.
          Answer well to hit your line — answer badly and the ball goes where it wants.
        </p>
        <div class="panel-actions">
          <button class="btn btn-ghost btn-sm" onclick={onsavequit} disabled={saving}>
            {saving ? 'Saving…' : 'Save & Quit'}
          </button>
          <button class="btn btn-primary" onclick={onbeginstroke}>Step Up →</button>
        </div>

      {:else if phase === 'question' && q}
        <div class="q-meta-row">
          <span class="diff-badge" style="background:{DIFF_COLORS[tierOf] + '22'};color:{DIFF_COLORS[tierOf]}">
            {DIFF_LABELS[tierOf]}
          </span>
          {#if ch.pending?.bumped}
            <span class="bump-note">⚠ {ch.pending.bumped}</span>
          {/if}
        </div>

        <div class="timer-wrap">
          <div class="timer-track">
            <div class="timer-fill" style="width:{timerPct * 100}%;background:{timerColor};transition:width .08s linear,background .3s"></div>
          </div>
          <span class="timer-label" style="color:{timerColor}">{Math.ceil(timerLeft)}s</span>
        </div>

        {#if qtype !== 'fill_gap'}
          <p class="question-text">{q.question}</p>
        {/if}
        <p class="question-hint">{hint}</p>

        {#if qtype === 'multi_select' || qtype === 'multiple_choice' || qtype === 'true_false'}
          <div class="options" class:options-tf={qtype === 'true_false'}>
            {#each q.options as opt, idx}
              <button
                class="option-btn"
                class:selected={localSelected.includes(idx)}
                class:tf-btn={qtype === 'true_false'}
                onclick={() => toggleOption(idx)}
              >
                {#if qtype !== 'true_false'}<span class="opt-label">{String.fromCharCode(65 + idx)}</span>{/if}
                <span class="opt-text">{opt}</span>
                {#if qtype !== 'true_false'}
                  <span class="opt-check">{localSelected.includes(idx) ? '✓' : ''}</span>
                {/if}
              </button>
            {/each}
          </div>
        {:else if qtype === 'typed'}
          {@const count = q.required_count ?? q.answers?.length ?? 1}
          <div class="typed-inputs">
            {#each Array(count) as _, i}
              <div class="typed-row">
                <span class="typed-num">{i + 1}</span>
                <input
                  class="typed-field" type="text" placeholder="Your answer…"
                  value={typedInputs[i] || ''}
                  oninput={e => { const arr = [...typedInputs]; arr[i] = e.target.value; typedInputs = arr; }}
                  onkeydown={e => {
                    if (e.key !== 'Enter') return;
                    e.stopPropagation();
                    const next = document.querySelectorAll('.typed-field')[i + 1];
                    if (next) next.focus(); else submitAnswer();
                  }}
                />
              </div>
            {/each}
          </div>
        {:else if qtype === 'fill_gap'}
          <p class="question-text">{q.question}</p>
          <div class="fill-gap-wrap">
            <div class="fill-gap-sentence">
              {#each gapParts as part, i}
                <span class="gap-text">{part}</span>
                {#if i < gapParts.length - 1}
                  <span class="gap-input-wrap">
                    <input
                      class="gap-field" type="text" placeholder="___"
                      value={typedInputs[i] || ''}
                      oninput={e => { const arr = [...typedInputs]; arr[i] = e.target.value; typedInputs = arr; }}
                      onkeydown={e => {
                        if (e.key !== 'Enter') return;
                        e.stopPropagation();
                        const next = document.querySelectorAll('.gap-field')[i + 1];
                        if (next) next.focus(); else submitAnswer();
                      }}
                    />
                  </span>
                {/if}
              {/each}
            </div>
          </div>
        {/if}

        <div class="panel-actions">
          <span class="selection-hint">Answer locks in blind — you'll see if you were right when you swing.</span>
          <button class="btn btn-primary" disabled={!canSubmit} onclick={submitAnswer}>Lock In</button>
        </div>

      {:else if phase === 'aim'}
        <div class="panel-title">Aim Your Shot</div>
        <p class="panel-text">Drag on the map or use ← → arrow keys to set your line. {distYd} yd to the pin.</p>

        <div class="club-row">
          {#each clubChoices as c}
            <button
              class="club-btn"
              class:club-active={c.id === ch.aim?.clubId}
              onclick={() => onclubchange?.(c.id)}
              title="{c.label} — up to {Math.round(c.maxCarry)} yd"
            >
              <span class="club-short">{c.short}</span>
              <span class="club-yd">{c.id === 'putter' ? 'green' : c.maxCarry}</span>
            </button>
          {/each}
        </div>

        <div class="panel-actions">
          <span class="selection-hint">{club?.label} · up to {Math.round(meterYd)} yd from this lie</span>
          <button class="btn btn-primary" onclick={onlockaim}>Lock Aim →</button>
        </div>

      {:else if phase === 'power'}
        <div class="panel-title">{isPutt ? 'Stroke Power' : 'Swing Power'}</div>
        <SwingMeter
          active={true}
          maxYd={meterYd}
          {isPutt}
          bind:value={meterValue}
          onlock={(v) => onpowerlocked?.(v)}
        />
        <div class="panel-actions">
          <button class="btn btn-ghost btn-sm" onclick={onbacktoaim}>← Back to Aim</button>
        </div>

      {:else if phase === 'flight'}
        {#if banner}
          <div class="reveal-banner reveal-{banner.cls}">{banner.text}</div>
        {/if}
        <p class="panel-text flight-text">The ball is away…</p>

      {:else if phase === 'result'}
        {#if banner}
          <div class="reveal-banner reveal-{banner.cls}">{banner.text}</div>
        {/if}

        <div class="outcome">
          {#each outcome as line}
            <div class="outcome-line outcome-{line.cls || 'plain'}">
              <span class="outcome-icon">{line.icon}</span>{line.text}
            </div>
          {/each}
        </div>

        {#if q && (qtype === 'multi_select' || qtype === 'multiple_choice' || qtype === 'true_false')}
          <div class="options options-compact" class:options-tf={qtype === 'true_false'}>
            {#each q.options as opt, idx}
              {@const st = optionState(idx)}
              <button
                class="option-btn option-compact"
                class:reveal-correct={st === 'correct'}
                class:reveal-wrong={st === 'wrong'}
                class:reveal-missed={st === 'missed'}
                disabled
              >
                {#if qtype !== 'true_false'}<span class="opt-label">{String.fromCharCode(65 + idx)}</span>{/if}
                <span class="opt-text">{opt}</span>
              </button>
            {/each}
          </div>
        {:else if q}
          <div class="typed-accepted">
            <strong>Answers:</strong> {(q.answers || []).join(' · ')}
          </div>
        {/if}

        {#if q?.explanation}
          <div class="explanation">{q.explanation}</div>
        {/if}

        <div class="panel-actions">
          <button class="btn btn-ghost btn-sm" onclick={onsavequit} disabled={saving}>
            {saving ? 'Saving…' : 'Save & Quit'}
          </button>
          <button class="btn btn-primary" onclick={onnextstroke}>Next Shot →</button>
        </div>
      {/if}

    </div>
  </div>
</div>
{/if}

<style>
  .hole-layout {
    max-width: 576px; margin: 0 auto; padding: 12px 16px 24px;
    display: flex; flex-direction: column; gap: 10px;
  }

  /* ── HUD ─────────────────────────────────────────────── */
  .hud {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
    padding: 8px 14px;
  }
  .hud-left, .hud-right { display: flex; flex-direction: column; gap: 1px; }
  .hud-right { align-items: flex-end; }
  .hud-mid { display: flex; gap: 16px; }
  .hud-hole { font-family: var(--font-display); font-size: 20px; letter-spacing: .04em; }
  .hud-sub  { font-size: 11px; color: var(--muted); }
  .hud-stat { font-family: var(--font-display); font-size: 18px; display: flex; flex-direction: column; align-items: center; line-height: 1.2; }
  .hud-label { font-family: var(--font-body); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }

  .lie-badge {
    display: inline-block; padding: 2px 8px; border-radius: 2px;
    font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
    background: var(--surface2); color: var(--text-dim);
  }
  .lie-badge.lie-fairway, .lie-badge.lie-tee { background: rgba(62,207,106,.15); color: var(--green); }
  .lie-badge.lie-green { background: rgba(126,216,126,.18); color: #7ed87e; }
  .lie-badge.lie-sand  { background: rgba(224,200,130,.15); color: #e0c882; }
  .lie-badge.lie-rough { background: rgba(232,153,74,.12); color: var(--amber); }
  .lie-badge.lie-trees { background: rgba(224,82,82,.12); color: var(--red); }

  /* ── Bottom row ──────────────────────────────────────── */
  .bottom-row { display: grid; grid-template-columns: 168px 1fr; gap: 10px; align-items: start; }
  .golfer-col { position: sticky; top: 56px; }

  .panel {
    background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
    padding: 14px 16px; min-height: 168px;
    display: flex; flex-direction: column;
  }
  .panel-title { font-family: var(--font-display); font-size: 18px; letter-spacing: .04em; margin-bottom: 6px; }
  .panel-text  { font-size: 13px; color: var(--text-dim); line-height: 1.5; margin-bottom: 12px; }
  .flight-text { font-style: italic; }

  .panel-actions {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    margin-top: auto; padding-top: 12px; border-top: 1px solid var(--surface2);
  }
  .panel-actions > .btn:only-child { margin-left: auto; }
  .selection-hint { font-size: 11px; color: var(--muted); line-height: 1.4; }

  /* ── Question UI (mirrors MatchScreen styling) ───────── */
  .q-meta-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .diff-badge { display: inline-block; padding: 2px 7px; border-radius: 2px; font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
  .bump-note  { font-size: 10px; color: var(--amber); letter-spacing: .04em; text-transform: uppercase; }

  .timer-wrap   { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .timer-track  { flex: 1; height: 4px; background: rgba(255,255,255,.07); border-radius: 2px; overflow: hidden; }
  .timer-fill   { height: 100%; border-radius: 2px; }
  .timer-label  { font-family: var(--font-display); font-size: 14px; min-width: 28px; text-align: right; }

  .question-text { font-size: 16px; font-weight: 500; line-height: 1.45; margin-bottom: 4px; }
  .question-hint { font-size: 11px; color: var(--muted); margin-bottom: 12px; font-style: italic; }

  .options    { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  .options-tf { flex-direction: row; gap: 8px; }
  .option-btn {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 3px;
    color: var(--text); font-family: var(--font-body); font-size: 13px; font-weight: 500;
    padding: 9px 12px; text-align: left; cursor: pointer;
    transition: border-color .1s, background .1s;
    display: flex; align-items: center; gap: 9px; width: 100%;
  }
  .option-btn:hover:not(:disabled) { border-color: var(--gold-dim); background: rgba(255,255,255,.03); }
  .option-btn:disabled { cursor: default; }
  .option-btn.selected        { border-color: var(--gold);  background: rgba(212,168,71,.1); }
  .option-btn.reveal-correct  { border-color: var(--green); background: rgba(62,207,106,.1); }
  .option-btn.reveal-wrong    { border-color: var(--red);   background: rgba(224,82,82,.1); }
  .option-btn.reveal-missed   { border-color: var(--amber); background: rgba(232,153,74,.1); }
  .option-compact { padding: 6px 10px; font-size: 12px; }
  .opt-label { font-family: var(--font-display); font-size: 12px; color: var(--muted); min-width: 16px; flex-shrink: 0; }
  .opt-text  { flex: 1; line-height: 1.35; }
  .opt-check { margin-left: auto; width: 15px; height: 15px; border: 1px solid var(--border); border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 9px; flex-shrink: 0; }
  .option-btn.selected .opt-check { background: var(--gold); border-color: var(--gold); color: #0a0a0c; }
  .tf-btn { flex: 1; justify-content: center; font-size: 17px; padding: 14px 12px; font-family: var(--font-display); letter-spacing: .06em; }

  .typed-inputs { display: flex; flex-direction: column; gap: 7px; margin-bottom: 12px; }
  .typed-row    { display: flex; align-items: center; gap: 8px; }
  .typed-num    { font-family: var(--font-display); font-size: 14px; color: var(--muted); min-width: 16px; text-align: right; flex-shrink: 0; }
  .typed-field  {
    flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 3px;
    color: var(--text); font-family: var(--font-body); font-size: 14px; padding: 8px 11px;
    outline: none; transition: border-color .15s; width: 100%;
  }
  .typed-field:focus { border-color: var(--gold); }
  .typed-accepted { font-size: 11px; color: var(--muted); margin-bottom: 10px; font-style: italic; line-height: 1.6; }
  .typed-accepted strong { color: var(--gold); margin-right: 4px; }

  .fill-gap-wrap     { margin-bottom: 12px; }
  .fill-gap-sentence { font-size: 15px; font-weight: 500; line-height: 2.3; }
  .gap-text          { vertical-align: middle; }
  .gap-input-wrap    { display: inline-block; vertical-align: middle; margin: 0 3px; }
  .gap-field {
    background: transparent; border: none; border-bottom: 2px solid var(--gold);
    color: var(--text); font-family: var(--font-body); font-size: 15px; font-weight: 600;
    padding: 2px 6px; outline: none; width: 110px; text-align: center;
  }
  .gap-field:focus { background: rgba(212,168,71,.06); }

  .explanation {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 3px;
    padding: 10px 12px; font-size: 12px; color: var(--text-dim); line-height: 1.55;
    margin-bottom: 10px;
  }

  /* ── Club selector ───────────────────────────────────── */
  .club-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .club-btn {
    display: flex; flex-direction: column; align-items: center; gap: 1px;
    background: var(--surface2); border: 1px solid var(--border); border-radius: 3px;
    color: var(--text-dim); padding: 6px 10px; cursor: pointer; min-width: 48px;
    transition: border-color .1s, background .1s;
  }
  .club-btn:hover { border-color: var(--gold-dim); }
  .club-btn.club-active { border-color: var(--gold); background: rgba(212,168,71,.1); color: var(--gold); }
  .club-short { font-family: var(--font-display); font-size: 15px; letter-spacing: .04em; }
  .club-yd    { font-size: 9px; color: var(--muted); }

  /* ── Reveal banner / outcome ─────────────────────────── */
  .reveal-banner {
    font-family: var(--font-display); font-size: 19px; letter-spacing: .04em;
    padding: 9px 14px; border-radius: 3px; margin-bottom: 10px;
  }
  .reveal-ok  { background: rgba(62,207,106,.12); color: var(--green); border: 1px solid rgba(62,207,106,.3); }
  .reveal-mid { background: rgba(232,153,74,.12); color: var(--amber); border: 1px solid rgba(232,153,74,.3); }
  .reveal-bad { background: rgba(224,82,82,.12);  color: var(--red);   border: 1px solid rgba(224,82,82,.3); }

  .outcome { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
  .outcome-line { font-size: 13px; color: var(--text-dim); line-height: 1.45; }
  .outcome-icon { margin-right: 6px; }
  .outcome-ok   { color: var(--green); font-weight: 600; }
  .outcome-bad  { color: var(--red); }
  .outcome-warn { color: var(--amber); }

  /* ── Buttons ─────────────────────────────────────────── */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; white-space: nowrap; }
  .btn:hover  { opacity: .85; }
  .btn:disabled { opacity: .35; cursor: not-allowed; }
  .btn-primary { background: var(--gold); color: #0a0a0c; }
  .btn-ghost   { background: transparent; color: var(--text-dim); border: 1px solid var(--border); }
  .btn-sm      { padding: 6px 12px; font-size: 11px; }

  @media (max-width: 560px) {
    .bottom-row { grid-template-columns: 1fr; }
    .golfer-col { position: static; display: flex; justify-content: center; }
    .golfer-col :global(.golfer-canvas) { max-width: 160px; }
    .options-tf { flex-direction: column; }
  }
</style>
