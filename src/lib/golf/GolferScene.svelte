<!-- The golfer window: 64×64 pixel canvas, sprite sheets with procedural fallback. -->
<script>
  import { FRAME, GOLFER_ANIMS, loadSheets, drawPlaceholder } from './golferSprites.js';

  let {
    anim = 'idle',          // key of GOLFER_ANIMS
    meterValue = 0,         // 0..1 — drives the windup frame
    onanimend = () => {},   // fires once when a non-looping anim finishes
  } = $props();

  let canvas;
  let sheets = null;
  let raf = 0;
  let animStart = 0;
  let endedFor = null;      // anim name we already fired onanimend for
  let lastAnim = null;

  $effect(() => {
    // restart timing when the animation changes
    if (anim !== lastAnim) {
      lastAnim = anim;
      animStart = performance.now();
      endedFor = null;
    }
  });

  $effect(() => {
    sheets = loadSheets();
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function draw(now) {
      raf = requestAnimationFrame(draw);
      const def = GOLFER_ANIMS[anim] || GOLFER_ANIMS.idle;

      let frame;
      if (anim === 'windup') {
        frame = Math.round(meterValue * (def.frames - 1));
      } else {
        const el = (now - animStart) / 1000;
        const raw = Math.floor(el * def.fps);
        if (def.loop) {
          frame = raw % def.frames;
        } else {
          frame = Math.min(raw, def.frames - 1);
          if (raw >= def.frames && endedFor !== anim) {
            endedFor = anim;
            onanimend(anim);
          }
        }
      }

      const sheet = sheets[anim];
      ctx.clearRect(0, 0, FRAME, FRAME);
      if (sheet?.ready) {
        ctx.drawImage(sheet.img, frame * FRAME, 0, FRAME, FRAME, 0, 0, FRAME, FRAME);
      } else {
        drawPlaceholder(ctx, anim, frame, def.frames);
      }
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  });
</script>

<canvas bind:this={canvas} width={FRAME} height={FRAME} class="golfer-canvas"></canvas>

<style>
  .golfer-canvas {
    display: block;
    width: 100%;
    max-width: 224px;
    aspect-ratio: 1 / 1;
    image-rendering: pixelated;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: linear-gradient(180deg, #16324a 0%, #1d4424 62%, #245428 100%);
  }
</style>
