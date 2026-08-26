import { config } from '../config/supabase.js';

/**
 * Send transactional email via Brevo REST API.
 * https://developers.brevo.com/docs/send-a-transactional-email
 */
export async function sendViaBrevoApi({ to, subject, html, text }) {
  const apiKey = config.email.brevoApiKey;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY not set — emails must go through the Brevo REST API');
  }

  const senderEmail = config.email.from;
  if (!senderEmail || senderEmail.includes('anti-tamper.local')) {
    throw new Error('SMTP_FROM must be a verified sender in Brevo (e.g. your@gmail.com)');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: config.email.fromName,
        email: senderEmail,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text || undefined,
      tags: ['anti-tamper', 'brevo-api'],
    }),
  });

  const bodyText = await response.text();
  let parsed = {};
  try {
    parsed = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    parsed = { raw: bodyText };
  }

  if (!response.ok) {
    const detail = parsed.message || parsed.code || bodyText || `HTTP ${response.status}`;
    throw new Error(`Brevo API ${response.status}: ${detail}`);
  }

  const messageId = parsed.messageId || parsed.messageIds?.[0] || null;
  if (!messageId) {
    throw new Error('Brevo API accepted the request but returned no messageId');
  }

  return { ok: true, provider: 'brevo-api', messageId };
}

export function hasBrevoApiKey() {
  return Boolean(config.email.brevoApiKey);
}

/** Verify API key at startup (GET /v3/account). */
export async function verifyBrevoApiKey() {
  const apiKey = config.email.brevoApiKey;
  if (!apiKey) {
    return { ok: false, error: 'BREVO_API_KEY not set in server/.env' };
  }
  if (!config.email.from) {
    return { ok: false, error: 'SMTP_FROM not set — add verified sender email in server/.env' };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey, accept: 'application/json' },
    });
    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, error: `Brevo API key rejected (${response.status}): ${detail}` };
    }
    const account = await response.json();
    return {
      ok: true,
      accountEmail: account.email,
      plan: account.plan?.[0]?.type || account.plan?.type || 'unknown',
      sender: config.email.from,
    };
  } catch (err) {
    return { ok: false, error: err.message || 'Cannot reach Brevo API' };
  }
}
