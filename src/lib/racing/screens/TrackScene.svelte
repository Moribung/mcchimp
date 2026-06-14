<!-- src/lib/racing/screens/TrackScene.svelte -->
<!-- The race visualised. Each car's position on the loop comes from its
     continuous race distance (gs.race ... car.dist), so the pack spreads and
     shuffles organically; rank is just the sort order. Cars are baked pixel-art
     sprites rotated to the path tangent. A camera lerps between a zoomed-out
     view (running) and a zoomed-in shot of the player's duel (break/question/
     resolve), where the cars stand still. -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { state as gs } from '$lib/racing/state.svelte.js';
  import { trackById } from '$lib/racing/tracks.js';
  import { SIM } from '$lib/racing/constants.js';
  import { bakeCar, SPRITE_W, SPRITE_H } from '$lib/racing/carSprites.js';

  const NS = 'http://www.w3.org/2000/svg';
  const VB_W = 680, VB_H = 360, CX = VB_W / 2, CY = VB_H / 2;
  const ZOOM_IN = 2.4, CAR_K = 6, CAM_K = 4;
  const DRAW_W = 22, DRAW_H = DRAW_W * (SPRITE_H / SPRITE_W);

  const track = $derived(trackById(gs.race?.trackId));

  let trackEl, camG, carsG, ringsG, kerbsG;
  let raf, L = 1, lastT = null;
  const disp  = new Map();   // id -> display prog (continuous)
  const carEls = new Map();  // id -> <g>
  const rings = {};
  let cam = { s: 1, fx: CX, fy: CY };

  function at(p) {
    const l = (((p % 1) + 1) % 1) * L;
    const a = trackEl.getPointAtLength(l);
    const b = trackEl.getPointAtLength((l + 1.2) % L);
    return { x: a.x, y: a.y, ang: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  function mkRing(color) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', '13'); c.setAttribute('fill', 'none');
    c.setAttribute('stroke', color); c.setAttribute('stroke-width', '2'); c.setAttribute('opacity', '0');
    ringsG.appendChild(c);
    return c;
  }

  function detectCorners(count) {
    const M = 220, pts = [];
    for (let i = 0; i < M; i++) pts.push(trackEl.getPointAtLength((i / M) * L));
    const turn = [];
    for (let i = 0; i < M; i++) {
      const p0 = pts[(i - 3 + M) % M], p1 = pts[i], p2 = pts[(i + 3) % M];
      const a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x), a2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
      turn.push(d);
    }
    const cand = [];
    for (let i = 0; i < M; i++) if (turn[i] >= turn[(i - 1 + M) % M] && turn[i] >= turn[(i + 1) % M] && turn[i] > 0.04) cand.push(i);
    cand.sort((a, b) => turn[b] - turn[a]);
    const chosen = [];
    for (const i of cand) {
      if (chosen.every(j => Math.min(Math.abs(i - j), M - Math.abs(i - j)) > M / (count * 2.2))) chosen.push(i);
      if (chosen.length >= count) break;
    }
    return chosen.map(i => (i / M) * L);
  }

  function buildKerbs(count) {
    try {
      for (const l of detectCorners(count)) {
        const a = trackEl.getPointAtLength(l), b = trackEl.getPointAtLength((l + 1.5) % L);
        const ang = Math.atan2(b.y - a.y, b.x - a.x), nx = -Math.sin(ang), ny = Math.cos(ang);
        for (const side of [-1, 1]) {
          const g = document.createElementNS(NS, 'g');
          g.setAttribute('transform', `translate(${(a.x + nx * 16 * side).toFixed(1)},${(a.y + ny * 16 * side).toFixed(1)}) rotate(${(ang * 180 / Math.PI).toFixed(1)})`);
          let inner = '';
          for (let s = -2; s < 2; s++) inner += `<rect x="${s * 5}" y="-2" width="5" height="4" fill="${s % 2 ? '#d94040' : '#e9e6dd'}"/>`;
          g.innerHTML = inner;
          kerbsG.appendChild(g);
        }
      }
    } catch (e) { /* decorative */ }
  }

  function build() {
    const r = gs.race;
    if (!r) return;
    L = trackEl.getTotalLength();
    carsG.replaceChildren(); ringsG.replaceChildren(); kerbsG.replaceChildren();
    disp.clear(); carEls.clear();
    buildKerbs(track.corners ?? 6);

    r.field.forEach(car => {
      const g = document.createElementNS(NS, 'g');
      const img = document.createElementNS(NS, 'image');
      img.setAttribute('href', bakeCar(car.variant ?? 0, car.color));
      img.setAttribute('width', String(DRAW_W));
      img.setAttribute('height', String(DRAW_H));
      img.setAttribute('x', String(-DRAW_W / 2));
      img.setAttribute('y', String(-DRAW_H / 2));
      img.setAttribute('preserveAspectRatio', 'none');
      g.appendChild(img);
      carsG.appendChild(g);
      carEls.set(car.id, g);
      disp.set(car.id, car.dist / SIM.LAP_DIST);
    });

    rings.player = mkRing('#E8C14A');
    rings.ahead  = mkRing('#3ecf6a');
    rings.behind = mkRing('#e05252');

    const s = at(0);
    const sf = document.createElementNS(NS, 'g');
    sf.setAttribute('transform', `translate(${s.x.toFixed(1)},${s.y.toFixed(1)}) rotate(${(s.ang * 180 / Math.PI).toFixed(1)})`);
    sf.innerHTML = '<rect x="-1.5" y="-15" width="3" height="30" fill="#e9e6dd"/>'
      + '<rect x="-1.5" y="-15" width="3" height="4" fill="#1c2521"/><rect x="-1.5" y="-3" width="3" height="4" fill="#1c2521"/><rect x="-1.5" y="9" width="3" height="4" fill="#1c2521"/>';
    carsG.parentNode.insertBefore(sf, carsG);
  }

  function placeRing(ring, car) {
    if (!car || !disp.has(car.id)) { ring.setAttribute('opacity', '0'); return; }
    const p = at(disp.get(car.id));
    ring.setAttribute('cx', p.x.toFixed(2));
    ring.setAttribute('cy', p.y.toFixed(2));
    ring.setAttribute('opacity', '0.85');
  }

  function frame(t) {
    const r = gs.race;
    if (!r || !trackEl) { raf = requestAnimationFrame(frame); return; }
    if (lastT == null) lastT = t;
    const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    const k = 1 - Math.exp(-CAR_K * dt);
    const field = r.field;

    for (let i = 0; i < field.length; i++) {
      const car = field[i];
      const target = car.dist / SIM.LAP_DIST;
      let dp = disp.get(car.id); if (dp == null) dp = target;
      dp += (target - dp) * k;
      disp.set(car.id, dp);
      const p = at(dp);
      const lane = (i % 2 ? 1 : -1) * 4;
      const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
      const el = carEls.get(car.id);
      if (el) el.setAttribute('transform',
        `translate(${(p.x + nx * lane).toFixed(2)},${(p.y + ny * lane).toFixed(2)}) rotate(${(p.ang * 180 / Math.PI).toFixed(2)})`);
    }

    const zoomIn = r.phase !== 'running';
    let tcam;
    if (zoomIn) {
      const pc = field[r.playerIdx];
      const pp = pc && disp.has(pc.id) ? at(disp.get(pc.id)) : { x: CX, y: CY };
      tcam = { s: ZOOM_IN, fx: pp.x, fy: pp.y };
    } else {
      tcam = { s: 1, fx: CX, fy: CY };
    }
    const ck = 1 - Math.exp(-CAM_K * dt);
    cam.s += (tcam.s - cam.s) * ck; cam.fx += (tcam.fx - cam.fx) * ck; cam.fy += (tcam.fy - cam.fy) * ck;
    if (camG) camG.setAttribute('transform',
      `translate(${CX},${CY}) scale(${cam.s.toFixed(3)}) translate(${(-cam.fx).toFixed(2)},${(-cam.fy).toFixed(2)})`);

    if (r.phase === 'running') {
      rings.player?.setAttribute('opacity', '0');
      rings.ahead?.setAttribute('opacity', '0');
      rings.behind?.setAttribute('opacity', '0');
    } else {
      placeRing(rings.player, field[r.playerIdx]);
      const d = r.duel;
      placeRing(rings.ahead,  (d?.type === 'attack' || d?.type === 'sandwich') ? field[r.playerIdx - 1] : null);
      placeRing(rings.behind, (d?.type === 'defend' || d?.type === 'sandwich') ? field[r.playerIdx + 1] : null);
    }

    raf = requestAnimationFrame(frame);
  }

  onMount(() => { build(); raf = requestAnimationFrame(frame); });
  onDestroy(() => cancelAnimationFrame(raf));
</script>

<div class="track-frame">
  <svg width="100%" viewBox="0 0 {VB_W} {VB_H}" role="img" aria-label="Race track with cars in running order">
    <rect x="0" y="0" width={VB_W} height={VB_H} fill="#1c2521"/>
    <g bind:this={camG}>
      <path bind:this={trackEl} d={track.d} fill="none" stroke="#23282b" stroke-width="40" stroke-linejoin="round"/>
      <path d={track.d} fill="none" stroke="#3a4047" stroke-width="32" stroke-linejoin="round"/>
      <path d={track.d} fill="none" stroke="#e9e6dd" stroke-width="1.5" stroke-dasharray="6 12" opacity="0.3"/>
      <g bind:this={kerbsG}></g>
      <g bind:this={ringsG}></g>
      <g bind:this={carsG}></g>
    </g>
  </svg>
</div>

<style>
  .track-frame { border: 1px solid var(--border); border-radius: 6px; overflow: hidden; line-height: 0; }
  .track-frame svg { display: block; }
</style>
