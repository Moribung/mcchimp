<!-- src/routes/mma/character-creator/+page.svelte -->
<!-- Combined demo: PNG scene (background/octagon/ref) + two fully customizable,
     runtime-recolored programmatic fighters (skin, hair/beard, org shorts pattern
     with custom colors, and four poses). Recoloring is a keyed ImageData swap. -->
<script>
  import { onMount } from 'svelte';
  import {
    renderFighter, hexToRgb,
    FIGHTER_W, FEET_Y,
    POSES, POSE_LABEL, HAIR_STYLES, BEARD_STYLES, ORGS, BELTS,
    SKIN_TONES, HAIR_COLORS, SHORTS_COLORS, GLOVE_COLORS,
  } from '$lib/avatar/fighterRenderer.js';

  const BACKGROUNDS = [
    ['bg_empty', 'Empty'], ['bg_crowd_medium', 'Medium'], ['bg_crowd_packed', 'Packed'],
  ];
  // Enclosure (cage variants) — 'none' draws no overlay.
  const ENCLOSURES = [['none', 'None'], ['cage', 'Cage'], ['ring', 'Ring']];
  // Canvas (mat floor) designs — 'none' draws no overlay.
  const CANVASES = [['none', 'None'], ['canvas_gfl', 'Pattern'], ['canvas_gfl_text', 'GFL']];
  const REF_POSES = [['ref_neutral', 'Neutral'], ['ref_raise', 'Raise']];
  const IMG_IDS = [
    ...BACKGROUNDS.map(p => p[0]),
    'cage', 'ring', 'canvas_gfl', 'canvas_gfl_text',
    ...REF_POSES.map(p => p[0]),
  ];

  let fighters = $state({
    player: { pose: 'loss', skinIdx: 0, hairStyle: 'short',  hairColorIdx: 0, beardStyle: 'none', beardColorIdx: 0, org: 'gfl',      shortsBaseIdx: 2, shortsTrimIdx: 3, gloveIdx: 0, belt: 'gfl',  beltColorIdx: 3, flip: true  },
    opp:    { pose: 'loss', skinIdx: 2, hairStyle: 'buzz',   hairColorIdx: 1, beardStyle: 'full', beardColorIdx: 1, org: 'regional', shortsBaseIdx: 0, shortsTrimIdx: 6, gloveIdx: 1, belt: 'none', beltColorIdx: 0, flip: false },
  });

  // ref: 'off' | 'middle' | 'player' | 'opp'  ·  anim: 'off' | 'jump' | 'sway' | 'clash'
  let scene = $state({ background: 'bg_crowd_packed', enclosure: 'cage', canvas: 'canvas_gfl', ref: 'off', refExit: false, anim: 'jump' });

  function paletteFor(f) {
    const tone = SKIN_TONES[f.skinIdx];
    return {
      skin:     hexToRgb(tone.base),
      skinSh:   hexToRgb(tone.shadow),
      hair:     hexToRgb(HAIR_COLORS[f.hairColorIdx].hex),
      beard:    hexToRgb(HAIR_COLORS[f.beardColorIdx].hex),
      shorts:   hexToRgb(SHORTS_COLORS[f.shortsBaseIdx].hex),
      shortsTr: hexToRgb(SHORTS_COLORS[f.shortsTrimIdx].hex),
      glove:    hexToRgb(GLOVE_COLORS[f.gloveIdx].hex),
      belt:     hexToRgb(SHORTS_COLORS[f.beltColorIdx].hex),
    };
  }
  const cfgFor = (f) => ({ pose: f.pose, hair: f.hairStyle, beard: f.beardStyle, org: f.org, belt: f.belt });

  // Recolored fighter canvases — rebuilt when a fighter's config changes.
  // Held in plain $state (not $derived) so the rAF render loop reads them reliably.
  let playerCanvas = $state(null);
  let oppCanvas    = $state(null);
  $effect(() => { playerCanvas = renderFighter(cfgFor(fighters.player), paletteFor(fighters.player)); });
  $effect(() => { oppCanvas    = renderFighter(cfgFor(fighters.opp),    paletteFor(fighters.opp)); });

  let canvas;
  const imgs = {};
  let imgsReady = $state(false);

  onMount(() => {
    let loaded = 0;
    IMG_IDS.forEach(id => {
      const im = new Image();
      im.onload = () => { if (++loaded === IMG_IDS.length) imgsReady = true; };
      im.src = `/sprites/${id}.png`;
      imgs[id] = im;
    });

    const ctx = canvas.getContext('2d');
    let raf, t = 0, running = true;

    function blit(src, feetX, feetY, flip, offX, offY) {
      const dx = feetX - FIGHTER_W / 2 + offX;
      const dy = feetY - FEET_Y + offY;
      if (flip) {
        ctx.save(); ctx.translate(dx + FIGHTER_W, 0); ctx.scale(-1, 1);
        ctx.drawImage(src, 0, dy); ctx.restore();
      } else {
        ctx.drawImage(src, dx, dy);
      }
    }

    function loop() {
      if (!running) return;
      raf = requestAnimationFrame(loop); // reschedule first so a frame error can't kill the loop
      t += 16;
      try {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 96, 48);
      if (imgsReady) {
        if (imgs[scene.background]?.complete) ctx.drawImage(imgs[scene.background], 0, 0);
        if (scene.enclosure !== 'none' && imgs[scene.enclosure]?.complete) ctx.drawImage(imgs[scene.enclosure], 0, 0);
        if (scene.canvas !== 'none' && imgs[scene.canvas]?.complete) ctx.drawImage(imgs[scene.canvas], 0, 0);

        // Per-fighter animation offsets (player on left, opp on right)
        let pX = 0, pY = 0, oX = 0, oY = 0;
        if (scene.anim === 'jump') {
          const b = Math.round(Math.sin(t / 520));         // vertical bob, together
          pY = b; oY = b;
        } else if (scene.anim === 'sway') {
          const ph = t / 600;
          const x = Math.round(2 * Math.sin(ph));
          const y = Math.round(2 * Math.abs(Math.sin(ph)));// up in the middle, down at the sides
          pX = x; oX = x; pY = y; oY = y;
        } else if (scene.anim === 'clash') {
          // Same arc as Sway, but mirrored on X so the two move toward/away
          // from each other instead of drifting in the same direction.
          const ph = t / 600;
          const x = Math.round(2 * Math.sin(ph));
          const y = Math.round(2 * Math.abs(Math.sin(ph)));// up in the middle, down at the sides
          pX = x; oX = -x; pY = y; oY = y;
        }

        if (oppCanvas)    blit(oppCanvas,    72, 44, fighters.opp.flip,    oX, oY);
        if (playerCanvas) blit(playerCanvas, 24, 44, fighters.player.flip, pX, pY);

        // Referee
        if (scene.ref !== 'off') {
          const isMid = scene.ref === 'middle';
          const img = isMid ? imgs.ref_neutral : imgs.ref_raise;
          if (img?.complete) {
            const isPlayer = scene.ref === 'player';
            const refX = isMid ? 48 : (isPlayer ? 40 : 56); // close to the raised fighter
            const flip = scene.ref === 'opp';               // flip to raise the right-side hand
            // Slide-out animation: ramps the ref down out of frame, then loops.
            let slide = 0;
            if (scene.refExit) {
              const ph = (t % 2600) / 2600;
              slide = Math.round(Math.max(0, (ph - 0.35) / 0.65) * 40);
            }
            const dx = refX - 12, dy = 44 - 27 + slide;
            if (flip) {
              ctx.save(); ctx.translate(dx + 24, 0); ctx.scale(-1, 1);
              ctx.drawImage(img, 0, dy); ctx.restore();
            } else {
              ctx.drawImage(img, dx, dy);
            }
          }
        }
      }
      } catch (e) { console.error('loop frame error:', e); }
    }
    loop();
    return () => { running = false; cancelAnimationFrame(raf); };
  });

  const SIDES = [['player', 'Player'], ['opp', 'Opponent']];
</script>

<svelte:head>
  <link rel="stylesheet" href="/mma.css" />
</svelte:head>

<div class="cc-wrap">
  <div class="cc-bar">
    <a href="/mma" class="cc-back">← Back to MMA</a>
    <span class="cc-title">Character Creator</span>
  </div>

  <div class="cc-inner">
    <h1 class="cc-h1">Character Creator</h1>
    <p class="cc-sub">Two recolorable fighters · keyed ImageData swap · skin / hair / beard / org shorts · 4 poses</p>

    <div class="cc-canvas-wrap">
      <canvas bind:this={canvas} width="96" height="48" class="cc-canvas"></canvas>
    </div>

    <!-- Scene controls -->
    <div class="cc-scene-row">
      <div class="cc-ctrl">
        <span class="cc-label">Background</span>
        <div class="cc-btns">
          {#each BACKGROUNDS as [id, lbl]}
            <button class="cc-btn" class:sel={scene.background === id} onclick={() => scene.background = id}>{lbl}</button>
          {/each}
        </div>
      </div>
      <div class="cc-ctrl">
        <span class="cc-label">Enclosure</span>
        <div class="cc-btns">
          {#each ENCLOSURES as [id, lbl]}
            <button class="cc-btn" class:sel={scene.enclosure === id} onclick={() => scene.enclosure = id}>{lbl}</button>
          {/each}
        </div>
      </div>
      <div class="cc-ctrl">
        <span class="cc-label">Canvas</span>
        <div class="cc-btns">
          {#each CANVASES as [id, lbl]}
            <button class="cc-btn" class:sel={scene.canvas === id} onclick={() => scene.canvas = id}>{lbl}</button>
          {/each}
        </div>
      </div>
      <div class="cc-ctrl">
        <span class="cc-label">Referee</span>
        <div class="cc-btns">
          <button class="cc-btn" class:sel={scene.ref === 'off'}    onclick={() => scene.ref = 'off'}>Off</button>
          <button class="cc-btn" class:sel={scene.ref === 'middle'} onclick={() => scene.ref = 'middle'}>Middle</button>
          <button class="cc-btn" class:sel={scene.ref === 'player'} onclick={() => scene.ref = 'player'}>Raise P</button>
          <button class="cc-btn" class:sel={scene.ref === 'opp'}    onclick={() => scene.ref = 'opp'}>Raise O</button>
        </div>
      </div>
      <div class="cc-ctrl">
        <span class="cc-label">Ref exit</span>
        <div class="cc-btns">
          <button class="cc-btn" class:sel={!scene.refExit} disabled={scene.ref === 'off'} onclick={() => scene.refExit = false}>Stay</button>
          <button class="cc-btn" class:sel={scene.refExit}  disabled={scene.ref === 'off'} onclick={() => scene.refExit = true}>Slide out</button>
        </div>
      </div>
      <div class="cc-ctrl">
        <span class="cc-label">Animation</span>
        <div class="cc-btns">
          <button class="cc-btn" class:sel={scene.anim === 'off'}   onclick={() => scene.anim = 'off'}>Off</button>
          <button class="cc-btn" class:sel={scene.anim === 'jump'}  onclick={() => scene.anim = 'jump'}>Jump</button>
          <button class="cc-btn" class:sel={scene.anim === 'sway'}  onclick={() => scene.anim = 'sway'}>Sway</button>
          <button class="cc-btn" class:sel={scene.anim === 'clash'} onclick={() => scene.anim = 'clash'}>Clash</button>
        </div>
      </div>
    </div>

    <!-- Two fighter panels -->
    <div class="cc-panels">
      {#each SIDES as [side, title]}
        {@const f = fighters[side]}
        <div class="cc-panel">
          <div class="cc-panel-head">{title}</div>

          <div class="cc-ctrl">
            <span class="cc-label">Pose</span>
            <div class="cc-btns">
              {#each POSES as p}
                <button class="cc-btn" class:sel={f.pose === p} onclick={() => fighters[side].pose = p}>{POSE_LABEL[p]}</button>
              {/each}
            </div>
          </div>

          <div class="cc-ctrl">
            <span class="cc-label">Facing</span>
            <div class="cc-btns">
              <button class="cc-btn" class:sel={f.flip} onclick={() => fighters[side].flip = true}>Right</button>
              <button class="cc-btn" class:sel={!f.flip} onclick={() => fighters[side].flip = false}>Left</button>
            </div>
          </div>

          <div class="cc-ctrl">
            <span class="cc-label">Skin</span>
            <div class="cc-btns">
              {#each SKIN_TONES as tone, i}
                <button class="cc-swatch" style="background: {tone.base}" class:sel={f.skinIdx === i}
                  aria-label={tone.label} onclick={() => fighters[side].skinIdx = i}></button>
              {/each}
            </div>
          </div>

          <div class="cc-ctrl">
            <span class="cc-label">Hair</span>
            <div class="cc-btns">
              {#each HAIR_STYLES as h}
                <button class="cc-btn" class:sel={f.hairStyle === h} onclick={() => fighters[side].hairStyle = h}>{h}</button>
              {/each}
            </div>
          </div>

          <div class="cc-ctrl">
            <span class="cc-label">Hair color</span>
            <div class="cc-btns">
              {#each HAIR_COLORS as c, i}
                <button class="cc-swatch" style="background: {c.hex}" class:sel={f.hairColorIdx === i}
                  aria-label={c.label} onclick={() => fighters[side].hairColorIdx = i}></button>
              {/each}
            </div>
          </div>

          <div class="cc-ctrl">
            <span class="cc-label">Beard</span>
            <div class="cc-btns">
              {#each BEARD_STYLES as b}
                <button class="cc-btn" class:sel={f.beardStyle === b} onclick={() => fighters[side].beardStyle = b}>{b}</button>
              {/each}
            </div>
          </div>

          <div class="cc-ctrl">
            <span class="cc-label">Beard color</span>
            <div class="cc-btns">
              {#each HAIR_COLORS as c, i}
                <button class="cc-swatch" style="background: {c.hex}" class:sel={f.beardColorIdx === i}
                  disabled={f.beardStyle === 'none'} aria-label={c.label} onclick={() => fighters[side].beardColorIdx = i}></button>
              {/each}
            </div>
          </div>

          <div class="cc-ctrl">
            <span class="cc-label">Org pattern</span>
            <div class="cc-btns">
              {#each Object.entries(ORGS) as [id, lbl]}
                <button class="cc-btn" class:sel={f.org === id} onclick={() => fighters[side].org = id}>{lbl}</button>
              {/each}
            </div>
          </div>

          <div class="cc-ctrl">
            <span class="cc-label">Shorts base</span>
            <div class="cc-btns">
              {#each SHORTS_COLORS as c, i}
                <button class="cc-swatch" style="background: {c.hex}" class:sel={f.shortsBaseIdx === i}
                  aria-label={c.label} onclick={() => fighters[side].shortsBaseIdx = i}></button>
              {/each}
            </div>
          </div>

          <div class="cc-ctrl">
            <span class="cc-label">Shorts trim</span>
            <div class="cc-btns">
              {#each SHORTS_COLORS as c, i}
                <button class="cc-swatch" style="background: {c.hex}" class:sel={f.shortsTrimIdx === i}
                  aria-label={c.label} onclick={() => fighters[side].shortsTrimIdx = i}></button>
              {/each}
            </div>
          </div>

          <div class="cc-ctrl">
            <span class="cc-label">Gloves</span>
            <div class="cc-btns">
              {#each GLOVE_COLORS as c, i}
                <button class="cc-swatch" style="background: {c.hex}" class:sel={f.gloveIdx === i}
                  aria-label={c.label} onclick={() => fighters[side].gloveIdx = i}></button>
              {/each}
            </div>
          </div>

          <div class="cc-ctrl">
            <span class="cc-label">Belt</span>
            <div class="cc-btns">
              {#each Object.entries(BELTS) as [id, lbl]}
                <button class="cc-btn" class:sel={f.belt === id} onclick={() => fighters[side].belt = id}>{lbl}</button>
              {/each}
            </div>
          </div>

          <div class="cc-ctrl">
            <span class="cc-label">Belt color <span class="cc-hint">(regional)</span></span>
            <div class="cc-btns">
              {#each SHORTS_COLORS as c, i}
                <button class="cc-swatch" style="background: {c.hex}" class:sel={f.beltColorIdx === i}
                  disabled={f.belt !== 'regional'} aria-label={c.label} onclick={() => fighters[side].beltColorIdx = i}></button>
              {/each}
            </div>
          </div>
        </div>
      {/each}
    </div>

    <p class="cc-note">
      Each fighter is drawn once with reserved <strong>key colors</strong> (magenta = skin, green = hair, blue = shorts…),
      then a single <strong>ImageData pass</strong> swaps those keys to the chosen colors. The same recolor works on
      hand-drawn PNG art later — only the key-colored source changes, not the pipeline.
    </p>
  </div>
</div>

<style>
  .cc-wrap { min-height: 100vh; display: flex; flex-direction: column; background: #0f1017; color: #e8e8ec; }
  .cc-bar {
    display: flex; align-items: center; gap: 20px;
    padding: 10px 28px; background: rgba(10,10,10,0.97);
    border-bottom: 1px solid rgba(255,255,255,0.06); position: sticky; top: 0; z-index: 100;
  }
  .cc-back {
    font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase; color: rgba(232,232,236,0.45); text-decoration: none;
  }
  .cc-back:hover { color: #e8e8ec; }
  .cc-title { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.06em; color: #d8b23a; }

  .cc-inner { max-width: 900px; margin: 0 auto; padding: 26px 20px 60px; width: 100%; }
  .cc-h1 { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 0.04em; color: #d8b23a; margin-bottom: 4px; }
  .cc-sub { font-size: 12px; color: #8a8a9a; margin-bottom: 20px; }

  .cc-canvas-wrap { background: #000; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; }
  .cc-canvas { width: 100%; height: auto; image-rendering: pixelated; display: block; }

  .cc-scene-row { display: flex; flex-wrap: wrap; gap: 22px; margin: 18px 0 8px; }

  .cc-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
  .cc-panel { border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px 16px; }
  .cc-panel-head {
    font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 0.05em;
    color: #d8b23a; margin-bottom: 12px;
  }

  .cc-ctrl { margin-bottom: 11px; }
  .cc-label { display: block; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8a9a; margin-bottom: 6px; }
  .cc-hint { text-transform: none; letter-spacing: 0; opacity: 0.6; }
  .cc-btns { display: flex; gap: 5px; flex-wrap: wrap; }

  .cc-btn {
    font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
    background: #181920; border: 1px solid rgba(255,255,255,0.12); border-radius: 5px;
    color: rgba(232,232,236,0.6); padding: 5px 9px; cursor: pointer; transition: all 0.12s;
  }
  .cc-btn:hover { border-color: rgba(216,178,58,0.5); color: #e8e8ec; }
  .cc-btn.sel { border-color: #d8b23a; color: #d8b23a; background: rgba(216,178,58,0.1); }
  .cc-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .cc-swatch {
    width: 26px; height: 26px; padding: 0; border-radius: 5px;
    border: 1px solid rgba(255,255,255,0.18); cursor: pointer; transition: box-shadow 0.12s;
  }
  .cc-swatch.sel { box-shadow: 0 0 0 2px #e8e8ec; }

  .cc-note {
    margin-top: 22px; font-size: 12px; color: #8a8a9a;
    border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; line-height: 1.7;
  }
  .cc-note strong { color: #e8e8ec; }

  @media (max-width: 680px) { .cc-panels { grid-template-columns: 1fr; } }
</style>
