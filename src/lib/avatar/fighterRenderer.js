// Programmatic, recolorable fighter sprite renderer.
//
// A fighter is drawn once into a 32×48 offscreen canvas using reserved KEY
// colors for each recolorable role (skin, skin-shadow, hair, shorts-base,
// shorts-trim). A single ImageData pass then swaps every keyed pixel to the
// chosen color. The same recolor pass works on hand-drawn / PixelLab PNGs
// later — as long as the art uses these key colors, this code is unchanged.
//
// Fixed colors (eyes, gloves) are never keyed, so they stay constant.

// ── Reserved key colors (hex used at draw time) ──
const K_SKIN     = '#ff00ff';
const K_SKIN_SH  = '#c800c8';
const K_HAIR     = '#00ff00';
const K_SHORTS   = '#0000ff';
const K_SHORTS_T = '#0080ff';
const K_GLOVE    = '#ffff00';
const K_BEARD    = '#00ffff';
const K_BELT     = '#ff8000';

// ── Fixed (non-recolorable) ──
const EYE   = '#141414';
const PLATE = '#f2d96a'; // belt centre plate (gold)

// Key RGB triples, paired with the palette role they resolve to.
const KEY_RGB = {
  skin:     [255, 0, 255],
  skinSh:   [200, 0, 200],
  hair:     [0, 255, 0],
  shorts:   [0, 0, 255],
  shortsTr: [0, 128, 255],
  glove:    [255, 255, 0],
  beard:    [0, 255, 255],
  belt:     [255, 128, 0],
};

export const FIGHTER_W = 32;
export const FIGHTER_H = 48;
export const FEET_X = 16; // anchor: feet centre x
export const FEET_Y = 40; // anchor: feet y

export const POSES      = ['loss', 'side', 'win1', 'win2'];
export const POSE_LABEL = { loss: 'Loss', side: 'Sideways', win1: 'Win · 1 arm', win2: 'Win · 2 arms' };
export const HAIR_STYLES  = ['bald', 'buzz', 'short', 'mohawk', 'afro', 'long'];
export const BEARD_STYLES = ['none', 'goatee', 'full'];
export const ORGS = {
  regional: 'Regional FC',
  kfc:      'KFC',
  apex:     'Apex Combat',
  gfl:      'GFL',
};
export const BELTS = { none: 'None', gfl: 'GFL', kfc: 'KFC', apex: 'Apex', regional: 'Regional' };

// ── DRAW: keyed base sprite ──
function drawBase(g, cfg) {
  const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const pose = cfg.pose;

  // ---- Body silhouette + pose-specific arms ----
  if (pose === 'side') {
    // Bladed 3/4 stance facing left
    r(13, 14, 6, 6, K_SKIN);            // head
    r(14, 17, 1, 1, EYE); r(16, 17, 1, 1, EYE); // eyes toward facing dir
    r(11, 20, 10, 2, K_SKIN);           // wide shoulders
    r(18, 20, 3, 4, K_SKIN);            // back shoulder drops lower
    r(12, 22, 8, 6, K_SKIN);            // torso (side-on)
    r(12, 27, 8, 1, K_SKIN_SH);         // torso shadow
    r(12, 28, 8, 1, K_SKIN);            // waist row (torso width — no outer pixels above the shorts)
    r(11, 29, 10, 5, K_SKIN);           // hips under the shorts
    r(10, 34, 3, 6, K_SKIN); r(19, 34, 3, 6, K_SKIN); // wide legs
    r(10, 40, 3, 1, EYE); r(19, 40, 3, 1, EYE);       // feet
    // both gloves in front (facing left)
    r(11, 19, 2, 2, K_SKIN);            // rear forearm to chin
    r(10, 17, 3, 3, K_GLOVE);             // chin glove
    r(9, 22, 3, 3, K_SKIN);             // lead forearm
    r(6, 21, 3, 3, K_GLOVE);              // lead glove out front
  } else {
    // Forward-facing base (shared by loss / win1 / win2)
    r(13, 14, 6, 6, K_SKIN);            // head
    r(14, 17, 1, 1, EYE); r(17, 17, 1, 1, EYE); // eyes
    r(14, 20, 4, 1, K_SKIN);            // neck (thicker — 1px wider each side)
    r(11, 21, 10, 8, K_SKIN);           // torso
    r(11, 27, 10, 1, K_SKIN_SH);        // torso shadow
    r(11, 29, 10, 5, K_SKIN);           // hips base
    r(12, 34, 3, 6, K_SKIN); r(17, 34, 3, 6, K_SKIN); // legs
    r(12, 40, 3, 1, EYE); r(17, 40, 3, 1, EYE);       // feet

    if (pose === 'win2') {
      r(8, 20, 3, 3, K_SKIN);  r(21, 20, 3, 3, K_SKIN);
      r(6, 15, 3, 5, K_SKIN);  r(23, 15, 3, 5, K_SKIN);
      r(5, 11, 3, 3, K_GLOVE);   r(24, 11, 3, 3, K_GLOVE);
    } else if (pose === 'win1') {
      // Left arm raised, right arm down
      r(8, 20, 3, 3, K_SKIN);  r(6, 15, 3, 5, K_SKIN);  r(5, 11, 3, 3, K_GLOVE);
      r(21, 21, 3, 8, K_SKIN); r(21, 28, 3, 3, K_GLOVE);
    } else {
      // loss — both arms slumped low
      r(8, 21, 3, 8, K_SKIN);  r(21, 21, 3, 8, K_SKIN);
      r(8, 28, 3, 3, K_GLOVE);   r(21, 28, 3, 3, K_GLOVE);
    }
  }

  // ---- Shorts (org pattern) on the hips anchor ----
  const HX = 11, HY = 29;
  r(HX, HY, 10, 5, K_SHORTS);
  if (cfg.org === 'kfc') {
    r(HX, HY + 2, 10, 1, K_SHORTS_T);                                                   // horizontal stripe
  } else if (cfg.org === 'apex') {
    r(HX, HY, 10, 1, K_SHORTS_T);                                                       // waistband
  } else if (cfg.org === 'gfl') {
    r(HX, HY, 1, 5, K_SHORTS_T); r(HX + 9, HY, 1, 5, K_SHORTS_T); r(HX, HY, 10, 1, K_SHORTS_T); // side panels + waistband
  }
  // regional → plain base, no trim

  // ---- Belt (optional championship belt at the waist; distinct shapes) ----
  if (cfg.belt && cfg.belt !== 'none') {
    const GOLD = '#d8b23a', GOLD2 = '#f4e08a', SILVER = '#aeaeba', SILVER2 = '#e6e6ee';
    if (cfg.belt === 'gfl') {            // golden — large prestige belt, corners rounded off
      r(11, 27, 10, 1, GOLD); r(10, 28, 12, 1, GOLD); r(11, 29, 10, 1, GOLD);  // band (no corners)
      r(14, 25, 4, 1, GOLD2); r(13, 26, 6, 4, GOLD2); r(14, 30, 4, 1, GOLD2);  // plate (no corners)
    } else if (cfg.belt === 'apex') {    // silver — twin side studs
      r(11, 28, 10, 2, SILVER);
      r(13, 28, 2, 2, SILVER2); r(17, 28, 2, 2, SILVER2);
    } else if (cfg.belt === 'kfc') {     // silver — tall trophy plate
      r(11, 28, 10, 2, SILVER);
      r(14, 26, 4, 4, SILVER2);
    } else {                             // regional — custom band colour
      r(11, 28, 10, 2, K_BELT);
      r(15, 27, 3, 3, PLATE);
    }
  }

  // ---- Beard (head anchor, independently colored) ----
  if (cfg.beard === 'full') {
    r(14, 19, 4, 2, K_BEARD); r(13, 18, 1, 2, K_BEARD); r(18, 18, 1, 2, K_BEARD);
  } else if (cfg.beard === 'goatee') {
    r(15, 19, 2, 2, K_BEARD);
  }

  // ---- Hair (head anchor) ----
  const hs = cfg.hair;
  if (hs === 'buzz')        r(13, 13, 6, 1, K_HAIR);
  else if (hs === 'short') { r(13, 12, 6, 2, K_HAIR); r(13, 14, 1, 1, K_HAIR); r(18, 14, 1, 1, K_HAIR); }
  else if (hs === 'mohawk') r(15, 9, 2, 5, K_HAIR);
  else if (hs === 'afro')  { r(12, 10, 8, 4, K_HAIR); r(13, 9, 6, 1, K_HAIR); }
  else if (hs === 'long')  { r(13, 12, 6, 2, K_HAIR); r(13, 14, 1, 6, K_HAIR); r(18, 14, 1, 6, K_HAIR); }
  // bald → no hair
}

// ── RECOLOR: swap key RGB → palette RGB in one ImageData pass ──
function recolor(imgData, palette) {
  const d = imgData.data;
  const pairs = [
    [KEY_RGB.skin,     palette.skin],
    [KEY_RGB.skinSh,   palette.skinSh],
    [KEY_RGB.hair,     palette.hair],
    [KEY_RGB.shorts,   palette.shorts],
    [KEY_RGB.shortsTr, palette.shortsTr],
    [KEY_RGB.glove,    palette.glove],
    [KEY_RGB.beard,    palette.beard],
    [KEY_RGB.belt,     palette.belt],
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

// Base-sprite cache keyed by silhouette-affecting config (not colors).
const baseCache = new Map();
function getBase(cfg) {
  const key = `${cfg.pose}|${cfg.hair}|${cfg.beard}|${cfg.org}|${cfg.belt}`;
  let c = baseCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = FIGHTER_W; c.height = FIGHTER_H;
    drawBase(c.getContext('2d'), cfg);
    baseCache.set(key, c);
  }
  return c;
}

/**
 * Render a fully colored fighter to a fresh 32×48 canvas.
 * @param {object} cfg     { pose, hair, beard, org }
 * @param {object} palette { skin, skinSh, hair, shorts, shortsTr } — each [r,g,b]
 */
export function renderFighter(cfg, palette) {
  const base = getBase(cfg);
  const out = document.createElement('canvas');
  out.width = FIGHTER_W; out.height = FIGHTER_H;
  const ctx = out.getContext('2d');
  ctx.drawImage(base, 0, 0);
  const id = ctx.getImageData(0, 0, FIGHTER_W, FIGHTER_H);
  recolor(id, palette);
  ctx.putImageData(id, 0, 0);
  return out;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ── Preset palettes for the UI ──
export const SKIN_TONES = [
  { label: 'Fair',  base: '#e8b690', shadow: '#c98f63' },
  { label: 'Tan',   base: '#cf9966', shadow: '#a87444' },
  { label: 'Brown', base: '#a06a3c', shadow: '#7c4f29' },
  { label: 'Deep',  base: '#5e3a22', shadow: '#43270f' },
];
export const HAIR_COLORS = [
  { label: 'Black',  hex: '#1c1c1c' },
  { label: 'Brown',  hex: '#5a3517' },
  { label: 'Blonde', hex: '#d8b23a' },
  { label: 'Ginger', hex: '#9a2f2f' },
  { label: 'Gray',   hex: '#9a9aa2' },
];
export const SHORTS_COLORS = [
  { label: 'Red',    hex: '#b41f1f' },
  { label: 'Teal',   hex: '#1f8a86' },
  { label: 'Black',  hex: '#181820' },
  { label: 'Gold',   hex: '#d8b23a' },
  { label: 'Blue',   hex: '#2f5fd8' },
  { label: 'Purple', hex: '#7a3fb0' },
  { label: 'White',  hex: '#e8e8ec' },
  { label: 'Green',  hex: '#2f9a4f' },
];
export const GLOVE_COLORS = [
  { label: 'Red',   hex: '#8f1f1f' },
  { label: 'Black', hex: '#20202a' },
  { label: 'Blue',  hex: '#1f3f8f' },
  { label: 'Gold',  hex: '#c79a22' },
  { label: 'White', hex: '#d8d8dc' },
  { label: 'Green', hex: '#2f7a3f' },
];
