const STATUS_LABELS = {
  awaiting_payment: { label: 'Pay now', variant: 'warning' },
  payment_submitted: { label: 'Pending', variant: 'primary' },
  payment_verified: { label: 'Paid', variant: 'success' },
  rider_assigned: { label: 'Rider assigned', variant: 'success' },
  in_transit: { label: 'In transit', variant: 'primary' },
  delivered: { label: 'Delivered', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
};

const ACTIVE_STATUSES = [
  'awaiting_payment', 'payment_submitted', 'payment_verified',
  'rider_assigned', 'in_transit',
];

const COMPLETED_STATUSES = ['delivered', 'cancelled'];

export function deliveryStatusMeta(status) {
  return STATUS_LABELS[status] || { label: status, variant: 'neutral' };
}

export function formatPrice(amount, currency = 'RWF') {
  return `${Number(amount).toLocaleString('en-US')} ${currency}`;
}

export function formatDeliveryRef(id) {
  if (!id) return '—';
  return `#${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export function formatDeliveryDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function formatDeliveryDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: true,
  });
}

/** English label for report date range picker values (YYYY-MM-DD) */
export function formatReportDateRange({ from, to } = {}) {
  const fmt = (d) => {
    if (!d) return null;
    return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };
  const a = fmt(from);
  const b = fmt(to);
  if (a && b) return `${a} to ${b}`;
  if (a) return `From ${a}`;
  if (b) return `Until ${b}`;
  return 'All time';
}

export function isActiveDelivery(status) {
  return ACTIVE_STATUSES.includes(status);
}

export function isCompletedDelivery(status) {
  return COMPLETED_STATUSES.includes(status);
}

export function isDeliveredDelivery(status) {
  return status === 'delivered';
}

export function isCancelledDelivery(status) {
  return status === 'cancelled';
}

/** Filter deliveries by list segment */
export function filterDeliverySegment(deliveries, segment) {
  const list = deliveries || [];
  switch (segment) {
    case 'active':
      return list.filter((d) => isActiveDelivery(d.status));
    case 'delivered':
      return list.filter((d) => isDeliveredDelivery(d.status));
    case 'cancelled':
      return list.filter((d) => isCancelledDelivery(d.status));
    case 'history':
      return list.filter((d) => isCompletedDelivery(d.status));
    default:
      return list;
  }
}

export function countDeliverySegments(deliveries) {
  const list = deliveries || [];
  return {
    active: list.filter((d) => isActiveDelivery(d.status)).length,
    delivered: list.filter((d) => isDeliveredDelivery(d.status)).length,
    cancelled: list.filter((d) => isCancelledDelivery(d.status)).length,
    history: list.filter((d) => isCompletedDelivery(d.status)).length,
  };
}

export function paymentMethodLabel(method) {
  if (method === 'bank') return 'Bank transfer';
  if (method === 'momo') return 'MoMo Pay';
  return method || '—';
}

/** Human label for device lock_status from firmware/MQTT */
export function formatLockStatusLabel(lockStatus) {
  if (lockStatus === 'unlocked') return 'Unlocked — open box';
  if (lockStatus === 'locked') return 'Locked — secured';
  return 'Unknown';
}

export function formatLockStatusShort(lockStatus) {
  if (lockStatus === 'unlocked') return 'Unlocked';
  if (lockStatus === 'locked') return 'Locked';
  return 'Unknown';
}

export function isBoxOpen(lockStatus) {
  return lockStatus === 'unlocked';
}

/** Compact address for list rows (village, sector, district). */
export function formatAddressShort(address) {
  if (!address) return '—';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 3) return address;
  return parts.slice(0, 3).join(', ');
}

export function getDeliveryTimeline(delivery) {
  const items = [
    { key: 'created', label: 'Requested', at: delivery.created_at },
    { key: 'proof', label: 'Proof sent', at: delivery.payment_submitted_at },
    { key: 'paid', label: 'Paid', at: delivery.payment_verified_at },
    { key: 'token', label: 'Unlock code sent', at: delivery.token_sent_at || (delivery.unlock_token ? delivery.updated_at : null) },
    { key: 'opened', label: 'Box opened', at: delivery.token_used_at },
    { key: 'closed', label: 'Box closed (code used)', at: delivery.token_closed_at },
    { key: 'delivered', label: 'Delivered', at: delivery.delivered_at },
  ];
  return items.filter((i) => i.at);
}
