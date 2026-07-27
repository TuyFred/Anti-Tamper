/**
 * Shared map settings — English basemap and navigation (Rwanda operations).
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
  liveMap: 'Live tracking map',
  liveMapSubtitle: 'Real-time Smart Box GPS across Rwanda',
  pickupPin: 'Pickup location (A)',
  deliveryPin: 'Delivery location (B)',
  clickToPin: 'Tap the map to place your pin',
  resolvingLocation: 'Looking up address in Rwanda…',
  selectedLocation: 'Selected location',
  followGps: 'Follow live',
  followingGps: 'Following live',
  followGpsHint: 'Map camera follows the box in real time',
  fullscreen: 'Full screen',
  exitFullscreen: 'Exit full screen',
  closeFullscreen: 'Close',
  online: 'Online',
  offline: 'Offline',
  live: 'Live',
  tamperAlert: 'Tamper alert active',
  shockDetected: 'Shock detected',
  liveGpsFooter: 'Live GPS — position updates automatically as the Smart Box moves',
  liveTrackingActive: 'Live tracking active',
  realTimeGps: 'Real-time GPS from Smart Box hardware',
  pressEsc: 'Press Esc to exit full screen',
  navigatePickup: 'Directions to pickup',
  navigateDelivery: 'Directions to delivery',
  openInMaps: 'Open in Google Maps',
  openDirections: 'Get directions',
  noGpsSignal: 'Awaiting live GPS',
  noGpsHint: 'The map will show the Smart Box once the device is online and reporting its location in Rwanda.',
  liveLocation: 'Current position',
  locatedInRwanda: 'Located in Rwanda',
  coordinatesRwanda: 'GPS coordinates in Rwanda',
  lastUpdated: 'Last updated',
  routeDistance: 'Route distance',
  inTransit: 'In transit',
  smartBox: 'Smart Box',
  allDevices: 'All Smart Boxes',
  devicesOnMap: 'boxes on map',
  mapLoading: 'Loading map…',
};
