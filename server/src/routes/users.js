import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../config/supabase.js';
import {
  authenticate,
  authenticateToken,
  requireApproved,
  requireAdmin,
} from '../middleware/auth.js';
import { getPermissions } from '../middleware/permissions.js';
import { ensureUserProfile } from '../lib/profile.js';
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

/** @deprecated Use POST /api/auth/register/send-otp + /verify (customer OTP flow) */
router.post('/register', async (req, res) => {
  res.status(410).json({
    error: 'Direct registration is disabled. Use email verification — register on the login page.',
    code: 'USE_OTP_REGISTER',
  });
});

router.get('/me', authenticateToken, async (req, res) => {
  const profile = (await ensureUserProfile(req.user)) || req.profile;
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found — contact support' });
  }
  res.json({
    user: { id: req.user.id, email: req.user.email },
    profile,
    permissions: getPermissions(profile),
  });
});

/** Update own profile — name, email, phone, password */
router.patch('/me', authenticate, requireApproved, async (req, res) => {
  const {
    full_name: fullName,
    email,
    phone,
    current_password: currentPassword,
    new_password: newPassword,
  } = req.body;

  const userId = req.user.id;
  const authUpdates = {};
  const profileUpdates = { updated_at: new Date().toISOString() };

  if (fullName !== undefined) {
    const trimmed = String(fullName).trim();
    if (!trimmed) return res.status(400).json({ error: 'Full name cannot be empty' });
    profileUpdates.full_name = trimmed;
    authUpdates.user_metadata = {
      ...(req.user.user_metadata || {}),
      full_name: trimmed,
    };
  }

  if (phone !== undefined) {
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone — use format 0781234567 or +250781234567' });
    }
    profileUpdates.phone = phone ? normalizePhone(phone) : null;
    authUpdates.user_metadata = {
      ...(authUpdates.user_metadata || req.user.user_metadata || {}),
      phone: profileUpdates.phone,
    };
  }

  const normalizedEmail = email?.trim()?.toLowerCase();
  if (normalizedEmail && normalizedEmail !== req.user.email?.toLowerCase()) {
    authUpdates.email = normalizedEmail;
    profileUpdates.email = normalizedEmail;
  }

  if (newPassword) {
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to set a new password' });
    }
    const client = authClient();
    if (!client) {
      return res.status(503).json({ error: 'Password change is not configured on the server' });
    }
    const { error: verifyError } = await client.auth.signInWithPassword({
      email: req.user.email,
      password: currentPassword,
    });
    if (verifyError) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    authUpdates.password = newPassword;
  }

  if (Object.keys(authUpdates).length > 0) {
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, authUpdates);
    if (authError) {
      const msg = authError.message || 'Could not update account';
      const status = /password|email|invalid/i.test(msg) ? 400 : 500;
      return res.status(status).json({ error: msg });
    }
  }

  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdates)
    .eq('id', userId)
    .select('*, role:roles(id, name)')
    .single();

  if (profileError && profileUpdates.phone !== undefined && /phone/.test(profileError.message)) {
    const { phone: _p, ...withoutPhone } = profileUpdates;
    ({ data: profile, error: profileError } = await supabase
      .from('profiles')
      .update(withoutPhone)
      .eq('id', userId)
      .select('*, role:roles(id, name)')
      .single());
  }

  if (profileError) return res.status(500).json({ error: profileError.message });

  res.json({
    user: { id: userId, email: profile.email || req.user.email },
    profile,
    permissions: getPermissions(profile),
    message: newPassword ? 'Profile and password updated' : 'Profile updated',
  });
});

router.get('/roles', authenticate, requireApproved, async (req, res) => {
  const { data, error } = await supabase.from('roles').select('*').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/', authenticate, requireApproved, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, role:roles(id, name)')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/pending', authenticate, requireApproved, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, role:roles(id, name)')
    .eq('is_approved', false)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', authenticate, requireApproved, requireAdmin, async (req, res) => {
  const {
    email,
    password,
    full_name,
    role_id,
    is_approved = true,
    grant_device_access = true,
    device_id: assignDeviceId,
    can_control = false,
  } = req.body;

  const normalizedEmail = email?.trim()?.toLowerCase();
  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || normalizedEmail },
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  const userId = authData.user.id;

  let resolvedRoleId = role_id;
  if (!resolvedRoleId) {
    const { data: viewerRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'viewer')
      .single();
    resolvedRoleId = viewerRole?.id;
  }

  const profileUpdates = {
    full_name: full_name || normalizedEmail,
    role_id: resolvedRoleId,
    is_approved,
    updated_at: new Date().toISOString(),
  };

  if (is_approved) {
    profileUpdates.approved_by = req.user.id;
    profileUpdates.approved_at = new Date().toISOString();
  }

  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdates)
    .eq('id', userId)
    .select('*, role:roles(id, name)')
    .single();

  if (profileError || !profile) {
    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: normalizedEmail,
        ...profileUpdates,
      })
      .select('*, role:roles(id, name)')
      .single();

    if (insertError) {
      await supabase.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: insertError.message });
    }
    profile = inserted;
  }

  if (grant_device_access && is_approved) {
    const { data: devices } = await supabase.from('devices').select('id');
    const targetDeviceId = assignDeviceId || devices?.[0]?.id;

    if (targetDeviceId) {
      await supabase.from('device_access').upsert(
        {
          user_id: userId,
          device_id: targetDeviceId,
          can_view: true,
          can_control: Boolean(can_control),
          granted_by: req.user.id,
          granted_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,device_id' }
      );
    }
  }

  res.status(201).json(profile);
});

router.post('/:userId/approve', authenticate, requireApproved, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { role_id } = req.body;

  const updates = {
    is_approved: true,
    approved_by: req.user.id,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (role_id) updates.role_id = role_id;

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*, role:roles(id, name)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:userId/reject', authenticate, requireApproved, requireAdmin, async (req, res) => {
  const { userId } = req.params;

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.post('/:userId/reset-password', authenticate, requireApproved, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (error) return res.status(400).json({ error: error.message });

  res.json({ success: true });
});

router.patch('/:userId/role', authenticate, requireApproved, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { role_id } = req.body;

  const { data, error } = await supabase
    .from('profiles')
    .update({ role_id, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('*, role:roles(id, name)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/:userId', authenticate, requireApproved, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { full_name, role_id, is_approved } = req.body;

  if (userId === req.user.id && is_approved === false) {
    return res.status(400).json({ error: 'Cannot revoke your own approval' });
  }

  const updates = { updated_at: new Date().toISOString() };
  if (full_name !== undefined) updates.full_name = full_name;
  if (role_id !== undefined) updates.role_id = role_id;
  if (is_approved !== undefined) {
    updates.is_approved = is_approved;
    if (is_approved) {
      updates.approved_by = req.user.id;
      updates.approved_at = new Date().toISOString();
    } else {
      updates.approved_by = null;
      updates.approved_at = null;
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*, role:roles(id, name)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:userId', authenticate, requireApproved, requireAdmin, async (req, res) => {
  const { userId } = req.params;

  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
