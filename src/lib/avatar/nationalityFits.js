// Nationality → two pants colour pairs [main, trim].
// Two pairs per nation so the player and (future) auto-coloured opponents can
// each take a distinct main colour drawn from the same national palette.
// Unknown / unlisted nations fall back to black/white & white/black.

const RED   = '#c0392b', CRIM = '#b41f2f', WHITE = '#e8e8ec', BLACK = '#181820',
      BLUE  = '#2c4d9b', NAVY = '#1e2f5e', SKY   = '#4a90c2', LBLUE = '#6ab6e0',
      GREEN = '#2e9e58', DGRN = '#145c34', YELL  = '#f0c419', GOLD  = '#d8b23a',
      ORNG  = '#e8821e', MARO = '#6e1f1f', PURP  = '#6a3da0', TEAL  = '#1f8a86';

export const UNKNOWN_FITS = [[BLACK, WHITE], [WHITE, BLACK]];

export const NATIONALITY_FITS = {
  // ── Americas ──
  US: [[NAVY, WHITE], [RED, WHITE]],   CA: [[RED, WHITE], [WHITE, RED]],
  MX: [[GREEN, WHITE], [RED, GREEN]],  BR: [[GREEN, YELL], [YELL, GREEN]],
  AR: [[LBLUE, WHITE], [WHITE, LBLUE]],CO: [[YELL, BLUE], [BLUE, RED]],
  VE: [[YELL, BLUE], [RED, YELL]],     PE: [[RED, WHITE], [WHITE, RED]],
  CL: [[BLUE, WHITE], [RED, WHITE]],   UY: [[SKY, WHITE], [WHITE, SKY]],
  EC: [[YELL, BLUE], [BLUE, RED]],     BO: [[GREEN, YELL], [RED, YELL]],
  PY: [[RED, BLUE], [BLUE, WHITE]],    CU: [[BLUE, WHITE], [RED, WHITE]],
  DO: [[BLUE, RED], [RED, WHITE]],     PR: [[RED, WHITE], [BLUE, WHITE]],
  JM: [[GREEN, GOLD], [BLACK, GOLD]],  HT: [[BLUE, RED], [RED, BLUE]],
  TT: [[RED, BLACK], [BLACK, WHITE]],  GT: [[SKY, WHITE], [WHITE, SKY]],

  // ── Europe ──
  GB: [[NAVY, RED], [RED, WHITE]],     IE: [[GREEN, ORNG], [ORNG, WHITE]],
  FR: [[BLUE, WHITE], [RED, WHITE]],   ES: [[RED, GOLD], [GOLD, RED]],
  PT: [[GREEN, RED], [RED, GREEN]],    DE: [[BLACK, RED], [RED, GOLD]],
  NL: [[ORNG, NAVY], [RED, WHITE]],    BE: [[BLACK, GOLD], [YELL, RED]],
  CH: [[RED, WHITE], [WHITE, RED]],    AT: [[RED, WHITE], [WHITE, RED]],
  IT: [[GREEN, WHITE], [RED, WHITE]],  GR: [[BLUE, WHITE], [WHITE, BLUE]],
  NO: [[RED, NAVY], [NAVY, WHITE]],    SE: [[BLUE, YELL], [YELL, BLUE]],
  FI: [[WHITE, BLUE], [BLUE, WHITE]],  DK: [[RED, WHITE], [WHITE, RED]],
  IS: [[BLUE, RED], [RED, WHITE]],     PL: [[WHITE, RED], [RED, WHITE]],
  CZ: [[BLUE, WHITE], [RED, WHITE]],   SK: [[BLUE, WHITE], [RED, WHITE]],
  HU: [[RED, GREEN], [GREEN, WHITE]],  RO: [[BLUE, YELL], [YELL, RED]],
  BG: [[GREEN, WHITE], [WHITE, RED]],  HR: [[RED, WHITE], [BLUE, WHITE]],
  RS: [[RED, NAVY], [NAVY, WHITE]],    SI: [[BLUE, WHITE], [RED, WHITE]],
  BA: [[BLUE, YELL], [YELL, BLUE]],    AL: [[RED, BLACK], [BLACK, RED]],

  // ── Eurasia / Caucasus ──
  UA: [[BLUE, YELL], [YELL, BLUE]],    RU: [[WHITE, BLUE], [RED, WHITE]],
  BY: [[RED, GREEN], [GREEN, RED]],    GE: [[WHITE, RED], [RED, WHITE]],
  AM: [[RED, ORNG], [BLUE, ORNG]],     AZ: [[SKY, RED], [GREEN, RED]],
  KZ: [[SKY, GOLD], [GOLD, SKY]],      UZ: [[BLUE, GREEN], [GREEN, WHITE]],

  // ── Middle East / North Africa ──
  TR: [[RED, WHITE], [WHITE, RED]],    IL: [[BLUE, WHITE], [WHITE, BLUE]],
  LB: [[RED, WHITE], [GREEN, WHITE]],  SA: [[GREEN, WHITE], [DGRN, WHITE]],
  AE: [[GREEN, RED], [RED, BLACK]],    IR: [[GREEN, RED], [RED, WHITE]],
  IQ: [[RED, GREEN], [BLACK, RED]],    EG: [[RED, BLACK], [BLACK, GOLD]],
  MA: [[RED, GREEN], [GREEN, RED]],    DZ: [[GREEN, RED], [RED, WHITE]],
  TN: [[RED, WHITE], [WHITE, RED]],

  // ── South / Central / East Asia ──
  AF: [[BLACK, GREEN], [RED, GREEN]],  PK: [[DGRN, WHITE], [GREEN, WHITE]],
  IN: [[ORNG, GREEN], [GREEN, ORNG]],  NP: [[CRIM, BLUE], [BLUE, CRIM]],
  BD: [[GREEN, RED], [RED, GREEN]],    LK: [[MARO, GOLD], [GOLD, MARO]],
  JP: [[WHITE, RED], [RED, WHITE]],    KR: [[WHITE, BLUE], [BLUE, RED]],
  KP: [[RED, WHITE], [BLUE, RED]],     CN: [[RED, YELL], [YELL, RED]],
  TW: [[BLUE, RED], [RED, WHITE]],     MN: [[RED, BLUE], [BLUE, GOLD]],
  TH: [[BLUE, RED], [RED, WHITE]],     VN: [[RED, YELL], [YELL, RED]],
  PH: [[BLUE, RED], [RED, GOLD]],      ID: [[RED, WHITE], [WHITE, RED]],
  MY: [[BLUE, YELL], [RED, WHITE]],    SG: [[RED, WHITE], [WHITE, RED]],

  // ── Africa ──
  NG: [[GREEN, WHITE], [WHITE, GREEN]],GH: [[RED, GOLD], [GREEN, GOLD]],
  CM: [[GREEN, RED], [RED, YELL]],     SN: [[GREEN, YELL], [YELL, RED]],
  CI: [[ORNG, GREEN], [GREEN, WHITE]], ML: [[GREEN, YELL], [YELL, RED]],
  KE: [[BLACK, RED], [RED, GREEN]],    ET: [[GREEN, YELL], [YELL, RED]],
  ZA: [[GREEN, GOLD], [GOLD, BLACK]],  CD: [[SKY, RED], [RED, YELL]],
  CG: [[GREEN, YELL], [YELL, RED]],    AO: [[RED, BLACK], [BLACK, GOLD]],
  GA: [[GREEN, YELL], [BLUE, YELL]],   ZW: [[GREEN, GOLD], [RED, BLACK]],

  // ── Oceania ──
  AU: [[NAVY, RED], [GREEN, GOLD]],    NZ: [[NAVY, RED], [BLACK, WHITE]],
  FJ: [[SKY, WHITE], [WHITE, SKY]],    PG: [[RED, BLACK], [BLACK, GOLD]],
};

/** Returns { main, trim } for a nationality ISO and pair index (0 or 1). */
export function nationalityFit(iso, which = 0) {
  const fits = NATIONALITY_FITS[iso] || UNKNOWN_FITS;
  const pair = fits[which] || fits[0];
  return { main: pair[0], trim: pair[1] };
}
