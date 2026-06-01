/**
 * src/lib/mma/career.js
 * ─────────────────────────────────────────
 * Career engine — phase progression, division management, NPC simulation.
 * All functions accept state (and cs = state.career) as parameters.
 * No DOM. No Svelte. Pure logic.
 */

import {
  PHASES, PHASE2_OPTIONS, CHAMP_SLOT, RANKED_START,
  DURABILITY_DAMAGE, FIRST_NAMES, LAST_NAMES, NICKNAMES, FIGHTER_ROSTER,
  ALL_PROFILE_STYLES, KO_METHODS, TKO_METHODS, SUB_METHODS,
} from './constants.js';

import {
  FIGHTERS, makeFid, buildRec, resetFighters, makeSignatureMoves,
  gf, recWin, recLoss, recDraw,
  swapSlots, migrateDivSlots, buildDivision, divisionSlotToOpponent, activeNameSet,
} from './fighters.js';

import {
  ensureQPool, assignDivisionQuestions, tierForFight, buildSparringPool,
} from './questions.js';

import { rng, randInt, shuffle, generateFighterName } from './utils.js';

const lastName = name => name ? name.split(' ').pop() : '?';

// News entry for an NPC retirement. A fighter who leaves with a winning record
// and a real résumé is a notable departure — give it a high priority (so it
// isn't crowded out by routine fight results) and show their final record.
function retirementNewsItem(f) {
  const wins   = f?.wins   || 0;
  const losses = f?.losses || 0;
  const total  = wins + losses;
  const accomplished = total >= 8 && wins / total >= 0.5;
  return {
    priority: accomplished ? 2 : 5,
    type: 'fight',
    text: accomplished
      ? `${lastName(f?.name)} retires (${f?.record || `${wins}-${losses}`})`
      : `${lastName(f?.name)} retires`,
  };
}

/* ── Phase helpers ───────────────────────────────────── */
export function getPhaseDef(cs) {
  const def = PHASES[cs.phase] || PHASES[3];
  if (cs.phase === 2 && cs.phase2Name) {
    return {
      ...def,
      promo:      cs.phase2Name,
      rankLabels: { ...def.rankLabels, 11: cs.phase2Belt || 'Champion' },
    };
  }
  return def;
}
export function getPlayerSlot(cs) { return cs.division ? cs.division.playerSlot : 0; }
export function isPhaseChampion(cs) { return getPlayerSlot(cs) === CHAMP_SLOT; }

/* ── Per-organisation title tracking ─────────────────── */
// Each promotion (phase) has its own belt, tracked separately:
//   { reigns, defenseStreak, bestDefenseStreak, held }
export function blankTitle() {
  return { reigns: 0, defenseStreak: 0, bestDefenseStreak: 0, held: false };
}
export function ensureTitles(cs) {
  if (!cs) return null;
  if (!cs.titles) {
    cs.titles = { 1: blankTitle(), 2: blankTitle(), 3: blankTitle() };
    // Migrate a legacy single-belt save into the phase it was earned in.
    if (cs.titleHeld || cs.champCount) {
      const ph = cs.phase || 1;
      const t  = cs.titles[ph];
      t.held              = !!cs.titleHeld;
      t.reigns            = cs.champCount || (cs.titleHeld ? 1 : 0);
      t.defenseStreak     = cs.defenseStreak || 0;
      t.bestDefenseStreak = cs.defenseStreak || 0;
    }
  }
  for (const ph of [1, 2, 3]) if (!cs.titles[ph]) cs.titles[ph] = blankTitle();
  return cs.titles;
}
export function totalReigns(cs) {
  const t = cs?.titles;
  if (!t) return cs?.champCount || 0;
  return (t[1]?.reigns || 0) + (t[2]?.reigns || 0) + (t[3]?.reigns || 0);
}
export function phaseWinRate(cs) {
  const total = cs.phaseWins + cs.phaseLosses;
  return total > 0 ? cs.phaseWins / total : 1;
}

/* ── Slot label / CSS helpers ────────────────────────── */
export function slotToRankLabel(slot, pDef) {
  if (slot === CHAMP_SLOT)   return pDef.rankLabels[11] || 'Champion';
  if (slot < RANKED_START)   return 'Unranked';
  return `#${CHAMP_SLOT - slot} Ranked`;
}
export function slotToCssClass(slot) {
  if (slot === CHAMP_SLOT)  return 'rank-champion';
  if (slot < RANKED_START)  return 'rank-unranked';
  return 'rank-ranked';
}

/* ── Undefeated check ────────────────────────────────── */
export function isUndefeated(state) {
  return state.losses === 0 && state.finishes === 0 && (state.wins + state.draws) > 0;
}

/* ── Streak step calculation ─────────────────────────── */
export function rollSteps(streak, finishStreak, state) {
  const finBonus = finishStreak >= 3 ? 2 : finishStreak >= 1 ? 1 : 0;
  const maxSteps = isUndefeated(state) ? 10 : 5;
  const abs = Math.min(Math.abs(streak) + finBonus, 5);
  const tables = [
    [70, 30,  0,  0,  0],
    [70, 30,  0,  0,  0],
    [40, 45, 15,  0,  0],
    [20, 35, 30, 15,  0],
    [10, 25, 35, 20, 10],
    [ 5, 15, 30, 30, 20],
  ];
  const weights = tables[abs];
  const roll = Math.random() * 100;
  let cum = 0;
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i];
    if (roll < cum) return Math.min(i + 1, maxSteps);
  }
  return Math.min(weights.length, maxSteps);
}

export function streakSteps(streak, state) {
  return rollSteps(streak, (state && state.finishStreak) || 0, state);
}

/* ── Division slot movement ──────────────────────────── */
export function divisionJumpToSlot(div, targetSlot) {
  migrateDivSlots(div);
  const cur = div.playerSlot;
  targetSlot = Math.max(0, Math.min(CHAMP_SLOT, targetSlot));
  if (targetSlot === cur) return;
  const step = targetSlot > cur ? 1 : -1;
  let pos = cur;
  while (pos !== targetSlot) {
    swapSlots(div, pos, pos + step);
    pos += step;
  }
  div.playerSlot = targetSlot;
  // Safety: re-sync playerSlot to actual 'player' string position
  const actual = div.slots.indexOf('player');
  if (actual !== -1 && actual !== div.playerSlot) div.playerSlot = actual;
}

export function divisionMoveUp(div, steps) {
  divisionJumpToSlot(div, Math.min(CHAMP_SLOT, div.playerSlot + steps));
}
export function divisionMoveDown(div, steps) {
  divisionJumpToSlot(div, Math.max(0, div.playerSlot - steps));
}

/* ── Division sync alias ─────────────────────────────── */
export function syncDivisionAlias(state, cs) {
  if (!cs || !cs.divisions) return;
  if (!cs.divisions[cs.phase]) {
    cs.divisions[cs.phase] = buildDivision(PHASES[cs.phase], cs.fighterName);
    assignDivisionQuestions(state, cs.divisions[cs.phase], cs.phase);
  }
  cs.division = cs.divisions[cs.phase];
}

/* ── Phase A: player rank movement after result ──────── */
export function updateDivisionAfterResult(state, cs, won, draw, extraChallengerDrop, extraLossDrop = 0) {
  if (!cs.division) return;
  if (draw) return; // no movement on draw

  const wasChamp = cs.division.playerSlot === CHAMP_SLOT;

  if (won) {
    if (wasChamp) {
      if (extraChallengerDrop > 0) {
        const challengerSlot = CHAMP_SLOT - 1;
        const challFid = cs.division.slots[challengerSlot];
        const newSlot  = Math.max(1, challengerSlot - extraChallengerDrop);
        cs.division.slots.splice(challengerSlot, 1);
        cs.division.slots.splice(newSlot, 0, challFid);
      }
    } else {
      const oppSlot   = state.currentOpponent && typeof state.currentOpponent.divisionSlot === 'number'
        ? state.currentOpponent.divisionSlot : null;
      const playerSlot = cs.division.playerSlot;
      const foughtDown = oppSlot !== null && oppSlot < playerSlot;

      let steps = rollSteps(cs.phaseStreak, state.finishStreak || 0, state);
      if (foughtDown) {
        steps = Math.random() < 0.5 ? 0 : 1;
      } else if (oppSlot !== null) {
        steps = oppSlot - playerSlot; // land exactly at opponent's slot
      }
      if (steps > 0) {
        // Only allow reaching CHAMP_SLOT by beating the actual champion
        const cap = (oppSlot === CHAMP_SLOT) ? CHAMP_SLOT : CHAMP_SLOT - 1;
        divisionJumpToSlot(cs.division, Math.min(cap, cs.division.playerSlot + steps));
      }
    }
  } else {
    const lossAbs     = Math.abs(cs.phaseStreak);
    const drop2chance = Math.min(0.6, lossAbs * 0.15);
    const steps       = (Math.random() < drop2chance ? 2 : 1) + extraLossDrop;
    divisionMoveDown(cs.division, steps);
  }
}

/* ── NPC simulation ──────────────────────────────────── */
function durabilityMod(f) {
  const d = f.npcDurability ?? 100;
  if (d < 20) return -0.15;
  if (d < 50) return -0.07;
  return 0;
}

function retireChance(npcDurability) {
  const d = npcDurability ?? 100;
  if (d >= 30) return 0;
  return Math.pow(1 - d / 30, 3);
}

export function simulateNPCBouts(state, div, newsLog = null) {
  migrateDivSlots(div);
  const { slots, playerSlot } = div;
  const n = slots.length;
  const numBouts = randInt(5, 12);
  const retirees = [];

  for (let b = 0; b < numBouts; b++) {
    const candidates = [];
    for (let i = 1; i < n - 1; i++) {
      if (i !== playerSlot) candidates.push(i);
    }
    if (candidates.length < 2) break;

    const aIdx  = candidates[Math.floor(Math.random() * candidates.length)];
    const aF    = gf(slots[aIdx]);
    const wsA   = (aF && !aF.isPlayer) ? (aF.winStreak || 0) : 0;
    // Win-streak fighters get matched further up the rankings (up to +4 extra slots above)
    const upRange = 4 + Math.min(wsA, 4);
    const bPool = candidates.filter(i => i !== aIdx && (i - aIdx) <= upRange && (aIdx - i) <= 4);
    if (!bPool.length) continue;

    const bWeights = bPool.map(i => 1 / (Math.abs(i - aIdx) + 0.5));
    const bTotal   = bWeights.reduce((a, x) => a + x, 0);
    let bRand = Math.random() * bTotal;
    let bIdx  = bPool[bPool.length - 1];
    for (let j = 0; j < bPool.length; j++) {
      bRand -= bWeights[j];
      if (bRand <= 0) { bIdx = bPool[j]; break; }
    }

    const fidA = slots[aIdx], fidB = slots[bIdx];
    const a = gf(fidA), bSlot = gf(fidB);
    if (!a || !bSlot || a.isPlayer || bSlot.isPlayer) continue;

    let rateA = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0.30;
    let rateB = (bSlot.wins + bSlot.losses) > 0 ? bSlot.wins / (bSlot.wins + bSlot.losses) : 0.30;
    if (a.isRising)     rateA = Math.min(0.88, rateA + 0.18);
    if (bSlot.isRising) rateB = Math.min(0.88, rateB + 0.18);
    if (a.losses === 0 && a.wins > 0)         rateA = Math.min(0.92, rateA * 1.5);
    if (bSlot.losses === 0 && bSlot.wins > 0) rateB = Math.min(0.92, rateB * 1.5);

    // Streak modifiers (NPC only): win streak 1.2×→2×, loss streak 0.83×→0.5×
    function streakMod(f) {
      const ws = f.winStreak  || 0;
      const ls = f.lossStreak || 0;
      if (ws > 0) return Math.min(2.0, 1.0 + Math.min(ws, 5) * 0.16);
      if (ls > 0) return Math.max(0.5, 1.0 / (1.0 + Math.min(ls, 5) * 0.16));
      return 1.0;
    }
    rateA = Math.min(0.95, rateA * streakMod(a));
    rateB = Math.min(0.95, rateB * streakMod(bSlot));

    rateA = Math.max(0.05, rateA + durabilityMod(a));
    rateB = Math.max(0.05, rateB + durabilityMod(bSlot));

    const probA  = rateA / (rateA + rateB);
    const aWins  = Math.random() < probA;
    const winFid = aWins ? fidA : fidB;
    const loseFid = aWins ? fidB : fidA;
    const winIdx  = aWins ? aIdx : bIdx;
    const loseIdx = aWins ? bIdx : aIdx;

    recWin(winFid); recLoss(loseFid);

    // Winner lands at least at the opponent's slot; streak pushes them above it
    const winF  = gf(winFid);
    const ws    = winF ? (winF.winStreak || 1) : 1;
    const jump  = ws <= 2 ? 1 : ws <= 4 ? 2 : 3;
    const target = Math.min(CHAMP_SLOT - 1, Math.max(winIdx + jump, loseIdx));
    let wp = winIdx;
    while (wp < target) {
      const next = wp + 1;
      if (next >= n || next === playerSlot || next >= CHAMP_SLOT) break;
      swapSlots(div, wp, next);
      wp++;
    }

    // Loser may have been displaced by the winner's move — find their actual position
    const actualLoseIdx = div.slots.indexOf(loseFid);
    const dropSteps = Math.random() < 0.34 ? 2 : 1;
    let lp = actualLoseIdx !== -1 ? actualLoseIdx : loseIdx;
    for (let d = 0; d < dropSteps; d++) {
      if (lp - 1 < 1 || lp - 1 === playerSlot) break;
      swapSlots(div, lp, lp - 1);
      lp--;
    }

    // Retirement check for the loser
    const lF2 = gf(loseFid);
    if (lF2 && !lF2.isPlayer && Math.random() < retireChance(lF2.npcDurability)) {
      const retireSlot = div.slots.indexOf(loseFid);
      if (retireSlot > 0 && retireSlot !== playerSlot) retirees.push({ fid: loseFid, slot: retireSlot });
    }

    // News: top-5 contender fights, prospect wins, and ranked filler to ensure ≥5 items
    if (newsLog) {
      const topSlot = Math.max(aIdx, bIdx);
      const lF = gf(loseFid);
      const wR = winIdx >= RANKED_START ? `#${CHAMP_SLOT - winIdx} ` : '';
      const lR = loseIdx >= RANKED_START ? ` #${CHAMP_SLOT - loseIdx}` : '';
      if (topSlot >= CHAMP_SLOT - 5) {
        newsLog.push({ priority: 2, type: 'fight', text: `${wR}${lastName(winF?.name)} def.${lR} ${lastName(lF?.name)}` });
      } else if (winF?.isRising && winIdx >= RANKED_START) {
        newsLog.push({ priority: 4, type: 'prospect', text: `Prospect ${lastName(winF.name)} wins at #${CHAMP_SLOT - winIdx}` });
      } else if (topSlot >= RANKED_START) {
        newsLog.push({ priority: 6, type: 'fight', text: `${wR}${lastName(winF?.name)} def.${lR} ${lastName(lF?.name)}` });
      }

      // Significant streak news — surfaces ranked fighters on a hot or cold run.
      // winStreak/lossStreak were just updated by recWin/recLoss above.
      const wStreak = winF?.winStreak || 0;
      if (winIdx >= RANKED_START && wStreak >= 4) {
        newsLog.push({ priority: 4, type: 'prospect',
          text: `${lastName(winF?.name)} on a ${wStreak}-fight win streak` });
      }
      const lStreak = lF?.lossStreak || 0;
      if (loseIdx >= RANKED_START && lStreak >= 4) {
        newsLog.push({ priority: 7, type: 'fight',
          text: `${lastName(lF?.name)} skids to ${lStreak} straight losses` });
      }
    }
  }

  // Process retirements collected during the bout loop
  retirees.sort((a, b) => b.slot - a.slot); // highest slot first to avoid index drift
  for (const { fid, slot } of retirees) {
    if (div.slots[slot] !== fid) continue; // already displaced
    const rf = gf(fid);
    for (let s = slot; s > 1; s--) div.slots[s] = div.slots[s - 1];
    div.slots[1] = null;
    if (div.playerSlot > 0 && div.playerSlot < slot) div.playerSlot++;
    if (newsLog) newsLog.push(retirementNewsItem(rf));
  }

  // Champion bout: 75% chance when player is not champ
  const champFid = slots[CHAMP_SLOT];
  const champF   = gf(champFid);
  if (champFid && champF && !champF.isPlayer && div.playerSlot !== CHAMP_SLOT && Math.random() < 0.75) {
    let challengerIdx = -1;
    for (let ci = CHAMP_SLOT - 1; ci >= RANKED_START; ci--) {
      const cf = gf(slots[ci]);
      if (cf && !cf.isPlayer) { challengerIdx = ci; break; }
    }
    if (challengerIdx >= 0) {
      const challFid   = slots[challengerIdx];
      const challenger = gf(challFid);
      let rChamp = champF.wins > 0 ? champF.wins / (champF.wins + champF.losses) : 0.75;
      let rChall = challenger.wins > 0 ? challenger.wins / (challenger.wins + challenger.losses) : 0.30;
      if (champF.losses === 0 && champF.wins > 0)        rChamp = Math.min(0.95, rChamp * 1.5);
      if (challenger.losses === 0 && challenger.wins > 0) rChall = Math.min(0.92, rChall * 1.5);
      rChamp = Math.max(0.05, rChamp + durabilityMod(champF));
      rChall = Math.max(0.05, rChall + durabilityMod(challenger));
      const champWins = Math.random() < rChamp / (rChamp + rChall);

      if (champWins) {
        recWin(champFid); recLoss(challFid);
        const newSlot   = Math.max(1, challengerIdx - 5);
        const displaced = slots.splice(challengerIdx, 1)[0];
        slots.splice(newSlot, 0, displaced);
        if (div.playerSlot >= newSlot && div.playerSlot < challengerIdx) div.playerSlot++;
      } else {
        recLoss(champFid); recWin(challFid);
        swapSlots(div, CHAMP_SLOT, challengerIdx);
        if (div.playerSlot === challengerIdx)  div.playerSlot = CHAMP_SLOT;
        else if (div.playerSlot === CHAMP_SLOT) div.playerSlot = challengerIdx;
      }

      if (newsLog) {
        if (champWins) {
          newsLog.push({ priority: 1, type: 'championship', text: `${lastName(champF.name)} retains vs ${lastName(challenger.name)}` });
        } else {
          newsLog.push({ priority: 1, type: 'championship', text: `${lastName(challenger.name)} dethrones ${lastName(champF.name)}` });
        }
      }

      // Retirement check for the bout loser
      const champBoutLoserFid = champWins ? challFid : champFid;
      const champBoutLoserF   = gf(champBoutLoserFid);
      if (champBoutLoserF && !champBoutLoserF.isPlayer
          && Math.random() < retireChance(champBoutLoserF.npcDurability)) {
        const retireSlot = div.slots.indexOf(champBoutLoserFid);
        if (retireSlot > 0 && retireSlot !== div.playerSlot) {
          for (let s = retireSlot; s > 1; s--) div.slots[s] = div.slots[s - 1];
          div.slots[1] = null;
          if (div.playerSlot > 0 && div.playerSlot < retireSlot) div.playerSlot++;
          if (newsLog) newsLog.push(retirementNewsItem(champBoutLoserF));
        }
      }
    }
  }
}

/* ── Inter-division exchanges ────────────────────────── */
export function interDivisionExchanges(state, cs, newsLog = null) {
  if (!cs || !cs.divisions) return;

  for (let fromPhase = 1; fromPhase <= 2; fromPhase++) {
    const toPhase = fromPhase + 1;
    const fromDiv = cs.divisions[fromPhase];
    const toDiv   = cs.divisions[toPhase];
    if (!fromDiv || !toDiv) continue;

    let exchangeDone = false;

    // Champion promotion: a dominant lower-division champ (>90% win rate, ≥5 fights)
    // vacates the belt and moves up. The top two available contenders then fight for
    // the vacant title. Skipped if the player is already booked against this champ.
    const champFid = fromDiv.slots[CHAMP_SLOT];
    const champF   = champFid ? gf(champFid) : null;
    const playerFacingChamp = cs.phase === fromPhase
      && state.currentOpponent?.divisionSlot === CHAMP_SLOT;

    if (
      !exchangeDone && champF && !champF.isPlayer && !playerFacingChamp &&
      (champF.wins + champF.losses) >= 5 &&
      champF.wins / (champF.wins + champF.losses) > 0.90
    ) {
      const landingCandidates = [];
      for (let j = 3; j <= 6; j++) {
        if (toDiv.slots[j] && toDiv.slots[j] !== 'player') landingCandidates.push(j);
      }
      if (landingCandidates.length) {
        const landSlot   = landingCandidates[Math.floor(Math.random() * landingCandidates.length)];
        const displaced  = toDiv.slots[landSlot];
        const displacedF = displaced ? gf(displaced) : null;

        champF.prevSlot = null; champF.questionId = null; champF.isRising = false; champF.isNew = true; champF.divChangeCooldown = 3;
        if (displacedF) { displacedF.prevSlot = null; displacedF.questionId = null; displacedF.isNew = true; displacedF.divChangeCooldown = 3; }
        toDiv.slots[landSlot] = champFid;
        if (newsLog && (fromPhase === cs.phase || toPhase === cs.phase)) {
          newsLog.push({ priority: 1, type: 'championship', text: `${lastName(champF.name)} moves up to ${PHASES[toPhase].promo}` });
        }

        // Find top 2 available contenders for the vacant title fight
        const contenders = [];
        for (let c = CHAMP_SLOT - 1; c >= RANKED_START && contenders.length < 2; c--) {
          const cfid = fromDiv.slots[c];
          if (!cfid || cfid === 'player') continue;
          if (state.currentOpponent?.fid === cfid) continue;
          contenders.push({ fid: cfid, slot: c });
        }

        if (contenders.length >= 2) {
          const [a, b] = contenders; // a is higher-ranked
          const aF = gf(a.fid), bF = gf(b.fid);
          const rateA = (aF.wins + aF.losses) > 0 ? aF.wins / (aF.wins + aF.losses) : 0.5;
          const rateB = (bF.wins + bF.losses) > 0 ? bF.wins / (bF.wins + bF.losses) : 0.5;
          const aWins = Math.random() < rateA / (rateA + rateB);
          const winner = aWins ? a : b;
          const loser  = aWins ? b : a;

          recWin(winner.fid); recLoss(loser.fid);

          // Winner becomes champion; shift slots below winner.slot up to close the gap,
          // with the displaced fighter from the next division filling the bottom slot.
          fromDiv.slots[CHAMP_SLOT] = winner.fid;
          for (let s = winner.slot; s > 1; s--) fromDiv.slots[s] = fromDiv.slots[s - 1];
          fromDiv.slots[1] = displaced || null;
          if (fromDiv.playerSlot > 0 && fromDiv.playerSlot < winner.slot) fromDiv.playerSlot++;

          // Drop loser 1–2 slots from their post-shift position
          const loserIdx = fromDiv.slots.indexOf(loser.fid);
          if (loserIdx > 1) {
            const dropSteps = Math.random() < 0.4 ? 2 : 1;
            let lp = loserIdx;
            for (let d = 0; d < dropSteps; d++) {
              const next = lp - 1;
              if (next < 1 || fromDiv.slots[next] === 'player') break;
              swapSlots(fromDiv, lp, next);
              lp--;
            }
          }

          const newChampF = gf(winner.fid);
          if (newChampF) newChampF.isNew = true;
          if (newsLog && fromPhase === cs.phase) {
            const loserF = gf(loser.fid);
            newsLog.push({ priority: 1, type: 'championship', text: `${lastName(newChampF?.name)} wins vacant title vs ${lastName(loserF?.name)}` });
          }

        } else if (contenders.length === 1) {
          // Only one available contender — they claim the vacant title uncontested
          const [a] = contenders;
          recWin(a.fid);
          fromDiv.slots[CHAMP_SLOT] = a.fid;
          for (let s = a.slot; s > 1; s--) fromDiv.slots[s] = fromDiv.slots[s - 1];
          fromDiv.slots[1] = displaced || null;
          if (fromDiv.playerSlot > 0 && fromDiv.playerSlot < a.slot) fromDiv.playerSlot++;
          const winF = gf(a.fid);
          if (winF) winF.isNew = true;
          if (newsLog && fromPhase === cs.phase) {
            newsLog.push({ priority: 1, type: 'championship', text: `${lastName(winF?.name)} claims vacant title` });
          }
        } else {
          // No contenders available — displaced fighter fills the vacant slot for now
          fromDiv.slots[CHAMP_SLOT] = displaced || null;
        }

        exchangeDone = true;
      }
    }

    // Regular promotion: top-4 contenders (slots 16–19) have a 20% chance each cycle
    for (let i = 16; i < CHAMP_SLOT && !exchangeDone; i++) {
      const efid = fromDiv.slots[i];
      if (!efid || efid === 'player') continue;
      if (state.currentOpponent && state.currentOpponent.fid === efid) continue;
      if (Math.random() >= 0.20) continue;

      const uc = [];
      for (let j = 1; j <= 4; j++) {
        if (toDiv.slots[j] && toDiv.slots[j] !== 'player') uc.push(j);
      }
      if (!uc.length) continue;

      const fromSlot = i;
      const toSlot   = uc[Math.floor(Math.random() * uc.length)];
      const promFid  = efid;
      const demFid   = toDiv.slots[toSlot];
      const promF    = gf(promFid);
      const demF     = gf(demFid);
      if (promF) { promF.prevSlot = null; promF.questionId = null; promF.isRising = false; promF.isNew = true; promF.divChangeCooldown = 3; }
      if (demF)  { demF.prevSlot  = null; demF.questionId  = null; demF.isNew = true; demF.divChangeCooldown = 3; }

      toDiv.slots[toSlot] = promFid;
      for (let s = fromSlot; s > 1; s--) fromDiv.slots[s] = fromDiv.slots[s - 1];
      fromDiv.slots[1] = demFid;
      if (fromDiv.playerSlot > 0 && fromDiv.playerSlot < fromSlot) fromDiv.playerSlot++;
      if (newsLog && (fromPhase === cs.phase || toPhase === cs.phase)) {
        const pF  = gf(promFid);
        const rank = fromSlot >= RANKED_START ? `#${CHAMP_SLOT - fromSlot} ` : '';
        newsLog.push({ priority: 5, type: 'fight', text: `${rank}${lastName(pF?.name)} called up to ${PHASES[toPhase].promo}` });
      }

      exchangeDone = true;
    }
  }
}

/* ── Phase B: NPC round (called when Next Fight is clicked) ── */
export function advanceDivision(state, cs) {
  if (!cs) return;
  syncDivisionAlias(state, cs);
  if (!cs.division) return;

  const allDivs = cs.divisions || { [cs.phase]: cs.division };
  const newsLog = [];

  for (const [ph, div] of Object.entries(allDivs)) {
    migrateDivSlots(div);
    div.slots.forEach((fid, i) => {
      if (!fid || fid === 'player') return;
      const f = gf(fid);
      if (f) { f.prevSlot = i; f.isNew = false; }
    });
    simulateNPCBouts(state, div, parseInt(ph) === cs.phase ? newsLog : null);
  }

  interDivisionExchanges(state, cs, newsLog);

  for (const [ph, div] of Object.entries(allDivs)) {
    maybeRefreshBottomSlots(state, div, parseInt(ph), parseInt(ph) === cs.phase ? newsLog : null);
  }

  newsLog.sort((a, b) => a.priority - b.priority);
  cs.divisionNews = newsLog.slice(0, 5);

  // Tick down division-change cooldowns so protection lasts exactly 3 rounds
  for (const [, div] of Object.entries(allDivs)) {
    for (const fid of div.slots) {
      if (!fid || fid === 'player') continue;
      const f = gf(fid);
      if (f && f.divChangeCooldown > 0) f.divChangeCooldown--;
    }
  }
}

/* ── Bottom slot refresh ─────────────────────────────── */
export function maybeRefreshBottomSlots(state, div, phase, newsLog = null) {
  if (!div || !div.slots) return;
  migrateDivSlots(div);
  const { slots, playerSlot } = div;

  for (let i = 1; i <= 3; i++) {
    if (i === playerSlot) continue;
    const fid = slots[i];
    if (!fid || fid === 'player') continue;
    if (state.currentOpponent && state.currentOpponent.fid === fid) continue;
    const f = gf(fid);
    if (!f) continue;

    const total    = (f.wins || 0) + (f.losses || 0);
    const lossRate = total > 0 ? (f.losses || 0) / total : 0;
    if (total > 0 && (f.wins || 0) / total > 0.75) continue; // >75% win rate — cannot be cut
    if (f.divChangeCooldown > 0) continue; // recently changed division — protected for 3 rounds
    const ls       = f.lossStreak || 0;
    // Loss streak lowers the lossRate threshold and raises cut chance (caps at 0.70)
    const lossRateThreshold = Math.max(0.50, 0.70 - ls * 0.05);
    const cutChance         = Math.min(0.70, 0.25 + ls * 0.10);
    if (total < 8 || lossRate < lossRateThreshold || Math.random() >= cutChance) continue;

    // Cut this fighter
    f.maxPhase = phase;
    if (!state.career.cutPool) state.career.cutPool = [];
    state.career.cutPool.push(fid);
    while (state.career.cutPool.length > 20) {
      state.career.cutPool.splice(Math.floor(Math.random() * state.career.cutPool.length), 1);
    }

    // Names currently visible in the rankings — keep new fighters unique against them.
    const usedNames = activeNameSet(state.career.divisions, state.career.fighterName);

    let newFid = null;
    const eligible = state.career.cutPool.filter(cf => {
      if (cf === fid) return false;
      const ff = gf(cf);
      return ff && (ff.maxPhase || 1) >= phase && !usedNames.has(ff.name);
    });
    if (eligible.length && Math.random() < 0.40) {
      const drawn = eligible[Math.floor(Math.random() * eligible.length)];
      state.career.cutPool.splice(state.career.cutPool.indexOf(drawn), 1);
      const df = gf(drawn);
      if (df) { df.isNew = true; df.prevSlot = null; df.questionId = null; }
      newFid = drawn;
    }
    if (!newFid) {
      let name, tries = 0;
      do {
        const fn   = rng(FIRST_NAMES);
        const ln   = rng(LAST_NAMES);
        const nick = Math.random() > 0.55 ? rng(NICKNAMES) : null;
        name = nick ? `${fn} "${nick}" ${ln}` : `${fn} ${ln}`;
        tries++;
      } while (usedNames.has(name) && tries < 60);
      const isRising = Math.random() < 0.35;
      let w, l;
      if (isRising) { w = randInt(4, 8); l = Math.random() < 0.2 ? 1 : 0; }
      else {
        const roll = Math.random();
        if (roll < 0.20)      { w = 0; l = randInt(1, 4); }
        else if (roll < 0.55) { w = randInt(1, 3); l = randInt(3, 7); }
        else                  { w = randInt(1, 4); l = randInt(2, 5); }
      }
      const nf = {
        fid: makeFid(), name,
        wins: w, losses: l, draws: 0,
        record: buildRec(w, l, 0),
        style: rng(ALL_PROFILE_STYLES),
        signatureMoves: makeSignatureMoves(),
        rosterId: null, isPlayer: false, isRising,
        questionId: null, isNew: true, prevSlot: null, maxPhase: phase,
        npcDurability: Math.max(20, Math.round(100 - (w + l) * 0.5)),
      };
      FIGHTERS.set(nf.fid, nf);
      newFid = nf.fid;
    }
    if (newsLog) {
      const nf = gf(newFid);
      if (nf?.isRising) {
        newsLog.push({ priority: 3, type: 'prospect', text: `${lastName(nf.name)} enters — rising prospect` });
      }
    }
    slots[i] = newFid;
  }
}

/* ── Career phase update (streaks, belt, events) ─────── */
// `slotBefore` MUST be the player's division slot from BEFORE updateDivisionAfterResult()
// moved them this fight. It is passed in from resolveResult(); falling back to the
// current slot here would make slotBefore === slotAfter and silently disable every
// title transition (won belt / defense / belt lost).
export function updateCareerPhase(state, cs, resultType, slotBefore) {
  const phase = cs.phase;
  // getPhaseDef applies the per-career phase-2 org override (e.g. Kings FC vs Apex).
  // Using PHASES[phase] directly would hardcode "Apex Combat" / "Apex Champion"
  // into belt names, promotion offers, and cut text regardless of the chosen org.
  const pDef  = getPhaseDef(cs);
  const won   = resultType === 'win';
  const lost  = ['loss', 'split_loss', 'finish', 'late_finish', 'timeout_finish', 'embarrassing_dec', 'timeout'].includes(resultType);
  if (slotBefore == null) slotBefore = getPlayerSlot(cs);

  if (won)  { cs.phaseWins++;   cs.phaseStreak = Math.max(0, cs.phaseStreak) + 1; }
  if (resultType === 'draw') { cs.phaseStreak = 0; }
  if (lost) { cs.phaseLosses++; cs.phaseStreak = Math.min(0, cs.phaseStreak) - 1; }

  const slotAfter = getPlayerSlot(cs);
  let event = null;

  // ── Belt won / defense / lost (tracked per organisation) ──
  const t       = ensureTitles(cs)[phase];
  const orgBelt = pDef.rankLabels[11] || 'Champion';

  if (resultType === 'draw' && t.held && slotBefore === CHAMP_SLOT) {
    t.defenseStreak++;
    t.bestDefenseStreak = Math.max(t.bestDefenseStreak, t.defenseStreak);
    if (phase === 3) cs.titleDefenses = (cs.titleDefenses || 0) + 1;
    cs.champCalloutClout = (cs.champCalloutClout || 0) + 1;
    event = { type: phase < 3 ? 'ev-interim' : 'ev-title',
      label: `${pDef.promo} — Draw Defense #${t.defenseStreak}`,
      text: `A draw — you keep the ${orgBelt} title. Defense #${t.defenseStreak} on record.` };
  } else if (won && slotAfter === CHAMP_SLOT && t.held && slotBefore === CHAMP_SLOT) {
    t.defenseStreak++;
    t.bestDefenseStreak = Math.max(t.bestDefenseStreak, t.defenseStreak);
    if (phase === 3) cs.titleDefenses = (cs.titleDefenses || 0) + 1;
    cs.champCalloutClout = (cs.champCalloutClout || 0) + 1;
    const defNum = t.defenseStreak;
    event = { type: phase < 3 ? 'ev-interim' : 'ev-title',
      label: `${pDef.promo} — Defense #${defNum}`,
      text: `${defNum === 1 ? 'First defense.' : defNum >= 5 ? 'Dominant reign.' : `Defense #${defNum}.`} The ${pDef.promo} division still has no answer for you.` };
  } else if (won && slotAfter === CHAMP_SLOT && slotBefore < CHAMP_SLOT && !t.held) {
    t.held   = true;
    t.reigns++;
    t.defenseStreak = 0;
    cs.titleName = orgBelt;
    if (phase === 3) {
      const _fn = (state.fightIndex ?? 0) + 1;
      if ((cs.fightNumberOfFirstTitle ?? -1) === -1) cs.fightNumberOfFirstTitle = _fn;
      cs._lastTitleWonAtFight = _fn;
    }
    const nTime = t.reigns > 1 ? `${t.reigns}-Time ` : '';
    event = phase < 3
      ? { type: 'ev-interim', label: `${nTime}${pDef.promo} Champion!`, text: `You've claimed the ${orgBelt} title.` }
      : { type: 'ev-title',   label: `${nTime}World Champion!`,         text: `You've done it. The ${orgBelt} title is yours.` };
  }

  // ── Belt lost ──
  if (lost && slotBefore === CHAMP_SLOT && slotAfter < CHAMP_SLOT && t.held) {
    if (phase === 3) {
      const _fn   = (state.fightIndex ?? 0) + 1;
      const _prev = cs._lastTitleWonAtFight ?? -1;
      if (_prev !== -1 && _fn === _prev + 1) cs.lostTitleInNextFight = true;
    }
    const _defStr = t.defenseStreak === 0 ? 'no defenses' : `${t.defenseStreak} defense${t.defenseStreak > 1 ? 's' : ''}`;
    t.held          = false;
    t.defenseStreak = 0;
    event = { type: 'ev-cut', label: `${pDef.promo} — Title Lost`,
      text: `The ${orgBelt} title is gone after ${_defStr}. Rebuild and earn it back.` };
  }

  // ── Sync legacy current-phase mirrors (UI + archive compatibility) ──
  cs.titleHeld     = t.held;
  cs.defenseStreak = t.defenseStreak;
  cs.champCount    = totalReigns(cs);
  if (t.held) cs.titleName = orgBelt;

  // ── Promotion offer ──
  // A defending champion must still get the offer. The defense banner set above
  // is only informational, so it must not suppress the (intended, high-chance)
  // promotion — we let the offer override it. We do NOT override the freshly-won
  // belt celebration (so the player sees they won it) or any choice event.
  const justWonBelt  = won && slotBefore < CHAMP_SLOT && slotAfter === CHAMP_SLOT;
  const promoBlocked = event && (event.choiceType || justWonBelt);
  if (!promoBlocked && !cs.advancementPending && won && phase < 3) {
    const slotNow = getPlayerSlot(cs);
    let promoPct  = 0;
    if (slotNow === CHAMP_SLOT)       promoPct = 0.80;
    else if (slotNow >= RANKED_START) promoPct = 0.05 + ((slotNow - RANKED_START) / (CHAMP_SLOT - RANKED_START)) * 0.50;
    if (isUndefeated(state)) {
      promoPct = Math.min(0.95, promoPct + 0.20);
    } else {
      const wStreak = Math.max(0, cs.phaseStreak);
      if (wStreak >= 2) promoPct = Math.min(0.90, promoPct + Math.min(0.20, wStreak * 0.04));
    }
    if (promoPct > 0 && Math.random() < promoPct
        && cs.phaseWins >= Math.ceil(pDef.advanceFights * 0.4)) {
      cs.advancementPending = true;
      const nextP     = PHASES[phase + 1];
      const nextPromo = (phase + 1 === 2 && cs.phase2Name) ? cs.phase2Name : nextP.promo;
      const undStr    = isUndefeated(state) ? ' Your undefeated record has made this unavoidable.' : '';
      event = { type: 'ev-contract', label: 'Contract Offer', choiceType: 'promotion',
        text: `${nextPromo} is watching. Stay here or sign with the next level up.${undStr}` };
    }
  }

  // ── Cut offer ──
  if (!event && !cs.cutPending && lost && phase >= 2) {
    const absStreak  = Math.abs(cs.phaseStreak);
    const hardCut    = absStreak >= pDef.cutStreak;
    const softCutPct = absStreak >= 2 ? Math.min(0.7, (absStreak / pDef.cutStreak) * 0.5) : 0;
    if (hardCut || Math.random() < softCutPct) {
      cs.cutPending = true;
      event = { type: 'ev-cut', label: hardCut ? 'Released' : 'Interest from Below',
        choiceType: 'cut',
        text: hardCut
          ? `You've been cut from ${pDef.promo}.`
          : `${getPhaseDef({ ...cs, phase: phase - 1 }).promo} has reached out. Take the step down or grind it out here.` };
    }
  }

  // ── Forced retirement at floor ──
  if (phase === 1 && cs.phaseStreak <= -5 && !cs.forceRetire) {
    cs.forceRetire = true;
    event = { type: 'ev-cut', label: 'Career Over',
      text: 'Five straight losses at the regional level. No one is booking you. The career is over.' };
  }

  // ── Milestone events ──
  // "Entered the rankings" — only fires when crossing from unranked into the ranked band
  if (!event && won && slotBefore < RANKED_START && slotAfter >= RANKED_START) {
    event = { type: 'ev-mainevent', label: 'Ranked',
      text: "You're in the rankings. The division knows your name." };
  }
  // "Title contention" — top 3 (slots 17+); text is accurate at that range
  if (!event && won && slotAfter >= CHAMP_SLOT - 3 && slotBefore < CHAMP_SLOT - 3) {
    event = { type: phase === 3 ? 'ev-title' : 'ev-interim', label: 'Title Contention',
      text: "You're in the top three. The belt is within reach." };
  }

  return event;
}

/* ── Durability → timer seconds ──────────────────────── */
export function durabilityToTimer(durability, baseTimer) {
  const MIN_TIMER = 5;
  const ratio = Math.max(0, Math.min(1, durability / 100));
  return MIN_TIMER + ratio * (baseTimer - MIN_TIMER);
}

/* ── Callout success probability ─────────────────────── */
export function calloutSuccessPct(playerSlot, targetSlot, penalty, defenseStreak = 0) {
  const pen = penalty || 0;

  if (playerSlot === CHAMP_SLOT) {
    // As champion, calling down: the further below #1, the less likely.
    // More defenses = more clout = higher base chance across the board.
    const diff = CHAMP_SLOT - targetSlot; // 1 = #1 contender, higher = further below
    const defBonus = Math.min(0.20, defenseStreak * 0.05);
    let base;
    if (diff <= 1)       base = 0.80 + defBonus;  // #1 contender — natural fight
    else if (diff <= 3)  base = 0.55 + defBonus;  // fringe contender
    else if (diff <= 6)  base = 0.25 + defBonus;  // outside title picture
    else if (diff <= 10) base = 0.10 + defBonus;  // well outside
    else                 base = 0.05;              // far too low
    return Math.max(0.05, Math.min(0.95, base) * Math.pow(0.80, pen));
  }

  // Non-champion: calling up is harder, calling down is easy
  const diff = targetSlot - playerSlot;
  let base;
  if (diff <= 0)       base = Math.min(0.95, 0.90 - diff * 0.02);
  else if (diff <= 2)  base = 0.75;
  else if (diff <= 5)  base = 0.55;
  else if (diff <= 10) base = 0.30;
  else                 base = 0.15;
  return Math.max(0.05, base * Math.pow(0.80, pen));
}

/* ── initState — build a fresh career ───────────────── */
export function initState(state, activeModId) {
  resetFighters();
  state._qPool  = null;
  state._qUsed  = null;
  state._qById  = null;
  state.activeModId = activeModId;

  const career = {
    fighterName:        generateFighterName(), // overwritten by NamingScreen
    phase:              1,
    phaseWins:          0,
    phaseLosses:        0,
    phaseStreak:        0,
    lowestPhase:        1,
    highestPhase:       1,       // highest org reached (for "highest organisation reached")
    titleHeld:          false,   // legacy mirror of titles[phase].held
    titleName:          null,
    champCount:         0,        // legacy mirror: total reigns across all orgs
    defenseStreak:      0,        // legacy mirror of titles[phase].defenseStreak
    champCalloutClout: 0,        // accumulated callout power as champion; resets on low-ranked callout
    ...((() => { const p2 = PHASE2_OPTIONS[Math.floor(Math.random() * PHASE2_OPTIONS.length)]; return { phase2Name: p2.promo, phase2Belt: p2.belt }; })()),
    gflEventNum:       randInt(1, 300), // GFL event counter, advances every fight
    titles:             { 1: blankTitle(), 2: blankTitle(), 3: blankTitle() },
    calloutRecord:      {},
    forceRetire:        false,
    advancementPending: false,
    cutPending:         false,
    durability:         100,
    pendingEvent:       null,
    division:           null,
    divisions:          {},
    cutPool:            [],
    freshDivision:      false,
    divisionNews:       [],
    newsFolded:         false,
    // Set by +page.svelte after initState — defaults here as fallback
    activeLength:       0,       // 0 = until retirement
    difficulty:         'medium',

    // ── Legacy / end-screen tracking ─────────────────────
    peakWinPct:              0,   // highest win% recorded mid-career
    longestLosingStreak:     0,   // longest consecutive loss run
    _currentLosingStreak:    0,   // internal counter — not displayed
    titleDefenses:           0,   // cumulative world-title (phase-3) defenses
    fightNumberOfFirstTitle: -1,  // fight# when first world title won (-1 = never)
    lostTitleInNextFight:    false, // lost phase-3 belt in the fight right after winning it
    _lastTitleWonAtFight:    -1,  // internal — fight# of most recent phase-3 title win
    retireType:              null, // set at career end: voluntary|force|durability|natural
  };

  career.divisions = {
    1: buildDivision(PHASES[1], career.fighterName),
    2: buildDivision(PHASES[2], '—'),
    3: buildDivision(PHASES[3], '—'),
  };
  career.division = career.divisions[1];

  // Assign questions after pool is initialised
  state.career = career;
  ensureQPool(state);
  assignDivisionQuestions(state, career.division, 1);

  // Reset all fight stats
  state.wins = 0; state.losses = 0; state.draws = 0; state.finishes = 0;
  state.results      = [];
  state.boutHistory  = [];
  state.currentStreak      = 0; state.bestStreak    = 0;
  state.finishStreak       = 0;
  state.unbeatenStreak     = 0; state.bestUnbeatenStreak = 0;
  state.winsByKO = 0; state.winsByTKO = 0; state.winsBySub = 0; state.winsByDec = 0;
  state.lossByKO = 0; state.lossByTKO = 0; state.lossBySub = 0; state.lossByDec = 0;
  state.methodWeights        = { KO: 1, TKO: 1, Submission: 1 };
  state.specificMethodCounts = {};
  state._qScores   = {};
  state.lastQid    = null;
  state.fightIndex = 0;
  state.sparring   = false;
  state.winsVsFighter   = {};
  state.h2h             = {};
  state.calloutUsed     = false;
  state._calloutOpponent = null;
  state.retiredVoluntarily = false;
  state.retiredDurability  = false;
  state.retiredForcefully  = false;

  // Set initial opponent: slot 1 (one above player)
  const initDiv  = career.division;
  const initFid  = initDiv && initDiv.slots[1];
  state.currentOpponent = (initFid && initFid !== 'player')
    ? divisionSlotToOpponent(initFid, 1, career)
    : null;

  state.screen = 'naming';
}

/* ── initSparringState ───────────────────────────────── */
export function initSparringState(state, activeModId) {
  state.activeModId = activeModId;
  const pool = buildSparringPool(state);

  state.sparring       = true;
  state.sparringPool   = pool;
  state.sparringPtr    = 0;
  state.fightIndex     = 0;
  state.wins = 0; state.losses = 0; state.draws = 0; state.finishes = 0;
  state.results      = [];
  state.boutHistory  = [];
  state.currentStreak      = 0; state.bestStreak    = 0;
  state.finishStreak       = 0;
  state.unbeatenStreak     = 0; state.bestUnbeatenStreak = 0;
  state.winsByKO = 0; state.winsByTKO = 0; state.winsBySub = 0; state.winsByDec = 0;
  state.lossByKO = 0; state.lossByTKO = 0; state.lossBySub = 0; state.lossByDec = 0;
  state.methodWeights        = { KO: 1, TKO: 1, Submission: 1 };
  state.specificMethodCounts = {};
  state._qScores = {};
  state.career   = null;
  state.currentOpponent = null;
  state.screen = 'prefight';
}

/* ── Sparring question accessor ──────────────────────── */
export function sparringCurrentQuestion(state) {
  if (state.sparringPtr >= state.sparringPool.length) {
    state.sparringPool = shuffle([...state.sparringPool]);
    state.sparringPtr  = 0;
  }
  return state.sparringPool[state.sparringPtr];
}

/* ═══════════════════════════════════════════════════════════
 * LEGACY / FINAL-SCREEN SYSTEM
 * ═══════════════════════════════════════════════════════════
 *
 *  buildLegacyStats(state)  — derive the full career object from live state
 *  calcLegacyTitle(career)  — main legacy label (e.g. "Hall of Famer")
 *  calcEndTitle(career)     — headline (e.g. "Hung Up The Gloves")
 *  calcAchievementBadges(career, legacyTitle) → string[]
 */

// Badge names whose CSS renders as muted/humorous rather than gold/positive.
// Exported so EndScreen.svelte never has to hardcode these strings separately.
export const HUMOROUS_BADGE_NAMES = new Set([
  'Bathroom Break', 'Glass Cannon', 'One-Hit Wonder', 'Revolving Door',
]);

// Shared retire-type resolver — single source of truth used by both
// buildLegacyStats() (for display) and onCareerEnd() (for archiving).
const RETIRE_TYPES = ['voluntary', 'force', 'durability', 'natural'];
export function deriveRetireType(cs, state) {
  if (RETIRE_TYPES.includes(cs?.retireType)) return cs.retireType;
  if (state?.retiredVoluntarily)                    return 'voluntary';
  if (state?.retiredDurability)                     return 'durability';
  if (state?.retiredForcefully || cs?.forceRetire)  return 'force';
  return 'natural';
}

/* ── Build the derived career object ─────────────────── */
/**
 * Merges live state stats with the career object so that the three
 * display functions always receive accurate, normalised data.
 * Called from EndScreen.svelte and from onCareerEnd() in +page.svelte.
 */
export function buildLegacyStats(state) {
  const cs     = state.career || {};
  const bh     = state.boutHistory || [];
  const titles = cs.titles || {};

  const fights     = state.fightIndex ?? 0;
  const wins       = state.wins       ?? 0;
  const losses     = (state.losses ?? 0) + (state.finishes ?? 0);

  const koWins     = state.winsByKO  ?? 0;
  const tkoWins    = state.winsByTKO ?? 0;
  const subWins    = state.winsBySub ?? 0;
  const finishRate = wins > 0 ? (koWins + tkoWins + subWins) / wins : 0;

  // Derived from bout history (playerSlot added to entries in combat.js)
  const timesFinished = bh.filter(b => {
    if (b.rc === 'win' || b.rc === 'draw') return false;
    const m = b.method || '';
    return KO_METHODS.includes(m) || TKO_METHODS.includes(m) || SUB_METHODS.includes(m);
  }).length;

  const knockoutsReceived = bh.filter(b => {
    if (b.rc === 'win' || b.rc === 'draw') return false;
    return KO_METHODS.includes(b.method || '');
  }).length;

  const finishedRate        = losses > 0 ? timesFinished / losses : 0;
  const reachedTitleFight   = bh.some(b => b.titleFight && b.phase === 3);
  const beatRankedContender = bh.some(b =>
    b.rc === 'win' && (b.oppRankSlot ?? -1) >= RANKED_START
  );
  const wasRanked = bh.some(b =>
    typeof b.playerSlot === 'number' && b.playerSlot >= RANKED_START
  );
  const upsetWins = bh.filter(b =>
    b.rc === 'win' &&
    typeof b.playerSlot === 'number' &&
    typeof b.oppRankSlot === 'number' &&
    (b.oppRankSlot - b.playerSlot) >= 4
  ).length;

  const heldWorldTitle    = (titles[3]?.reigns || 0) > 0;
  const heldRegionalTitle = ((titles[1]?.reigns || 0) + (titles[2]?.reigns || 0)) > 0;
  const heldTitleAtRetire = [1, 2, 3].some(ph => titles[ph]?.held);
  const titleReigns       = titles[3]?.reigns || 0;
  // Count orgs (phases) where any title was held — enables Multi-Division Champion
  // to fire when a fighter won titles at two different levels (e.g. regional + world).
  const worldTitleDivisions = [1, 2, 3].filter(ph => (titles[ph]?.reigns || 0) > 0).length;

  const retireType = deriveRetireType(cs, state);

  return {
    ...cs,
    fights,
    wins,
    losses,
    draws: state.draws ?? 0,
    finishRate,
    finishedRate,
    timesFinished,
    knockoutsReceived,
    upsetWins,
    wasRanked,
    beatRankedContender,
    reachedTitleFight,
    heldWorldTitle,
    heldRegionalTitle,
    heldTitleAtRetire,
    titleReigns,
    worldTitleDivisions,
    longestWinStreak:        Math.max(cs.longestWinStreak        ?? 0, state.bestStreak ?? 0),
    peakWinPct:              cs.peakWinPct              ?? 0,
    longestLosingStreak:     cs.longestLosingStreak     ?? 0,
    titleDefenses:           cs.titleDefenses           ?? 0,
    fightNumberOfFirstTitle: cs.fightNumberOfFirstTitle ?? -1,
    lostTitleInNextFight:    cs.lostTitleInNextFight    ?? false,
    retireType,
  };
}

/* ── Section 2: safe derived values ─────────────────── */
function _legacyDerived(career) {
  const cs = career || {};
  const f  = cs.fights  ?? 0;
  const w  = cs.wins    ?? 0;
  const l  = cs.losses  ?? 0;

  const winPct       = f > 0 ? w / f : 0;
  const finishRate   = w > 0 ? (cs.finishRate   ?? 0) : 0;
  const finishedRate = l > 0 ? (cs.finishedRate ?? 0) : 0;
  const peakWinPct   = cs.peakWinPct ?? winPct;

  const retireType = RETIRE_TYPES.includes(cs.retireType) ? cs.retireType : 'natural';

  return {
    f, w, l, winPct, finishRate, finishedRate, peakWinPct, retireType,
    heldWorldTitle:       cs.heldWorldTitle       ?? false,
    heldRegionalTitle:    cs.heldRegionalTitle     ?? false,
    heldTitleAtRetire:    cs.heldTitleAtRetire     ?? false,
    reachedTitleFight:    cs.reachedTitleFight     ?? false,
    beatRankedContender:  cs.beatRankedContender   ?? false,
    wasRanked:            cs.wasRanked             ?? false,
    lostTitleInNextFight: cs.lostTitleInNextFight  ?? false,
    titleDefenses:           cs.titleDefenses           ?? 0,
    titleReigns:             cs.titleReigns             ?? 0,
    fightNumberOfFirstTitle: cs.fightNumberOfFirstTitle ?? -1,
    knockoutsReceived:       cs.knockoutsReceived       ?? 0,
    timesFinished:           cs.timesFinished           ?? 0,
    upsetWins:               cs.upsetWins               ?? 0,
    longestWinStreak:        cs.longestWinStreak        ?? 0,
    longestLosingStreak:     cs.longestLosingStreak     ?? 0,
    worldTitleDivisions:     cs.worldTitleDivisions     ?? 0,
  };
}

/* ── Section 3: calcLegacyTitle(career) ─────────────── */
export function calcLegacyTitle(career) {
  const d = _legacyDerived(career);
  const {
    f, w, l, winPct, finishRate, peakWinPct, retireType,
    heldWorldTitle, heldRegionalTitle, heldTitleAtRetire,
    reachedTitleFight, beatRankedContender, wasRanked, lostTitleInNextFight,
    titleDefenses, titleReigns, fightNumberOfFirstTitle,
    upsetWins, longestWinStreak, longestLosingStreak, worldTitleDivisions,
  } = d;

  // BLOCK 0 — NEVER FOUGHT
  if (f === 0) return 'Never Fought';

  // BLOCK A — EARLY / SHORT CAREER
  if (f === 1 && l === 1)                                                         return 'One And Done';
  if (f === 1 && w === 1)                                                         return 'Won One, Gone';
  if (retireType === 'force' && f < 6 && winPct < 0.25)                           return 'Wrong Sport';
  if (f < 5 && !heldWorldTitle && !heldRegionalTitle && !beatRankedContender)     return 'Footnote';
  if (l === 0 && f >= 8 && heldWorldTitle && retireType === 'voluntary')          return 'Untouchable';
  if (l === 0 && f >= 5 && !heldWorldTitle && retireType === 'voluntary')         return 'The Biggest What If';
  if (l === 0 && f >= 5 && retireType !== 'voluntary')                            return 'Undefeated';
  if (f < 10 && l <= 1 && heldWorldTitle)                                         return 'Shooting Star';
  if (f < 8 && winPct >= 0.70 && retireType === 'voluntary'
      && !heldWorldTitle && !reachedTitleFight)                                    return 'Flash In The Pan';
  if (retireType === 'force' && f < 15 && peakWinPct >= 0.65)                    return 'Wasted Potential';
  if (f >= 5 && f < 10 && winPct >= 0.60 && retireType === 'voluntary'
      && !heldWorldTitle && !reachedTitleFight)                                    return 'Promising Start';
  if (f < 10 && winPct >= 0.50 && retireType !== 'voluntary')                    return 'Cut Short';
  if (f < 10)                                                                      return 'Brief Career';

  // BLOCK B — SPECIAL ACHIEVEMENT
  if (retireType !== 'force' && l < 3 && winPct >= 0.95
      && titleDefenses >= 10 && heldWorldTitle)                                    return 'G.O.A.T.';

  // BLOCK C — PRIMARY LEGACY
  if (heldWorldTitle && titleDefenses >= 5 && f >= 20 && winPct >= 0.65)          return 'Hall of Famer';
  if (heldWorldTitle && f >= 15)                                                   return 'World Champion';
  if (heldWorldTitle && f < 15)                                                    return 'Short-Reigned Champion';
  if (heldTitleAtRetire && retireType === 'voluntary' && l <= 2)                    return 'Retired Champion';
  if (!heldWorldTitle && (reachedTitleFight || (winPct >= 0.60 && f >= 20)))      return 'Contender';
  if (!heldWorldTitle && wasRanked && winPct >= 0.55 && f >= 15)                  return 'Fringe Contender';
  if (heldRegionalTitle && winPct >= 0.55 && f >= 10)                             return 'Regional Champion';

  // BLOCK D — JOURNEYMAN TIER
  if (f >= 25 && winPct >= 0.40 && winPct < 0.55
      && !heldWorldTitle && !heldRegionalTitle && beatRankedContender)             return 'Gatekeeper';
  if (heldRegionalTitle && titleDefenses < 2 && winPct < 0.45)                   return 'Regional Journeyman';
  if (f >= 15 && winPct >= 0.30 && winPct < 0.55
      && !heldWorldTitle && !heldRegionalTitle)                                    return 'Journeyman';
  if (f >= 10 && winPct >= 0.30 && winPct < 0.55
      && !heldWorldTitle && !heldRegionalTitle)                                    return 'Club Fighter';

  // BLOCK E — LOWER TIER
  if (winPct >= 0.25 && winPct < 0.40 && finishRate >= 0.80 && f >= 10)          return 'Cult Favourite';
  if (winPct >= 0.25 && winPct < 0.40 && finishRate < 0.50  && f >= 20)          return 'Trial Horse';
  if (winPct >= 0.25 && winPct < 0.40 && f >= 10)                                return 'Durable Loser';
  if (winPct < 0.25 && f >= 10)                                                   return 'The Opponent';
  if (winPct < 0.25 && f >= 5)                                                    return 'Stepping Stone';

  return 'Cannon Fodder'; // absolute fallback — should be unreachable
}

/* ── Section 5: calcEndTitle(career) ────────────────── */
export function calcEndTitle(career) {
  const { f, l, winPct, retireType, heldWorldTitle } = _legacyDerived(career);

  if (f === 0) return 'The Career That Never Was';

  if (retireType === 'voluntary') {
    if (heldWorldTitle && f >= 30) return 'Hung Up The Gloves — A Legend Departs';
    if (heldWorldTitle && f >= 15) return 'Rode Off Into The Sunset';
    if (l === 0 && f >= 8)         return 'Left Them Wanting More';
    if (l === 0 && f >= 1)         return 'Walked Away Clean';
    if (f < 5)                     return 'Gone Before It Started';
    if (f < 10)                    return 'Gone Too Soon';
    if (winPct >= 0.60)            return 'Calling It A Career';
    return 'Hanging Up The Gloves';
  }

  if (retireType === 'durability') {
    if (heldWorldTitle) return 'The Body Finally Said No';
    if (f < 10)         return "Didn't Last Long";
    return 'Father Time Wins Again';
  }

  if (retireType === 'force') {
    if (heldWorldTitle) return 'The Canvas Claimed A Champion';
    if (f === 1)        return 'One And Out';
    if (f < 6)          return 'Over Before It Began';
    if (winPct >= 0.50) return 'Forced Out At The Top';
    return 'The Canvas Claimed Him';
  }

  // natural — hit the fight limit
  if (heldWorldTitle && f >= 40) return 'Every Last Drop — An Icon Signs Off';
  if (heldWorldTitle)            return "Every Last Drop — A Champion's Journey Ends";
  if (winPct >= 0.60)            return 'Every Last Drop';
  return 'Went The Distance';
}

/* ── Section 4: calcAchievementBadges(career, legacyTitle) ── */
export function calcAchievementBadges(career, legacyTitle) {
  const d = _legacyDerived(career);
  const {
    f, w, l, winPct, finishRate, finishedRate,
    heldWorldTitle, lostTitleInNextFight,
    titleDefenses, titleReigns, fightNumberOfFirstTitle,
    knockoutsReceived, upsetWins, longestWinStreak, longestLosingStreak,
    worldTitleDivisions,
  } = d;

  if (f === 0) return [];

  const badges = [];

  // ── Positive badges — rarest first ──────────────────
  if (worldTitleDivisions >= 2)
    badges.push('Multi-Division Champion');

  if (titleDefenses >= 7 && titleReigns === 1)
    badges.push('Dynasty');

  if (fightNumberOfFirstTitle >= 20 && heldWorldTitle)
    badges.push('Late Bloomer');

  if (longestWinStreak >= 10 && l > 0)
    badges.push('Undefeated Streak');

  if (longestLosingStreak >= 3 && heldWorldTitle && winPct >= 0.50)
    badges.push('Comeback Kid');

  if (upsetWins >= 5)
    badges.push("People's Champion");

  if (finishRate >= 0.80 && w >= 10 && legacyTitle !== 'Cult Favourite')
    badges.push('Fan Favourite');

  if (f >= 20 && knockoutsReceived === 0)
    badges.push('Iron Chin');

  // ── Negative / humorous badges ───────────────────────
  if (finishRate < 0.20 && f >= 20 && heldWorldTitle && legacyTitle !== 'G.O.A.T.')
    badges.push('Bathroom Break');

  if (finishRate >= 0.75 && finishedRate >= 0.50 && f >= 10)
    badges.push('Glass Cannon');

  if (heldWorldTitle && titleDefenses === 0 && lostTitleInNextFight === true)
    badges.push('One-Hit Wonder');

  if (titleReigns >= 3 && titleDefenses < 2)
    badges.push('Revolving Door');

  return badges;
}
