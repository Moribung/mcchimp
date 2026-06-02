/**
 * src/lib/mma/regions.js
 * ─────────────────────────────────────────
 * Phase-1 regions + their promotions, and the higher-tier ethnic spreads.
 *
 *  - REGIONS: each Phase-1 catchment has an ethnicDistribution (weights over ethnic
 *    group ids from names.js, plus a '*' wildcard share and small `vintage`). Drives
 *    which ethnicities populate that region's division.
 *  - REGIONAL_PROMOTIONS: the funny/appropriate Phase-1 org for each region.
 *  - TIER_ETHNIC_SPREADS: editable per-promotion spreads for Phase 2/3. `gfl` sums to
 *    100 so `vintage` is exactly 1%.
 *
 * Pure data. No imports (region ids are plain strings; ethnic group ids match names.js).
 */

export const REGIONS = {
  southeast_usa:  { label:'Southeast USA', promotionId:'dixie_cage',     ethnicDistribution:{ american:68, west_african:2, latino:16, british_irish:5, vintage:5, '*':4 } },
  texas:          { label:'Texas',          promotionId:'lone_star',      ethnicDistribution:{ american:43, mexican:28, latino:20, west_african:1, vintage:4, '*':4 } },
  california:     { label:'California',      promotionId:'west_coast_wars',ethnicDistribution:{ american:37, mexican:22, latino:14, korean:10, japanese:6, west_african:1, vintage:4, '*':6 } },
  new_york:       { label:'New York / NE',   promotionId:'tri_state_fc',   ethnicDistribution:{ american:45, west_african:1, latino:20, british_irish:12, eastern_european:12, vintage:4, '*':6 } },
  midwest_usa:    { label:'Midwest USA',     promotionId:'heartland_mma',  ethnicDistribution:{ american:70, eastern_european:12, latino:8, vintage:5, '*':5 } },
  florida:        { label:'Florida',          promotionId:'sunshine_combat',ethnicDistribution:{ american:38, latino:34, west_african:4, brazilian:8, vintage:4, '*':12 } },
  mexico:         { label:'Mexico',           promotionId:'guerreros_mx',   ethnicDistribution:{ mexican:64, latino:24, american:6, '*':6 } },
  brazil:         { label:'Brazil',           promotionId:'favela_fc',      ethnicDistribution:{ brazilian:80, latino:12, '*':8 } },
  uk_ireland:     { label:'UK & Ireland',     promotionId:'cockney_carnage',ethnicDistribution:{ british_irish:64, west_african:14, eastern_european:10, american:6, '*':6 } },
  eastern_europe: { label:'Eastern Europe',   promotionId:'iron_curtain_fc',ethnicDistribution:{ eastern_european:83, british_irish:6, american:6, '*':5 } },
  japan:          { label:'Japan',            promotionId:'rising_sun_fc',  ethnicDistribution:{ japanese:74, korean:14, american:4, '*':8 } },
  korea:          { label:'South Korea',      promotionId:'seoul_smash',    ethnicDistribution:{ korean:76, japanese:10, american:6, '*':8 } },
  west_africa:    { label:'West Africa',      promotionId:'naija_throwdown',ethnicDistribution:{ west_african:90, british_irish:1, american:1, '*':8 } },
};
export const REGION_IDS = Object.keys(REGIONS);

export const REGIONAL_PROMOTIONS = {
  dixie_cage:      { name:'Dixie Cage Fighting',             regionId:'southeast_usa', tagline:"Where the South settles things." },
  lone_star:       { name:'Lone Star Combat',                regionId:'texas',          tagline:"Everything's bigger in Texas — especially the knockouts." },
  west_coast_wars: { name:'West Coast Wars',                 regionId:'california',     tagline:"Sun, sand, and broken jaws." },
  tri_state_fc:    { name:'Tri-State Fighting Championship', regionId:'new_york',       tagline:"Five boroughs. One cage." },
  heartland_mma:   { name:'Heartland MMA',                   regionId:'midwest_usa',    tagline:"No frills. Just fights." },
  sunshine_combat: { name:'Sunshine Combat Championship',    regionId:'florida',        tagline:"Hot fights. Hotter weather." },
  guerreros_mx:    { name:'Guerreros MX',                    regionId:'mexico',         tagline:"La tierra de los guerreros." },
  favela_fc:       { name:'Favela FC',                       regionId:'brazil',         tagline:"Born in the favela. Built for the cage." },
  cockney_carnage: { name:'Cockney Carnage',                 regionId:'uk_ireland',     tagline:"Bovver boots not required — but appreciated." },
  iron_curtain_fc: { name:'Iron Curtain FC',                 regionId:'eastern_europe', tagline:"Cold blood. Hot fights." },
  rising_sun_fc:   { name:'Rising Sun FC',                   regionId:'japan',          tagline:"Honour. Skill. Submission." },
  seoul_smash:     { name:'Seoul Smash',                     regionId:'korea',          tagline:"K-pop is out. K-punch is in." },
  naija_throwdown: { name:'Naija Throwdown',                 regionId:'west_africa',    tagline:"Lagos rugged. Cage tested." },
};
export const REGIONAL_PROMOTION_IDS = Object.keys(REGIONAL_PROMOTIONS);

// Default spread for the generic "Regional FC" fallback (no region selected).
export const REGIONAL_FC_DIST = { vintage: 90, american: 4, british_irish: 3, latino: 3 };

// Higher-tier ethnic spreads (editable). `gfl` sums to 100 → vintage is exactly 1%.
export const TIER_ETHNIC_SPREADS = {
  apex: { japanese:16, korean:14, eastern_european:20, british_irish:14, brazilian:8, american:10, latino:6, mexican:6, west_african:6, vintage:3 },
  kfc:  { american:22, mexican:16, latino:16, brazilian:16, west_african:10, british_irish:8, eastern_european:6, japanese:3, korean:3, vintage:4 },
  gfl:  { american:15, brazilian:14, mexican:12, latino:12, british_irish:12, eastern_european:12, west_african:10, japanese:6, korean:6, vintage:1 },
};

// Map a Phase-2 promo name (PHASE2_OPTIONS) to a tier-spread key.
export function phase2SpreadKey(promoName) {
  if (!promoName) return 'gfl';
  if (promoName.startsWith('Apex')) return 'apex';
  if (promoName.startsWith('Kings')) return 'kfc';
  return 'gfl';
}
