/** Normalize Rwanda mobile numbers for tel: links */
export function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 9) return null;
  if (digits.startsWith('250')) return `+${digits}`;
  if (digits.startsWith('0')) return `+250${digits.slice(1)}`;
  if (digits.length === 9) return `+250${digits}`;
  return `+${digits}`;
}

export function formatPhoneDisplay(phone) {
  return normalizePhone(phone) || phone || '';
}

export function phoneTelHref(phone) {
  const normalized = normalizePhone(phone);
  return normalized ? `tel:${normalized}` : null;
}

export function isValidPhone(phone) {
  return Boolean(normalizePhone(phone));
}
