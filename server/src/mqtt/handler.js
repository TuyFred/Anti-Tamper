import mqtt from 'mqtt';
import { supabase } from '../config/supabase.js';
import { config } from '../config/supabase.js';
import { notifyAlertByEmail, getAlertNotifyUserIds } from '../services/alertNotify.js';
import { logGpsHistory } from '../lib/activityLog.js';
import { isValidRwandaGps } from '../lib/rwandaGps.js';

let mqttClient = null;
let ioInstance = null;
let mqttConnected = false;
let lastMqttErrorLogMs = 0;

const TOPICS = {
  GPS: 'box/+/gps',
  TAMPER: 'box/+/tamper',
  SHOCK: 'box/+/shock',
  STATUS: 'box/+/status',
  COMMAND: (deviceId) => `box/${deviceId}/command`,
};

function broadcastSystemStatus(connected, detail) {
  mqttConnected = connected;
  if (ioInstance) {
    ioInstance.emit('system:status', {
      type: 'mqtt',
      connected,
      detail: detail || (connected ? 'Hardware connected to the software platform.' : 'Hardware disconnected; reconnecting now.'),
    });
  }
}

export function initMqtt(io) {
  ioInstance = io;

  const options = {
    clientId: `anti-tamper-server-${Date.now()}`,
    clean: true,
    reconnectPeriod: 8000,
    connectTimeout: 20000,
    keepalive: 45,
    resubscribe: true,
  };

  if (config.mqtt.username) {
    options.username = config.mqtt.username;
    options.password = config.mqtt.password;
  }

  mqttClient = mqtt.connect(config.mqtt.brokerUrl, options);

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    broadcastSystemStatus(true, 'Hardware connected to the software platform.');
    mqttClient.subscribe([TOPICS.GPS, TOPICS.TAMPER, TOPICS.SHOCK, TOPICS.STATUS], (err) => {
      if (err) console.error('MQTT subscribe error:', err);
      else console.log('📡 Subscribed to box topics');
    });
  });

  mqttClient.on('message', async (topic, payload) => {
    try {
      const parts = topic.split('/');
      if (parts.length !== 3 || parts[0] !== 'box') return;

      const hardwareId = parts[1];
      const eventType = parts[2];
      if (!['gps', 'tamper', 'shock', 'status'].includes(eventType)) return;

      const raw = payload.toString().trim();
      // Public brokers relay other clients' LWT plain text ("offline", "online") — not JSON
      if (!raw.startsWith('{')) return;

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }

      const device = await getDeviceByHardwareId(hardwareId);
      if (!device) return;

      switch (eventType) {
        case 'gps':
          await handleGps(device, data);
          break;
        case 'tamper':
          await handleTamper(device, data);
          break;
        case 'shock':
          await handleShock(device, data);
          break;
        case 'status':
          await handleStatus(device, data);
          break;
      }
    } catch (err) {
      console.error('MQTT handler error:', err.message);
    }
  });

  mqttClient.on('error', (err) => {
    const now = Date.now();
    if (now - lastMqttErrorLogMs > 60000) {
      console.error('MQTT error:', err.message, `(broker: ${config.mqtt.brokerUrl})`);
      lastMqttErrorLogMs = now;
    }
    broadcastSystemStatus(false, 'Hardware connection error; retrying in the background.');
  });
  mqttClient.on('reconnect', () => {
    const now = Date.now();
    if (now - lastMqttErrorLogMs > 30000) {
      console.log('🔄 MQTT reconnecting…', config.mqtt.brokerUrl);
      lastMqttErrorLogMs = now;
    }
    broadcastSystemStatus(false, 'Reconnecting to the hardware device.');
  });
  mqttClient.on('close', () => {
    broadcastSystemStatus(false, 'The hardware link was closed.');
  });

  return mqttClient;
}

async function getDeviceByHardwareId(hardwareId) {
  const { data } = await supabase
    .from('devices')
    .select('*')
    .eq('device_id', hardwareId)
    .single();
  return data;
}

async function handleGps(device, data) {
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  if (!isValidRwandaGps(latitude, longitude)) {
    console.warn(`GPS rejected for ${device.device_id}: not in Rwanda (${latitude}, ${longitude})`);
    if (!isValidRwandaGps(device.latitude, device.longitude)) {
      await supabase
        .from('devices')
        .update({
          latitude: null,
          longitude: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', device.id);
      broadcast('device:update', { ...device, latitude: null, longitude: null });
    }
    return;
  }

  await supabase
    .from('devices')
    .update({
      latitude,
      longitude,
      is_online: true,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', device.id);

  await logGpsHistory(device.id, latitude, longitude, 'mqtt');

  const update = {
    deviceId: device.id,
    hardwareId: device.device_id,
    latitude,
    longitude,
    timestamp: new Date().toISOString(),
  };

  broadcast('gps:update', update);
}

async function handleTamper(device, data) {
  const tamperActive = data.tampered === true || data.status === true;

  await supabase
    .from('devices')
    .update({
      tamper_status: tamperActive,
      is_online: true,
      last_seen: new Date().toISOString(),
      buzzer_active: tamperActive,
      led_active: tamperActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', device.id);

  if (tamperActive) {
    const alert = await createAlert(device, {
      event_type: 'unauthorized',
      severity: 'critical',
      message: `Unauthorized box open on ${device.name} (${device.device_id}) — no valid unlock token was used`,
      latitude: device.latitude,
      longitude: device.longitude,
      metadata: { ...data, source: 'reed_switch' },
    });
    if (alert) {
      broadcast('alert:new', alert);
      notifyTargetedUsers(alert);
    }
  }

  broadcast('device:update', {
    ...device,
    tamper_status: tamperActive,
    buzzer_active: tamperActive,
    led_active: tamperActive,
  });
}

async function handleShock(device, data) {
  if (data.shock === false) {
    await supabase
      .from('devices')
      .update({
        shock_detected: false,
        buzzer_active: false,
        led_active: false,
        is_online: true,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', device.id);

    broadcast('device:update', {
      ...device,
      shock_detected: false,
      buzzer_active: false,
      led_active: false,
    });
    return;
  }

  const isFall = data.fall === true;
  const rawPeak = data.raw != null ? Number(data.raw) : null;
  const MIN_SHOCK_RAW = 7500;

  // Ignore light touch / hand-waves (old firmware or noise). Real impacts ≥7500 raw peak.
  const isRealImpact = data.shock === true
    && (rawPeak == null || rawPeak >= MIN_SHOCK_RAW)
    && data.touch !== true;

  const shockDetected = isRealImpact
    || (isFall && (rawPeak == null || rawPeak >= MIN_SHOCK_RAW))
    || (data.impact === true && rawPeak != null && rawPeak >= MIN_SHOCK_RAW);

  await supabase
    .from('devices')
    .update({
      shock_detected: shockDetected,
      is_online: true,
      last_seen: new Date().toISOString(),
      buzzer_active: shockDetected,
      led_active: shockDetected,
      updated_at: new Date().toISOString(),
    })
    .eq('id', device.id);

  if (shockDetected) {
    const magnitude = data.magnitude != null ? Number(data.magnitude).toFixed(2) : null;
    const raw = rawPeak != null ? ` (sensor ${rawPeak})` : '';
    let message;
    if (isFall) {
      message = `Box fall detected on ${device.name} (${device.device_id})`;
    } else {
      message = `Impact / shock detected on ${device.name} (${device.device_id})${magnitude ? ` — force ${magnitude}` : ''}${raw}`;
    }

    const alert = await createAlert(device, {
      event_type: 'shock',
      severity: 'critical',
      message,
      latitude: device.latitude,
      longitude: device.longitude,
      metadata: data,
    });
    if (alert) {
      broadcast('alert:new', alert);
      notifyTargetedUsers(alert);
    }
  }

  broadcast('device:update', {
    ...device,
    shock_detected: shockDetected,
    buzzer_active: shockDetected,
    led_active: shockDetected,
  });
}

async function handleStatus(device, data) {
  const updates = {
    is_online: true,
    last_seen: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (data.lock_status) updates.lock_status = data.lock_status;
  if (data.buzzer != null) updates.buzzer_active = data.buzzer;
  if (data.led != null) updates.led_active = data.led;

  const wasUnlocked = device.lock_status === 'unlocked';
  const nowLocked = data.lock_status === 'locked';

  const payload = {
    ...device,
    ...updates,
    gps_fix: data.gps_fix === true,
    gps_satellites: data.satellites != null ? Number(data.satellites) : undefined,
  };

  await supabase.from('devices').update(updates).eq('id', device.id);
  broadcast('device:update', payload);

  // Physical button close → sync delivery token (same outcome as dashboard "Close Smart Box")
  if (wasUnlocked && nowLocked) {
    await autoCloseDeliveryAfterPhysicalLock(device.id);
  }
}

async function autoCloseDeliveryAfterPhysicalLock(deviceId) {
  const { data: delivery } = await supabase
    .from('delivery_requests')
    .select('id, token_used_at, token_closed_at, status')
    .eq('device_id', deviceId)
    .in('status', ['rider_assigned', 'in_transit'])
    .not('token_used_at', 'is', null)
    .is('token_closed_at', null)
    .order('token_used_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!delivery) return;

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
    .select('id, customer_id, status, token_closed_at')
    .single();

  if (error) {
    console.error('Auto-close delivery after physical lock:', error.message);
    return;
  }

  broadcast('delivery:update', data);
  if (ioInstance && data.customer_id) {
    ioInstance.to(`user:${data.customer_id}`).emit('delivery:update', data);
  }
}

async function createAlert(device, alertData) {
  const { data, error } = await supabase
    .from('alerts')
    .insert({
      device_id: device.id,
      ...alertData,
    })
    .select('*, device:devices(device_id, name)')
    .single();

  if (error) {
    console.error('Alert insert error:', error);
    return null;
  }

  if (data.severity === 'critical') {
    notifyAlertByEmail(data, device).catch((err) =>
      console.error('Email notify error:', err.message)
    );
  }

  return data;
}

function notifyTargetedUsers(alert) {
  if (!ioInstance || !alert?.device_id) return;
  getAlertNotifyUserIds(alert.device_id, alert.event_type)
    .then((userIds) => {
      for (const userId of userIds) {
        ioInstance.to(`user:${userId}`).emit('alert:notify', alert);
      }
    })
    .catch((err) => console.error('Targeted alert notify error:', err.message));
}

export async function createUnauthorizedAlert(device, userId) {
  const alert = await createAlert(device, {
    event_type: 'unauthorized',
    severity: 'critical',
    message: `Unauthorized unlock attempt on ${device.name} (${device.device_id})`,
    latitude: device.latitude,
    longitude: device.longitude,
    metadata: { attempted_by: userId, source: 'software' },
  });
  if (alert) {
    broadcast('alert:new', alert);
    notifyTargetedUsers(alert);
  }
  return alert;
}

function broadcast(event, data) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
}

export function broadcastDeviceUpdate(device) {
  if (device?.id) {
    broadcast('device:update', device);
  }
}

export function sendDeviceCommand(hardwareId, command, payload = {}) {
  if (!mqttClient?.connected) {
    throw new Error('MQTT client not connected');
  }

  const topic = TOPICS.COMMAND(hardwareId);
  const message = JSON.stringify({ command, ...payload, timestamp: Date.now() });
  mqttClient.publish(topic, message, { qos: 1 });
  return true;
}

export function isMqttConnected() {
  return Boolean(mqttClient?.connected);
}

export function getMqttClient() {
  return mqttClient;
}

export function shutdownMqtt() {
  if (mqttClient) {
    broadcastSystemStatus(false, 'The hardware link was shut down.');
    mqttClient.removeAllListeners();
    mqttClient.end(true);
    mqttClient = null;
    mqttConnected = false;
    console.log('📡 MQTT disconnected');
  }
}
