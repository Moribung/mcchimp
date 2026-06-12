<!-- src/lib/golf/screens/HoleScreen.svelte -->
<!-- MMA-style split layout: hole map + question on the left (bigger),
     player window + score tracking + hole info on the right. -->
<script>
  import { onDestroy } from 'svelte';
  import { state as gs } from '$lib/golf/state.svelte.js';
  import CourseScene from '$lib/golf/CourseScene.svelte';
  import GolferScene from '$lib/golf/GolferScene.svelte';
  import SwingMeter from '$lib/golf/SwingMeter.svelte';
  import { HOLES, holeYards } from '$lib/golf/holes.js';
  import { yardsToPin, meterMaxYd } from '$lib/golf/physics.js';
  import { scoreTypedInputs, scoreFillGapInputs } from '$lib/golf/questions.js';
  import { CLUBS, CLUB_BY_ID, DIFF_LABELS, DIFF_COLORS, LIE_LABELS, parLabel, toParStr } from '$lib/golf/constants.js';
  import { isAdvanceKey } from '$lib/uiKeys.js';

  const {
    onbeginstroke, onlockanswer, onaimchange, onclubchange, onlockaim,
    onbacktoaim, onpowerlocked, onflightdone, onnextstroke, onwrapup, onsavequit,
    saving = false,
  } = $props();

  const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  // ── Derived hole/stroke state ─────────────────────────
  const ch     = $derived(gs.currentHole);
  const hole   = $derived(ch ? HOLES.find(h => h.num === ch.holeNum) : null);
  const phase  = $derived(ch?.phase || 'overview');
  const q      = $derived(ch?.pending?.q || null);
  const qtype  = $derived(q?.type || 'multi_select');

  const distYd  = $derived(ch && hole ? Math.round(yardsToPin(ch.ball, hole)) : 0);
  const club    = $derived(ch?.aim?.clubId ? CLUB_BY_ID[ch.aim.clubId] : CLUBS[0]);
  const isPutt  = $derived(club?.id === 'putter');
  const meterYd = $derived(ch && hole && club ? meterMaxYd(club, ch.lie, ch.ball, hole) : 250);
  const onGreen = $derived(ch?.lie === 'green');
  const clubChoices = $derived(onGreen ? CLUBS.filter(c => c.id === 'putter') : CLUBS.filter(c => c.id !== 'putter'));

  const holeCount = $derived(gs.course?.holeCount ?? 9);

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
    if (phase === 'power') {
      // Putts use a tiny floor so short strokes preview accurately (the green is
      // zoomed in, so even a fraction of a px is visible); full shots keep a
      // larger floor so the arrow stays readable at the un-zoomed scale.
      const frac  = isPutt ? meterValue : Math.max(0.08, meterValue);
      const minPx = isPutt ? 0.5 : 6;
      return Math.max(minPx, full * frac);
    }
    return full;
  });

  // ── Question timer ────────────────────────────────────
  const TIMER_SECS = 30;
  let timerLeft  = $state(TIMER_SECS);
  let timerPct   = $state(1);
  let timerHandle = null;
  let timerStart = 0;

  function startTimer() {
    clearTimer();
    timerLeft = TIMER_SECS;
    timerPct  = 1;
    timerStart = Date.now();
    timerHandle = setInterval(() => {
      const left = Math.max(0, TIMER_SECS - (Date.now() - timerStart) / 1000);
      timerLeft = left;
      timerPct  = left / TIMER_SECS;
      if (left <= 0) { clearTimer(); submitAnswer(); }
    }, 80);
  }
  function clearTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }
  const timerColor = $derived(
    timerPct < 0.3 ? 'var(--red)' : timerPct < 0.6 ? 'var(--amber)' : 'var(--accent)'
  );

  // ── Local answer input state ──────────────────────────
  let localSelected = $state([]);
  let typedInputs   = $state([]);

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
    const pctUsed = timerStart ? Math.min(1, (Date.now() - timerStart) / 1000 / TIMER_SECS) : 1;
    clearTimer();
    onlockanswer?.(localSelected, typedInputs, pctUsed);
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
    return { cls: 'bad', text: `✗ Wrong${ch?.lastShot?.wild ? ' — wild miss!' : dir || ' — wild swing'}` };
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

  const tierOf = $derived(ch?.pending?.tier || q?._tier || 'medium');

  // ── Mini scorecard ────────────────────────────────────
  const scorecard = $derived(gs.round?.scorecard || []);
  function diffClass(strokes, par) {
    const d = strokes - par;
    return d < 0 ? 'under' : d === 0 ? 'even' : 'over';
  }

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
      if (isAdvanceKey(e) && !isText && canSubmit) { e.preventDefault(); submitAnswer(); }
    } else if (phase === 'aim') {
      const step = (e.shiftKey ? 5 : 1) * Math.PI / 180;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')    { e.preventDefault(); onaimchange?.(ch.aim.angle - step); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onaimchange?.(ch.aim.angle + step); }
      if (isAdvanceKey(e)) { e.preventDefault(); onlockaim?.(); }
    } else if (phase === 'result' && isAdvanceKey(e)) {
      e.preventDefault();
      if (ch.lastShot?.holed) onwrapup?.(); else onnextstroke?.();
    } else if (phase === 'overview' && isAdvanceKey(e)) {
      e.preventDefault(); onbeginstroke?.();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if ch && hole}
<div class="hole-grid" class:in-shot={aimVisible || phase === 'flight'}>

  <!-- ═══ LEFT: map + question/phase panel ═══ -->
  <div class="hole-main">
    <div class="map-frame">
      <CourseScene
        {hole}
        ball={ch.ball}
        aimAngle={aimVisible ? ch.aim?.angle ?? null : null}
        {aimLenPx}
        aiming={phase === 'aim'}
        onaim={(a) => onaimchange?.(a)}
        anim={ch.shotAnim || null}
        onanimdone={() => onflightdone?.()}
        zoom={onGreen}
        holed={!!ch.lastShot?.holed}
      />
    </div>

    <div class="phase-panel">
      {#if phase === 'overview'}
        <div class="panel-title">{hole.name}</div>
        <p class="panel-text">
          Par {hole.par}, {holeYards(hole)} yards. Answer well to hit your line —
          answer badly and the ball goes where it wants. Answer fast for a power boost.
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
          {#if ch.pending?.bumped}<span class="bump-note">⚠ {ch.pending.bumped}</span>{/if}
        </div>

        <div class="timer-wrap">
          <div class="timer-track">
            <div class="timer-fill" style="width:{timerPct * 100}%;background:{timerColor};transition:width .08s linear,background .3s"></div>
          </div>
          <span class="timer-label" style="color:{timerColor}">{Math.ceil(timerLeft)}s</span>
        </div>

        {#if qtype !== 'fill_gap'}<p class="question-text">{q.question}</p>{/if}
        <p class="question-hint">{hint}</p>

        {#if qtype === 'multi_select' || qtype === 'multiple_choice' || qtype === 'true_false'}
          <div class="options" class:options-tf={qtype === 'true_false'}>
            {#each q.options as opt, idx}
              <button class="option-btn" class:selected={localSelected.includes(idx)} class:tf-btn={qtype === 'true_false'} onclick={() => toggleOption(idx)}>
                {#if qtype !== 'true_false'}<span class="opt-label">{LABELS[idx]}</span>{/if}
                <span class="opt-text">{opt}</span>
                {#if qtype !== 'true_false'}<span class="opt-check">{localSelected.includes(idx) ? '✓' : ''}</span>{/if}
              </button>
            {/each}
          </div>
        {:else if qtype === 'typed'}
          {@const count = q.required_count ?? q.answers?.length ?? 1}
          <div class="typed-inputs">
            {#each Array(count) as _, i}
              <div class="typed-row">
                <span class="typed-num">{i + 1}</span>
                <input class="typed-field" type="text" placeholder="Your answer…"
                  value={typedInputs[i] || ''}
                  oninput={e => { const arr = [...typedInputs]; arr[i] = e.target.value; typedInputs = arr; }}
                  onkeydown={e => { if (e.key !== 'Enter') return; e.stopPropagation(); const n = document.querySelectorAll('.typed-field')[i + 1]; if (n) n.focus(); else submitAnswer(); }} />
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
                    <input class="gap-field" type="text" placeholder="___"
                      value={typedInputs[i] || ''}
                      oninput={e => { const arr = [...typedInputs]; arr[i] = e.target.value; typedInputs = arr; }}
                      onkeydown={e => { if (e.key !== 'Enter') return; e.stopPropagation(); const n = document.querySelectorAll('.gap-field')[i + 1]; if (n) n.focus(); else submitAnswer(); }} />
                  </span>
                {/if}
              {/each}
            </div>
          </div>
        {/if}

        <div class="panel-actions">
          <span class="selection-hint">Locks in blind — you'll see the result when you swing.</span>
          <button class="btn btn-primary" disabled={!canSubmit} onclick={submitAnswer}>Lock In</button>
        </div>

      {:else if phase === 'aim'}
        <div class="panel-title">Aim Your Shot</div>
        <p class="panel-text">Drag on the map or use ← → arrows to set your line. {distYd} yd to the pin.</p>
        <div class="club-row">
          {#each clubChoices as c}
            <button class="club-btn" class:club-active={c.id === ch.aim?.clubId}
              onclick={() => onclubchange?.(c.id)} title="{c.label} — up to {Math.round(c.maxCarry)} yd">
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
        <SwingMeter active={true} maxYd={meterYd} {isPutt} bind:value={meterValue} onlock={(v) => onpowerlocked?.(v)} />
        <div class="panel-actions">
          <button class="btn btn-ghost btn-sm" onclick={onbacktoaim}>← Back to Aim</button>
        </div>

      {:else if phase === 'flight'}
        {#if banner}<div class="reveal-banner reveal-{banner.cls}">{banner.text}</div>{/if}
        <p class="panel-text flight-text">The ball is away…</p>

      {:else if phase === 'result'}
        {#if banner}<div class="reveal-banner reveal-{banner.cls}">{banner.text}</div>{/if}
        <div class="outcome">
          {#each outcome as line}
            <div class="outcome-line outcome-{line.cls || 'plain'}"><span class="outcome-icon">{line.icon}</span>{line.text}</div>
          {/each}
        </div>

        {#if q && (qtype === 'multi_select' || qtype === 'multiple_choice' || qtype === 'true_false')}
          <div class="options options-compact" class:options-tf={qtype === 'true_false'}>
            {#each q.options as opt, idx}
              {@const st = optionState(idx)}
              <button class="option-btn option-compact" class:reveal-correct={st === 'correct'} class:reveal-wrong={st === 'wrong'} class:reveal-missed={st === 'missed'} disabled>
                {#if qtype !== 'true_false'}<span class="opt-label">{LABELS[idx]}</span>{/if}
                <span class="opt-text">{opt}</span>
              </button>
            {/each}
          </div>
        {:else if q}
          <div class="typed-accepted"><strong>Answers:</strong> {(q.answers || []).join(' · ')}</div>
        {/if}

        {#if q?.explanation}<div class="explanation">{q.explanation}</div>{/if}

        <div class="panel-actions">
          {#if ch.lastShot?.holed}
            <button class="btn btn-primary" onclick={onwrapup}>Wrap Up the Hole →</button>
          {:else}
            <button class="btn btn-ghost btn-sm" onclick={onsavequit} disabled={saving}>{saving ? 'Saving…' : 'Save & Quit'}</button>
            <button class="btn btn-primary" onclick={onnextstroke}>Next Shot →</button>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- ═══ RIGHT: player window + score tracking ═══ -->
  <aside class="hole-side">
    <div class="side-hole-head">
      <div class="shh-num">Hole {ch.displayNum ?? hole.num} <span class="shh-of">/ {holeCount}</span></div>
      <div class="shh-name">{hole.name}</div>
      <div class="shh-sub">Par {hole.par} · {holeYards(hole)} yd</div>
    </div>

    <div class="side-stats">
      <div class="ss-cell"><span class="ss-num">{ch.strokes}</span><span class="ss-lab">Strokes</span></div>
      <div class="ss-cell"><span class="ss-num">{distYd}</span><span class="ss-lab">Yd to pin</span></div>
      <div class="ss-cell"><span class="ss-num" style="color:{(gs.round?.toPar ?? 0) < 0 ? 'var(--green)' : (gs.round?.toPar ?? 0) > 0 ? 'var(--red)' : 'var(--accent)'}">{toParStr(gs.round?.toPar ?? 0)}</span><span class="ss-lab">Round</span></div>
    </div>

    <div class="side-lie">
      <span class="lie-badge lie-{ch.lie}">{LIE_LABELS[ch.lie] || ch.lie}</span>
    </div>

    <div class="golfer-frame"><GolferScene anim={golferAnim} {meterValue} colors={gs.career?.avatar} /></div>

    {#if scorecard.length}
      <div class="side-card">
        <div class="sc-title">Scorecard</div>
        <div class="sc-rows">
          {#each scorecard as h}
            <div class="sc-chip {diffClass(h.strokes, h.par)}" title="Hole {h.num}: {parLabel(h.strokes, h.par)}">
              <span class="sc-h">{h.num}</span><span class="sc-s">{h.strokes}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <button class="btn btn-ghost btn-full btn-sm side-quit" onclick={onsavequit} disabled={saving}>
      {saving ? 'Saving…' : 'Save & Quit'}
    </button>
  </aside>
</div>
{/if}

<style>
  .hole-grid {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 20px;
    max-width: 1180px;
    margin: 0 auto;
    padding: 20px 24px 40px;
    align-items: start;
  }

  /* ── Left column ─────────────────────────────────────── */
  .hole-main { min-width: 0; display: flex; flex-direction: column; gap: 14px; }
  .map-frame { width: 100%; }
  .map-frame :global(.course-canvas) { max-width: 100%; }

  .phase-panel {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 18px 20px; min-height: 150px;
    display: flex; flex-direction: column;
  }
  .panel-title { font-family: var(--font-display); font-size: 22px; letter-spacing: .03em; margin-bottom: 8px; }
  .panel-text  { font-size: 14px; color: var(--text-muted); line-height: 1.55; margin-bottom: 16px; }
  .flight-text { font-style: italic; }
  .panel-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 14px; }
  .panel-actions > .btn:only-child { margin-left: auto; }
  .selection-hint { font-size: 12px; color: var(--text-muted); line-height: 1.4; }

  /* ── Question UI ─────────────────────────────────────── */
  .q-meta-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
  .diff-badge { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
  .bump-note  { font-size: 10px; color: var(--amber); letter-spacing: .04em; text-transform: uppercase; }

  .timer-wrap   { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .timer-track  { flex: 1; height: 4px; background: rgba(255,255,255,.08); border-radius: 2px; overflow: hidden; }
  .timer-fill   { height: 100%; border-radius: 2px; }
  .timer-label  { font-family: var(--font-display); font-size: 15px; min-width: 30px; text-align: right; }

  .question-text { font-size: 17px; font-weight: 500; line-height: 1.5; margin-bottom: 4px; }
  .question-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; font-style: italic; }

  .options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
  .options-tf { flex-direction: row; gap: 12px; }
  .option-btn {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    color: var(--text); font-family: var(--font-body); font-size: 14px; font-weight: 500;
    padding: 12px 15px; text-align: left; cursor: pointer;
    transition: border-color .12s, background .12s;
    display: flex; align-items: center; gap: 11px; width: 100%; line-height: 1.4;
  }
  .option-btn:hover:not(:disabled):not(.reveal-correct):not(.reveal-wrong):not(.reveal-missed) { border-color: var(--border-hover); background: rgba(255,255,255,.04); }
  .option-btn:disabled { cursor: default; }
  .option-btn.selected        { border-color: var(--accent); background: var(--accent-dim); }
  .option-btn.reveal-correct  { border-color: var(--green); background: var(--green-dim); }
  .option-btn.reveal-wrong    { border-color: var(--red);   background: var(--red-dim); }
  .option-btn.reveal-missed   { border-color: var(--amber); background: var(--amber-dim); }
  .option-compact { padding: 8px 12px; font-size: 13px; }
  .opt-label { font-family: var(--font-display); font-size: 13px; color: var(--text-muted); min-width: 18px; flex-shrink: 0; }
  .option-btn.selected .opt-label { color: var(--accent); }
  .opt-text  { flex: 1; }
  .opt-check { margin-left: auto; width: 16px; height: 16px; border: 1px solid var(--border); border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; }
  .option-btn.selected .opt-check { background: var(--accent); border-color: var(--accent); color: #0d0d0f; }
  .tf-btn { flex: 1; justify-content: center; font-size: 19px; padding: 18px 14px; font-family: var(--font-display); letter-spacing: .06em; }

  .typed-inputs { display: flex; flex-direction: column; gap: 9px; margin-bottom: 16px; }
  .typed-row    { display: flex; align-items: center; gap: 10px; }
  .typed-num    { font-family: var(--font-display); font-size: 15px; color: var(--text-muted); min-width: 18px; text-align: right; flex-shrink: 0; }
  .typed-field  {
    flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    color: var(--text); font-family: var(--font-body); font-size: 15px; padding: 10px 13px; outline: none; transition: border-color .15s; width: 100%;
  }
  .typed-field:focus { border-color: var(--accent); }
  .typed-accepted { font-size: 12px; color: var(--text-muted); margin-bottom: 14px; font-style: italic; line-height: 1.6; }
  .typed-accepted strong { color: var(--accent); margin-right: 5px; }

  .fill-gap-wrap     { margin-bottom: 16px; }
  .fill-gap-sentence { font-size: 17px; font-weight: 500; line-height: 2.4; }
  .gap-text          { vertical-align: middle; }
  .gap-input-wrap    { display: inline-block; vertical-align: middle; margin: 0 4px; }
  .gap-field {
    background: var(--surface); border: none; border-bottom: 2px solid var(--accent);
    color: var(--text); font-family: var(--font-body); font-size: 16px; font-weight: 600;
    padding: 3px 7px; outline: none; width: 130px; text-align: center;
  }
  .gap-field:focus { background: var(--accent-dim); }

  .explanation { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 11px 14px; font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 14px; }

  /* ── Club selector ───────────────────────────────────── */
  .club-row { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 16px; }
  .club-btn {
    display: flex; flex-direction: column; align-items: center; gap: 1px;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    color: var(--text-muted); padding: 7px 11px; cursor: pointer; min-width: 50px; transition: border-color .12s, background .12s;
  }
  .club-btn:hover { border-color: var(--border-hover); }
  .club-btn.club-active { border-color: var(--accent); background: var(--accent-dim); color: var(--accent); }
  .club-short { font-family: var(--font-display); font-size: 16px; letter-spacing: .04em; }
  .club-yd    { font-size: 9px; color: var(--text-muted); }

  /* ── Reveal banner / outcome ─────────────────────────── */
  .reveal-banner { font-family: var(--font-display); font-size: 20px; letter-spacing: .03em; padding: 10px 15px; border-radius: var(--radius); margin-bottom: 12px; }
  .reveal-ok  { background: var(--green-dim); color: var(--green); border: 1px solid rgba(74,232,122,.3); }
  .reveal-mid { background: var(--amber-dim); color: var(--amber); border: 1px solid rgba(232,148,74,.3); }
  .reveal-bad { background: var(--red-dim);   color: var(--red);   border: 1px solid rgba(232,74,74,.3); }
  .outcome { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
  .outcome-line { font-size: 13px; color: var(--text-muted); line-height: 1.45; }
  .outcome-icon { margin-right: 6px; }
  .outcome-ok   { color: var(--green); font-weight: 600; }
  .outcome-bad  { color: var(--red); }
  .outcome-warn { color: var(--amber); }

  /* ── Right column ────────────────────────────────────── */
  .hole-side {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 16px; display: flex; flex-direction: column; gap: 14px;
    position: sticky; top: 60px;
  }
  .side-hole-head { }
  .shh-num { font-family: var(--font-display); font-size: 24px; letter-spacing: .03em; }
  .shh-of  { color: var(--text-muted); font-size: 16px; }
  .shh-name { font-size: 13px; font-weight: 600; margin-top: 2px; }
  .shh-sub { font-size: 11px; color: var(--text-muted); margin-top: 1px; }

  .side-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .ss-cell { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 4px; text-align: center; display: flex; flex-direction: column; gap: 1px; }
  .ss-num { font-family: var(--font-display); font-size: 22px; line-height: 1; }
  .ss-lab { font-size: 8px; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); }

  .side-lie { display: flex; }
  .lie-badge { display: inline-block; padding: 3px 10px; border-radius: 3px; font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; background: var(--surface2); color: var(--text-muted); }
  .lie-badge.lie-fairway, .lie-badge.lie-tee { background: rgba(74,232,122,.15); color: var(--green); }
  .lie-badge.lie-green { background: rgba(126,216,126,.18); color: #7ed87e; }
  .lie-badge.lie-sand  { background: rgba(232,200,130,.15); color: #e0c882; }
  .lie-badge.lie-rough { background: rgba(232,148,74,.14); color: var(--amber); }
  .lie-badge.lie-trees { background: rgba(232,74,74,.14); color: var(--red); }

  .golfer-frame { display: flex; justify-content: center; }
  .golfer-frame :global(.golfer-canvas) { max-width: 200px; }

  .side-card { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 12px; }
  .sc-title { font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; }
  .sc-rows { display: flex; flex-wrap: wrap; gap: 4px; }
  .sc-chip { display: flex; flex-direction: column; align-items: center; min-width: 22px; padding: 3px 4px; border-radius: 3px; background: var(--surface); border: 1px solid var(--border); }
  .sc-h { font-size: 8px; color: var(--text-muted); }
  .sc-s { font-family: var(--font-display); font-size: 14px; line-height: 1; }
  .sc-chip.under .sc-s { color: var(--green); }
  .sc-chip.even .sc-s  { color: var(--accent); }
  .sc-chip.over .sc-s  { color: var(--red); }

  .side-quit { margin-top: 2px; }

  /* ── Buttons (mma.css provides .btn/.btn-primary/.btn-ghost base) ── */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; padding: 11px 20px; border-radius: var(--radius); border: none; cursor: pointer; transition: opacity .15s, border-color .15s; white-space: nowrap; }
  .btn:hover { opacity: .9; }
  .btn:disabled { opacity: .4; cursor: not-allowed; }
  .btn-primary { background: var(--accent); color: #0d0d0f; }
  .btn-ghost   { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }
  .btn-ghost:hover { border-color: var(--border-hover); color: var(--text); opacity: 1; }
  .btn-sm  { padding: 7px 13px; font-size: 11px; }
  .btn-full { width: 100%; }

  @media (max-width: 860px) {
    .hole-grid { grid-template-columns: 1fr; padding: 14px 14px 32px; gap: 14px; }
    .hole-side { position: static; flex-direction: column; }
    .golfer-frame :global(.golfer-canvas) { max-width: 150px; }
    .options-tf { flex-direction: column; }
  }
</style>
