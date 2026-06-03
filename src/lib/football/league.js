/**
 * League table, fixture generation, and NPC match simulation.
 */

import { DIV1_CLUBS_BASE, DIV2_CLUBS_BASE, relegationCount } from './constants.js';
import { randInt, shuffle, clamp }                            from './utils.js';

/* ── Table row factory ─────────────────────────────────── */
export function freshRow(id, name, rating, colours) {
  return { id, name, rating, colours: colours || [], pld:0, w:0, d:0, l:0, gf:0, ga:0, pts:0, form:[] };
}

/* ── Build initial tables ──────────────────────────────── */
export function buildInitialTables(playerClub, teamCount, division) {
  const tc   = teamCount || 18;
  const div1 = buildDivTable(DIV1_CLUBS_BASE, tc, playerClub, division === 1);
  const div2 = buildDivTable(DIV2_CLUBS_BASE, tc, playerClub, division === 2);
  return { div1, div2 };
}

function buildDivTable(baseClubs, tc, playerClub, includePlayer) {
  const slots = shuffle([...baseClubs]).slice(0, includePlayer ? tc - 1 : tc);
  const rows  = slots.map(c => freshRow(c.id, c.name, c.rating, c.colours));
  if (includePlayer) {
    rows.push(freshRow('player', playerClub.name, playerClub.rating, [playerClub.kitColour]));
    shuffle(rows); // random starting order
  }
  return rows;
}

/* ── Sorting ───────────────────────────────────────────── */
export function sortTable(rows) {
  return [...rows].sort((a, b) =>
    b.pts - a.pts ||
    (b.gf - b.ga) - (a.gf - a.ga) ||
    b.gf - a.gf ||
    a.name.localeCompare(b.name)
  );
}

/* ── Row update ────────────────────────────────────────── */
export function updateTableRow(row, goalsFor, goalsAgainst) {
  row.pld++;
  row.gf += goalsFor;
  row.ga += goalsAgainst;
  if (goalsFor > goalsAgainst) { row.w++; row.pts += 3; row.form.push('W'); }
  else if (goalsFor === goalsAgainst) { row.d++; row.pts += 1; row.form.push('D'); }
  else                          { row.l++; row.form.push('L'); }
  if (row.form.length > 5) row.form.shift();
}

/* ── Fixture generation — proper round-robin ───────────── */
/**
 * Generates a proper round-robin schedule where every team plays
 * exactly once per matchday. Uses the standard "circle method":
 * fix one team, rotate the rest around it each round.
 */
export function generateFixtures(table, returnFixtures) {
  const ids = [...table.map(r => r.id)];
  // Need even count; add a bye if odd (shouldn't happen with validated input)
  if (ids.length % 2 !== 0) ids.push('__bye__');
  const n = ids.length;
  const half = n / 2;
  const rounds = n - 1;

  // Shuffle the ids so the schedule order is random each new game
  const fixed = ids[0];
  const rotating = shuffle(ids.slice(1));

  const firstLegMds = [];
  for (let r = 0; r < rounds; r++) {
    const circle = [fixed, ...rotating];
    const matches = [];
    for (let i = 0; i < half; i++) {
      const h = circle[i];
      const a = circle[n - 1 - i];
      if (h === '__bye__' || a === '__bye__') continue;
      // Alternate home/away based on round parity
      if (r % 2 === 0) matches.push({ homeId: h, awayId: a, played: false, hg: null, ag: null });
      else             matches.push({ homeId: a, awayId: h, played: false, hg: null, ag: null });
    }
    firstLegMds.push({ matchday: r + 1, matches });
    // Rotate: move last element of rotating to front
    rotating.unshift(rotating.pop());
  }

  if (!returnFixtures) return firstLegMds;

  // Second leg: reverse home/away, shuffled matchday order
  const secondLegMds = shuffle([...firstLegMds]).map((md, i) => ({
    matchday: rounds + i + 1,
    matches: md.matches.map(m => ({
      homeId: m.awayId, awayId: m.homeId, played: false, hg: null, ag: null,
    })),
  }));

  return [...firstLegMds, ...secondLegMds];
}

/* ── NPC match simulation ──────────────────────────────── */
function simulateNpcMatch(homeRow, awayRow) {
  const homePow  = (homeRow?.rating || 60) + 3;
  const awayPow  = (awayRow?.rating || 60);
  const total    = homePow + awayPow;
  const hWinProb = clamp(homePow / total, 0.2, 0.8);
  const r        = Math.random();
  let hg, ag;
  if (r < hWinProb * 0.65) {
    hg = randInt(1, 3); ag = 0;
  } else if (r < hWinProb) {
    hg = randInt(1, 2); ag = randInt(0, 1);
  } else if (r < hWinProb + 0.18) {
    hg = randInt(0, 1); ag = randInt(0, 1);
  } else {
    hg = randInt(0, 1); ag = randInt(1, 3);
  }
  return { hg, ag };
}

export function simulateMatchday(fixtures, matchdayIdx, tableMap) {
  const md = fixtures[matchdayIdx];
  if (!md) return;
  md.matches.forEach(m => {
    if (m.played || m.homeId === 'player' || m.awayId === 'player') return;
    const { hg, ag } = simulateNpcMatch(tableMap[m.homeId], tableMap[m.awayId]);
    m.hg = hg; m.ag = ag; m.played = true;
    if (tableMap[m.homeId]) updateTableRow(tableMap[m.homeId], hg, ag);
    if (tableMap[m.awayId]) updateTableRow(tableMap[m.awayId], ag, hg);
  });
}

/* ── Promotion / relegation ────────────────────────────── */
export function resolvePromotionRelegation(div1Rows, div2Rows) {
  const div1Sorted = sortTable(div1Rows);
  const div2Sorted = sortTable(div2Rows);
  const rel        = relegationCount(Math.max(div1Sorted.length, div2Sorted.length));

  const relegated = div1Sorted.slice(-rel).map(r => r.id);
  const promoted  = div2Sorted.slice(0, rel).map(r => r.id);

  // Move relegated from div1 → div2
  relegated.forEach(id => {
    const row = div1Rows.find(r => r.id === id);
    if (!row) return;
    div1Rows.splice(div1Rows.indexOf(row), 1);
    div2Rows.push(row);
  });
  // Move promoted from div2 → div1
  promoted.forEach(id => {
    const row = div2Rows.find(r => r.id === id);
    if (!row) return;
    div2Rows.splice(div2Rows.indexOf(row), 1);
    div1Rows.push(row);
  });

  return { relegated, promoted };
}

export function driftClubRatings(div1, div2) {
  [...div1, ...div2].forEach(r => {
    if (r.id === 'player') return;
    r.rating = clamp(r.rating + randInt(-2, 2), 40, 95);
  });
}

/* ── Helpers ───────────────────────────────────────────── */
export function getTableRow(id, div1, div2) {
  return div1.find(r => r.id === id) || div2.find(r => r.id === id) || null;
}

export function getClubName(id, div1, div2) {
  const row = getTableRow(id, div1, div2);
  return row?.name || id;
}

export function getPlayerMatch(fixtures, matchday, division) {
  const md = fixtures[`div${division}`]?.[matchday - 1];
  if (!md) return null;
  return md.matches.find(m => m.homeId === 'player' || m.awayId === 'player') || null;
}
