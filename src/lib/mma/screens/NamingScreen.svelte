<!-- src/lib/mma/screens/NamingScreen.svelte -->
<!-- Fighter name input: first / nickname / last, live preview, random fill -->
<script>

  import { state as gs }                 from '$lib/mma/state.svelte.js';
  import { buildDivision, divisionSlotToOpponent } from '$lib/mma/fighters.js';
  import { assignDivisionQuestions, ensureQPool } from '$lib/mma/questions.js';
  import {
    PHASES, FIRST_NAMES, LAST_NAMES, NICKNAMES,
    FIGHT_STYLES, getFightStyle,
    KO_METHODS, TKO_METHODS, SUB_METHODS,
  } from '$lib/mma/constants.js';
  import { rng } from '$lib/mma/utils.js';

  const { onsave } = $props();  // ── Form fields ───────────────────────────────────────
  let first = $state('');
  let nick  = $state('');
  let last  = $state('');

  // ── Fight style + special moves ───────────────────────
  // MMA Fighter (the balanced base profile) is selected by default.
  let styleId = $state('allrounder');
  // moveSlots = rolling window of the last 2 move clicks.
  // 2 clicks on one move → that move appears twice (a "double").
  let moveSlots = $state([]);

  // ── Popups ────────────────────────────────────────────
  let styleModalOpen = $state(false);
  let movesModalOpen = $state(false);

  const MOVE_GROUPS = [
    { label: 'Knockouts',    moves: KO_METHODS  },
    { label: 'Stoppages',    moves: TKO_METHODS },
    { label: 'Submissions',  moves: SUB_METHODS },
  ];

  const selectedStyle = $derived(getFightStyle(styleId));
  // Unique selected moves with their allocation count (1 = single, 2 = double).
  const selectedMoves = $derived(
    [...new Set(moveSlots)].map(m => ({ move: m, count: moveSlots.filter(x => x === m).length }))
  );

  function moveCount(move) {
    return moveSlots.filter(m => m === move).length;
  }

  function clickMove(move) {
    // Clicking a fully-allocated (double) move clears it out.
    if (moveCount(move) === 2) {
      moveSlots = moveSlots.filter(m => m !== move);
      return;
    }
    // Otherwise push it and keep only the last two clicks.
    moveSlots = [...moveSlots, move].slice(-2);
  }

  function clearMoves() {
    moveSlots = [];
  }

  function pickStyle(id) {
    styleId = id;
    styleModalOpen = false;
  }

  const canConfirm = $derived(
    first.trim().length > 0 && last.trim().length > 0 && styleId.length > 0
  );

  // ── Confirm ───────────────────────────────────────────
  function confirm() {
    if (!canConfirm) return;
    const f = first.trim();
    const n = nick.trim();
    const l = last.trim();
    const name = n ? `${f} "${n}" ${l}` : `${f} ${l}`;
    applyName(name);
  }

  function applyFightStyle() {
    const style = getFightStyle(styleId);
    if (!style) return;
    // Win tendency → method weights (base 1 + style additive baked into the values).
    gs.methodWeights = { ...style.win };
    // Weakness → how you get finished when you lose.
    gs.career.fightStyle  = style.id;
    gs.career.lossWeights = { ...style.loss };
    // Special moves → starting specific-method counts.
    const counts = {};
    for (const m of moveSlots) counts[m] = (counts[m] || 0) + 1;
    gs.specificMethodCounts = counts;
  }

  function applyName(name) {
    if (!gs.career) return;
    gs.career.fighterName = name;
    applyFightStyle();
    // Rebuild phase-1 division with the confirmed name
    const newDiv = buildDivision(PHASES[1], name);
    gs.career.divisions = gs.career.divisions || {};
    gs.career.divisions[1] = newDiv;
    gs.career.division    = newDiv;
    // Assign questions to new division
    gs._qPool = null; gs._qUsed = null; gs._qById = null;
    ensureQPool(gs);
    assignDivisionQuestions(gs, newDiv, 1);
    // Set first opponent (slot 1, one above player)
    const initFid = newDiv.slots[1];
    gs.currentOpponent = (initFid && initFid !== 'player')
      ? divisionSlotToOpponent(initFid, 1, gs.career)
      : null;
    onsave?.();
    gs.screen = 'prefight';
  }

  // ── Generate random (name only) ───────────────────────
  function generateRandom() {
    first = rng(FIRST_NAMES);
    last  = rng(LAST_NAMES);
    nick  = Math.random() > 0.4 ? rng(NICKNAMES) : '';
  }

  function toMenu() {
    gs.screen = 'menu';
  }

  // ── Key shortcuts ─────────────────────────────────────
  function onKeydown(e) {
    if (e.key === 'Escape') {
      if (styleModalOpen || movesModalOpen) { styleModalOpen = false; movesModalOpen = false; }
      return;
    }
    if (e.key === 'Enter' && canConfirm && !styleModalOpen && !movesModalOpen) confirm();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="naming-wrap">
  <button class="back-link" onclick={toMenu}>← Main Menu</button>

  <h2 class="naming-headline">Name Your<br>Fighter</h2>
  <p class="naming-sub">Who are you stepping into the cage as?</p>

  <div class="naming-preview">
    {#if first.trim() || last.trim()}
      <span class="preview-first">{first.trim() || '…'}</span>
      {#if nick.trim()}
        <span class="preview-nick">"{nick.trim()}"</span>
      {/if}
      <span class="preview-last">{last.trim() || '…'}</span>
    {:else}
      —
    {/if}
  </div>

  <div class="naming-row">
    <div class="naming-field">
      <label class="naming-label" for="naming-first">First Name</label>
      <input
        class="naming-input"
        id="naming-first"
        bind:value={first}
        placeholder="e.g. Jake"
        maxlength="20"
        autocomplete="off"
      />
    </div>
    <div class="naming-field">
      <label class="naming-label" for="naming-nick">
        Nickname <span class="optional">(optional)</span>
      </label>
      <input
        class="naming-input naming-nick"
        id="naming-nick"
        bind:value={nick}
        placeholder={`e.g. "The Hammer"`}
        maxlength="24"
        autocomplete="off"
      />
    </div>
    <div class="naming-field">
      <label class="naming-label" for="naming-last">Last Name</label>
      <input
        class="naming-input"
        id="naming-last"
        bind:value={last}
        placeholder="e.g. Torres"
        maxlength="20"
        autocomplete="off"
      />
    </div>
  </div>

  <!-- ── Primary actions ──────────────────────────────── -->
  <div class="btn-row">
    <button class="btn btn-primary" disabled={!canConfirm} onclick={confirm}>
      Enter the Cage
    </button>
    <button class="btn btn-ghost" onclick={generateRandom}>
      Randomize Name
    </button>
  </div>
  {#if !styleId}
    <p class="confirm-hint">Pick a fighting style below before you can enter the cage.</p>
  {/if}

  <!-- ── Fighting style (popup) ───────────────────────── -->
  <div class="section-head">Fighting Style</div>
  {#if selectedStyle}
    <button type="button" class="selector selected" onclick={() => (styleModalOpen = true)}>
      <span class="selector-main">
        <span class="style-name">{selectedStyle.name}</span>
        <span class="style-tag">{selectedStyle.tagline}</span>
      </span>
      <span class="selector-edit">Change</span>
    </button>
  {:else}
    <button type="button" class="selector selector-empty" onclick={() => (styleModalOpen = true)}>
      <span>Choose Your Style</span>
      <span class="selector-edit">Select →</span>
    </button>
  {/if}

  <!-- ── Special moves (popup) ────────────────────────── -->
  <div class="section-head">
    Special Moves <span class="optional">(optional)</span>
  </div>
  {#if selectedMoves.length}
    <button type="button" class="selector selector-moves" onclick={() => (movesModalOpen = true)}>
      <span class="selected-moves">
        {#each selectedMoves as sm}
          <span class="move-chip" class:single={sm.count === 1} class:double={sm.count === 2}>
            {sm.move}{#if sm.count === 2}<span class="x2"> ×2</span>{/if}
          </span>
        {/each}
      </span>
      <span class="selector-edit">Edit</span>
    </button>
  {:else}
    <button type="button" class="selector selector-empty" onclick={() => (movesModalOpen = true)}>
      <span>Add Special Moves</span>
      <span class="selector-edit">Select →</span>
    </button>
  {/if}
</div>

<!-- ── Style picker modal ─────────────────────────────── -->
{#if styleModalOpen}
  <div class="modal-overlay" role="presentation" onclick={() => (styleModalOpen = false)}>
    <div class="modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
      <div class="modal-head">
        <h3 class="modal-title">Choose Your Style</h3>
        <button type="button" class="modal-close" aria-label="Close" onclick={() => (styleModalOpen = false)}>✕</button>
      </div>
      <div class="style-grid">
        {#each FIGHT_STYLES as s}
          <button
            type="button"
            class="style-card"
            class:selected={styleId === s.id}
            onclick={() => pickStyle(s.id)}
          >
            <span class="style-name">{s.name}</span>
            <span class="style-tag">{s.tagline}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- ── Special moves modal ────────────────────────────── -->
{#if movesModalOpen}
  <div class="modal-overlay" role="presentation" onclick={() => (movesModalOpen = false)}>
    <div class="modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
      <div class="modal-head">
        <h3 class="modal-title">Special Moves</h3>
        <button type="button" class="modal-close" aria-label="Close" onclick={() => (movesModalOpen = false)}>✕</button>
      </div>
      <p class="moves-hint">
        Tap a move to favour it. Tap it twice to commit hard. Your last two picks stick.
      </p>
      {#each MOVE_GROUPS as group}
        <div class="move-group">
          <div class="move-group-label">{group.label}</div>
          <div class="move-chips">
            {#each group.moves as move}
              {@const c = moveCount(move)}
              <button
                type="button"
                class="move-chip"
                class:single={c === 1}
                class:double={c === 2}
                onclick={() => clickMove(move)}
              >
                {move}
              </button>
            {/each}
          </div>
        </div>
      {/each}
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" disabled={!moveSlots.length} onclick={clearMoves}>
          Clear Moves
        </button>
        <button type="button" class="btn btn-primary" onclick={() => (movesModalOpen = false)}>
          Done
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .naming-wrap {
    max-width: 600px;
    margin: 0 auto;
    padding: 28px 0 40px;
  }

  .back-link {
    background: none;
    border: none;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    padding: 0;
    margin-bottom: 18px;
    transition: color 0.15s;
  }
  .back-link:hover { color: var(--accent); }

  .naming-headline {
    font-family: var(--font-display);
    font-size: 38px;
    letter-spacing: 0.03em;
    line-height: 1.1;
    margin-bottom: 6px;
  }

  .naming-sub {
    color: var(--text-muted);
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 28px;
  }

  .naming-preview {
    font-family: var(--font-display);
    font-size: 22px;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    margin-bottom: 20px;
    min-height: 1.4em;
  }
  .preview-first, .preview-last { color: var(--accent); }
  .preview-nick { color: var(--accent); font-style: italic; }

  .naming-row {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }

  .naming-field { flex: 1; min-width: 120px; }

  .naming-label {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 5px;
    display: block;
  }
  .optional { opacity: 0.5; }

  .naming-input {
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 15px;
    font-weight: 500;
    padding: 11px 14px;
    transition: border-color 0.15s;
    outline: none;
  }
  .naming-input:focus { border-color: var(--accent); }
  .naming-input::placeholder { color: var(--text-muted); opacity: 0.6; }
  .naming-nick { font-style: italic; }

  .btn-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }

  .confirm-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin: 4px 0 0;
  }

  /* ── Section heads ────────────────────────────────── */
  .section-head {
    font-family: var(--font-display);
    font-size: 16px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin: 24px 0 10px;
  }

  /* ── Selector boxes (open the popups) ─────────────── */
  .selector {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    text-align: left;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .selector:hover { border-color: var(--accent); }
  .selector-empty { color: var(--text-muted); }
  .selector-main { display: flex; flex-direction: column; gap: 4px; }
  .selector-edit {
    flex-shrink: 0;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .selector.selected { border-color: var(--accent); }
  .selector-moves { padding: 10px 14px; }
  .selected-moves {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  /* ── Fight style cards ────────────────────────────── */
  .style-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }
  .style-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 11px 13px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .style-card:hover { border-color: var(--accent); }
  .style-card.selected {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--surface2));
  }
  .style-name {
    font-family: var(--font-display);
    font-size: 15px;
    letter-spacing: 0.03em;
    color: var(--text);
  }
  .style-card.selected .style-name,
  .selector.selected .style-name { color: var(--accent); }
  .style-tag {
    font-size: 11px;
    line-height: 1.3;
    color: var(--text-muted);
  }

  /* ── Move chips ───────────────────────────────────── */
  .moves-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin: 0 0 16px;
    line-height: 1.4;
  }
  .move-group { margin-bottom: 12px; }
  .move-group-label {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .move-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .move-chip {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 500;
    padding: 6px 12px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s, box-shadow 0.15s;
  }
  .move-chip:hover { border-color: var(--accent); color: var(--text); }
  .move-chip.single {
    border-color: var(--accent);
    color: var(--text);
    background: color-mix(in srgb, var(--accent) 12%, var(--surface2));
  }
  .move-chip.double {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 24%, var(--surface2));
    box-shadow: 0 0 0 1px var(--accent), 0 0 10px color-mix(in srgb, var(--accent) 45%, transparent);
    font-weight: 700;
  }
  /* Read-only chips inside the selector box should not look clickable. */
  .selected-moves .move-chip { cursor: default; }
  .x2 { opacity: 0.8; font-weight: 700; }

  /* ── Modals ───────────────────────────────────────── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.66);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 100;
  }
  .modal {
    width: 100%;
    max-width: 560px;
    max-height: 86vh;
    overflow-y: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px 22px 22px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .modal-title {
    font-family: var(--font-display);
    font-size: 20px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .modal-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 4px 8px;
    transition: color 0.15s;
  }
  .modal-close:hover { color: var(--accent); }
  .modal-foot {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
</style>
