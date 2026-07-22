import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import {
  authenticate,
  requireApproved,
  requireAdmin,
  requirePermission,
} from '../middleware/auth.js';
import { getAccessibleDevices, canAccessDevice } from '../middleware/permissions.js';
import { sendDeviceCommand, createUnauthorizedAlert } from '../mqtt/handler.js';

const router = Router();

router.get('/', authenticate, requireApproved, async (req, res) => {
  const devices = await getAccessibleDevices(req.user.id);
  res.json(devices);
});

// Admin: list all device access grants (must be before /:deviceId)
router.get('/access/list', authenticate, requireApproved, requireAdmin, async (req, res) => {
  const { data: access, error } = await supabase
    .from('device_access')
    .select('*, device:devices(id, device_id, name)')
    .order('granted_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const userIds = [...new Set((access || []).map((a) => a.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const enriched = (access || []).map((row) => ({
    ...row,
    user: profiles?.find((p) => p.id === row.user_id) || null,
  }));

  res.json(enriched);
});

router.get('/:deviceId', authenticate, requireApproved, async (req, res) => {
  const { deviceId } = req.params;
  const hasAccess = await canAccessDevice(req.user.id, deviceId);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('id', deviceId)
    .single();

  if (error) return res.status(404).json({ error: 'Device not found' });
  res.json(data);
});

router.post('/', authenticate, requireApproved, requireAdmin, async (req, res) => {
  const { device_id, name, description } = req.body;
  if (!device_id || !name) {
    return res.status(400).json({ error: 'device_id and name are required' });
  }

  const { data, error } = await supabase
    .from('devices')
    .insert({ device_id, name, description })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.post('/:deviceId/unlock', authenticate, requireApproved, async (req, res) => {
  const { deviceId } = req.params;

  if (!req.profile.is_approved) {
    const { data: device } = await supabase.from('devices').select('*').eq('id', deviceId).single();
    if (device) {
      await createUnauthorizedAlert(device, req.user.id);
      sendDeviceCommand(device.device_id, 'alarm', { reason: 'unauthorized' });
    }
    return res.status(403).json({ error: 'Account not approved', code: 'PENDING_APPROVAL' });
  }

  const canControl = await canAccessDevice(req.user.id, deviceId, true);
  if (!canControl) {
    const { data: device } = await supabase.from('devices').select('*').eq('id', deviceId).single();
    if (device) {
      await createUnauthorizedAlert(device, req.user.id);
      sendDeviceCommand(device.device_id, 'alarm', { reason: 'unauthorized' });
    }
    return res.status(403).json({ error: 'No control permission for this device' });
  }

  const { data: device, error } = await supabase
    .from('devices')
    .select('*')
    .eq('id', deviceId)
    .single();

  if (error || !device) return res.status(404).json({ error: 'Device not found' });

  sendDeviceCommand(device.device_id, 'unlock', { authorized: true, user_id: req.user.id });
  await supabase
    .from('devices')
    .update({ lock_status: 'unlocked', updated_at: new Date().toISOString() })
    .eq('id', deviceId);

  res.json({ success: true, message: 'Unlock command sent' });
});

router.post('/:deviceId/lock', authenticate, requireApproved, async (req, res) => {
  const { deviceId } = req.params;
  const canControl = await canAccessDevice(req.user.id, deviceId, true);
  if (!canControl) return res.status(403).json({ error: 'No control permission' });

  const { data: device, error } = await supabase
    .from('devices')
    .select('*')
    .eq('id', deviceId)
    .single();

  if (error || !device) return res.status(404).json({ error: 'Device not found' });

  sendDeviceCommand(device.device_id, 'lock');
  await supabase
    .from('devices')
    .update({ lock_status: 'locked', updated_at: new Date().toISOString() })
    .eq('id', deviceId);

  res.json({ success: true, message: 'Lock command sent' });
});

router.post('/:deviceId/alarm', authenticate, requireApproved, async (req, res) => {
  const { deviceId } = req.params;
  const { active = true } = req.body;
  const canControl = await canAccessDevice(req.user.id, deviceId, true);
  if (!canControl) return res.status(403).json({ error: 'No control permission' });

  const { data: device, error } = await supabase
    .from('devices')
    .select('*')
    .eq('id', deviceId)
    .single();

  if (error || !device) return res.status(404).json({ error: 'Device not found' });

  sendDeviceCommand(device.device_id, 'alarm', { active, buzzer: active, led: active });
  await supabase
    .from('devices')
    .update({
      buzzer_active: active,
      led_active: active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', deviceId);

  res.json({ success: true, message: active ? 'Alarm activated' : 'Alarm deactivated' });
});

router.post('/:deviceId/access', authenticate, requireApproved, requireAdmin, async (req, res) => {
  const { deviceId } = req.params;
  const { user_id, can_view = true, can_control = false } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  const { data: deviceRow, error: deviceErr } = await supabase
    .from('devices')
    .select('id, device_id, name')
    .eq('id', deviceId)
    .single();

  if (deviceErr || !deviceRow) {
    return res.status(404).json({ error: 'Device not found' });
  }

  const { data: targetProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, is_approved, role:roles(name)')
    .eq('id', user_id)
    .single();

  if (profileErr || !targetProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (targetProfile.role?.name === 'admin') {
    return res.status(400).json({ error: 'Admins already have full access to all devices' });
  }

  if (!targetProfile.is_approved) {
    await supabase
      .from('profiles')
      .update({
        is_approved: true,
        approved_by: req.user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user_id);
  }

  const { data, error } = await supabase
    .from('device_access')
    .upsert({
      user_id,
      device_id: deviceId,
      can_view,
      can_control,
      granted_by: req.user.id,
      granted_at: new Date().toISOString(),
    }, { onConflict: 'user_id,device_id' })
    .select('*, device:devices(id, device_id, name)')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    ...data,
    user: {
      id: targetProfile.id,
      email: targetProfile.email,
      full_name: targetProfile.full_name,
    },
  });
});

router.delete('/:deviceId/access/:userId', authenticate, requireApproved, requireAdmin, async (req, res) => {
  const { deviceId, userId } = req.params;

  const { error } = await supabase
    .from('device_access')
    .delete()
    .eq('device_id', deviceId)
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
