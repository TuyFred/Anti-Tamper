import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, ExternalLink, Truck, Route } from 'lucide-react';
import { KIGALI_CENTER } from '../lib/rwandaAddress';
import { googleMapsDirectionsUrl, MAP_LABELS } from '../lib/mapConfig';
import {
  createPickupIcon, createDeliveryIcon, createRouteTruckBadge,
} from '../lib/mapMarkers';
import MapLocationCard from './MapLocationCard';
import AppMapTileLayer from './AppMapTileLayer';

function FitRouteBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [52, 52], maxZoom: 14 });
  }, [points, map]);
  return null;
}

function midpoint(a, b) {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

export default function RiderRouteMap({ delivery, height = '280px' }) {
  const pickup = delivery.pickup_latitude && delivery.pickup_longitude
    ? { lat: delivery.pickup_latitude, lng: delivery.pickup_longitude }
    : null;
  const drop = delivery.delivery_latitude && delivery.delivery_longitude
    ? { lat: delivery.delivery_latitude, lng: delivery.delivery_longitude }
    : null;

  const fallbackCenter = { lat: KIGALI_CENTER[0], lng: KIGALI_CENTER[1] };
  const center = pickup || drop || fallbackCenter;
  const line = pickup && drop ? [[pickup.lat, pickup.lng], [drop.lat, drop.lng]] : null;
  const boundsPoints = useMemo(() => {
    const pts = [];
    if (pickup) pts.push([pickup.lat, pickup.lng]);
    if (drop) pts.push([drop.lat, drop.lng]);
    return pts;
  }, [pickup, drop]);

  const inTransit = delivery.status === 'in_transit';
  const routeMid = pickup && drop ? midpoint(pickup, drop) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <Route className="w-4 h-4 text-primary-light" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white">Delivery route</p>
            <p className="text-[10px] text-slate-500">
              {delivery.distance_km != null ? `${delivery.distance_km} km` : '—'}
              {inTransit && (
                <span className="ml-2 inline-flex items-center gap-1 text-primary-light font-medium">
                  <Truck className="w-3 h-3" />
                  {MAP_LABELS.inTransit}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-3 text-[10px] font-medium uppercase tracking-wide">
          <span className="text-success flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Pickup A</span>
          <span className="text-primary-light flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Delivery B</span>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-border shadow-lg shadow-black/10" style={{ height }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={13}
          className="h-full w-full"
          scrollWheelZoom={false}
        >
          <AppMapTileLayer />
          <FitRouteBounds points={boundsPoints} />
          {line && (
            <Polyline
              positions={line}
              pathOptions={{
                color: '#3b82f6',
                weight: 4,
                dashArray: inTransit ? undefined : '10 8',
                opacity: 0.85,
                lineCap: 'round',
              }}
            />
          )}
          {pickup && (
            <Marker position={[pickup.lat, pickup.lng]} icon={createPickupIcon()}>
              <Popup>
                <MapLocationCard
                  lat={pickup.lat}
                  lng={pickup.lng}
                  title={MAP_LABELS.pickupPin}
                  subtitle={delivery.pickup_address}
                  theme="light"
                />
              </Popup>
            </Marker>
          )}
          {drop && (
            <Marker position={[drop.lat, drop.lng]} icon={createDeliveryIcon()}>
              <Popup>
                <MapLocationCard
                  lat={drop.lat}
                  lng={drop.lng}
                  title={MAP_LABELS.deliveryPin}
                  subtitle={delivery.delivery_address}
                  theme="light"
                />
              </Popup>
            </Marker>
          )}
          {inTransit && routeMid && (
            <Marker position={[routeMid.lat, routeMid.lng]} icon={createRouteTruckBadge()} zIndexOffset={500} />
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-2">
        {pickup && (
          <a
            href={googleMapsDirectionsUrl(pickup.lat, pickup.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success/10 border border-success/25 text-xs font-medium text-success hover:bg-success/15 transition touch-manipulation"
          >
            <Navigation className="w-3.5 h-3.5" />
            {MAP_LABELS.navigatePickup}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        )}
        {drop && (
          <a
            href={googleMapsDirectionsUrl(drop.lat, drop.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 border border-primary/25 text-xs font-medium text-primary-light hover:bg-primary/15 transition touch-manipulation"
          >
            <MapPin className="w-3.5 h-3.5" />
            {MAP_LABELS.navigateDelivery}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        )}
      </div>
    </div>
  );
}
