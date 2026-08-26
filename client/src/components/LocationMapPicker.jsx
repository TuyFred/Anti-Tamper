import { useEffect } from 'react';
import { MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { MapPin, Loader2, LocateFixed } from 'lucide-react';
import L from 'leaflet';
import { KIGALI_CENTER, coordsFromRwandaAddress } from '../lib/geocode';
import { MAP_LABELS } from '../lib/mapConfig';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { useGeolocation } from '../hooks/useGeolocation';
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
  }, [position?.lat, position?.lng, map]);
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
  height = 'min(260px, 45vh)',
  rwandaAddress = null,
}) {
  const { position: myPos, loading: locating, error: geoError, startLiveWatch } = useGeolocation();

  useEffect(() => {
    startLiveWatch();
  }, [startLiveWatch]);

  const sectorFallback = rwandaAddress ? coordsFromRwandaAddress(rwandaAddress) : null;
  const center = position
    ? [position.lat, position.lng]
    : (myPos ? [myPos.lat, myPos.lng] : (sectorFallback ? [sectorFallback.lat, sectorFallback.lng] : KIGALI_CENTER));

  const handleUseMyLocation = () => {
    startLiveWatch();
    if (myPos) {
      onChange({ lat: myPos.lat, lng: myPos.lng });
    }
  };

  // First GPS fix only — do not overwrite a pin the user placed on the map
  useEffect(() => {
    if (myPos && !position) {
      onChange({ lat: myPos.lat, lng: myPos.lng });
    }
  }, [myPos, position, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">{label || MAP_LABELS.clickToPin}</p>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary-light text-xs font-semibold hover:bg-primary/25 disabled:opacity-50 touch-manipulation shrink-0"
        >
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
          {locating ? MAP_LABELS.locatingYou : MAP_LABELS.useMyLocation}
        </button>
      </div>
      {geoError && (
        <p className="text-[11px] text-warning">{geoError}</p>
      )}
      <div className="rounded-xl overflow-hidden border border-border tracking-map-height" style={{ height }}>
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <AppMapTileLayer />
          <ClickHandler onPick={(lat, lng) => onChange({ lat, lng })} />
          {!position && myPos && <RecenterMap position={myPos} />}
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
