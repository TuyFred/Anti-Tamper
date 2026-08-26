/** Rwanda bounding box for Smart Box GPS validation */
export const RWANDA_BOUNDS = {
  latMin: -2.84,
  latMax: -1.05,
  lngMin: 28.86,
  lngMax: 30.92,
};

export function isValidRwandaGps(lat, lng) {
  if (lat == null || lng == null) return false;
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la < RWANDA_BOUNDS.latMin || la > RWANDA_BOUNDS.latMax) return false;
  if (lo < RWANDA_BOUNDS.lngMin || lo > RWANDA_BOUNDS.lngMax) return false;
  return true;
}

/** Kigali Convention Centre — reference point when box has no valid GPS yet */
export const KIGALI_CONVENTION_CENTER = {
  lat: -1.9536,
  lng: 30.0946,
  label: 'Kigali Convention Centre, City of Kigali',
};
