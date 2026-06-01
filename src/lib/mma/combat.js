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
  opponentFinishProfile,
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

  // Opponent finish profile — interplays with the player's weights below.
  // Derived from the opponent's style; neutral (all 1) when there's no opponent
  // (e.g. sparring). NPC-vs-NPC bouts never reach this function.
  const oppProfile = opponentFinishProfile(state.currentOpponent && state.currentOpponent.style);
  const oVuln = oppProfile.vuln;   // how easily the opponent gets finished (vs your wins)
  const oOff  = oppProfile.off;    // how the opponent finishes you (vs your losses)

  // Opponent's signature moves (one per finish type). When they finish the
  // player by a given type there's a 50% chance it's their signature.
  const oppSig = (state.currentOpponent && state.currentOpponent.signatureMoves) || {};
  // These result classes are the OPPONENT finishing the player (a loss). The
  // trailing 'win' path is the PLAYER finishing the opponent.
  const oppFinish = ['finish', 'late_finish', 'loss', 'timeout_finish'].includes(resultClass);

  // Per-occurrence likelihood gain for a specific move. Each time the player
  // wins by a given move (and each pick in the move selector) raises its weight
  // by this much, so a signature emerges. Larger pools need a bigger gain to
  // overcome dilution.
  const SPECIFIC_MOVE_GAIN = 0.6;
  function weightedPool(pool) {
    const weights = pool.map(m => 1 + (smc[m] || 0) * SPECIFIC_MOVE_GAIN);
    const total   = weights.reduce((a, x) => a + x, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  // Specific finish method for a general finish type:
  //  - player win  → weighted by the player's selected signature moves (smc)
  //  - opp. finish → 50% the opponent's signature for that type, else a uniform
  //                  roll from the pool (the player's smc must not bias it)
  function pickMethod(type) {
    const pool = type === 'KO' ? KO_METHODS : type === 'TKO' ? TKO_METHODS : SUB_METHODS;
    if (oppFinish) {
      const sig = oppSig[type];
      if (sig && pool.includes(sig) && Math.random() < 0.5) return sig;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return weightedPool(pool);
  }

  function ret(obj, generalMethod, round) {
    if (generalMethod === 'KO' || generalMethod === 'TKO' || generalMethod === 'Submission') {
      obj.method = pickMethod(generalMethod);
    } else {
      obj.method = generalMethod || '';
    }
    obj.round     = round || null;
    obj.maxRounds = maxRounds;
    return obj;
  }

  // How the player finishes the opponent on a win — their method weights
  // multiplied by how vulnerable the opponent is to each finish type.
  function weightedFinish() {
    const k = (mw.KO || 1)         * (oVuln.KO || 1);
    const t = (mw.TKO || 1)        * (oVuln.TKO || 1);
    const s = (mw.Submission || 1) * (oVuln.Submission || 1);
    let roll = Math.random() * (k + t + s);
    if ((roll -= k) <= 0) return 'KO';
    if ((roll -= t) <= 0) return 'TKO';
    return 'Submission';
  }

  // How the player gets finished when losing — their style's weakness
  // multiplied by how strong the opponent is at each finish type.
  const lw = (cs && cs.lossWeights) || { KO: 1, TKO: 1, Submission: 1 };
  function weightedLossFinish() {
    const k = (lw.KO || 1)         * (oOff.KO || 1);
    const t = (lw.TKO || 1)        * (oOff.TKO || 1);
    const s = (lw.Submission || 1) * (oOff.Submission || 1);
    let roll = Math.random() * (k + t + s);
    if ((roll -= k) <= 0) return 'KO';
    if ((roll -= t) <= 0) return 'TKO';
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

  // Stopped before the bell (timed out, stopped variant)
  if (resultClass === 'timeout_finish') {
    const r = Math.random();
    if (r < 0.50) return ret({ outcome: `TKO — R${maxRounds}`, icon: '⏱', dmgKey: 'timeout_finish',
      desc: `The ref waved it off in the final seconds. You did nothing and paid for it.` }, 'TKO', maxRounds);
    return ret({ outcome: `KO — R${maxRounds}`, icon: '⏱', dmgKey: 'timeout_finish',
      desc: `Caught right before the bell. The clock ran out on you in every sense.` }, 'KO', maxRounds);
  }

  // Embarrassing decision loss (timed out, decision variant)
  if (resultClass === 'embarrassing_dec') {
    return ret({ outcome: `Decision Loss — R${maxRounds}`, icon: '😶', dmgKey: 'embarrassing_dec',
      desc: `You survived but did absolutely nothing. Lost on every card. Embarrassing.` }, 'Decision', maxRounds);
  }

  // Early finish — ratio=0, pctUsed < 0.5
  if (resultClass === 'finish') {
    const rnd    = pctUsed < 0.30 ? 1 : randInt(1, Math.ceil(maxRounds / 2));
    const rndStr = ordinal(rnd);
    const lf = weightedLossFinish();
    if (lf === 'KO') return ret({ outcome: `KO — R${rnd}`, icon: '💥', dmgKey: 'finish',
      desc: `${oppShort} caught you clean in the ${rndStr}. Lights out.` }, 'KO', rnd);
    if (lf === 'Submission') return ret({ outcome: `Sub — R${rnd}`, icon: '🔒', dmgKey: 'finish',
      desc: `Tapped out in the ${rndStr}. ${oppShort} was clinical on the ground.` }, 'Submission', rnd);
    if (Math.random() < 0.5) return ret({ outcome: `TKO — R${rnd}`, icon: '💀', dmgKey: 'finish',
      desc: `Ground and pound in the ${rndStr}. The ref had seen enough.` }, 'TKO', rnd);
    return ret({ outcome: `TKO — R${rnd}`, icon: '🛑', dmgKey: 'finish',
      desc: `Stopped in the ${rndStr} after taking too much damage.` }, 'TKO', rnd);
  }

  // Late finish — ratio=0, pctUsed >= 0.5
  if (resultClass === 'late_finish') {
    const rnd    = randInt(Math.ceil(maxRounds / 2), maxRounds);
    const rndStr = ordinal(rnd);
    const lf = weightedLossFinish();
    if (lf === 'KO') return ret({ outcome: `KO — R${rnd}`, icon: '💥', dmgKey: 'late_finish',
      desc: `Wore you down and put you away in the ${rndStr}. You had no answer.` }, 'KO', rnd);
    if (lf === 'Submission') return ret({ outcome: `Sub — R${rnd}`, icon: '🔒', dmgKey: 'late_finish',
      desc: `Patience. ${oppShort} waited, then locked it in the ${rndStr}.` }, 'Submission', rnd);
    return ret({ outcome: `TKO — R${rnd}`, icon: '💀', dmgKey: 'late_finish',
      desc: `Accumulated damage caught up with you in the ${rndStr}. The ref stepped in.` }, 'TKO', rnd);
  }

  // Split loss — ratio 0.5–0.74
  if (resultClass === 'split_loss') {
    return ret({ outcome: `Split Dec. Loss — R${maxRounds}`, icon: '📋', dmgKey: 'split_loss',
      desc: `Split decision. You were in it but came up just short on two cards.` }, 'Split Decision', maxRounds);
  }

  // Loss — ratio 0.01–0.49
  if (resultClass === 'loss') {
    const rnd    = getRound();
    const rndStr = ordinal(rnd);
    // ~25% lost on the cards; the rest is a finish skewed by the player's weakness.
    if (Math.random() < 0.25) return ret({ outcome: `Decision Loss — R${maxRounds}`, icon: '📋', dmgKey: 'loss',
      desc: `Lost on the cards over ${maxRounds} rounds. ${oppShort} did just enough.` }, 'Decision', maxRounds);
    const lf = weightedLossFinish();
    if (lf === 'KO') return ret({ outcome: `KO Loss — R${rnd}`, icon: '💢', dmgKey: 'loss',
      desc: `Caught with a big shot in the ${rndStr}. Down and out cold.` }, 'KO', rnd);
    if (lf === 'TKO') return ret({ outcome: `TKO Loss — R${rnd}`, icon: '🩹', dmgKey: 'loss',
      desc: `Stopped in the ${rndStr}. The ref stepped in after you took too much.` }, 'TKO', rnd);
    return ret({ outcome: `Sub Loss — R${rnd}`, icon: '🔗', dmgKey: 'loss',
      desc: `Caught in a submission in the ${rndStr}. ${oppShort} was the better grappler.` }, 'Submission', rnd);
  }

  // Draw — ratio 0.75–0.99
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
  if (wf === 'KO')  return ret({ outcome: `KO — R${rnd}`,  icon: '🥊', dmgKey: 'late_finish_win',
    desc: `Broke ${oppShort} down and put them away in the ${rndStr}.` }, 'KO', rnd);
  if (wf === 'TKO') return ret({ outcome: `TKO — R${rnd}`, icon: '✊', dmgKey: 'late_finish_win',
    desc: `Took ${oppShort} down in the ${rndStr} and didn't let them back up.` }, 'TKO', rnd);
  return ret({ outcome: `Sub — R${rnd}`, icon: '🔒', dmgKey: 'late_finish_win',
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
  if (timedOut) {
    // Timeout: randomly stopped before the bell or embarrassing decision loss
    if (Math.random() < 0.5) {
      state.finishes++;
      state.results.push('finish');
      resultClass = 'timeout_finish';
    } else {
      state.losses++;
      state.results.push('loss');
      resultClass = 'embarrassing_dec';
    }
  } else if (ratio === 0) {
    state.finishes++;
    state.results.push('finish');
    resultClass = pctUsed < 0.5 ? 'finish' : 'late_finish';
  } else if (ratio < 0.5) {
    state.losses++;
    state.results.push('loss');
    resultClass = 'loss';
  } else if (ratio < 0.75) {
    state.losses++;
    state.results.push('loss');
    resultClass = 'split_loss';
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
    KO_METHODS.includes(rolled.method) ||
    TKO_METHODS.includes(rolled.method) ||
    SUB_METHODS.includes(rolled.method)
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
    } else if (['loss', 'split_loss', 'finish', 'late_finish', 'timeout_finish', 'embarrassing_dec'].includes(resultClass)) {
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
    // Title fight: champion's belt is on the line. Runs BEFORE updateDivisionAfterResult,
    // so cs.division.playerSlot is still the pre-fight slot here.
    const pPreSlot   = cs && cs.division ? cs.division.playerSlot : -1;
    const oPreSlot   = typeof o.divisionSlot === 'number' ? o.divisionSlot : -1;
    const titleFight = pPreSlot === CHAMP_SLOT || oPreSlot === CHAMP_SLOT;

    // Event name: GFL numbered/fight-night for phase 3, org name for others
    let eventName = '';
    if (cs) {
      const phase = cs.phase || 1;
      const evNum = cs.gflEventNum || 1;
      if (phase === 3) {
        const onMainCard = pPreSlot >= CHAMP_SLOT - 5; // top 5 or better
        eventName = onMainCard ? `GFL ${evNum}` : `GFL Fight Night`;
      } else if (phase === 2) {
        eventName = cs.phase2Name || 'Apex Combat';
      } else {
        eventName = 'Regional FC';
      }
    }

    state.boutHistory.unshift({
      fn:          state.fightIndex,
      oppName:     o.name || 'Unknown',
      oppRankSlot: typeof o.divisionSlot === 'number' ? o.divisionSlot : null,
      playerSlot:  pPreSlot >= 0 ? pPreSlot : null,
      outcome:     rolled.outcome,
      method:      rolled.method || '',
      rc:          ['split_loss', 'embarrassing_dec'].includes(resultClass) ? 'loss'
                 : ['late_finish', 'timeout_finish'].includes(resultClass)  ? 'finish'
                 : resultClass,
      phase:       cs ? cs.phase : 1,
      eventName,
      titleFight,
    });
    if (state.boutHistory.length > 50) state.boutHistory.pop();

    // Advance the GFL event counter every fight (the league runs regardless of your org)
    if (cs) cs.gflEventNum = (cs.gflEventNum || 1) + randInt(1, 10);
  }

  // ── Career phase update ──
  let event = null;
  if (!state.sparring && cs) {
    const _won  = resultClass === 'win';
    const _draw = resultClass === 'draw';

    cs.wins   = state.wins;
    cs.losses = state.losses;

    // Capture the player's slot BEFORE the division moves them this fight —
    // updateCareerPhase needs it to detect title transitions (won belt / defense / lost).
    const slotBefore = cs.division ? cs.division.playerSlot : 0;

    // Challenger drop on championship defense win
    let extraDrop = 0;
    if (_won && cs.division && cs.division.playerSlot === CHAMP_SLOT) {
      if (dmgKey === 'ko_win')             extraDrop = 4;
      else if (dmgKey === 'late_finish_win') extraDrop = 3;
      else if (dmgKey === 'decision_win')  extraDrop = 2;
      else                                 extraDrop = 1;
    }

    const extraLossDrop = resultClass === 'embarrassing_dec' ? 2 : 0;
    updateDivisionAfterResult(state, cs, _won, _draw, extraDrop, extraLossDrop);
    event = updateCareerPhase(state, cs, resultClass, slotBefore);
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

    // Head-to-head record vs this specific opponent
    if (state.currentOpponent && state.currentOpponent.fid && state.currentOpponent.fid !== 'player') {
      const oppFid = state.currentOpponent.fid;
      if (!state.h2h) state.h2h = {};
      if (!state.h2h[oppFid]) state.h2h[oppFid] = { w: 0, l: 0, d: 0 };
      if (_won)       state.h2h[oppFid].w++;
      else if (_draw) state.h2h[oppFid].d++;
      else            state.h2h[oppFid].l++;
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

    // Durability damage (late_finish_win scales 0.5–0.9 by round relative to maxRounds)
    let dmg;
    if (dmgKey === 'late_finish_win') {
      const maxR = rolled.maxRounds || 3;
      const r    = rolled.round    || 2;
      dmg = 0.5 + 0.4 * (r - 1) / Math.max(1, maxR - 1);
    } else {
      dmg = DURABILITY_DAMAGE[dmgKey] ?? DURABILITY_DAMAGE['loss'];
    }
    cs.durability = Math.max(0, cs.durability - dmg);

    // Callout reset
    state.calloutUsed     = false;
    state.currentOpponent = null;
  }

  state.fightIndex++;
  if (state.sparring) state.sparringPtr++;

  // ── Legacy stat tracking (peakWinPct, longestLosingStreak) ──
  if (!state.sparring && cs) {
    const f = state.fightIndex; // already incremented — equals total completed fights
    const w = state.wins;
    cs.peakWinPct = Math.max(cs.peakWinPct ?? 0, f > 0 ? w / f : 0);

    const isLossResult = ['loss', 'split_loss', 'finish', 'late_finish',
                          'timeout_finish', 'embarrassing_dec'].includes(resultClass);
    if (isLossResult) {
      cs._currentLosingStreak  = (cs._currentLosingStreak  || 0) + 1;
      cs.longestLosingStreak   = Math.max(cs.longestLosingStreak || 0, cs._currentLosingStreak);
    } else {
      cs._currentLosingStreak  = 0;
    }
  }

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

  let _pinnedOppFid  = null;
  let _pinnedOppSlot = null;

  if (pinnedOpponent && pinnedOpponent.fid) {
    _pinnedOppFid  = pinnedOpponent.fid;
    _pinnedOppSlot = pinnedOpponent.divisionSlot;
  }

  // Run NPC round (skip on first fight in a fresh division)
  if (cs.freshDivision) {
    cs.freshDivision = false;
  } else {
    advanceDivision(state, cs);
  }

  // Restore the called-out opponent to their pinned slot.
  // The NPC round can only move the player UP (retirements / promotions only
  // increment playerSlot), so we never revert the player's position — doing so
  // would silently undo a legitimate ranking gain.
  if (_pinnedOppFid) {
    const curOppIdx = cs.division.slots.indexOf(_pinnedOppFid);
    if (curOppIdx !== -1 && curOppIdx !== _pinnedOppSlot) {
      const occupant = cs.division.slots[_pinnedOppSlot];
      cs.division.slots[_pinnedOppSlot] = _pinnedOppFid;
      cs.division.slots[curOppIdx] = occupant;
      // If the player advanced into the opponent's pinned slot during the NPC
      // round, keep playerSlot tracking correct after the swap above.
      if (cs.division.playerSlot === _pinnedOppSlot) {
        cs.division.playerSlot = curOppIdx;
      }
    }
    return divisionSlotToOpponent(_pinnedOppFid, _pinnedOppSlot, cs);
  }

  // Standard matchmaking
  const playerSlot = getPlayerSlot(cs);
  let targetSlot;
  if (playerSlot === CHAMP_SLOT) {
    targetSlot = CHAMP_SLOT - 1;
  } else if (cs.phaseStreak < 0) {
    // After a loss, fight someone below the player's current rank
    const dropSteps = Math.min(2, Math.abs(cs.phaseStreak));
    targetSlot = Math.max(1, playerSlot - dropSteps);
  } else {
    targetSlot = Math.min(CHAMP_SLOT, playerSlot + streakSteps(cs.phaseStreak, state));
  }

  const nextFid = cs.division && cs.division.slots[targetSlot];
  return (nextFid && nextFid !== 'player')
    ? divisionSlotToOpponent(nextFid, targetSlot, cs)
    : null;
}
