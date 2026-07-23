const cache = new Map();

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

export function formatGeocodeResult(data) {
  if (!data) return null;

  const address = data.address || {};
  const englishName = preferEnglishName(data);

  const road = pickAddressPart(address, ['road', 'pedestrian', 'footway', 'residential', 'street']);
  const locality =
    pickAddressPart(address, ['suburb', 'neighbourhood', 'quarter', 'village', 'hamlet', 'city_block'])
    || pickAddressPart(address, ['city_district', 'district', 'county']);
  const city = pickAddressPart(address, ['city', 'town', 'municipality']);
  const region = pickAddressPart(address, ['state', 'region']);

  const parts = [road, locality, city, region].filter(Boolean);
  if (parts.length > 0) {
    const line = parts.join(', ');
    if (englishName && !line.toLowerCase().includes(englishName.toLowerCase())) {
      return `${englishName}, ${line}`;
    }
    return line;
  }

  if (englishName) return englishName;

  if (data.display_name) {
    return data.display_name.split(',').slice(0, 3).join(', ').trim();
  }

  return null;
}

/** Reverse geocode lat/lng → human-readable place name (OpenStreetMap Nominatim) */
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
        'User-Agent': 'AntiTamperSmartDelivery/1.0',
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
