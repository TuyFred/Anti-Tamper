import { resolveAlertRecipients } from '../lib/alertRecipients.js';
import { isEmailConfigured, sendAlertEmail } from './email.js';

export async function notifyAlertByEmail(alert, device) {
  if (!isEmailConfigured()) return;
  if (alert.severity !== 'critical') return;

  const { emails, linkedDelivery } = await resolveAlertRecipients(device.id, alert.event_type);
  if (!emails.length) {
    console.warn('No email recipients for alert', alert.id);
    return;
  }

  console.log(`📧 Sending alert email to ${emails.length} recipient(s)...`);

  const enrichedAlert = linkedDelivery
    ? {
      ...alert,
      message: `${alert.message}${linkedDelivery.customer?.full_name ? ` · Customer: ${linkedDelivery.customer.full_name}` : ''}${linkedDelivery.status === 'delivered' ? ' · Post-delivery alert' : ''}`,
    }
    : alert;

  const results = await Promise.allSettled(
    emails.map((email) => sendAlertEmail(email, enrichedAlert, device)),
  );

  results.forEach((result, index) => {
    const email = emails[index];
    if (result.status === 'rejected') {
      console.error(`📧 Alert email failed for ${email}:`, result.reason?.message || result.reason);
    } else if (!result.value) {
      console.error(`📧 Alert email not sent to ${email} — check Brevo API logs above`);
    }
  });

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  console.log(`📧 Alert emails sent: ${sent}/${emails.length}`);
}

export async function getAlertNotifyUserIds(deviceUuid, eventType) {
  const { userIds } = await resolveAlertRecipients(deviceUuid, eventType);
  return userIds;
}
