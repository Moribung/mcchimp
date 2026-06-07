<!-- src/lib/mma/ArenaScene.svelte -->
<!-- Pixel-art arena window rendered to a 96×48 canvas, upscaled via CSS.

     FIGHT MODE (animate=true): fighters in the sideways stance. They stay still
     until the ref slides out, then run sway → clash → sway (opponent holds at an
     extreme for half a cycle to flip phase seamlessly) while drifting inward.

     RESULT MODE (result set): the ref stands centre with both arms down and the
     two fighters flank him in their forward stance for 2s; then the ref raises
     the arm on the winner's side (left=player win, right=player loss, both=draw)
     and the winner raises an arm — both arms if the fight ended in a finish.
     On a draw, both fighters raise an arm. -->
<script>
  import { onMount } from 'svelte';
  import {
    renderFighter, hexToRgb, FIGHTER_W, FEET_Y,
    SKIN_TONES, HAIR_COLORS,
  } from '$lib/avatar/fighterRenderer.js';

  let {
    background = 'bg_empty', enclosure = 'none', mat = 'none',
    player = null, opp = null, showRef = false, animate = false,
    duration = 45000,   // total question time (ms) — fight-mode motion fills it
    result = null,      // { outcome: 'win'|'loss'|'draw', finish: bool } → result mode
  } = $props();

  // ── Fight-mode timeline (ms) ──────────────────────────
  const REF_STAND = 2000;  // ref stands still, fighters static
  const REF_SLIDE = 3000;  // ref slide-out duration (half speed; he fades out first anyway)
  const REF_FADE  = 1000;  // ref fades to nothing over this during the exit (half speed)
  const LIGHT_DIM = 2000;  // arena dims gradually to 50% over this as the ref leaves
  const PERIOD    = 300;   // sway period scale (phase = time / PERIOD)
  const MAX_APPROACH = 13; // px each fighter drifts inward over the full fight
  const SWAY_X    = 3;     // horizontal sway reach (forward/backward)

  // ── Result-mode layout ────────────────────────────────
  const RESULT_HOLD = 2000;  // ms both stand before the verdict
  const RESULT_PX   = 31;    // player feet-x (left of ref)
  const RESULT_OX   = 65;    // opponent feet-x (right of ref)
  const REF_X = 36, REF_Y = 17, REF_W = 24;  // ref sprite placement (feet on floor)

  let canvas = $state(null);
  const imgs = {};
  let ready = $state(false);

  onMount(() => {
    const ids = [
      'bg_empty', 'bg_crowd_medium', 'bg_crowd_packed',
      'cage', 'ring',
      'canvas_gfl', 'canvas_gfl_text',
      'ref_neutral', 'ref_raise', 'ref_raise_both',
    ];
    let loaded = 0;
    ids.forEach(id => {
      const im = new Image();
      im.onload = () => { imgs[id] = im; if (++loaded === ids.length) ready = true; };
      im.src = `/sprites/${id}.png`;
    });

    const ctx = canvas.getContext('2d');
    const startTime = Date.now();
    let raf;

    // Fight-mode opponent phase state (sway/clash).
    let shift = 0, curRel = 'sway';
    let holding = false, holdStartPph = 0, frozenOPh = 0, holdShiftStart = 0, holdTarget = 'sway';
    let lastTA = 0;

    function blit(src, feetX, flip, offX, offY) {
      // Snap to whole pixels — fractional positions blur/jitter on the upscaled canvas.
      const dx = Math.round(feetX - FIGHTER_W / 2 + offX);
      const dy = Math.round(44 - FEET_Y + offY);
      if (flip) {
        ctx.save(); ctx.translate(dx + FIGHTER_W, 0); ctx.scale(-1, 1);
        ctx.drawImage(src, 0, dy); ctx.restore();
      } else {
        ctx.drawImage(src, dx, dy);
      }
    }

    function drawRef(img, flip) {
      if (!img?.complete) return;
      if (flip) {
        ctx.save(); ctx.scale(-1, 1);
        ctx.drawImage(img, -(REF_X + REF_W), REF_Y); ctx.restore();
      } else {
        ctx.drawImage(img, REF_X, REF_Y);
      }
    }

    // Draw the backdrop with light layered in between, so the crowd catches the
    // most light, the cage/mat less, and (after this) the fighters least.
    function drawBackdrop(elapsed) {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 96, 48);
      if (imgs[background]?.complete) ctx.drawImage(imgs[background], 0, 0);
      arenaLights(elapsed, 0.13);                              // crowd — strongest
      if (enclosure !== 'none' && imgs[enclosure]?.complete) ctx.drawImage(imgs[enclosure], 0, 0);
      if (mat !== 'none'       && imgs[mat]?.complete)       ctx.drawImage(imgs[mat], 0, 0);
      arenaLights(elapsed, 0.07);                              // cage / mat — less
    }

    // A soft overhead light pool, added (screen) wherever it falls.
    function lightBeam(cx, cy, r, alpha, [R, G, B]) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${R},${G},${B},${alpha})`);
      g.addColorStop(1, `rgba(${R},${G},${B},0)`);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 96, 48);
      ctx.restore();
    }

    // Two slow drifting beams, tinted by the fighters' shorts (see beamColors).
    function arenaLights(elapsed, alpha) {
      // Dim gradually to 50% over LIGHT_DIM as the ref slides out, then keep it
      // down for the rest of the fight (question screen only).
      if (!result && elapsed >= REF_STAND) {
        const p = Math.min(1, (elapsed - REF_STAND) / LIGHT_DIM);
        alpha *= 1 - 0.5 * p;
      }
      const t = elapsed / 5000;
      lightBeam(34 + 16 * Math.sin(t),            7, 46, alpha, beamColors.l);
      lightBeam(62 + 16 * Math.sin(t + Math.PI),  7, 46, alpha, beamColors.r);
    }

    // ── Result-mode frame ───────────────────────────────
    function drawResult(elapsed) {
      const rc = resultCanvases;
      const phase2 = elapsed >= RESULT_HOLD;
      const pCanvas = phase2 ? rc?.pP2 : rc?.pP1;
      const oCanvas = phase2 ? rc?.oP2 : rc?.oP1;
      // Player flipped, opponent not, so a single raised arm (win1) faces the ref.
      if (oCanvas) blit(oCanvas, RESULT_OX, false, 0, 0);
      if (pCanvas) blit(pCanvas, RESULT_PX, true,  0, 0);

      let refImg = imgs.ref_neutral, flip = false;
      if (phase2) {
        if (result.outcome === 'win')       { refImg = imgs.ref_raise; }
        else if (result.outcome === 'loss') { refImg = imgs.ref_raise; flip = true; }
        else                                { refImg = imgs.ref_raise_both; }
      }
      drawRef(refImg, flip);

      // Belt fades onto the winner over 1s, starting when the ref raises.
      if (phase2 && rc?.beltCanvas) {
        const a = Math.min(1, (elapsed - RESULT_HOLD) / 1000);
        if (a > 0) {
          ctx.save(); ctx.globalAlpha = a;
          if (rc.beltSide === 'player') blit(rc.beltCanvas, RESULT_PX, true,  0, 0);
          else                          blit(rc.beltCanvas, RESULT_OX, false, 0, 0);
          ctx.restore();
        }
      }
    }

    // ── Fight-mode frame (fighters + ref only; lighting is layered in loop) ──
    function drawFight(elapsed) {
      const pC = playerCanvas, oC = oppCanvas;
      let pX = 0, pY = 0, oX = 0, oY = 0, closeIn = 0;
      const tA = elapsed - REF_STAND;
      if (animate && tA >= 0) {
        const progress = Math.min(1, tA / Math.max(1, duration - REF_STAND));
        closeIn = progress * MAX_APPROACH;
        const pPh = tA / PERIOD;
        const dPh = Math.max(0, (tA - lastTA) / PERIOD);
        const third = Math.max(PERIOD * 2, (duration - REF_STAND) / 3);
        const desired = (tA >= third && tA < 2 * third) ? 'clash' : 'sway';

        let oPh;
        if (holding) {
          oPh = frozenOPh;
          if (pPh - holdStartPph >= Math.PI) {
            shift = holdShiftStart + Math.PI; curRel = holdTarget; holding = false;
          }
        } else {
          oPh = pPh - shift;
          if (desired !== curRel) {
            const m = ((oPh % Math.PI) + Math.PI) % Math.PI;   // 0..π, extreme at π/2
            if (Math.abs(m - Math.PI / 2) <= dPh) {
              holding = true; holdStartPph = pPh; frozenOPh = oPh;
              holdShiftStart = shift; holdTarget = desired;
            }
          }
        }

        // Fractional — blit() rounds the combined position once, so the sub-pixel
        // inward drift biases when the sway snaps a pixel (no separate stair-step).
        pX = SWAY_X * Math.sin(pPh);
        pY = 2 * Math.abs(Math.sin(pPh));
        oX = SWAY_X * Math.sin(oPh);
        oY = 2 * Math.abs(Math.sin(oPh));
        lastTA = tA;
      }

      if (oC) blit(oC, 72 - closeIn, false, oX, oY);
      if (pC) blit(pC, 24 + closeIn, true,  pX, pY);

      // Referee: stands for REF_STAND, then slides out while fading away.
      if (showRef && imgs.ref_neutral?.complete && elapsed < REF_STAND + REF_SLIDE) {
        let slide = 0, alpha = 1;
        if (elapsed >= REF_STAND) {
          const ex = elapsed - REF_STAND;
          slide = Math.round(Math.min(1, ex / REF_SLIDE) * 40);
          alpha = Math.max(0, 1 - ex / REF_FADE);
        }
        if (alpha > 0) {
          ctx.save(); ctx.globalAlpha = alpha;
          ctx.drawImage(imgs.ref_neutral, REF_X, REF_Y + slide);
          ctx.restore();
        }
      }
    }

    function loop() {
      raf = requestAnimationFrame(loop);
      if (!ready || !canvas) return;
      const elapsed = Date.now() - startTime;
      drawBackdrop(elapsed);
      if (result) drawResult(elapsed);
      else        drawFight(elapsed);
      arenaLights(elapsed, 0.035);   // faint pass over everything (incl. fighters) — least
    }

    loop();
    return () => cancelAnimationFrame(raf);
  });

  // Build a recolored fighter canvas. Belt is passed explicitly (no belts are
  // worn during the fight; on the result screen one fades onto the winner).
  function buildFighter(spec, pose = 'side', beltType = 'none', beltColor = null) {
    if (!spec?.avatar) return null;
    const a    = spec.avatar;
    const tone = SKIN_TONES[a.skinIdx ?? 0] ?? SKIN_TONES[0];
    const palette = {
      skin:     hexToRgb(tone.base),
      skinSh:   hexToRgb(tone.shadow),
      hair:     hexToRgb((HAIR_COLORS[a.hairColorIdx  ?? 0] ?? HAIR_COLORS[0]).hex),
      beard:    hexToRgb((HAIR_COLORS[a.beardColorIdx ?? 0] ?? HAIR_COLORS[0]).hex),
      shorts:   hexToRgb(a.shortsBase || '#181820'),
      shortsTr: hexToRgb(a.shortsTrim || '#e8e8ec'),
      glove:    hexToRgb(spec.gloveColor || '#8f1f1f'),
      belt:     beltColor ? hexToRgb(beltColor) : [216, 178, 58],
    };
    return renderFighter(
      {
        pose,
        hair:  a.hairStyle  || 'short',
        beard: a.beardStyle || 'none',
        org:   spec.org || a.org || 'gfl',
        belt:  beltType,
      },
      palette,
    );
  }

  // Fight-mode (side stance) — no belt, only built when not in result mode.
  const playerCanvas = $derived(player && !result ? buildFighter(player, 'side') : null);
  const oppCanvas    = $derived(opp    && !result ? buildFighter(opp,    'side') : null);

  // Result-mode canvases: forward stance for the 2s hold (P1) and the verdict (P2),
  // all belt-less. A separate belt-ful copy of the winner is cross-faded in after
  // the ref raises (title fights only; on a draw the current champion retains).
  const resultCanvases = $derived.by(() => {
    if (!result || !player || !opp) return null;
    const winPose = result.finish ? 'win2' : 'win1';
    const pP1 = buildFighter(player, 'loss');
    const oP1 = buildFighter(opp,    'loss');
    let pP2 = pP1, oP2 = oP1, winnerPose = 'win1', winnerSide = null;
    if (result.outcome === 'win')       { pP2 = buildFighter(player, winPose); winnerPose = winPose; winnerSide = 'player'; }
    else if (result.outcome === 'loss') { oP2 = buildFighter(opp,    winPose); winnerPose = winPose; winnerSide = 'opp'; }
    else { pP2 = buildFighter(player, 'win1'); oP2 = buildFighter(opp, 'win1'); }  // draw

    // Belt at stake = the champion's belt (only one fighter carries it). On a draw
    // it stays with whoever held it; otherwise it goes to the winner.
    const champSpec = player.beltType ? player : (opp.beltType ? opp : null);
    let beltCanvas = null, beltSide = null;
    if (champSpec) {
      const bt = champSpec.beltType, bc = champSpec.beltColor;
      if (result.outcome === 'draw') {
        beltSide = player.beltType ? 'player' : 'opp';
        beltCanvas = buildFighter(beltSide === 'player' ? player : opp, 'win1', bt, bc);
      } else {
        beltSide = winnerSide;
        beltCanvas = buildFighter(beltSide === 'player' ? player : opp, winnerPose, bt, bc);
      }
    }
    return { pP1, oP1, pP2, oP2, beltCanvas, beltSide };
  });

  // ── Beam tints (from shorts colors) ───────────────────
  const STD_LIGHT = [255, 247, 224];   // standard warm light
  // A shorts colour, or the standard light if it's near-grayscale (black/white/gray).
  function tint(hex) {
    if (!hex) return STD_LIGHT;
    const [r, g, b] = hexToRgb(hex);
    return (Math.max(r, g, b) - Math.min(r, g, b) < 40) ? STD_LIGHT : [r, g, b];
  }
  // Fight: left beam = player's shorts, right beam = opponent's.
  // Result: both beams use the winner's two shorts colours (base/trim); draw → standard.
  const beamColors = $derived.by(() => {
    if (result) {
      const w = result.outcome === 'win'  ? player
              : result.outcome === 'loss' ? opp
              : null;
      if (!w) return { l: STD_LIGHT, r: STD_LIGHT };           // draw → keep standard
      return { l: tint(w.avatar?.shortsBase), r: tint(w.avatar?.shortsTrim) };
    }
    return { l: tint(player?.avatar?.shortsBase), r: tint(opp?.avatar?.shortsBase) };
  });
</script>

<div class="arena-wrap">
  <canvas bind:this={canvas} width="96" height="48" class="arena-canvas"></canvas>
</div>

<style>
  .arena-wrap {
    background: #000;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 20px;
    width: 66.67%;
    margin-left: auto;
    margin-right: auto;
  }
  .arena-canvas {
    width: 100%;
    height: auto;
    image-rendering: pixelated;
    display: block;
  }
</style>
