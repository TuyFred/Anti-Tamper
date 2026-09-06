import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Minimize2, Users, Truck, Package } from 'lucide-react';
import { mergeDeviceWithGps, getLastKnownMapPosition, KIGALI_CENTER, isInRwanda } from '../lib/geocode';
import { MAP_LABELS } from '../lib/mapConfig';
import { formatDeliveryRef } from '../lib/deliveryUtils';
import AppMapTileLayer from './AppMapTileLayer';
import MapFloatControls from './map/MapFloatControls';
import { MapPeerLocationLayer, MapLegendStrip } from './map/MapLiveLayers';
import { createSmartBoxIcon } from '../lib/mapMarkers';
import MapLocationCard from './MapLocationCard';

function MapResize({ trigger }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [trigger, map]);
  return null;
}

function FitMapPoints({ points, trigger }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
  }, [points, trigger, map]);
  return null;
}

/** Admin/manager map — all boxes + all rider/customer live GPS */
export default function FleetMap({
  devices = [],
  gpsUpdates = {},
  fleetLocations = {},
  deliveries = [],
  selectedDeviceId,
  onSelectDevice,
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [fitTick, setFitTick] = useState(0);

  const deliveryById = useMemo(() => {
    const map = {};
    for (const d of deliveries || []) {
      if (d?.id) map[d.id] = d;
    }
    return map;
  }, [deliveries]);

  const boxMarkers = useMemo(() => (
    (devices || [])
      .map((device) => {
        const merged = mergeDeviceWithGps(device, gpsUpdates);
        const live = getLastKnownMapPosition(merged, gpsUpdates);
        if (!live) return null;
        return {
          device,
          merged,
          pos: { lat: live.lat, lng: live.lng },
          fresh: Boolean(live.fresh),
          lastUpdated: live.last_seen,
        };
      })
      .filter(Boolean)
  ), [devices, gpsUpdates]);

  const peerList = useMemo(() => (
    Object.values(fleetLocations || {}).filter(
      (loc) => loc?.latitude != null && loc?.longitude != null && isInRwanda(loc.latitude, loc.longitude)
    )
  ), [fleetLocations]);

  const mapPoints = useMemo(() => {
    const pts = [];
    for (const b of boxMarkers) pts.push([b.pos.lat, b.pos.lng]);
    for (const p of peerList) pts.push([p.latitude, p.longitude]);
    if (!pts.length) pts.push(KIGALI_CENTER);
    return pts;
  }, [boxMarkers, peerList]);

  const resizeKey = `${fullscreen}-${boxMarkers.length}-${peerList.length}-${fitTick}`;

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

  const mapCenter = mapPoints[0] || KIGALI_CENTER;

  const stats = [
    { icon: Package, label: `${boxMarkers.length} box${boxMarkers.length === 1 ? '' : 'es'}`, tone: 'sky' },
    { icon: Truck, label: `${peerList.filter((p) => p.role === 'motor_rider').length} riders`, tone: 'amber' },
    { icon: Users, label: `${peerList.filter((p) => p.role === 'customer').length} customers`, tone: 'pink' },
  ];

  const peersWithLabels = peerList.map((peer) => {
    const delivery = deliveryById[peer.deliveryId];
    const ref = delivery ? formatDeliveryRef(delivery.id) : formatDeliveryRef(peer.deliveryId);
    return {
      ...peer,
      name: peer.role === 'customer'
        ? `${peer.name || 'Customer'} · ${ref}`
        : `${peer.name || 'Rider'} · ${ref}`,
    };
  });

  const mapShell = (isFullscreen) => (
    <div className={`live-map-shell live-map-shell--map-only ${isFullscreen ? 'live-map-shell--fullscreen' : ''}`}>
      <div className={`live-map-body ${isFullscreen ? 'live-map-body--fullscreen' : ''}`}>
        <div className={`relative h-full w-full ${isFullscreen ? 'live-map-canvas--fs' : 'live-map-canvas'}`}>
          <MapContainer
            center={mapCenter}
            zoom={13}
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
            className={isFullscreen ? 'live-map-leaflet--fs' : 'live-map-leaflet'}
          >
            <AppMapTileLayer />
            <MapResize trigger={resizeKey} />
            <FitMapPoints points={mapPoints} trigger={fitTick} />

            {boxMarkers.map((entry) => {
              const selected = entry.device.id === selectedDeviceId;
              const alert = entry.merged?.tamper_status || entry.merged?.shock_detected;
              return (
                <Marker
                  key={entry.device.id}
                  position={[entry.pos.lat, entry.pos.lng]}
                  icon={createSmartBoxIcon({
                    selected,
                    online: entry.fresh,
                    alert,
                    deviceId: entry.device.device_id,
                  })}
                  zIndexOffset={selected ? 1100 : 1000}
                  eventHandlers={{
                    click: () => onSelectDevice?.(entry.device.id),
                  }}
                >
                  <Popup>
                    <MapLocationCard
                      lat={entry.pos.lat}
                      lng={entry.pos.lng}
                      title={entry.device.device_id || 'Smart Box'}
                      subtitle={entry.device.name}
                      lastUpdated={entry.lastUpdated}
                      theme="light"
                      compact
                      live={entry.fresh}
                      online={entry.fresh}
                    />
                  </Popup>
                </Marker>
              );
            })}

            <MapPeerLocationLayer peers={peersWithLabels} />
          </MapContainer>

          <MapFloatControls
            onLocateMe={() => setFitTick((n) => n + 1)}
            onToggleFullscreen={() => setFullscreen((v) => !v)}
            fullscreen={isFullscreen}
            locating={false}
            hasUserLocation={false}
            showFullscreen
          />

          <MapLegendStrip
            items={[
              { key: 'box', label: MAP_LABELS.smartBox, tone: 'sky', dot: true, dotColor: '#0ea5e9' },
              { key: 'rider', label: 'Rider GPS', tone: 'amber', dot: true, dotColor: '#f59e0b' },
              { key: 'customer', label: 'Customer GPS', tone: 'pink', dot: true, dotColor: '#ec4899' },
            ]}
          />

          {!isFullscreen && (
            <div className="absolute top-3 left-3 z-[500] flex flex-wrap gap-2">
              {stats.map(({ icon: Icon, label, tone }) => (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface/90 border border-border text-slate-300 map-legend-item--${tone}`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </span>
              ))}
            </div>
          )}

          {isFullscreen && (
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="absolute top-3 right-3 z-[600] p-2 rounded-lg bg-surface/90 border border-border text-slate-300 hover:text-white"
              aria-label="Exit full screen"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (fullscreen) {
    return createPortal(mapShell(true), document.body);
  }

  return mapShell(false);
}
