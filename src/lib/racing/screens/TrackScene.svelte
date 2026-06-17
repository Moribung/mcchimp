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
  // Lanes: everyone runs the inner line; a car pulls out to the outer line to
  // pass. A big forward jump (a duel pass, incl. a +2 lunge) runs a staged
  // move — swing wide first, THEN surge past, THEN tuck back in — so a passing
  // car never clips the car(s) it's going by.
  const LANE = 7, LANE_K = 6, VSMOOTH = 0.15, SIDE_BY_SIDE = 46, PASS_TRIGGER = 0.03, LANE_HOLD = 0.22, CLOSE_MIN = 1.2;
  // Once a pass is done, pull back to the inner line as soon as the car you
  // passed is this far clear behind (less than PASS_GAP, so you don't get stuck out).
  const INNER_CLEAR = 28;
  // A pass accelerates rather than teleporting: ramp up to SURGE_MAX, then ease
  // back toward cruise as the gap closes.
  const SURGE_MAX = 0.22, SURGE_ACCEL = 7, CRUISE_V = 0.08;
  // A small pit bay at the start/finish: AI cars occasionally peel in, vanish
  // under the roof, and rejoin. (The player's stop is its own screen.)
  const PIT_DEPTH = 30, AI_PIT_CHANCE = 0.1, PIT_IN = 0.9, PIT_PARK = 2.4, PIT_OUT = 0.9, PIT_FWD = 50;
  // Starting grid: the packed field with an alternating lateral stagger.
  const GRID_COL = 7;
  let boxX = CX, boxY = CY, entryAng = 0, boxAng = 0;
  let pitPathEl = null, pitLen = 0, boxLen = 0, pitExitDist = 0;

  const track = $derived(trackById(gs.race?.trackId));

  let trackEl, camG, carsG, ringsG, kerbsG;
  let raf, L = 1, lastT = null, centroidX = CX, centroidY = CY;
  const cs = new Map();      // id -> { prog, vSmooth, lane }
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
    cs.clear(); carEls.clear();
    buildKerbs(track.corners ?? 6);

    // Loop centroid → tells us which side of the path is the inner line.
    let sx = 0, sy = 0, N = 80;
    for (let i = 0; i < N; i++) { const a = trackEl.getPointAtLength((i / N) * L); sx += a.x; sy += a.y; }
    centroidX = sx / N; centroidY = sy / N;

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
      cs.set(car.id, { prog: car.dist / SIM.LAP_DIST, vSmooth: 0, lane: 0, pass: null, vSurge: 0, outer: false, outerT: 0, gPrev: Infinity, closeV: 0, aheadId: null, pitState: null, pitT: 0, pitLap: null });
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

    // ── Pit lane + bay, just inside the line ──
    entryAng = s.ang;
    const nx0 = -Math.sin(s.ang), ny0 = Math.cos(s.ang);
    const inSign = ((centroidX - s.x) * nx0 + (centroidY - s.y) * ny0) >= 0 ? 1 : -1;
    const tx = Math.cos(s.ang), ty = Math.sin(s.ang);
    const inx = nx0 * inSign, iny = ny0 * inSign;
    const e2 = trackEl.getPointAtLength(PIT_FWD % L);
    // A lane that peels in off the line, bows inward to the box, and rejoins ahead.
    const c1x = s.x + tx * 14 + inx * PIT_DEPTH, c1y = s.y + ty * 14 + iny * PIT_DEPTH;
    const c2x = e2.x - tx * 14 + inx * PIT_DEPTH, c2y = e2.y - ty * 14 + iny * PIT_DEPTH;
    const dPit = `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${e2.x.toFixed(1)} ${e2.y.toFixed(1)}`;

    pitPathEl = document.createElementNS(NS, 'path');
    pitPathEl.setAttribute('d', dPit);
    pitPathEl.setAttribute('fill', 'none');
    pitPathEl.setAttribute('stroke', '#33383f');
    pitPathEl.setAttribute('stroke-width', '11');
    pitPathEl.setAttribute('stroke-linecap', 'round');
    camG.insertBefore(pitPathEl, carsG);
    const pitEdge = document.createElementNS(NS, 'path');
    pitEdge.setAttribute('d', dPit);
    pitEdge.setAttribute('fill', 'none'); pitEdge.setAttribute('stroke', '#e9e6dd');
    pitEdge.setAttribute('stroke-width', '1'); pitEdge.setAttribute('stroke-dasharray', '4 6'); pitEdge.setAttribute('opacity', '0.3');
    camG.insertBefore(pitEdge, carsG);

    pitLen = pitPathEl.getTotalLength();
    boxLen = pitLen * 0.5;
    const bp = pitPathEl.getPointAtLength(boxLen);
    const bp2 = pitPathEl.getPointAtLength(Math.min(boxLen + 1, pitLen));
    boxX = bp.x; boxY = bp.y; boxAng = Math.atan2(bp2.y - bp.y, bp2.x - bp.x);
    pitExitDist = (PIT_FWD / L) * SIM.LAP_DIST;
    const roofAng = (boxAng * 180 / Math.PI).toFixed(1);

    const floor = document.createElementNS(NS, 'rect');
    floor.setAttribute('x', (boxX - 14).toFixed(1)); floor.setAttribute('y', (boxY - 10).toFixed(1));
    floor.setAttribute('width', '28'); floor.setAttribute('height', '20'); floor.setAttribute('rx', '2'); floor.setAttribute('fill', '#2b2f35');
    camG.insertBefore(floor, carsG);
    const roof = document.createElementNS(NS, 'g');
    roof.setAttribute('transform', `translate(${boxX.toFixed(1)},${boxY.toFixed(1)}) rotate(${roofAng})`);
    roof.innerHTML = '<rect x="-17" y="-12" width="34" height="24" rx="3" fill="#11161b" stroke="#3a4047" stroke-width="1"/>'
      + '<rect x="-17" y="-12" width="34" height="5" rx="3" fill="#3ecf6a" opacity="0.55"/>';
    camG.appendChild(roof);

    // Clear any stale pit flags from a previous mount.
    r.field.forEach(c => { c.pitting = false; });
  }

  function placeRing(ring, car) {
    const st = car && cs.get(car.id);
    if (!st) { ring.setAttribute('opacity', '0'); return; }
    const p = at(st.prog);
    const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
    ring.setAttribute('cx', (p.x + nx * st.lane).toFixed(2));
    ring.setAttribute('cy', (p.y + ny * st.lane).toFixed(2));
    ring.setAttribute('opacity', '0.85');
  }

  function frame(t) {
    const r = gs.race;
    if (!r || !trackEl) { raf = requestAnimationFrame(frame); return; }
    if (lastT == null) lastT = t;
    const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    const k = 1 - Math.exp(-CAR_K * dt);
    const laneK = 1 - Math.exp(-LANE_K * dt);
    const field = r.field;

    for (let i = 0; i < field.length; i++) {
      const car = field[i];
      const target = car.dist / SIM.LAP_DIST;
      let st = cs.get(car.id);
      if (!st) { st = { prog: target, vSmooth: 0, lane: 0, pass: null, vSurge: 0, outer: false, outerT: 0, gPrev: Infinity, closeV: 0, aheadId: null, pitState: null, pitT: 0, pitLap: null }; cs.set(car.id, st); }

      // Side of the track, from the current position.
      const pc = at(st.prog);
      const innerSign = ((centroidX - pc.x) * (-Math.sin(pc.ang)) + (centroidY - pc.y) * Math.cos(pc.ang)) >= 0 ? 1 : -1;

      const ahead  = i > 0 ? field[i - 1] : null;
      const behind = i < field.length - 1 ? field[i + 1] : null;
      const aSt = ahead ? cs.get(ahead.id) : null;
      const bSt = behind ? cs.get(behind.id) : null;
      const gapAhead  = ahead ? ahead.dist - car.dist : Infinity;
      const gapBehind = behind ? car.dist - behind.dist : Infinity;
      // Lane intent updates only while racing. During the frozen duel (break/
      // question/resolve) it HOLDS, so a car already on the outer line when the
      // zoom-in hit (e.g. mid-overtake) stays out instead of tucking back in.
      // Pull out only to OVERTAKE the car ahead (clearly faster while alongside)
      // or during a staged pass; latch on, releasing once you've cleared behind.
      if (r.phase === 'running') {
        // Closing rate to the car ahead. Drafting in a clamped tow ≈ 0 (you stay
        // inner); a real run at the car ahead is clearly positive (you pull out).
        // Using the gap's motion instead of a noisy speed compare kills the
        // matched-speed ping. Reset when the car ahead changes or in clear air.
        const aheadId = ahead ? ahead.id : null;
        if (ahead && aheadId === st.aheadId && st.gPrev < Infinity) {
          st.closeV += ((st.gPrev - gapAhead) / dt - st.closeV) * 0.25;
        } else {
          st.closeV = 0;
        }
        st.gPrev = gapAhead; st.aheadId = aheadId;

        if (!st.pass && target - st.prog > PASS_TRIGGER) st.pass = 'out';
        const attackingAhead = !!aSt && gapAhead < SIDE_BY_SIDE && st.closeV > CLOSE_MIN;
        // Outer to pass the car ahead, or to finish clearing the one you passed.
        // Debounced: the intent must hold for LANE_HOLD before the car switches;
        // a staged duel pass commits immediately.
        const want = st.pass || attackingAhead || (st.outer && !!bSt && gapBehind < INNER_CLEAR);
        if (st.pass) { st.outer = true; st.outerT = 0; }
        else if (want !== st.outer) { st.outerT += dt; if (st.outerT >= LANE_HOLD) { st.outer = want; st.outerT = 0; } }
        else st.outerT = 0;
      }

      // AI cars occasionally peel into the pit bay as they cross the line.
      if (r.phase === 'running' && !car.isPlayer && !car.pitting) {
        const lap = Math.floor(car.dist / SIM.LAP_DIST);
        if (st.pitLap != null && lap > st.pitLap && Math.random() < AI_PIT_CHANCE) {
          car.pitting = true; st.pitState = 'in'; st.pitT = 0;
        }
        st.pitLap = lap;
      }

      if (r.phase === 'grid') {
        st.lane = (i % 2 ? 1 : -1) * GRID_COL;   // staggered starting formation
      } else {
        const laneTarget = (st.outer ? -innerSign : innerSign) * LANE;
        st.lane += (laneTarget - st.lane) * laneK;
      }

      // Forward motion: while swinging out, HOLD until wide; then ACCELERATE
      // through the pass (ramp up to a surge speed, ease back near the end).
      if (st.pass === 'out' && Math.abs(st.lane - (-innerSign * LANE)) < 2.5) { st.pass = 'surge'; st.vSurge = CRUISE_V; }
      const prog0 = st.prog;
      if (st.pass === 'surge') {
        const gap = target - st.prog;
        const vt = Math.min(SURGE_MAX, CRUISE_V + gap * 1.6);   // ease back toward cruise as the gap closes
        st.vSurge += (vt - st.vSurge) * (1 - Math.exp(-SURGE_ACCEL * dt));
        st.prog += st.vSurge * dt;
        if (target - st.prog < 0.002) { st.prog = target; st.pass = null; }
      } else if (st.pass !== 'out') {
        st.prog += (target - st.prog) * k;
      }

      const instV = dt > 0 ? (st.prog - prog0) / dt : 0;
      st.vSmooth += (instV - st.vSmooth) * VSMOOTH;

      const p = at(st.prog);
      let rx, ry, rang;
      if (car.pitting && st.pitState) {
        // Drive the pit lane in, sit under the roof, drive out, rejoin ahead.
        st.pitT += dt;
        if (st.pitState === 'in') {
          const u = Math.min(1, st.pitT / PIT_IN), l = u * boxLen;
          const a = pitPathEl.getPointAtLength(l), b2 = pitPathEl.getPointAtLength(Math.min(l + 1, boxLen));
          rx = a.x; ry = a.y; rang = Math.atan2(b2.y - a.y, b2.x - a.x);
          if (u >= 1) { st.pitState = 'parked'; st.pitT = 0; }
        } else if (st.pitState === 'parked') {
          rx = boxX; ry = boxY; rang = boxAng;
          if (st.pitT >= PIT_PARK) { st.pitState = 'out'; st.pitT = 0; }
        } else {
          const u = Math.min(1, st.pitT / PIT_OUT), l = boxLen + u * (pitLen - boxLen);
          const a = pitPathEl.getPointAtLength(l), b2 = pitPathEl.getPointAtLength(Math.min(l + 1, pitLen));
          rx = a.x; ry = a.y; rang = Math.atan2(b2.y - a.y, b2.x - a.x);
          if (u >= 1) { car.dist += pitExitDist; st.prog = car.dist / SIM.LAP_DIST; st.pitState = null; car.pitting = false; }
        }
      } else {
        const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
        rx = p.x + nx * st.lane; ry = p.y + ny * st.lane; rang = p.ang;
      }
      const el = carEls.get(car.id);
      if (el) el.setAttribute('transform',
        `translate(${rx.toFixed(2)},${ry.toFixed(2)}) rotate(${(rang * 180 / Math.PI).toFixed(2)})`);
    }

    const zoomIn = r.phase === 'break' || r.phase === 'question' || r.phase === 'resolve' || r.phase === 'pitdecision';
    let tcam;
    if (zoomIn) {
      const pc = field[r.playerIdx];
      const pst = pc && cs.get(pc.id);
      const pp = pst ? at(pst.prog) : { x: CX, y: CY };
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
