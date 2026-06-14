/**
 * Procedural pixel-art car sprites.
 *
 * Each variant is drawn pixel-by-pixel onto an offscreen canvas, recoloured from
 * a single livery colour (base + derived highlight/shadow), supersampled for
 * crispness, and baked to a PNG data URL once per car. The sprite points RIGHT
 * (+x), so the renderer just rotates it to the path tangent.
 *
 * This IS the rotated-PNG + recolour pipeline we designed — the only thing a
 * hand-drawn asset would change is the source pixels. To swap in real art later,
 * load the PNG, draw it to this canvas, palette-swap the body keys, done.
 */

export const SPRITE_W = 24;   // logical pixels (length, along travel)
export const SPRITE_H = 14;   // logical pixels (width)
const SCALE = 4;              // supersample factor

function hexToRgb(h) {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mix(rgb, target, amt) {
  return rgb.map((v, i) => Math.round(v + (target[i] - v) * amt));
}
const WHITE = [255, 255, 255], BLACK = [0, 0, 0];

function drawCar(ctx, color, variant) {
  const base  = hexToRgb(color);
  const light = mix(base, WHITE, 0.4);
  const dark  = mix(base, BLACK, 0.4);
  const cock  = [26, 29, 34];
  const tyre  = [18, 20, 24];
  const visor = mix(base, WHITE, 0.65);

  const px = (x, y, w, h, rgb) => {
    ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    ctx.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
  };

  if (variant === 1) {
    // Stock car — wide, blunt nose
    px(4, 3, 2, 8, tyre); px(16, 3, 2, 8, tyre);          // wheels under body
    px(3, 4, 18, 6, base);                                 // body
    px(20, 5, 3, 4, base);                                 // blunt nose
    px(2, 3, 3, 8, dark);                                  // tail
    px(3, 4, 18, 1, light);                                // highlight
    px(3, 9, 18, 1, dark);                                 // shadow
    px(8, 4, 8, 6, cock); px(10, 5, 5, 4, visor);          // cabin + glass
  } else if (variant === 2) {
    // Prototype — tapered body, covered wheels, big wing
    px(6, 2, 2, 3, dark); px(6, 9, 2, 3, dark);            // covered front arches
    px(15, 2, 2, 3, dark); px(15, 9, 2, 3, dark);          // rear arches
    px(5, 5, 15, 4, base);                                 // mid body
    px(8, 3, 9, 8, base);                                  // cabin block
    px(19, 6, 4, 2, base);                                 // pointed nose
    px(2, 2, 3, 10, dark);                                 // big rear wing
    px(8, 3, 9, 1, light);                                 // highlight
    px(8, 10, 9, 1, dark);                                 // shadow
    px(10, 5, 6, 4, cock); px(12, 6, 4, 2, visor);
  } else {
    // Open-wheeler — narrow body, exposed wheels
    px(15, 0, 4, 3, tyre); px(15, 11, 4, 3, tyre);         // front wheels (sticking out)
    px(4, 0, 4, 3, tyre);  px(4, 11, 4, 3, tyre);          // rear wheels
    px(6, 5, 12, 4, base);                                 // slim body
    px(17, 6, 5, 2, base);                                 // long pointed nose
    px(3, 4, 3, 6, dark);                                  // rear wing
    px(6, 5, 12, 1, light);                                // highlight
    px(6, 8, 12, 1, dark);                                 // shadow
    px(9, 5, 4, 4, cock); px(13, 6, 2, 2, visor);          // cockpit
  }
}

const cache = new Map();

/** Bake (or fetch cached) a livery as a PNG data URL. */
export function bakeCar(variant, color) {
  const key = `${variant}:${color}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_W * SCALE;
  canvas.height = SPRITE_H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawCar(ctx, color, variant);
  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
