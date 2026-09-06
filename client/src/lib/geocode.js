import { getApiBaseUrl } from './runtimeConfig';

const cache = new Map();

/** Approximate bounding box for Rwanda */
export const RWANDA_BOUNDS = {
  latMin: -2.84,
  latMax: -1.05,
  lngMin: 28.86,
  lngMax: 30.92,
};

export function isInRwanda(lat, lng) {
  if (lat == null || lng == null) return false;
  return lat >= RWANDA_BOUNDS.latMin && lat <= RWANDA_BOUNDS.latMax
    && lng >= RWANDA_BOUNDS.lngMin && lng <= RWANDA_BOUNDS.lngMax;
}

/** Reject Paris/test coords — box GPS must be inside Rwanda */
export function isValidBoxGps(lat, lng) {
  return isInRwanda(lat, lng);
}

export function sanitizeDeviceCoords(device) {
  if (!device) return device;
  if (!isValidBoxGps(device.latitude, device.longitude)) {
    return { ...device, latitude: null, longitude: null };
  }
  return device;
}

/** Default map centre — Kigali Convention Centre / Kacyiru (City of Kigali) */
export const KIGALI_CENTER = [-1.9536, 30.0946];

/** Landmarks & sector centres — map pins, address fallback */
export const KIGALI_SECTOR_COORDS = [
  { district: 'Gasabo', sector: 'Kacyiru', lat: -1.9536, lng: 30.0946, landmark: 'Kigali Convention Centre' },
  { district: 'Gasabo', sector: 'Gisozi', lat: -1.9285, lng: 30.0625, landmark: 'University of Kigali' },
  { district: 'Gasabo', sector: 'Kimironko', lat: -1.9594, lng: 30.1045 },
  { district: 'Gasabo', sector: 'Remera', lat: -1.9496, lng: 30.0946 },
  { district: 'Gasabo', sector: 'Kacyiru', lat: -1.9365, lng: 30.0723 },
  { district: 'Gasabo', sector: 'Gisozi', lat: -1.9280, lng: 30.0950 },
  { district: 'Gasabo', sector: 'Rusororo', lat: -1.9120, lng: 30.1180 },
  { district: 'Kicukiro', sector: 'Kanombe', lat: -1.9686, lng: 30.1395 },
  { district: 'Kicukiro', sector: 'Kicukiro', lat: -1.9896, lng: 30.1128 },
  { district: 'Kicukiro', sector: 'Gikondo', lat: -1.9700, lng: 30.0780 },
  { district: 'Kicukiro', sector: 'Niboye', lat: -1.9950, lng: 30.0950 },
  { district: 'Nyarugenge', sector: 'Nyarugenge', lat: -1.9403, lng: 30.0580 },
  { district: 'Nyarugenge', sector: 'Muhima', lat: -1.9403, lng: 30.0444 },
  { district: 'Nyarugenge', sector: 'Kimisagara', lat: -1.9700, lng: 30.0400 },
  { district: 'Nyarugenge', sector: 'Mageragere', lat: -1.9850, lng: 30.0150 },
];

function haversineKmLocal(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Nearest Kigali sector for coords — accurate Kimironko vs Kanombe labels */
export function resolveNearestKigaliSector(lat, lng) {
  if (!isInRwanda(lat, lng)) return null;
  let best = null;
  let bestKm = Infinity;
  for (const s of KIGALI_SECTOR_COORDS) {
    const km = haversineKmLocal(lat, lng, s.lat, s.lng);
    if (km < bestKm) {
      bestKm = km;
      best = { ...s, distanceKm: km };
    }
  }
  if (!best || bestKm > 6) return null;
  return best;
}

export function formatKigaliSectorPlace(sectorInfo, addrParts = {}) {
  if (!sectorInfo) return null;
  const bits = [
    addrParts.road,
    addrParts.village,
    addrParts.cell,
    sectorInfo.sector,
    sectorInfo.district,
    'City of Kigali',
    'Rwanda',
  ].filter(Boolean);
  const unique = bits.filter((p, i, arr) => arr.indexOf(p) === i);
  return unique.join(', ');
}

/** Map pin from Rwanda address fields when user has not tapped the map yet */
export function coordsFromRwandaAddress(addr) {
  if (!addr?.sector || !addr?.district) return null;
  const match = KIGALI_SECTOR_COORDS.find(
    (s) => s.sector === addr.sector && s.district === addr.district,
  );
  if (!match) return null;
  return { lat: match.lat, lng: match.lng };
}

function cacheKey(lat, lng) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function pickAddressPart(address, keys) {
  for (const key of keys) {
    if (address?.[key]) return address[key];
  }
  return null;
}

function preferEnglishName(data) {
  const namedetails = data?.namedetails || {};
  if (namedetails['name:en']) return namedetails['name:en'];
  if (data?.address?.['name:en']) return data.address['name:en'];
  if (data?.name && /^[\x00-\x7F\s,.-]+$/.test(data.name)) return data.name;
  return null;
}

/** Rwanda admin hierarchy — sector, district, province (English labels from OSM). */
function formatRwandaGeocodeResult(data) {
  const address = data?.address || {};
  const country = address.country;
  if (country !== 'Rwanda') return null;

  const province = pickAddressPart(address, ['state', 'region']);
  const district = pickAddressPart(address, ['county', 'city_district', 'district', 'municipality']);
  const sector = pickAddressPart(address, ['suburb', 'city_block', 'borough']);
  const cell = pickAddressPart(address, ['neighbourhood', 'quarter', 'residential']);
  const village = pickAddressPart(address, ['village', 'hamlet', 'locality']);
  const road = pickAddressPart(address, ['road', 'pedestrian', 'footway', 'residential', 'street']);

  const adminParts = [village, cell, sector, district, province]
    .filter(Boolean)
    .filter((part, i, arr) => arr.indexOf(part) === i);

  let line = adminParts.join(', ');
  if (road && line && !line.toLowerCase().includes(road.toLowerCase())) {
    line = `${road}, ${line}`;
  } else if (road && !line) {
    line = road;
  }

  if (!line) {
    const englishName = preferEnglishName(data);
    line = englishName || 'Rwanda';
  }

  if (!line.endsWith('Rwanda')) {
    line = `${line}, Rwanda`;
  }

  return line;
}

export function formatGeocodeResult(data) {
  if (!data) return null;

  const rwanda = formatRwandaGeocodeResult(data);
  if (rwanda) return rwanda;

  const address = data.address || {};
  const englishName = preferEnglishName(data);

  const road = pickAddressPart(address, ['road', 'pedestrian', 'footway', 'residential', 'street']);
  const locality =
    pickAddressPart(address, ['suburb', 'neighbourhood', 'quarter', 'village', 'hamlet', 'city_block'])
    || pickAddressPart(address, ['city_district', 'district', 'county']);
  const city = pickAddressPart(address, ['city', 'town', 'municipality']);
  const region = pickAddressPart(address, ['state', 'region']);
  const country = address.country;

  const parts = [road, locality, city, region, country].filter(Boolean);
  if (parts.length > 0) {
    const unique = parts.filter((p, i, arr) => arr.indexOf(p) === i);
    const line = unique.join(', ');
    if (englishName && !line.toLowerCase().includes(englishName.toLowerCase())) {
      return `${englishName}, ${line}`;
    }
    return line;
  }

  if (englishName) return englishName;

  if (data.display_name) {
    return data.display_name.split(',').slice(0, 4).join(', ').trim();
  }

  return null;
}

/** Human-readable live location line for Rwanda GPS readouts. */
export function formatLiveLocationSummary(placeName, lat, lng) {
  if (placeName) return placeName;
  const sector = resolveNearestKigaliSector(lat, lng);
  if (sector) return formatKigaliSectorPlace(sector);
  if (isInRwanda(lat, lng)) {
    return `Live GPS coordinates in Rwanda (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`;
  }
  return `Live GPS (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`;
}

/** Structured Rwanda address for map overlays (street, cell, sector, district, country). */
export function formatAddressLines(details) {
  if (!details) return [];
  if (Array.isArray(details.lines) && details.lines.length) return details.lines;
  const lines = [];
  if (details.road) lines.push(details.road);
  const adminParts = [
    details.village && `Village ${details.village}`,
    details.cell && `Cell ${details.cell}`,
    details.sector && `Sector ${details.sector}`,
    details.district && `District ${details.district}`,
    details.province,
    details.country || 'Rwanda',
  ].filter(Boolean);
  if (adminParts.length) lines.push(adminParts.join(' · '));
  return lines;
}

function parseOsmToDetails(data, lat, lng) {
  const address = data?.address || {};
  const localSector = resolveNearestKigaliSector(lat, lng);

  let road = pickAddressPart(address, ['road', 'pedestrian', 'footway', 'residential', 'street', 'path']);
  let village = pickAddressPart(address, ['village', 'hamlet', 'locality']);
  let cell = pickAddressPart(address, ['neighbourhood', 'quarter', 'residential']);
  let sector = pickAddressPart(address, ['suburb', 'city_block', 'borough']) || localSector?.sector;
  let district = pickAddressPart(address, ['county', 'city_district', 'district', 'municipality'])
    || localSector?.district;
  let province = pickAddressPart(address, ['state', 'region']) || 'City of Kigali';
  const country = address.country || 'Rwanda';

  if (!road) {
    const englishName = preferEnglishName(data);
    if (englishName) road = englishName;
  }

  const details = { road, village, cell, sector, district, province, country };
  details.lines = formatAddressLines(details);
  details.formatted = details.lines.join(', ')
    || formatLiveLocationSummary(null, lat, lng);
  return details;
}

/** Reverse geocode → structured address (API proxy first, OSM fallback). */
export async function reverseGeocodeDetails(lat, lng) {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  const key = `d:${cacheKey(lat, lng)}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const apiUrl = `${getApiBaseUrl()}/api/locations/reverse?lat=${lat}&lng=${lng}`;
    const res = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      const details = {
        road: data.road,
        village: data.village,
        cell: data.cell,
        sector: data.sector,
        district: data.district,
        province: data.province,
        country: data.country || 'Rwanda',
        lines: data.lines || formatAddressLines(data),
        formatted: data.formatted || data.lines?.join(', '),
      };
      cache.set(key, details);
      return details;
    }
  } catch {
    /* fall through to direct OSM */
  }

  try {
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
        'User-Agent': 'AntiTamperSmartDelivery/1.0 (Rwanda)',
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const details = parseOsmToDetails(data, lat, lng);
    cache.set(key, details);
    return details;
  } catch {
    const localSector = resolveNearestKigaliSector(lat, lng);
    if (localSector) {
      const details = {
        sector: localSector.sector,
        district: localSector.district,
        province: 'City of Kigali',
        country: 'Rwanda',
      };
      details.lines = formatAddressLines(details);
      details.formatted = details.lines.join(', ');
      return details;
    }
    return null;
  }
}

/** Reverse geocode lat/lng → human-readable place name (OpenStreetMap Nominatim, English). */
export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  const key = cacheKey(lat, lng);
  if (cache.has(key)) return cache.get(key);

  const details = await reverseGeocodeDetails(lat, lng);
  const name = details?.formatted || null;
  if (name) cache.set(key, name);
  return name;
}

export function getGpsUpdateForDevice(device, gpsUpdates = {}) {
  if (!device || !gpsUpdates) return null;
  if (device.id && gpsUpdates[device.id]) return gpsUpdates[device.id];
  if (device.device_id && gpsUpdates[`hw:${device.device_id}`]) {
    return gpsUpdates[`hw:${device.device_id}`];
  }
  return null;
}

/** True when GPS was updated recently (live hardware fix). */
export function isLocationFresh(lastSeen, maxAgeMs = 120000) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < maxAgeMs;
}

export function resolveLiveDevice(devices, gpsUpdates, { uuid, hardwareId } = {}) {
  let device = null;
  if (uuid) device = devices.find((d) => d.id === uuid);
  if (!device && hardwareId) {
    device = devices.find((d) => d.device_id === hardwareId);
  }
  return device ? mergeDeviceWithGps(device, gpsUpdates) : null;
}

/**
 * Box map position — only from live socket feed or recent hardware GPS.
 * Never falls back to phone/laptop location or stale DB coordinates.
 */
export function getLiveMapPosition(device, gpsUpdates = {}, { maxAgeMs = 120000 } = {}) {
  if (!device) return null;

  const update = getGpsUpdateForDevice(device, gpsUpdates);
  if (update?.latitude != null && update?.longitude != null && isValidBoxGps(update.latitude, update.longitude)) {
    return {
      lat: update.latitude,
      lng: update.longitude,
      last_seen: update.timestamp || new Date().toISOString(),
      source: 'live',
      fresh: true,
    };
  }

  if (
    device.latitude != null
    && device.longitude != null
    && isValidBoxGps(device.latitude, device.longitude)
    && isLocationFresh(device.last_seen, maxAgeMs)
  ) {
    return {
      lat: device.latitude,
      lng: device.longitude,
      last_seen: device.last_seen,
      source: 'hardware',
      fresh: Boolean(device.is_online),
    };
  }

  return null;
}

/** Last known box position for manager fleet maps — includes stale GPS so the map is not empty. */
export function getLastKnownMapPosition(device, gpsUpdates = {}) {
  const live = getLiveMapPosition(device, gpsUpdates, { maxAgeMs: 30 * 60 * 1000 });
  if (live) return live;
  if (
    device?.latitude != null
    && device?.longitude != null
    && isValidBoxGps(device.latitude, device.longitude)
  ) {
    return {
      lat: device.latitude,
      lng: device.longitude,
      last_seen: device.last_seen,
      source: 'stored',
      fresh: false,
    };
  }
  return null;
}

export function mergeDevicesWithGps(devices, gpsUpdates = {}) {
  return (devices || []).map((device) => mergeDeviceWithGps(device, gpsUpdates));
}

export function mergeDeviceWithGps(device, gpsUpdates = {}) {
  if (!device) return null;

  const update = getGpsUpdateForDevice(device, gpsUpdates);
  if (update && isValidBoxGps(update.latitude, update.longitude)) {
    return {
      ...device,
      latitude: update.latitude,
      longitude: update.longitude,
      last_seen: update.timestamp || device.last_seen,
      is_online: true,
    };
  }

  const pos = getLiveMapPosition(device, gpsUpdates);
  if (pos) {
    return {
      ...device,
      latitude: pos.lat,
      longitude: pos.lng,
    };
  }

  return {
    ...device,
    latitude: null,
    longitude: null,
  };
}
