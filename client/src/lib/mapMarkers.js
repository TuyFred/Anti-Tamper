import L from 'leaflet';

const TRUCK_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M18 18.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-10 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM20 8h-3V4H3v13h1.05a2.5 2.5 0 0 1 4.9 0H15a2.5 2.5 0 0 1 4.95 0H20V8zM18 11H5V6h10v2h3v3z"/></svg>`;

const BOX_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M20 8h-3V4H7v4H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-8 0H7V6h5v2zm8 10H4V10h16v10z"/></svg>`;

function markerHtml({ bg, ring, pulse, icon, label, size = 40 }) {
  const half = size / 2;
  return `
    <div class="map-marker-wrap" style="position:relative;width:${size}px;height:${size}px">
      ${pulse ? `<div class="map-marker-pulse" style="background:${ring || bg}"></div>` : ''}
      <div style="
        position:absolute;inset:0;
        background:${bg};
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 4px 14px rgba(0,0,0,0.45);
        display:flex;align-items:center;justify-content:center;
        ${ring ? `outline:2px solid ${ring};outline-offset:2px;` : ''}
      ">${icon}${label ? '' : ''}</div>
      ${label ? `<span class="map-marker-label">${label}</span>` : ''}
    </div>`;
}

function divIcon(html, size, anchor = null) {
  const a = anchor ?? size / 2;
  return new L.DivIcon({
    className: 'custom-map-marker',
    html,
    iconSize: [size, size + (html.includes('map-marker-label') ? 14 : 0)],
    iconAnchor: [a, a],
    popupAnchor: [0, -a],
  });
}

/** Live Smart Box — blue with optional live pulse ring */
export function createSmartBoxIcon({ selected = false, online = false, alert = false } = {}) {
  const size = selected ? 44 : 38;
  const bg = alert ? '#ef4444' : '#0ea5e9';
  const ring = selected ? '#60a5fa' : online ? '#10b981' : null;
  return divIcon(
    markerHtml({
      bg,
      ring,
      pulse: online && !alert,
      icon: BOX_SVG,
      size,
    }),
    size,
  );
}

/** Delivery truck — rider / in-transit */
export function createTruckIcon({ selected = false } = {}) {
  const size = selected ? 44 : 40;
  return divIcon(
    markerHtml({
      bg: '#2563eb',
      ring: selected ? '#60a5fa' : '#3b82f6',
      pulse: true,
      icon: TRUCK_SVG,
      size,
    }),
    size,
  );
}

/** Pickup A — green pin with label */
export function createPickupIcon() {
  const size = 36;
  return divIcon(
    markerHtml({
      bg: '#10b981',
      icon: '<span style="color:white;font-weight:800;font-size:13px;font-family:Inter,sans-serif">A</span>',
      label: 'Pickup',
      size,
    }),
    size,
  );
}

/** Delivery B — blue pin with label */
export function createDeliveryIcon() {
  const size = 36;
  return divIcon(
    markerHtml({
      bg: '#3b82f6',
      icon: '<span style="color:white;font-weight:800;font-size:13px;font-family:Inter,sans-serif">B</span>',
      label: 'Delivery',
      size,
    }),
    size,
  );
}

/** Mid-route truck badge (decorative on polyline) */
export function createRouteTruckBadge() {
  return divIcon(
    markerHtml({
      bg: '#1d4ed8',
      ring: '#60a5fa',
      pulse: true,
      icon: TRUCK_SVG,
      size: 34,
    }),
    34,
  );
}
