/**
 * src/lib/mma/countries.js
 * ─────────────────────────────────────────
 * Full world country list for the player's "fighting out of" selection.
 *
 *  - `iso`      : ISO 3166-1 alpha-2 code (drives the flag emoji).
 *  - `regionId` : a SUGGESTED region key (see regions.js) used only to default
 *                 the starting promotion. The chosen promotion's region — not the
 *                 country — ultimately drives the Phase-1 NPC ethnic spread.
 *
 * Player flags are independent of NPC flag spreads (names.js): picking a country
 * here never forces NPCs of that nationality to appear.
 */

// ISO 3166-1 alpha-2 → flag emoji via regional indicator symbols.
export function isoToFlag(cc) {
  if (!cc) return '';
  return cc.toUpperCase().replace(/[A-Z]/g, c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65));
}

// Area → suggested-region rules (all overridable in-game):
//   USA → southeast_usa; Canada → new_york.
//   Mexico + Spanish-speaking Latin America → mexico; non-Spanish Caribbean → florida.
//   Brazil → brazil.
//   UK & Ireland → uk_ireland; all other Europe (incl. Russia, Türkiye, Caucasus) → eastern_europe.
//   Japan → japan; Koreas → korea; rest of East/SE Asia & China → japan;
//   South/Central Asia, Middle East, North Africa → eastern_europe.
//   Sub-Saharan Africa → west_africa.
//   Oceania → uk_ireland.
export const COUNTRIES = [
  // ── North America ───────────────────────────────────
  { name:'United States',        iso:'US', regionId:'southeast_usa' },
  { name:'Canada',               iso:'CA', regionId:'new_york' },

  // ── Mexico, Central & South America (Spanish/Portuguese) ──
  { name:'Mexico',               iso:'MX', regionId:'mexico' },
  { name:'Guatemala',            iso:'GT', regionId:'mexico' },
  { name:'Belize',               iso:'BZ', regionId:'mexico' },
  { name:'El Salvador',          iso:'SV', regionId:'mexico' },
  { name:'Honduras',             iso:'HN', regionId:'mexico' },
  { name:'Nicaragua',            iso:'NI', regionId:'mexico' },
  { name:'Costa Rica',           iso:'CR', regionId:'mexico' },
  { name:'Panama',               iso:'PA', regionId:'mexico' },
  { name:'Colombia',             iso:'CO', regionId:'mexico' },
  { name:'Venezuela',            iso:'VE', regionId:'mexico' },
  { name:'Ecuador',              iso:'EC', regionId:'mexico' },
  { name:'Peru',                 iso:'PE', regionId:'mexico' },
  { name:'Bolivia',              iso:'BO', regionId:'mexico' },
  { name:'Paraguay',             iso:'PY', regionId:'mexico' },
  { name:'Chile',                iso:'CL', regionId:'mexico' },
  { name:'Argentina',            iso:'AR', regionId:'mexico' },
  { name:'Uruguay',              iso:'UY', regionId:'mexico' },
  { name:'Brazil',               iso:'BR', regionId:'brazil' },

  // ── Caribbean ───────────────────────────────────────
  { name:'Cuba',                 iso:'CU', regionId:'florida' },
  { name:'Dominican Republic',   iso:'DO', regionId:'florida' },
  { name:'Haiti',                iso:'HT', regionId:'florida' },
  { name:'Jamaica',              iso:'JM', regionId:'florida' },
  { name:'Puerto Rico',          iso:'PR', regionId:'florida' },
  { name:'Trinidad and Tobago',  iso:'TT', regionId:'florida' },
  { name:'Bahamas',              iso:'BS', regionId:'florida' },
  { name:'Barbados',             iso:'BB', regionId:'florida' },

  // ── UK & Ireland ────────────────────────────────────
  { name:'United Kingdom',       iso:'GB', regionId:'uk_ireland' },
  { name:'Ireland',              iso:'IE', regionId:'uk_ireland' },

  // ── Rest of Europe ──────────────────────────────────
  { name:'France',               iso:'FR', regionId:'eastern_europe' },
  { name:'Spain',                iso:'ES', regionId:'eastern_europe' },
  { name:'Portugal',             iso:'PT', regionId:'eastern_europe' },
  { name:'Germany',              iso:'DE', regionId:'eastern_europe' },
  { name:'Netherlands',          iso:'NL', regionId:'eastern_europe' },
  { name:'Belgium',              iso:'BE', regionId:'eastern_europe' },
  { name:'Luxembourg',           iso:'LU', regionId:'eastern_europe' },
  { name:'Switzerland',          iso:'CH', regionId:'eastern_europe' },
  { name:'Austria',              iso:'AT', regionId:'eastern_europe' },
  { name:'Italy',                iso:'IT', regionId:'eastern_europe' },
  { name:'Malta',                iso:'MT', regionId:'eastern_europe' },
  { name:'Greece',               iso:'GR', regionId:'eastern_europe' },
  { name:'Cyprus',               iso:'CY', regionId:'eastern_europe' },
  { name:'Norway',               iso:'NO', regionId:'eastern_europe' },
  { name:'Sweden',               iso:'SE', regionId:'eastern_europe' },
  { name:'Finland',              iso:'FI', regionId:'eastern_europe' },
  { name:'Denmark',              iso:'DK', regionId:'eastern_europe' },
  { name:'Iceland',              iso:'IS', regionId:'eastern_europe' },
  { name:'Poland',               iso:'PL', regionId:'eastern_europe' },
  { name:'Czechia',              iso:'CZ', regionId:'eastern_europe' },
  { name:'Slovakia',             iso:'SK', regionId:'eastern_europe' },
  { name:'Hungary',              iso:'HU', regionId:'eastern_europe' },
  { name:'Romania',              iso:'RO', regionId:'eastern_europe' },
  { name:'Bulgaria',             iso:'BG', regionId:'eastern_europe' },
  { name:'Slovenia',             iso:'SI', regionId:'eastern_europe' },
  { name:'Croatia',              iso:'HR', regionId:'eastern_europe' },
  { name:'Bosnia and Herzegovina', iso:'BA', regionId:'eastern_europe' },
  { name:'Serbia',               iso:'RS', regionId:'eastern_europe' },
  { name:'Montenegro',           iso:'ME', regionId:'eastern_europe' },
  { name:'North Macedonia',      iso:'MK', regionId:'eastern_europe' },
  { name:'Albania',              iso:'AL', regionId:'eastern_europe' },
  { name:'Kosovo',               iso:'XK', regionId:'eastern_europe' },
  { name:'Estonia',              iso:'EE', regionId:'eastern_europe' },
  { name:'Latvia',               iso:'LV', regionId:'eastern_europe' },
  { name:'Lithuania',            iso:'LT', regionId:'eastern_europe' },
  { name:'Belarus',              iso:'BY', regionId:'eastern_europe' },
  { name:'Ukraine',              iso:'UA', regionId:'eastern_europe' },
  { name:'Moldova',              iso:'MD', regionId:'eastern_europe' },
  { name:'Russia',               iso:'RU', regionId:'eastern_europe' },
  { name:'Georgia',              iso:'GE', regionId:'eastern_europe' },
  { name:'Armenia',              iso:'AM', regionId:'eastern_europe' },
  { name:'Azerbaijan',           iso:'AZ', regionId:'eastern_europe' },
  { name:'Türkiye',              iso:'TR', regionId:'eastern_europe' },

  // ── Middle East & North Africa ──────────────────────
  { name:'Israel',               iso:'IL', regionId:'eastern_europe' },
  { name:'Lebanon',              iso:'LB', regionId:'eastern_europe' },
  { name:'Jordan',               iso:'JO', regionId:'eastern_europe' },
  { name:'Syria',                iso:'SY', regionId:'eastern_europe' },
  { name:'Iraq',                 iso:'IQ', regionId:'eastern_europe' },
  { name:'Iran',                 iso:'IR', regionId:'eastern_europe' },
  { name:'Saudi Arabia',         iso:'SA', regionId:'eastern_europe' },
  { name:'United Arab Emirates', iso:'AE', regionId:'eastern_europe' },
  { name:'Qatar',                iso:'QA', regionId:'eastern_europe' },
  { name:'Kuwait',               iso:'KW', regionId:'eastern_europe' },
  { name:'Bahrain',              iso:'BH', regionId:'eastern_europe' },
  { name:'Oman',                 iso:'OM', regionId:'eastern_europe' },
  { name:'Yemen',                iso:'YE', regionId:'eastern_europe' },
  { name:'Egypt',                iso:'EG', regionId:'eastern_europe' },
  { name:'Libya',                iso:'LY', regionId:'eastern_europe' },
  { name:'Tunisia',              iso:'TN', regionId:'eastern_europe' },
  { name:'Algeria',              iso:'DZ', regionId:'eastern_europe' },
  { name:'Morocco',              iso:'MA', regionId:'eastern_europe' },

  // ── Central & South Asia ────────────────────────────
  { name:'Kazakhstan',           iso:'KZ', regionId:'eastern_europe' },
  { name:'Uzbekistan',           iso:'UZ', regionId:'eastern_europe' },
  { name:'Turkmenistan',         iso:'TM', regionId:'eastern_europe' },
  { name:'Kyrgyzstan',           iso:'KG', regionId:'eastern_europe' },
  { name:'Tajikistan',           iso:'TJ', regionId:'eastern_europe' },
  { name:'Afghanistan',          iso:'AF', regionId:'eastern_europe' },
  { name:'Pakistan',             iso:'PK', regionId:'eastern_europe' },
  { name:'India',                iso:'IN', regionId:'eastern_europe' },
  { name:'Nepal',                iso:'NP', regionId:'eastern_europe' },
  { name:'Bangladesh',           iso:'BD', regionId:'eastern_europe' },
  { name:'Sri Lanka',            iso:'LK', regionId:'eastern_europe' },

  // ── East & Southeast Asia ───────────────────────────
  { name:'Japan',                iso:'JP', regionId:'japan' },
  { name:'South Korea',          iso:'KR', regionId:'korea' },
  { name:'North Korea',          iso:'KP', regionId:'korea' },
  { name:'China',                iso:'CN', regionId:'japan' },
  { name:'Taiwan',               iso:'TW', regionId:'japan' },
  { name:'Hong Kong',            iso:'HK', regionId:'japan' },
  { name:'Mongolia',             iso:'MN', regionId:'japan' },
  { name:'Thailand',             iso:'TH', regionId:'japan' },
  { name:'Vietnam',              iso:'VN', regionId:'japan' },
  { name:'Philippines',          iso:'PH', regionId:'japan' },
  { name:'Indonesia',            iso:'ID', regionId:'japan' },
  { name:'Malaysia',             iso:'MY', regionId:'japan' },
  { name:'Singapore',            iso:'SG', regionId:'japan' },
  { name:'Myanmar',              iso:'MM', regionId:'japan' },
  { name:'Cambodia',             iso:'KH', regionId:'japan' },
  { name:'Laos',                 iso:'LA', regionId:'japan' },

  // ── Sub-Saharan Africa ──────────────────────────────
  { name:'Nigeria',              iso:'NG', regionId:'west_africa' },
  { name:'Ghana',                iso:'GH', regionId:'west_africa' },
  { name:'Cameroon',             iso:'CM', regionId:'west_africa' },
  { name:'Senegal',              iso:'SN', regionId:'west_africa' },
  { name:"Côte d'Ivoire",        iso:'CI', regionId:'west_africa' },
  { name:'Mali',                 iso:'ML', regionId:'west_africa' },
  { name:'Guinea',               iso:'GN', regionId:'west_africa' },
  { name:'Benin',                iso:'BJ', regionId:'west_africa' },
  { name:'Togo',                 iso:'TG', regionId:'west_africa' },
  { name:'Burkina Faso',         iso:'BF', regionId:'west_africa' },
  { name:'Niger',                iso:'NE', regionId:'west_africa' },
  { name:'Liberia',              iso:'LR', regionId:'west_africa' },
  { name:'Sierra Leone',         iso:'SL', regionId:'west_africa' },
  { name:'Gambia',               iso:'GM', regionId:'west_africa' },
  { name:'Congo (DRC)',          iso:'CD', regionId:'west_africa' },
  { name:'Congo (Republic)',     iso:'CG', regionId:'west_africa' },
  { name:'Gabon',                iso:'GA', regionId:'west_africa' },
  { name:'Angola',               iso:'AO', regionId:'west_africa' },
  { name:'Kenya',                iso:'KE', regionId:'west_africa' },
  { name:'Uganda',               iso:'UG', regionId:'west_africa' },
  { name:'Tanzania',             iso:'TZ', regionId:'west_africa' },
  { name:'Ethiopia',             iso:'ET', regionId:'west_africa' },
  { name:'Somalia',              iso:'SO', regionId:'west_africa' },
  { name:'Rwanda',               iso:'RW', regionId:'west_africa' },
  { name:'Zambia',               iso:'ZM', regionId:'west_africa' },
  { name:'Zimbabwe',             iso:'ZW', regionId:'west_africa' },
  { name:'Mozambique',           iso:'MZ', regionId:'west_africa' },
  { name:'Botswana',             iso:'BW', regionId:'west_africa' },
  { name:'Namibia',              iso:'NA', regionId:'west_africa' },
  { name:'South Africa',         iso:'ZA', regionId:'west_africa' },
  { name:'Cape Verde',           iso:'CV', regionId:'west_africa' },

  // ── Oceania ─────────────────────────────────────────
  { name:'Australia',            iso:'AU', regionId:'uk_ireland' },
  { name:'New Zealand',          iso:'NZ', regionId:'uk_ireland' },
  { name:'Fiji',                 iso:'FJ', regionId:'uk_ireland' },
  { name:'Papua New Guinea',     iso:'PG', regionId:'uk_ireland' },
  { name:'Samoa',                iso:'WS', regionId:'uk_ireland' },
  { name:'Tonga',                iso:'TO', regionId:'uk_ireland' },
];

// "No flag" option for players who don't want to represent a country.
// iso:'' → no auto-suggested region; flag is a neutral black flag.
export const UNKNOWN_COUNTRY = { name:'Unknown', iso:'', regionId:null, flag:'🏴' };

// Dropdown list shows UNKNOWN_COUNTRY first, then all real countries.
export const COUNTRY_OPTIONS = [UNKNOWN_COUNTRY, ...COUNTRIES];

export const COUNTRY_BY_ISO  = Object.fromEntries(COUNTRIES.map(c => [c.iso, c]));
export const COUNTRY_BY_NAME = Object.fromEntries(COUNTRY_OPTIONS.map(c => [c.name, c]));

export const countryName = iso => COUNTRY_BY_ISO[iso]?.name || iso;
// Flag for a country record: derived from iso, or its literal .flag (Unknown → 🏴).
export const flagFor = c => (c?.iso ? isoToFlag(c.iso) : (c?.flag || ''));
