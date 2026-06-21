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
  // Lanes come from the sim (car.lane — a lateral px offset; 0 = racing line).
  // The renderer just smooths to them and, as a hard guarantee, nudges any two
  // sprites apart if they'd ever touch (covers duel passes + lane transitions).
  const SEP_LONG = 22, SEP_LAT = 21, LANE_MAX = 16, REJOIN_GAP = 24;
  // Racing line: cars hug the INSIDE of the corner they're in (eases to centre
  // on straights, flips smoothly through S-curves), with passing offsets on top.
  const RACE_LINE = 8, RACE_GAIN = 55;
  const FALTER_DUR = 0.9, FALTER_AMP = 8, FALTER_YAW = 0.18;   // wobble after a botched duel: px sway, radian nose-twitch
  // Pit complex set back in the infield: a lane branches off the start/finish,
  // runs in to a garage block, AI park under the roof, then rejoin ahead.
  const AI_PIT_CHANCE = 0.25, PIT_IN = 1.1, PIT_PARK = 2.4, PIT_OUT = 1.1;
  const PIT_SPAN = 110, OFFSET = 36;   // pit lane runs PIT_SPAN of track, offset OFFSET to the side
  // Starting grid: the packed field with an alternating lateral stagger.
  const GRID_COL = 7;
  let boxX = CX, boxY = CY, entryAng = 0, boxAng = 0;
  let pitPathEl = null, pitLen = 0, boxLen = 0, pitExitDist = 0, pitStartFrac = 0;

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

  // Inside-of-corner offset (left-normal px) from the local turn direction: the
  // tangent rotating left (dA>0) means a left corner, whose inside is +Ln. Eases
  // to 0 on straights and flips smoothly through an S-curve's inflection.
  function racingLine(prog) {
    const d = 7 / L;
    let dA = at(prog + d).ang - at(prog - d).ang;
    while (dA > Math.PI) dA -= 2 * Math.PI;
    while (dA < -Math.PI) dA += 2 * Math.PI;
    return Math.max(-RACE_LINE, Math.min(RACE_LINE, dA * RACE_GAIN));
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
      cs.set(car.id, { prog: car.dist / SIM.LAP_DIST, off: 0, pitState: null, pitT: 0, prevFrac: null });
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

    // ── Pit lane: a tapered sideways offset of the track, on its longest
    // straight — so it leaves/rejoins tangentially and the garages sit in clear
    // space (offsetting on a corner would land on the adjacent track). ──
    // NOTE: at() takes a fraction of the lap (0..1), not a length.
    const findStraight = () => {
      const M = 160, ang = [];
      for (let i = 0; i < M; i++) ang.push(at(i / M).ang);
      const turn = (i) => { let d = Math.abs(ang[(i + 1) % M] - ang[i]); if (d > Math.PI) d = 2 * Math.PI - d; return d; };
      let bestLen = 0, bestStart = 0, curLen = 0, curStart = 0;
      for (let i = 0; i < M * 2; i++) {
        const k = i % M;
        if (turn(k) < 0.045) { if (curLen === 0) curStart = i; curLen++; if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; } }
        else curLen = 0;
      }
      return { centreFrac: ((bestStart + bestLen / 2) % M) / M, lenPx: (bestLen / M) * L };
    };
    const straight = findStraight();
    const span = Math.min(PIT_SPAN, Math.max(70, straight.lenPx - 8));   // px of track length
    const spanFrac = span / L;
    pitStartFrac = (((straight.centreFrac - spanFrac / 2) % 1) + 1) % 1;
    if (gs.race) gs.race.pitEntryFrac = pitStartFrac;   // tell the orchestrator where the pit lane begins
    const cpt = at(straight.centreFrac);
    const inSign = ((centroidX - cpt.x) * (-Math.sin(cpt.ang)) + (centroidY - cpt.y) * Math.cos(cpt.ang)) >= 0 ? 1 : -1;
    entryAng = at(pitStartFrac).ang;
    const PN = 28;
    let dPit = '';
    for (let i = 0; i <= PN; i++) {
      const a = at(pitStartFrac + (i / PN) * spanFrac);
      const taper = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / PN);   // 0→1→0, flat (tangent) at both ends
      const nx = -Math.sin(a.ang), ny = Math.cos(a.ang);
      const off = OFFSET * taper * inSign;
      dPit += (i === 0 ? 'M ' : 'L ') + (a.x + nx * off).toFixed(1) + ' ' + (a.y + ny * off).toFixed(1) + ' ';
    }

    pitPathEl = document.createElementNS(NS, 'path');
    pitPathEl.setAttribute('d', dPit);
    pitPathEl.setAttribute('fill', 'none');
    pitPathEl.setAttribute('stroke', '#33383f');
    pitPathEl.setAttribute('stroke-width', '12');
    pitPathEl.setAttribute('stroke-linejoin', 'round');
    pitPathEl.setAttribute('stroke-linecap', 'round');
    camG.insertBefore(pitPathEl, carsG);
    const pitEdge = document.createElementNS(NS, 'path');
    pitEdge.setAttribute('d', dPit);
    pitEdge.setAttribute('fill', 'none'); pitEdge.setAttribute('stroke', '#e9e6dd');
    pitEdge.setAttribute('stroke-width', '1'); pitEdge.setAttribute('stroke-dasharray', '5 7'); pitEdge.setAttribute('opacity', '0.35');
    camG.insertBefore(pitEdge, carsG);

    pitLen = pitPathEl.getTotalLength();
    boxLen = pitLen * 0.5;
    const bp = pitPathEl.getPointAtLength(boxLen);
    const bp2 = pitPathEl.getPointAtLength(Math.min(boxLen + 1, pitLen));
    boxX = bp.x; boxY = bp.y; boxAng = Math.atan2(bp2.y - bp.y, bp2.x - bp.x);
    pitExitDist = (span / L) * SIM.LAP_DIST;
    const deg = (boxAng * 180 / Math.PI).toFixed(1);

    // Garage block behind the pit lane (a touch further to the same side).
    const bnx = -Math.sin(boxAng) * inSign, bny = Math.cos(boxAng) * inSign;
    const gX = boxX + bnx * 19, gY = boxY + bny * 19;
    const garage = document.createElementNS(NS, 'g');
    garage.setAttribute('transform', `translate(${gX.toFixed(1)},${gY.toFixed(1)}) rotate(${deg})`);
    let gi = '<rect x="-36" y="-11" width="72" height="22" rx="2" fill="#1a1f24" stroke="#3a4047" stroke-width="1.5"/>';
    for (let d = -27; d <= 27; d += 13.5) gi += `<rect x="${(d - 5).toFixed(1)}" y="-7" width="10" height="11" rx="1" fill="#0d1116" stroke="#2b3036" stroke-width="1"/>`;
    gi += '<rect x="-36" y="-11" width="72" height="4" rx="2" fill="#3ecf6a" opacity="0.5"/>';
    garage.innerHTML = gi;
    camG.insertBefore(garage, carsG);

    // Pit-lane apron + box marking (under the cars).
    const floor = document.createElementNS(NS, 'g');
    floor.setAttribute('transform', `translate(${boxX.toFixed(1)},${boxY.toFixed(1)}) rotate(${deg})`);
    floor.innerHTML = '<rect x="-40" y="-8" width="80" height="16" rx="2" fill="#2b2f35"/>'
      + '<rect x="-11" y="-8" width="22" height="16" rx="1" fill="none" stroke="#3ecf6a" stroke-width="1" opacity="0.5"/>';
    camG.insertBefore(floor, carsG);

    // Roof overhang over the box — fully hides the parked car (drawn on top).
    const roof = document.createElementNS(NS, 'g');
    roof.setAttribute('transform', `translate(${boxX.toFixed(1)},${boxY.toFixed(1)}) rotate(${deg})`);
    roof.innerHTML = '<rect x="-15" y="-9" width="30" height="18" rx="2" fill="#11161b" stroke="#3a4047" stroke-width="1"/>'
      + '<rect x="-15" y="-9" width="30" height="4" rx="2" fill="#3ecf6a" opacity="0.5"/>';
    camG.appendChild(roof);

    // Clear any stale pit flags from a previous mount.
    r.field.forEach(c => { c.pitting = false; });
  }

  function placeRing(ring, car) {
    const st = car && cs.get(car.id);
    if (!st) { ring.setAttribute('opacity', '0'); return; }
    const p = at(st.prog);
    const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
    const off = st.off ?? 0;
    ring.setAttribute('cx', (p.x + nx * off).toFixed(2));
    ring.setAttribute('cy', (p.y + ny * off).toFixed(2));
    ring.setAttribute('opacity', '0.85');
  }

  function frame(t) {
    const r = gs.race;
    if (!r || !trackEl) { raf = requestAnimationFrame(frame); return; }
    if (lastT == null) lastT = t;
    const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    const k = 1 - Math.exp(-CAR_K * dt);
    const field = r.field;
    let playerRX = null, playerRY = null;   // where the player actually drew this frame (for the camera)
    const setTf = (car, rx, ry, rang) => {
      const el = carEls.get(car.id);
      if (el) el.setAttribute('transform', `translate(${rx.toFixed(2)},${ry.toFixed(2)}) rotate(${(rang * 180 / Math.PI).toFixed(2)})`);
      if (car.isPlayer) { playerRX = rx; playerRY = ry; }
    };

    // ── Pass 1: advance render state; draw pit cars now, collect track cars ──
    const draw = [];   // { car, st, lane } for cars out on the circuit
    for (let i = 0; i < field.length; i++) {
      const car = field[i];
      let st = cs.get(car.id);
      if (!st) { st = { prog: car.dist / SIM.LAP_DIST, off: 0, pitState: null, pitT: 0, prevFrac: null }; cs.set(car.id, st); }

      // AI cars occasionally peel into the pit lane as they reach the entry.
      if (r.phase === 'running' && !car.isPlayer && !car.pitting) {
        const frac = ((car.dist / SIM.LAP_DIST) % 1 + 1) % 1;
        if (st.prevFrac != null && st.prevFrac < pitStartFrac && frac >= pitStartFrac && Math.random() < AI_PIT_CHANCE) {
          car.pitting = true; st.pitState = 'in'; st.pitT = 0;
        }
        st.prevFrac = frac;
      }
      // The player's pit (flag set by the orchestrator on 'Box') starts here.
      if (car.pitting && !st.pitState) { st.pitState = 'in'; st.pitT = 0; }

      // Smooth the loop position toward the sim distance.
      st.prog += (car.dist / SIM.LAP_DIST - st.prog) * k;

      if (car.pitting && st.pitState) {
        // Drive the pit lane in, sit under the roof, drive out, rejoin ahead.
        // Progresses while racing (and during the player's own 'pitenter');
        // during the frozen duel everything holds.
        const racing = r.phase === 'running' || (r.phase === 'pitenter' && car.isPlayer);
        if (racing) st.pitT += dt;
        let rx, ry, rang;
        if (st.pitState === 'in') {
          const u = Math.min(1, st.pitT / PIT_IN), l = u * boxLen;
          const a = pitPathEl.getPointAtLength(l), b2 = pitPathEl.getPointAtLength(Math.min(l + 1, boxLen));
          rx = a.x; ry = a.y; rang = Math.atan2(b2.y - a.y, b2.x - a.x);
          if (u >= 1 && racing) {
            if (car.isPlayer && r.phase === 'pitenter') gs.race.phase = 'pit';   // hand off to the pit-stop screen
            else { st.pitState = 'parked'; st.pitT = 0; }
          }
        } else if (st.pitState === 'parked') {
          rx = boxX; ry = boxY; rang = boxAng;
          if (st.pitT >= PIT_PARK && racing) { st.pitState = 'out'; st.pitT = 0; }
        } else {
          const u = Math.min(1, st.pitT / PIT_OUT), l = boxLen + u * (pitLen - boxLen);
          const a = pitPathEl.getPointAtLength(l), b2 = pitPathEl.getPointAtLength(Math.min(l + 1, pitLen));
          rx = a.x; ry = a.y; rang = Math.atan2(b2.y - a.y, b2.x - a.x);
          if (u >= 1 && racing) {
            // Rejoin in a clear gap (don't land on top of a car at the exit).
            const LAP = SIM.LAP_DIST;
            const circ = (a, b) => { const x = Math.abs((a - b) % LAP); return Math.min(x, LAP - x); };
            let d = car.dist + pitExitDist;
            for (let t = 0; t < 10; t++) { if (!field.some(o => o !== car && !o.pitting && circ(o.dist, d) < REJOIN_GAP)) break; d -= REJOIN_GAP; }
            car.dist = d; st.prog = d / LAP; st.prevFrac = ((st.prog % 1) + 1) % 1;
            car.lane = 0; car.laneT = 0; car.passing = false;   // rejoin clean on the racing line
            st.pitState = null; car.pitting = false;
          }
        }
        st.off = 0;
        setTf(car, rx, ry, rang);
      } else {
        // Track-running car: racing line (inside of the corner) + the sim's
        // passing offset. The grid uses a fixed lateral stagger instead.
        const p = at(st.prog);
        const lat = r.phase === 'grid' ? (i % 2 ? 1 : -1) * GRID_COL : (car.lane ?? 0) + racingLine(st.prog);
        draw.push({ car, st, p, lat });
      }
    }

    // ── Pass 2: hard no-overlap — nudge any two track sprites apart laterally
    // if they'd touch (covers duel passes + lane-change transitions). ──
    const push = new Map();
    for (let it = 0; it < 2; it++) {
      for (let a = 0; a < draw.length; a++) for (let b = a + 1; b < draw.length; b++) {
        const A = draw[a], B = draw[b];
        let dl = A.st.prog - B.st.prog; dl -= Math.round(dl);   // shortest way round the loop
        const longGap = Math.abs(dl) * L;
        if (longGap >= SEP_LONG) continue;
        const la = A.lat + (push.get(A.car.id) || 0), lb = B.lat + (push.get(B.car.id) || 0);
        const lat = la - lb;
        if (Math.abs(lat) >= SEP_LAT) continue;
        const need = SEP_LAT - Math.abs(lat), dir = lat >= 0 ? 1 : -1, w = 1 - longGap / SEP_LONG, half = (need / 2) * w;
        push.set(A.car.id, (push.get(A.car.id) || 0) + dir * half);
        push.set(B.car.id, (push.get(B.car.id) || 0) - dir * half);
      }
    }

    // ── Pass 3: draw the track cars ──
    for (const { car, st, p, lat } of draw) {
      const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
      let off = Math.max(-LANE_MAX, Math.min(LANE_MAX, lat + (push.get(car.id) || 0)));
      let wob = 0;
      if (car.isPlayer && r.falter > 0) {
        // Botched duel: shimmy side-to-side and twitch the nose as grip goes.
        const phase = (FALTER_DUR - r.falter) / FALTER_DUR, decay = r.falter / FALTER_DUR;
        off += Math.sin(phase * Math.PI * 6) * FALTER_AMP * decay;
        wob = Math.sin(phase * Math.PI * 6) * FALTER_YAW * decay;
      }
      st.off = off;
      setTf(car, p.x + nx * off, p.y + ny * off, p.ang + wob);
    }
    if (r.falter > 0) r.falter = Math.max(0, r.falter - dt);   // fade the wobble out

    const zoomIn = r.phase === 'break' || r.phase === 'question' || r.phase === 'resolve' || r.phase === 'pitdecision' || r.phase === 'pitenter';
    let tcam;
    if (zoomIn) {
      // Follow where the player actually drew — including along the pit lane
      // during 'pitenter' — so the drive-in stays centred, not the track point.
      let fx, fy;
      if (playerRX != null) { fx = playerRX; fy = playerRY; }
      else {
        const pc = field[r.playerIdx];
        const pst = pc && cs.get(pc.id);
        const pp = pst ? at(pst.prog) : { x: CX, y: CY };
        fx = pp.x; fy = pp.y;
      }
      tcam = { s: ZOOM_IN, fx, fy };
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
