<!-- src/routes/mma/creator/+page.svelte -->
<!-- Single-character creator: one recolorable fighter with pose / facing /
     hair / skin / beard / shorts options and a jump/off/sway idle animation.
     No belt, no scene/referee — just the character. -->
<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { state as gs } from '$lib/mma/state.svelte.js';
  import {
    renderFighter, hexToRgb, FIGHTER_W, FEET_Y,
    POSES, POSE_LABEL, HAIR_STYLES, BEARD_STYLES, ORGS,
    SKIN_TONES, HAIR_COLORS, SHORTS_COLORS, GLOVE_COLORS,
  } from '$lib/avatar/fighterRenderer.js';
  import { nationalityFit } from '$lib/avatar/nationalityFits.js';

  const playerIso = gs.career?.playerNat || '';

  // Seed from the active career's saved avatar (if any).
  const sa = gs.career?.avatar ?? {};
  let c = $state({
    pose: 'loss', flip: false, anim: 'jump',
    skinIdx:      sa.skinIdx      ?? 0,
    hairStyle:    sa.hairStyle    ?? 'short',
    hairColorIdx: sa.hairColorIdx ?? 0,
    beardStyle:   sa.beardStyle   ?? 'none',
    beardColorIdx: sa.beardColorIdx ?? 0,
    org:          sa.org          ?? 'gfl',
    shortsBase:   sa.customBase   ?? sa.shortsBase ?? '#181820',
    shortsTrim:   sa.customTrim   ?? sa.shortsTrim ?? '#e8e8ec',
    gloveIdx: 0,
  });

  // Apply a nationality colour pair (0 or 1) to the shorts.
  function applyFit(which) {
    const fit = nationalityFit(playerIso, which);
    c.shortsBase = fit.main;
    c.shortsTrim = fit.trim;
  }

  // Persist the saved attributes back onto the active career as they change.
  $effect(() => {
    if (gs.career) {
      gs.career.avatar = {
        skinIdx: c.skinIdx, hairStyle: c.hairStyle, hairColorIdx: c.hairColorIdx,
        beardStyle: c.beardStyle, beardColorIdx: c.beardColorIdx, org: c.org,
        // The creator edits the "Custom" preset, which becomes the active pants.
        customBase: c.shortsBase, customTrim: c.shortsTrim,
        shortsBase: c.shortsBase, shortsTrim: c.shortsTrim,
        pantsChoice: 'custom',
      };
    }
  });

  // Route back to the naming screen (avatar is already persisted on the career).
  function backToNaming() {
    if (gs.career) gs.screen = 'naming';
    goto('/mma');
  }

  function paletteFor(f) {
    const tone = SKIN_TONES[f.skinIdx];
    return {
      skin:     hexToRgb(tone.base),
      skinSh:   hexToRgb(tone.shadow),
      hair:     hexToRgb(HAIR_COLORS[f.hairColorIdx].hex),
      beard:    hexToRgb(HAIR_COLORS[f.beardColorIdx].hex),
      shorts:   hexToRgb(f.shortsBase),
      shortsTr: hexToRgb(f.shortsTrim),
      glove:    hexToRgb(GLOVE_COLORS[f.gloveIdx].hex),
      belt:     [216, 178, 58], // unused (no belt)
    };
  }
  const cfgFor = (f) => ({ pose: f.pose, hair: f.hairStyle, beard: f.beardStyle, org: f.org, belt: 'none' });

  let fighter = $state(null);
  $effect(() => { fighter = renderFighter(cfgFor(c), paletteFor(c)); });

  let canvas;
  // Display canvas: 48×52 native, one fighter (32×48) centred with a floor + shadow.
  const CW = 48, CH = 52, FX = (CW - FIGHTER_W) / 2, FEET = 46;

  onMount(() => {
    const ctx = canvas.getContext('2d');
    let raf, t = 0, running = true;
    function loop() {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      t += 16;
      try {
        ctx.imageSmoothingEnabled = false;
        // backdrop
        ctx.fillStyle = '#13141c'; ctx.fillRect(0, 0, CW, CH);
        ctx.fillStyle = '#1b1d27'; ctx.fillRect(0, FEET, CW, CH - FEET);
        // soft shadow under the fighter
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(FX + 4, FEET - 1, 24, 2);

        // animation offsets
        let offX = 0, offY = 0;
        if (c.anim === 'jump') {
          offY = Math.round(Math.sin(t / 520));
        } else if (c.anim === 'sway') {
          const ph = t / 600;
          offX = Math.round(2 * Math.sin(ph));
          offY = Math.round(2 * Math.abs(Math.sin(ph)));
        }

        if (fighter) {
          const dx = FX + offX, dy = (FEET - FEET_Y) + offY;
          if (c.flip) {
            ctx.save(); ctx.translate(dx + FIGHTER_W, 0); ctx.scale(-1, 1);
            ctx.drawImage(fighter, 0, dy); ctx.restore();
          } else {
            ctx.drawImage(fighter, dx, dy);
          }
        }
      } catch (e) { console.error('loop frame error:', e); }
    }
    loop();
    return () => { running = false; cancelAnimationFrame(raf); };
  });
</script>

<svelte:head>
  <link rel="stylesheet" href="/mma.css" />
</svelte:head>

<div class="cr-wrap">
  <div class="cr-bar">
    <button type="button" class="cr-back" onclick={backToNaming}>← Back to Naming</button>
    <span class="cr-title">Character Creator</span>
  </div>

  <div class="cr-inner">
    <h1 class="cr-h1">Character Creator</h1>
    <p class="cr-sub">Build one fighter · recolorable pixel art</p>

    <div class="cr-body">
      <div class="cr-left">
        <div class="cr-stage">
          <canvas bind:this={canvas} width={CW} height={CH} class="cr-canvas"></canvas>
        </div>
        <button type="button" class="cr-done" onclick={backToNaming}>Done</button>
      </div>

      <div class="cr-right">

    <div class="cr-ctrl">
      <span class="cr-label">Animation</span>
      <div class="cr-btns">
        {#each [['off','Off'],['jump','Jump'],['sway','Sway']] as [id, lbl]}
          <button class="cr-btn" class:sel={c.anim === id} onclick={() => c.anim = id}>{lbl}</button>
        {/each}
      </div>
    </div>

    <div class="cr-ctrl">
      <span class="cr-label">Pose</span>
      <div class="cr-btns">
        {#each POSES as p}
          <button class="cr-btn" class:sel={c.pose === p} onclick={() => c.pose = p}>{POSE_LABEL[p]}</button>
        {/each}
      </div>
    </div>

    <div class="cr-ctrl">
      <span class="cr-label">Facing</span>
      <div class="cr-btns">
        <button class="cr-btn" class:sel={c.flip} onclick={() => c.flip = true}>Right</button>
        <button class="cr-btn" class:sel={!c.flip} onclick={() => c.flip = false}>Left</button>
      </div>
    </div>

    <div class="cr-ctrl">
      <span class="cr-label">Skin</span>
      <div class="cr-btns">
        {#each SKIN_TONES as tone, i}
          <button class="cr-swatch" style="background: {tone.base}" class:sel={c.skinIdx === i}
            aria-label={tone.label} onclick={() => c.skinIdx = i}></button>
        {/each}
      </div>
    </div>

    <div class="cr-ctrl">
      <span class="cr-label">Hair</span>
      <div class="cr-btns">
        {#each HAIR_STYLES as h}
          <button class="cr-btn" class:sel={c.hairStyle === h} onclick={() => c.hairStyle = h}>{h}</button>
        {/each}
      </div>
    </div>

    <div class="cr-ctrl">
      <span class="cr-label">Hair color</span>
      <div class="cr-btns">
        {#each HAIR_COLORS as col, i}
          <button class="cr-swatch" style="background: {col.hex}" class:sel={c.hairColorIdx === i}
            aria-label={col.label} onclick={() => c.hairColorIdx = i}></button>
        {/each}
      </div>
    </div>

    <div class="cr-ctrl">
      <span class="cr-label">Beard</span>
      <div class="cr-btns">
        {#each BEARD_STYLES as b}
          <button class="cr-btn" class:sel={c.beardStyle === b} onclick={() => c.beardStyle = b}>{b}</button>
        {/each}
      </div>
    </div>

    <div class="cr-ctrl">
      <span class="cr-label">Beard color</span>
      <div class="cr-btns">
        {#each HAIR_COLORS as col, i}
          <button class="cr-swatch" style="background: {col.hex}" class:sel={c.beardColorIdx === i}
            disabled={c.beardStyle === 'none'} aria-label={col.label} onclick={() => c.beardColorIdx = i}></button>
        {/each}
      </div>
    </div>

    <div class="cr-ctrl">
      <span class="cr-label">Shorts pattern</span>
      <div class="cr-btns">
        {#each Object.entries(ORGS) as [id, lbl]}
          <button class="cr-btn" class:sel={c.org === id} onclick={() => c.org = id}>{lbl}</button>
        {/each}
      </div>
    </div>

    <div class="cr-ctrl">
      <span class="cr-label">National fit</span>
      <div class="cr-btns">
        <button class="cr-btn" onclick={() => applyFit(0)}>National Fit 1</button>
        <button class="cr-btn" onclick={() => applyFit(1)}>National Fit 2</button>
      </div>
    </div>

    <div class="cr-ctrl">
      <span class="cr-label">Shorts base</span>
      <div class="cr-btns">
        {#each SHORTS_COLORS as col}
          <button class="cr-swatch" style="background: {col.hex}" class:sel={c.shortsBase === col.hex}
            aria-label={col.label} onclick={() => c.shortsBase = col.hex}></button>
        {/each}
      </div>
    </div>

    <div class="cr-ctrl">
      <span class="cr-label">Shorts trim</span>
      <div class="cr-btns">
        {#each SHORTS_COLORS as col}
          <button class="cr-swatch" style="background: {col.hex}" class:sel={c.shortsTrim === col.hex}
            aria-label={col.label} onclick={() => c.shortsTrim = col.hex}></button>
        {/each}
      </div>
    </div>

    <div class="cr-ctrl">
      <span class="cr-label">Gloves</span>
      <div class="cr-btns">
        {#each GLOVE_COLORS as col, i}
          <button class="cr-swatch" style="background: {col.hex}" class:sel={c.gloveIdx === i}
            aria-label={col.label} onclick={() => c.gloveIdx = i}></button>
        {/each}
      </div>
    </div>
      </div>
    </div>
  </div>
</div>

<style>
  .cr-wrap { min-height: 100vh; display: flex; flex-direction: column; background: #0f1017; color: #e8e8ec; }
  .cr-bar {
    display: flex; align-items: center; gap: 20px;
    padding: 10px 28px; background: rgba(10,10,10,0.97);
    border-bottom: 1px solid rgba(255,255,255,0.06); position: sticky; top: 0; z-index: 100;
  }
  .cr-back {
    font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase; color: rgba(232,232,236,0.45);
    text-decoration: none; background: none; border: none; padding: 0; cursor: pointer;
  }
  .cr-back:hover { color: #e8e8ec; }
  .cr-title { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.06em; color: #d8b23a; }

  .cr-inner { max-width: 880px; margin: 0 auto; padding: 26px 20px 60px; width: 100%; }
  .cr-h1 { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 0.04em; color: #d8b23a; margin-bottom: 4px; }
  .cr-sub { font-size: 12px; color: #8a8a9a; margin-bottom: 20px; }

  /* Two columns: character on the left, options on the right */
  .cr-body { display: flex; gap: 24px; align-items: flex-start; }
  .cr-left { flex: 0 0 300px; position: sticky; top: 70px; }
  .cr-right { flex: 1; min-width: 0; }

  .cr-stage {
    background: #0c0e16; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
    display: flex; justify-content: center; padding: 16px 0;
  }
  .cr-canvas { width: 240px; height: auto; image-rendering: pixelated; display: block; }
  .cr-done {
    width: 100%; margin-top: 12px; background: #d8b23a; color: #0d0d0f; border: none;
    border-radius: 8px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.05em;
    padding: 10px; cursor: pointer;
  }
  .cr-done:hover { opacity: 0.9; }

  @media (max-width: 720px) {
    .cr-body { flex-direction: column; }
    .cr-left { position: static; flex: none; width: 100%; max-width: 300px; }
  }

  .cr-ctrl { margin-bottom: 12px; }
  .cr-label { display: block; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8a9a; margin-bottom: 6px; }
  .cr-btns { display: flex; gap: 5px; flex-wrap: wrap; }

  .cr-btn {
    font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
    background: #181920; border: 1px solid rgba(255,255,255,0.12); border-radius: 5px;
    color: rgba(232,232,236,0.6); padding: 5px 10px; cursor: pointer; transition: all 0.12s;
  }
  .cr-btn:hover { border-color: rgba(216,178,58,0.5); color: #e8e8ec; }
  .cr-btn.sel { border-color: #d8b23a; color: #d8b23a; background: rgba(216,178,58,0.1); }

  .cr-swatch {
    width: 26px; height: 26px; padding: 0; border-radius: 5px;
    border: 1px solid rgba(255,255,255,0.18); cursor: pointer; transition: box-shadow 0.12s;
  }
  .cr-swatch.sel { box-shadow: 0 0 0 2px #e8e8ec; }
  .cr-swatch:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
