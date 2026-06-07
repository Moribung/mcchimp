/**
 * src/lib/mma/arenaScene.js
 * Pick the crowd background, enclosure, and mat for a given fight.
 * Called once per fight in QuestionScreen; result stored in gs.arenaScene
 * so the post-fight screen can reuse the same values.
 */

import { CHAMP_SLOT } from '$lib/mma/constants.js';
import { playerAvatarSpec, opponentAvatarSpec } from '$lib/mma/avatarSpec.js';

function pickCrowdBg(phase, playerSlot, oppSlot, isTitleFight) {
  const highestSlot = Math.max(playerSlot, oppSlot);
  const r = Math.random();

  if (phase === 1) {
    if (isTitleFight) return r < 0.25 ? 'bg_crowd_packed' : 'bg_crowd_medium';
    const t = highestSlot / (CHAMP_SLOT - 1);
    return r < t * 0.8 ? 'bg_crowd_medium' : 'bg_empty';
  }
  if (phase === 2) {
    if (isTitleFight) return r < 0.75 ? 'bg_crowd_packed' : 'bg_crowd_medium';
    const t = highestSlot / (CHAMP_SLOT - 1);
    return r < t * 0.5 ? 'bg_crowd_packed' : 'bg_crowd_medium';
  }
  // Phase 3 (GFL)
  const isNumbered = playerSlot >= CHAMP_SLOT - 5;
  if (isNumbered) return 'bg_crowd_packed';
  const maxFNSlot = CHAMP_SLOT - 6;
  const t = maxFNSlot > 0 ? Math.min(highestSlot, maxFNSlot) / maxFNSlot : 0;
  return r < 0.5 + t * 0.25 ? 'bg_crowd_packed' : 'bg_crowd_medium';
}

function pickEnclosure(phase, isTitleFight, phase2Name) {
  const r = Math.random();
  if (phase === 1) {
    if (isTitleFight) return r < 0.8 ? 'cage' : 'ring';
    if (r < 0.2) return 'none';
    if (r < 0.5) return 'ring';
    return 'cage';
  }
  if (phase === 2) return /king/i.test(phase2Name || '') ? 'cage' : 'ring';
  return 'cage';
}

function pickMat(phase) {
  if (phase === 3) return 'canvas_gfl_text';
  if (phase === 2) return 'canvas_gfl';
  return Math.random() < 0.2 ? 'canvas_gfl' : 'none';
}

export function pickArenaScene(gs) {
  if (gs.sparring || !gs.career) return { background: 'bg_empty', enclosure: 'none', mat: 'none' };
  const cs         = gs.career;
  const phase      = cs.phase ?? 1;
  const playerSlot = cs.division?.playerSlot ?? 0;
  const oppSlot    = gs.currentOpponent?.divisionSlot ?? 0;
  const isTitleFight = oppSlot === CHAMP_SLOT || playerSlot === CHAMP_SLOT;

  return {
    background: pickCrowdBg(phase, playerSlot, oppSlot, isTitleFight),
    enclosure:  pickEnclosure(phase, isTitleFight, cs.phase2Name),
    mat:        pickMat(phase),
    player:     playerAvatarSpec(gs),
    opp:        opponentAvatarSpec(gs),
  };
}
