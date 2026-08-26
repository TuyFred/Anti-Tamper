import { useEffect, useRef } from 'react';
import { Circle, Marker, Popup } from 'react-leaflet';
import { LocateFixed, Loader2 } from 'lucide-react';
import { createUserLocationIcon, createTruckIcon, createSmartBoxIcon, createCustomerLiveIcon } from '../../lib/mapMarkers';
import { useReverseGeocode } from '../../hooks/useReverseGeocode';
import MapLocationCard from '../MapLocationCard';

/** Smooth marker moves when live GPS updates */
function LivePositionMarker({ position, icon, zIndexOffset, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && position) {
      ref.current.setLatLng([position.lat, position.lng]);
    }
  }, [position?.lat, position?.lng]);
  if (!position) return null;
  return (
    <Marker
      ref={ref}
      position={[position.lat, position.lng]}
      icon={icon}
      zIndexOffset={zIndexOffset}
    >
      {children}
    </Marker>
  );
}

/** Small live address readout — street, cell, sector, district, Rwanda + coords */
export function MapLiveAddressChip({ lat, lng, className = '', loading: externalLoading }) {
  const { lines, loading } = useReverseGeocode(lat, lng);
  const busy = loading || externalLoading;

  if (lat == null || lng == null) return null;

  return (
    <div className={`map-location-chip map-location-chip--address ${className}`}>
      {busy && !lines.length ? (
        <Loader2 className="w-3 h-3 animate-spin shrink-0 text-cyan-400" />
      ) : (
        lines.map((line) => (
          <span key={line} className="map-location-chip__line">{line}</span>
        ))
      )}
      <span className="map-location-chip__coords font-mono">
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </span>
    </div>
  );
}

/** Map overlay — your live GPS with Rwanda address */
export function MapLocationChip({ position, permission, loading, onEnable, className = '' }) {
  if (permission === 'granted' && position) {
    return (
      <MapLiveAddressChip
        lat={position.lat}
        lng={position.lng}
        className={`map-location-chip--live ${className}`}
        loading={loading}
      />
    );
  }

  if (permission === 'insecure' || permission === 'unsupported') {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onEnable}
      disabled={loading}
      className={`map-location-chip map-location-chip--prompt ${className}`}
      title="Enable GPS"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LocateFixed className="w-3 h-3" />}
      <span>GPS</span>
    </button>
  );
}

export function MapLocationPermissionBanner() {
  return null;
}

export function MapUserLocationLayer({ position, showAccuracy = false, compact = true }) {
  if (!position) return null;

  return (
    <>
      {showAccuracy && position.accuracy > 0 && (
        <Circle
          center={[position.lat, position.lng]}
          radius={Math.min(position.accuracy, 80)}
          pathOptions={{
            color: '#06b6d4',
            fillColor: '#06b6d4',
            fillOpacity: 0.1,
            weight: 1,
            opacity: 0.4,
          }}
        />
      )}
      <LivePositionMarker position={position} icon={createUserLocationIcon()} zIndexOffset={900}>
        {compact && (
          <Popup>
            <MapLocationCard lat={position.lat} lng={position.lng} theme="light" compact live />
          </Popup>
        )}
      </LivePositionMarker>
    </>
  );
}

export function MapPeerLocationLayer({ peers = [], hideRider = false }) {
  return peers
    .filter((peer) => !(hideRider && peer.role === 'motor_rider'))
    .map((peer) => {
      const isRider = peer.role === 'motor_rider';
      const isCustomer = peer.role === 'customer';
      const icon = isRider
        ? createTruckIcon({ selected: true })
        : isCustomer
          ? createCustomerLiveIcon({ name: peer.name })
          : createUserLocationIcon();
      const pos = { lat: peer.latitude, lng: peer.longitude };
      const title = isRider ? 'Rider' : isCustomer ? 'Customer (live GPS)' : 'User';

      return (
        <LivePositionMarker
          key={peer.userId}
          position={pos}
          icon={icon}
          zIndexOffset={isCustomer ? 880 : 850}
        >
          <Popup>
            <MapLocationCard
              lat={peer.latitude}
              lng={peer.longitude}
              title={title}
              subtitle={isCustomer ? peer.name : undefined}
              lastUpdated={peer.timestamp}
              theme="light"
              compact
              live
            />
          </Popup>
        </LivePositionMarker>
      );
    });
}

/** Box marker — hardware or rider-phone fallback, updates live */
export function MapBoxTrackingLayer({ display, alert = false }) {
  if (!display?.pos) return null;

  return (
    <LivePositionMarker
      position={display.pos}
      icon={createSmartBoxIcon({
        selected: true,
        online: display.fresh,
        alert,
        deviceId: display.deviceId,
      })}
      zIndexOffset={1000}
    >
      <Popup>
        <MapLocationCard
          lat={display.pos.lat}
          lng={display.pos.lng}
          title={display.deviceId || 'Smart Box'}
          lastUpdated={display.lastUpdated}
          theme="light"
          compact
          live={display.fresh}
          online={display.fresh}
        />
      </Popup>
    </LivePositionMarker>
  );
}

export function MapLegendStrip({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className="map-legend-strip">
      {items.map((item) => (
        <span key={item.key || item.label} className={`map-legend-item map-legend-item--${item.tone || 'default'}`}>
          {item.dot && <span className="map-legend-dot" style={item.dotColor ? { background: item.dotColor } : undefined} />}
          {item.icon}
          {item.label}
        </span>
      ))}
    </div>
  );
}
