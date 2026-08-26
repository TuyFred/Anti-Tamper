/**
 * CORS origins for Express + Socket.IO (local Vite + Vercel + optional extra URLs).
 * Localhost is always allowed so hosted CLIENT_URL never blocks local dashboard.
 */
const LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];

export function getClientOrigins() {
  const urls = [...LOCAL_ORIGINS];

  if (process.env.CLIENT_URL?.trim()) {
    urls.push(process.env.CLIENT_URL.trim().replace(/\/$/, ''));
  }

  if (process.env.CLIENT_URLS?.trim()) {
    urls.push(
      ...process.env.CLIENT_URLS.split(',')
        .map((s) => s.trim().replace(/\/$/, ''))
        .filter(Boolean),
    );
  }

  return [...new Set(urls)];
}

function hostnameFromOrigin(origin) {
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}

/** Allow configured origins + localhost + any *.vercel.app preview/production URL. */
export function isAllowedClientOrigin(origin) {
  if (!origin) return true;

  const normalized = origin.replace(/\/$/, '');
  const origins = getClientOrigins();

  if (origins.includes(normalized)) return true;

  const host = hostnameFromOrigin(origin);
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host.endsWith('.vercel.app')) return true;

  return false;
}

export function corsOriginCallback(origin, callback) {
  // Use (null, false) — never Error — so preflight still gets a clean CORS response
  if (isAllowedClientOrigin(origin)) {
    callback(null, true);
  } else {
    console.warn(`CORS blocked origin: ${origin}`);
    callback(null, false);
  }
}
