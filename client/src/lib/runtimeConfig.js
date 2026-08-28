/**
 * Resolve API / Socket base URL for local Vite, Vercel, and Render.
 * Vite bakes VITE_* at build time. Never use localhost in a hosted build.
 */
const PRODUCTION_API_URL = 'https://anti-tamper.onrender.com';

function trimUrl(value) {
  return typeof value === 'string' ? value.trim().replace(/\/$/, '') : '';
}

function isLocalhostUrl(url) {
  return !url || /localhost|127\.0\.0\.1/i.test(url);
}

function hostedHostname() {
  if (typeof window === 'undefined') return '';
  return window.location.hostname || '';
}

/** Frontend is served from the same Render process as the API. */
function isSameOriginApiHost(host) {
  return host.endsWith('.onrender.com');
}

export function getApiBaseUrl() {
  const host = hostedHostname();
  if (isSameOriginApiHost(host)) return '';

  const fromEnv = trimUrl(import.meta.env.VITE_API_URL);
  if (fromEnv && !isLocalhostUrl(fromEnv)) return fromEnv;

  if (import.meta.env.PROD) return PRODUCTION_API_URL;
  if (import.meta.env.DEV) return '';
  return PRODUCTION_API_URL;
}

export function getSocketBaseUrl() {
  const host = hostedHostname();
  if (isSameOriginApiHost(host) && typeof window !== 'undefined') {
    return window.location.origin;
  }

  const fromEnv = trimUrl(import.meta.env.VITE_SOCKET_URL);
  if (fromEnv && !isLocalhostUrl(fromEnv)) return fromEnv;

  if (import.meta.env.PROD) return PRODUCTION_API_URL;
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return getApiBaseUrl() || PRODUCTION_API_URL;
}
