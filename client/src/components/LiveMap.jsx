import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Maximize2, Minimize2, MapPin, Navigation, Satellite } from 'lucide-react';
import L from 'leaflet';

const boxIcon = new L.DivIcon({
  className: 'custom-marker',
  html: `<div style="
    width: 36px; height: 36px;
    background: #0ea5e9;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 12px rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
  "><svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M20 8h-3V4H7v4H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM7 6h10v2H7V6zm13 14H4V10h16v10z"/></svg></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const alertIcon = new L.DivIcon({
  className: 'custom-marker',
  html: `<div style="
    width: 36px; height: 36px;
    background: #ef4444;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 0 16px rgba(239,68,68,0.8);
    animation: pulse 1s infinite;
  "></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

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

function MapContent({ devices, selectedDevice, followLive, zoom, height }) {
  const validDevices = devices.filter((d) => d.latitude != null && d.longitude != null);

  const defaultCenter = validDevices.length
    ? [validDevices[0].latitude, validDevices[0].longitude]
    : [-1.9403, 29.8739]; // Kigali, Rwanda

  const selectedPosition = selectedDevice?.latitude != null && selectedDevice?.longitude != null
    ? [selectedDevice.latitude, selectedDevice.longitude]
    : null;

  return (
    <MapContainer
      center={selectedPosition || defaultCenter}
      zoom={zoom}
      scrollWheelZoom
      style={{ height, width: '100%' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapResize trigger={`${height}-${followLive}`} />
      {selectedPosition && (
        <LiveTracker position={selectedPosition} zoom={zoom} follow={followLive} />
      )}
      {validDevices.map((device) => {
        const hasAlert = device.tamper_status || device.shock_detected;
        return (
          <Marker
            key={device.id}
            position={[device.latitude, device.longitude]}
            icon={hasAlert ? alertIcon : boxIcon}
          >
            <Popup>
              <div className="text-sm min-w-[160px]">
                <strong>{device.name}</strong>
                <br />
                ID: {device.device_id}
                <br />
                {device.is_online ? '🟢 Online' : '🔴 Offline'}
                <br />
                <span className="font-mono text-xs">
                  {device.latitude?.toFixed(6)}, {device.longitude?.toFixed(6)}
                </span>
                {device.tamper_status && <><br />⚠️ Tamper active</>}
                {device.shock_detected && <><br />💥 Shock / fall detected</>}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

export default function LiveMap({ devices, selectedDevice, gpsUpdates = {} }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [followLive, setFollowLive] = useState(true);

  const liveCoords = useMemo(() => {
    if (!selectedDevice) return null;
    const update = gpsUpdates[selectedDevice.id];
    if (update) {
      return {
        lat: update.latitude,
        lng: update.longitude,
        time: update.timestamp,
      };
    }
    if (selectedDevice.latitude != null && selectedDevice.longitude != null) {
      return {
        lat: selectedDevice.latitude,
        lng: selectedDevice.longitude,
        time: selectedDevice.last_seen,
      };
    }
    return null;
  }, [selectedDevice, gpsUpdates]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => e.key === 'Escape' && setFullscreen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [fullscreen]);

  const mapToolbar = (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-surface/80 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <MapPin className="w-4 h-4 text-primary-light shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {selectedDevice?.name || 'Live map'}
          </p>
          {liveCoords && (
            <p className="text-[11px] text-slate-500 font-mono truncate">
              {liveCoords.lat.toFixed(6)}, {liveCoords.lng.toFixed(6)}
              {liveCoords.time && (
                <span className="text-slate-600 ml-2">
                  updated {new Date(liveCoords.time).toLocaleTimeString()}
                </span>
              )}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setFollowLive((f) => !f)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            followLive
              ? 'bg-primary/15 text-primary-light border-primary/30'
              : 'bg-surface text-slate-400 border-border hover:text-white'
          }`}
          title="Follow live GPS position"
        >
          <Navigation className="w-3.5 h-3.5" />
          {followLive ? 'Following' : 'Follow'}
        </button>
        <button
          type="button"
          onClick={() => setFullscreen((f) => !f)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-lighter text-white border border-border hover:border-primary/40 transition"
        >
          {fullscreen ? (
            <>
              <Minimize2 className="w-3.5 h-3.5" />
              Exit
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              Fullscreen
            </>
          )}
        </button>
      </div>
    </div>
  );

  const embeddedMap = (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-slate-700/50">
      {mapToolbar}
      <div className="flex-1 min-h-[480px] relative">
        <MapContent
          devices={devices}
          selectedDevice={selectedDevice}
          followLive={followLive}
          zoom={15}
          height="100%"
        />
      </div>
      {liveCoords && (
        <div className="px-4 py-2 border-t border-border bg-surface/50 flex items-center gap-2 text-xs text-slate-400">
          <Satellite className="w-3.5 h-3.5 text-success" />
          Live GPS tracking active — marker moves when ESP32 sends new coordinates
        </div>
      )}
    </div>
  );

  const fullscreenMap = fullscreen && createPortal(
    <div className="fixed inset-0 z-[9998] flex flex-col bg-[#0b1120]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary-light" />
            Live map — {selectedDevice?.name || 'All devices'}
          </h2>
          {liveCoords && (
            <p className="text-sm text-slate-400 font-mono mt-0.5">
              {liveCoords.lat.toFixed(6)}, {liveCoords.lng.toFixed(6)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-lighter border border-border text-white hover:border-primary/40 text-sm font-medium"
        >
          <Minimize2 className="w-4 h-4" />
          Close fullscreen
        </button>
      </div>
      <div className="flex-1 relative">
        <MapContent
          devices={devices}
          selectedDevice={selectedDevice}
          followLive={followLive}
          zoom={17}
          height="100%"
        />
      </div>
      <div className="px-5 py-2 border-t border-border bg-surface/80 text-xs text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Satellite className="w-3.5 h-3.5" />
          Real-time location from ESP32 GPS module
        </span>
        <span>Press Esc to exit</span>
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
