const cache = new Map();
const CACHE_TTL_MS = 300_000;

function cacheKey(lat, lng) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function pick(address, keys) {
  for (const key of keys) {
    if (address?.[key]) return address[key];
  }
  return null;
}

const KIGALI_SECTORS = [
  { district: 'Gasabo', sector: 'Kimironko', lat: -1.9594, lng: 30.1045 },
  { district: 'Gasabo', sector: 'Remera', lat: -1.9496, lng: 30.0946 },
  { district: 'Gasabo', sector: 'Kacyiru', lat: -1.9365, lng: 30.0723 },
  { district: 'Gasabo', sector: 'Gisozi', lat: -1.9280, lng: 30.0950 },
  { district: 'Kicukiro', sector: 'Kanombe', lat: -1.9686, lng: 30.1395 },
  { district: 'Kicukiro', sector: 'Kicukiro', lat: -1.9896, lng: 30.1128 },
  { district: 'Nyarugenge', sector: 'Nyarugenge', lat: -1.9403, lng: 30.0580 },
];

function nearestKigaliSector(lat, lng) {
  let best = null;
  let bestKm = Infinity;
  for (const s of KIGALI_SECTORS) {
    const dLat = ((s.lat - lat) * Math.PI) / 180;
    const dLng = ((s.lng - lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos((lat * Math.PI) / 180) * Math.cos((s.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (km < bestKm) {
      bestKm = km;
      best = s;
    }
  }
  return bestKm <= 6 ? best : null;
}

export function parseOsmAddress(data, lat, lng) {
  const address = data?.address || {};
  const local = nearestKigaliSector(lat, lng);

  let road = pick(address, ['road', 'pedestrian', 'footway', 'residential', 'street', 'path']);
  let village = pick(address, ['village', 'hamlet', 'locality']);
  let cell = pick(address, ['neighbourhood', 'quarter', 'residential']);
  let sector = pick(address, ['suburb', 'city_block', 'borough']) || local?.sector;
  let district = pick(address, ['county', 'city_district', 'district', 'municipality']) || local?.district;
  let province = pick(address, ['state', 'region']) || 'City of Kigali';
  const country = address.country || 'Rwanda';

  if (!road && data?.name && /^[\x00-\x7F\s,.-]+$/.test(data.name)) {
    road = data.name;
  }

  const lines = [];
  if (road) lines.push(road);
  const adminParts = [
    village && `Village ${village}`,
    cell && `Cell ${cell}`,
    sector && `Sector ${sector}`,
    district && `District ${district}`,
    province,
    country,
  ].filter(Boolean);
  if (adminParts.length) lines.push(adminParts.join(' · '));

  const formatted = lines.join(', ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}, Rwanda`;

  return {
    road,
    village,
    cell,
    sector,
    district,
    province,
    country,
    lines,
    formatted,
  };
}

export async function reverseGeocodeFromOsm(lat, lng) {
  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('namedetails', '1');
  url.searchParams.set('accept-language', 'en');

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'AntiTamperSmartDelivery/1.0 (Rwanda; contact@system.local)',
    },
  });

  if (!res.ok) {
    throw new Error(`Geocode HTTP ${res.status}`);
  }

  const osm = await res.json();
  const data = parseOsmAddress(osm, lat, lng);
  cache.set(key, { at: Date.now(), data });
  return data;
}
