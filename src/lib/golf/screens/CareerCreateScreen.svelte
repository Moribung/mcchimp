<!-- src/lib/golf/screens/CareerCreateScreen.svelte -->
<!-- Golf character creation: name + recolour (skin, cap, shirt, trousers). -->
<script>
  import GolferScene from '$lib/golf/GolferScene.svelte';
  import { DEFAULT_AVATAR } from '$lib/golf/saves.js';
  import { isAdvanceKey } from '$lib/uiKeys.js';

  const { oncreate, onback } = $props();

  const SKIN_TONES = ['#f1c9a5', '#e0b08a', '#c68a5e', '#a06a3c', '#7c4f29', '#5e3a22'];
  const SWATCHES   = ['#c2453a', '#b41f1f', '#d4a847', '#2f9a4f', '#1f8a86', '#3a6ea5', '#2f5fd8', '#7a3fb0', '#2b2b33', '#e8e8ec'];

  let name = $state('');
  let avatar = $state({ ...DEFAULT_AVATAR });

  const previewAnims = ['idle', 'swing_full', 'putt', 'celebrate'];
  let previewAnim = $state('idle');

  function randomize() {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    avatar = {
      skin:  pick(SKIN_TONES),
      cap:   pick(SWATCHES),
      shirt: pick(SWATCHES),
      pants: pick(SWATCHES),
    };
  }

  function create() {
    oncreate?.({ name: name.trim() || 'Rookie', avatar: { ...avatar } });
  }

  function onKeydown(e) {
    if (isAdvanceKey(e)) { e.preventDefault(); create(); }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="create-wrap">
  <div class="create-header">
    <h2>Create Your Golfer</h2>
    <p>Name your player and pick a look. Your handicap is tracked across every ranked round.</p>
  </div>

  <div class="create-grid">
    <!-- Preview -->
    <div class="preview-col">
      <div class="preview-frame">
        <GolferScene anim={previewAnim} colors={avatar} />
      </div>
      <div class="anim-row">
        {#each previewAnims as a}
          <button class="anim-btn" class:active={previewAnim === a} onclick={() => previewAnim = a}>{a.replace('_', ' ')}</button>
        {/each}
      </div>
      <button class="btn btn-ghost btn-sm" onclick={randomize}>🎲 Randomise look</button>
    </div>

    <!-- Controls -->
    <div class="controls-col">
      <div class="section">
        <div class="section-label">Name</div>
        <input class="name-field" type="text" maxlength="20" placeholder="Rookie"
          bind:value={name} />
      </div>

      <div class="section">
        <div class="section-label">Skin</div>
        <div class="swatch-row">
          {#each SKIN_TONES as c}
            <button class="swatch" class:sel={avatar.skin === c} style="background:{c}"
              onclick={() => avatar.skin = c} aria-label="skin {c}"></button>
          {/each}
        </div>
      </div>

      <div class="section">
        <div class="section-label">Cap</div>
        <div class="swatch-row">
          {#each SWATCHES as c}
            <button class="swatch" class:sel={avatar.cap === c} style="background:{c}"
              onclick={() => avatar.cap = c} aria-label="cap {c}"></button>
          {/each}
        </div>
      </div>

      <div class="section">
        <div class="section-label">Shirt</div>
        <div class="swatch-row">
          {#each SWATCHES as c}
            <button class="swatch" class:sel={avatar.shirt === c} style="background:{c}"
              onclick={() => avatar.shirt = c} aria-label="shirt {c}"></button>
          {/each}
        </div>
      </div>

      <div class="section">
        <div class="section-label">Trousers</div>
        <div class="swatch-row">
          {#each SWATCHES as c}
            <button class="swatch" class:sel={avatar.pants === c} style="background:{c}"
              onclick={() => avatar.pants = c} aria-label="trousers {c}"></button>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <div class="actions">
    <button class="btn btn-ghost" onclick={onback}>← Back</button>
    <button class="btn btn-primary btn-lg" onclick={create}>Start Career →</button>
  </div>
</div>

<style>
  .create-wrap { max-width: 560px; margin: 0 auto; padding: 40px 0 48px; }
  .create-header { margin-bottom: 24px; }
  .create-header h2 { font-family: var(--font-display); font-size: 40px; letter-spacing: .03em; color: var(--accent); }
  .create-header p  { font-size: 13px; color: var(--muted); margin-top: 4px; line-height: 1.5; }

  .create-grid { display: grid; grid-template-columns: 220px 1fr; gap: 24px; align-items: start; }

  .preview-col { display: flex; flex-direction: column; gap: 12px; align-items: center; position: sticky; top: 70px; }
  .preview-frame { width: 100%; }
  .anim-row { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
  .anim-btn {
    background: var(--surface); border: 1px solid var(--border); border-radius: 3px;
    color: var(--muted); font-size: 10px; letter-spacing: .04em; text-transform: uppercase;
    padding: 5px 8px; cursor: pointer; transition: border-color .15s, color .15s;
  }
  .anim-btn:hover { border-color: var(--accent-border); }
  .anim-btn.active { border-color: var(--accent); color: var(--accent); }

  .controls-col { display: flex; flex-direction: column; gap: 18px; }
  .section-label { font-size: 10px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }

  .name-field {
    width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
    color: var(--text); font-family: var(--font-body); font-size: 15px; padding: 11px 14px; outline: none;
    transition: border-color .15s;
  }
  .name-field:focus { border-color: var(--accent); }

  .swatch-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .swatch {
    width: 30px; height: 30px; border-radius: 4px; cursor: pointer;
    border: 2px solid rgba(255,255,255,.12); transition: transform .1s, border-color .12s;
  }
  .swatch:hover { transform: scale(1.08); }
  .swatch.sel { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(212,168,71,.3); }

  .actions { display: flex; justify-content: space-between; align-items: center; margin-top: 30px; }

  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; white-space: nowrap; }
  .btn:hover  { opacity: .85; }
  .btn:disabled { opacity: .35; cursor: not-allowed; }
  .btn-primary { background: var(--accent); color: #0a0a0c; }
  .btn-ghost   { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }
  .btn-sm { padding: 7px 13px; font-size: 11px; }
  .btn-lg { padding: 14px 32px; font-size: 15px; letter-spacing: .1em; }

  @media (max-width: 560px) {
    .create-grid { grid-template-columns: 1fr; }
    .preview-col { position: static; max-width: 200px; margin: 0 auto; }
  }
</style>
