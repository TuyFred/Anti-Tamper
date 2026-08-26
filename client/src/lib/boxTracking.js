import { isInRwanda } from './geocode';

const PEER_FRESH_MS = 120_000;

function isPeerFresh(peer) {
  if (!peer?.timestamp) return true;
  return Date.now() - new Date(peer.timestamp).getTime() < PEER_FRESH_MS;
}

function phonePos(pos) {
  if (!pos || pos.lat == null || pos.lng == null) return null;
  if (!isInRwanda(pos.lat, pos.lng)) return null;
  return { lat: pos.lat, lng: pos.lng };
}

/** ~50 m — treat as same point on map */
export function positionsNear(a, b, maxMeters = 50) {
  if (!a || !b) return false;
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) <= maxMeters;
}

/**
 * Best box position: hardware GPS first, then rider phone shared on delivery only.
 * Never use the viewer's own phone unless they are the assigned rider carrying the box.
 */
export function resolveBoxDisplayPosition({
  boxPos,
  boxFresh,
  boxDeviceId,
  riderPeer,
  localPhonePosition,
  allowLocalPhone = false,
  lastSeen,
}) {
  if (boxFresh && boxPos) {
    return {
      pos: boxPos,
      fresh: true,
      source: 'hardware',
      deviceId: boxDeviceId,
      lastUpdated: lastSeen,
    };
  }

  if (riderPeer && isPeerFresh(riderPeer)) {
    const peerPos = phonePos({ lat: riderPeer.latitude, lng: riderPeer.longitude });
    if (peerPos) {
      return {
        pos: peerPos,
        fresh: true,
        source: 'rider_phone',
        deviceId: boxDeviceId,
        lastUpdated: riderPeer.timestamp,
        riderName: riderPeer.name,
      };
    }
  }

  const local = allowLocalPhone ? phonePos(localPhonePosition) : null;
  if (local) {
    return {
      pos: local,
      fresh: true,
      source: 'rider_phone',
      deviceId: boxDeviceId,
      lastUpdated: localPhonePosition.timestamp || new Date().toISOString(),
    };
  }

  return null;
}
/** Customer can track once a box is assigned to the delivery */
export function canTrackAssignedBox(delivery) {
  if (!delivery) return false;
  if (['delivered', 'cancelled'].includes(delivery.status)) return false;
  const hasBox = Boolean(delivery.device_id || delivery.device?.id || delivery.device?.device_id);
  if (!hasBox) return false;
  return ['rider_assigned', 'in_transit', 'payment_verified'].includes(delivery.status);
}

const SHARE_LOCATION_STATUSES = ['rider_assigned', 'in_transit', 'payment_verified'];

function canShareOnDelivery(delivery, roleName) {
  if (!delivery || !roleName) return false;
  if (['delivered', 'cancelled'].includes(delivery.status)) return false;
  return SHARE_LOCATION_STATUSES.includes(delivery.status);
}

/** Assigned rider shares phone/laptop GPS while carrying the box */
export function shouldShareRiderLocation(delivery, roleName) {
  if (roleName !== 'motor_rider' || !delivery) return false;
  const hasBox = Boolean(delivery.device_id || delivery.device?.id);
  if (!hasBox) return false;
  return canShareOnDelivery(delivery, roleName);
}

/** @deprecated use shouldShareRiderLocation */
export const shouldSharePhoneLocation = shouldShareRiderLocation;

/** Customer shares live phone/laptop GPS during active delivery (visible to rider/manager) */
export function shouldShareCustomerLocation(delivery, roleName) {
  if (roleName !== 'customer' || !delivery) return false;
  return canShareOnDelivery(delivery, roleName);
}

export function shouldShareParticipantLocation(delivery, roleName) {
  return shouldShareRiderLocation(delivery, roleName)
    || shouldShareCustomerLocation(delivery, roleName);
}
