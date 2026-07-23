import { config } from '../config/supabase.js';

function trimUrl(value) {
  return typeof value === 'string' ? value.trim().replace(/\/$/, '') : '';
}

/** Resolve the public API base URL for absolute upload links. */
export function resolvePublicBaseUrl(req) {
  const configured = trimUrl(config.publicBaseUrl);
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) {
    return configured;
  }

  const renderUrl = trimUrl(process.env.RENDER_EXTERNAL_URL);
  if (renderUrl) return renderUrl;

  if (req) {
    const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim()
      || (config.nodeEnv === 'production' ? 'https' : req.protocol)
      || 'https';
    const host = req.get('x-forwarded-host')?.split(',')[0]?.trim() || req.get('host');
    if (host && !/localhost|127\.0\.0\.1/i.test(host)) {
      return `${proto}://${host}`;
    }
  }

  return configured || `http://localhost:${config.port}`;
}

/** Turn stored upload paths into HTTPS production URLs (fixes localhost URLs in DB). */
export function normalizeVideoUrl(url, req) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  const base = resolvePublicBaseUrl(req);

  if (trimmed.startsWith('/uploads/')) {
    return `${base}${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    const isLocal = /localhost|127\.0\.0\.1/i.test(parsed.hostname);
    const isUploadPath = parsed.pathname.includes('/uploads/promo-videos/');

    if (isLocal && isUploadPath) {
      return `${base}${parsed.pathname}${parsed.search}`;
    }

    if (parsed.protocol === 'http:' && base.startsWith('https:') && isUploadPath) {
      return `${base}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

export function normalizePromoVideoRow(row, req) {
  if (!row) return row;
  return {
    ...row,
    video_url: normalizeVideoUrl(row.video_url, req),
    poster_url: row.poster_url ? normalizeVideoUrl(row.poster_url, req) : row.poster_url,
  };
}

export function normalizePromoVideoRows(rows, req) {
  return (rows || []).map((row) => normalizePromoVideoRow(row, req));
}

export function publicVideoUrl(filename, req) {
  return `${resolvePublicBaseUrl(req)}/uploads/promo-videos/${filename}`;
}
