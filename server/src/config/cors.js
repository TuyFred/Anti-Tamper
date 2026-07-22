/**
 * CORS origins for Express + Socket.IO (Vercel client + optional extra URLs).
 */
export function getClientOrigins() {
  const urls = [];

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

  if (urls.length === 0) {
    urls.push('http://localhost:5173');
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

/** Allow configured origins + any *.vercel.app preview/production URL. */
export function isAllowedClientOrigin(origin) {
  if (!origin) return true;

  const normalized = origin.replace(/\/$/, '');
  const origins = getClientOrigins();

  if (origins.includes(normalized)) return true;

  const host = hostnameFromOrigin(origin);
  if (host.endsWith('.vercel.app')) return true;

  return false;
}

export function corsOriginCallback(origin, callback) {
  if (isAllowedClientOrigin(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`CORS blocked origin: ${origin}`));
  }
}
