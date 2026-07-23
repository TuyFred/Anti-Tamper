import PDFDocument from 'pdfkit';
import { deliveryConfig } from '../config/delivery.js';

const DATE_LOCALE = 'en-US';

function formatPrice(amount, currency = 'RWF') {
  return `${Number(amount || 0).toLocaleString(DATE_LOCALE)} ${currency}`;
}

function formatRef(id) {
  if (!id) return 'N/A';
  return `#${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

/** Full date and time in English */
function formatDateTime(iso) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString(DATE_LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Date only in English (for range labels) */
function formatDateOnly(value) {
  if (!value) return 'N/A';
  const d = String(value).length === 10
    ? new Date(`${value}T12:00:00Z`)
    : new Date(value);
  return d.toLocaleDateString(DATE_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatReportPeriod(filters = {}) {
  const { from, to } = filters;
  if (from && to) return `${formatDateOnly(from)} to ${formatDateOnly(to)}`;
  if (from) return `From ${formatDateOnly(from)} onward`;
  if (to) return `Up to ${formatDateOnly(to)}`;
  return 'All time (no date filter applied)';
}

function statusLabel(status) {
  const labels = {
    awaiting_payment: 'Awaiting payment',
    payment_submitted: 'Payment submitted',
    payment_verified: 'Payment verified',
    rider_assigned: 'Rider assigned',
    in_transit: 'In transit',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
  return labels[status] || status || 'N/A';
}

function paymentLabel(method) {
  if (method === 'bank') return 'Bank transfer';
  if (method === 'momo') return 'Mobile Money (MoMo)';
  return method || 'N/A';
}

function eventTypeLabel(type) {
  const labels = {
    submitted: 'Payment submitted',
    verified: 'Payment verified',
    rejected: 'Payment rejected',
    cancelled: 'Payment cancelled',
  };
  return labels[type] || type;
}

function docHeader(doc, title) {
  doc.fontSize(20).fillColor('#2563eb').text('Smart Box Delivery', { continued: false });
  doc.fontSize(9).fillColor('#64748b')
    .text(`${deliveryConfig.companyName} | ${deliveryConfig.companyAddress} | ${deliveryConfig.companyTin}`);
  doc.moveDown(0.5);
  doc.fontSize(16).fillColor('#0f172a').text(title);
  doc.moveDown(0.4);
  doc.strokeColor('#2563eb').lineWidth(2)
    .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.8);
  doc.fillColor('#0f172a');
}

function writeReportMeta(doc, filters = {}) {
  const generatedAt = formatDateTime(new Date().toISOString());
  doc.fontSize(10).fillColor('#334155');
  doc.text(`Report period: ${formatReportPeriod(filters)}`, { continued: false });
  doc.text(`Generated on: ${generatedAt}`, { continued: false });
  if (filters.from || filters.to) {
    doc.fontSize(8).fillColor('#64748b')
      .text(`Filter: ${filters.from || 'start'} to ${filters.to || 'present'} (UTC dates)`, { continued: false });
  }
  doc.moveDown(1);
  doc.fillColor('#0f172a');
}

function stampFooters(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const bottom = doc.page.height - 45;
    const pageNum = i - range.start + 1;
    const total = range.count;
    doc.fontSize(8).fillColor('#94a3b8')
      .text(
        `Smart Box Delivery Platform | Page ${pageNum} of ${total} | Generated ${formatDateTime(new Date().toISOString())}`,
        50,
        bottom,
        { align: 'center', width: 495, lineBreak: false },
      );
  }
}

function collectPdfBuffer(buildFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    buildFn(doc);
    stampFooters(doc);
    doc.end();
  });
}

export async function buildDeliveriesSummaryPdf(deliveries, filters = {}) {
  return collectPdfBuffer((doc) => {
    docHeader(doc, 'Deliveries Summary Report');
    writeReportMeta(doc, filters);

    doc.fontSize(10).text(`Total deliveries in period: ${deliveries.length}`);
    doc.moveDown(0.6);

    const cols = [50, 115, 185, 300, 400, 475];
    const headers = ['Ref', 'Status', 'Customer', 'Route (A to B)', 'Amount', 'Created'];
    doc.fontSize(8).fillColor('#64748b');
    const headerY = doc.y;
    headers.forEach((h, i) => doc.text(h, cols[i], headerY, { width: 80 }));
    doc.moveDown(0.9);
    doc.fillColor('#0f172a').fontSize(8);

    if (deliveries.length === 0) {
      doc.fontSize(10).text('No deliveries found for the selected date range.');
      return;
    }

    deliveries.forEach((d) => {
      if (doc.y > 700) doc.addPage();
      const y = doc.y;
      doc.text(formatRef(d.id), cols[0], y, { width: 60 });
      doc.text(statusLabel(d.status), cols[1], y, { width: 65 });
      doc.text(d.customer?.full_name || d.customer?.email || 'N/A', cols[2], y, { width: 110 });
      const route = `${(d.pickup_address || '').slice(0, 22)} -> ${(d.delivery_address || '').slice(0, 18)}`;
      doc.text(route, cols[3], y, { width: 95 });
      doc.text(formatPrice(d.calculated_price, d.currency), cols[4], y, { width: 70 });
      doc.text(formatDateTime(d.created_at), cols[5], y, { width: 70 });
      doc.moveDown(0.7);
    });
  });
}

export async function buildFinancialPdf(deliveries, filters = {}) {
  const total = deliveries.reduce((s, d) => s + Number(d.calculated_price || 0), 0);
  const vatRate = deliveryConfig.vatRate;
  const subtotalExVat = Math.round(total / (1 + vatRate));
  const vatAmount = total - subtotalExVat;
  const paid = deliveries.filter((d) =>
    ['payment_verified', 'rider_assigned', 'in_transit', 'delivered'].includes(d.status),
  );
  const pending = deliveries.filter((d) => d.status === 'payment_submitted');

  return collectPdfBuffer((doc) => {
    docHeader(doc, 'Financial Report');
    writeReportMeta(doc, filters);

    doc.fontSize(11).text('Summary', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    doc.text(`Total revenue (incl. VAT): ${formatPrice(total)}`);
    doc.text(`Subtotal (excl. VAT): ${formatPrice(subtotalExVat)}`);
    doc.text(`VAT (${Math.round(vatRate * 100)}%): ${formatPrice(vatAmount)}`);
    doc.text(`Paid deliveries: ${paid.length}`);
    doc.text(`Pending payment verification: ${pending.length}`);
    doc.moveDown(1);

    doc.fontSize(11).text('Paid deliveries (detail)', { underline: true });
    doc.moveDown(0.5);

    if (paid.length === 0) {
      doc.fontSize(10).text('No paid deliveries in this date range.');
      return;
    }

    paid.forEach((d) => {
      if (doc.y > 700) doc.addPage();
      doc.fontSize(9).text(
        `${formatRef(d.id)} | ${formatPrice(d.calculated_price, d.currency)} | ${paymentLabel(d.payment_method)} | Verified ${formatDateTime(d.payment_verified_at)}`,
      );
    });
  });
}

export async function buildActivityPdf(entries, filters = {}) {
  return collectPdfBuffer((doc) => {
    docHeader(doc, 'Activity & Audit Log');
    writeReportMeta(doc, filters);

    doc.fontSize(10).text(`Total events in period: ${entries.length}`);
    doc.moveDown(0.6);

    if (entries.length === 0) {
      doc.fontSize(10).text('No activity recorded for the selected date range.');
      return;
    }

    entries.forEach((e) => {
      if (doc.y > 700) doc.addPage();
      doc.fontSize(9).fillColor('#64748b').text(formatDateTime(e.created_at));
      doc.fillColor('#0f172a').fontSize(10)
        .text(`${e.entity_type} | ${e.action}${e.summary ? ` — ${e.summary}` : ''}`);
      if (e.actor?.full_name || e.actor?.email) {
        doc.fontSize(8).fillColor('#64748b').text(`By: ${e.actor.full_name || e.actor.email}`);
      }
      doc.moveDown(0.5);
    });
  });
}

export async function buildDeliveryDetailPdf(delivery, history, payments, filters = {}) {
  return collectPdfBuffer((doc) => {
    docHeader(doc, `Delivery Report ${formatRef(delivery.id)}`);
    writeReportMeta(doc, filters);

    doc.fontSize(10);
    doc.text(`Status: ${statusLabel(delivery.status)}`);
    doc.text(`Created: ${formatDateTime(delivery.created_at)}`);
    if (delivery.delivered_at) doc.text(`Delivered: ${formatDateTime(delivery.delivered_at)}`);
    doc.moveDown(0.5);
    doc.text(`Customer: ${delivery.customer?.full_name || delivery.customer?.email || 'N/A'}`);
    doc.text(`Rider: ${delivery.rider?.full_name || 'Not assigned'}`);
    doc.text(`Smart Box: ${delivery.device?.device_id || 'Not assigned'}`);
    doc.text(`Amount: ${formatPrice(delivery.calculated_price, delivery.currency)}`);
    doc.text(`Distance: ${delivery.distance_km} km`);
    doc.moveDown(0.5);
    doc.text(`Pickup (A): ${delivery.pickup_address}`);
    if (delivery.pickup_latitude != null) {
      doc.fontSize(8).fillColor('#64748b')
        .text(`Map coordinates: ${delivery.pickup_latitude}, ${delivery.pickup_longitude}`);
      doc.fillColor('#0f172a').fontSize(10);
    }
    doc.text(`Delivery (B): ${delivery.delivery_address}`);
    if (delivery.delivery_latitude != null) {
      doc.fontSize(8).fillColor('#64748b')
        .text(`Map coordinates: ${delivery.delivery_latitude}, ${delivery.delivery_longitude}`);
      doc.fillColor('#0f172a').fontSize(10);
    }
    doc.moveDown(1);

    doc.fontSize(11).text('Status timeline', { underline: true });
    doc.moveDown(0.3);
    if (history.length === 0) {
      doc.fontSize(9).text(`Requested on ${formatDateTime(delivery.created_at)}`);
    } else {
      history.forEach((h) => {
        doc.fontSize(9).text(
          `${formatDateTime(h.created_at)} | ${statusLabel(h.from_status) || 'New'} -> ${statusLabel(h.to_status)}${h.notes ? ` (${h.notes})` : ''}`,
        );
      });
    }

    if (payments.length) {
      doc.moveDown(0.8);
      doc.fontSize(11).text('Payment events', { underline: true });
      doc.moveDown(0.3);
      payments.forEach((p) => {
        doc.fontSize(9).text(
          `${formatDateTime(p.created_at)} | ${eventTypeLabel(p.event_type)} | ${formatPrice(p.amount, p.currency)} | ${paymentLabel(p.payment_method)}`,
        );
      });
    }
  });
}
