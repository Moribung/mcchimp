/**
 * src/lib/mma/utils.js
 * ─────────────────────────────────────────
 * Pure utility helpers. No imports. No side effects.
 */

import { FIRST_NAMES, LAST_NAMES, NICKNAMES } from './constants.js';

/** Fisher-Yates shuffle — returns a new array */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick a random element from an array */
export function rng(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Random integer between min and max (inclusive) */
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Generate a random fighter name from the name pools */
export function generateFighterName() {
  const fn   = rng(FIRST_NAMES);
  const ln   = rng(LAST_NAMES);
  const nick = Math.random() > 0.4 ? rng(NICKNAMES) : null;
  return nick ? `${fn} "${nick}" ${ln}` : `${fn} ${ln}`;
}
