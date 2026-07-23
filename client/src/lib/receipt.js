import { formatPrice, formatDeliveryRef, formatDeliveryDateTime, paymentMethodLabel } from './deliveryUtils';

const DEFAULT_VAT = 0.18;

export function getReceiptBreakdown(delivery, config) {
  const total = Number(delivery.calculated_price) || 0;
  const rate = config?.vatRate ?? DEFAULT_VAT;
  const transportHt = Math.round(total / (1 + rate));
  const vatAmount = total - transportHt;
  return {
    transport_ht: transportHt,
    vat_rate: rate,
    vat_amount: vatAmount,
    vat_percent: Math.round(rate * 100),
    total_ttc: total,
    currency: delivery.currency || config?.currency || 'RWF',
  };
}

export function canDownloadReceipt(status) {
  return ['payment_verified', 'rider_assigned', 'in_transit', 'delivered'].includes(status);
}

function receiptHtml(delivery, config, customerName) {
  const b = getReceiptBreakdown(delivery, config);
  const company = config?.company || {};
  const paidAt = delivery.payment_verified_at || delivery.payment_submitted_at || delivery.created_at;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Receipt ${formatDeliveryRef(delivery.id)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #111; padding: 40px; max-width: 720px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 24px; }
    .logo { font-size: 22px; font-weight: 800; color: #2563eb; }
    .logo span { display: block; font-size: 11px; font-weight: 500; color: #64748b; margin-top: 4px; }
    .receipt-title { text-align: right; }
    .receipt-title h1 { font-size: 28px; color: #0f172a; letter-spacing: 2px; }
    .receipt-title p { font-size: 12px; color: #64748b; margin-top: 4px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; font-size: 13px; }
    .meta div { background: #f8fafc; padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .meta label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; display: block; margin-bottom: 4px; }
    .route { margin-bottom: 24px; }
    .route h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 10px; }
    .addr { padding: 10px 14px; border-left: 4px solid #10b981; background: #f0fdf4; margin-bottom: 8px; border-radius: 0 8px 8px 0; font-size: 13px; line-height: 1.5; }
    .addr.delivery { border-color: #2563eb; background: #eff6ff; }
    .addr strong { font-size: 10px; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
    th { text-align: left; padding: 10px 12px; background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
    td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
    .totals { margin-left: auto; width: 280px; }
    .totals row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #334155; }
    .totals .grand { display: flex; justify-content: space-between; padding: 12px 0; margin-top: 8px; border-top: 2px solid #2563eb; font-size: 18px; font-weight: 800; color: #0f172a; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
    .paid-stamp { display: inline-block; background: #dcfce7; color: #166534; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 20px; margin-top: 8px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      Smart Box Delivery
      <span>${company.name || 'Smart Box Delivery Ltd'}</span>
      <span>${company.address || 'Kigali, Rwanda'} · ${company.tin || ''}</span>
    </div>
    <div class="receipt-title">
      <h1>RECEIPT</h1>
      <p>${formatDeliveryRef(delivery.id)}</p>
      <div class="paid-stamp">PAID</div>
    </div>
  </div>

  <div class="meta">
    <div><label>Customer</label>${customerName || 'Customer'}</div>
    <div><label>Date</label>${formatDeliveryDateTime(paidAt)}</div>
    <div><label>Payment</label>${paymentMethodLabel(delivery.payment_method)}</div>
    <div><label>Distance</label>${delivery.distance_km} km</div>
  </div>

  <div class="route">
    <h2>Route</h2>
    <div class="addr"><strong>Pickup A</strong>${delivery.pickup_address}</div>
    <div class="addr delivery"><strong>Delivery B</strong>${delivery.delivery_address}</div>
  </div>

  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      <tr><td>Smart Box transport (${delivery.distance_km} km)</td><td style="text-align:right">${formatPrice(b.transport_ht, b.currency)}</td></tr>
      <tr><td>TVA / VAT (${b.vat_percent}%)</td><td style="text-align:right">${formatPrice(b.vat_amount, b.currency)}</td></tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Transport (HT)</span><span>${formatPrice(b.transport_ht, b.currency)}</span></div>
    <div class="row"><span>TVA ${b.vat_percent}%</span><span>${formatPrice(b.vat_amount, b.currency)}</span></div>
    <div class="grand"><span>Total (TTC)</span><span>${formatPrice(b.total_ttc, b.currency)}</span></div>
  </div>

  <div class="footer">
    Thank you for using Smart Box Delivery · Anti-tamper secure transport · ${new Date().getFullYear()}
  </div>
</body>
</html>`;
}

export function downloadDeliveryReceipt(delivery, config, customerName) {
  const html = receiptHtml(delivery, config, customerName);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `receipt-${formatDeliveryRef(delivery.id).replace('#', '')}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printDeliveryReceipt(delivery, config, customerName) {
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) return;
  win.document.write(receiptHtml(delivery, config, customerName));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
