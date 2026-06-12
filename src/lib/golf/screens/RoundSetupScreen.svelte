<!-- src/lib/golf/screens/RoundSetupScreen.svelte -->
<script>
  import { state as gs } from '$lib/golf/state.svelte.js';
  import { HOLES } from '$lib/golf/holes.js';
  import QuestionSetPicker from '$lib/golf/QuestionSetPicker.svelte';

  // intent: 'simple' | 'career_ranked' | 'career_practice'
  // lockHoles: when set, the hole count is fixed (career flows decide it upstream).
  const { onstartround, onback, intent = 'simple', lockHoles = null } = $props();

  let holeCount     = $state(lockHoles ?? 9);
  let selectedModId = $state(null);

  const maxHoles = $derived(HOLES.length);
  const bundledSets = $derived(gs.availableModules.filter(m => !m.tag));

  $effect(() => { if (lockHoles) holeCount = lockHoles; });

  $effect(() => {
    if (selectedModId === null && bundledSets.length) {
      const golf = bundledSets.find(m => m.id === 'golf_questions');
      selectedModId = golf ? golf.id : bundledSets[0].id;
    }
  });

  const heading = $derived(
    intent === 'career_ranked'   ? 'Ranked Round'
    : intent === 'career_practice' ? 'Practice Round'
    : 'New Round'
  );
  const subhead = $derived(
    intent === 'career_ranked'   ? '18 holes · counts toward your handicap. Pick what you’ll be quizzed on.'
    : intent === 'career_practice' ? `${holeCount} holes · casual, no handicap. Pick what you’ll be quizzed on.`
    : 'Choose your course length and what you’ll be quizzed on.'
  );
  const startLabel = $derived(
    intent === 'career_ranked'   ? 'Play Round →'
    : intent === 'career_practice' ? 'Start Practice →'
    : 'Tee Off →'
  );

  const canStart = $derived(!!selectedModId);

  function start() {
    if (!canStart) return;
    onstartround?.({ holeCount, modId: selectedModId, intent });
  }
</script>

<div class="setup-wrap">
  <div class="setup-header">
    <h2>{heading}</h2>
    <p>{subhead}</p>
  </div>

  <!-- Hole count (hidden when the flow locks it) -->
  {#if !lockHoles}
    <div class="section">
      <div class="section-label">Course Length</div>
      <div class="length-row">
        <button class="length-btn" class:active={holeCount === 9} onclick={() => holeCount = 9}>
          <span class="length-num">9</span>
          <span class="length-sub">Holes · Front Nine</span>
        </button>
        <button class="length-btn" class:active={holeCount === 18} onclick={() => holeCount = 18}
          disabled={maxHoles < 9}>
          <span class="length-num">18</span>
          <span class="length-sub">Holes · Full Round</span>
        </button>
      </div>
      {#if holeCount === 18 && maxHoles < 18}
        <p class="note">18-hole rounds play the nine twice.</p>
      {/if}
    </div>
  {/if}

  <!-- Question set -->
  <div class="section">
    <div class="section-label">Question Set</div>
    <QuestionSetPicker selectedId={selectedModId} onselect={(id) => selectedModId = id} />
  </div>

  <div class="actions">
    <button class="btn btn-ghost" onclick={onback}>← Back</button>
    <button class="btn btn-primary btn-lg" disabled={!canStart} onclick={start}>{startLabel}</button>
  </div>
</div>

<style>
  .setup-wrap { max-width: 480px; margin: 0 auto; padding: 40px 0 48px; }
  .setup-header { margin-bottom: 28px; }
  .setup-header h2 { font-family: var(--font-display); font-size: 42px; letter-spacing: .03em; color: var(--accent); }
  .setup-header p  { font-size: 13px; color: var(--muted); margin-top: 4px; }

  .section { margin-bottom: 26px; }
  .section-label { font-size: 10px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
  .note { font-size: 11px; color: var(--muted); margin-top: 8px; font-style: italic; }

  .length-row { display: flex; gap: 10px; }
  .length-btn {
    flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
    padding: 16px; cursor: pointer; color: var(--text); text-align: center;
    display: flex; flex-direction: column; gap: 2px; align-items: center;
    transition: border-color .15s, background .15s;
  }
  .length-btn:hover:not(:disabled) { border-color: var(--accent-border); }
  .length-btn.active { border-color: var(--accent); background: rgba(212,168,71,.08); }
  .length-btn:disabled { opacity: .4; cursor: not-allowed; }
  .length-num { font-family: var(--font-display); font-size: 34px; color: var(--accent); line-height: 1; }
  .length-sub { font-size: 11px; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; }

  .actions { display: flex; justify-content: space-between; align-items: center; margin-top: 32px; }

  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; white-space: nowrap; }
  .btn:hover  { opacity: .85; }
  .btn:disabled { opacity: .35; cursor: not-allowed; }
  .btn-primary { background: var(--accent); color: #0a0a0c; }
  .btn-ghost   { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }
  .btn-lg { padding: 14px 32px; font-size: 15px; letter-spacing: .1em; }
</style>
