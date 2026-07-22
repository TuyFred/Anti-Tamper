const STATUS_LABELS = {
  awaiting_payment: { label: 'Awaiting payment', variant: 'warning' },
  payment_submitted: { label: 'Payment submitted', variant: 'primary' },
  payment_verified: { label: 'Payment verified', variant: 'success' },
  rider_assigned: { label: 'Rider assigned', variant: 'primary' },
  in_transit: { label: 'In transit', variant: 'primary' },
  delivered: { label: 'Delivered', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
};

export function deliveryStatusMeta(status) {
  return STATUS_LABELS[status] || { label: status, variant: 'neutral' };
}

export function formatPrice(amount, currency = 'RWF') {
  return `${Number(amount).toLocaleString()} ${currency}`;
}
