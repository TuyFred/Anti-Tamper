import mqtt from 'mqtt';
import { supabase } from '../config/supabase.js';
import { config } from '../config/supabase.js';
import { notifyAlertByEmail } from '../services/alertNotify.js';
import { logGpsHistory } from '../lib/activityLog.js';

let mqttClient = null;
let ioInstance = null;

const TOPICS = {
  GPS: 'box/+/gps',
  TAMPER: 'box/+/tamper',
  SHOCK: 'box/+/shock',
  STATUS: 'box/+/status',
  COMMAND: (deviceId) => `box/${deviceId}/command`,
};

export function initMqtt(io) {
  ioInstance = io;

  const options = {
    clientId: `anti-tamper-server-${Date.now()}`,
    clean: true,
    reconnectPeriod: 5000,
  };

  if (config.mqtt.username) {
    options.username = config.mqtt.username;
    options.password = config.mqtt.password;
  }

  mqttClient = mqtt.connect(config.mqtt.brokerUrl, options);

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    mqttClient.subscribe([TOPICS.GPS, TOPICS.TAMPER, TOPICS.SHOCK, TOPICS.STATUS], (err) => {
      if (err) console.error('MQTT subscribe error:', err);
      else console.log('📡 Subscribed to box topics');
    });
  });

  mqttClient.on('message', async (topic, payload) => {
    try {
      const data = JSON.parse(payload.toString());
      const parts = topic.split('/');
      const hardwareId = parts[1];
      const eventType = parts[2];

      const device = await getDeviceByHardwareId(hardwareId);
      if (!device) {
        console.warn(`Unknown device: ${hardwareId}`);
        return;
      }

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
      console.error('MQTT message error:', err.message);
    }
  });

  mqttClient.on('error', (err) => console.error('MQTT error:', err.message));
  mqttClient.on('reconnect', () => console.log('🔄 MQTT reconnecting...'));

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
  const { latitude, longitude } = data;
  if (latitude == null || longitude == null) return;

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
      event_type: 'tamper',
      severity: 'critical',
      message: `Tamper detected on ${device.name} — reed switch triggered`,
      latitude: device.latitude,
      longitude: device.longitude,
      metadata: data,
    });
    broadcast('alert:new', alert);
  }

  broadcast('device:update', {
    ...device,
    tamper_status: tamperActive,
    buzzer_active: tamperActive,
    led_active: tamperActive,
  });
}

async function handleShock(device, data) {
  const isFall = data.fall === true;
  const isTouch = data.touch === true;
  const shockDetected = data.shock === true || data.impact === true || isFall || isTouch
    || (data.magnitude && data.magnitude > 0.7);

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
    let message;
    if (isFall) {
      message = `Box fall detected on ${device.name} — accelerometer free-fall + impact`;
    } else if (isTouch) {
      message = `Box touched or moved on ${device.name} — motion detected on assigned device`;
    } else {
      message = `Impact/shock detected on ${device.name} — MPU6050 threshold exceeded`;
    }

    const alert = await createAlert(device, {
      event_type: 'shock',
      severity: 'critical',
      message,
      latitude: device.latitude,
      longitude: device.longitude,
      metadata: data,
    });
    broadcast('alert:new', alert);
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

  await supabase.from('devices').update(updates).eq('id', device.id);
  broadcast('device:update', { ...device, ...updates });
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

export async function createUnauthorizedAlert(device, userId) {
  const alert = await createAlert(device, {
    event_type: 'unauthorized',
    severity: 'critical',
    message: `Unauthorized unlock attempt on ${device.name}`,
    latitude: device.latitude,
    longitude: device.longitude,
    metadata: { attempted_by: userId },
  });
  if (alert) broadcast('alert:new', alert);
  return alert;
}

function broadcast(event, data) {
  if (ioInstance) {
    ioInstance.emit(event, data);
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

export function getMqttClient() {
  return mqttClient;
}

export function shutdownMqtt() {
  if (mqttClient) {
    mqttClient.removeAllListeners();
    mqttClient.end(true);
    mqttClient = null;
    console.log('📡 MQTT disconnected');
  }
}
