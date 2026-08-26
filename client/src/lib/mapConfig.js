/**

 * Map settings — English labels, OpenStreetMap tiles.

 */

export const MAP_LANG = 'en';

export const MAP_REGION = 'RW';



export const MAP_TILE_CONFIG = {
  /** OpenStreetMap — real streets, sector roads, and place names at zoom 15+ */
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  subdomains: 'abc',
  maxZoom: 19,
  minZoom: 11,
};



export const MAP_LABELS = {

  liveMap: 'Live map',

  liveMapSubtitle: 'Live path shows where the box is going',

  pickupPin: 'Pickup (A)',

  deliveryPin: 'Delivery (B)',

  clickToPin: 'Tap the map to set location',

  useMyLocation: 'Use my location',

  locatingYou: 'Getting location…',

  myLocation: 'You',

  myLocationHint: 'Allow location in your browser',

  locationDenied: 'Location blocked',

  locationDeniedHint: 'Enable location in settings, then try again',

  hardwareGps: 'Box GPS (live)',

  fallbackGps: 'Phone / laptop GPS',

  customerLiveGps: 'Customer (live GPS)',

  riderLiveGps: 'Rider (live GPS)',

  deliveryAddressPin: 'Delivery address',

  resolvingLocation: 'Finding address…',

  selectedLocation: 'Selected',

  followGps: 'Follow box',

  followingGps: 'Following box',

  followGpsHint: 'Map follows the Smart Box',

  showBoxOnMap: 'Show box on map',

  followMe: 'Follow me',

  followingMe: 'Following you',

  fullscreen: 'Full screen',

  exitFullscreen: 'Exit full screen',

  closeFullscreen: 'Close',

  online: 'Online',

  offline: 'Offline',

  live: 'Live',

  liveNow: 'Live',

  tamperAlert: 'Tamper alert',

  shockDetected: 'Shock detected',

  liveGpsFooter: 'GPS updates from the Smart Box',

  liveTrackingActive: 'Live tracking',

  realTimeGps: 'Smart Box GPS on map',

  pressEsc: 'Press Esc to close',

  navigatePickup: 'Pickup on map',

  navigateDelivery: 'Delivery on map',

  navigateFullRoute: 'Full route',

  openInMaps: 'View on map',

  openDirections: 'View on map',

  viewOnMap: 'View on map',

  noGpsSignal: 'Waiting for box GPS',

  noGpsHint: 'Map centers on your phone/laptop GPS until the box sends GPS. Your marker (cyan) and box marker (blue) stay separate.',
  mapUsingYourLocation: 'Your location (box GPS waiting)',

  enableLocation: 'Allow location',

  mapLoading: 'Loading map…',

  locatedInRwanda: 'Rwanda',

  coordinatesRwanda: 'Coordinates',

  lastUpdated: 'Updated',

  routeDistance: 'Distance',

  inTransit: 'In transit',

  smartBox: 'Smart Box',

  allDevices: 'Boxes',

  devicesOnMap: 'on map',

  liveLocation: 'Position',

  riderEnRoute: 'On the way',

  boxAtPickup: 'At pickup',

  legendA: 'Pickup',

  legendB: 'Customer',
  legendBox: 'Smart Box',
  legendCustomer: 'Customer',
  deviceIdLabel: 'Device ID',
  yourLocationTitle: 'Your location',
  deviceLocationTitle: 'Box location',
  customerLocationTitle: 'Customer location',
  riderLocationTitle: 'Your location (rider)',
  waitingDeviceGps: 'Waiting for GPS from this box',
  lastKnownPosition: 'Last known position',
  registerDeviceHint: 'Use the same ID in firmware and Admin (e.g. BOX-001)',
  noGpsForDevice: 'No GPS yet',
  movementPath: 'Movement path',
  heading: 'Heading',
  enableLocationTitle: 'Enable live GPS',
  enableLocationHint: 'Allow location on your phone or laptop to see yourself on the map and share with rider/customer.',
  locationNeedsHttps: 'Secure connection required',
  riderLiveLocation: 'Rider (live GPS)',
  customerLiveLocation: 'Customer (live GPS)',
  sharingLocation: 'Sharing your location',
  liveGpsActive: 'Live GPS active',
};

