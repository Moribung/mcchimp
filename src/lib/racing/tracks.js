/**
 * Track registry. A track is just a closed SVG path (the centreline loop)
 * authored within a 680×360 box, plus a little metadata. Because TrackScene
 * derives every car position and heading from the path via getPointAtLength,
 * the renderer is shape-agnostic — adding a circuit is adding a row here.
 *
 * Gameplay modifiers:
 *   laps     — race length in laps
 *   wearMult — tyre-wear multiplier (twisty circuits chew tyres → pit sooner)
 */
export const TRACKS = [
  {
    id: 'autodromo',
    name: 'Autodromo',
    corners: 8,
    laps: 6,
    wearMult: 1.0,
    blurb: 'A balanced circuit — flowing corners and a long straight.',
    d: 'M150 285 C70 275 78 175 165 168 C252 161 250 78 360 78 C470 78 470 170 558 180 C648 190 636 296 536 302 C418 309 262 316 150 285 Z',
  },
  {
    id: 'speedbowl',
    name: 'Speed Bowl',
    corners: 4,
    laps: 8,
    wearMult: 0.8,
    blurb: 'Fast and flowing — kind to tyres, short on overtaking spots.',
    d: 'M130 240 C130 150 240 120 350 120 C470 120 560 155 560 240 C560 315 440 322 345 322 C240 322 130 320 130 240 Z',
  },
  {
    id: 'harbour',
    name: 'Harbour Street',
    corners: 12,
    laps: 5,
    wearMult: 1.3,
    blurb: 'Twisty street circuit — hard on tyres, duels everywhere.',
    d: 'M110 280 C80 230 110 168 172 176 C222 182 236 118 302 128 C358 136 350 196 412 188 C478 180 482 116 548 142 C616 168 614 246 558 268 C504 289 524 326 438 327 C330 328 192 330 110 280 Z',
  },
];

export function trackById(id) {
  return TRACKS.find(t => t.id === id) || TRACKS[0];
}

export function randomTrackId() {
  return TRACKS[Math.floor(Math.random() * TRACKS.length)].id;
}
