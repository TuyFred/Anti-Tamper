import { useEffect } from 'react';
import { MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { MapPin, Loader2 } from 'lucide-react';
import L from 'leaflet';
import { KIGALI_CENTER } from '../lib/rwandaAddress';
import { MAP_LABELS } from '../lib/mapConfig';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import AppMapTileLayer from './AppMapTileLayer';

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

function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    }
  }, [position, map]);
  return null;
}

function LocationInfo({ lat, lng }) {
  const { placeName, loading } = useReverseGeocode(lat, lng);

  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface/80 border border-border">
      <MapPin className="w-4 h-4 text-primary-light shrink-0 mt-0.5" />
      <div className="min-w-0">
        {loading && !placeName ? (
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            {MAP_LABELS.resolvingLocation}
          </p>
        ) : (
          <p className="text-xs text-white font-medium leading-snug">
            {placeName || MAP_LABELS.selectedLocation}
          </p>
        )}
        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      </div>
    </div>
  );
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
      <p className="text-[11px] text-slate-500">{label || MAP_LABELS.clickToPin}</p>
      <div className="rounded-xl overflow-hidden border border-border" style={{ height }}>
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <AppMapTileLayer />
          <ClickHandler onPick={(lat, lng) => onChange({ lat, lng })} />
          {position && (
            <>
              <RecenterMap position={position} />
              <Marker position={[position.lat, position.lng]} icon={pinIcon(pinColor)}>
                <Popup>
                  <LocationInfo lat={position.lat} lng={position.lng} />
                </Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>
      {position && <LocationInfo lat={position.lat} lng={position.lng} />}
    </div>
  );
}
