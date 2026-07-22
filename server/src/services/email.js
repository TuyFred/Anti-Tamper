import nodemailer from 'nodemailer';
import { config } from '../config/supabase.js';

const EVENT_LABELS = {
  tamper: { label: 'Tamper Detected', color: '#ef4444', emoji: '⚠️' },
  shock: { label: 'Motion / Fall / Touch', color: '#f59e0b', emoji: '💥' },
  unauthorized: { label: 'Unauthorized Access', color: '#dc2626', emoji: '🚫' },
  gps: { label: 'GPS Alert', color: '#3b82f6', emoji: '📍' },
  system: { label: 'System Alert', color: '#64748b', emoji: '🔔' },
};

let transporter = null;

function getTransporter() {
  if (!config.email.enabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  }
  return transporter;
}

function buildAlertEmailHtml(alert, device, dashboardUrl) {
  const baseMeta = EVENT_LABELS[alert.event_type] || EVENT_LABELS.system;
  const meta = { ...baseMeta };
  const isTouch = alert.metadata?.touch === true;
  const isFall = alert.metadata?.fall === true;
  if (alert.event_type === 'shock' && isFall) meta.label = 'Box Fall Detected';
  else if (alert.event_type === 'shock' && isTouch) meta.label = 'Box Touched / Moved';
  else if (alert.event_type === 'shock') meta.label = 'Impact / Shock';
  const severityColor = alert.severity === 'critical' ? '#ef4444' : '#f59e0b';
  const timeStr = new Date(alert.created_at).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const mapLink =
    alert.latitude != null && alert.longitude != null
      ? `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`
      : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Security Alert — ${meta.label}</title>
</head>
<body style="margin:0;padding:0;background:#0b1120;font-family:'Segoe UI',Inter,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1120;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#131c31;border-radius:16px;border:1px solid #1e2d4a;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb 0%,#06b6d4 100%);padding:28px 32px;text-align:center;">
              <div style="font-size:28px;margin-bottom:8px;">🛡️</div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Anti-Tamper Alert</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Smart Delivery Box Platform</p>
            </td>
          </tr>
          <!-- Severity banner -->
          <tr>
            <td style="background:${severityColor}15;border-bottom:3px solid ${severityColor};padding:16px 32px;">
              <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:${severityColor};font-weight:700;">
                ${alert.severity} · ${meta.emoji} ${meta.label}
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;line-height:1.6;">
                A security event was detected on your delivery box. Please review immediately.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1120;border-radius:12px;border:1px solid #1e2d4a;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Message</p>
                    <p style="margin:0;color:#f1f5f9;font-size:16px;font-weight:600;line-height:1.5;">${escapeHtml(alert.message)}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:12px 16px;background:#0b1120;border-radius:10px;border:1px solid #1e2d4a;vertical-align:top;">
                    <p style="margin:0 0 4px;color:#64748b;font-size:11px;">Device</p>
                    <p style="margin:0;color:#f1f5f9;font-size:14px;font-weight:600;">${escapeHtml(device?.name || 'Unknown')}</p>
                    <p style="margin:4px 0 0;color:#475569;font-size:12px;font-family:monospace;">${escapeHtml(device?.device_id || '')}</p>
                  </td>
                  <td width="8"></td>
                  <td width="50%" style="padding:12px 16px;background:#0b1120;border-radius:10px;border:1px solid #1e2d4a;vertical-align:top;">
                    <p style="margin:0 0 4px;color:#64748b;font-size:11px;">Time</p>
                    <p style="margin:0;color:#f1f5f9;font-size:13px;">${timeStr}</p>
                  </td>
                </tr>
              </table>
              ${
                mapLink
                  ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:12px 16px;background:#0b1120;border-radius:10px;border:1px solid #1e2d4a;">
                    <p style="margin:0 0 4px;color:#64748b;font-size:11px;">📍 Location</p>
                    <p style="margin:0;color:#60a5fa;font-size:13px;font-family:monospace;">${alert.latitude?.toFixed(6)}, ${alert.longitude?.toFixed(6)}</p>
                  </td>
                </tr>
              </table>`
                  : ''
              }
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:10px;background:linear-gradient(135deg,#2563eb,#3b82f6);">
                    <a href="${dashboardUrl}/alerts" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
                      View Alert Center →
                    </a>
                  </td>
                </tr>
                ${
                  mapLink
                    ? `<tr><td align="center" style="padding-top:12px;">
                    <a href="${mapLink}" target="_blank" style="color:#60a5fa;font-size:13px;text-decoration:none;">Open location in Google Maps</a>
                  </td></tr>`
                    : ''
                }
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#0b1120;border-top:1px solid #1e2d4a;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;">
                This is an automated alert from <strong style="color:#64748b;">Anti-Tamper Smart Delivery Box</strong>.<br />
                Do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendAlertEmail(to, alert, device) {
  const transport = getTransporter();
  if (!transport) return false;

  const meta = EVENT_LABELS[alert.event_type] || EVENT_LABELS.system;
  const subject = `[${alert.severity?.toUpperCase()}] ${meta.emoji} ${meta.label} — ${device?.name || 'Delivery Box'}`;

  try {
    await transport.sendMail({
      from: `"Anti-Tamper Alerts" <${config.email.from}>`,
      to,
      subject,
      html: buildAlertEmailHtml(alert, device, config.clientUrl),
      text: `${meta.label}\n\n${alert.message}\n\nDevice: ${device?.name} (${device?.device_id})\nTime: ${alert.created_at}\n\nView alerts: ${config.clientUrl}/alerts`,
    });
    return true;
  } catch (err) {
    console.error(`Email failed for ${to}:`, err.message);
    return false;
  }
}

export function isEmailConfigured() {
  return config.email.enabled && config.email.host && config.email.user;
}
