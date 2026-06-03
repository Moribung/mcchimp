/**
 * Match-report flavour text — context-aware one-liners.
 * Ported and adapted from the original Anstoss embed.
 */

import { relegationCount } from './constants.js';
import { ordinal }         from './utils.js';

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const lastName = name => (name || '').split(' ').slice(-1)[0];

/**
 * @param {'W'|'D'|'L'} result
 * @param {number} pg player goals
 * @param {number} og opponent goals
 * @param {boolean} isHome
 * @param {object} ctx { scorers, playerPos, total, matchday, totalMatchdays, season, opponentName, form, division }
 */
export function pickFlavour(result, pg, og, isHome, ctx = {}) {
  const {
    scorers = [], playerPos = 0, total = 18, matchday = 0,
    totalMatchdays = 38, season = 1, opponentName = '', form = [], division = 2,
  } = ctx;

  const margin     = Math.abs(pg - og);
  const rel        = relegationCount(total);
  const inDrop     = playerPos > total - rel;
  const atTop      = playerPos === 1;
  const recentForm = form.slice(-5);
  const losses     = recentForm.filter(r => r === 'L').length;
  const wins       = recentForm.filter(r => r === 'W').length;
  const gamesLeft  = totalMatchdays - matchday;
  const isRunIn    = gamesLeft <= 5 && gamesLeft > 0;
  const isLastGame = matchday === totalMatchdays;
  const isEarly    = matchday <= 4;
  const slump      = losses >= 3;
  const surge      = wins >= 4;

  // Top player scorer (most goals this match)
  const playerScorers = scorers.filter(s => s.isPlayer);
  const counts = {};
  playerScorers.forEach(s => { counts[s.name] = (counts[s.name] || 0) + 1; });
  const topScorer = playerScorers.sort((a, b) => (counts[b.name] || 0) - (counts[a.name] || 0))[0];
  const scorerRef = topScorer ? lastName(topScorer.name) : null;
  const posRef    = atTop ? 'top of the table' : inDrop ? 'the drop zone' : ordinal(playerPos);

  if (isLastGame) {
    return scorerRef
      ? `The final game of the season. ${scorerRef}'s ${result === 'W' ? 'goal' : 'contribution'} — the last word.`
      : `The final game of the season. The curtain comes down.`;
  }

  if (result === 'W') {
    return pick([
      scorerRef && `${scorerRef} with the decisive contribution. ${atTop ? 'Clear at the top.' : `Up to ${posRef}.`}`,
      scorerRef && pg >= 2 && `${scorerRef} among the scorers. ${margin >= 2 ? 'A convincing result.' : 'Job done.'}`,
      isEarly && `The right start to the campaign. ${atTop ? 'Top of the table.' : `${ordinal(playerPos)} place.`}`,
      isRunIn && `Three points with ${gamesLeft} games left. ${atTop ? 'In control.' : 'Keeps the pressure on.'}`,
      surge && `${wins} wins from the last five. This side has found something.`,
      !isHome && `Three points away from home. ${inDrop ? 'Breathing room.' : `Up to ${posRef}.`}`,
      margin >= 3 && `A commanding performance. ${scorerRef ? `${scorerRef} the standout.` : ''}`,
      atTop && `Three points clear at the top.`,
      `${scorerRef ? `${scorerRef}'s ${pg > 1 ? 'brace was the difference' : 'goal settled it'}.` : 'Three points.'} ${inDrop ? 'Out of the drop zone.' : `Up to ${posRef}.`}`,
      `${isHome ? 'Solid at home.' : 'Resilient away.'} ${pg}-${og} the final score.`,
    ].filter(Boolean));
  }

  if (result === 'D') {
    return pick([
      scorerRef && `${scorerRef} on the scoresheet, but a point is all that came of it.`,
      isRunIn && `A draw with ${gamesLeft} left. ${inDrop ? 'Not enough.' : 'Every point still counts.'}`,
      slump && `The pressure is building. The wait for a win goes on.`,
      pg === 0 && `${isHome ? 'Held at home.' : 'Goalless away.'} The table tightens.`,
      !isHome && `A point on the road. ${inDrop ? 'Still in the drop zone.' : `Sitting ${posRef}.`}`,
      `${isHome ? 'Shared spoils at home.' : 'A point away from home.'} ${inDrop ? 'Not enough to climb.' : `${ordinal(playerPos)} place.`}`,
      `Neither side could find a winner. ${pg > 0 ? `${pg}-${og}.` : 'Goalless.'}`,
    ].filter(Boolean));
  }

  // Loss
  return pick([
    scorerRef && og > pg && `${scorerRef} scored, but it wasn't enough. Down to ${posRef}.`,
    slump && `Without a win for too long now. ${inDrop ? 'Deep in trouble.' : `Down to ${posRef}.`}`,
    isRunIn && `A defeat with ${gamesLeft} games left. ${inDrop ? 'Time is running out.' : 'Costly timing.'}`,
    margin >= 3 && `Taken apart. ${inDrop ? 'Firmly in the drop zone.' : `Down to ${posRef}.`}`,
    !isHome && `No points on the road. ${inDrop ? 'Still in the drop zone.' : `${ordinal(playerPos)} place.`}`,
    isEarly && `A stumble early in the campaign. ${inDrop ? 'Early pressure.' : `${ordinal(playerPos)} after ${matchday}.`}`,
    `${inDrop ? 'Still in the drop zone.' : `Down to ${posRef}.`} ${margin === 1 ? 'A narrow defeat.' : 'Difficult to take.'}`,
    `${opponentName ? lastName(opponentName) : 'The opposition'} took the points. A setback.`,
  ].filter(Boolean));
}
