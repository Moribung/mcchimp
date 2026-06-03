export const TIER_ORDER = ['easy', 'medium', 'hard', 'elite'];

export const KIT_COLOURS = [
  { name: 'Royal Blue', hex: '#1a4fba' },
  { name: 'Crimson',    hex: '#b81a1a' },
  { name: 'Forest',     hex: '#1a6b30' },
  { name: 'Amber',      hex: '#d4821a' },
  { name: 'Violet',     hex: '#6b1ab8' },
  { name: 'Teal',       hex: '#1a8a7a' },
  { name: 'Slate',      hex: '#4a5a6b' },
  { name: 'Claret',     hex: '#7a1a3a' },
];

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];
export const POSITION_COUNTS = { GK: 2, DEF: 6, MID: 6, FWD: 4 }; // 18-man squad

export const DIV_NAMES = { 1: 'Prima Divisione', 2: 'Seconda Divisione' };

export const DIFF_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', elite: 'Elite' };
export const DIFF_COLORS = {
  easy:   '#3ecf6a',
  medium: '#e8994a',
  hard:   '#e05252',
  elite:  '#a855f7',
};
export const DIFF_BG = {
  easy:   'rgba(62,207,106,0.1)',
  medium: 'rgba(232,153,74,0.1)',
  hard:   'rgba(224,82,82,0.1)',
  elite:  'rgba(168,85,247,0.1)',
};

// Adaptive q-score thresholds (mirrored from MMA)
export const QSCORE_UP_THRESHOLD   =  3;
export const QSCORE_DOWN_THRESHOLD = -3;

export function relegationCount(divSize) {
  if (divSize <= 8)  return 1;
  if (divSize <= 14) return 2;
  return 3;
}

// DIV1 clubs (fixed NPC pool)
export const DIV1_CLUBS_BASE = [
  { id:'d1_01', name:'Victoria Campeone',    rating:92, colours:['#d4a847','#ffffff'] },
  { id:'d1_02', name:'Imperiale Grandeza',   rating:88, colours:['#4b0082','#d4a847'] },
  { id:'d1_03', name:'Regalia Noblezza',     rating:84, colours:['#2255bb','#c0c0c0'] },
  { id:'d1_04', name:'Gloria Fortezza',      rating:81, colours:['#aa1111','#d4a847'] },
  { id:'d1_05', name:'Suprema Fiereza',      rating:78, colours:['#111111','#d4a847'] },
  { id:'d1_06', name:'Corona Audacia',       rating:75, colours:['#cc2200','#ffffff'] },
  { id:'d1_07', name:'Triumpho Bravura',     rating:72, colours:['#e86400','#111111'] },
  { id:'d1_08', name:'Atletica Potenza',     rating:69, colours:['#0a1f6e','#cc1111'] },
  { id:'d1_09', name:'Stella Primazia',      rating:67, colours:['#5bb8f5','#ffffff','#d4a847'] },
  { id:'d1_10', name:'Forza Unità',          rating:65, colours:['#1a6b30','#ffffff'] },
  { id:'d1_11', name:'Sporting Lealtad',     rating:63, colours:['#1a4fba','#e8d44d'] },
  { id:'d1_12', name:'Dynamo Solidità',      rating:61, colours:['#cc1111','#ffffff'] },
  { id:'d1_13', name:'Rapida Agilità',       rating:59, colours:['#e8d44d','#111111'] },
  { id:'d1_14', name:'Libera Libertà',       rating:57, colours:['#ffffff','#1a8a4a'] },
  { id:'d1_15', name:'Unione Semplicità',    rating:55, colours:['#aaaaaa','#ffffff'] },
  { id:'d1_16', name:'Fortuna Umiltà',       rating:53, colours:['#7a1a3a','#f5f0e8'] },
  { id:'d1_17', name:'Ardente Antichità',    rating:51, colours:['#d4821a','#6b3a1f'] },
  { id:'d1_18', name:'Ferrea Fermezza',      rating:49, colours:['#6b7280','#111111'] },
  { id:'d1_19', name:'Popolare Costanza',    rating:47, colours:['#cc1111','#ffffff','#111111'] },
];

export const DIV2_CLUBS_BASE = [
  { id:'d2_01', name:'Ardore Tenacia',           rating:66, colours:['#e86400','#ffffff'] },
  { id:'d2_02', name:'Fedelta Robustezza',        rating:64, colours:['#1a5c2a','#ffffff'] },
  { id:'d2_03', name:'Militia Durezza',           rating:62, colours:['#4a5a2a','#111111'] },
  { id:'d2_04', name:'Combativa Grezza',          rating:60, colours:['#cc1111','#888888'] },
  { id:'d2_05', name:'Solida Concretezza',        rating:58, colours:['#888888','#2255bb'] },
  { id:'d2_06', name:'Laboriosa Operosità',       rating:56, colours:['#1a4fba','#e86400'] },
  { id:'d2_07', name:'Rustica Genuinità',         rating:54, colours:['#6b3a1f','#e8d44d'] },
  { id:'d2_08', name:'Vigorosa Freschezza',       rating:53, colours:['#1a6b30','#e8d44d'] },
  { id:'d2_09', name:'Battagliera Vivacità',      rating:52, colours:['#6b1ab8','#ffffff'] },
  { id:'d2_10', name:'Provinciale Semenza',       rating:51, colours:['#d4821a','#6b3a1f'] },
  { id:'d2_11', name:'Umile Radicalità',          rating:50, colours:['#111111','#ffffff'] },
  { id:'d2_12', name:'Oscura Profondità',         rating:49, colours:['#0a1f3a','#1a3a1a'] },
  { id:'d2_13', name:'Grintosa Asprezza',         rating:48, colours:['#cc1111','#111111'] },
  { id:'d2_14', name:'Selvaggia Selvatichezza',   rating:47, colours:['#1a5c2a','#e86400'] },
  { id:'d2_15', name:'Periferica Marginalità',    rating:46, colours:['#888888','#e8d44d'] },
  { id:'d2_16', name:'Cruda Rudezza',             rating:45, colours:['#7a1a3a','#888888'] },
  { id:'d2_17', name:'Oscilla Incertezza',        rating:44, colours:['#2255bb','#888888'] },
  { id:'d2_18', name:'Precaria Fragilità',        rating:43, colours:['#aaccee','#ffffff'] },
  { id:'d2_19', name:'Ombra Oscurità',            rating:42, colours:['#111111','#4b0082'] },
  { id:'d2_20', name:'Decadente Povertà',         rating:41, colours:['#cccccc','#ffffff'] },
];
