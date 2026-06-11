<!-- Top-down pixel map of the current hole. 192×96 logical px, CSS-upscaled. -->
<script>
  import { MAP_W, MAP_H } from './constants.js';
  import { buildGrid, renderTerrain } from './terrain.js';

  let {
    hole,
    ball = [0, 0],          // resting ball position (map px)
    aimAngle = null,        // radians; draws the aim arrow when set
    aimLenPx = 26,          // arrow length in map px (power preview)
    aiming = false,         // pointer aiming enabled
    onaim = () => {},
    anim = null,            // { path: [{x,y,mode}], id } — plays when id changes
    onanimdone = () => {},
  } = $props();

  let canvas;
  let terrainCv = null;
  let raf = 0;
  let lastAnimId = null;
  let animState = null;     // { points, times, total, start }

  $effect(() => {
    if (!hole) return;
    const grid = buildGrid(hole);
    terrainCv = renderTerrain(grid);
  });

  let fallbackTimer = 0;

  $effect(() => {
    if (anim && anim.id !== lastAnimId && anim.path?.length) {
      lastAnimId = anim.id;
      animState = buildAnim(anim.path);
      // rAF is suspended in hidden tabs — make sure the shot still resolves
      // so the game never stalls waiting for the animation.
      clearTimeout(fallbackTimer);
      const token = animState;
      fallbackTimer = setTimeout(() => {
        if (animState === token) {
          animState = null;
          onanimdone();
        }
      }, animState.total * 1000 + 600);
    }
    return () => clearTimeout(fallbackTimer);
  });

  // Constant-speed flight, ease-out roll. Returns cumulative time per point.
  function buildAnim(path) {
    const FLIGHT_PXPS = 110;   // map px per second
    const ROLL_PXPS   = 36;
    const times = [0];
    let t = 0;
    for (let i = 1; i < path.length; i++) {
      const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      const rollLeft = path.length - i;
      const speed = path[i].mode === 'flight'
        ? FLIGHT_PXPS
        : ROLL_PXPS * Math.max(0.25, Math.min(1, rollLeft / 14)); // decelerate
      t += d / speed;
      times.push(t);
    }
    return { points: path, times, total: Math.max(t, 0.25), start: performance.now() };
  }

  function animPos(now) {
    if (!animState) return null;
    const el = (now - animState.start) / 1000;
    if (el >= animState.total) return { done: true };
    const { points, times } = animState;
    let i = 1;
    while (i < times.length && times[i] < el) i++;
    if (i >= points.length) return { done: true };
    const t0 = times[i - 1], t1 = times[i];
    const f = t1 > t0 ? (el - t0) / (t1 - t0) : 1;
    const p0 = points[i - 1], p1 = points[i];
    return {
      x: p0.x + (p1.x - p0.x) * f,
      y: p0.y + (p1.y - p0.y) * f,
      mode: p1.mode,
      frac: el / animState.total,
    };
  }

  $effect(() => {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function draw(now) {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, MAP_W, MAP_H);
      if (terrainCv) ctx.drawImage(terrainCv, 0, 0);
      if (!hole) return;

      drawTee(ctx);
      drawPin(ctx, now);

      // Ball (animated or at rest)
      let bx = ball[0], by = ball[1], inFlight = false;
      if (animState) {
        const p = animPos(now);
        if (p?.done) {
          animState = null;
          onanimdone();
        } else if (p) {
          bx = p.x; by = p.y; inFlight = p.mode === 'flight';
        }
      }

      // Aim arrow (under the ball)
      if (aimAngle !== null && !animState) drawAim(ctx, bx, by);

      drawBall(ctx, bx, by, inFlight);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  });

  function drawTee(ctx) {
    ctx.fillStyle = '#2a4a2a';
    ctx.fillRect(Math.round(hole.tee[0]) - 2, Math.round(hole.tee[1]), 1, 1);
    ctx.fillRect(Math.round(hole.tee[0]) + 2, Math.round(hole.tee[1]), 1, 1);
  }

  function drawPin(ctx, now) {
    const [px, py] = hole.pin.map(Math.round);
    // cup
    ctx.fillStyle = '#1a2e1a';
    ctx.fillRect(px, py, 1, 1);
    // pole
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(px, py - 6, 1, 6);
    // flag (waves)
    ctx.fillStyle = '#e05252';
    const wave = Math.floor(now / 450) % 2 === 0;
    ctx.fillRect(px + 1, py - 6, wave ? 3 : 2, 2);
  }

  function drawBall(ctx, x, y, inFlight) {
    const ix = Math.round(x), iy = Math.round(y);
    if (inFlight) {
      // shadow + bigger ball = height illusion
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(ix + 1, iy + 1, 1, 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ix - 1, iy - 1, 2, 2);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(ix, iy + 1, 1, 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ix, iy, 1, 1);
    }
  }

  function drawAim(ctx, bx, by) {
    const len = Math.max(8, aimLenPx);
    const ex = bx + Math.cos(aimAngle) * len;
    const ey = by + Math.sin(aimAngle) * len;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(bx + 0.5, by + 0.5);
    ctx.lineTo(ex + 0.5, ey + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    // arrowhead
    const a = aimAngle;
    ctx.beginPath();
    ctx.moveTo(ex + 0.5, ey + 0.5);
    ctx.lineTo(ex + 0.5 - Math.cos(a - 0.5) * 4, ey + 0.5 - Math.sin(a - 0.5) * 4);
    ctx.moveTo(ex + 0.5, ey + 0.5);
    ctx.lineTo(ex + 0.5 - Math.cos(a + 0.5) * 4, ey + 0.5 - Math.sin(a + 0.5) * 4);
    ctx.stroke();
  }

  /* ── Pointer aiming ─────────────────────────────────── */
  function pointToMap(e) {
    const r = canvas.getBoundingClientRect();
    return [
      ((e.clientX - r.left) / r.width) * MAP_W,
      ((e.clientY - r.top) / r.height) * MAP_H,
    ];
  }

  function handlePointer(e) {
    if (!aiming || animState) return;
    const [mx, my] = pointToMap(e);
    onaim(Math.atan2(my - ball[1], mx - ball[0]));
  }

  let dragging = false;
</script>

<canvas
  bind:this={canvas}
  width={MAP_W}
  height={MAP_H}
  class="course-canvas"
  class:aiming
  onpointerdown={(e) => { dragging = true; canvas.setPointerCapture(e.pointerId); handlePointer(e); }}
  onpointermove={(e) => { if (dragging) handlePointer(e); }}
  onpointerup={() => { dragging = false; }}
  onpointercancel={() => { dragging = false; }}
></canvas>

<style>
  .course-canvas {
    display: block;
    width: 100%;
    max-width: 576px;
    aspect-ratio: 2 / 1;
    image-rendering: pixelated;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: #0e2415;
    touch-action: none;
  }
  .course-canvas.aiming { cursor: crosshair; }
</style>
