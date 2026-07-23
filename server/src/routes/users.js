import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import {
  authenticate,
  requireApproved,
  requireAdmin,
} from '../middleware/auth.js';
import { getPermissions } from '../middleware/permissions.js';

const router = Router();

router.get('/me', authenticate, async (req, res) => {
  res.json({
    user: { id: req.user.id, email: req.user.email },
    profile: req.profile,
    permissions: getPermissions(req.profile),
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

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || email },
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
    full_name: full_name || email,
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
        email,
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

  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
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
