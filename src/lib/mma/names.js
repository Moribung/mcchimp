/**
 * src/lib/mma/names.js
 * ─────────────────────────────────────────
 * Ethnic name banks + fighter generation helpers. Pure data + logic, no DOM.
 *
 * Each ethnic group has:
 *  - firstNames / lastNames / nicknames : its own name pools.
 *  - styleWeights : 8 weights over FIGHT_STYLES ids, in order
 *      [allrounder, brawler, boxer, kickboxer, wrestler, submission, pressure, sniper].
 *      Used to bias NPC fight styles only — the player always picks freely.
 *  - firstMix / lastMix / nickMix : per-part source weights. Each name part rolls
 *      its source bank independently (mostly the group's own bank + small slices of
 *      others + a '*' wildcard meaning "any group"). Lets e.g. an American roster
 *      carry the occasional Mexican surname.
 *  - flags : curated nationality spread (ISO code → weight). Single-country groups
 *      emit one flag; regional groups emit a spread. Independent of the player's
 *      chosen country (countries.js).
 *
 * `vintage` reuses the original generic banks from constants.js — a retro generator
 * seeded at a small rate in some regions and 1% in GFL.
 */

import { FIRST_NAMES, LAST_NAMES, NICKNAMES } from './constants.js';
import { isoToFlag, countryName } from './countries.js';

export const ETHNIC_GROUPS = {
  american: {
    firstNames:['Tyler','Chase','Colt','Dean','Jake','Brent','Ray','Shane','Joel','Darryl','Zeke','Kyle','Dustin','Wade','Brett','Cody','Travis','Logan','Hunter','Blake','Austin','Cole','Tanner','Garrett','Jared','Nate','Marcus','Dion'],
    lastNames:['Reed','Pierce','Steele','Cross','Bell','Vance','Hayden','Yates','Moss','Flynn','Holt','Grant','Burns','Knox','Tate','Foley','Shaw','Craig','Webb','Stone','Cash','Hawk','Ford','Brooks'],
    nicknames:['Big Bear','Big Dog','Lion','Predator of the Prey that is hiding','The Hammer','Rampage','Stone Cold','Iron Fist','Wildcard','The Natural','Lights Out','The Machine','Chainsaw','The Predator','Pitbull','The Reaper','Iceman','The Butcher','War Machine','The Outlaw'],
    styleWeights:[3,3,4,2,4,2,3,2],
    firstMix:{american:82,british_irish:5,'*':13}, lastMix:{american:68,british_irish:10,west_african:2,eastern_european:4,latino:4,'*':12}, nickMix:{american:78,vintage:12,'*':10},
    flags:{ US:100 },
  },
  latino: {
    firstNames:['Carlos','Marcos','Cruz','Manny','Omar','Rico','Hector','Miguel','Luis','Diego','Andres','Javier','Rafael','Sergio','Raul','Victor','Ivan','Ernesto','Pedro','Juan','Alejandro','Rodrigo','Angel','Fernando','Gustavo','Roberto','Ramon','Cesar'],
    lastNames:['Torres','Diaz','Garza','Bravo','Rocha','Flores','Vargas','Cruz','Medina','Ramos','Herrera','Gutierrez','Morales','Ortiz','Reyes','Vega','Padilla','Santiago','Fuentes','Mendoza','Castillo','Delgado','Salazar','Navarro','Aguilar','Solis'],
    nicknames:['El Diablo','El Matador','El Toro','El Fuego','La Bestia','El Tiburon','El Verdugo','El Fantasma','El Coyote','El Patron','La Fiera','El Cazador','El Guerrero','El Lobo','El Machete','La Sombra'],
    styleWeights:[2,4,5,3,2,2,5,2],
    firstMix:{latino:80,mexican:8,'*':12}, lastMix:{latino:78,mexican:8,'*':14}, nickMix:{latino:68,mexican:8,american:10,'*':14},
    flags:{ AR:26, CO:20, VE:14, PE:12, CU:10, DO:10, CL:8 },
  },
  brazilian: {
    firstNames:['Andre','Fabio','Thiago','Wanderlei','Vitor','Lyoto','Rodrigo','Paulo','Gabriel','Rafael','Leonardo','Felipe','Gustavo','Renato','Edson','Demian','Charles','Claudio','Gleison','Ronaldo','Diego','Alex','Marco','Junior'],
    lastNames:['Santos','Ferreira','Silva','Souza','Lima','Costa','Oliveira','Rodrigues','Almeida','Pereira','Machado','Barbosa','Carvalho','Nogueira','Belfort','Cavalcante','Teixeira','Werdum','Moraes','Barroso'],
    nicknames:['The Axe Murderer','The Phenom','The Spider','Shogun','Big Nog','The Natural Born Killer','Pitbull','The Eraser','The Carpenter','The Monster','Jacare','The Maestro','The White Rhino','Durinho'],
    styleWeights:[3,2,1,2,3,6,2,1],
    firstMix:{brazilian:84,'*':16}, lastMix:{brazilian:86,latino:4,'*':10}, nickMix:{brazilian:62,american:18,'*':20},
    flags:{ BR:100 },
  },
  eastern_european: {
    firstNames:['Viktor','Ivan','Kosta','Alexei','Dmitri','Pavel','Ruslan','Artur','Bogdan','Vasili','Yuri','Stepan','Oleg','Roman','Taras','Mykola','Andriy','Sergiy','Vitali','Vladimir','Stanislav','Miroslav'],
    lastNames:['Petrov','Novak','Volkov','Kovalev','Smirnov','Ivanov','Sokolov','Lebedev','Kozlov','Morozov','Popov','Fedorov','Zaitsev','Sobolev','Tarasov','Bogdanov','Makarov','Orlov','Belov','Komarov','Grigoryev','Nikitin'],
    nicknames:['Iron Curtain','The Bear','The Tank','Brickwall','The Machine','The Destroyer','Stone Hands','Ice Blood','The Siberian','The Wolf','Colossus','The Beast','The Engineer','The Anvil','Nighthawk'],
    styleWeights:[2,2,1,1,6,3,3,2],
    firstMix:{eastern_european:96,'*':4}, lastMix:{eastern_european:96,'*':4}, nickMix:{eastern_european:90,american:8,'*':2},
    flags:{ RU:50, UA:38, PL:5, GE:3, CZ:2, RO:2 },
  },
  west_african: {
    firstNames:['Kwame','Chike','Emeka','Segun','Jide','Tunde','Uche','Tobi','Bayo','Kalu','Ade','Taiwo','Kehinde','Babatunde','Oluwaseun','Obinna','Chibuike','Ifeanyi','Chinonso','Nnamdi','Ikenna'],
    lastNames:['Okafor','Williams','Johnson','Adesanya','Usman','Ngannou','Balogun','Adeyemi','Chukwu','Eze','Nwosu','Diallo','Mensah','Asante','Boateng','Appiah','Ofori','Owusu','Antwi'],
    nicknames:['The Predator','The Gorilla','Black Panther','The Lion','The Warrior','Bulldozer','The General','The King','Thunder','Lightning','The Force','Iron Man'],
    styleWeights:[2,3,3,4,2,2,3,2],
    firstMix:{west_african:80,british_irish:6,'*':14}, lastMix:{west_african:78,british_irish:8,american:4,'*':10}, nickMix:{west_african:56,american:16,british_irish:8,'*':20},
    flags:{ NG:52, GH:22, CM:10, SN:9, CI:7 },
  },
  japanese: {
    firstNames:['Ryu','Takashi','Hiroshi','Kenji','Yuki','Makoto','Akira','Ryuki','Daiki','Kazuki','Tatsuya','Shohei','Kentaro','Yusuke','Masashi','Tomohiro','Naoya','Ryoto','Hayato','Shinya','Takanori','Masakazu'],
    lastNames:['Nakamura','Tanaka','Suzuki','Sato','Watanabe','Yamamoto','Kobayashi','Ito','Kato','Yoshida','Yamada','Inoue','Kimura','Hayashi','Matsumoto','Fujita','Gomi','Aoki','Ishida','Horiguchi','Shoji','Saito'],
    nicknames:['The Fireman','The Smasher','The Crusher','Tekken','Judo Man','Ninja','Vicious','The Crocodile','Rolling Thunder','The Boogeyman','Zero','The Typhoon','Dragon','The Assassin'],
    styleWeights:[3,1,1,3,3,5,1,2],
    firstMix:{japanese:92,'*':8}, lastMix:{japanese:92,'*':8}, nickMix:{japanese:56,american:18,'*':26},
    flags:{ JP:100 },
  },
  british_irish: {
    firstNames:['Liam','Finn','Rory','Shane','Declan','Connor','Paddy','Sean','Eoin','Niall','Aidan','Kieran','Brendan','Colm','Tiernan','Fionn','Owen','Ross','Scott','Callum','Hamish','Gregor','Fraser'],
    lastNames:['Walsh','Murphy','Steele','Flynn','Burns','OBrien','McCarthy','Kelly','Sullivan','Ryan','Byrne','Gallagher','OConnor','Donnelly','McGregor','Hardy','Smith','Jones','Evans','Thompson','Brooks'],
    nicknames:['The Notorious','The Count','The Machine','Mad Dog','The Hitman','The Iceman','The Bull','Showstopper','The Warrior','The Beast','The Quiet Man','Bonecrusher','Cobra','Pitbull'],
    styleWeights:[2,4,5,2,2,1,4,2],
    firstMix:{british_irish:82,american:6,'*':12}, lastMix:{british_irish:80,american:6,west_african:4,'*':10}, nickMix:{british_irish:66,american:14,'*':20},
    flags:{ GB:72, IE:28 },
  },
  korean: {
    firstNames:['Doo','Chan','Jun','Yong','Hyung','Sung','Jin','Hwan','Seung','Min','Jae','Tae','Dong','Kang','Soo','Woo','Kwang','Byung','Chul','Hee','Sang','Myung','Young'],
    lastNames:['Kim','Lee','Park','Choi','Jung','Kang','Cho','Yoon','Jang','Im','Han','Oh','Seo','Shin','Kwon','Hwang','Ahn','Song','Hong','Yoo'],
    nicknames:['The Zombie','The Assassin','The Lion','The Dragon','Iron Fist','The Warrior','Thunderfoot','Tiger','The Ironman','The Destroyer','Comet','The Ghost','Black Belt','Stone Hands'],
    styleWeights:[3,1,2,5,4,2,2,3],
    firstMix:{korean:92,'*':8}, lastMix:{korean:92,'*':8}, nickMix:{korean:58,american:16,'*':26},
    flags:{ KR:100 },
  },
  mexican: {
    firstNames:['Canelo','Miguel','Juan','Julio','Salvador','Rodrigo','Marco','Gilberto','Israel','Brandon','Jaime','Oscar','Fernando','Ricardo','Ruben','Cesar','Luis','Alejandro','Eduardo','Antonio','Mario'],
    lastNames:['Alvarez','Garcia','Lopez','Martinez','Morales','Barrera','Marquez','Ruiz','Cotto','Gomez','Fuentes','Espinoza','Vera','Orozco','Guerrero','Zarate','Sanchez','Heredia','Jimenez','Lara','Pineda'],
    nicknames:['El Canelo','La Cobra','El Guerrero','El Terrible','The Aztec Warrior','El Matador','El Vengador','El Zorro','La Bestia Mexicana','El Toro','El Demoledor','Sangre Azteca','El Bronco','El Torito'],
    styleWeights:[2,5,4,2,2,1,6,1],
    firstMix:{mexican:82,latino:16,'*':2}, lastMix:{mexican:80,latino:19,'*':1}, nickMix:{mexican:64,latino:8,american:12,'*':16},
    flags:{ MX:100 },
  },
  vintage: {
    firstNames:FIRST_NAMES, lastNames:LAST_NAMES, nicknames:NICKNAMES,
    styleWeights:[4,3,3,3,3,3,3,3],
    firstMix:{vintage:100}, lastMix:{vintage:100}, nickMix:{vintage:100},
    flags:{ US:55, GB:12, BR:10, MX:8, RU:8, JP:7 },
  },
};

export const ETHNIC_GROUP_IDS = Object.keys(ETHNIC_GROUPS);

// ── Surname-origin override for appearance ──
// Distinctive Asian (JP/KR) and West-African surnames should drive a fighter's
// look regardless of their generated ethnicity. Pan-ethnic surnames that also
// read as Western (Lee, Park, Williams, Johnson…) are excluded so they don't
// wrongly override.
const _SURNAME_EXCLUDE = new Set(['lee', 'park', 'song', 'williams', 'johnson']);
const _lc = s => s.toLowerCase();
const _ASIAN_SURNAMES = new Set(
  [...ETHNIC_GROUPS.japanese.lastNames, ...ETHNIC_GROUPS.korean.lastNames]
    .map(_lc).filter(n => !_SURNAME_EXCLUDE.has(n))
);
const _WAFRICAN_SURNAMES = new Set(
  ETHNIC_GROUPS.west_african.lastNames.map(_lc).filter(n => !_SURNAME_EXCLUDE.has(n))
);

/** Appearance origin implied by a (distinctive) surname, else null. */
export function surnameLookOverride(fullName) {
  if (!fullName) return null;
  const ln = String(fullName).split(' ').pop().toLowerCase();
  if (_WAFRICAN_SURNAMES.has(ln)) return 'west_african';
  if (_ASIAN_SURNAMES.has(ln))    return 'japanese'; // JP/KR share an appearance spread
  return null;
}

// FIGHT_STYLES id → closest FIGHTER_PROFILES key for NPC style assignment.
export const STYLE_ID_TO_PROFILE = {
  allrounder:'All-rounder', brawler:'Unorthodox brawler', boxer:'Boxer', kickboxer:'Kickboxer',
  wrestler:'Wrestler/GnP', submission:'Submission hunter', pressure:'Pressure fighter', sniper:'Counter-striker',
};

const STYLE_ID_ORDER = ['allrounder','brawler','boxer','kickboxer','wrestler','submission','pressure','sniper'];

// Pick a key from { key: weight }, weighted. Keys with higher weight chosen more often.
export function weightedPick(d) {
  const ks = Object.keys(d);
  const t  = ks.reduce((s, k) => s + d[k], 0);
  let r = Math.random() * t;
  for (const k of ks) { r -= d[k]; if (r <= 0) return k; }
  return ks[ks.length - 1];
}

// Which ethnic GROUP a fighter belongs to, from a region/tier distribution.
// null/empty → uniform across all groups.
export function pickEthnicGroup(dist) {
  if (dist && Object.keys(dist).length) return weightedPick(dist);
  return ETHNIC_GROUP_IDS[Math.floor(Math.random() * ETHNIC_GROUP_IDS.length)];
}

// Which BANK a name part is sourced from, via that part's mix. '*' → any group.
function resolveSourceGroup(id, mixKey) {
  const mix = ETHNIC_GROUPS[id]?.[mixKey];
  if (!mix) return id;
  const picked = weightedPick(mix);
  return picked === '*'
    ? ETHNIC_GROUP_IDS[Math.floor(Math.random() * ETHNIC_GROUP_IDS.length)]
    : picked;
}

const pickFrom = a => a[Math.floor(Math.random() * a.length)];

// Build a name; each part rolls its own source group independently. nick may be null.
export function pickFighterName(id) {
  const fn = pickFrom((ETHNIC_GROUPS[resolveSourceGroup(id, 'firstMix')] || ETHNIC_GROUPS.vintage).firstNames);
  const ln = pickFrom((ETHNIC_GROUPS[resolveSourceGroup(id, 'lastMix')]  || ETHNIC_GROUPS.vintage).lastNames);
  let nick = null;
  if (Math.random() > 0.5) nick = pickFrom((ETHNIC_GROUPS[resolveSourceGroup(id, 'nickMix')] || ETHNIC_GROUPS.vintage).nicknames);
  return { fn, ln, nick };
}

// Roll a FIGHT_STYLES id biased by the group's styleWeights.
export function pickFightStyleForEthnicity(id) {
  const w = (ETHNIC_GROUPS[id] || ETHNIC_GROUPS.vintage).styleWeights;
  const t = w.reduce((s, x) => s + x, 0);
  let r = Math.random() * t;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return STYLE_ID_ORDER[i]; }
  return 'allrounder';
}

// NPC nationality — curated per generator. Returns { iso, flag, name }.
export function pickNationality(id) {
  const flags = (ETHNIC_GROUPS[id] || ETHNIC_GROUPS.vintage).flags;
  const iso = weightedPick(flags);
  return { iso, flag: isoToFlag(iso), name: countryName(iso) };
}
