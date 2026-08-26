import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Minimize2 } from 'lucide-react';
import { MAP_LABELS } from '../lib/mapConfig';
import { KIGALI_CENTER, mergeDeviceWithGps, getLiveMapPosition } from '../lib/geocode';
import { resolveBoxDisplayPosition, canTrackAssignedBox, shouldShareRiderLocation, shouldShareCustomerLocation, shouldShareParticipantLocation, positionsNear } from '../lib/boxTracking';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { useLiveLocationShare, usePeerLocations } from '../hooks/useLiveLocationShare';
import { useDeliveryLocationSubscribe } from '../hooks/useDeliveryLocationSubscribe';
import { createPickupIcon, createCustomerIcon } from '../lib/mapMarkers';
import MapLocationCard from './MapLocationCard';
import DeviceTrailLayer from './DeviceTrailLayer';
import AppMapTileLayer from './AppMapTileLayer';
import { useRoadRoute } from '../hooks/useRoadRoute';
import MapRouteSummary from './MapRouteSummary';
import MapFloatControls from './map/MapFloatControls';
import FlyToPoint from './map/FlyToPoint';
import {
  MapUserLocationLayer,
  MapPeerLocationLayer,
  MapBoxTrackingLayer,
  MapLegendStrip,
} from './map/MapLiveLayers';

function FitRouteBounds({ points, followPoint }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    if (followPoint) {
      map.flyTo(followPoint, Math.max(map.getZoom(), 14), { duration: 0.8 });
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
  }, [points, followPoint, map]);
  return null;
}

function LiveFollow({ position, enabled }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || !position) return;
    map.flyTo(position, Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [position?.[0], position?.[1], enabled, map]);
  return null;
}

/** Delivery map — box GPS or rider phone when box GPS offline */
export default function RiderRouteMap({ delivery, height = 'min(320px, 48vh)', live = true }) {
  const { profile, roleName } = useAuth();
  const { gpsUpdates, devices, deviceTrails } = useSocket();
  const [followLive, setFollowLive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [locateTick, setLocateTick] = useState(0);
  const [boxLocateTick, setBoxLocateTick] = useState(0);
  const {
    position: userPosition,
    loading: locating,
    permission,
    startLiveWatch,
    clearWatch,
  } = useGeolocation();

  const trackable = live && canTrackAssignedBox(delivery);
  const shareAsRider = trackable && shouldShareRiderLocation(delivery, roleName);
  const shareAsCustomer = trackable && shouldShareCustomerLocation(delivery, roleName);
  const shareMyLocation = trackable && shouldShareParticipantLocation(delivery, roleName);

  useEffect(() => {
    startLiveWatch();
    return () => clearWatch();
  }, [startLiveWatch, clearWatch]);

  useDeliveryLocationSubscribe(delivery?.id, trackable);

  useLiveLocationShare({
    deliveryId: delivery?.id,
    enabled: shareMyLocation && permission === 'granted',
    position: userPosition,
  });

  const peers = usePeerLocations(delivery?.id, profile?.id);
  const myLocation = userPosition;
  const customerName = delivery.customer?.full_name || delivery.customer?.email || null;
  const riderPeer = peers.find((p) => p.role === 'motor_rider');
  const customerPeer = peers.find((p) => p.role === 'customer');

  const pickup = delivery.pickup_latitude && delivery.pickup_longitude
    ? { lat: delivery.pickup_latitude, lng: delivery.pickup_longitude }
    : null;
  const customerPos = delivery.delivery_latitude && delivery.delivery_longitude
    ? { lat: delivery.delivery_latitude, lng: delivery.delivery_longitude }
    : null;

  const baseDevice = useMemo(() => {
    const deviceUuid = delivery.device_id || delivery.device?.id;
    if (deviceUuid) {
      const fromSocket = devices.find((d) => d.id === deviceUuid);
      if (fromSocket) return fromSocket;
    }
    if (delivery.device?.device_id) {
      return devices.find((d) => d.device_id === delivery.device.device_id) || delivery.device;
    }
    return delivery.device || null;
  }, [devices, delivery.device_id, delivery.device]);

  const liveDevice = live && baseDevice ? mergeDeviceWithGps(baseDevice, gpsUpdates) : baseDevice;
  const boxLive = useMemo(
    () => getLiveMapPosition(baseDevice, gpsUpdates),
    [baseDevice, gpsUpdates],
  );
  const boxPos = boxLive ? { lat: boxLive.lat, lng: boxLive.lng } : null;
  const boxFresh = Boolean(boxLive?.fresh);

  const displayBox = useMemo(
    () => resolveBoxDisplayPosition({
      boxPos,
      boxFresh,
      boxDeviceId: liveDevice?.device_id,
      riderPeer: shareAsRider ? null : riderPeer,
      localPhonePosition: shareAsRider && myLocation ? myLocation : null,
      allowLocalPhone: shareAsRider,
      lastSeen: liveDevice?.last_seen,
    }),
    [boxPos, boxFresh, liveDevice, riderPeer, shareAsRider, myLocation],
  );

  const boxTrail = liveDevice
    ? (deviceTrails[liveDevice.id] || deviceTrails[`hw:${liveDevice.device_id}`] || [])
    : [];

  const trackPos = displayBox?.pos || null;

  const { loading: routeLoading, positions: fullRoutePositions, distanceKm: roadDistanceKm, source: routeSource } = useRoadRoute(
    pickup,
    customerPos,
    Boolean(trackable && pickup && customerPos),
  );

  const { loading: progressLoading, positions: progressPositions, distanceKm: remainingKm } = useRoadRoute(
    trackPos,
    customerPos,
    Boolean(trackable && customerPos && trackPos),
  );

  const hideRiderPeer = displayBox?.source === 'rider_phone';
  const boxAtMyPhone = shareAsRider && displayBox?.source === 'rider_phone'
    && trackPos && myLocation && positionsNear(trackPos, myLocation);
  const showMyLocation = Boolean(myLocation) && (
    shareAsCustomer
    || (shareAsRider && !boxAtMyPhone)
    || (!shareAsRider && !shareAsCustomer)
  );

  const center = trackPos
    || (myLocation ? { lat: myLocation.lat, lng: myLocation.lng } : null)
    || customerPos
    || pickup
    || { lat: KIGALI_CENTER[0], lng: KIGALI_CENTER[1] };

  const boundsPoints = useMemo(() => {
    const pts = [];
    if (pickup) pts.push([pickup.lat, pickup.lng]);
    if (customerPos) pts.push([customerPos.lat, customerPos.lng]);
    if (trackPos) pts.push([trackPos.lat, trackPos.lng]);
    if (myLocation) pts.push([myLocation.lat, myLocation.lng]);
    for (const peer of peers) {
      if (hideRiderPeer && peer.role === 'motor_rider') continue;
      pts.push([peer.latitude, peer.longitude]);
    }
    if (fullRoutePositions?.length) {
      for (const p of fullRoutePositions) pts.push(p);
    }
    return pts;
  }, [pickup, customerPos, trackPos, myLocation, peers, hideRiderPeer, fullRoutePositions]);

  const displayRouteKm = roadDistanceKm ?? delivery?.distance_km;

  const followPoint = followLive && trackPos
    ? [trackPos.lat, trackPos.lng]
    : null;

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

  const mapHeight = fullscreen ? '100%' : (typeof height === 'string' && height.includes('min(') ? height : height);

  const mapPanel = (isFullscreen) => (
    <div className={`relative ${isFullscreen ? 'h-full' : ''}`}>
      <div
        className={`rounded-xl overflow-hidden border border-border shadow-xl shadow-black/20 ${isFullscreen ? 'h-full' : 'tracking-map-height-compact'}`}
        style={{ height: mapHeight }}
      >
        <MapContainer
          center={[center.lat ?? center[0], center.lng ?? center[1]]}
          zoom={isFullscreen ? 16 : 15}
          className="h-full w-full"
          scrollWheelZoom
        >
          <AppMapTileLayer />
          <FitRouteBounds points={boundsPoints} followPoint={followPoint} />
          {followLive && followPoint && (
            <LiveFollow position={followPoint} enabled />
          )}
          {myLocation && (
            <FlyToPoint lat={myLocation.lat} lng={myLocation.lng} trigger={locateTick} zoom={16} />
          )}
          {trackPos && (
            <FlyToPoint lat={trackPos.lat} lng={trackPos.lng} trigger={boxLocateTick} zoom={16} />
          )}

          {trackable && fullRoutePositions.length >= 2 && (
            <Polyline
              positions={fullRoutePositions}
              pathOptions={{ color: '#64748b', weight: 4, dashArray: '10 8', opacity: 0.75, lineCap: 'round', lineJoin: 'round' }}
            />
          )}
          {trackable && progressPositions.length >= 2 && (
            <Polyline
              positions={progressPositions}
              pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
            />
          )}
          {boxTrail.length >= 2 && (
            <DeviceTrailLayer trail={boxTrail} color="#0ea5e9" weight={5} showDirection />
          )}

          {pickup && (
            <Marker position={[pickup.lat, pickup.lng]} icon={createPickupIcon()}>
              <Popup>
                <MapLocationCard lat={pickup.lat} lng={pickup.lng} title={MAP_LABELS.pickupPin} subtitle={delivery.pickup_address} theme="light" compact />
              </Popup>
            </Marker>
          )}
          {customerPos && (
            <Marker position={[customerPos.lat, customerPos.lng]} icon={createCustomerIcon({ name: customerName })} zIndexOffset={950}>
              <Popup>
                <MapLocationCard lat={customerPos.lat} lng={customerPos.lng} title={MAP_LABELS.deliveryAddressPin} subtitle={delivery.delivery_address} theme="light" compact />
              </Popup>
            </Marker>
          )}

          <MapBoxTrackingLayer
            display={displayBox}
            alert={liveDevice?.tamper_status || liveDevice?.shock_detected}
          />
          {showMyLocation && <MapUserLocationLayer position={myLocation} compact />}
          <MapPeerLocationLayer peers={peers} hideRider={hideRiderPeer} />
        </MapContainer>

        <MapLegendStrip
          items={[
            ...(displayBox?.fresh && displayBox?.source === 'hardware'
              ? [{ key: 'box', label: liveDevice?.device_id || MAP_LABELS.smartBox, tone: 'live' }]
              : []),
            ...(displayBox?.source === 'rider_phone'
              ? [{ key: 'box-phone', label: MAP_LABELS.fallbackGps, tone: 'blue' }]
              : []),
            ...(riderPeer && !hideRiderPeer
              ? [{ key: 'rider', label: MAP_LABELS.riderLiveGps, tone: 'blue', dot: true, dotColor: '#2563eb' }]
              : []),
            ...(customerPeer
              ? [{ key: 'customer-live', label: MAP_LABELS.customerLiveGps, tone: 'pink', dot: true, dotColor: '#ec4899' }]
              : []),
            ...(customerPos
              ? [{ key: 'dest', label: MAP_LABELS.deliveryAddressPin, tone: 'purple', dot: true, dotColor: '#8b5cf6' }]
              : []),
            ...(showMyLocation
              ? [{ key: 'you', label: MAP_LABELS.myLocation, tone: 'cyan', dot: true, dotColor: '#06b6d4' }]
              : []),
          ]}
        />
      </div>

      <MapFloatControls
        onLocateMe={() => {
          startLiveWatch();
          setLocateTick((n) => n + 1);
          setFollowLive(false);
        }}
        locating={locating}
        hasUserLocation={Boolean(showMyLocation)}
        followBox={followLive}
        onShowBox={() => {
          setBoxLocateTick((n) => n + 1);
          setFollowLive((f) => !f);
        }}
        hasBoxTrack={Boolean(trackPos)}
        fullscreen={isFullscreen}
        onToggleFullscreen={() => setFullscreen((f) => !f)}
      />
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
      <div className="live-map-fullscreen-main">{mapPanel(true)}</div>
    </div>,
    document.body,
  );

  return (
    <div className="space-y-2">
      {mapPanel(false)}
      {fullscreenPortal}

      <MapRouteSummary
        distanceKm={displayRouteKm}
        remainingKm={trackable && trackPos ? remainingKm : null}
        calculatedPrice={delivery?.calculated_price}
        currency={delivery?.currency}
        loading={routeLoading}
        remainingLoading={progressLoading}
        roadSource={routeSource}
      />
    </div>
  );
}
