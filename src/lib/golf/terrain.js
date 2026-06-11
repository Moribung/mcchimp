/**
 * Rasterizes hole shape primitives (holes.js) into a flat tile grid,
 * and pre-renders the grid into an offscreen pixel-art canvas.
 */

import { MAP_W, MAP_H, TERRAIN as T } from './constants.js';

const SHAPE_T = {
  ob: T.OB, rough: T.ROUGH, fairway: T.FAIRWAY, tee: T.TEE,
  green: T.GREEN, sand: T.SAND, water: T.WATER, trees: T.TREES,
};

/* ── Grid build ─────────────────────────────────────────── */
export function buildGrid(hole) {
  const g = new Uint8Array(MAP_W * MAP_H).fill(T.ROUGH);
  for (const f of hole.features) paint(g, f);
  // OB border ring (always on top)
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (x < 2 || y < 2 || x >= MAP_W - 2 || y >= MAP_H - 2) g[y * MAP_W + x] = T.OB;
    }
  }
  return g;
}

function paint(g, f) {
  const t = SHAPE_T[f.t];
  if (t === undefined) return;
  if (f.shape === 'rect') {
    for (let y = Math.max(0, f.y); y < Math.min(MAP_H, f.y + f.h); y++)
      for (let x = Math.max(0, f.x); x < Math.min(MAP_W, f.x + f.w); x++)
        g[y * MAP_W + x] = t;
  } else if (f.shape === 'ellipse') {
    const [cx, cy] = f.c;
    const x0 = Math.max(0, Math.floor(cx - f.rx)), x1 = Math.min(MAP_W - 1, Math.ceil(cx + f.rx));
    const y0 = Math.max(0, Math.floor(cy - f.ry)), y1 = Math.min(MAP_H - 1, Math.ceil(cy + f.ry));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / f.rx, dy = (y - cy) / f.ry;
        if (dx * dx + dy * dy <= 1) g[y * MAP_W + x] = t;
      }
  } else if (f.shape === 'path') {
    const r = f.w / 2;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of f.pts) {
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
    const x0 = Math.max(0, Math.floor(minX - r)), x1 = Math.min(MAP_W - 1, Math.ceil(maxX + r));
    const y0 = Math.max(0, Math.floor(minY - r)), y1 = Math.min(MAP_H - 1, Math.ceil(maxY + r));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (distToPolyline(x, y, f.pts) <= r) g[y * MAP_W + x] = t;
      }
  }
}

function distToPolyline(x, y, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    best = Math.min(best, distToSegment(x, y, pts[i], pts[i + 1]));
  }
  return best;
}

function distToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/* ── Lookup ─────────────────────────────────────────────── */
export function terrainAt(grid, x, y) {
  const ix = Math.round(x), iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= MAP_W || iy >= MAP_H) return T.OB;
  return grid[iy * MAP_W + ix];
}

/* ── Pre-render to offscreen canvas ─────────────────────── */
// [base, speckle] per terrain; deterministic hash noise so it never flickers.
const PALETTE = {
  [T.OB]:      ['#0e2415', '#0b1d11'],
  [T.ROUGH]:   ['#2f6b33', '#2a5f2e'],
  [T.FAIRWAY]: ['#55a855', '#4f9e4f'],
  [T.TEE]:     ['#66bb66', '#5cb45c'],
  [T.GREEN]:   ['#7ed87e', '#74cc74'],
  [T.SAND]:    ['#e0c882', '#d6bc74'],
  [T.WATER]:   ['#2e6fc4', '#3c80d8'],
  [T.TREES]:   ['#1b4d24', '#143c1b'],
};

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function renderTerrain(grid) {
  const cv = document.createElement('canvas');
  cv.width = MAP_W; cv.height = MAP_H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(MAP_W, MAP_H);
  const d = img.data;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = grid[y * MAP_W + x];
      const [base, speckle] = PALETTE[t] || PALETTE[T.ROUGH];
      let hex;
      if (t === T.FAIRWAY || t === T.GREEN) {
        // mowing stripes
        hex = Math.floor((x + y) / 6) % 2 === 0 ? base : speckle;
      } else {
        hex = hash(x, y) < 0.25 ? speckle : base;
      }
      const i = (y * MAP_W + x) * 4;
      d[i]     = parseInt(hex.slice(1, 3), 16);
      d[i + 1] = parseInt(hex.slice(3, 5), 16);
      d[i + 2] = parseInt(hex.slice(5, 7), 16);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
