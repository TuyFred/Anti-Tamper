/**
 * Shared map settings — English-friendly basemap and navigation links.
 */
export const MAP_TILE_CONFIG = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> '
    + '&copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
};

/** Google Maps directions — English UI (hl=en). */
export function googleMapsDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&hl=en`;
}

export const MAP_LABELS = {
  liveMap: 'Live map',
  pickupPin: 'Pickup location (A)',
  deliveryPin: 'Delivery location (B)',
  clickToPin: 'Click the map to set the location pin',
  resolvingLocation: 'Looking up address…',
  selectedLocation: 'Pinned location',
  followGps: 'Follow GPS',
  followingGps: 'Following GPS',
  fullscreen: 'Fullscreen',
  exitFullscreen: 'Exit fullscreen',
  closeFullscreen: 'Close fullscreen',
  online: 'Online',
  offline: 'Offline',
  tamperAlert: 'Tamper alert active',
  shockDetected: 'Shock / fall detected',
  liveGpsFooter: 'Live GPS — location updates automatically when the box moves',
  realTimeGps: 'Real-time GPS from Smart Box device',
  pressEsc: 'Press Esc to exit',
  navigatePickup: 'Open directions to pickup',
  navigateDelivery: 'Open directions to delivery',
  openInMaps: 'Open in Google Maps',
  noGpsSignal: 'Waiting for GPS signal',
  noGpsHint: 'Location appears when the Smart Box is online and reporting GPS.',
  liveLocation: 'Live location',
  routeDistance: 'Route distance',
  inTransit: 'In transit',
  smartBox: 'Smart Box',
};
