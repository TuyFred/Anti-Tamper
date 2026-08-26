/** Shared date/time formatting — Rwanda (Africa/Kigali) for alerts & emails */

export const APP_TIMEZONE = 'Africa/Kigali';
export const APP_LOCALE = 'en-GB';

export function formatDateTimeFull(iso, { withSeconds = true } = {}) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(APP_LOCALE, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: true,
      timeZone: APP_TIMEZONE,
    });
  } catch {
    return String(iso);
  }
}

export function formatRelativeTime(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return null;
  if (diff < 0) return 'Just now';
  if (diff < 8000) return 'Just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
  return null;
}

export function formatDateTimeLabel(iso) {
  const relative = formatRelativeTime(iso);
  const full = formatDateTimeFull(iso);
  return relative ? `${relative} · ${full}` : full;
}
