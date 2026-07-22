import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate, requireApproved } from '../middleware/auth.js';
import { canAccessDevice, isAdmin } from '../middleware/permissions.js';

const router = Router();

router.get('/', authenticate, requireApproved, async (req, res) => {
  let query = supabase
    .from('alerts')
    .select('*, device:devices(id, device_id, name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!isAdmin(req.profile)) {
    const { data: access } = await supabase
      .from('device_access')
      .select('device_id')
      .eq('user_id', req.user.id)
      .eq('can_view', true);

    const deviceIds = (access || []).map((a) => a.device_id);
    if (deviceIds.length === 0) return res.json([]);
    query = query.in('device_id', deviceIds);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/device/:deviceId', authenticate, requireApproved, async (req, res) => {
  const { deviceId } = req.params;
  const hasAccess = await canAccessDevice(req.user.id, deviceId);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabase
    .from('alerts')
    .select('*, device:devices(id, device_id, name)')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:alertId/acknowledge', authenticate, requireApproved, async (req, res) => {
  const { alertId } = req.params;

  const { data: alert, error: fetchError } = await supabase
    .from('alerts')
    .select('*')
    .eq('id', alertId)
    .single();

  if (fetchError || !alert) return res.status(404).json({ error: 'Alert not found' });

  const hasAccess = await canAccessDevice(req.user.id, alert.device_id);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabase
    .from('alerts')
    .update({
      is_acknowledged: true,
      acknowledged_by: req.user.id,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', alertId)
    .select('*, device:devices(id, device_id, name)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
