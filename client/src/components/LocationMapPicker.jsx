import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { KIGALI_CENTER } from '../lib/rwandaAddress';

const pinIcon = (color) => new L.DivIcon({
  className: 'custom-marker',
  html: `<div style="width:28px;height:28px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationMapPicker({
  label,
  position,
  onChange,
  pinColor = '#3b82f6',
  height = '220px',
}) {
  const center = position ? [position.lat, position.lng] : KIGALI_CENTER;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500">{label || 'Click map to pin location'}</p>
      <div className="rounded-xl overflow-hidden border border-border" style={{ height }}>
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={(lat, lng) => onChange({ lat, lng })} />
          {position && (
            <Marker position={[position.lat, position.lng]} icon={pinIcon(pinColor)} />
          )}
        </MapContainer>
      </div>
      {position && (
        <p className="text-[10px] text-slate-500 font-mono">
          {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
