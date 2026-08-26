const EARTH_RADIUS_M = 6371000;

export function distanceMeters(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null || Number.isNaN(v))) return 0;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Bearing in degrees 0–360 (0 = north). */
export function computeBearing(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => ((r * 180) / Math.PI + 360) % 360;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
    - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return toDeg(Math.atan2(y, x));
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function bearingToCompass(deg) {
  if (deg == null || Number.isNaN(deg)) return '—';
  const idx = Math.round(deg / 45) % 8;
  return COMPASS[idx];
}

export function formatSpeedKmh(meters, seconds) {
  if (!seconds || seconds <= 0) return null;
  const kmh = (meters / 1000) / (seconds / 3600);
  if (kmh < 0.5) return null;
  return `${kmh.toFixed(1)} km/h`;
}

/** Offset a point by meters along bearing (for direction arrow placement). */
export function offsetLatLng(lat, lng, bearingDeg, meters = 12) {
  const R = 6378137;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(meters / R)
    + Math.cos(lat1) * Math.sin(meters / R) * Math.cos(brng),
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(brng) * Math.sin(meters / R) * Math.cos(lat1),
    Math.cos(meters / R) - Math.sin(lat1) * Math.sin(lat2),
  );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

export function appendTrailPoint(trails, key, lat, lng, { maxPoints = 150, minMeters = 4 } = {}) {
  if (lat == null || lng == null || !key) return trails;
  const trail = trails[key] || [];
  const last = trail[trail.length - 1];
  if (last) {
    const dist = distanceMeters(last.lat, last.lng, lat, lng);
    if (dist < minMeters) return trails;
  }
  const next = [...trail, { lat, lng, t: Date.now() }];
  const trimmed = next.length > maxPoints ? next.slice(-maxPoints) : next;
  return { ...trails, [key]: trimmed };
}

export function getTrailStats(trail) {
  if (!trail || trail.length < 2) return null;
  const a = trail[trail.length - 2];
  const b = trail[trail.length - 1];
  const bearing = computeBearing(a.lat, a.lng, b.lat, b.lng);
  const dist = distanceMeters(a.lat, a.lng, b.lat, b.lng);
  const seconds = (b.t - a.t) / 1000;
  return {
    bearing,
    compass: bearingToCompass(bearing),
    speed: formatSpeedKmh(dist, seconds),
  };
}
