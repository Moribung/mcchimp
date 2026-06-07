/**
 * src/lib/mma/avatarSpec.js
 * ─────────────────────────────────────────
 * Single source of truth for the player's and opponent's avatar render specs
 * (the props passed to FighterAvatar): appearance + division pants, belt, gloves.
 * Used by the sidebar cards (+page.svelte / CareerPanel) and the arena window.
 */

import { CHAMP_SLOT } from '$lib/mma/constants.js';
import {
  divisionPants, divisionBeltColor, divisionBeltType,
  CHAMP_PANTS, gloveColorFor, getPlayerSlot,
} from '$lib/mma/career.js';
import { COUNTRY_BY_NAME } from '$lib/mma/countries.js';
import { REGIONS }         from '$lib/mma/regions.js';
import { nationalityFit }  from '$lib/avatar/nationalityFits.js';
import { ethnicAvatar }    from '$lib/avatar/ethnicLooks.js';
import { surnameLookOverride } from '$lib/mma/names.js';

const BLACK = '#181820';

// Best-guess ethnicity for roster fighters with no stored ethnicity: the dominant
// ethnic group of their country's region.
function ethForNationality(name) {
  const dist = REGIONS[COUNTRY_BY_NAME[name]?.regionId]?.ethnicDistribution;
  if (!dist) return 'vintage';
  let best = 'vintage', bw = -1;
  for (const [k, w] of Object.entries(dist)) { if (k !== '*' && w > bw) { bw = w; best = k; } }
  return best;
}

const isTitleFight = (cs, oppSlot) =>
  oppSlot === CHAMP_SLOT || getPlayerSlot(cs) === CHAMP_SLOT;

// Player avatar spec — mirrors CareerPanel.svelte.
export function playerAvatarSpec(gs) {
  const cs = gs.career;
  if (!cs?.avatar) return null;
  const slot     = getPlayerSlot(cs);
  const oppSlot  = gs.currentOpponent?.divisionSlot;
  const tf       = isTitleFight(cs, oppSlot);
  return {
    avatar:     cs.avatar,
    org:        divisionPants(cs),
    beltType:   cs.titleHeld ? divisionBeltType(cs)  : null,
    beltColor:  cs.titleHeld ? divisionBeltColor(cs) : null,
    gloveColor: oppSlot == null ? null : gloveColorFor(slot, oppSlot, tf, true),
  };
}

// Opponent avatar spec — mirrors the oppAvatar block in +page.svelte.
export function opponentAvatarSpec(gs) {
  const opp = gs.currentOpponent, cs = gs.career;
  if (!opp || !cs) return null;
  const look = opp.look
    || ethnicAvatar(surnameLookOverride(opp.name) || opp.ethnicity || ethForNationality(opp.nationality), opp.fid || opp.name || 'x');
  const iso        = COUNTRY_BY_NAME[opp.nationality]?.iso || '';
  const playerMain = (cs.avatar?.shortsBase || '').toLowerCase();
  const oppIsChamp = opp.divisionSlot === CHAMP_SLOT;
  let main, trim;
  if (oppIsChamp && playerMain !== BLACK) {
    main = CHAMP_PANTS.main; trim = CHAMP_PANTS.trim;   // champion: black/gold
  } else {
    let fit = nationalityFit(iso, 0);
    const collides = fit.main.toLowerCase() === (oppIsChamp ? BLACK : playerMain);
    if (collides) fit = nationalityFit(iso, 1);
    main = fit.main; trim = fit.trim;
  }
  const tf = isTitleFight(cs, opp.divisionSlot);
  return {
    avatar:     { ...look, shortsBase: main, shortsTrim: trim },
    org:        divisionPants(cs),
    beltType:   oppIsChamp ? divisionBeltType(cs)  : null,
    beltColor:  oppIsChamp ? divisionBeltColor(cs) : null,
    gloveColor: gloveColorFor(opp.divisionSlot, getPlayerSlot(cs), tf, false),
  };
}
