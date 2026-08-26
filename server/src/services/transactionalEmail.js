import { sendMail } from './email.js';
import { hasBrevoApiKey } from './brevo.js';
import { config } from '../config/supabase.js';
import { formatEmailSentAt } from '../lib/datetime.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildOtpEmailHtml({ title, intro, code, footer }) {
  const sentAt = formatEmailSentAt();
  return `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#0b1120;font-family:'Segoe UI',Inter,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1120;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#131c31;border-radius:16px;border:1px solid #1e2d4a;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#2563eb 0%,#06b6d4 100%);padding:24px 28px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Smart Box Delivery</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${escapeHtml(title)}</p>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;line-height:1.6;">${escapeHtml(intro)}</p>
          <div style="text-align:center;margin:24px 0;">
            <span style="display:inline-block;letter-spacing:8px;font-size:32px;font-weight:800;color:#fff;background:#0b1120;border:1px solid #1e2d4a;border-radius:12px;padding:16px 24px;font-family:monospace;">${escapeHtml(code)}</span>
          </div>
          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">${escapeHtml(footer)}</p>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#0b1120;border-top:1px solid #1e2d4a;text-align:center;">
          <p style="margin:0;color:#475569;font-size:11px;">Sent via Brevo · ${escapeHtml(sentAt)} · Rwanda time</p>
          <p style="margin:4px 0 0;color:#475569;font-size:11px;">Do not share this code</p>
        </td></tr>      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendRegisterOtpEmail(to, code) {
  const html = buildOtpEmailHtml({
    title: 'Verify your email',
    intro: 'Enter this code to finish creating your customer account.',
    code,
    footer: 'This code expires in 10 minutes. If you did not register, ignore this email.',
  });

  return sendMail({
    to,
    subject: `${code} — Verify your Smart Box Delivery account`,
    html,
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
  });
}

export async function sendPasswordResetOtpEmail(to, code) {
  const html = buildOtpEmailHtml({
    title: 'Reset your password',
    intro: 'Enter this code to choose a new password for your account.',
    code,
    footer: 'This code expires in 10 minutes. If you did not request a reset, ignore this email.',
  });

  return sendMail({
    to,
    subject: `${code} — Reset your Smart Box Delivery password`,
    html,
    text: `Your password reset code is ${code}. It expires in 10 minutes.`,
  });
}

export function ensureEmailReady() {
  if (!config.email.enabled) {
    return 'Email is disabled. Set EMAIL_ENABLED=true in server/.env';
  }
  if (!hasBrevoApiKey()) {
    return 'BREVO_API_KEY missing in server/.env — get it from Brevo → SMTP & API → API keys';
  }
  if (!config.email.from) {
    return 'SMTP_FROM missing — use a sender verified in Brevo → Senders';
  }
  return null;
}
