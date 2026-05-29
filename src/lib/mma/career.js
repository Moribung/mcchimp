/**
 * src/lib/mma/career.js
 * ─────────────────────────────────────────
 * Career engine — phase progression, division management, NPC simulation.
 * All functions accept state (and cs = state.career) as parameters.
 * No DOM. No Svelte. Pure logic.
 */

import {
  PHASES, CHAMP_SLOT, RANKED_START,
  DURABILITY_DAMAGE, FIRST_NAMES, LAST_NAMES, NICKNAMES, FIGHTER_ROSTER,
} from './constants.js';

import {
  FIGHTERS, makeFid, buildRec, resetFighters,
  gf, recWin, recLoss, recDraw,
  swapSlots, migrateDivSlots, buildDivision, divisionSlotToOpponent, activeNameSet,
} from './fighters.js';

import {
  ensureQPool, assignDivisionQuestions, tierForFight, buildSparringPool,
} from './questions.js';

import { rng, randInt, shuffle, generateFighterName } from './utils.js';

/* ── Phase helpers ───────────────────────────────────── */
export function getPhaseDef(cs)  { return PHASES[cs.phase] || PHASES[3]; }
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
export function updateDivisionAfterResult(state, cs, won, draw, extraChallengerDrop) {
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
      if (steps > 0) divisionMoveUp(cs.division, steps);
    }
  } else {
    const lossAbs     = Math.abs(cs.phaseStreak);
    const drop2chance = Math.min(0.6, lossAbs * 0.15);
    const steps       = Math.random() < drop2chance ? 2 : 1;
    divisionMoveDown(cs.division, steps);
  }
}

/* ── NPC simulation ──────────────────────────────────── */
export function simulateNPCBouts(state, div) {
  migrateDivSlots(div);
  const { slots, playerSlot } = div;
  const n = slots.length;
  const numBouts = randInt(5, 12);

  for (let b = 0; b < numBouts; b++) {
    const candidates = [];
    for (let i = 1; i < n - 1; i++) {
      if (i !== playerSlot) candidates.push(i);
    }
    if (candidates.length < 2) break;

    const aIdx  = candidates[Math.floor(Math.random() * candidates.length)];
    const bPool = candidates.filter(i => i !== aIdx && Math.abs(i - aIdx) <= 4);
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

    const probA  = rateA / (rateA + rateB);
    const aWins  = Math.random() < probA;
    const winFid = aWins ? fidA : fidB;
    const loseFid = aWins ? fidB : fidA;
    const winIdx  = aWins ? aIdx : bIdx;
    const loseIdx = aWins ? bIdx : aIdx;

    recWin(winFid); recLoss(loseFid);

    if (winIdx + 1 < n && winIdx + 1 !== playerSlot && winIdx + 1 < CHAMP_SLOT) {
      swapSlots(div, winIdx, winIdx + 1);
    }
    const dropSteps = Math.random() < 0.34 ? 2 : 1;
    let lp = loseIdx;
    for (let d = 0; d < dropSteps; d++) {
      if (lp - 1 < 1 || lp - 1 === playerSlot) break;
      swapSlots(div, lp, lp - 1);
      lp--;
    }
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
    }
  }
}

/* ── Inter-division exchanges ────────────────────────── */
export function interDivisionExchanges(state, cs) {
  if (!cs || !cs.divisions) return;

  for (let fromPhase = 1; fromPhase <= 2; fromPhase++) {
    const toPhase = fromPhase + 1;
    const fromDiv = cs.divisions[fromPhase];
    const toDiv   = cs.divisions[toPhase];
    if (!fromDiv || !toDiv) continue;

    let exchangeDone = false;
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
      if (promF) { promF.prevSlot = null; promF.questionId = null; promF.isRising = false; promF.isNew = true; }
      if (demF)  { demF.prevSlot  = null; demF.questionId  = null; demF.isNew = true; }

      toDiv.slots[toSlot] = promFid;
      for (let s = fromSlot; s > 1; s--) fromDiv.slots[s] = fromDiv.slots[s - 1];
      fromDiv.slots[1] = demFid;
      if (fromDiv.playerSlot > 0 && fromDiv.playerSlot < fromSlot) fromDiv.playerSlot++;

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

  for (const [, div] of Object.entries(allDivs)) {
    migrateDivSlots(div);
    div.slots.forEach((fid, i) => {
      if (!fid || fid === 'player') return;
      const f = gf(fid);
      if (f) { f.prevSlot = i; f.isNew = false; }
    });
    simulateNPCBouts(state, div);
  }

  interDivisionExchanges(state, cs);

  for (const [ph, div] of Object.entries(allDivs)) {
    maybeRefreshBottomSlots(state, div, parseInt(ph));
  }
}

/* ── Bottom slot refresh ─────────────────────────────── */
export function maybeRefreshBottomSlots(state, div, phase) {
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
    if (total < 8 || lossRate < 0.70 || Math.random() >= 0.25) continue;

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
      const isRising = Math.random() < 0.20;
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
        style: rng(FIGHTER_ROSTER.map(r => r.style)) || '',
        rosterId: null, isPlayer: false, isRising,
        questionId: null, isNew: true, prevSlot: null, maxPhase: phase,
      };
      FIGHTERS.set(nf.fid, nf);
      newFid = nf.fid;
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
  const pDef  = PHASES[phase];
  const won   = resultType === 'win';
  const lost  = resultType === 'loss' || resultType === 'finish' || resultType === 'timeout';
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
    event = { type: phase < 3 ? 'ev-interim' : 'ev-title',
      label: `${pDef.promo} — Draw Defense #${t.defenseStreak}`,
      text: `A draw — you keep the ${orgBelt} title. Defense #${t.defenseStreak} on record.` };
  } else if (won && slotAfter === CHAMP_SLOT && t.held && slotBefore === CHAMP_SLOT) {
    t.defenseStreak++;
    t.bestDefenseStreak = Math.max(t.bestDefenseStreak, t.defenseStreak);
    const defNum = t.defenseStreak;
    event = { type: phase < 3 ? 'ev-interim' : 'ev-title',
      label: `${pDef.promo} — Defense #${defNum}`,
      text: `${defNum === 1 ? 'First defense.' : defNum >= 5 ? 'Dominant reign.' : `Defense #${defNum}.`} The ${pDef.promo} division still has no answer for you.` };
  } else if (won && slotAfter === CHAMP_SLOT && slotBefore < CHAMP_SLOT && !t.held) {
    t.held   = true;
    t.reigns++;
    t.defenseStreak = 0;
    cs.titleName = orgBelt;
    const nTime = t.reigns > 1 ? `${t.reigns}-Time ` : '';
    event = phase < 3
      ? { type: 'ev-interim', label: `${nTime}${pDef.promo} Champion!`, text: `You've claimed the ${orgBelt} title.` }
      : { type: 'ev-title',   label: `${nTime}World Champion!`,         text: `You've done it. The ${orgBelt} title is yours.` };
  }

  // ── Belt lost ──
  if (lost && slotBefore === CHAMP_SLOT && slotAfter < CHAMP_SLOT && t.held) {
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
      const nextP  = PHASES[phase + 1];
      const undStr = isUndefeated(state) ? ' Your undefeated record has made this unavoidable.' : '';
      event = { type: 'ev-contract', label: 'Contract Offer', choiceType: 'promotion',
        text: `${nextP.promo} is watching. Stay here or sign with the next level up.${undStr}` };
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
          : `${PHASES[phase - 1].promo} has reached out. Take the step down or grind it out here.` };
    }
  }

  // ── Forced retirement at floor ──
  if (phase === 1 && cs.phaseStreak <= -5 && !cs.forceRetire) {
    cs.forceRetire = true;
    event = { type: 'ev-cut', label: 'Career Over',
      text: 'Five straight losses at the regional level. No one is booking you. The career is over.' };
  }

  // ── Milestone events ──
  if (!event && won && slotBefore === 0 && slotAfter >= 1) {
    event = { type: 'ev-mainevent', label: 'Ranked Contender',
      text: "You've entered the rankings. The division knows your name now." };
  }
  if (!event && won && slotAfter >= 9 && slotBefore < 9) {
    event = { type: phase === 3 ? 'ev-title' : 'ev-interim', label: 'Title Contention',
      text: 'One more win and the belt is on the line.' };
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
export function calloutSuccessPct(playerSlot, targetSlot, penalty) {
  const diff = targetSlot - playerSlot;
  let base;
  if (diff <= 0)      base = Math.min(0.95, 0.90 - diff * 0.02);
  else if (diff <= 2) base = 0.75;
  else if (diff <= 5) base = 0.55;
  else if (diff <= 10) base = 0.30;
  else                 base = 0.15;
  const pen = penalty || 0;
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
    // Set by +page.svelte after initState — defaults here as fallback
    activeLength:       0,       // 0 = until retirement
    difficulty:         'medium',
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

/* ── Legacy win rate for end screen ─────────────────── */
export function calcLegacyTitle(wins, total) {
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
  if (winPct >= 85) return 'Greatest of All Time';
  if (winPct >= 75) return 'Hall of Famer';
  if (winPct >= 60) return 'Contender';
  if (winPct >= 45) return 'Journeyman';
  if (winPct >= 25) return 'Cult Favourite';
  return 'The Opponent';
}
