import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Maximize2, Minimize2, Navigation, Satellite, Truck, Package,
} from 'lucide-react';
import { mergeDevicesWithGps, mergeDeviceWithGps } from '../lib/geocode';
import { MAP_LABELS } from '../lib/mapConfig';
import { createSmartBoxIcon } from '../lib/mapMarkers';
import MapLocationCard from './MapLocationCard';
import AppMapTileLayer from './AppMapTileLayer';

function LiveTracker({ position, zoom, follow }) {
  const map = useMap();
  useEffect(() => {
    if (position && follow) {
      map.flyTo(position, zoom ?? map.getZoom(), { duration: 0.8 });
    }
  }, [position, zoom, follow, map]);
  return null;
}

function MapResize({ trigger }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
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
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
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
      theme="light"
      showMapsLink
    />
  );
}

function NoGpsOverlay() {
  return (
    <div className="absolute inset-0 z-[500] flex items-center justify-center bg-surface/75 backdrop-blur-sm pointer-events-none">
      <div className="text-center px-6 py-5 max-w-sm rounded-2xl border border-border bg-surface/95 shadow-xl">
        <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto mb-3">
          <Satellite className="w-6 h-6 text-primary-light" />
        </div>
        <p className="text-sm font-semibold text-white">{MAP_LABELS.noGpsSignal}</p>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{MAP_LABELS.noGpsHint}</p>
      </div>
    </div>
  );
}

function MapContent({
  devices, selectedDevice, followLive, zoom, height, showNoGps,
}) {
  const validDevices = devices.filter((d) => d.latitude != null && d.longitude != null);
  const selectedId = selectedDevice?.id;

  const defaultCenter = validDevices.length
    ? [validDevices[0].latitude, validDevices[0].longitude]
    : [-1.9403, 29.8739];

  const selectedPosition = selectedDevice?.latitude != null && selectedDevice?.longitude != null
    ? [selectedDevice.latitude, selectedDevice.longitude]
    : null;

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={selectedPosition || defaultCenter}
        zoom={zoom}
        scrollWheelZoom
        style={{ height, width: '100%' }}
        className="z-0"
      >
        <AppMapTileLayer />
        <MapResize trigger={`${height}-${followLive}-${validDevices.length}-${selectedId}`} />
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

  const statusBadge = liveSelected && (
    <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
      liveSelected.is_online
        ? 'bg-success/10 text-success border-success/25'
        : 'bg-surface-lighter text-slate-500 border-border'
    }`}>
      <Package className="w-3 h-3" />
      {liveSelected.is_online ? MAP_LABELS.online : MAP_LABELS.offline}
    </span>
  );

  const mapToolbar = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface/90 shrink-0">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <Truck className="w-5 h-5 text-primary-light" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">
              {liveSelected?.name || MAP_LABELS.liveMap}
            </p>
            {statusBadge}
          </div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
            {MAP_LABELS.liveLocation}
          </p>
          {liveCoords ? (
            <div className="mt-2">
              <MapLocationCard
                lat={liveCoords.lat}
                lng={liveCoords.lng}
                lastUpdated={liveCoords.time}
                online={liveSelected?.is_online}
                compact
                showMapsLink={false}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-1">{MAP_LABELS.noGpsSignal}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setFollowLive((f) => !f)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition touch-manipulation ${
            followLive
              ? 'bg-primary/15 text-primary-light border-primary/30'
              : 'bg-surface text-slate-400 border-border hover:text-white'
          }`}
          title="Follow live GPS position"
        >
          <Navigation className="w-3.5 h-3.5" />
          {followLive ? MAP_LABELS.followingGps : MAP_LABELS.followGps}
        </button>
        <button
          type="button"
          onClick={() => setFullscreen((f) => !f)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-surface-lighter text-white border border-border hover:border-primary/40 transition touch-manipulation"
        >
          {fullscreen ? (
            <>
              <Minimize2 className="w-3.5 h-3.5" />
              {MAP_LABELS.exitFullscreen}
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              {MAP_LABELS.fullscreen}
            </>
          )}
        </button>
      </div>
    </div>
  );

  const mapBody = (mapZoom) => (
    <div className="flex-1 min-h-[480px] relative">
      <MapContent
        devices={liveDevices}
        selectedDevice={liveSelected}
        followLive={followLive}
        zoom={mapZoom}
        height="100%"
        showNoGps={!hasGps}
      />
    </div>
  );

  const mapFooter = liveCoords && (
    <div className="px-4 py-3 border-t border-border bg-surface/60 space-y-2">
      <div className="flex items-center gap-2 text-xs text-success">
        <Satellite className="w-3.5 h-3.5 animate-pulse shrink-0" />
        <span>{MAP_LABELS.liveGpsFooter}</span>
      </div>
      <MapLocationCard
        lat={liveCoords.lat}
        lng={liveCoords.lng}
        title={MAP_LABELS.smartBox}
        subtitle={liveSelected?.device_id}
        lastUpdated={liveCoords.time}
        online={liveSelected?.is_online}
        showMapsLink
      />
    </div>
  );

  const embeddedMap = (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-slate-700/50 shadow-lg shadow-black/20">
      {mapToolbar}
      {mapBody(15)}
      {mapFooter}
    </div>
  );

  const fullscreenMap = fullscreen && createPortal(
    <div className="fixed inset-0 z-[9998] flex flex-col bg-[#0b1120]">
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border bg-surface shrink-0">
        <div className="min-w-0 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-primary-light" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">
              {MAP_LABELS.liveMap} — {liveSelected?.name || 'All devices'}
            </h2>
            {liveCoords && (
              <div className="mt-2 max-w-xl">
                <MapLocationCard
                  lat={liveCoords.lat}
                  lng={liveCoords.lng}
                  lastUpdated={liveCoords.time}
                  online={liveSelected?.is_online}
                  compact
                />
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-lighter border border-border text-white hover:border-primary/40 text-sm font-medium shrink-0"
        >
          <Minimize2 className="w-4 h-4" />
          {MAP_LABELS.closeFullscreen}
        </button>
      </div>
      {mapBody(17)}
      <div className="px-5 py-3 border-t border-border bg-surface/80 text-xs text-slate-500 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Satellite className="w-3.5 h-3.5 text-success" />
          {MAP_LABELS.realTimeGps}
        </span>
        <span>{MAP_LABELS.pressEsc}</span>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {embeddedMap}
      {fullscreenMap}
    </>
  );
}
