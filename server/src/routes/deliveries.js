import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { deliveryConfig } from '../config/delivery.js';
import {
  authenticate, requireApproved, requireManager,
} from '../middleware/auth.js';
import { isCustomer, isManager, isRider } from '../middleware/permissions.js';
import { calculateDeliveryPrice, generateUnlockToken } from '../services/pricing.js';
import { sendDeviceCommand } from '../mqtt/handler.js';

const router = Router();

const DELIVERY_SELECT = `
  *,
  customer:profiles!delivery_requests_customer_id_fkey(id, email, full_name),
  rider:profiles!delivery_requests_rider_id_fkey(id, email, full_name),
  device:devices(id, device_id, name, lock_status, is_online)
`;

async function getDeliveryById(id) {
  const { data, error } = await supabase
    .from('delivery_requests')
    .select(DELIVERY_SELECT)
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

async function lockDevice(deviceRow) {
  if (!deviceRow?.device_id) return;
  sendDeviceCommand(deviceRow.device_id, 'lock');
  await supabase
    .from('devices')
    .update({ lock_status: 'locked', updated_at: new Date().toISOString() })
    .eq('id', deviceRow.id);
}

async function unlockDevice(deviceRow, userId) {
  if (!deviceRow?.device_id) return;
  sendDeviceCommand(deviceRow.device_id, 'unlock', { authorized: true, user_id: userId });
  await supabase
    .from('devices')
    .update({ lock_status: 'unlocked', updated_at: new Date().toISOString() })
    .eq('id', deviceRow.id);
}

router.get('/public/config', (_req, res) => {
  res.json({
    currency: deliveryConfig.currency,
    baseFare: deliveryConfig.baseFare,
    ratePerKm: deliveryConfig.ratePerKm,
    payment: deliveryConfig.payment,
    whatsapp: deliveryConfig.whatsapp,
  });
});

router.post('/public/estimate', (req, res) => {
  const { distance_km } = req.body;
  res.json(calculateDeliveryPrice(distance_km));
});

router.get('/config', authenticate, requireApproved, (_req, res) => {
  res.json({
    currency: deliveryConfig.currency,
    baseFare: deliveryConfig.baseFare,
    ratePerKm: deliveryConfig.ratePerKm,
    payment: deliveryConfig.payment,
    whatsapp: deliveryConfig.whatsapp,
  });
});

router.post('/estimate', authenticate, requireApproved, (req, res) => {
  const { distance_km } = req.body;
  res.json(calculateDeliveryPrice(distance_km));
});

router.get('/', authenticate, requireApproved, async (req, res) => {
  let query = supabase.from('delivery_requests').select(DELIVERY_SELECT).order('created_at', { ascending: false });

  if (isCustomer(req.profile)) {
    query = query.eq('customer_id', req.user.id);
  } else if (isRider(req.profile)) {
    query = query.eq('rider_id', req.user.id);
  } else if (!isManager(req.profile)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/', authenticate, requireApproved, async (req, res) => {
  if (!isCustomer(req.profile) && !isManager(req.profile)) {
    return res.status(403).json({ error: 'Only customers can request deliveries' });
  }

  const {
    pickup_address, delivery_address, distance_km, payment_method,
    package_type, is_confidential, pickup_details, delivery_details,
    pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude,
    special_instructions,
  } = req.body;

  if (!pickup_address?.trim() || !delivery_address?.trim()) {
    return res.status(400).json({ error: 'Pickup and delivery addresses are required' });
  }

  const pricing = calculateDeliveryPrice(distance_km);
  const customerId = isManager(req.profile) && req.body.customer_id
    ? req.body.customer_id
    : req.user.id;

  const row = {
    customer_id: customerId,
    pickup_address: pickup_address.trim(),
    delivery_address: delivery_address.trim(),
    distance_km: pricing.distance_km,
    calculated_price: pricing.calculated_price,
    currency: pricing.currency,
    payment_method: payment_method || null,
    status: 'awaiting_payment',
  };

  if (package_type) row.package_type = package_type;
  if (is_confidential != null) row.is_confidential = Boolean(is_confidential);
  if (pickup_details) row.pickup_details = pickup_details;
  if (delivery_details) row.delivery_details = delivery_details;
  if (pickup_latitude != null) row.pickup_latitude = pickup_latitude;
  if (pickup_longitude != null) row.pickup_longitude = pickup_longitude;
  if (delivery_latitude != null) row.delivery_latitude = delivery_latitude;
  if (delivery_longitude != null) row.delivery_longitude = delivery_longitude;
  if (special_instructions) row.special_instructions = special_instructions;

  const { data, error } = await supabase
    .from('delivery_requests')
    .insert(row)
    .select(DELIVERY_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.post('/:id/payment-proof', authenticate, requireApproved, async (req, res) => {
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  if (delivery.customer_id !== req.user.id && !isManager(req.profile)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!['awaiting_payment', 'payment_submitted'].includes(delivery.status)) {
    return res.status(400).json({ error: 'Payment proof cannot be submitted for this delivery' });
  }

  const { payment_proof_url, payment_method } = req.body;
  if (!payment_proof_url?.trim()) {
    return res.status(400).json({ error: 'Payment proof is required (upload image or paste reference)' });
  }

  const { data, error } = await supabase
    .from('delivery_requests')
    .update({
      payment_proof_url: payment_proof_url.trim(),
      payment_method: payment_method || delivery.payment_method || 'momo',
      payment_submitted_at: new Date().toISOString(),
      status: 'payment_submitted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', delivery.id)
    .select(DELIVERY_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:id/verify-payment', authenticate, requireApproved, requireManager, async (req, res) => {
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  if (delivery.status !== 'payment_submitted') {
    return res.status(400).json({ error: 'No payment proof to verify' });
  }

  const { data, error } = await supabase
    .from('delivery_requests')
    .update({
      status: 'payment_verified',
      payment_verified_at: new Date().toISOString(),
      payment_verified_by: req.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', delivery.id)
    .select(DELIVERY_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:id/assign-rider', authenticate, requireApproved, requireManager, async (req, res) => {
  const { rider_id, device_id } = req.body;
  if (!rider_id || !device_id) {
    return res.status(400).json({ error: 'rider_id and device_id are required' });
  }

  const delivery = await getDeliveryById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  if (!['payment_verified', 'rider_assigned'].includes(delivery.status)) {
    return res.status(400).json({ error: 'Payment must be verified before assigning a rider' });
  }

  const token = generateUnlockToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + deliveryConfig.tokenExpiryHours);

  const { data: device } = await supabase.from('devices').select('*').eq('id', device_id).single();
  if (!device) return res.status(404).json({ error: 'Device not found' });

  await lockDevice(device);

  const { data, error } = await supabase
    .from('delivery_requests')
    .update({
      rider_id,
      device_id,
      status: 'rider_assigned',
      unlock_token: token,
      token_expires_at: expires.toISOString(),
      token_used_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', delivery.id)
    .select(DELIVERY_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:id/start-transit', authenticate, requireApproved, async (req, res) => {
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

  const isAssignedRider = delivery.rider_id === req.user.id;
  if (!isAssignedRider && !isManager(req.profile)) {
    return res.status(403).json({ error: 'Only assigned rider or manager can update' });
  }
  if (delivery.status !== 'rider_assigned') {
    return res.status(400).json({ error: 'Delivery must be assigned first' });
  }

  const { data, error } = await supabase
    .from('delivery_requests')
    .update({ status: 'in_transit', updated_at: new Date().toISOString() })
    .eq('id', delivery.id)
    .select(DELIVERY_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:id/unlock', authenticate, requireApproved, async (req, res) => {
  const { token } = req.body;
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

  if (delivery.customer_id !== req.user.id && !isManager(req.profile)) {
    return res.status(403).json({ error: 'Only the customer can unlock with token' });
  }
  if (!['rider_assigned', 'in_transit'].includes(delivery.status)) {
    return res.status(400).json({ error: 'Box is not ready for customer pickup' });
  }
  if (!token || token !== delivery.unlock_token) {
    return res.status(403).json({ error: 'Invalid unlock token' });
  }
  if (delivery.token_used_at) {
    return res.status(400).json({ error: 'Token already used' });
  }
  if (delivery.token_expires_at && new Date(delivery.token_expires_at) < new Date()) {
    return res.status(400).json({ error: 'Unlock token expired — contact manager' });
  }
  if (!delivery.device) {
    return res.status(400).json({ error: 'No Smart Box assigned to this delivery' });
  }

  await unlockDevice(delivery.device, req.user.id);

  const { data, error } = await supabase
    .from('delivery_requests')
    .update({
      token_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', delivery.id)
    .select(DELIVERY_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...data, message: 'Smart Box unlocked — retrieve your items within 60 seconds' });
});

router.post('/:id/complete', authenticate, requireApproved, async (req, res) => {
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

  if (isManager(req.profile)) {
    if (delivery.device) await lockDevice(delivery.device);
    const { data, error } = await supabase
      .from('delivery_requests')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', delivery.id)
      .select(DELIVERY_SELECT)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (delivery.customer_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the customer can confirm receipt' });
  }
  if (!delivery.token_used_at) {
    return res.status(400).json({ error: 'Unlock the Smart Box with your token first' });
  }
  if (!['in_transit', 'rider_assigned'].includes(delivery.status)) {
    return res.status(400).json({ error: 'Delivery cannot be completed in current status' });
  }

  if (delivery.device) await lockDevice(delivery.device);

  const { data, error } = await supabase
    .from('delivery_requests')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', delivery.id)
    .select(DELIVERY_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:id/manager-lock', authenticate, requireApproved, requireManager, async (req, res) => {
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery?.device) return res.status(404).json({ error: 'No device on this delivery' });
  await lockDevice(delivery.device);
  res.json({ success: true, message: 'Smart Box locked' });
});

router.post('/:id/manager-unlock', authenticate, requireApproved, requireManager, async (req, res) => {
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery?.device) return res.status(404).json({ error: 'No device on this delivery' });
  await unlockDevice(delivery.device, req.user.id);
  res.json({ success: true, message: 'Smart Box unlocked remotely' });
});

export default router;
