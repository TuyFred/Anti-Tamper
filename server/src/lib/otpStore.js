import crypto from 'crypto';

const store = new Map();
/** Wait before requesting another code — 10 seconds is enough with Brevo. */
export const RESEND_COOLDOWN_MS = 10 * 1000;
/** How long the 6-digit code stays valid. */
export const DEFAULT_TTL_MS = 10 * 60 * 1000;
export const OTP_TTL_MINUTES = Math.round(DEFAULT_TTL_MS / 60000);
export const RESEND_COOLDOWN_SECONDS = Math.round(RESEND_COOLDOWN_MS / 1000);
const MAX_ATTEMPTS = 5;

export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

export function canResend(key) {
  cleanupExpired();
  const entry = store.get(key);
  if (!entry?.lastSentAt) return true;
  return Date.now() - entry.lastSentAt >= RESEND_COOLDOWN_MS;
}

export function saveOtpEntry(key, payload, ttlMs = DEFAULT_TTL_MS) {
  cleanupExpired();
  const existing = store.get(key);
  const now = Date.now();

  if (existing && existing.lastSentAt && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
    return { ok: false, error: `Please wait ${waitSec}s before requesting a new code.` };
  }

  const { otp, ...rest } = payload;
  store.set(key, {
    ...rest,
    otpHash: hashOtp(otp),
    expiresAt: now + ttlMs,
    lastSentAt: now,
    attempts: 0,
  });

  return { ok: true };
}

export function verifyOtpEntry(key, otp) {
  cleanupExpired();
  const entry = store.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    store.delete(key);
    return { ok: false, error: 'Verification code expired. Request a new one.' };
  }

  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    store.delete(key);
    return { ok: false, error: 'Too many attempts. Request a new code.' };
  }

  if (hashOtp(otp) !== entry.otpHash) {
    return { ok: false, error: 'Invalid verification code.' };
  }

  store.delete(key);
  return { ok: true, data: entry };
}

export function otpStoreKey(purpose, email) {
  return `${purpose}:${email.trim().toLowerCase()}`;
}
