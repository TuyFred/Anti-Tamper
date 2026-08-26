import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/** Fly map to a point when trigger changes (GPS button click) */
export default function FlyToPoint({ lat, lng, trigger, zoom = 16 }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lng == null || !trigger) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), zoom), { duration: 0.75 });
  }, [lat, lng, trigger, zoom, map]);
  return null;
}
