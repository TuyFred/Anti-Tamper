import { deliveryConfig } from '../config/delivery.js';

export function calculateDeliveryPrice(distanceKm) {
  const km = Math.max(deliveryConfig.minDistanceKm, Number(distanceKm) || deliveryConfig.defaultDistanceKm);
  const price = deliveryConfig.baseFare + km * deliveryConfig.ratePerKm;
  return {
    distance_km: Math.round(km * 100) / 100,
    calculated_price: Math.round(price),
    currency: deliveryConfig.currency,
  };
}

export function generateUnlockToken() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
