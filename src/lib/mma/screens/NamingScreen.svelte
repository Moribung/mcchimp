<!-- src/lib/mma/screens/NamingScreen.svelte -->
<!-- Fighter name input: first / nickname / last, live preview, random fill -->
<script>

  import { state as gs }                 from '$lib/mma/state.svelte.js';
  import { buildDivision, divisionSlotToOpponent } from '$lib/mma/fighters.js';
  import { assignDivisionQuestions, ensureQPool } from '$lib/mma/questions.js';
  import { PHASES, FIRST_NAMES, LAST_NAMES, NICKNAMES } from '$lib/mma/constants.js';
  import { rng } from '$lib/mma/utils.js';

  const { onsave } = $props();  // ── Form fields ───────────────────────────────────────
  let first = $state('');
  let nick  = $state('');
  let last  = $state('');

  const canConfirm = $derived(first.trim().length > 0 && last.trim().length > 0);

  // ── Confirm ───────────────────────────────────────────
  function confirm() {
    if (!canConfirm) return;
    const f = first.trim();
    const n = nick.trim();
    const l = last.trim();
    const name = n ? `${f} "${n}" ${l}` : `${f} ${l}`;
    applyName(name);
  }

  function applyName(name) {
    if (!gs.career) return;
    gs.career.fighterName = name;
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

  // ── Generate random ───────────────────────────────────
  function generateRandom() {
    first = rng(FIRST_NAMES);
    last  = rng(LAST_NAMES);
    nick  = Math.random() > 0.4 ? rng(NICKNAMES) : '';
  }

  // ── Enter key shortcut ────────────────────────────────
  function onKeydown(e) {
    if (e.key === 'Enter' && canConfirm) confirm();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="naming-wrap">
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

  <div class="btn-row">
    <button class="btn btn-primary" disabled={!canConfirm} onclick={confirm}>
      Enter the Cage
    </button>
    <button class="btn btn-ghost" onclick={generateRandom}>
      Generate Random
    </button>
  </div>

  <div class="naming-divider">or</div>

  <!-- Quick-pick: use generated name from initState -->
  {#if gs.career?.fighterName}
    <button class="btn btn-ghost" onclick={() => applyName(gs.career.fighterName)}>
      Use "{gs.career.fighterName}"
    </button>
  {/if}
</div>

<style>
  .naming-wrap {
    max-width: 600px;
    margin: 0 auto;
    padding: 28px 0 40px;
  }

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

  .naming-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 18px 0;
    color: var(--text-muted);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .naming-divider::before,
  .naming-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }
</style>
