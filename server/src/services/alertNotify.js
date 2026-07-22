import { supabase } from '../config/supabase.js';
import { sendAlertEmail, isEmailConfigured } from './email.js';

async function getAlertRecipients(deviceId) {
  const emails = new Set();

  const { data: admins } = await supabase
    .from('profiles')
    .select('email, role:roles(name)')
    .eq('is_approved', true);

  for (const profile of admins || []) {
    if (profile.role?.name === 'admin' && profile.email) {
      emails.add(profile.email);
    }
  }

  const { data: accessRows } = await supabase
    .from('device_access')
    .select('user_id')
    .eq('device_id', deviceId)
    .eq('can_view', true);

  const userIds = (accessRows || []).map((r) => r.user_id);
  if (userIds.length) {
    const { data: users } = await supabase
      .from('profiles')
      .select('email')
      .in('id', userIds)
      .eq('is_approved', true);

    for (const u of users || []) {
      if (u.email) emails.add(u.email);
    }
  }

  return [...emails];
}

export async function notifyAlertByEmail(alert, device) {
  if (!isEmailConfigured()) return;
  if (alert.severity !== 'critical') return;

  const recipients = await getAlertRecipients(device.id);
  if (!recipients.length) {
    console.warn('No email recipients for alert', alert.id);
    return;
  }

  console.log(`📧 Sending alert email to ${recipients.length} recipient(s)...`);

  const results = await Promise.allSettled(
    recipients.map((email) => sendAlertEmail(email, alert, device))
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  console.log(`📧 Alert emails sent: ${sent}/${recipients.length}`);
}
