import {
  PACKAGE_TYPES, EMPTY_RWANDA_ADDRESS, formatRwandaAddress,
  haversineKm,
} from '../lib/rwandaAddress';
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
  payment_method: 'momo',
};

export function buildDeliveryPayload(form) {
  const pickup_address = formatRwandaAddress(form.pickup);
  const delivery_address = formatRwandaAddress(form.delivery);
  let distance_km = parseFloat(form.distance_km) || 5;

  if (form.pickup_coords && form.delivery_coords) {
    distance_km = Math.max(1, Math.round(haversineKm(
      form.pickup_coords.lat, form.pickup_coords.lng,
      form.delivery_coords.lat, form.delivery_coords.lng,
    ) * 10) / 10);
  }

  return {
    pickup_address,
    delivery_address,
    distance_km,
    payment_method: form.payment_method,
    package_type: form.package_type,
    is_confidential: form.is_confidential,
    pickup_details: form.pickup,
    delivery_details: form.delivery,
    pickup_latitude: form.pickup_coords?.lat ?? null,
    pickup_longitude: form.pickup_coords?.lng ?? null,
    delivery_latitude: form.delivery_coords?.lat ?? null,
    delivery_longitude: form.delivery_coords?.lng ?? null,
    special_instructions: [form.pickup_instructions, form.delivery_instructions].filter(Boolean).join(' | '),
  };
}
