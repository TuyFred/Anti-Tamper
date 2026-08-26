import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../config/supabase.js';
import {
  generateOtpCode,
  saveOtpEntry,
  verifyOtpEntry,
  otpStoreKey,
  canResend,
  OTP_TTL_MINUTES,
  RESEND_COOLDOWN_SECONDS,
} from '../lib/otpStore.js';
import {
  sendRegisterOtpEmail,
  sendPasswordResetOtpEmail,
  ensureEmailReady,
} from '../services/transactionalEmail.js';

import { isValidPhone, normalizePhone } from '../lib/phone.js';

const router = Router();

function authClient() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function supabaseReachableMessage(cause) {
  const code = cause?.code || cause?.errno;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'Supabase project not found. The URL in server/.env may be wrong or the project was deleted. Create a project at supabase.com and update SUPABASE_URL + keys.';
  }
  return 'Cannot reach Supabase. Check your internet connection and SUPABASE_URL in server/.env.';
}

/** Sign in — proxied through the API so the client gets clear errors when Supabase is unreachable */
router.post('/login', async (req, res) => {
  const email = req.body.email?.trim()?.toLowerCase();
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const client = authClient();
  if (!client) {
    return res.status(503).json({
      error: 'Server auth is not configured. Add SUPABASE_ANON_KEY to server/.env.',
      code: 'AUTH_NOT_CONFIGURED',
    });
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ error: error.message, code: error.code || 'INVALID_CREDENTIALS' });
    }
    if (!data.session) {
      return res.status(500).json({ error: 'Login succeeded but no session was returned.', code: 'NO_SESSION' });
    }
    return res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type,
      },
      user: data.user,
    });
  } catch (err) {
    console.error('Login error:', err?.cause?.message || err.message);
    return res.status(503).json({
      error: supabaseReachableMessage(err?.cause || err),
      code: 'SUPABASE_UNREACHABLE',
    });
  }
});

async function emailExists(normalizedEmail) {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();
  return Boolean(data);
}

async function createCustomerProfile(userId, normalizedEmail, fullName, phone) {
  const { data: customerRole } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'customer')
    .maybeSingle();

  const updates = {
    full_name: fullName || normalizedEmail,
    role_id: customerRole?.id,
    is_approved: true,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (phone) updates.phone = phone;

  let { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error && phone && /phone/.test(error.message)) {
    delete updates.phone;
    ({ error } = await supabase.from('profiles').update(updates).eq('id', userId));
  }
  if (error) console.warn('createCustomerProfile:', error.message);
}

/** Step 1 — customer registration: send OTP via Brevo */
router.post('/register/send-otp', async (req, res) => {
  const { email, password, full_name, phone } = req.body;
  const normalizedEmail = email?.trim()?.toLowerCase();
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Valid contact phone is required (e.g. 0781234567)' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  if (await emailExists(normalizedEmail)) {
    return res.status(400).json({ error: 'An account with this email already exists. Try signing in.' });
  }

  const emailStatus = ensureEmailReady();
  if (emailStatus) {
    return res.status(503).json({ error: emailStatus });
  }

  const key = otpStoreKey('register', normalizedEmail);
  if (!canResend(key)) {
    return res.status(429).json({
      error: `Please wait ${RESEND_COOLDOWN_SECONDS}s before requesting another code.`,
      resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
    });
  }

  const otp = generateOtpCode();
  const saved = saveOtpEntry(key, {
    otp,
    purpose: 'register',
    email: normalizedEmail,
    password,
    full_name: full_name?.trim() || normalizedEmail,
    phone: normalizedPhone,
  });

  if (!saved.ok) {
    return res.status(429).json({ error: saved.error });
  }

  const sent = await sendRegisterOtpEmail(normalizedEmail, otp);
  if (!sent.ok) {
    return res.status(503).json({
      error: sent.error || 'Could not send verification email via Brevo. Check server logs.',
    });
  }

  res.json({
    success: true,
    message: `Verification code sent. It is valid for ${OTP_TTL_MINUTES} minutes.`,
    expiresInMinutes: OTP_TTL_MINUTES,
    resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
  });
});

/** Step 2 — customer registration: verify OTP and create account */
router.post('/register/verify', async (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = email?.trim()?.toLowerCase();

  if (!normalizedEmail || !otp) {
    return res.status(400).json({ error: 'Email and verification code are required' });
  }

  const key = otpStoreKey('register', normalizedEmail);
  const verified = verifyOtpEntry(key, otp);
  if (!verified.ok) {
    return res.status(400).json({ error: verified.error });
  }

  const { password, full_name: fullName, phone } = verified.data;
  const normalizedPhone = normalizePhone(phone);

  if (await emailExists(normalizedEmail)) {
    return res.status(400).json({ error: 'An account with this email already exists. Try signing in.' });
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone: normalizedPhone },
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  await createCustomerProfile(authData.user.id, normalizedEmail, fullName, normalizedPhone);

  res.status(201).json({
    success: true,
    email: normalizedEmail,
    message: 'Account verified and created. You can sign in now.',
  });
});

/** Forgot password — send OTP */
router.post('/forgot-password', async (req, res) => {
  const normalizedEmail = req.body.email?.trim()?.toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const exists = await emailExists(normalizedEmail);
  const genericMessage = 'If an account exists for this email, a verification code has been sent.';

  if (!exists) {
    return res.json({ success: true, message: genericMessage });
  }

  const emailStatus = ensureEmailReady();
  if (emailStatus) {
    return res.status(503).json({ error: emailStatus });
  }

  const key = otpStoreKey('reset', normalizedEmail);
  if (!canResend(key)) {
    return res.status(429).json({
      error: `Please wait ${RESEND_COOLDOWN_SECONDS}s before requesting another code.`,
      resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
    });
  }

  const otp = generateOtpCode();
  const saved = saveOtpEntry(key, {
    otp,
    purpose: 'reset',
    email: normalizedEmail,
  });

  if (!saved.ok) {
    return res.status(429).json({ error: saved.error });
  }

  const sent = await sendPasswordResetOtpEmail(normalizedEmail, otp);
  if (!sent.ok) {
    return res.status(503).json({
      error: sent.error || 'Could not send reset email via Brevo. Check server logs.',
    });
  }

  res.json({
    success: true,
    message: `${genericMessage} The code is valid for ${OTP_TTL_MINUTES} minutes.`,
    expiresInMinutes: OTP_TTL_MINUTES,
    resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
  });
});

/** Reset password with OTP */
router.post('/reset-password', async (req, res) => {
  const { email, otp, password } = req.body;
  const normalizedEmail = email?.trim()?.toLowerCase();

  if (!normalizedEmail || !otp || !password) {
    return res.status(400).json({ error: 'Email, verification code, and new password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const key = otpStoreKey('reset', normalizedEmail);
  const verified = verifyOtpEntry(key, otp);
  if (!verified.ok) {
    return res.status(400).json({ error: verified.error });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!profile) {
    return res.status(400).json({ error: 'Account not found.' });
  }

  const { error } = await supabase.auth.admin.updateUserById(profile.id, {
    password,
    email_confirm: true,
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({
    success: true,
    message: 'Password updated. You can sign in with your new password.',
  });
});

export default router;
