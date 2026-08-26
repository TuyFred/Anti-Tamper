import { Marker, Polyline } from 'react-leaflet';
import { createDirectionIcon } from '../lib/mapMarkers';
import { computeBearing, offsetLatLng } from '../lib/mapGeo';

/**
 * Live path the device took — shows direction of travel.
 */
export default function DeviceTrailLayer({
  trail = [],
  color = '#3b82f6',
  weight = 4,
  opacity = 0.85,
  showDirection = true,
  dashed = false,
}) {
  if (!trail || trail.length < 2) return null;

  const positions = trail.map((p) => [p.lat, p.lng]);
  const last = trail[trail.length - 1];
  const prev = trail[trail.length - 2];
  const bearing = computeBearing(prev.lat, prev.lng, last.lat, last.lng);
  const arrowPos = offsetLatLng(last.lat, last.lng, bearing, 14);

  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{
          color,
          weight,
          opacity,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: dashed ? '6 8' : undefined,
        }}
      />
      {showDirection && (
        <Marker
          position={[arrowPos.lat, arrowPos.lng]}
          icon={createDirectionIcon(bearing, color)}
          zIndexOffset={800}
          interactive={false}
        />
      )}
    </>
  );
}
