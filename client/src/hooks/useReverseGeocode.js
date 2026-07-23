import { useEffect, useState } from 'react';
import { reverseGeocode } from '../lib/geocode';

export function useReverseGeocode(lat, lng) {
  const [placeName, setPlaceName] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lat == null || lng == null) {
      setPlaceName(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    reverseGeocode(lat, lng).then((name) => {
      if (!cancelled) {
        setPlaceName(name);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [lat, lng]);

  return { placeName, loading };
}
