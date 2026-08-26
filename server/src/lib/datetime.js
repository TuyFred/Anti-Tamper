/** Shared date/time formatting — Rwanda (Africa/Kigali) for alerts & emails */

export const APP_TIMEZONE = 'Africa/Kigali';
export const APP_LOCALE = 'en-GB';

export function formatDateTimeFull(iso, { withSeconds = true } = {}) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(APP_LOCALE, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
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

export function formatEmailSentAt(iso = new Date().toISOString()) {
  return formatDateTimeFull(iso);
}
