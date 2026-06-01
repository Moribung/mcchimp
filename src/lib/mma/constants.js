/**
 * src/lib/mma/constants.js
 * ─────────────────────────────────────────
 * All static configuration for MMA Career Trivia.
 * No imports. No side effects. Pure data.
 */

/* ── Phase definitions ───────────────────────────────── */
export const PHASES = {
  1: {
    name:          'Regional Circuit',
    promo:         'Regional FC',
    cssClass:      'phase-1',
    rankLabels:    { 0: 'Unranked', 11: 'Regional Champ' },
    winsToRanked:  2,
    winsToChamp:   2,
    cutStreak:     99,   // can't be cut from phase 1 — it's the floor
    advanceFights: 5,
    advanceWinRate: 0.5,
  },
  2: {
    name:          'Mid-Tier Promotion',
    promo:         'Apex Combat',
    cssClass:      'phase-2',
    rankLabels:    { 0: 'Unranked', 11: 'Apex Champion' },
    winsToRanked:  3,
    winsToChamp:   3,
    cutStreak:     3,
    advanceFights: 8,
    advanceWinRate: 0.55,
  },
  3: {
    name:          'Top Promotion',
    promo:         'Global Fight League',
    cssClass:      'phase-3',
    rankLabels:    { 0: 'Unranked', 11: 'GFL World Champion' },
    winsToRanked:  3,
    winsToChamp:   4,
    cutStreak:     5,
    advanceFights: null,
    advanceWinRate: null,
  },
};

/* ── Phase 2 org options (one chosen randomly per career) ── */
export const PHASE2_OPTIONS = [
  { promo: 'Apex Combat',                belt: 'Apex Champion'   },
  { promo: 'Kings Fighting Championship', belt: 'KFC Champion'      },
];

/* ── Division size constants ─────────────────────────── */
export const DIVISION_SIZE = 21;   // total slots
export const CHAMP_SLOT    = 20;   // slot index of champion
export const RANKED_START  = 5;    // first ranked slot (slots 5–19 = #15–#1)
// slot 0–4  → Unranked (5 spots, player starts at slot 0)
// slot 5    → #15 ranked
// slot 19   → #1 ranked
// slot 20   → Champion

/* ── Retirement / loss limits ────────────────────────── */
export const RETIREMENT_LOSS_STREAK = 5; // losses in ∞-mode before forced retirement

/* ── Durability ──────────────────────────────────────── */
export const DURABILITY_DAMAGE = {
  ko_win:           0.5,
  // late_finish_win: computed dynamically as 0.5 + 0.4 * (round-1) / (maxRounds-1)
  decision_win:     1.0,
  split_win:        2.0,
  draw:             2.5,
  split_loss:       3.0,
  embarrassing_dec: 3.0,
  loss:             4.0,
  finish:           5.0,
  late_finish:      6.0,
  timeout_finish:   6.0,
};

export const MIN_TIMER  = 5;   // seconds at 0% durability
export const BASE_TIMER = 30;  // fallback; use getBaseTimer() for difficulty-aware value

/* ── Difficulty / timer config ───────────────────────── */
export const DIFFICULTY_TIMERS = {
  easy:   60,
  medium: 45,
  hard:   30,
};

/* ── Question tier display ───────────────────────────── */
export const DIFF_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', elite: 'Elite' };
export const DIFF_COLORS = {
  easy:   '#4ae87a',
  medium: '#e8c14a',
  hard:   '#e84a4a',
  elite:  '#b44ae8',
};
export const DIFF_BG = {
  easy:   'rgba(74,232,122,0.12)',
  medium: 'rgba(232,193,74,0.12)',
  hard:   'rgba(232,74,74,0.12)',
  elite:  'rgba(180,74,232,0.12)',
};

/* ── Name pools ──────────────────────────────────────── */
export const FIRST_NAMES = [
  'Jake','Carlos','Danny','Marcos','Andre','Tyler','Ray','Dion',
  'Liam','Finn','Elias','Viktor','Serge','Kosta','Manny','Rory','Colt','Dean',
  'Ivan','Omar','Niko','Brent','Joel','Chase','Shane','Cruz','Darryl','Zeke',
];

export const LAST_NAMES = [
  'Torres','Williams','Santos','Bravo','Reed','Kim','Rocha','Pierce',
  'Okafor','Novak','Ferreira','Walsh','Petrov','Diaz','Steele','Murphy','Cohen',
  'Nakamura','Garza','Bell','Vance','Tran','Flores','Cross','Hayden','Yates','Moss',
];

export const NICKNAMES = [
  'The Hammer','Iron Fist','The Shark','Rampage','Ice Cold','The Machine',
  'Razor','The Predator','Lights Out','Stone Cold','The Ghost','Wildcard','The Surgeon',
  'Chaos','The Reaper','El Diablo','The Technician','The Natural','Silent Storm','The Cobra',
];

/* ── Venue pools (per phase) ─────────────────────────── */
export const VENUES_P1 = [
  'The Pit','Riverside Fairgrounds','Tri-County Rec Center',
  'Old Depot Hall','Veterans Legion Post','The Warehouse','Lakefront Community Center',
  'East Side Civic Hall','Bayview Bingo & Events','Milltown Sports Complex',
  'The Stockyard','County Fairground Arena',
];
export const VENUES_P2 = [
  'Meridian Arena','The Coliseum','Summit Center',
  'Harbor Events Center','Pinnacle Pavilion','Metro Sports Arena',
  'Westside Convention Center','Parkway Arena','The Rotunda','Casino Grand Ballroom',
  'Harborview Hall','Lakeside Civic Center',
];
export const VENUES_P3 = [
  'National Arena','The Palais','Convention Center',
  'Civic Coliseum','Sports Palace','Grand Pavilion',
  'The Forum','Exhibition Arena','Waterfront Stadium','The Grand Hall',
];

export const GFL_CITIES = [
  'Las Vegas','London','Tokyo','Dubai','Abu Dhabi','New York',
  'Los Angeles','São Paulo','Sydney','Singapore','Paris','Toronto',
  'Mexico City','Madrid','Amsterdam','Shanghai','Riyadh','Manchester',
];

/* ── Fun facts (flavor only — never performance/record related) ──
   Appended to ~1 in 3 fighters' scouting reports for colour. Keep every
   entry purely about background/personality so it can never contradict
   a fighter's actual stats. */
export const FUN_FACTS = [
  'Trains out of a converted garage gym back home.',
  'Walks out to the same song every single fight.',
  'A qualified electrician before he turned pro.',
  'Brings his own chef along for fight week.',
  'Collects vintage motorcycles between camps.',
  'Started martial arts at the age of four.',
  'Swears the beard is lucky and refuses to trim it mid-camp.',
  'Speaks four languages fluently.',
  'Coaches a kids’ wrestling club in the off-season.',
  'Has a tattoo for every country he has fought in.',
  'A former national-level swimmer.',
  'Superstitious — always steps into the cage left foot first.',
  'Runs a surprisingly popular cooking channel on the side.',
  'Named his dog after his favourite submission.',
];

/* ── Fighter roster ──────────────────────────────────────
   Stable named fighters with style, record template, and
   question ID prefixes. When a question's _id starts with
   one of their prefixes, that fighter appears as opponent.
──────────────────────────────────────────────────────── */
export const FIGHTER_ROSTER = [
  { id:'F001', fn:'Jake',    ln:'Torres',   nick:'The Hammer',       style:'Wrestler/GnP',       wRange:[8,18],  lRange:[1,4],  prefixes:['MMA-EA-00','MMA-EA-01','MMA-EA-02'] },
  { id:'F002', fn:'Carlos',  ln:'Santos',   nick:'El Diablo',        style:'Muay Thai striker',  wRange:[10,22], lRange:[2,6],  prefixes:['MMA-EA-03','MMA-EA-04','MMA-ME-00'] },
  { id:'F003', fn:'Viktor',  ln:'Novak',    nick:'Iron Curtain',     style:'Sambo/wrestler',     wRange:[12,20], lRange:[1,4],  prefixes:['MMA-ME-01','MMA-ME-02','MMA-ME-03'] },
  { id:'F004', fn:'Danny',   ln:'Reed',     nick:'Lights Out',       style:'Boxer',              wRange:[6,14],  lRange:[2,5],  prefixes:['MMA-ME-04','MMA-ME-05','MMA-HA-00'] },
  { id:'F005', fn:'Manny',   ln:'Rocha',    nick:'The Machine',      style:'BJJ specialist',     wRange:[9,18],  lRange:[1,3],  prefixes:['MMA-HA-01','MMA-HA-02','MMA-HA-03'] },
  { id:'F006', fn:'Rory',    ln:'Walsh',    nick:'The Ghost',        style:'Counter-striker',    wRange:[11,21], lRange:[2,5],  prefixes:['MMA-HA-04','MMA-HA-05','MMA-EL-00'] },
  { id:'F007', fn:'Elias',   ln:'Petrov',   nick:'Stone Cold',       style:'Pressure fighter',   wRange:[14,26], lRange:[1,4],  prefixes:['MMA-EL-01','MMA-EL-02','MMA-EL-03'] },
  { id:'F008', fn:'Andre',   ln:'Okafor',   nick:'The Predator',     style:'Kickboxer',          wRange:[8,17],  lRange:[3,7],  prefixes:['MMA-EL-04','MMA-EL-05','MMA-EA-05'] },
  { id:'F009', fn:'Liam',    ln:'Murphy',   nick:'Chaos',            style:'Unorthodox brawler', wRange:[7,15],  lRange:[4,8],  prefixes:['MMA-EA-06','MMA-EA-07','MMA-ME-06'] },
  { id:'F010', fn:'Kosta',   ln:'Diaz',     nick:'The Surgeon',      style:'Technical striker',  wRange:[13,24], lRange:[1,3],  prefixes:['MMA-ME-07','MMA-ME-08','MMA-ME-09'] },
  { id:'F011', fn:'Finn',    ln:'Steele',   nick:'Razor',            style:'Submission hunter',  wRange:[10,19], lRange:[2,5],  prefixes:['MMA-HA-06','MMA-HA-07','MMA-HA-08'] },
  { id:'F012', fn:'Omar',    ln:'Garza',    nick:'The Reaper',       style:'Wrestler/top ctrl',  wRange:[15,28], lRange:[1,4],  prefixes:['MMA-EL-06','MMA-EL-07','MMA-EL-08'] },
  { id:'F013', fn:'Tyler',   ln:'Cross',    nick:'Wildcard',         style:'All-rounder',        wRange:[6,12],  lRange:[3,7],  prefixes:['ANbu-00','ANbu-01','ANbu-02'] },
  { id:'F014', fn:'Serge',   ln:'Ferreira', nick:'The Cobra',        style:'Clinch specialist',  wRange:[9,16],  lRange:[2,6],  prefixes:['ANbu-03','ANbu-04','ANme-00'] },
  { id:'F015', fn:'Niko',    ln:'Bell',     nick:'Silent Storm',     style:'Karate/counter',     wRange:[11,20], lRange:[1,4],  prefixes:['ANme-01','ANme-02','ANme-03'] },
  { id:'F016', fn:'Brent',   ln:'Kim',      nick:'The Natural',      style:'MMA all-rounder',    wRange:[8,15],  lRange:[3,6],  prefixes:['ANme-04','ANme-05','ANme-06'] },
  { id:'F017', fn:'Joel',    ln:'Pierce',   nick:'The Technician',   style:'BJJ/wrestling',      wRange:[12,22], lRange:[2,5],  prefixes:['ANha-00','ANha-01','ANha-02'] },
  { id:'F018', fn:'Chase',   ln:'Vance',    nick:'El Fuego',         style:'Volume striker',     wRange:[10,18], lRange:[2,6],  prefixes:['ANha-03','ANha-04','ANha-05'] },
  { id:'F019', fn:'Shane',   ln:'Hayden',   nick:'The Philosopher',  style:'Grappling wizard',   wRange:[14,25], lRange:[1,3],  prefixes:['ANel-00','ANel-01','ANel-02'] },
  { id:'F020', fn:'Cruz',    ln:'Tran',     nick:'The Ironman',      style:'High-cardio brawler',wRange:[9,17],  lRange:[3,7],  prefixes:['ANel-03','ANel-04','ANel-05'] },
];

/* ── Finish method buckets ───────────────────────────────
   *_METHODS are the FULL pools any finish can roll from. Every entry is a
   concrete finish — there are no generic 'KO'/'TKO' placeholders. TKO still
   includes ref/doctor stoppages (real outcomes, just not player-selectable).
   SELECTABLE_* are the subset a player may manually pick as a signature move,
   and the pool that enemy signature moves are drawn from: only specific,
   deliberate finishing techniques.
──────────────────────────────────────────────────────── */
export const SELECTABLE_KO = [
  'Head Kick', 'Flying Knee', 'Spinning Elbow',
  'Left Hook', 'Uppercut', 'Overhand Right', 'Knee', 'Body Kick',
];
export const SELECTABLE_TKO = ['TKO (Strikes)', 'TKO (Ground and Pound)', 'Clinch Elbows'];
export const SELECTABLE_SUB = [
  'Rear Naked Choke', 'Triangle Choke', 'Armbar',
  'Guillotine', "D'Arce Choke", 'Heel Hook', 'Kimura', 'Anaconda Choke',
];

export const KO_METHODS  = [...SELECTABLE_KO];
export const TKO_METHODS = [...SELECTABLE_TKO, 'Doctor Stoppage', 'Corner Stoppage'];
export const SUB_METHODS = [...SELECTABLE_SUB];

/* ── Fight style profiles ────────────────────────────────
   Chosen on the naming screen. Purely affects the *flavour*
   of your wins and losses — never durability or difficulty.

   win:  seeds state.methodWeights (base 1 + tendency). A value
         of 3 vs base 1 means that finish type is ~3× as likely.
   loss: seeds career.lossWeights — skews HOW you get finished
         when you lose by finish. Cosmetic only.

   The highest win/loss weight is 3 (base 1 + max additive 2).
──────────────────────────────────────────────────────── */
export const FIGHT_STYLES = [
  { id:'allrounder', name:'MMA Fighter',       tagline:'No holes, no peaks. Adapts to anything.',
    win:{ KO:1, TKO:1, Submission:1 }, loss:{ KO:1, TKO:1, Submission:1 } },
  { id:'brawler',    name:'Brawler',           tagline:'All power. Swing first, ask later.',
    win:{ KO:3, TKO:1, Submission:1 }, loss:{ KO:3, TKO:1, Submission:1 } },
  { id:'boxer',      name:'Boxer',             tagline:'Sharp hands, heavy leather, no ground game.',
    win:{ KO:2, TKO:2, Submission:1 }, loss:{ KO:1, TKO:2, Submission:2 } },
  { id:'kickboxer',  name:'Kickboxer',         tagline:'Strikes from every angle.',
    win:{ KO:2, TKO:2, Submission:1 }, loss:{ KO:2, TKO:2, Submission:1 } },
  { id:'wrestler',   name:'Wrestler',          tagline:'Take them down, grind them out.',
    win:{ KO:1, TKO:3, Submission:1 }, loss:{ KO:1, TKO:1, Submission:3 } },
  { id:'submission', name:'Submission Hunter', tagline:'The fight ends on the mat.',
    win:{ KO:1, TKO:1, Submission:3 }, loss:{ KO:3, TKO:1, Submission:1 } },
  { id:'pressure',   name:'Pressure Fighter',  tagline:'Relentless, suffocating volume.',
    win:{ KO:1, TKO:3, Submission:1 }, loss:{ KO:1, TKO:3, Submission:1 } },
  { id:'sniper',     name:'Sniper',            tagline:'Patient. One perfect shot.',
    win:{ KO:3, TKO:1, Submission:1 }, loss:{ KO:1, TKO:3, Submission:1 } },
];

export function getFightStyle(id) {
  return FIGHT_STYLES.find(s => s.id === id) || null;
}

/* ── Fighter profiles (style === profile) ────────────────
   A fighter's displayed style IS its mechanical finish profile —
   one source of truth, keyed by the exact style string.
     off  — how strong they are at finishing YOU (interplays with
            your style's loss weights when you lose by finish)
     vuln — how easily they themselves get finished (interplays with
            your method weights when you win by finish)
   Base is 1; higher = more likely. Read ONLY inside the player's own
   fight resolution (rollFightOutcome) — NPC-vs-NPC bouts never compute
   a finish type, so profiles have no effect there.
──────────────────────────────────────────────────────── */
export const FIGHTER_PROFILES = {
  // ── Strikers — KO-leaning, vulnerable on the ground ──
  'Boxer':              { off:{ KO:2.2, TKO:1.3, Submission:0.4 }, vuln:{ KO:1,   TKO:1,   Submission:1.9 } },
  'Kickboxer':          { off:{ KO:2,   TKO:1.5, Submission:0.5 }, vuln:{ KO:1,   TKO:1,   Submission:1.7 } },
  'Muay Thai striker':  { off:{ KO:1.8, TKO:1.8, Submission:0.5 }, vuln:{ KO:1,   TKO:1,   Submission:1.6 } },
  'Counter-striker':    { off:{ KO:2,   TKO:1.1, Submission:0.5 }, vuln:{ KO:0.9, TKO:1,   Submission:1.6 } },
  'Karate/counter':     { off:{ KO:2,   TKO:1.1, Submission:0.5 }, vuln:{ KO:0.9, TKO:1,   Submission:1.5 } },
  'Technical striker':  { off:{ KO:1.7, TKO:1.4, Submission:0.6 }, vuln:{ KO:1,   TKO:1,   Submission:1.5 } },
  'Volume striker':     { off:{ KO:1.2, TKO:2,   Submission:0.6 }, vuln:{ KO:1.1, TKO:1,   Submission:1.4 } },

  // ── Pressure / brawlers — volume & power, hittable ──
  'Pressure fighter':   { off:{ KO:1,   TKO:2.2, Submission:0.7 }, vuln:{ KO:1.2, TKO:1,   Submission:1.2 } },
  'High-cardio brawler':{ off:{ KO:1.3, TKO:2,   Submission:0.7 }, vuln:{ KO:1.4, TKO:1,   Submission:1.2 } },
  'Unorthodox brawler': { off:{ KO:2.2, TKO:1.3, Submission:0.6 }, vuln:{ KO:1.8, TKO:1.3, Submission:1.2 } },

  // ── Wrestlers — GnP stoppages, sub-vulnerable off their back ──
  'Wrestler/GnP':       { off:{ KO:0.7, TKO:2.2, Submission:1   }, vuln:{ KO:1.3, TKO:0.8, Submission:1.5 } },
  'Wrestler/top ctrl':  { off:{ KO:0.6, TKO:2.2, Submission:1.1 }, vuln:{ KO:1.3, TKO:0.8, Submission:1.4 } },
  'Clinch specialist':  { off:{ KO:1,   TKO:2,   Submission:1   }, vuln:{ KO:1.2, TKO:0.9, Submission:1.3 } },
  'Sambo/wrestler':     { off:{ KO:0.8, TKO:1.7, Submission:1.6 }, vuln:{ KO:1.3, TKO:0.9, Submission:1   } },

  // ── Grapplers — submission-heavy, vulnerable to strikes ──
  'BJJ specialist':     { off:{ KO:0.5, TKO:1,   Submission:2.2 }, vuln:{ KO:1.8, TKO:1.2, Submission:0.5 } },
  'Submission hunter':  { off:{ KO:0.6, TKO:1.2, Submission:2.4 }, vuln:{ KO:1.7, TKO:1.1, Submission:0.5 } },
  'Grappling wizard':   { off:{ KO:0.4, TKO:1,   Submission:2.6 }, vuln:{ KO:1.9, TKO:1.1, Submission:0.4 } },
  'BJJ/wrestling':      { off:{ KO:0.6, TKO:1.6, Submission:1.8 }, vuln:{ KO:1.5, TKO:0.9, Submission:0.7 } },

  // ── Balanced ──
  'All-rounder':        { off:{ KO:1,   TKO:1,   Submission:1   }, vuln:{ KO:1,   TKO:1,   Submission:1   } },
  'MMA all-rounder':    { off:{ KO:1,   TKO:1,   Submission:1   }, vuln:{ KO:1,   TKO:1,   Submission:1   } },
};

/** All assignable profile style keys — used to give generated fighters a style. */
export const ALL_PROFILE_STYLES = Object.keys(FIGHTER_PROFILES);

const NEUTRAL_PROFILE = FIGHTER_PROFILES['All-rounder'];

/** Look up a fighter's finish profile by their style string.
 *  Falls back to neutral for empty/unknown styles (e.g. legacy saves). */
export function opponentFinishProfile(style) {
  return FIGHTER_PROFILES[style] || NEUTRAL_PROFILE;
}

/* ── Tier config (for effectiveTier adaptive difficulty) ── */
export const TIER_ORDER = ['easy', 'medium', 'hard', 'elite'];

/* ── Legacy tier config ─────────────────────────────────
   score thresholds that shift a question's effective tier:
   +2 answered correctly  → bump up one tier
   -2 answered incorrectly → bump down one tier
──────────────────────────────────────────────────────── */
export const QSCORE_UP_THRESHOLD   =  2;
export const QSCORE_DOWN_THRESHOLD = -2;
