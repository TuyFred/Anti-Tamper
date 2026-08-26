const PROFILE_WITH_PHONE = 'id, email, full_name, phone';
const PROFILE_BASIC = 'id, email, full_name';

let profileFields = PROFILE_WITH_PHONE;
let initialized = false;

function buildSelect() {
  return `
  *,
  customer:profiles!delivery_requests_customer_id_fkey(${profileFields}),
  rider:profiles!delivery_requests_rider_id_fkey(${profileFields}),
  device:devices(id, device_id, name, lock_status, is_online)
`;
}

let cachedSelect = buildSelect();

export function isMissingPhoneColumnError(error) {
  const msg = error?.message || '';
  return /profiles_\d+\.phone|column profiles\.phone|column "phone"/i.test(msg);
}

export function getDeliverySelect() {
  return cachedSelect;
}

export function disablePhoneInDeliverySelect() {
  if (profileFields === PROFILE_BASIC) return;
  profileFields = PROFILE_BASIC;
  cachedSelect = buildSelect();
  console.warn(
    '⚠️  profiles.phone column missing — run supabase/profile-phone.sql in Supabase SQL editor. Deliveries work without phone until then.',
  );
}

/** Probe DB once at startup so delivery queries do not 500 when phone column is missing. */
export async function initDeliverySelect(supabase) {
  if (initialized) return getDeliverySelect();

  const { error } = await supabase.from('profiles').select('phone').limit(1);
  if (error && isMissingPhoneColumnError(error)) {
    disablePhoneInDeliverySelect();
  }

  initialized = true;
  return getDeliverySelect();
}

/** Retry delivery query after falling back when phone column is absent. */
export function handleDeliveryQueryError(error) {
  if (!isMissingPhoneColumnError(error)) return false;
  disablePhoneInDeliverySelect();
  return true;
}
