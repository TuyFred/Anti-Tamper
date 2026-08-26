import {
  PACKAGE_TYPES, EMPTY_RWANDA_ADDRESS, formatRwandaAddress,
} from '../lib/rwandaAddress';
import { coordsFromRwandaAddress } from '../lib/geocode';
import { RwandaAddressFields } from './RwandaAddressFields';

export { PACKAGE_TYPES, formatRwandaAddress, RwandaAddressFields };

export const INITIAL_DELIVERY_FORM = {
  package_type: 'documents',
  is_confidential: false,
  pickup: { ...EMPTY_RWANDA_ADDRESS },
  delivery: { ...EMPTY_RWANDA_ADDRESS },
  pickup_coords: null,
  delivery_coords: null,
  pickup_instructions: '',
  delivery_instructions: '',
  distance_km: '5',
};

export function validateRwandaAddress(addr, label) {
  if (!addr?.province) return `${label}: select province`;
  if (!addr?.district) return `${label}: select district`;
  if (!addr?.sector) return `${label}: select sector`;
  if (!addr?.cell) return `${label}: select cell`;
  if (!addr?.village) return `${label}: select village`;
  if (!addr?.road?.trim()) return `${label}: enter road / house number`;
  return null;
}

export function validateDeliveryForm(form) {
  const pickupErr = validateRwandaAddress(form.pickup, 'Pickup');
  if (pickupErr) return pickupErr;
  const deliveryErr = validateRwandaAddress(form.delivery, 'Delivery');
  if (deliveryErr) return deliveryErr;
  return null;
}

export function buildDeliveryPayload(form) {
  const pickup_coords = form.pickup_coords || coordsFromRwandaAddress(form.pickup);
  const delivery_coords = form.delivery_coords || coordsFromRwandaAddress(form.delivery);
  const pickup_address = formatRwandaAddress(form.pickup);
  const delivery_address = formatRwandaAddress(form.delivery);
  const distance_km = Math.max(1, parseFloat(form.distance_km) || 5);

  return {
    pickup_address,
    delivery_address,
    distance_km,
    package_type: form.package_type,
    is_confidential: form.is_confidential,
    pickup_details: form.pickup,
    delivery_details: form.delivery,
    pickup_latitude: pickup_coords?.lat ?? null,
    pickup_longitude: pickup_coords?.lng ?? null,
    delivery_latitude: delivery_coords?.lat ?? null,
    delivery_longitude: delivery_coords?.lng ?? null,
    special_instructions: [form.pickup_instructions, form.delivery_instructions].filter(Boolean).join(' | '),
  };
}
