const NAME_POOLS = {
  hispanic: {
    first: ['Carlos','Diego','Alejandro','Miguel','Javier','Rodrigo','Andrés','Fernando','Sebastián','Mateo'],
    last:  ['García','Romero','Delgado','Herrera','Mendoza','Castillo','Vargas','Fuentes','Navarro','Reyes'],
  },
  english: {
    first: ['James','Thomas','Jack','Oliver','Harry','George','Charlie','William','Ryan','Luke'],
    last:  ['Williams','Thompson','Harris','Clarke','Walker','Bennett','Harrison','Fletcher','Cooper','Shaw'],
  },
  german: {
    first: ['Lukas','Tobias','Maximilian','Jonas','Florian','Niklas','Moritz','Fabian','Sebastian','Felix'],
    last:  ['Hoffmann','Becker','Schneider','Wagner','Hartmann','Zimmermann','Brauer','Schäfer','Richter','Krause'],
  },
  french: {
    first: ['Antoine','Théo','Lucas','Hugo','Mathieu','Nicolas','Romain','Julien','Pierre','Clément'],
    last:  ['Dupont','Leroy','Bernard','Petit','Girard','Rousseau','Fontaine','Marchand','Lefebvre','Blanchard'],
  },
  italian: {
    first: ['Marco','Luca','Matteo','Lorenzo','Federico','Davide','Simone','Riccardo','Alessandro','Giovanni'],
    last:  ['Ferretti','Conti','Esposito','Marchetti','Rinaldi','Lombardi','Gallo','Mancini','Fabbri','Caruso'],
  },
};

const CLUB_PREFIXES = ['FC','SV','TSV','SC','TSG','VfB','VfL','1. FC','Grün-Weiß','Rot-Weiß','Blau-Weiß','BK'];
const CLUB_TOWNS = [
  'Waldheim','Bergkamp','Steinfeld','Hochburg','Rautal','Grünbach','Schwarzberg','Eisenfeld',
  'Falkenried','Moosbach','Winterberg','Kleefeld','Dorntal','Weißenburg','Hartstein','Blaufeld',
  'Silberbach','Kupfertal','Goldberg','Rosenfeld','Tanndorf','Heidebach','Kaltental','Ulmried',
  'Forbach','Laubach','Erlenstein','Hennbach','Brückfeld','Merkhagen',
];

export function randomName() {
  const keys = Object.keys(NAME_POOLS);
  const pool  = NAME_POOLS[keys[Math.floor(Math.random() * keys.length)]];
  const first = pool.first[Math.floor(Math.random() * pool.first.length)];
  const last  = pool.last[Math.floor(Math.random() * pool.last.length)];
  return `${first} ${last}`;
}

export function randomClubName() {
  const p = CLUB_PREFIXES[Math.floor(Math.random() * CLUB_PREFIXES.length)];
  const t = CLUB_TOWNS[Math.floor(Math.random() * CLUB_TOWNS.length)];
  return `${p} ${t}`;
}
