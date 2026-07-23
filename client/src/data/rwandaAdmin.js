/**
 * Rwanda administrative divisions — Province → District → Sector → Cell → Village
 * Run supabase/rwanda-locations.sql to mirror this in the database.
 */

export const RWANDA_PROVINCES = [
  'City of Kigali',
  'Eastern Province',
  'Northern Province',
  'Southern Province',
  'Western Province',
];

/** @type {Record<string, Record<string, Record<string, Record<string, string[]>>>>} */
export const RWANDA_ADMIN = {
  'City of Kigali': {
    Gasabo: {
      Kimironko: {
        Kibagabaga: ['Ubumwe', 'Amahoro', 'Nyagatovu', 'Kabeza'],
        'Bibare': ['Umucyo', 'Urugwiro', 'Ihuriro'],
      },
      Remera: {
        Rukiri: ['Amahoro', 'Ubumwe', 'Icyizere'],
        Nyabisindu: ['Urugwiro', 'Umubano', 'Indatwa'],
      },
      Kacyiru: {
        Kamatamu: ['Ubumwe', 'Amahoro', 'Indatwa'],
        Kigabiro: ['Icyizere', 'Umubano', 'Urugwiro'],
      },
      Gisozi: {
        Murama: ['Ubumwe', 'Amahoro'],
        Musezero: ['Indatwa', 'Icyizere'],
      },
      Rusororo: {
        Rusororo: ['Ubumwe', 'Amahoro', 'Umubano'],
      },
    },
    Kicukiro: {
      Kicukiro: {
        Ngoma: ['Ubumwe', 'Amahoro', 'Indatwa'],
        Gatenga: ['Icyizere', 'Umubano'],
      },
      Gikondo: {
        Kanserege: ['Ubumwe', 'Amahoro'],
        Rubirizi: ['Indatwa', 'Icyizere'],
      },
      Kanombe: {
        Busanza: ['Ubumwe', 'Amahoro'],
        Nyarugunga: ['Umubano', 'Indatwa'],
      },
      Niboye: {
        Niboye: ['Ubumwe', 'Amahoro', 'Icyizere'],
      },
    },
    Nyarugenge: {
      Nyarugenge: {
        'Nyamirambo': ['Ubumwe', 'Amahoro', 'Indatwa'],
        Biryogo: ['Icyizere', 'Umubano'],
      },
      Muhima: {
        Muhima: ['Ubumwe', 'Amahoro'],
        Nyabugogo: ['Indatwa', 'Icyizere'],
      },
      Kimisagara: {
        Kimisagara: ['Ubumwe', 'Amahoro', 'Umubano'],
      },
      Mageragere: {
        Mageragere: ['Ubumwe', 'Amahoro', 'Indatwa'],
      },
    },
  },
  'Eastern Province': {
    Bugesera: {
      Nyamata: { Nyamata: ['Nyamata I', 'Nyamata II', 'Ubumwe'] },
      Ruhuha: { Ruhuha: ['Ubumwe', 'Amahoro'] },
    },
    Rwamagana: {
      Rwamagana: { Rwamagana: ['Ubumwe', 'Amahoro', 'Indatwa'] },
      Karenge: { Karenge: ['Ubumwe', 'Icyizere'] },
    },
    Kayonza: {
      Kayonza: { Kayonza: ['Ubumwe', 'Amahoro'] },
      Mwiri: { Mwiri: ['Indatwa', 'Umubano'] },
    },
    Ngoma: {
      Kibungo: { Kibungo: ['Ubumwe', 'Amahoro'] },
    },
    Kirehe: {
      Kirehe: { Kirehe: ['Ubumwe', 'Amahoro'] },
    },
    Nyagatare: {
      Nyagatare: { Nyagatare: ['Ubumwe', 'Amahoro', 'Indatwa'] },
    },
    Gatsibo: {
      Gatsibo: { Gatsibo: ['Ubumwe', 'Amahoro'] },
    },
  },
  'Northern Province': {
    Musanze: {
      Muhoza: { Muhoza: ['Ubumwe', 'Amahoro', 'Indatwa'] },
      Kinigi: { Kinigi: ['Ubumwe', 'Icyizere'] },
    },
    Burera: {
      Bungwe: { Bungwe: ['Ubumwe', 'Amahoro'] },
    },
    Gakenke: {
      Gakenke: { Gakenke: ['Ubumwe', 'Amahoro'] },
    },
    Gicumbi: {
      Byumba: { Byumba: ['Ubumwe', 'Amahoro'] },
    },
    Rulindo: {
      Rulindo: { Rulindo: ['Ubumwe', 'Amahoro'] },
    },
  },
  'Southern Province': {
    Huye: {
      Ngoma: { Ngoma: ['Ubumwe', 'Amahoro', 'Indatwa'] },
      Tumba: { Tumba: ['Ubumwe', 'Icyizere'] },
    },
    Muhanga: {
      Muhanga: { Muhanga: ['Ubumwe', 'Amahoro'] },
    },
    Nyanza: {
      Nyanza: { Nyanza: ['Ubumwe', 'Amahoro'] },
    },
    Kamonyi: {
      Kamonyi: { Kamonyi: ['Ubumwe', 'Amahoro'] },
    },
    Ruhango: {
      Ruhango: { Ruhango: ['Ubumwe', 'Amahoro'] },
    },
    Gisagara: {
      Gisagara: { Gisagara: ['Ubumwe', 'Amahoro'] },
    },
    Nyamagabe: {
      Nyamagabe: { Nyamagabe: ['Ubumwe', 'Amahoro'] },
    },
    Nyaruguru: {
      Nyaruguru: { Nyaruguru: ['Ubumwe', 'Amahoro'] },
    },
  },
  'Western Province': {
    Rubavu: {
      Gisenyi: { Gisenyi: ['Ubumwe', 'Amahoro', 'Indatwa'] },
    },
    Rusizi: {
      Kamembe: { Kamembe: ['Ubumwe', 'Amahoro'] },
    },
    Karongi: {
      Karongi: { Karongi: ['Ubumwe', 'Amahoro'] },
    },
    Rutsiro: {
      Rutsiro: { Rutsiro: ['Ubumwe', 'Amahoro'] },
    },
    Nyabihu: {
      Nyabihu: { Nyabihu: ['Ubumwe', 'Amahoro'] },
    },
    Nyamasheke: {
      Nyamasheke: { Nyamasheke: ['Ubumwe', 'Amahoro'] },
    },
    Ngororero: {
      Ngororero: { Ngororero: ['Ubumwe', 'Amahoro'] },
    },
  },
};

/** Common roads / streets by province (extend as needed) */
export const RWANDA_ROADS = {
  'City of Kigali': [
    'KN 3 Rd', 'KN 4 Ave', 'KK 15 Ave', 'KG 11 Ave', 'KK 737 St',
    'Airport Road', 'CHIC Complex Road', 'Kigali Heights Road',
    'Sonatubes Road', 'Remera Road', 'Kimironko Road', 'Nyabugogo Road',
    'Other — type below',
  ],
  default: ['Main Road', 'District Road', 'Cell Road', 'Other — type below'],
};

export function getDistricts(province) {
  const data = RWANDA_ADMIN[province];
  return data ? Object.keys(data).sort() : [];
}

export function getSectors(province, district) {
  const data = RWANDA_ADMIN[province]?.[district];
  return data ? Object.keys(data).sort() : [];
}

export function getCells(province, district, sector) {
  const data = RWANDA_ADMIN[province]?.[district]?.[sector];
  return data ? Object.keys(data).sort() : [];
}

export function getVillages(province, district, sector, cell) {
  const list = RWANDA_ADMIN[province]?.[district]?.[sector]?.[cell];
  return list ? [...list].sort() : [];
}

export function getRoadOptions(province) {
  return RWANDA_ROADS[province] || RWANDA_ROADS.default;
}

export function resetBelow(value, level) {
  const next = { ...value };
  if (level === 'province') {
    next.district = '';
    next.sector = '';
    next.cell = '';
    next.village = '';
    next.road = '';
  } else if (level === 'district') {
    next.sector = '';
    next.cell = '';
    next.village = '';
    next.road = '';
  } else if (level === 'sector') {
    next.cell = '';
    next.village = '';
    next.road = '';
  } else if (level === 'cell') {
    next.village = '';
    next.road = '';
  }
  return next;
}
