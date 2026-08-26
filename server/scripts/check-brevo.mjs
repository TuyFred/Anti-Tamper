/**
 * One-shot check: verify Brevo API key, sender, and send a real test email.
 * Usage: node scripts/check-brevo.mjs [to-email]
 */
import { config } from '../src/config/supabase.js';
import { sendViaBrevoApi, verifyBrevoApiKey } from '../src/services/brevo.js';

const to = (process.argv[2] || config.email.from || '').trim().toLowerCase();

function maskKey(key) {
  if (!key) return '(missing)';
  if (key.length < 16) return '(too short)';
  return `${key.slice(0, 8)}…${key.slice(-4)} (${key.length} chars)`;
}

async function getSenders(apiKey) {
  const response = await fetch('https://api.brevo.com/v3/senders', {
    headers: { 'api-key': apiKey, accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`GET /v3/senders ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function getRecentEvents(apiKey, email) {
  const params = new URLSearchParams({ limit: '5', email, sort: 'desc' });
  const response = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?${params}`, {
    headers: { 'api-key': apiKey, accept: 'application/json' },
  });
  if (!response.ok) {
    return { error: `${response.status}: ${await response.text()}` };
  }
  return response.json();
}

const result = {
  apiKeyPresent: Boolean(config.email.brevoApiKey),
  apiKeyPreview: maskKey(config.email.brevoApiKey),
  from: config.email.from,
  fromName: config.email.fromName,
  to,
};

try {
  const account = await verifyBrevoApiKey();
  result.account = account;
  if (!account.ok) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const senders = await getSenders(config.email.brevoApiKey);
  const senderList = (senders.senders || []).map((s) => ({
    email: s.email,
    name: s.name,
    active: s.active,
    verified: s.verified,
  }));
  result.senders = senderList;
  result.senderVerified = senderList.some(
    (s) => s.email?.toLowerCase() === config.email.from?.toLowerCase() && (s.active !== false),
  );

  const sent = await sendViaBrevoApi({
    to,
    subject: 'Smart Box — Brevo API test',
    html: `<p>This is a live test from the Anti-Tamper server.</p>
<p>Sent via <strong>Brevo REST API</strong> (<code>POST /v3/smtp/email</code>), not SMTP.</p>
<p>Time: ${new Date().toISOString()}</p>`,
    text: 'Live test from Anti-Tamper server via Brevo REST API (POST /v3/smtp/email).',
  });
  result.send = sent;

  await new Promise((r) => setTimeout(r, 1500));
  result.recentEvents = await getRecentEvents(config.email.brevoApiKey, to);

  console.log(JSON.stringify(result, null, 2));
  process.exit(sent?.ok ? 0 : 1);
} catch (err) {
  result.error = err.message;
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}
