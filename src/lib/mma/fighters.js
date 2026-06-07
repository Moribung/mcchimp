/**
 * src/lib/mma/fighters.js
 * ─────────────────────────────────────────
 * Fighter registry — module-level FIGHTERS Map and all helpers.
 *
 * Rules:
 *  - FIGHTERS is module-level. Do NOT put it in $state — too large and mutable.
 *  - Always call resetFighters() at the start of a new career.
 *  - Division slots hold fid strings only (never objects).
 *  - All record mutations go through recWin / recLoss / recDraw.
 */

import {
  FIRST_NAMES, LAST_NAMES, NICKNAMES,
  FIGHTER_ROSTER, DIVISION_SIZE, CHAMP_SLOT, RANKED_START,
  VENUES_P1, VENUES_P2, VENUES_P3, GFL_CITIES,
  ALL_PROFILE_STYLES, SELECTABLE_KO, SELECTABLE_TKO, SELECTABLE_SUB,
  FIGHTER_PROFILES, FUN_FACTS,
} from './constants.js';

import { shuffle, rng, randInt } from './utils.js';
import { pickEthnicGroup, pickFighterName, pickFightStyleForEthnicity, pickNationality, STYLE_ID_TO_PROFILE, surnameLookOverride } from './names.js';
import { isoToFlag, countryName, COUNTRY_BY_NAME } from './countries.js';
import { REGIONS } from './regions.js';
import { ethnicAvatar } from '../avatar/ethnicLooks.js';

// Snapshot a fighter's appearance once, at creation. Origin priority:
// distinctive surname → generated ethnicity → dominant ethnicity of their region.
function dominantEthnicity(nationality) {
  const dist = REGIONS[COUNTRY_BY_NAME[nationality]?.regionId]?.ethnicDistribution;
  if (!dist) return 'vintage';
  let best = 'vintage', bw = -1;
  for (const [k, w] of Object.entries(dist)) { if (k !== '*' && w > bw) { bw = w; best = k; } }
  return best;
}
function makeLook(name, ethnicity, nationality, fid) {
  const origin = surnameLookOverride(name) || ethnicity || dominantEthnicity(nationality);
  return ethnicAvatar(origin, fid);
}

/* ── The registry ─────────────────────────────────────── */
export let FIGHTERS = new Map();

/* ── ID generation ───────────────────────────────────── */
export function makeFid() {
  return 'f_' + Math.random().toString(36).slice(2, 9);
}

/* ── Record string builder ───────────────────────────── */
export function buildRec(w, l, d) {
  return d > 0 ? `${w}-${l}-${d}` : `${w}-${l}`;
}

/* ── Signature moves ─────────────────────────────────────
   Every fighter gets one random signature finish per type. When they
   finish the player by that type, there's a 50% chance it's their
   signature (handled in combat.js). Drawn from the deliberate (selectable)
   move pools, never the generic 'KO'/'TKO'/ref-stoppage entries. */
export function makeSignatureMoves() {
  return {
    KO:         rng(SELECTABLE_KO),
    TKO:        rng(SELECTABLE_TKO),
    Submission: rng(SELECTABLE_SUB),
  };
}

/* Register a fighter object — returns its fid */
export function registerFighter(obj) {
  if (!obj.fid) obj.fid = makeFid();
  FIGHTERS.set(obj.fid, obj);
  return obj.fid;
}

/* Lookup fighter by fid — returns null if not found */
export function gf(fid) {
  if (!fid || fid === 'player') return null;
  // Safety: if fid is a legacy slot object (transition), register and return it
  if (typeof fid === 'object') {
    if (!fid.fid) fid.fid = makeFid();
    FIGHTERS.set(fid.fid, fid);
    return fid;
  }
  return FIGHTERS.get(fid) || null;
}

/* ── Record update helpers ───────────────────────────── */
export function recWin(fid) {
  const f = FIGHTERS.get(fid); if (!f) return;
  f.wins      = (f.wins || 0) + 1;
  f.winStreak  = (f.winStreak  || 0) + 1;
  f.lossStreak = 0;
  f.npcDurability = Math.max(0, (f.npcDurability ?? 100) - 1);
  f.record = buildRec(f.wins, f.losses || 0, f.draws || 0);
}

export function recLoss(fid) {
  const f = FIGHTERS.get(fid); if (!f) return;
  f.losses     = (f.losses || 0) + 1;
  f.lossStreak = (f.lossStreak || 0) + 1;
  f.winStreak  = 0;
  if (f.isRising) f.isRising = false;
  f.npcDurability = Math.max(0, (f.npcDurability ?? 100) - 3);
  f.record = buildRec(f.wins || 0, f.losses, f.draws || 0);
}

// Record an NPC winning the championship of their current division. Counts
// reigns won while in this division; reset to 0 whenever a fighter changes
// divisions (the "former champion" tag is division-scoped).
export function recTitleWin(fid) {
  const f = FIGHTERS.get(fid); if (!f) return;
  f.divTitleWins = (f.divTitleWins || 0) + 1;
}

export function recDraw(fid) {
  const f = FIGHTERS.get(fid); if (!f) return;
  f.draws = (f.draws || 0) + 1;
  f.record = buildRec(f.wins || 0, f.losses || 0, f.draws);
}

/* ── Slot helpers ────────────────────────────────────── */

/** Swap two slot entries (fid strings) in a division */
export function swapSlots(div, a, b) {
  const tmp = div.slots[a];
  div.slots[a] = div.slots[b];
  div.slots[b] = tmp;
}

/** Migrate a single slot from legacy object to fid string.
 *  Safe to call multiple times — no-op if already a fid string. */
export function migrateSlot(div, i) {
  const val = div.slots[i];
  if (!val || typeof val === 'string') return val;
  const fid = registerFighter(val);
  div.slots[i] = fid;
  return fid;
}

/** Migrate ALL slots in a division from objects to fid strings. */
export function migrateDivSlots(div) {
  if (!div || !div.slots) return;
  div.slots = div.slots.map(s => {
    if (!s) return null;
    if (typeof s === 'string') return s;
    return registerFighter(s);
  });
}

/** Reset the fighter registry — call at career start. */
export function resetFighters() {
  FIGHTERS = new Map();
}

/** Get the current FIGHTERS Map — use this instead of importing FIGHTERS directly
 *  when you need to read it after a possible resetFighters() call (e.g. in saves.js). */
export function getFighters() { return FIGHTERS; }

/** Set of full names currently occupying a slot in any of the given divisions,
 *  plus the player's name. Used to keep generated fighter names unique so two
 *  visible fighters never share a name. */
export function activeNameSet(divisions, playerName) {
  const names = new Set();
  if (playerName) names.add(playerName);
  for (const div of Object.values(divisions || {})) {
    if (!div || !Array.isArray(div.slots)) continue;
    for (const fid of div.slots) {
      if (!fid || fid === 'player') continue;
      const f = FIGHTERS.get(fid);
      if (f && f.name) names.add(f.name);
    }
  }
  return names;
}

/** True if any registered fighter already has this exact full name. The registry
 *  is reset per career, so this gives career-wide name uniqueness for new fighters. */
function nameTaken(name) {
  for (const f of FIGHTERS.values()) if (f && f.name === name) return true;
  return false;
}

/* ── Fighter classification ──────────────────────────── */
export function classifyFighter(slot, divisionSlot, phase, isChamp) {
  if (slot.isPlayer) return { label: 'You', emoji: '🥊' };
  if (isChamp)       return { label: 'Champion', emoji: '🏆' };
  // Multi-time champion of this division who's since lost the belt.
  if ((slot.divTitleWins || 0) > 1) return { label: 'Former Champion', emoji: '👑' };

  const w = slot.wins   != null ? slot.wins   : parseInt((slot.record || '0').split('-')[0]) || 0;
  const l = slot.losses != null ? slot.losses : parseInt((slot.record || '0').split('-')[1]) || 0;
  const d = slot.draws  || 0;
  const total     = w + l + d;
  const rate      = total > 0 ? w / total : 0;
  const topRanked = divisionSlot >= CHAMP_SLOT - 4;
  const midRanked = divisionSlot >= RANKED_START + 5;

  const base = classifyBase();

  // "Veteran" is driven by durability, not win rate: a worn-down non-champion
  // (durability below 50%) earns the prefix on whatever their skill title is.
  const durability = slot.npcDurability ?? 100;
  if (durability < 50 && !base.label.includes('Veteran')) {
    return { label: `Veteran ${base.label}`, emoji: base.emoji };
  }
  return base;

  function classifyBase() {
    if (phase === 1) {
      if (total < 4)                                return { label: 'Unknown',           emoji: '❓' };
      if (total < 10 && rate >= 0.85 && w >= 5)    return { label: 'Regional Prospect', emoji: '⚡' };
      if (topRanked && rate >= 0.70 && total >= 8) return { label: 'Regional Elite',    emoji: '🌟' };
      if (total >= 12 && rate < 0.40)              return { label: 'Regional Bum',      emoji: '💩' };
      if (total >= 8  && rate < 0.52)              return { label: 'Journeyman',        emoji: '🎒' };
      if (total >= 6  && rate >= 0.65)             return { label: 'Circuit Regular',   emoji: '🥊' };
      return                                       { label: 'Regional Fighter',         emoji: '👊' };
    }

    if (phase === 2) {
      if (total < 12 && rate >= 0.88 && w >= 6)    return { label: 'Hot Prospect',     emoji: '🚀' };
      if (total < 15 && rate >= 0.80 && w >= 8)    return { label: 'Prospect',         emoji: '⚡' };
      if (total >= 25 && rate >= 0.75 && topRanked) return { label: 'Elite Contender', emoji: '💎' };
      if (total >= 15 && rate < 0.42)              return { label: 'Journeyman',        emoji: '🎒' };
      if (total >= 12 && rate < 0.52)              return { label: 'Gatekeeper',        emoji: '🚧' };
      if (midRanked  && rate >= 0.65)              return { label: 'Contender',         emoji: '🔥' };
      if (rate >= 0.72 && total >= 10)             return { label: 'Solid Fighter',     emoji: '🥊' };
      return                                       { label: 'Mid-level Fighter',        emoji: '👊' };
    }

    // Phase 3
    if (total < 18 && rate >= 0.90 && w >= 12)    return { label: 'Hot Prospect',      emoji: '🚀' };
    if (total >= 30 && rate >= 0.87)              return { label: 'GOAT Candidate',     emoji: '🐐' };
    if (total >= 25 && rate >= 0.80 && topRanked) return { label: 'All-Time Great',    emoji: '💎' };
    if (total >= 20 && rate >= 0.75)              return { label: 'Elite Contender',    emoji: '🌟' };
    if (total >= 15 && rate < 0.48)               return { label: 'Journeyman',         emoji: '🎒' };
    if (total >= 12 && rate < 0.55)               return { label: 'Gatekeeper',         emoji: '🚧' };
    if (topRanked  && rate >= 0.72)               return { label: 'Top Contender',      emoji: '🔥' };
    if (rate >= 0.68 && total >= 12)              return { label: 'Ranked Contender',   emoji: '🥊' };
    return                                        { label: 'Contender',                 emoji: '👊' };
  }
}

/* ── Scouting report (bio) ───────────────────────────────
   Generated from the fighter's real, current stats so it never contradicts
   the rest of the card. Deterministic (no rng) → stable, no flicker.
   Two clauses: current FORM (most salient true fact) + the THREAT they pose
   (derived from their actual style finish profile). */
export function fighterBio(f) {
  if (!f) return '';
  const w = f.wins || 0, l = f.losses || 0, d = f.draws || 0;
  const total = w + l + d;
  const ws  = f.winStreak  || 0;
  const ls  = f.lossStreak || 0;
  const dur = f.npcDurability ?? 100;

  // Form clause — first match wins, in order of how much it defines the fighter.
  let form = '';
  if (l === 0 && w >= 3)            form = `Undefeated at ${w}-0 — nobody has solved him yet.`;
  else if (ws >= 5)                 form = `Riding a ${ws}-fight win streak and peaking.`;
  else if (ws >= 3)                 form = `On a ${ws}-fight run and brimming with confidence.`;
  else if (ls >= 4)                 form = `In free-fall — ${ls} straight losses.`;
  else if (ls >= 2)                 form = `Cold lately, having dropped his last ${ls}.`;
  else if (dur < 35 && total >= 12) form = `A worn veteran; ${total} hard fights have taken their toll.`;
  else if (dur < 50)                form = `The miles are starting to show on him.`;
  else if (f.isRising)              form = `A fast-rising prospect with real buzz behind him.`;
  else if (total >= 30)             form = `A ${total}-fight veteran who has seen it all.`;
  else if (total >= 18)             form = `Deep into a long pro career at ${w}-${l}${d ? `-${d}` : ''}.`;
  else if (total <= 4)              form = `Still an unknown quantity — only ${total} pro fight${total === 1 ? '' : 's'}.`;

  // Threat clause — how he actually finishes, read from his style profile.
  let threat = '';
  if (f.style) {
    const off = FIGHTER_PROFILES[f.style]?.off;
    if (off) {
      const top = ['KO', 'TKO', 'Submission'].reduce((a, k) => ((off[k] ?? 0) > (off[a] ?? 0) ? k : a), 'KO');
      const phrase = top === 'KO'         ? 'who carries genuine knockout power'
                   : top === 'Submission' ? 'who hunts the finish on the mat'
                                          : 'who grinds opponents down for the late stoppage';
      threat = `A ${f.style} ${phrase}.`;
    } else {
      threat = `Fights as a ${f.style}.`;
    }
  }

  // Occasional flavor fact — rolled once per fighter and cached so it stays
  // stable (and persists with the save). '' = rolled, no fact; undefined = not yet rolled.
  if (f.funFact === undefined) {
    f.funFact = Math.random() < 0.33 ? rng(FUN_FACTS) : '';
  }

  return [form, threat, f.funFact].filter(Boolean).join(' ');
}

/* ── Roster fighter lookup ───────────────────────────── */

/** Find a roster fighter whose prefixes match the question ID, or null */
export function findRosterFighter(questionId) {
  if (!questionId) return null;
  return FIGHTER_ROSTER.find(f => f.prefixes.some(p => questionId.startsWith(p))) || null;
}

/** Pick a venue for the current fight. Returns { venue, city } — city is only set for phase 3. */
export function pickVenue(phase) {
  if (phase === 1) return { venue: rng(VENUES_P1), city: null };
  if (phase === 2) return { venue: rng(VENUES_P2), city: null };
  return { venue: rng(VENUES_P3), city: rng(GFL_CITIES) };
}

/** Build a fighter display object from a roster entry + phase context */
export function rosterFighterToOpponent(rf, phase) {
  const w      = rf.wRange ? Math.round((rf.wRange[0] + rf.wRange[1]) / 2) : 10;
  const l      = rf.lRange ? Math.round((rf.lRange[0] + rf.lRange[1]) / 2) : 3;
  const record = `${w}-${l}`;
  const name   = `${rf.fn} "${rf.nick}" ${rf.ln}`;
  const { venue, city } = pickVenue(phase);
  return {
    name, record,
    badge: '', badgeClass: '',
    bio:     '',
    venue,
    gflCity: city,
    rosterId: rf.id,
    style:    rf.style,
    flag:        isoToFlag(rf.nat),
    nationality: countryName(rf.nat),
  };
}

/* ── Division slot → opponent display object ─────────── */
export function divisionSlotToOpponent(fidOrObj, slot, cs) {
  let f, fid;
  if (typeof fidOrObj === 'string') {
    fid = fidOrObj;
    f   = fid === 'player' ? null : gf(fid);
  } else {
    f   = fidOrObj;
    fid = f ? f.fid : null;
  }
  if (!f) return null;

  const phase   = cs.phase;

  let badge = '', badgeClass = '';
  if (slot === CHAMP_SLOT)           { badge = 'Champion';                          badgeClass = 'oc-badge-champ'; }
  else if (slot >= CHAMP_SLOT - 3)   { badge = `#${CHAMP_SLOT - slot} Contender`;  badgeClass = 'oc-badge-contender'; }
  else if (slot >= RANKED_START)     { badge = `#${CHAMP_SLOT - slot} Ranked`;      badgeClass = 'oc-badge-ranked'; }

  const isChamp = slot === CHAMP_SLOT;
  const clf     = classifyFighter(f, slot, cs.phase, isChamp);

  // Ensure the fighter has stable signature moves (covers fighters built before
  // this feature, e.g. legacy saves). Written back so it persists & stays fixed.
  if (!f.signatureMoves) f.signatureMoves = makeSignatureMoves();

  let rankMovement = null;
  if (f.prevSlot != null && f.prevSlot !== slot) {
    const delta = slot - f.prevSlot;
    rankMovement = { delta: Math.abs(delta), direction: delta > 0 ? 'up' : 'down' };
  }

  return {
    fid,
    name:         f.name,
    record:       f.record,
    bio:          fighterBio(f),
    ...(() => { const { venue, city } = pickVenue(phase); return { venue, gflCity: city }; })(),
    badge,
    badgeClass,
    rosterId:     f.rosterId,
    style:        f.style || '',
    flag:         f.flag || '',
    nationality:  f.nationality || '',
    ethnicity:    f.ethnicity || null,
    look:         f.look || null,
    signatureMoves: f.signatureMoves,
    divisionSlot: slot,
    classLabel:   clf.label,
    classEmoji:   clf.emoji,
    rankMovement,
  };
}

/* ── Procedural fighter generator ─────────────────────────
   Rolls an ethnicity from a region/tier distribution (or uniform when null),
   pulls name parts from that ethnicity's per-part mixes (with collision avoidance),
   maps to a style profile, and stamps a curated nationality/flag.
   Returns plain fields — the caller builds the fighter object. */
export function generateProcedural({ ethnicDist = null, usedFirstNames, usedLastNames, usedNicks } = {}) {
  const id = pickEthnicGroup(ethnicDist);
  let fn, ln, nick, name, outer = 0;
  do {
    let a = 0; do { ({ fn } = pickFighterName(id)); a++; } while (usedFirstNames?.has(fn) && a < 60);
    a = 0;     do { ({ ln } = pickFighterName(id)); a++; } while (usedLastNames?.has(ln) && a < 60);
    ({ nick } = pickFighterName(id));
    if (nick && usedNicks?.has(nick)) nick = null;
    name = nick ? `${fn} "${nick}" ${ln}` : `${fn} ${ln}`;
    outer++;
  } while (nameTaken(name) && outer < 40);
  const nat   = pickNationality(id);
  const style = STYLE_ID_TO_PROFILE[pickFightStyleForEthnicity(id)] || rng(ALL_PROFILE_STYLES);
  return { fn, ln, nick, name, style, flag: nat.flag, nationality: nat.name, ethnicity: id };
}

/* ── Division builder ────────────────────────────────── */
export function buildDivision(phaseDef, fighterName, ethnicDist = null) {
  const slots          = [];
  const usedFirstNames = new Set();
  const usedLastNames  = new Set();
  const usedNicks      = new Set();

  const rosterPool = shuffle([...FIGHTER_ROSTER]);
  let rosterIdx = 0;

  // Reserve player name parts so no NPC shares them
  const pp = fighterName.split(' ');
  usedFirstNames.add(pp[0]);
  usedLastNames.add(pp[pp.length - 1]);

  function nextRosterOrProcedural() {
    while (rosterIdx < rosterPool.length) {
      const rf = rosterPool[rosterIdx++];
      const rosterName = `${rf.fn} "${rf.nick}" ${rf.ln}`;
      // Skip if name parts clash within this division, or the full name is already
      // used by a fighter in another division (prevents cross-division duplicates).
      if (usedFirstNames.has(rf.fn) || usedLastNames.has(rf.ln) || nameTaken(rosterName)) continue;
      usedFirstNames.add(rf.fn);
      usedLastNames.add(rf.ln);
      usedNicks.add(rf.nick);
      return { name: rosterName, rosterId: rf.id, style: rf.style, flag: isoToFlag(rf.nat), nationality: countryName(rf.nat), ethnicity: null };
    }
    // Procedural fallback when roster is exhausted — unique within the division
    // (by name part) and globally (full name not already in the registry).
    // Ethnicity/flag/name parts driven by the division's region/tier distribution.
    const gen = generateProcedural({ ethnicDist, usedFirstNames, usedLastNames, usedNicks });
    if (gen.nick) usedNicks.add(gen.nick);
    usedFirstNames.add(gen.fn); usedLastNames.add(gen.ln);
    return { name: gen.name, rosterId: null, style: gen.style, flag: gen.flag, nationality: gen.nationality, ethnicity: gen.ethnicity };
  }

  // Derive phase number from phaseDef.name (caller passes PHASES[n])
  let phase = 1;
  if (phaseDef && phaseDef.name === 'Mid-Tier Promotion') phase = 2;
  if (phaseDef && phaseDef.name === 'Top Promotion')      phase = 3;

  // Seed 1–2 rising contenders in the lower-mid ranked area
  const risingSlots = new Set();
  const numRising   = randInt(1, 2);
  while (risingSlots.size < numRising) risingSlots.add(randInt(1, 10));

  for (let i = 0; i < DIVISION_SIZE; i++) {
    if (i === 0) {
      slots.push('player');
    } else {
      const { name, rosterId, style, flag, nationality, ethnicity } = nextRosterOrProcedural();
      let w, l, d = 0;
      const rank = i;

      if (phase === 1) {
        const baseFights = randInt(3 + Math.floor(rank * 0.6), 6 + rank * 2);
        let rate;
        if (rank >= 17)      rate = 0.40 + Math.random() * 0.18;
        else if (rank >= 13) rate = 0.26 + Math.random() * 0.15;
        else if (rank >= 8)  rate = 0.16 + Math.random() * 0.14;
        else                 rate = 0.08 + Math.random() * 0.14;
        w = Math.max(0, Math.round(baseFights * rate));
        const minLoss = rank < 5 ? 6 : rank < 10 ? 4 : rank < 16 ? 2 : 1;
        l = Math.max(minLoss, baseFights - w);
        if (rank < 6 && Math.random() < 0.20) { w = 0; }
        w = Math.max(0, w);
        d = Math.random() > 0.94 ? 1 : 0;

      } else if (phase === 2) {
        const baseFights = randInt(8 + rank, 14 + rank * 2);
        let rate;
        if (rank >= 16)      rate = 0.60 + Math.random() * 0.22;
        else if (rank >= 10) rate = 0.44 + Math.random() * 0.18;
        else if (rank >= 5)  rate = 0.32 + Math.random() * 0.18;
        else                 rate = 0.22 + Math.random() * 0.18;
        w = Math.max(3, Math.round(baseFights * rate));
        l = Math.max(rank < 8 ? 4 : 2, baseFights - w);
        d = Math.random() > 0.84 ? 1 : 0;

      } else {
        const baseFights = randInt(14 + rank, 22 + rank * 2);
        let rate;
        if (rank >= 18)      rate = 0.82 + Math.random() * 0.13;
        else if (rank >= 14) rate = 0.70 + Math.random() * 0.16;
        else if (rank >= 8)  rate = 0.56 + Math.random() * 0.18;
        else                 rate = 0.42 + Math.random() * 0.16;
        w = Math.max(8, Math.round(baseFights * rate));
        l = Math.max(1, baseFights - w);
        d = Math.random() > 0.80 ? 1 : 0;
      }

      // Rising contender override: strong record, low fight count
      if (risingSlots.has(i)) {
        w = randInt(5, 10);
        l = Math.random() < 0.25 ? 1 : 0;
        d = 0;
      }

      const rec = d ? `${w}-${l}-${d}` : `${w}-${l}`;
      const totalFights = w + l + d;
      const fid = makeFid();
      const fighter = {
        fid,
        name, record:  rec,
        wins: w, losses: l, draws: d,
        isPlayer:       false,
        rosterId,       style,
        flag, nationality, ethnicity,
        look:           makeLook(name, ethnicity, nationality, fid), // appearance snapshot
        signatureMoves: makeSignatureMoves(),
        isRising:       risingSlots.has(i),
        prevSlot:       i,
        questionId:     null,
        calloutPenalty: 0,
        isNew:          false,
        npcDurability:  Math.max(20, Math.round(100 - totalFights * 1.0)),
      };
      FIGHTERS.set(fighter.fid, fighter);
      slots.push(fighter.fid);
    }
  }

  return { slots, playerSlot: 0 };
}
