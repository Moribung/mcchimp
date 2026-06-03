/**
 * Squad generation and management.
 * A squad has 18 players: 2 GK, 6 DEF, 6 MID, 4 FWD.
 * Top 11 by rating are 'Starter', rest are 'Rotation'.
 */

import { randomName } from './names.js';
import { randInt }    from './utils.js';

let _nextPlayerId = 1;

export function syncNextPlayerId(squad) {
  const max = Math.max(0, ...(squad || []).map(p => p.id || 0));
  if (max >= _nextPlayerId) _nextPlayerId = max + 1;
}

export function newPlayer(position, minRating = 45, maxRating = 65) {
  return {
    id:                   _nextPlayerId++,
    name:                 randomName(),
    position,
    rating:               randInt(minRating, maxRating),
    age:                  randInt(18, 33),
    goalsThisSeason:      0,
    goalsCareer:          0,
    status:               'Rotation',
    improvementPoints:    0,
    ratingChangeThisSeason: 0,
  };
}

export function generateSquad(startRating) {
  const lo = Math.max(40, startRating - 8);
  const hi = startRating + 5;
  const players = [];

  // GK: slightly lower variance, older on average
  for (let i = 0; i < 2; i++) {
    const p = newPlayer('GK', Math.max(40, lo - 3), hi - 3);
    p.age = randInt(22, 35);
    players.push(p);
  }
  for (let i = 0; i < 6; i++) players.push(newPlayer('DEF', lo, hi));
  for (let i = 0; i < 6; i++) players.push(newPlayer('MID', lo, hi));
  for (let i = 0; i < 4; i++) players.push(newPlayer('FWD', lo, hi));

  assignStatuses(players);
  return players;
}

export function assignStatuses(squad) {
  const nonGK = squad.filter(p => p.position !== 'GK');
  nonGK.sort((a, b) => b.rating - a.rating);
  nonGK.forEach((p, i) => { p.status = i < 9 ? 'Starter' : 'Rotation'; });

  // GK: best GK is Starter
  const gks = squad.filter(p => p.position === 'GK');
  gks.sort((a, b) => b.rating - a.rating);
  gks.forEach((p, i) => { p.status = i === 0 ? 'Starter' : 'Rotation'; });
}

export function calcTeamRating(squad) {
  const starters = squad.filter(p => p.status === 'Starter');
  if (!starters.length) return 50;
  return Math.round(starters.reduce((s, p) => s + p.rating, 0) / starters.length);
}

export function ipCost(player, matchdays) {
  const tierMult = player.rating <= 65 ? 1 : player.rating <= 75 ? 2 : player.rating <= 85 ? 4 : 8;
  const base     = Math.round((player.age * player.age) / 10) * tierMult;
  const scale    = matchdays ? matchdays / 38 : 1;
  return Math.max(1, Math.round(base * scale * 0.5));
}

export function applyIPUpgrades(player, matchdays) {
  const before = player.rating;
  let cost = ipCost(player, matchdays);
  while (player.improvementPoints >= cost && player.rating < 92) {
    player.improvementPoints -= cost;
    player.rating = Math.min(92, player.rating + 1);
    cost = ipCost(player, matchdays);
  }
  player.ratingChangeThisSeason = (player.ratingChangeThisSeason || 0) + (player.rating - before);
}
