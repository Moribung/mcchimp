// Weighted appearance spreads per ethnic group (+ vintage), used to generate
// stable opponent avatars. Indices map to SKIN_TONES (0 Fair,1 Tan,2 Brown,3 Deep)
// and HAIR_COLORS (0 black,1 brown,2 blonde,3 ginger,4 gray). Hair/beard are styles.
// Each entry is [value, weight]; weights are picked with a seed for stability.

const S = (fair, tan, brown, deep) => [[0, fair], [1, tan], [2, brown], [3, deep]];
const H = (blk, brn, bln, gin, gry) => [[0, blk], [1, brn], [2, bln], [3, gin], [4, gry]];
const HAIR = (bald, buzz, short, mohawk, afro, long) =>
  [['bald', bald], ['buzz', buzz], ['short', short], ['mohawk', mohawk], ['afro', afro], ['long', long]];
const BEARD = (none, goatee, full) => [['none', none], ['goatee', goatee], ['full', full]];

export const ETHNIC_LOOKS = {
  american:         { skin: S(30, 30, 25, 15), hairColor: H(40, 35, 15, 5, 5),  hairStyle: HAIR(15, 25, 35, 5, 10, 10), beard: BEARD(45, 25, 30) },
  latino:           { skin: S(15, 40, 35, 10), hairColor: H(70, 25, 0, 0, 5),   hairStyle: HAIR(10, 30, 40, 5, 5, 10),  beard: BEARD(35, 30, 35) },
  mexican:          { skin: S(12, 45, 35, 8),  hairColor: H(80, 15, 0, 0, 5),   hairStyle: HAIR(10, 30, 40, 5, 5, 10),  beard: BEARD(30, 35, 35) },
  brazilian:        { skin: S(15, 35, 30, 20), hairColor: H(65, 25, 5, 0, 5),   hairStyle: HAIR(10, 30, 35, 5, 10, 10), beard: BEARD(35, 30, 35) },
  british_irish:    { skin: S(65, 25, 8, 2),   hairColor: H(25, 40, 15, 15, 5), hairStyle: HAIR(20, 30, 35, 5, 0, 10),  beard: BEARD(35, 25, 40) },
  eastern_european: { skin: S(60, 30, 8, 2),   hairColor: H(35, 45, 12, 0, 8),  hairStyle: HAIR(20, 35, 35, 5, 0, 5),   beard: BEARD(45, 25, 30) },
  west_african:     { skin: S(0, 5, 35, 60),   hairColor: H(90, 2, 0, 0, 8),    hairStyle: HAIR(25, 40, 25, 2, 8, 0),   beard: BEARD(35, 25, 40) },
  japanese:         { skin: S(35, 50, 13, 2),  hairColor: H(92, 2, 0, 0, 6),    hairStyle: HAIR(10, 30, 45, 5, 0, 10),  beard: BEARD(65, 20, 15) },
  korean:           { skin: S(35, 50, 13, 2),  hairColor: H(92, 2, 0, 0, 6),    hairStyle: HAIR(8, 25, 50, 5, 0, 12),   beard: BEARD(70, 18, 12) },
  vintage:          { skin: S(45, 35, 15, 5),  hairColor: H(35, 35, 10, 0, 20), hairStyle: HAIR(20, 25, 45, 0, 0, 10),  beard: BEARD(40, 25, 35) },
};

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rngFrom(seed) {
  let x = seed || 1;
  return () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
}
function pickWeighted(entries, r) {
  const total = entries.reduce((s, e) => s + e[1], 0);
  let x = r() * total;
  for (const [v, w] of entries) { if ((x -= w) < 0) return v; }
  return entries[0][0];
}

/** Deterministic avatar appearance for an ethnicity, seeded by a stable string. */
export function ethnicAvatar(ethnicity, seedStr) {
  const looks = ETHNIC_LOOKS[ethnicity] || ETHNIC_LOOKS.vintage;
  const r = rngFrom(hashStr(seedStr || 'x'));
  const skinIdx      = pickWeighted(looks.skin, r);
  const hairColorIdx = pickWeighted(looks.hairColor, r);
  const hairStyle    = pickWeighted(looks.hairStyle, r);
  const beardStyle   = pickWeighted(looks.beard, r);
  return { skinIdx, hairStyle, hairColorIdx, beardStyle, beardColorIdx: hairColorIdx };
}
