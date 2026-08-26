import { useEffect, useState } from 'react';
import { reverseGeocode, reverseGeocodeDetails, formatAddressLines } from '../lib/geocode';

function roundCoord(value) {
  return value == null ? null : Math.round(value * 10000) / 10000;
}

export function useReverseGeocode(lat, lng) {
  const [placeName, setPlaceName] = useState(null);
  const [address, setAddress] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);

  const latKey = roundCoord(lat);
  const lngKey = roundCoord(lng);

  useEffect(() => {
    if (latKey == null || lngKey == null) {
      setPlaceName(null);
      setAddress(null);
      setLines([]);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      reverseGeocodeDetails(latKey, lngKey),
      reverseGeocode(latKey, lngKey),
    ]).then(([details, name]) => {
      if (cancelled) return;
      setAddress(details);
      setLines(details?.lines?.length ? details.lines : formatAddressLines(details));
      setPlaceName(details?.formatted || name);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [latKey, lngKey]);

  return { placeName, address, lines, loading };
}
