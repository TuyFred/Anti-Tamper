import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../../.env') });
dotenv.config({ path: join(__dirname, '../../.env') });

import { getClientOrigins } from './cors.js';

// Base URL only — not .../rest/v1/
const supabaseUrl = (process.env.SUPABASE_URL || '')
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/$/, '');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  // Node < 22 has no native WebSocket — required by @supabase/realtime-js
  realtime: { transport: ws },
});

function resolveMqttBrokerUrl() {
  const raw = (process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883').trim();
  // ESP32 firmware uses broker.emqx.io — Mosquitto causes silent open/close failures.
  if (/test\.mosquitto\.org/i.test(raw)) {
    console.warn(
      '⚠️  MQTT_BROKER_URL points at test.mosquitto.org but BOX-001 firmware uses broker.emqx.io. '
      + 'Forcing mqtt://broker.emqx.io:1883 so unlock/lock commands reach the Smart Box.',
    );
    return 'mqtt://broker.emqx.io:1883';
  }
  return raw;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: getClientOrigins()[0],
  clientOrigins: getClientOrigins(),
  mqtt: {
    brokerUrl: resolveMqttBrokerUrl(),
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
  },
  email: (() => {
    const brevoApiKey = (process.env.BREVO_API_KEY || '').trim();
    const smtpHost = (process.env.SMTP_HOST || '').trim();
    const smtpUser = (process.env.SMTP_USER || '').trim();
    const smtpPass = (process.env.SMTP_PASS || '').trim();
    const hasSmtp = Boolean(smtpHost && smtpUser && smtpPass);
    const emailDisabled = process.env.EMAIL_ENABLED === 'false';
    const emailExplicit = process.env.EMAIL_ENABLED === 'true';
    return {
      enabled: !emailDisabled && (emailExplicit || Boolean(brevoApiKey) || hasSmtp),
      brevoApiKey,
      host: smtpHost || 'smtp-relay.brevo.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: smtpUser,
      pass: smtpPass,
      from: (process.env.SMTP_FROM || process.env.EMAIL_FROM || smtpUser || '').trim(),
      fromName: (process.env.SMTP_FROM_NAME || 'Smart Box Delivery').trim(),
    };
  })(),
  publicBaseUrl: (
    process.env.PUBLIC_BASE_URL
    || process.env.RENDER_EXTERNAL_URL
    || `http://localhost:${parseInt(process.env.PORT || '3001', 10)}`
  ).replace(/\/$/, ''),
  upload: {
    maxPromoVideoBytes: parseInt(process.env.MAX_PROMO_VIDEO_MB || '200', 10) * 1024 * 1024,
  },
};
