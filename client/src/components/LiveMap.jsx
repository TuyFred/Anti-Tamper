import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import DeviceTrailLayer from './DeviceTrailLayer';
import { useSocket } from '../context/SocketContext';
import { Minimize2 } from 'lucide-react';
import {
  mergeDeviceWithGps, getLiveMapPosition, KIGALI_CENTER,
} from '../lib/geocode';
import { MAP_LABELS } from '../lib/mapConfig';
import { useGeolocation } from '../hooks/useGeolocation';
import AppMapTileLayer from './AppMapTileLayer';
import MapFloatControls from './map/MapFloatControls';
import FlyToPoint from './map/FlyToPoint';
import { MapUserLocationLayer, MapBoxTrackingLayer, MapLegendStrip } from './map/MapLiveLayers';

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

function FitMapPoints({ points, enabled }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || !points?.length) return;
    if (points.length === 1) {
      map.setView(points[0], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 16 });
  }, [points, enabled, map]);
  return null;
}

/** Live box map — box marker only from hardware GPS; your location is separate */
export default function LiveMap({ devices, selectedDevice, gpsUpdates = {}, large = false }) {
  const { deviceTrails } = useSocket();
  const [fullscreen, setFullscreen] = useState(false);
  const [followLive, setFollowLive] = useState(false);
  const [locateTick, setLocateTick] = useState(0);
  const [boxLocateTick, setBoxLocateTick] = useState(0);
  const {
    position: userPosition,
    loading: locating,
    startLiveWatch,
    clearWatch,
  } = useGeolocation();

  useEffect(() => {
    startLiveWatch();
    return () => clearWatch();
  }, [startLiveWatch, clearWatch]);

  const myLocation = userPosition;
  const liveSelected = useMemo(
    () => mergeDeviceWithGps(selectedDevice, gpsUpdates),
    [selectedDevice, gpsUpdates],
  );

  const boxLive = useMemo(
    () => getLiveMapPosition(liveSelected, gpsUpdates),
    [liveSelected, gpsUpdates],
  );

  const displayBox = useMemo(() => {
    if (!boxLive?.fresh || !liveSelected) return null;
    return {
      pos: { lat: boxLive.lat, lng: boxLive.lng },
      fresh: true,
      source: 'hardware',
      deviceId: liveSelected.device_id,
      lastUpdated: boxLive.last_seen,
    };
  }, [boxLive, liveSelected]);

  const trackPos = displayBox?.pos || null;
  const hasBoxTrack = Boolean(trackPos);
  const followBox = followLive && hasBoxTrack;

  const selectedTrail = useMemo(() => {
    if (!liveSelected) return [];
    return deviceTrails[liveSelected.id]
      || deviceTrails[`hw:${liveSelected.device_id}`]
      || [];
  }, [deviceTrails, liveSelected]);

  const mapPoints = useMemo(() => {
    const pts = [];
    if (trackPos) pts.push([trackPos.lat, trackPos.lng]);
    if (myLocation) pts.push([myLocation.lat, myLocation.lng]);
    if (!pts.length) pts.push(KIGALI_CENTER);
    return pts;
  }, [trackPos, myLocation]);

  const resizeKey = `${fullscreen}-${followLive}-${liveSelected?.id}-${trackPos?.lat}-${myLocation?.lat}-${locateTick}-${boxLocateTick}`;

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

  const mapZoom = fullscreen ? 17 : 16;
  const mapCenter = trackPos
    ? [trackPos.lat, trackPos.lng]
    : KIGALI_CENTER;

  const mapShell = (isFullscreen) => (
    <div className={`live-map-shell live-map-shell--map-only ${isFullscreen ? 'live-map-shell--fullscreen' : ''}`}>
      <div className={`live-map-body ${isFullscreen ? 'live-map-body--fullscreen' : ''}`}>
        <div className={`relative h-full w-full ${isFullscreen ? 'live-map-canvas--fs' : 'live-map-canvas'}`}>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
            className={isFullscreen ? 'live-map-leaflet--fs' : 'live-map-leaflet'}
          >
            <AppMapTileLayer />
            <MapResize trigger={resizeKey} />
            <FitMapPoints points={mapPoints} enabled={!followBox} />
            {followBox && trackPos && (
              <LiveTracker position={[trackPos.lat, trackPos.lng]} zoom={mapZoom} follow />
            )}
            {myLocation && (
              <FlyToPoint lat={myLocation.lat} lng={myLocation.lng} trigger={locateTick} zoom={mapZoom} />
            )}
            {trackPos && (
              <FlyToPoint lat={trackPos.lat} lng={trackPos.lng} trigger={boxLocateTick} zoom={mapZoom} />
            )}
            {selectedTrail.length >= 2 && (
              <DeviceTrailLayer trail={selectedTrail} color="#3b82f6" weight={5} showDirection />
            )}
            {displayBox && (
              <MapBoxTrackingLayer
                display={displayBox}
                alert={liveSelected?.tamper_status || liveSelected?.shock_detected}
              />
            )}
            {myLocation && <MapUserLocationLayer position={myLocation} compact />}
          </MapContainer>
          <MapLegendStrip
            items={[
              ...(hasBoxTrack ? [{
                key: 'box',
                label: MAP_LABELS.smartBox,
                tone: 'sky',
                dot: true,
                dotColor: '#0ea5e9',
              }] : []),
              ...(myLocation ? [{ key: 'you', label: MAP_LABELS.myLocation, tone: 'cyan', dot: true, dotColor: '#06b6d4' }] : []),
            ]}
          />
        </div>
        <MapFloatControls
          onLocateMe={() => { startLiveWatch(); setLocateTick((n) => n + 1); setFollowLive(false); }}
          locating={locating}
          hasUserLocation={Boolean(myLocation)}
          followBox={followLive}
          onShowBox={() => {
            setBoxLocateTick((n) => n + 1);
            setFollowLive((f) => !f);
          }}
          hasBoxTrack={hasBoxTrack}
          fullscreen={isFullscreen}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
        />
      </div>
    </div>
  );

  const fullscreenPortal = fullscreen && createPortal(
    <div className="live-map-fullscreen-root" role="dialog" aria-label={MAP_LABELS.liveMap}>
      <div className="live-map-fullscreen-topbar">
        <span className="text-sm font-medium text-white">{MAP_LABELS.liveMap}</span>
        <button type="button" onClick={() => setFullscreen(false)} className="live-map-close-btn">
          <Minimize2 className="w-4 h-4" />
        </button>
      </div>
      <div className="live-map-fullscreen-main">{mapShell(true)}</div>
    </div>,
    document.body,
  );

  return (
    <>
      <div className={`h-full flex flex-col ${large ? 'live-map-large' : 'min-h-[min(420px,55vh)]'}`}>
        {mapShell(false)}
      </div>
      {fullscreenPortal}
    </>
  );
}
