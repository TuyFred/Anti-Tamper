import { useEffect, useState } from 'react';
import { fetchRoadRoute } from '../lib/roadRouting';

export function useRoadRoute(from, to, enabled = true) {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);

  const fromKey = from ? `${from.lat?.toFixed(4)},${from.lng?.toFixed(4)}` : '';
  const toKey = to ? `${to.lat?.toFixed(4)},${to.lng?.toFixed(4)}` : '';

  useEffect(() => {
    if (!enabled || !from?.lat || !from?.lng || !to?.lat || !to?.lng) {
      setRoute(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    fetchRoadRoute(from, to).then((result) => {
      if (!cancelled) {
        setRoute(result);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [enabled, fromKey, toKey]);

  return {
    route,
    loading,
    positions: route?.positions || [],
    distanceKm: route?.distanceKm,
    source: route?.source,
  };
}
