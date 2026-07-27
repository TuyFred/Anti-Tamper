import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Maximize2, Minimize2, Navigation, Satellite, Truck, Package, MapPin,
} from 'lucide-react';
import { mergeDevicesWithGps, mergeDeviceWithGps, KIGALI_CENTER } from '../lib/geocode';
import { MAP_LABELS } from '../lib/mapConfig';
import { createSmartBoxIcon } from '../lib/mapMarkers';
import MapLocationCard from './MapLocationCard';
import AppMapTileLayer from './AppMapTileLayer';

function LiveTracker({ position, zoom, follow }) {
  const map = useMap();
  useEffect(() => {
    if (position && follow) {
      map.flyTo(position, zoom ?? map.getZoom(), { duration: 0.85 });
    }
  }, [position, zoom, follow, map]);
  return null;
}

function MapResize({ trigger }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [trigger, map]);
  return null;
}

function FitDevicesBounds({ devices, enabled }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || !devices?.length) return;
    const points = devices
      .filter((d) => d.latitude != null && d.longitude != null)
      .map((d) => [d.latitude, d.longitude]);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 15 });
  }, [devices, enabled, map]);
  return null;
}

function DevicePopup({ device }) {
  return (
    <MapLocationCard
      lat={device.latitude}
      lng={device.longitude}
      title={device.name}
      subtitle={`ID ${device.device_id}${device.lock_status ? ` · ${device.lock_status}` : ''}`}
      lastUpdated={device.last_seen}
      online={device.is_online}
      live={device.is_online}
      theme="light"
      showMapsLink
    />
  );
}

function MapOverlayBadge({ online, deviceCount, fullscreen }) {
  return (
    <div className={`live-map-overlay-badge ${fullscreen ? 'live-map-overlay-badge--fs' : ''}`}>
      <span className={`live-map-live-dot ${online ? 'live-map-live-dot--on' : ''}`} />
      <span className="font-semibold text-white text-xs sm:text-sm">
        {online ? MAP_LABELS.liveTrackingActive : MAP_LABELS.offline}
      </span>
      <span className="text-slate-400 text-[10px] sm:text-xs hidden sm:inline">· Rwanda</span>
      {deviceCount > 0 && (
        <span className="text-slate-500 text-[10px] sm:text-xs">
          · {deviceCount} {MAP_LABELS.devicesOnMap}
        </span>
      )}
    </div>
  );
}

function FloatingMapControls({ followLive, onToggleFollow, onToggleFullscreen, fullscreen }) {
  return (
    <div className="live-map-float-controls">
      <button
        type="button"
        onClick={onToggleFollow}
        title={MAP_LABELS.followGpsHint}
        className={`live-map-float-btn ${followLive ? 'live-map-float-btn--active' : ''}`}
      >
        <Navigation className="w-4 h-4" />
        <span className="hidden sm:inline">{followLive ? MAP_LABELS.followingGps : MAP_LABELS.followGps}</span>
      </button>
      <button
        type="button"
        onClick={onToggleFullscreen}
        className="live-map-float-btn"
      >
        {fullscreen ? (
          <>
            <Minimize2 className="w-4 h-4" />
            <span className="hidden sm:inline">{MAP_LABELS.exitFullscreen}</span>
          </>
        ) : (
          <>
            <Maximize2 className="w-4 h-4" />
            <span className="hidden sm:inline">{MAP_LABELS.fullscreen}</span>
          </>
        )}
      </button>
    </div>
  );
}

function NoGpsOverlay() {
  return (
    <div className="absolute inset-0 z-[500] flex items-center justify-center bg-[#0b1120]/80 backdrop-blur-sm pointer-events-none">
      <div className="text-center px-6 py-6 max-w-md rounded-2xl border border-border/80 bg-surface/95 shadow-2xl mx-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto mb-4">
          <Satellite className="w-7 h-7 text-primary-light" />
        </div>
        <p className="text-base font-semibold text-white">{MAP_LABELS.noGpsSignal}</p>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">{MAP_LABELS.noGpsHint}</p>
      </div>
    </div>
  );
}

function MapContent({
  devices, selectedDevice, followLive, zoom, showNoGps, resizeKey, fullscreen,
}) {
  const validDevices = devices.filter((d) => d.latitude != null && d.longitude != null);
  const selectedId = selectedDevice?.id;

  const defaultCenter = validDevices.length
    ? [validDevices[0].latitude, validDevices[0].longitude]
    : KIGALI_CENTER;

  const selectedPosition = selectedDevice?.latitude != null && selectedDevice?.longitude != null
    ? [selectedDevice.latitude, selectedDevice.longitude]
    : null;

  return (
    <div className={`relative h-full w-full ${fullscreen ? 'live-map-canvas--fs' : 'live-map-canvas'}`}>
      <MapContainer
        center={selectedPosition || defaultCenter}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        className={fullscreen ? 'live-map-leaflet--fs' : 'live-map-leaflet'}
      >
        <AppMapTileLayer />
        <MapResize trigger={resizeKey} />
        <FitDevicesBounds devices={validDevices} enabled={!followLive || validDevices.length > 1} />
        {selectedPosition && (
          <LiveTracker position={selectedPosition} zoom={zoom} follow={followLive} />
        )}
        {validDevices.map((device) => {
          const isSelected = device.id === selectedId;
          const hasAlert = device.tamper_status || device.shock_detected;
          return (
            <Marker
              key={device.id}
              position={[device.latitude, device.longitude]}
              icon={createSmartBoxIcon({
                selected: isSelected,
                online: device.is_online,
                alert: hasAlert,
              })}
              zIndexOffset={isSelected ? 1000 : 0}
            >
              <Popup>
                <DevicePopup device={device} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      {showNoGps && <NoGpsOverlay />}
    </div>
  );
}

export default function LiveMap({ devices, selectedDevice, gpsUpdates = {} }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [followLive, setFollowLive] = useState(true);

  const liveDevices = useMemo(
    () => mergeDevicesWithGps(devices, gpsUpdates),
    [devices, gpsUpdates],
  );

  const liveSelected = useMemo(
    () => mergeDeviceWithGps(selectedDevice, gpsUpdates),
    [selectedDevice, gpsUpdates],
  );

  const liveCoords = useMemo(() => {
    if (!liveSelected || liveSelected.latitude == null || liveSelected.longitude == null) {
      return null;
    }
    return {
      lat: liveSelected.latitude,
      lng: liveSelected.longitude,
      time: liveSelected.last_seen,
    };
  }, [liveSelected]);

  const hasGps = liveDevices.some((d) => d.latitude != null && d.longitude != null);
  const onMapCount = liveDevices.filter((d) => d.latitude != null && d.longitude != null).length;
  const resizeKey = `${fullscreen}-${followLive}-${onMapCount}-${liveSelected?.id}-${liveCoords?.lat}`;

  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setFullscreen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [fullscreen]);

  const mapZoom = fullscreen ? 16 : 15;

  const locationPanel = liveCoords ? (
    <MapLocationCard
      lat={liveCoords.lat}
      lng={liveCoords.lng}
      title={liveSelected?.name || MAP_LABELS.smartBox}
      subtitle={liveSelected?.device_id ? `Box ${liveSelected.device_id}` : undefined}
      lastUpdated={liveCoords.time}
      online={liveSelected?.is_online}
      live={liveSelected?.is_online}
      showMapsLink
    />
  ) : (
    <div className="rounded-xl border border-border bg-surface/90 p-4 flex items-start gap-3">
      <Satellite className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-slate-300">{MAP_LABELS.noGpsSignal}</p>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{MAP_LABELS.noGpsHint}</p>
      </div>
    </div>
  );

  const mapShell = (isFullscreen) => (
    <div className={`live-map-shell ${isFullscreen ? 'live-map-shell--fullscreen' : ''}`}>
      {/* Compact header — embedded only */}
      {!isFullscreen && (
        <div className="live-map-header">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-emerald-500/10 border border-primary/25 flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary-light" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-white truncate">
                  {liveSelected?.name || MAP_LABELS.liveMap}
                </h3>
                {liveSelected?.is_online && (
                  <span className="live-map-status-pill live-map-status-pill--live">
                    <Package className="w-3 h-3" />
                    {MAP_LABELS.live}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{MAP_LABELS.liveMapSubtitle}</p>
            </div>
          </div>
        </div>
      )}

      {/* Map area with overlays */}
      <div className={`live-map-body ${isFullscreen ? 'live-map-body--fullscreen' : ''}`}>
        <MapContent
          devices={liveDevices}
          selectedDevice={liveSelected}
          followLive={followLive}
          zoom={mapZoom}
          showNoGps={!hasGps}
          resizeKey={resizeKey}
          fullscreen={isFullscreen}
        />
        <MapOverlayBadge
          online={liveSelected?.is_online}
          deviceCount={onMapCount}
          fullscreen={isFullscreen}
        />
        <FloatingMapControls
          followLive={followLive}
          onToggleFollow={() => setFollowLive((f) => !f)}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
          fullscreen={isFullscreen}
        />
      </div>

      {/* Location panel */}
      <div className={`live-map-footer ${isFullscreen ? 'live-map-footer--fullscreen' : ''}`}>
        {!isFullscreen && (
          <div className="flex items-center gap-2 text-xs text-emerald-400/90 mb-2">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>{MAP_LABELS.liveLocation}</span>
          </div>
        )}
        {locationPanel}
      </div>
    </div>
  );

  const fullscreenPortal = fullscreen && createPortal(
    <div className="live-map-fullscreen-root" role="dialog" aria-label={MAP_LABELS.liveMap}>
      <div className="live-map-fullscreen-topbar">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-primary-light" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-white truncate">
              {MAP_LABELS.liveMap}
              {liveSelected?.name ? ` — ${liveSelected.name}` : ''}
            </h2>
            <p className="text-xs text-slate-500 truncate">{MAP_LABELS.liveMapSubtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          className="live-map-close-btn"
        >
          <Minimize2 className="w-4 h-4" />
          <span>{MAP_LABELS.closeFullscreen}</span>
        </button>
      </div>

      <div className="live-map-fullscreen-main">
        {mapShell(true)}
      </div>

      <div className="live-map-fullscreen-hint">
        <Satellite className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>{MAP_LABELS.realTimeGps}</span>
        <span className="text-slate-600">·</span>
        <span>{MAP_LABELS.pressEsc}</span>
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      <div className="h-full min-h-[420px] flex flex-col">{mapShell(false)}</div>
      {fullscreenPortal}
    </>
  );
}
