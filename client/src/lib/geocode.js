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

/** Default map centre — Kigali City, Rwanda */
export const KIGALI_CENTER = [-1.9403, 29.8739];

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
  if (isInRwanda(lat, lng)) {
    return `Live GPS coordinates in Rwanda (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`;
  }
  return `Live GPS (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`;
}

/** Reverse geocode lat/lng → human-readable place name (OpenStreetMap Nominatim, English). */
export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  const key = cacheKey(lat, lng);
  if (cache.has(key)) return cache.get(key);

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
    const name = formatGeocodeResult(data);
    cache.set(key, name);
    return name;
  } catch {
    return null;
  }
}

export function mergeDevicesWithGps(devices, gpsUpdates = {}) {
  return devices.map((device) => {
    const update = gpsUpdates[device.id];
    if (!update) return device;

    return {
      ...device,
      latitude: update.latitude,
      longitude: update.longitude,
      last_seen: update.timestamp || device.last_seen,
      is_online: true,
    };
  });
}

export function mergeDeviceWithGps(device, gpsUpdates = {}) {
  if (!device) return null;
  const update = gpsUpdates[device.id];
  if (!update) return device;

  return {
    ...device,
    latitude: update.latitude,
    longitude: update.longitude,
    last_seen: update.timestamp || device.last_seen,
    is_online: true,
  };
}
