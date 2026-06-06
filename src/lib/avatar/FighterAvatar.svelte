<!-- src/lib/avatar/FighterAvatar.svelte -->
<!-- Small static portrait of a fighter in the 'loss' (idle) stance, drawn from
     saved avatar attributes (skin / hair / beard / pants style). Shorts colours
     and gloves use fixed defaults — only the listed attributes are persisted. -->
<script>
  import { renderFighter, hexToRgb, SKIN_TONES, HAIR_COLORS } from '$lib/avatar/fighterRenderer.js';

  // org       → pants pattern override (current division); falls back to avatar.org
  // beltType  → 'gfl' | 'apex' | 'kfc' | 'regional' | null (no belt)
  // beltColor → band colour for the 'regional' belt type
  let { avatar = null, org = null, beltType = null, beltColor = null, gloveColor = null, size = 72 } = $props();
  let canvas;

  const a = $derived(avatar || {});

  $effect(() => {
    if (!canvas) return;
    const tone     = SKIN_TONES[a.skinIdx ?? 0] ?? SKIN_TONES[0];
    const hairHex  = (HAIR_COLORS[a.hairColorIdx  ?? 0] ?? HAIR_COLORS[0]).hex;
    const beardHex = (HAIR_COLORS[a.beardColorIdx ?? 0] ?? HAIR_COLORS[0]).hex;
    const palette = {
      skin:     hexToRgb(tone.base),
      skinSh:   hexToRgb(tone.shadow),
      hair:     hexToRgb(hairHex),
      beard:    hexToRgb(beardHex),
      shorts:   hexToRgb(a.shortsBase || '#181820'),
      shortsTr: hexToRgb(a.shortsTrim || '#e8e8ec'),
      glove:    hexToRgb(gloveColor || '#8f1f1f'),
      belt:     beltColor ? hexToRgb(beltColor) : [216, 178, 58],
    };
    const fc = renderFighter(
      {
        pose: 'loss',
        hair: a.hairStyle || 'short',
        beard: a.beardStyle || 'none',
        org: org || a.org || 'gfl',
        belt: beltType || (beltColor ? 'regional' : 'none'), // 'regional' uses the custom palette.belt colour
      },
      palette,
    );
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    // crop the 32×48 sprite to the figure (head-to-feet ≈ y9..41)
    ctx.drawImage(fc, 0, 9, 32, 32, 0, 0, 32, 32);
  });
</script>

<canvas bind:this={canvas} width="32" height="32" class="fa-canvas" style="width:{size}px;height:{size}px"></canvas>

<style>
  .fa-canvas { image-rendering: pixelated; display: block; }
</style>
