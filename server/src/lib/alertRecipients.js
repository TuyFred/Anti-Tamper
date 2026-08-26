import { supabase } from '../config/supabase.js';

const ACTIVE_DELIVERY_STATUSES = ['payment_verified', 'rider_assigned', 'in_transit'];

/**
 * Alert emails / in-app notify — admin, manager, and customer on this box only.
 * No riders, no device_access viewers, no other roles.
 */
export async function resolveAlertRecipients(deviceUuid, eventType) {
  const emails = new Set();
  const userIds = new Set();

  const { data: staff } = await supabase
    .from('profiles')
    .select('id, email, role:roles(name)')
    .eq('is_approved', true);

  for (const profile of staff || []) {
    const role = profile.role?.name;
    if (['admin', 'manager'].includes(role)) {
      if (profile.email) emails.add(profile.email);
      if (profile.id) userIds.add(profile.id);
    }
  }

  const { data: deliveries } = await supabase
    .from('delivery_requests')
    .select(`
      id,
      status,
      customer_id,
      customer:profiles!delivery_requests_customer_id_fkey(id, email, full_name)
    `)
    .eq('device_id', deviceUuid)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(5);

  let linkedDelivery = deliveries?.[0] || null;

  for (const delivery of deliveries || []) {
    const customerEmail = delivery.customer?.email;
    const customerId = delivery.customer?.id || delivery.customer_id;
    if (!customerEmail || !customerId) continue;

    const isActive = ACTIVE_DELIVERY_STATUSES.includes(delivery.status);
    const isDelivered = delivery.status === 'delivered';

    if (isActive) {
      emails.add(customerEmail);
      userIds.add(customerId);
      linkedDelivery = delivery;
      break;
    }

    if (isDelivered && eventType !== 'shock') {
      emails.add(customerEmail);
      userIds.add(customerId);
      linkedDelivery = delivery;
      break;
    }
  }

  return {
    emails: [...emails],
    userIds: [...userIds],
    linkedDelivery,
  };
}
