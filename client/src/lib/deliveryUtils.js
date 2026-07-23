const STATUS_LABELS = {
  awaiting_payment: { label: 'Pay now', variant: 'warning' },
  payment_submitted: { label: 'Awaiting confirmation', variant: 'primary' },
  payment_verified: { label: 'Paid', variant: 'success' },
  rider_assigned: { label: 'Rider assigned', variant: 'success' },
  in_transit: { label: 'Tracking delivery', variant: 'primary' },
  delivered: { label: 'Delivered', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
};

export function deliveryStatusMeta(status) {
  return STATUS_LABELS[status] || { label: status, variant: 'neutral' };
}

export function formatPrice(amount, currency = 'RWF') {
  return `${Number(amount).toLocaleString()} ${currency}`;
}
