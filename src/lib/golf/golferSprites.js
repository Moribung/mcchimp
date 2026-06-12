/**
 * Golfer sprite sheets — manifest, loader, and procedural placeholders.
 *
 * ── SPRITE SHEET CONTRACT (for the artist) ──────────────────────────────
 * One PNG per animation at:  /static/sprites/golfer/golfer_<anim>.png
 *
 *  • Horizontal strip, each frame exactly 64×64 px, no padding,
 *    frames left→right. Sheet = (frames × 64) wide, 64 tall.
 *  • Transparent background. Golfer faces RIGHT.
 *  • Feet baseline at y = 56, body centered around x = 32.
 *  • The club head must stay inside the frame at full extension.
 *  • Frame counts per animation are listed in GOLFER_ANIMS below.
 *    `windup` is special: its frame is driven by the swing meter value
 *    (frame 0 = address, last frame = full backswing), not by time.
 *  • Optional: draw with the fighterRenderer key colors (#ff00ff skin,
 *    #00ff00 hair, #0000ff shirt) and the existing recolor pass in
 *    src/lib/avatar/fighterRenderer.js can be reused for customization.
 *
 * Any sheet that is missing or fails to load falls back to the procedural
 * placeholder below. To wire up real art, drop the PNG in and add its anim
 * name to AVAILABLE_SHEETS — that's the only code change. Names not listed
 * there are never requested, so the dev server stays free of 404 noise.
 * ────────────────────────────────────────────────────────────────────────
 */

export const FRAME = 64;

/**
 * Anim names whose PNG sheets actually exist in /static/sprites/golfer/.
 * Empty = placeholder-only (no network requests). Add a name here once you
 * drop the matching golfer_<anim>.png in.
 */
export const AVAILABLE_SHEETS = [
  'idle', 'windup', 'swing_soft', 'swing_full', 'putt', 'whiff', 'celebrate', 'frustrated',
];

export const GOLFER_ANIMS = {
  idle:       { file: 'golfer_idle.png',       frames: 4, fps: 4,  loop: true  },
  windup:     { file: 'golfer_windup.png',     frames: 8, fps: 0,  loop: false }, // meter-driven
  swing_soft: { file: 'golfer_swing_soft.png', frames: 6, fps: 14, loop: false },
  swing_full: { file: 'golfer_swing_full.png', frames: 8, fps: 16, loop: false },
  putt:       { file: 'golfer_putt.png',       frames: 5, fps: 10, loop: false },
  whiff:      { file: 'golfer_whiff.png',      frames: 6, fps: 12, loop: false },
  celebrate:  { file: 'golfer_celebrate.png',  frames: 6, fps: 8,  loop: true  },
  frustrated: { file: 'golfer_frustrated.png', frames: 4, fps: 6,  loop: true  },
};

/** Load all sheets; missing files resolve to null (placeholder is used). */
export function loadSheets() {
  const sheets = {};
  for (const [name, def] of Object.entries(GOLFER_ANIMS)) {
    // Skip anims with no real sheet yet — avoids 404s; placeholder is used.
    if (!AVAILABLE_SHEETS.includes(name)) {
      sheets[name] = { img: null, ready: false };
      continue;
    }
    const img = new Image();
    img.src = `/sprites/golfer/${def.file}`;
    sheets[name] = { img, ready: false };
    img.onload  = () => { sheets[name].ready = true; };
    img.onerror = () => { sheets[name].ready = false; };
  }
  return sheets;
}

/* ── Recolourable character colours ─────────────────────── */

// Default look (also the colours the procedural fallback uses if none given).
export const DEFAULT_GOLFER_COLORS = {
  skin:  '#e0b08a',
  cap:   '#c2453a',
  shirt: '#3a6ea5',
  pants: '#2b2b33',
};

// Reserved key colours baked into the generated PNGs (gen_golfer.py). The
// recolour pass swaps each keyed pixel to the character's chosen colour — the
// SAME approach the MMA fighter renderer uses.
export const GOLF_KEY_RGB = {
  skin:  [255, 0, 255],
  cap:   [0, 255, 0],
  shirt: [0, 0, 255],
  pants: [255, 255, 0],
};

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Swap every keyed pixel in `imgData` to the character's colours, in place. */
export function recolorGolfer(imgData, colors = DEFAULT_GOLFER_COLORS) {
  const d = imgData.data;
  const pairs = [
    [GOLF_KEY_RGB.skin,  hexToRgb(colors.skin  || DEFAULT_GOLFER_COLORS.skin)],
    [GOLF_KEY_RGB.cap,   hexToRgb(colors.cap   || DEFAULT_GOLFER_COLORS.cap)],
    [GOLF_KEY_RGB.shirt, hexToRgb(colors.shirt || DEFAULT_GOLFER_COLORS.shirt)],
    [GOLF_KEY_RGB.pants, hexToRgb(colors.pants || DEFAULT_GOLFER_COLORS.pants)],
  ];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue; // transparent
    const r = d[i], g = d[i + 1], b = d[i + 2];
    for (const [k, t] of pairs) {
      if (r === k[0] && g === k[1] && b === k[2]) {
        d[i] = t[0]; d[i + 1] = t[1]; d[i + 2] = t[2];
        break;
      }
    }
  }
}

/* ── Procedural placeholder ─────────────────────────────── */

// Fixed (non-recolourable) roles. Skin/cap/shirt/pants come from the character.
const FIXED = {
  shoe:  '#1a1a1f',
  shaft: '#d8d8d8',
  head:  '#909098',
};

/**
 * Draw a stick-pixel golfer for `anim` at frame progress.
 * @param ctx     64×64 canvas context
 * @param anim    animation name
 * @param frame   current frame index (0-based)
 * @param frames  total frames for this anim
 */
export function drawPlaceholder(ctx, anim, frame, frames, colors = DEFAULT_GOLFER_COLORS) {
  ctx.clearRect(0, 0, FRAME, FRAME);
  const p = frames > 1 ? frame / (frames - 1) : 0;  // 0..1 progress

  let bob = 0, lean = 0, armsUp = false, headDrop = 0;
  // Club angle in degrees: 90 = straight down at the ball, negative = behind/up.
  let clubDeg;

  switch (anim) {
    case 'idle':
      bob = frame % 2;
      clubDeg = 78;
      break;
    case 'windup':
      clubDeg = 95 - p * 240;          // address → high backswing
      lean = -Math.round(p * 2);
      break;
    case 'swing_soft':
      clubDeg = -100 + p * 250;        // backswing → follow-through
      lean = Math.round((p - 0.4) * 3);
      break;
    case 'swing_full':
      clubDeg = -145 + p * 340;        // bigger arc
      lean = Math.round((p - 0.4) * 4);
      break;
    case 'putt':
      clubDeg = 100 - Math.sin(p * Math.PI) * 25;  // gentle pendulum
      break;
    case 'whiff':
      clubDeg = -120 + p * 230;        // swing that dies into the turf
      headDrop = p > 0.7 ? 1 : 0;
      lean = p > 0.7 ? 2 : 0;
      break;
    case 'celebrate':
      bob = -(frame % 2) * 2;
      armsUp = true;
      clubDeg = -90;                   // club held high
      break;
    case 'frustrated':
      headDrop = 1 + (frame % 2 === 0 ? 0 : 1) * 0;
      bob = frame % 2 === 0 ? 0 : 0;
      headDrop = 2;
      clubDeg = 95;
      lean = 1;
      break;
    default:
      clubDeg = 78;
  }

  const cx = 30 + lean;     // torso x
  const baseY = 56 + bob;

  // legs
  ctx.fillStyle = colors.pants;
  ctx.fillRect(cx - 1, baseY - 12, 3, 12);
  ctx.fillRect(cx + 4, baseY - 12, 3, 12);
  // shoes
  ctx.fillStyle = FIXED.shoe;
  ctx.fillRect(cx - 1, baseY - 1, 4, 2);
  ctx.fillRect(cx + 4, baseY - 1, 4, 2);
  // torso
  ctx.fillStyle = colors.shirt;
  ctx.fillRect(cx - 2, baseY - 26, 10, 14);
  // head
  ctx.fillStyle = colors.skin;
  ctx.fillRect(cx - 1, baseY - 35 + headDrop, 8, 8);
  // cap
  ctx.fillStyle = colors.cap;
  ctx.fillRect(cx - 1, baseY - 37 + headDrop, 8, 3);
  ctx.fillRect(cx + 6, baseY - 35 + headDrop, 3, 1);

  // arms + club from the shoulder
  const sx = cx + 5, sy = baseY - 22;
  const rad = (clubDeg * Math.PI) / 180;
  const hx = sx + Math.cos(rad) * 8;   // hands
  const hy = sy + Math.sin(rad) * 8;

  ctx.strokeStyle = colors.shirt;
  ctx.lineWidth = 2;
  if (armsUp) {
    ctx.beginPath();
    ctx.moveTo(cx, sy); ctx.lineTo(cx - 4, sy - 9);
    ctx.moveTo(sx, sy); ctx.lineTo(sx + 4, sy - 9);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(sx, sy); ctx.lineTo(hx, hy);
    ctx.stroke();
  }

  // club shaft + head
  const chx = armsUp ? sx + 4 : hx, chy = armsUp ? sy - 9 : hy;
  const cex = chx + Math.cos(rad) * 14;
  const cey = chy + Math.sin(rad) * 14;
  ctx.strokeStyle = FIXED.shaft;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(chx, chy); ctx.lineTo(cex, cey);
  ctx.stroke();
  ctx.fillStyle = FIXED.head;
  ctx.fillRect(Math.round(cex) - 1, Math.round(cey) - 1, 3, 2);

  // ball at address-ish poses
  if (anim === 'idle' || anim === 'windup' || anim === 'putt') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx + 12, baseY - 1, 2, 2);
  }
}
