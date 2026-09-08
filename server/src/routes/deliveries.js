import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { deliveryConfig } from '../config/delivery.js';
import {
  authenticate, requireApproved, requireManager,
} from '../middleware/auth.js';
import { isCustomer, isManager, isRider } from '../middleware/permissions.js';
import { calculateDeliveryPrice, generateUnlockToken } from '../services/pricing.js';
import { sendDeviceCommand, broadcastDeviceUpdate, isMqttConnected } from '../mqtt/handler.js';
import {
  logDeliveryStatus, logPaymentEvent, logActivity,
} from '../lib/activityLog.js';
import { notifyDeliveryUpdate } from '../lib/deliveryNotify.js';
import {
  getDeliverySelect,
  handleDeliveryQueryError,
} from '../lib/deliverySelect.js';
import { sendCustomerUnlockCodeEmail } from '../services/transactionalEmail.js';
import { formatDateTimeFull } from '../lib/datetime.js';

const router = Router();

async function selectDelivery(queryBuilder) {
  let result = await queryBuilder(getDeliverySelect());
  if (result.error && handleDeliveryQueryError(result.error)) {
    result = await queryBuilder(getDeliverySelect());
  }
  return result;
}

async function getDeliveryById(id) {
  const { data, error } = await selectDelivery((select) =>
    supabase.from('delivery_requests').select(select).eq('id', id).single(),
  );
  if (error) return null;
  return data;
}

function openPermissionState(delivery) {
  if (!delivery?.rider_id || !['rider_assigned', 'in_transit'].includes(delivery.status)) {
    return 'none';
  }
  if (delivery.token_closed_at || (delivery.token_used_at && !delivery.unlock_token)) {
    return 'used';
  }
  if (delivery.rider_unlock_granted_at || (delivery.unlock_token && !delivery.token_closed_at)) {
    return 'granted';
  }
  return 'waiting';
}

/** Unlock token: delivery owner (customer) only after admin grant. Rider tracks — never receives open code. */
function sanitizeDelivery(delivery, profile, userId) {
  if (!delivery) return delivery;
  // Owner must always receive the unlock code after admin grant — do not rely only on role name.
  const isOwner = String(delivery.customer_id || '').toLowerCase() === String(userId || '').toLowerCase();
  if (isOwner) {
    const permission = openPermissionState(delivery);
    const code = delivery.token_closed_at ? null : (delivery.unlock_token ?? null);
    const hasActive = Boolean(code);
    return {
      ...delivery,
      unlock_token: code,
      // Alias so older/newer clients both find the code.
      unlock_code: code,
      open_permission: hasActive ? 'granted' : permission,
      customer_can_open: hasActive && permission !== 'used',
      rider_can_open: false,
    };
  }

  const sanitized = { ...delivery };
  const isAssignedRider = isRider(profile)
    && String(delivery.rider_id || '') === String(userId || '');
  const permission = openPermissionState(delivery);

  // Rider never sees the customer unlock code — deliver and track only.
  delete sanitized.unlock_token;
  delete sanitized.token_expires_at;

  sanitized.open_permission = permission;
  sanitized.rider_can_open = false;
  sanitized.customer_can_open = false;
  if (isAssignedRider) {
    sanitized.customer_open_granted = permission === 'granted';
    sanitized.customer_open_used = permission === 'used';
  }

  if (isManager(profile)) {
    const hasActiveToken = Boolean(delivery.unlock_token) && !delivery.token_closed_at;
    sanitized.customer_token_sent = hasActiveToken;
    sanitized.rider_open_granted = permission === 'granted' || permission === 'used';
    sanitized.token_request_pending = Boolean(delivery.token_requested_at);
    sanitized.token_delivery = hasActiveToken ? {
      channel: 'customer',
      recipient_email: delivery.customer?.email || null,
      recipient_name: delivery.customer?.full_name || null,
      sent_at: delivery.rider_unlock_granted_at || delivery.token_sent_at || delivery.updated_at,
      unlock_token: delivery.unlock_token,
      token_expires_at: delivery.token_expires_at,
    } : null;
  }

  return sanitized;
}

function isTokenExpired(delivery) {
  return Boolean(delivery.token_expires_at)
    && new Date(delivery.token_expires_at) < new Date();
}

function customerNeedsNewToken(delivery) {
  if (!['rider_assigned', 'in_transit'].includes(delivery.status)) return false;
  if (!delivery.device_id) return false;
  if (delivery.token_requested_at && !delivery.unlock_token) return false;
  if (delivery.token_closed_at) return true;
  if (!delivery.unlock_token) return true;
  if (isTokenExpired(delivery)) return true;
  return false;
}

function sanitizeDeliveries(list, profile, userId) {
  return (list || []).map((d) => sanitizeDelivery(d, profile, userId));
}

async function lockDevice(deviceRow) {
  if (!deviceRow?.device_id) {
    throw new Error('No Smart Box assigned to this delivery');
  }
  try {
    sendDeviceCommand(deviceRow.device_id, 'lock');
  } catch (err) {
    throw new Error(
      err.message === 'MQTT client not connected'
        ? 'Hardware link offline — Smart Box did not receive close command. Check ESP32 WiFi/MQTT, then try again.'
        : (err.message || 'MQTT offline — cannot lock. Check MQTT connection.'),
    );
  }
  const updatedAt = new Date().toISOString();
  await supabase
    .from('devices')
    .update({ lock_status: 'locked', updated_at: updatedAt })
    .eq('id', deviceRow.id);
  broadcastDeviceUpdate({ ...deviceRow, lock_status: 'locked', updated_at: updatedAt, is_online: true });
  return { mqttSent: true };
}

async function unlockDevice(deviceRow, userId) {
  if (!deviceRow?.device_id) {
    throw new Error('No Smart Box assigned to this delivery');
  }
  if (!isMqttConnected()) {
    throw new Error(
      'Hardware link offline — Smart Box did not receive open command. Check server MQTT, then try again.',
    );
  }

  try {
    sendDeviceCommand(deviceRow.device_id, 'unlock', { authorized: true, user_id: userId });
  } catch (err) {
    throw new Error(
      err.message === 'MQTT client not connected'
        ? 'Hardware link offline — Smart Box did not receive open command. Check ESP32 WiFi/MQTT, then try again.'
        : (err.message || 'Cannot send open command to Smart Box'),
    );
  }
  const updatedAt = new Date().toISOString();
  await supabase
    .from('devices')
    .update({ lock_status: 'unlocked', updated_at: updatedAt, is_online: true, last_seen: updatedAt })
    .eq('id', deviceRow.id);
  broadcastDeviceUpdate({ ...deviceRow, lock_status: 'unlocked', updated_at: updatedAt, is_online: true });
  return { mqttSent: true };
}

async function issueUnlockToken(delivery, actorId, summary) {
  const token = generateUnlockToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + deliveryConfig.tokenExpiryHours);
  const now = new Date().toISOString();

  // Minimal fields only — never include optional columns that may be missing in production.
  const payload = {
    unlock_token: token,
    token_expires_at: expires.toISOString(),
    token_sent_at: now,
    token_used_at: null,
    token_closed_at: null,
    token_requested_at: null,
    updated_at: now,
  };

  // Step 1: write WITHOUT a join select (join failures can block the whole grant).
  const { error: updateError } = await supabase
    .from('delivery_requests')
    .update(payload)
    .eq('id', delivery.id);
  if (updateError) {
    throw new Error(updateError.message || 'Failed to save unlock code');
  }

  // Step 2: read back and confirm the code exists.
  const { data: verified, error: verifyError } = await supabase
    .from('delivery_requests')
    .select('id, customer_id, rider_id, status, unlock_token, token_sent_at, token_expires_at, token_closed_at, delivery_address')
    .eq('id', delivery.id)
    .single();
  if (verifyError || !verified?.unlock_token) {
    throw new Error(verifyError?.message || 'Unlock code failed to save — tap Grant again');
  }

  let customer = delivery.customer || null;
  if (!customer?.email && verified.customer_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', verified.customer_id)
      .single();
    if (profile) customer = profile;
  }

  const data = {
    ...delivery,
    ...verified,
    unlock_token: verified.unlock_token,
    unlock_code: verified.unlock_token,
    customer,
    customer_id: verified.customer_id || delivery.customer_id,
  };

  await logActivity({
    entityType: 'delivery',
    entityId: data.id,
    action: 'token_sent',
    actorId,
    summary,
  });

  console.log(
    `Unlock code issued for delivery ${data.id} → customer ${data.customer_id} (${customer?.email || 'no-email'})`,
  );

  notifyDeliveryUpdate({
    ...data,
    customer_id: data.customer_id,
    unlock_token: data.unlock_token,
    unlock_code: data.unlock_token,
  });

  const customerEmail = customer?.email;
  if (customerEmail && data.unlock_token) {
    sendCustomerUnlockCodeEmail(customerEmail, {
      code: data.unlock_token,
      customerName: customer?.full_name || null,
      deliveryAddress: data.delivery_address || delivery.delivery_address || null,
      expiresAt: data.token_expires_at
        ? formatDateTimeFull(data.token_expires_at, { withSeconds: false })
        : null,
    }).then((result) => {
      if (result?.ok === false || result?.error) {
        console.warn('Unlock code email not sent:', result?.error || result);
      } else {
        console.log(`Unlock code emailed to customer ${customerEmail} for delivery ${data.id}`);
      }
    }).catch((err) => {
      console.warn('Unlock code email failed:', err?.message || err);
    });
  } else if (!customerEmail) {
    console.warn(`No customer email for delivery ${data.id} — unlock code is in-app only`);
  }

  return data;
}

function canActorUnlockDelivery(delivery, profile, userId) {
  if (isManager(profile)) return true;
  // Only the customer opens with the unlock code — rider tracks only.
  if (String(delivery.customer_id || '') === String(userId || '')) return true;
  return false;
}

/** Customer can track assigned box on the map (view only — open uses delivery token). */
async function grantCustomerDeviceView(customerId, deviceId, grantedBy) {
  if (!customerId || !deviceId) return;
  await supabase.from('device_access').upsert({
    user_id: customerId,
    device_id: deviceId,
    can_view: true,
    can_control: false,
    granted_by: grantedBy,
    granted_at: new Date().toISOString(),
  }, { onConflict: 'user_id,device_id' });
}

function isTokenConsumed(delivery) {
  return Boolean(delivery.token_closed_at) || Boolean(delivery.token_used_at && delivery.token_closed_at) || !delivery.unlock_token;
}

router.get('/public/config', (_req, res) => {
  res.json({
    currency: deliveryConfig.currency,
    baseFare: deliveryConfig.baseFare,
    ratePerKm: deliveryConfig.ratePerKm,
    vatRate: deliveryConfig.vatRate,
    company: {
      name: deliveryConfig.companyName,
      tin: deliveryConfig.companyTin,
      address: deliveryConfig.companyAddress,
    },
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
    vatRate: deliveryConfig.vatRate,
    company: {
      name: deliveryConfig.companyName,
      tin: deliveryConfig.companyTin,
      address: deliveryConfig.companyAddress,
    },
    payment: deliveryConfig.payment,
    whatsapp: deliveryConfig.whatsapp,
  });
});

router.post('/estimate', authenticate, requireApproved, (req, res) => {
  const { distance_km } = req.body;
  res.json(calculateDeliveryPrice(distance_km));
});

router.get('/', authenticate, requireApproved, async (req, res) => {
  if (!isCustomer(req.profile) && !isRider(req.profile) && !isManager(req.profile)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { data, error } = await selectDelivery((select) => {
    let query = supabase.from('delivery_requests').select(select).order('created_at', { ascending: false });
    if (isCustomer(req.profile)) {
      query = query.eq('customer_id', req.user.id);
    } else if (isRider(req.profile)) {
      query = query.eq('rider_id', req.user.id);
    }
    return query;
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json(sanitizeDeliveries(data, req.profile, req.user.id));
});

/**
 * Customer-only: active unlock codes (minimal payload).
 * Used by the app so the code is never lost behind list UI / role checks.
 */
router.get('/my-unlock-codes', authenticate, requireApproved, async (req, res) => {
  const { data, error } = await supabase
    .from('delivery_requests')
    .select('id, status, unlock_token, token_expires_at, token_sent_at, token_closed_at, customer_id')
    .eq('customer_id', req.user.id)
    .in('status', ['rider_assigned', 'in_transit'])
    .not('unlock_token', 'is', null)
    .is('token_closed_at', null)
    .order('token_sent_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const codes = (data || [])
    .filter((row) => row.unlock_token)
    .map((row) => ({
      id: row.id,
      status: row.status,
      unlock_token: row.unlock_token,
      unlock_code: row.unlock_token,
      token_expires_at: row.token_expires_at,
      token_sent_at: row.token_sent_at,
      open_permission: 'granted',
      customer_can_open: true,
    }));

  res.json(codes);
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
    .select(getDeliverySelect())
    .single();

  if (error) return res.status(500).json({ error: error.message });
  await logDeliveryStatus(data.id, null, 'awaiting_payment', req.user.id, 'Delivery requested');
  await logActivity({
    entityType: 'delivery',
    entityId: data.id,
    action: 'created',
    actorId: req.user.id,
    summary: `New delivery request — ${data.customer?.full_name || 'customer'}${data.customer?.phone ? ` · ${data.customer.phone}` : ''}`,
    newValue: {
      pickup_address: data.pickup_address,
      delivery_address: data.delivery_address,
      customer_phone: data.customer?.phone || req.profile?.phone || null,
      pickup_latitude: data.pickup_latitude,
      pickup_longitude: data.pickup_longitude,
      delivery_latitude: data.delivery_latitude,
      delivery_longitude: data.delivery_longitude,
    },
  });
  res.status(201).json(sanitizeDelivery(data, req.profile, req.user.id));
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
    .select(getDeliverySelect())
    .single();

  if (error) return res.status(500).json({ error: error.message });
  await logDeliveryStatus(data.id, delivery.status, 'payment_submitted', req.user.id);
  await logPaymentEvent({
    deliveryId: data.id,
    eventType: 'submitted',
    amount: data.calculated_price,
    currency: data.currency,
    paymentMethod: data.payment_method,
    proofUrl: data.payment_proof_url,
    actorId: req.user.id,
  });
  res.json(sanitizeDelivery(data, req.profile, req.user.id));
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
    .select(getDeliverySelect())
    .single();

  if (error) return res.status(500).json({ error: error.message });
  await logDeliveryStatus(data.id, delivery.status, 'payment_verified', req.user.id);
  await logPaymentEvent({
    deliveryId: data.id,
    eventType: 'verified',
    amount: data.calculated_price,
    currency: data.currency,
    paymentMethod: data.payment_method,
    actorId: req.user.id,
  });
  res.json(sanitizeDelivery(data, req.profile, req.user.id));
});

router.post('/:id/reject-payment', authenticate, requireApproved, requireManager, async (req, res) => {
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  if (delivery.status !== 'payment_submitted') {
    return res.status(400).json({ error: 'No payment proof to reject' });
  }

  const { data, error } = await supabase
    .from('delivery_requests')
    .update({
      status: 'awaiting_payment',
      payment_proof_url: null,
      payment_submitted_at: null,
      updated_at: new Date().toISOString(),
      manager_notes: req.body?.reason?.trim() || delivery.manager_notes,
    })
    .eq('id', delivery.id)
    .select(getDeliverySelect())
    .single();

  if (error) return res.status(500).json({ error: error.message });
  const reason = req.body?.reason?.trim() || delivery.manager_notes;
  await logDeliveryStatus(data.id, delivery.status, 'awaiting_payment', req.user.id, reason);
  await logPaymentEvent({
    deliveryId: data.id,
    eventType: 'rejected',
    amount: delivery.calculated_price,
    currency: delivery.currency,
    paymentMethod: delivery.payment_method,
    actorId: req.user.id,
    notes: reason,
  });
  res.json(sanitizeDelivery(data, req.profile, req.user.id));
});

router.post('/:id/cancel', authenticate, requireApproved, requireManager, async (req, res) => {
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  if (['delivered', 'cancelled'].includes(delivery.status)) {
    return res.status(400).json({ error: 'Cannot cancel this delivery' });
  }

  if (delivery.device) {
    await lockDevice(delivery.device);
  }

  const { data, error } = await supabase
    .from('delivery_requests')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
      manager_notes: req.body?.reason?.trim() || delivery.manager_notes,
    })
    .eq('id', delivery.id)
    .select(getDeliverySelect())
    .single();

  if (error) return res.status(500).json({ error: error.message });
  const cancelReason = req.body?.reason?.trim() || delivery.manager_notes;
  await logDeliveryStatus(data.id, delivery.status, 'cancelled', req.user.id, cancelReason);
  await logPaymentEvent({
    deliveryId: data.id,
    eventType: 'cancelled',
    amount: delivery.calculated_price,
    currency: delivery.currency,
    actorId: req.user.id,
    notes: cancelReason,
  });
  res.json(sanitizeDelivery(data, req.profile, req.user.id));
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

  const { data: device } = await supabase.from('devices').select('*').eq('id', device_id).single();
  if (!device) return res.status(404).json({ error: 'Device not found' });

  await lockDevice(device);

  await grantCustomerDeviceView(delivery.customer_id, device_id, req.user.id);

  const now = new Date().toISOString();
  const assignPayload = {
    rider_id,
    device_id,
    status: 'rider_assigned',
    // Track only until admin/manager grants open permission.
    unlock_token: null,
    token_expires_at: null,
    token_sent_at: null,
    token_used_at: null,
    token_closed_at: null,
    token_requested_at: null,
    updated_at: now,
  };

  let { data, error } = await supabase
    .from('delivery_requests')
    .update(assignPayload)
    .eq('id', delivery.id)
    .select(getDeliverySelect())
    .single();

  if (error && handleDeliveryQueryError(error)) {
    ({ data, error } = await supabase
      .from('delivery_requests')
      .update(assignPayload)
      .eq('id', delivery.id)
      .select(getDeliverySelect())
      .single());
  }

  if (error) {
    ({ data, error } = await supabase
      .from('delivery_requests')
      .update(assignPayload)
      .eq('id', delivery.id)
      .select('*')
      .single());
  }

  if (error) return res.status(500).json({ error: error.message });
  await logDeliveryStatus(data.id, delivery.status, 'rider_assigned', req.user.id, 'Rider and Smart Box assigned');
  await logActivity({
    entityType: 'delivery',
    entityId: data.id,
    action: 'rider_assigned',
    actorId: req.user.id,
    summary: 'Rider and Smart Box assigned — open permission pending',
    newValue: { rider_id, device_id },
  });
  notifyDeliveryUpdate(data);
  res.json({
    ...sanitizeDelivery(data, req.profile, req.user.id),
    message: 'Rider assigned. Rider can track the box. Grant open permission when ready so the customer receives the unlock code.',
  });
});

/** Manager/Admin: grant open permission — issues unlock code to the customer only. */
router.post('/:id/grant-open', authenticate, requireApproved, requireManager, async (req, res) => {
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  if (!['rider_assigned', 'in_transit'].includes(delivery.status)) {
    return res.status(400).json({ error: 'Assign a rider before granting open permission' });
  }
  if (!delivery.rider_id) {
    return res.status(400).json({ error: 'No rider assigned to this delivery' });
  }
  if (!delivery.device_id) {
    return res.status(400).json({ error: 'Assign a Smart Box before granting open permission' });
  }

  try {
    const data = await issueUnlockToken(
      delivery,
      req.user.id,
      'Open permission granted — unlock code issued to customer',
    );

    res.json({
      ...sanitizeDelivery(data, req.profile, req.user.id),
      message: `Open permission granted. Unlock code sent to ${data.customer?.email || 'the customer'} (app + email).`,
      unlock_token: data.unlock_token,
      token_expires_at: data.token_expires_at,
      customer_email: data.customer?.email || delivery.customer?.email || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Customer: poll for unlock code after admin grant.
 * Tolerates older DBs without rider_unlock_granted_* columns.
 */
async function handleOpenStatus(req, res) {
  const id = req.params.id;
  const fullSelect = 'id, customer_id, rider_id, status, unlock_token, token_expires_at, token_sent_at, token_closed_at, token_used_at, token_requested_at, rider_unlock_granted_at';
  const basicSelect = 'id, customer_id, rider_id, status, unlock_token, token_expires_at, token_sent_at, token_closed_at, token_used_at, token_requested_at';

  let { data: row, error } = await supabase
    .from('delivery_requests')
    .select(fullSelect)
    .eq('id', id)
    .single();

  if (error && /rider_unlock_granted/i.test(error.message || '')) {
    ({ data: row, error } = await supabase
      .from('delivery_requests')
      .select(basicSelect)
      .eq('id', id)
      .single());
  }

  if ((error || !row) && id) {
    const delivery = await getDeliveryById(id);
    if (delivery) {
      row = delivery;
      error = null;
    }
  }

  if (error || !row) {
    return res.status(404).json({ error: 'Delivery not found', detail: error?.message || null });
  }

  const userId = req.user.id;
  const isOwner = String(row.customer_id || '') === String(userId || '');
  const isAssignedRider = isRider(req.profile) && String(row.rider_id || '') === String(userId || '');
  if (!isOwner && !isAssignedRider && !isManager(req.profile)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const permission = openPermissionState(row);
  const hasActive = Boolean(row.unlock_token) && !row.token_closed_at;
  const maySeeCode = isOwner || isManager(req.profile);

  return res.json({
    id: row.id,
    status: row.status,
    open_permission: permission,
    customer_can_open: isOwner && hasActive && permission !== 'used',
    rider_can_open: false,
    unlock_token: maySeeCode ? (row.unlock_token || null) : null,
    token_expires_at: maySeeCode ? (row.token_expires_at || null) : null,
    token_sent_at: row.token_sent_at || null,
    token_closed_at: row.token_closed_at || null,
    token_used_at: row.token_used_at || null,
    token_requested_at: row.token_requested_at || null,
    rider_unlock_granted_at: row.rider_unlock_granted_at || null,
    customer_open_granted: permission === 'granted',
  });
}

router.get('/:id/open-status', authenticate, requireApproved, handleOpenStatus);
router.get('/open-code/:id', authenticate, requireApproved, handleOpenStatus);

/** Manager/Admin: send or resend unlock token (customer re-open / also grants rider). */
router.post('/:id/send-token', authenticate, requireApproved, requireManager, async (req, res) => {
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  if (!['payment_verified', 'rider_assigned', 'in_transit'].includes(delivery.status)) {
    return res.status(400).json({ error: 'Token can only be sent after payment is verified' });
  }
  if (!delivery.device_id) {
    return res.status(400).json({ error: 'Assign a Smart Box before sending token' });
  }

  try {
    const data = await issueUnlockToken(
      delivery,
      req.user.id,
      delivery.token_closed_at || delivery.token_requested_at
        ? 'New unlock token resent to customer after opening request'
        : 'Unlock token sent to customer — open permission granted',
    );

    res.json({
      ...sanitizeDelivery(data, req.profile, req.user.id),
      message: `Unlock code sent to ${data.customer?.email || 'the customer'} — they can open the Smart Box from Dashboard / Deliveries.`,
      unlock_token: data.unlock_token,
      customer_email: data.customer?.email || delivery.customer?.email || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** Customer: request a new unlock code — manager must approve via send-token. */
router.post('/:id/request-token', authenticate, requireApproved, async (req, res) => {
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

  if (delivery.customer_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the customer can request a new unlock code' });
  }
  if (delivery.token_requested_at && !delivery.unlock_token) {
    return res.status(400).json({ error: 'Request already pending — wait for manager to send a new code' });
  }
  if (!customerNeedsNewToken(delivery)) {
    return res.status(400).json({
      error: delivery.unlock_token && !delivery.token_closed_at && !isTokenExpired(delivery)
        ? 'You already have a valid unlock code on your dashboard'
        : 'Cannot request a new code for this delivery yet',
    });
  }
  if (!delivery.device_id) {
    return res.status(400).json({ error: 'No Smart Box assigned to this delivery yet' });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('delivery_requests')
    .update({
      token_requested_at: now,
      updated_at: now,
    })
    .eq('id', delivery.id)
    .select(getDeliverySelect())
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await logActivity({
    entityType: 'delivery',
    entityId: data.id,
    action: 'token_requested',
    actorId: req.user.id,
    summary: 'Customer requested box opening again — awaiting manager approval',
  });

  notifyDeliveryUpdate(data);

  res.json({
    ...sanitizeDelivery(data, req.profile, req.user.id),
    message: 'Box opening request sent — a manager will approve and send a new unlock code.',
  });
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
    .select(getDeliverySelect())
    .single();

  if (error) return res.status(500).json({ error: error.message });
  await logDeliveryStatus(data.id, delivery.status, 'in_transit', req.user.id);
  res.json(sanitizeDelivery(data, req.profile, req.user.id));
});

router.post('/:id/unlock', authenticate, requireApproved, async (req, res) => {
  const { token } = req.body;
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

  if (!canActorUnlockDelivery(delivery, req.profile, req.user.id)) {
    if (isRider(req.profile) && String(delivery.rider_id || '') === String(req.user.id || '')) {
      return res.status(403).json({
        error: 'Only the customer can open the Smart Box with the unlock code. You can track the delivery on the map.',
      });
    }
    return res.status(403).json({ error: 'You are not allowed to unlock this Smart Box' });
  }
  if (!['rider_assigned', 'in_transit'].includes(delivery.status)) {
    return res.status(400).json({ error: 'Box is not ready to open for this delivery' });
  }
  if (isTokenConsumed(delivery)) {
    return res.status(400).json({ error: 'Unlock code already used — contact manager for help' });
  }
  if (!token || token.trim().toUpperCase() !== delivery.unlock_token?.toUpperCase()) {
    return res.status(403).json({ error: 'Invalid unlock code' });
  }
  if (delivery.token_used_at && delivery.token_closed_at) {
    return res.status(400).json({ error: 'Unlock code already used — ask manager for a new one.' });
  }
  if (delivery.token_used_at && !delivery.token_closed_at) {
    // Software already marked open, but hardware may still be locked (ESP was offline).
    // Re-send unlock command with the same valid code instead of blocking the customer.
    if (!delivery.device) {
      return res.status(400).json({ error: 'No Smart Box assigned to this delivery' });
    }
    if (delivery.device.lock_status === 'unlocked') {
      return res.status(400).json({
        error: 'Box already opened — close it to finish before using the code again.',
      });
    }
    try {
      await unlockDevice(delivery.device, req.user.id);
      return res.json({
        ...sanitizeDelivery(delivery, req.profile, req.user.id),
        message: 'Open command sent again — Smart Box should unlock now. Then Close when done.',
        mqttSent: true,
        resent: true,
      });
    } catch (err) {
      const offline = /Hardware link offline|MQTT|offline/i.test(err.message || '');
      return res.status(offline ? 503 : 500).json({ error: err.message });
    }
  }
  if (delivery.token_expires_at && new Date(delivery.token_expires_at) < new Date()) {
    return res.status(400).json({ error: 'Unlock code expired — ask manager to send a new one' });
  }
  if (!delivery.device) {
    return res.status(400).json({ error: 'No Smart Box assigned to this delivery' });
  }

  try {
    const unlockResult = await unlockDevice(delivery.device, req.user.id);
    const { data, error } = await supabase
      .from('delivery_requests')
      .update({
        token_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', delivery.id)
      .select(getDeliverySelect())
      .single();

    if (error) return res.status(500).json({ error: error.message });
    await logActivity({
      entityType: 'delivery',
      entityId: data.id,
      action: 'box_unlocked',
      actorId: req.user.id,
      summary: 'Customer unlocked Smart Box with token',
    });

    res.json({
      ...sanitizeDelivery(data, req.profile, req.user.id),
      message: 'Smart Box opened — retrieve your items, then tap Close Smart Box when done.',
      mqttSent: true,
    });
  } catch (err) {
    const offline = /Hardware link offline|MQTT/i.test(err.message || '');
    return res.status(offline ? 503 : 500).json({ error: err.message });
  }
});

router.post('/:id/customer-lock', authenticate, requireApproved, async (req, res) => {
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

  const isOwnerCustomer = String(delivery.customer_id || '') === String(req.user.id || '');
  if (!isOwnerCustomer && !isManager(req.profile)) {
    return res.status(403).json({ error: 'Only the customer can close the Smart Box after opening with their code' });
  }
  if (!delivery.token_used_at) {
    return res.status(400).json({ error: 'Open the Smart Box with your code first' });
  }
  if (delivery.token_closed_at || isTokenConsumed(delivery)) {
    return res.status(400).json({ error: 'Unlock code already used — one-time only' });
  }
  if (!delivery.device) {
    return res.status(400).json({ error: 'No Smart Box assigned' });
  }

  await lockDevice(delivery.device);

  const closedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('delivery_requests')
    .update({
      token_closed_at: closedAt,
      unlock_token: null,
      token_expires_at: closedAt,
      updated_at: closedAt,
    })
    .eq('id', delivery.id)
    .select(getDeliverySelect())
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await logActivity({
    entityType: 'delivery',
    entityId: data.id,
    action: 'token_consumed',
    actorId: req.user.id,
    summary: 'Customer closed box — unlock code expired (one-time use)',
  });

  res.json({
    ...sanitizeDelivery(data, req.profile, req.user.id),
    message: 'Smart Box closed. Your unlock code is now used and cannot be reused.',
  });
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
      .select(getDeliverySelect())
      .single();
    if (error) return res.status(500).json({ error: error.message });
    await logDeliveryStatus(data.id, delivery.status, 'delivered', req.user.id, 'Completed by manager');
    return res.json(sanitizeDelivery(data, req.profile, req.user.id));
  }

  if (delivery.customer_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the customer can confirm receipt' });
  }
  if (!delivery.token_closed_at) {
    return res.status(400).json({ error: 'Close the Smart Box first — your unlock code is used when you close' });
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
    .select(getDeliverySelect())
    .single();

  if (error) return res.status(500).json({ error: error.message });
  await logDeliveryStatus(data.id, delivery.status, 'delivered', req.user.id, 'Confirmed by customer');
  res.json(sanitizeDelivery(data, req.profile, req.user.id));
});

router.post('/:id/manager-lock', authenticate, requireApproved, requireManager, async (req, res) => {
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery?.device) return res.status(404).json({ error: 'No device on this delivery' });
  try {
    await lockDevice(delivery.device);
  } catch (err) {
    return res.status(503).json({ error: err.message || 'Could not lock Smart Box' });
  }
  res.json({ success: true, message: 'Smart Box locked remotely' });
});

router.post('/:id/manager-unlock', authenticate, requireApproved, requireManager, async (req, res) => {
  const delivery = await getDeliveryById(req.params.id);
  if (!delivery?.device) return res.status(404).json({ error: 'No device on this delivery' });
  try {
    await unlockDevice(delivery.device, req.user.id);
  } catch (err) {
    return res.status(503).json({ error: err.message || 'Could not unlock Smart Box' });
  }
  res.json({
    success: true,
    mqttSent: true,
    message: 'Smart Box unlocked remotely — open command sent to hardware',
  });
});

export default router;
