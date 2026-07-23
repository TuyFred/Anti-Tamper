/**
 * Resolve API / Socket base URL for dev vs Vercel production.
 * Vite bakes VITE_* at build time; fallback helps when VITE_API_URL was not set on Vercel.
 */
const PRODUCTION_API_URL = 'https://anti-tamper.onrender.com';

function trimUrl(value) {
  return typeof value === 'string' ? value.trim().replace(/\/$/, '') : '';
}

function isLocalhostUrl(url) {
  return !url || /localhost|127\.0\.0\.1/i.test(url);
}

function isVercelProductionHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.endsWith('.vercel.app') || host === 'anti-tamper.vercel.app';
}

export function getApiBaseUrl() {
  const fromEnv = trimUrl(import.meta.env.VITE_API_URL);
  if (fromEnv && !isLocalhostUrl(fromEnv)) return fromEnv;
  if (import.meta.env.PROD && isVercelProductionHost()) return PRODUCTION_API_URL;
  return fromEnv || 'http://localhost:3001';
}

export function getSocketBaseUrl() {
  const fromEnv = trimUrl(import.meta.env.VITE_SOCKET_URL);
  if (fromEnv && !isLocalhostUrl(fromEnv)) return fromEnv;
  if (import.meta.env.PROD && isVercelProductionHost()) return PRODUCTION_API_URL;
  return getApiBaseUrl();
}
