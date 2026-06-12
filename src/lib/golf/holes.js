/**
 * Hand-crafted hole layouts.
 *
 * Each hole is authored as ordered shape primitives painted over a base of
 * ROUGH on a 192×96 map (see terrain.js for rasterization). A 2px border
 * ring is always OB. `scale` = yards per map pixel, so short and long holes
 * both fill the frame.
 *
 * Shapes:
 *   { t, shape: 'rect',    x, y, w, h }
 *   { t, shape: 'ellipse', c: [cx, cy], rx, ry }
 *   { t, shape: 'path',    pts: [[x,y],...], w }   — capsule along a polyline
 */

export const HOLES = [
  {
    num: 1, name: 'Opening Drive', par: 4, scale: 2.0,
    tee: [14, 72], pin: [174, 26],
    features: [
      { t: 'fairway', shape: 'path', pts: [[20, 72], [105, 66], [152, 36]], w: 16 },
      { t: 'green',   shape: 'ellipse', c: [174, 26], rx: 11, ry: 8 },
      { t: 'sand',    shape: 'ellipse', c: [158, 40], rx: 6, ry: 4 },
      { t: 'sand',    shape: 'ellipse', c: [182, 38], rx: 4, ry: 3 },
      { t: 'water',   shape: 'rect', x: 108, y: 80, w: 56, h: 14 },
      { t: 'trees',   shape: 'ellipse', c: [82, 18], rx: 22, ry: 10 },
      { t: 'trees',   shape: 'ellipse', c: [30, 30], rx: 14, ry: 8 },
      { t: 'tee',     shape: 'rect', x: 10, y: 68, w: 8, h: 8 },
    ],
  },
  {
    num: 2, name: 'The Pond', par: 3, scale: 1.0,
    tee: [18, 48], pin: [168, 48],
    features: [
      { t: 'fairway', shape: 'path', pts: [[26, 48], [70, 48]], w: 10 },
      { t: 'water',   shape: 'ellipse', c: [110, 50], rx: 28, ry: 18 },
      { t: 'green',   shape: 'ellipse', c: [168, 48], rx: 12, ry: 10 },
      { t: 'sand',    shape: 'ellipse', c: [150, 32], rx: 5, ry: 4 },
      { t: 'sand',    shape: 'ellipse', c: [152, 66], rx: 5, ry: 4 },
      { t: 'trees',   shape: 'ellipse', c: [100, 12], rx: 24, ry: 8 },
      { t: 'trees',   shape: 'ellipse', c: [100, 86], rx: 24, ry: 7 },
      { t: 'tee',     shape: 'rect', x: 14, y: 44, w: 8, h: 8 },
    ],
  },
  {
    num: 3, name: 'Long Haul', par: 5, scale: 2.5,
    tee: [12, 22], pin: [168, 70],
    features: [
      { t: 'fairway', shape: 'path', pts: [[18, 22], [80, 26], [120, 52], [148, 64]], w: 14 },
      { t: 'green',   shape: 'ellipse', c: [168, 70], rx: 10, ry: 8 },
      { t: 'sand',    shape: 'ellipse', c: [100, 36], rx: 7, ry: 4 },
      { t: 'sand',    shape: 'ellipse', c: [152, 56], rx: 5, ry: 4 },
      { t: 'water',   shape: 'ellipse', c: [60, 64], rx: 26, ry: 14 },
      { t: 'trees',   shape: 'ellipse', c: [120, 14], rx: 30, ry: 9 },
      { t: 'trees',   shape: 'ellipse', c: [150, 30], rx: 12, ry: 7 },
      { t: 'tee',     shape: 'rect', x: 8, y: 18, w: 8, h: 8 },
    ],
  },
  {
    num: 4, name: 'Dogleg Left', par: 4, scale: 1.9,
    tee: [178, 78], pin: [30, 24],
    features: [
      { t: 'fairway', shape: 'path', pts: [[172, 78], [110, 74], [60, 40], [40, 30]], w: 14 },
      { t: 'green',   shape: 'ellipse', c: [30, 24], rx: 10, ry: 8 },
      { t: 'sand',    shape: 'ellipse', c: [48, 18], rx: 6, ry: 4 },
      { t: 'sand',    shape: 'ellipse', c: [22, 40], rx: 5, ry: 3 },
      { t: 'trees',   shape: 'ellipse', c: [100, 36], rx: 24, ry: 12 },
      { t: 'trees',   shape: 'ellipse', c: [160, 24], rx: 22, ry: 10 },
      { t: 'water',   shape: 'rect', x: 20, y: 70, w: 44, h: 18 },
      { t: 'tee',     shape: 'rect', x: 174, y: 74, w: 8, h: 8 },
    ],
  },
  {
    num: 5, name: 'The Island', par: 3, scale: 0.9,
    tee: [16, 48], pin: [150, 48],
    features: [
      { t: 'fairway', shape: 'path', pts: [[24, 48], [70, 48]], w: 10 },
      { t: 'water',   shape: 'ellipse', c: [122, 48], rx: 38, ry: 24 },
      { t: 'green',   shape: 'ellipse', c: [150, 48], rx: 14, ry: 12 },
      { t: 'trees',   shape: 'ellipse', c: [100, 10], rx: 30, ry: 7 },
      { t: 'trees',   shape: 'ellipse', c: [100, 86], rx: 30, ry: 7 },
      { t: 'tee',     shape: 'rect', x: 12, y: 44, w: 8, h: 8 },
    ],
  },
  {
    num: 6, name: 'Double Cross', par: 5, scale: 2.6,
    tee: [14, 80], pin: [168, 22],
    features: [
      { t: 'fairway', shape: 'path', pts: [[20, 80], [80, 74], [128, 58], [118, 34], [150, 26]], w: 13 },
      { t: 'green',   shape: 'ellipse', c: [168, 22], rx: 9, ry: 7 },
      { t: 'water',   shape: 'ellipse', c: [60, 34], rx: 22, ry: 13 },
      { t: 'trees',   shape: 'ellipse', c: [162, 52], rx: 16, ry: 8 },
      { t: 'sand',    shape: 'ellipse', c: [152, 36], rx: 5, ry: 4 },
      { t: 'sand',    shape: 'ellipse', c: [100, 70], rx: 6, ry: 4 },
      { t: 'tee',     shape: 'rect', x: 10, y: 76, w: 8, h: 8 },
    ],
  },
  {
    num: 7, name: 'The Corridor', par: 4, scale: 2.0,
    tee: [14, 24], pin: [174, 72],
    features: [
      { t: 'fairway', shape: 'path', pts: [[20, 24], [90, 40], [152, 64]], w: 12 },
      { t: 'green',   shape: 'ellipse', c: [174, 72], rx: 9, ry: 8 },
      { t: 'trees',   shape: 'ellipse', c: [80, 8],  rx: 44, ry: 8 },
      { t: 'trees',   shape: 'ellipse', c: [70, 58], rx: 26, ry: 8 },
      { t: 'trees',   shape: 'ellipse', c: [150, 36], rx: 18, ry: 7 },
      { t: 'sand',    shape: 'ellipse', c: [156, 78], rx: 6, ry: 4 },
      { t: 'tee',     shape: 'rect', x: 10, y: 20, w: 8, h: 8 },
    ],
  },
  {
    num: 8, name: 'Ring of Sand', par: 3, scale: 1.2,
    tee: [18, 70], pin: [160, 30],
    features: [
      { t: 'fairway', shape: 'path', pts: [[26, 70], [60, 60]], w: 9 },
      { t: 'green',   shape: 'ellipse', c: [160, 30], rx: 11, ry: 9 },
      { t: 'sand',    shape: 'ellipse', c: [142, 42], rx: 6, ry: 4 },
      { t: 'sand',    shape: 'ellipse', c: [178, 36], rx: 5, ry: 4 },
      { t: 'sand',    shape: 'ellipse', c: [150, 14], rx: 6, ry: 4 },
      { t: 'sand',    shape: 'ellipse', c: [176, 16], rx: 5, ry: 3 },
      { t: 'trees',   shape: 'ellipse', c: [70, 14], rx: 28, ry: 8 },
      { t: 'tee',     shape: 'rect', x: 14, y: 66, w: 8, h: 8 },
    ],
  },
  {
    num: 9, name: 'Final Test', par: 4, scale: 2.1,
    tee: [14, 44], pin: [170, 56],
    features: [
      { t: 'fairway', shape: 'path', pts: [[20, 44], [80, 48], [116, 52]], w: 15 },
      { t: 'water',   shape: 'ellipse', c: [142, 68], rx: 14, ry: 8 },
      { t: 'green',   shape: 'ellipse', c: [170, 56], rx: 10, ry: 9 },
      { t: 'sand',    shape: 'ellipse', c: [166, 36], rx: 6, ry: 4 },
      { t: 'trees',   shape: 'ellipse', c: [100, 14], rx: 30, ry: 8 },
      { t: 'trees',   shape: 'ellipse', c: [70, 78], rx: 24, ry: 8 },
      { t: 'tee',     shape: 'rect', x: 10, y: 40, w: 8, h: 8 },
    ],
  },
];

export function holeYards(hole) {
  return Math.round(Math.hypot(hole.pin[0] - hole.tee[0], hole.pin[1] - hole.tee[1]) * hole.scale);
}

/**
 * Build a sequence of `count` hole-layout indices with no repeats inside any
 * nine (one shuffled bag of all holes per cycle), and no identical hole across
 * the seam between bags. So a 9-hole round visits every map once; an 18-hole
 * round plays two independently shuffled nines.
 */
export function buildHoleOrder(count) {
  const order = [];
  while (order.length < count) {
    const bag = HOLES.map((_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    // avoid the seam repeating the previous bag's last hole
    if (order.length && bag.length > 1 && bag[0] === order[order.length - 1]) {
      [bag[0], bag[1]] = [bag[1], bag[0]];
    }
    order.push(...bag);
  }
  return order.slice(0, count);
}
