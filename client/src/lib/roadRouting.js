import { haversineKm } from './rwandaAddress';

const routeCache = new Map();
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

function cacheKey(a, b) {
  return `${a.lat.toFixed(4)},${a.lng.toFixed(4)}->${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;
}

function decodeRouteGeometry(route) {
  const geom = route?.geometry;
  if (geom?.type === 'LineString' && Array.isArray(geom.coordinates)) {
    return geom.coordinates.map(([lng, lat]) => [lat, lng]);
  }
  if (Array.isArray(route?.legs)) {
    const pts = [];
    for (const leg of route.legs) {
      for (const step of leg.steps || []) {
        const line = step.geometry?.coordinates;
        if (line?.length) {
          for (const [lng, lat] of line) pts.push([lat, lng]);
        }
      }
    }
    if (pts.length >= 2) return pts;
  }
  return null;
}

/**
 * Driving route on real Kigali roads (OpenStreetMap via OSRM).
 * Falls back to straight line + haversine if routing unavailable.
 */
export async function fetchRoadRoute(from, to) {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null;

  const key = cacheKey(from, to);
  if (routeCache.has(key)) return routeCache.get(key);

  const straightKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const fallback = {
    positions: [[from.lat, from.lng], [to.lat, to.lng]],
    distanceKm: Math.max(0.1, Math.round(straightKm * 100) / 100),
    durationMin: null,
    source: 'straight',
  };

  try {
    const url = `${OSRM_BASE}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      routeCache.set(key, fallback);
      return fallback;
    }

    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) {
      routeCache.set(key, fallback);
      return fallback;
    }

    const positions = decodeRouteGeometry(route)
      || [[from.lat, from.lng], [to.lat, to.lng]];
    const distanceKm = Math.max(0.1, Math.round((route.distance / 1000) * 100) / 100);
    const durationMin = route.duration ? Math.round(route.duration / 60) : null;

    const result = {
      positions,
      distanceKm,
      durationMin,
      source: 'road',
    };
    routeCache.set(key, result);
    return result;
  } catch {
    routeCache.set(key, fallback);
    return fallback;
  }
}

export function roadKmOrHaversine(from, to) {
  if (!from || !to) return 5;
  return Math.max(1, Math.round(haversineKm(from.lat, from.lng, to.lat, to.lng) * 100) / 100);
}
