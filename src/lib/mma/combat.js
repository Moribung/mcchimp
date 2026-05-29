/**
 * src/lib/mma/combat.js
 * ─────────────────────────────────────────
 * Fight resolution logic — pure functions, no DOM, no timer.
 * The actual setInterval lives in QuestionScreen.svelte.
 *
 * Exports:
 *  - prepareQuestion(state, cs)        → shuffled question view ready for display
 *  - scoreQuestion(q, selectedSet)     → { score, maxPts, ratio }
 *  - resolveResult(state, cs, q, selectedSet, pctUsed)  → resultClass + event
 *  - rollFightOutcome(state, resultClass, pctUsed, timedOut, score, maxPts) → outcome object
 */

import {
  CHAMP_SLOT, DURABILITY_DAMAGE,
  KO_METHODS, TKO_METHODS, SUB_METHODS,
} from './constants.js';

import {
  gf, recWin, recLoss, recDraw,
  divisionSlotToOpponent,
} from './fighters.js';

import {
  scoreQuestion, drawQuestionForSlot, qidOf, rotateQuestionForFighter,
} from './questions.js';

import {
  updateDivisionAfterResult, updateCareerPhase, advanceDivision,
  getPlayerSlot, streakSteps,
} from './career.js';

import { shuffle, randInt } from './utils.js';

/* ── Option shuffle ──────────────────────────────────── */
/**
 * Build a shuffled question view for display.
 * Remaps answer indices to match the new display order.
 * Returns a qView object with { options, answers, _displayOrder }.
 */
export function prepareQuestion(q) {
  const type = q.type || 'multi_select';

  // true_false may arrive without options (sparring pool skips normalisation).
  // Always give it ["True","False"] and never shuffle — answers [0]/[1] stay valid.
  if (type === 'true_false') {
    const options = (Array.isArray(q.options) && q.options.length) ? q.options : ['True', 'False'];
    return { ...q, options };
  }

  // typed / fill_gap have no options and string-based answers — shuffling/remapping
  // would turn their answers into [undefined]. Return them unchanged.
  if (type === 'typed' || type === 'fill_gap' || !Array.isArray(q.options) || q.options.length === 0) {
    return { ...q };
  }

  const optCount     = q.options.length;
  const displayOrder = shuffle([...Array(optCount).keys()]);

  // Map original index → display position
  const origToDisplay = new Array(optCount);
  displayOrder.forEach((origIdx, dispPos) => { origToDisplay[origIdx] = dispPos; });

  const remappedAnswers = new Set(q.answers.map(a => origToDisplay[a]));

  return {
    ...q,
    options:       displayOrder.map(i => q.options[i]),
    answers:       [...remappedAnswers],
    _displayOrder: displayOrder,
  };
}

/* ── Fight outcome generator ─────────────────────────── */
/**
 * Given a resultClass, time usage, and score, produce a full outcome object.
 * Returns { outcome, icon, desc, dmgKey, method, round }.
 */
export function rollFightOutcome(state, resultClass, pctUsed, timedOut, score, maxPts) {
  const opp      = (state.currentOpponent && state.currentOpponent.name) || 'your opponent';
  const oppShort = opp.split(' ')[0];

  const cs       = state.career;
  const pSlot    = cs && cs.division ? cs.division.playerSlot : -1;
  const oSlot    = state.currentOpponent ? state.currentOpponent.divisionSlot : -1;
  const isChampFight = (pSlot === CHAMP_SLOT || oSlot === CHAMP_SLOT);
  const maxRounds    = isChampFight ? 5 : 3;

  const mw  = state.methodWeights || { KO: 1, TKO: 1, Submission: 1 };
  const smc = state.specificMethodCounts || {};

  function weightedPool(pool) {
    const weights = pool.map(m => 1 + (smc[m] || 0) * 0.2);
    const total   = weights.reduce((a, x) => a + x, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function ret(obj, generalMethod, round) {
    if (generalMethod === 'KO')              obj.method = weightedPool(KO_METHODS);
    else if (generalMethod === 'TKO')        obj.method = weightedPool(TKO_METHODS);
    else if (generalMethod === 'Submission') obj.method = weightedPool(SUB_METHODS);
    else                                     obj.method = generalMethod || '';
    obj.round = round || null;
    return obj;
  }

  function weightedFinish() {
    const total = (mw.KO || 1) + (mw.TKO || 1) + (mw.Submission || 1);
    let roll = Math.random() * total;
    if ((roll -= (mw.KO || 1)) <= 0)  return 'KO';
    if ((roll -= (mw.TKO || 1)) <= 0) return 'TKO';
    return 'Submission';
  }

  function getRound() {
    if (pctUsed < 0.30) return 1;
    if (pctUsed < 0.70) return 2 + Math.floor(Math.random() * (maxRounds - 1));
    return maxRounds;
  }

  function ordinal(n) {
    return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th';
  }

  // Timed out
  if (resultClass === 'finish' && timedOut) {
    return ret({ outcome: 'KO — R1', icon: '⏱', dmgKey: 'timeout',
      desc: `The clock hit zero. ${oppShort} walked you down and finished you in the first.` }, 'KO', 1);
  }

  // Finish (ratio=0, wrong answers)
  if (resultClass === 'finish') {
    const rnd    = pctUsed < 0.30 ? 1 : (maxRounds === 5 ? randInt(1, 3) : randInt(1, 2));
    const rndStr = ordinal(rnd);
    const r = Math.random();
    if (r < 0.40) return ret({ outcome: `KO — R${rnd}`, icon: '💥', dmgKey: 'finish',
      desc: `${oppShort} caught you clean in the ${rndStr}. Lights out.` }, 'KO', rnd);
    if (r < 0.70) return ret({ outcome: `Sub — R${rnd}`, icon: '🔒', dmgKey: 'finish',
      desc: `Tapped out in the ${rndStr}. ${oppShort} was clinical on the ground.` }, 'Submission', rnd);
    if (r < 0.85) return ret({ outcome: `TKO — R${rnd}`, icon: '💀', dmgKey: 'finish',
      desc: `Ground and pound in the ${rndStr}. The ref had seen enough.` }, 'TKO', rnd);
    return ret({ outcome: `TKO — R${rnd}`, icon: '🛑', dmgKey: 'finish',
      desc: `Stopped in the ${rndStr} after taking too much damage.` }, 'TKO', rnd);
  }

  // Loss
  if (resultClass === 'loss') {
    if (pctUsed >= 0.70) {
      const split = pctUsed >= 0.95;
      if (split) return ret({ outcome: `Split Dec. Loss — R${maxRounds}`, icon: '📋', dmgKey: 'loss',
        desc: `Split decision. One judge had you — the other two disagreed.` }, 'Split Decision', maxRounds);
      return ret({ outcome: `Decision Loss — R${maxRounds}`, icon: '📋', dmgKey: 'loss',
        desc: `Lost on the cards over ${maxRounds} rounds. ${oppShort} did just enough.` }, 'Decision', maxRounds);
    }
    const rnd    = getRound();
    const rndStr = ordinal(rnd);
    const r = Math.random();
    if (r < 0.30) return ret({ outcome: `KO Loss — R${rnd}`, icon: '💢', dmgKey: 'loss',
      desc: `Caught with a big shot in the ${rndStr}. Down and out cold.` }, 'KO', rnd);
    if (r < 0.55) return ret({ outcome: `TKO Loss — R${rnd}`, icon: '🩹', dmgKey: 'loss',
      desc: `Stopped in the ${rndStr}. The ref stepped in after you took too much.` }, 'TKO', rnd);
    return ret({ outcome: `Sub Loss — R${rnd}`, icon: '🔗', dmgKey: 'loss',
      desc: `Caught in a submission in the ${rndStr}. ${oppShort} was the better grappler.` }, 'Submission', rnd);
  }

  // Draw
  if (resultClass === 'draw') {
    const split = pctUsed >= 0.95;
    if (split) return ret({ outcome: `Split Draw — R${maxRounds}`, icon: '📋', dmgKey: 'draw',
      desc: `One judge had ${oppShort}, one had you, one called it even.` }, 'Split Draw', maxRounds);
    return ret({ outcome: `Majority Draw — R${maxRounds}`, icon: '📋', dmgKey: 'draw',
      desc: `Too close to call.` }, 'Majority Draw', maxRounds);
  }

  // Win
  if (pctUsed >= 0.70) {
    const split = pctUsed >= 0.95;
    if (split) return ret({ outcome: `Split Dec. — R${maxRounds}`, icon: '🏅', dmgKey: 'split_win',
      desc: `Scraped through on the cards. One judge had ${oppShort} — the other two had you.` }, 'Split Decision', maxRounds);
    return ret({ outcome: `Unanimous Dec. — R${maxRounds}`, icon: '✋', dmgKey: 'decision_win',
      desc: `Controlled over ${maxRounds} rounds. The judges had no doubt.` }, 'Unanimous Decision', maxRounds);
  }

  const rnd    = getRound();
  const rndStr = ordinal(rnd);
  const wf     = weightedFinish();
  if (rnd === 1) {
    if (wf === 'KO')  return ret({ outcome: 'KO — R1',  icon: '🥊', dmgKey: 'ko_win',
      desc: `Perfect. ${oppShort} never got started. You put them down fast and clean.` }, 'KO', 1);
    if (wf === 'TKO') return ret({ outcome: 'TKO — R1', icon: '✊', dmgKey: 'ko_win',
      desc: `Ground and pound in the first. ${oppShort} had no answer for your pressure.` }, 'TKO', 1);
    return ret({ outcome: 'Sub — R1', icon: '⚡', dmgKey: 'ko_win',
      desc: `Clinical from the jump. ${oppShort} tapped out inside the first round.` }, 'Submission', 1);
  }
  if (wf === 'KO')  return ret({ outcome: `KO — R${rnd}`,  icon: '🥊', dmgKey: 'decision_win',
    desc: `Broke ${oppShort} down and put them away in the ${rndStr}.` }, 'KO', rnd);
  if (wf === 'TKO') return ret({ outcome: `TKO — R${rnd}`, icon: '✊', dmgKey: 'decision_win',
    desc: `Took ${oppShort} down in the ${rndStr} and didn't let them back up.` }, 'TKO', rnd);
  return ret({ outcome: `Sub — R${rnd}`, icon: '🔒', dmgKey: 'decision_win',
    desc: `Patiently set up the submission in the ${rndStr}.` }, 'Submission', rnd);
}

/* ── Result resolution ───────────────────────────────── */
/**
 * Full fight resolution — updates all state after an answer is submitted.
 * Called from QuestionScreen.svelte after the timer stops or submit is clicked.
 *
 * Returns { resultClass, rolled, isLast } for use by ResultScreen.svelte.
 */
export function resolveResult(state, cs, q, selectedSet, pctUsed, activeLength) {
  const { score, maxPts, ratio } = scoreQuestion(q, selectedSet);
  const timedOut = selectedSet.size === 0 && pctUsed >= 1;

  // Determine result class
  let resultClass;
  if (timedOut || ratio === 0) {
    state.finishes++; state.losses++;
    state.results.push('finish');
    resultClass = 'finish';
  } else if (ratio < 0.5) {
    state.losses++;
    state.results.push('loss');
    resultClass = 'loss';
  } else if (ratio < 1) {
    state.draws++;
    state.results.push('draw');
    resultClass = 'draw';
  } else {
    state.wins++;
    state.results.push('win');
    resultClass = 'win';
  }

  const rolled = rollFightOutcome(state, resultClass, pctUsed, timedOut, score, maxPts);
  const { dmgKey } = rolled;

  // ── Win streak ──
  if (resultClass === 'win') {
    state.currentStreak = Math.max(0, state.currentStreak) + 1;
    state.bestStreak    = Math.max(state.bestStreak, state.currentStreak);
  } else {
    state.currentStreak = 0;
  }

  // ── Unbeaten streak ──
  if (resultClass === 'win' || resultClass === 'draw') {
    state.unbeatenStreak++;
    state.bestUnbeatenStreak = Math.max(state.bestUnbeatenStreak, state.unbeatenStreak);
  } else {
    state.unbeatenStreak = 0;
  }

  // ── Finish streak ──
  const isFinishWin = resultClass === 'win' && (
    dmgKey === 'ko_win' ||
    rolled.outcome.includes('KO') || rolled.outcome.includes('TKO') ||
    rolled.outcome.includes('Submission') || rolled.outcome.includes('Ground')
  );
  state.finishStreak = isFinishWin ? Math.max(0, state.finishStreak) + 1 : 0;

  // ── Finish type tallies ──
  if (!state.sparring) {
    const m     = rolled.method || '';
    const isKO  = KO_METHODS.includes(m);
    const isTKO = TKO_METHODS.includes(m);
    const isSub = SUB_METHODS.includes(m);
    if (resultClass === 'win') {
      if (isKO)       { state.winsByKO++;  state.methodWeights.KO         = (state.methodWeights.KO         || 1) + 0.15; }
      else if (isTKO) { state.winsByTKO++; state.methodWeights.TKO        = (state.methodWeights.TKO        || 1) + 0.15; }
      else if (isSub) { state.winsBySub++; state.methodWeights.Submission = (state.methodWeights.Submission || 1) + 0.15; }
      if (m && (isKO || isTKO || isSub)) {
        state.specificMethodCounts[m] = (state.specificMethodCounts[m] || 0) + 1;
      } else { state.winsByDec++; }
    } else if (resultClass === 'loss' || resultClass === 'finish') {
      if (isKO)       state.lossByKO++;
      else if (isTKO) state.lossByTKO++;
      else if (isSub) state.lossBySub++;
      else            state.lossByDec++;
    }
  }

  // ── Question score tracking ──
  if (q) {
    const qid = qidOf(q);
    if (qid) {
      if (!state._qScores) state._qScores = {};
      state._qScores[qid] = (state._qScores[qid] || 0) + (resultClass === 'win' ? 1 : -1);
    }
  }

  // ── Bout history ──
  if (!state.sparring) {
    const o = state.currentOpponent || {};
    state.boutHistory.unshift({
      fn:          state.fightIndex,
      oppName:     o.name || 'Unknown',
      oppRankSlot: typeof o.divisionSlot === 'number' ? o.divisionSlot : null,
      outcome:     rolled.outcome,
      method:      rolled.method || '',
      rc:          resultClass,
      phase:       cs ? cs.phase : 1,
    });
    if (state.boutHistory.length > 50) state.boutHistory.pop();
  }

  // ── Career phase update ──
  let event = null;
  if (!state.sparring && cs) {
    const _won  = resultClass === 'win';
    const _draw = resultClass === 'draw';

    cs.wins   = state.wins;
    cs.losses = state.losses;

    // Challenger drop on championship defense win
    let extraDrop = 0;
    if (_won && cs.division && cs.division.playerSlot === CHAMP_SLOT) {
      if (resultClass === 'finish')        extraDrop = 5;
      else if (dmgKey === 'ko_win')        extraDrop = 4;
      else if (rolled.outcome.includes('Submission')) extraDrop = 3;
      else if (dmgKey === 'decision_win')  extraDrop = 2;
      else                                 extraDrop = 1;
    }

    updateDivisionAfterResult(state, cs, _won, _draw, extraDrop);
    event = updateCareerPhase(state, cs, timedOut ? 'timeout' : resultClass);
    cs.pendingEvent = event || null;
    cs.results      = state.results;

    // Callout record: track wins against each named opponent
    if (_won && state.currentOpponent && state.currentOpponent.name) {
      if (!cs.calloutRecord) cs.calloutRecord = {};
      cs.calloutRecord[state.currentOpponent.name] =
        (cs.calloutRecord[state.currentOpponent.name] || 0) + 1;
    }

    // Update opponent record in FIGHTERS registry
    if (state.currentOpponent && state.currentOpponent.fid && state.currentOpponent.fid !== 'player') {
      if (_won)       recLoss(state.currentOpponent.fid);
      else if (_draw) recDraw(state.currentOpponent.fid);
      else            recWin(state.currentOpponent.fid);
    }

    // Question rotation: rotate after beating the same fighter twice
    if (state.currentOpponent && state.currentOpponent.fid && state.currentOpponent.fid !== 'player') {
      const oppFid = state.currentOpponent.fid;
      if (!state.winsVsFighter) state.winsVsFighter = {};
      if (_won) {
        state.winsVsFighter[oppFid] = (state.winsVsFighter[oppFid] || 0) + 1;
        if (state.winsVsFighter[oppFid] >= 2) {
          const oppF    = gf(oppFid);
          const slotIdx = state.currentOpponent.divisionSlot;
          if (oppF) {
            rotateQuestionForFighter(state, oppF, cs, slotIdx);
            state.winsVsFighter[oppFid] = 0;
          }
        }
      }
    }

    // Durability damage
    const dmg = DURABILITY_DAMAGE[dmgKey] ?? DURABILITY_DAMAGE['loss'];
    cs.durability = Math.max(0, cs.durability - dmg);

    // Callout reset
    state.calloutUsed     = false;
    state.currentOpponent = null;
  }

  state.fightIndex++;
  if (state.sparring) state.sparringPtr++;

  // ── Retirement / end checks ──
  const durabilityExhausted = !state.sparring && cs && cs.durability <= 0;
  const retirementForced    = !state.sparring && cs && activeLength === 0
    && cs.phaseStreak <= -5;
  if (retirementForced)  { state.retiredForcefully  = true; }
  if (durabilityExhausted) { state.retiredDurability = true; }

  const totalFights = activeLength === 0 ? Infinity : activeLength;
  const isLast = !state.sparring && (
    state.fightIndex >= totalFights ||
    retirementForced ||
    durabilityExhausted ||
    (cs && cs.forceRetire)
  );

  return { resultClass, rolled, score, maxPts, ratio, isLast, event };
}

/* ── Next fight setup ────────────────────────────────── */
/**
 * Called when the player clicks "Next Fight".
 * Runs NPC round, resolves callout pin, and selects the next opponent.
 * Returns the updated currentOpponent.
 */
export function setupNextFight(state, cs, pinnedOpponent) {
  if (!cs) return null;

  let _pinnedPlayerSlot = null;
  let _pinnedOppFid     = null;
  let _pinnedOppSlot    = null;

  if (pinnedOpponent && pinnedOpponent.fid) {
    _pinnedPlayerSlot = cs.division.playerSlot;
    _pinnedOppFid     = pinnedOpponent.fid;
    _pinnedOppSlot    = pinnedOpponent.divisionSlot;
  }

  // Run NPC round (skip on first fight in a fresh division)
  if (cs.freshDivision) {
    cs.freshDivision = false;
  } else {
    advanceDivision(state, cs);
  }

  // Restore pinned slots if callout was active
  if (_pinnedOppFid) {
    const curOppIdx = cs.division.slots.indexOf(_pinnedOppFid);
    if (curOppIdx !== -1 && curOppIdx !== _pinnedOppSlot) {
      const occupant = cs.division.slots[_pinnedOppSlot];
      cs.division.slots[_pinnedOppSlot] = _pinnedOppFid;
      cs.division.slots[curOppIdx] = occupant;
    }
    const curPlayerIdx = cs.division.slots.indexOf('player');
    if (curPlayerIdx !== -1 && curPlayerIdx !== _pinnedPlayerSlot) {
      const occupant2 = cs.division.slots[_pinnedPlayerSlot];
      cs.division.slots[_pinnedPlayerSlot] = 'player';
      cs.division.slots[curPlayerIdx] = occupant2;
      cs.division.playerSlot = _pinnedPlayerSlot;
    }
    return divisionSlotToOpponent(_pinnedOppFid, _pinnedOppSlot, cs);
  }

  // Standard matchmaking
  const playerSlot = getPlayerSlot(cs);
  let targetSlot;
  if (playerSlot === CHAMP_SLOT) {
    targetSlot = CHAMP_SLOT - 1;
  } else {
    targetSlot = Math.min(CHAMP_SLOT, playerSlot + streakSteps(cs.phaseStreak, state));
  }

  const nextFid = cs.division && cs.division.slots[targetSlot];
  return (nextFid && nextFid !== 'player')
    ? divisionSlotToOpponent(nextFid, targetSlot, cs)
    : null;
}
