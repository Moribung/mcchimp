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
  { promo: 'Kings Fighting Championship', belt: 'KFC Champion'    },
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

/* ── Bio pools (per phase) ───────────────────────────── */
export const BIOS_P1 = [
  'A tough local product making noise on the regional scene.',
  'Six fights in, no quit in him — hungry and dangerous.',
  "Trained out of a converted garage gym. Don't sleep on him.",
  'An unknown quantity. No film, no tape. Just a record.',
  'Comes in overweight at every weigh-in. Still keeps winning.',
];
export const BIOS_P2 = [
  'A veteran of 30+ fights. Seen everything, done everything.',
  'Coming off a brutal war last camp. Still carries the damage.',
  'A late replacement — only two weeks of camp. Could go either way.',
  'Ranked fighter on a four-fight win streak. Hot right now.',
  'A finisher. Twelve of his wins have come inside the distance.',
  'Former amateur champion. Plenty of amateur pedigree behind him.',
  "A grappler. He'll be looking to drag this to the floor.",
  'A journeyman — but the kind that makes careers end early.',
];
export const BIOS_P3 = [
  'A ranked contender with a power that has ended eleven careers.',
  'The #2-ranked challenger. A loss here ends title ambitions.',
  'The current interim champion. He carries the belt but wants the real thing.',
  'A 10-year veteran of the sport. This might be his last shot at gold.',
  'He knocked out the last person who stepped to him in 47 seconds.',
  'Undefeated in the promotion. A test no one has passed yet.',
  'The champion has been avoiding him for two years. No more.',
  'A defensive wizard. Nobody has finished him in 25 fights.',
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

/* ── Finish method buckets (used by submitAnswer for stat tracking) ── */
export const KO_METHODS  = ['KO', 'Head Kick KO', 'Flying Knee KO', 'Spinning Elbow KO'];
export const TKO_METHODS = ['TKO', 'TKO (Strikes)', 'TKO (Ground and Pound)', 'Doctor Stoppage', 'Corner Stoppage'];
export const SUB_METHODS = [
  'Rear Naked Choke', 'Triangle Choke', 'Armbar',
  'Guillotine', 'D\'Arce Choke', 'Heel Hook', 'Kimura', 'Anaconda Choke',
];

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

/* ── Tier config (for effectiveTier adaptive difficulty) ── */
export const TIER_ORDER = ['easy', 'medium', 'hard', 'elite'];

/* ── Legacy tier config ─────────────────────────────────
   score thresholds that shift a question's effective tier:
   +2 answered correctly  → bump up one tier
   -2 answered incorrectly → bump down one tier
──────────────────────────────────────────────────────── */
export const QSCORE_UP_THRESHOLD   =  2;
export const QSCORE_DOWN_THRESHOLD = -2;
