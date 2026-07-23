import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import { KIGALI_CENTER } from '../lib/rwandaAddress';

const pickupIcon = new L.DivIcon({
  className: 'custom-marker',
  html: '<div style="width:26px;height:26px;background:#10b981;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const deliveryIcon = new L.DivIcon({
  className: 'custom-marker',
  html: '<div style="width:26px;height:26px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function mapsUrl(lat, lng, label) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=driving`;
}

export default function RiderRouteMap({ delivery, height = '280px' }) {
  const pickup = delivery.pickup_latitude && delivery.pickup_longitude
    ? { lat: delivery.pickup_latitude, lng: delivery.pickup_longitude }
    : null;
  const drop = delivery.delivery_latitude && delivery.delivery_longitude
    ? { lat: delivery.delivery_latitude, lng: delivery.delivery_longitude }
    : null;

  const center = pickup || drop || KIGALI_CENTER;
  const zoom = pickup && drop ? 12 : 13;
  const line = pickup && drop ? [[pickup.lat, pickup.lng], [drop.lat, drop.lng]] : null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border border-border" style={{ height }}>
        <MapContainer center={[center.lat, center.lng]} zoom={zoom} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          {line && <Polyline positions={line} pathOptions={{ color: '#3b82f6', weight: 3, dashArray: '8 6', opacity: 0.7 }} />}
          {pickup && (
            <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
              <Popup>Pickup A</Popup>
            </Marker>
          )}
          {drop && (
            <Marker position={[drop.lat, drop.lng]} icon={deliveryIcon}>
              <Popup>Delivery B</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-2">
        {pickup && (
          <a
            href={mapsUrl(pickup.lat, pickup.lng, 'Pickup')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success/10 border border-success/25 text-xs font-medium text-success hover:bg-success/15 transition"
          >
            <Navigation className="w-3.5 h-3.5" />
            Navigate to pickup
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        )}
        {drop && (
          <a
            href={mapsUrl(drop.lat, drop.lng, 'Delivery')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 border border-primary/25 text-xs font-medium text-primary-light hover:bg-primary/15 transition"
          >
            <MapPin className="w-3.5 h-3.5" />
            Navigate to delivery
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        )}
      </div>
    </div>
  );
}
