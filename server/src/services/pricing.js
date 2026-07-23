import { deliveryConfig } from '../config/delivery.js';

export function calculateDeliveryPrice(distanceKm) {
  const km = Math.max(deliveryConfig.minDistanceKm, Number(distanceKm) || deliveryConfig.defaultDistanceKm);
  const transportHt = Math.round(deliveryConfig.baseFare + km * deliveryConfig.ratePerKm);
  const vatAmount = Math.round(transportHt * deliveryConfig.vatRate);
  const totalTtc = transportHt + vatAmount;

  return {
    distance_km: Math.round(km * 100) / 100,
    calculated_price: totalTtc,
    transport_ht: transportHt,
    vat_rate: deliveryConfig.vatRate,
    vat_amount: vatAmount,
    total_ttc: totalTtc,
    currency: deliveryConfig.currency,
  };
}

export function generateUnlockToken() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function receiptBreakdown(delivery) {
  const total = Number(delivery.calculated_price) || 0;
  const rate = deliveryConfig.vatRate;
  const transportHt = Math.round(total / (1 + rate));
  const vatAmount = total - transportHt;
  return {
    transport_ht: transportHt,
    vat_rate: rate,
    vat_amount: vatAmount,
    total_ttc: total,
    currency: delivery.currency || deliveryConfig.currency,
  };
}
