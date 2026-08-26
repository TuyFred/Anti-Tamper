import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import {
  authenticate,
  requireApproved,
  requireAdmin,
  requirePermission,
} from '../middleware/auth.js';
import { getAccessibleDevices, canAccessDevice } from '../middleware/permissions.js';
import { sendDeviceCommand, createUnauthorizedAlert, broadcastDeviceUpdate } from '../mqtt/handler.js';

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

  const normalizedId = String(device_id).trim().toUpperCase();

  const { data, error } = await supabase
    .from('devices')
    .insert({ device_id: normalizedId, name, description })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:deviceId', authenticate, requireApproved, requireAdmin, async (req, res) => {
  const { deviceId } = req.params;
  const { device_id, name, description, latitude, longitude, clear_location } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name?.trim() || name;
  if (description !== undefined) updates.description = description;
  if (device_id !== undefined) {
    const normalized = String(device_id).trim().toUpperCase();
    if (!normalized) {
      return res.status(400).json({ error: 'device_id cannot be empty' });
    }
    updates.device_id = normalized;
  }
  if (clear_location) {
    updates.latitude = null;
    updates.longitude = null;
  } else {
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;
  }

  const { data, error } = await supabase
    .from('devices')
    .update(updates)
    .eq('id', deviceId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'That hardware ID is already registered' });
    }
    return res.status(500).json({ error: error.message });
  }
  if (!data) return res.status(404).json({ error: 'Device not found' });
  res.json(data);
});

router.post('/:deviceId/unlock', authenticate, requireApproved, async (req, res) => {
  const { deviceId } = req.params;

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

  try {
    sendDeviceCommand(device.device_id, 'unlock', { authorized: true, user_id: req.user.id });
  } catch (err) {
    return res.status(503).json({
      error: err.message || 'MQTT offline — cannot unlock. Check MQTT_BROKER_URL and ESP32 connection.',
    });
  }
  const updatedAt = new Date().toISOString();
  await supabase
    .from('devices')
    .update({ lock_status: 'unlocked', updated_at: updatedAt })
    .eq('id', deviceId);

  broadcastDeviceUpdate({ ...device, lock_status: 'unlocked', updated_at: updatedAt, is_online: true });

  res.json({ success: true, message: 'Unlock command sent — box should open now' });
});

router.post('/:deviceId/lock', authenticate, requireApproved, async (req, res) => {
  const { deviceId } = req.params;
  const canControl = await canAccessDevice(req.user.id, deviceId, true);
  if (!canControl) {
    return res.status(403).json({ error: 'Only admins and managers can lock boxes remotely' });
  }

  const { data: device, error } = await supabase
    .from('devices')
    .select('*')
    .eq('id', deviceId)
    .single();

  if (error || !device) return res.status(404).json({ error: 'Device not found' });

  try {
    sendDeviceCommand(device.device_id, 'lock');
  } catch (err) {
    return res.status(503).json({
      error: err.message || 'MQTT offline — cannot lock. Check MQTT_BROKER_URL and ESP32 connection.',
    });
  }

  const updatedAt = new Date().toISOString();
  await supabase
    .from('devices')
    .update({ lock_status: 'locked', updated_at: updatedAt })
    .eq('id', deviceId);

  broadcastDeviceUpdate({ ...device, lock_status: 'locked', updated_at: updatedAt, is_online: true });

  res.json({ success: true, message: 'Lock command sent — box should close now' });
});

router.post('/:deviceId/alarm', authenticate, requireApproved, async (req, res) => {
  const { deviceId } = req.params;
  const { active = true } = req.body;
  const canControl = await canAccessDevice(req.user.id, deviceId, true);
  if (!canControl) {
    return res.status(403).json({ error: 'Only admins and managers can trigger alarms' });
  }

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
