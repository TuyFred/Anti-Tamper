import { supabase } from '../config/supabase.js';
import { getUserProfile } from '../middleware/permissions.js';
import { normalizePhone } from './phone.js';

/** Create or refresh profile row for authenticated user (e.g. after OTP signup). */
export async function ensureUserProfile(user) {
  let profile = await getUserProfile(user.id);
  if (profile) return profile;

  const { data: customerRole } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'customer')
    .maybeSingle();

  const row = {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || user.email,
    role_id: customerRole?.id || null,
    is_approved: true,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const phone = normalizePhone(user.user_metadata?.phone);
  if (phone) row.phone = phone;

  let { data, error } = await supabase
    .from('profiles')
    .upsert(row)
    .select('*, role:roles(id, name, role_permissions(permission:permissions(name)))')
    .single();

  if (error && row.phone && /phone/.test(error.message)) {
    delete row.phone;
    ({ data, error } = await supabase
      .from('profiles')
      .upsert(row)
      .select('*, role:roles(id, name, role_permissions(permission:permissions(name)))')
      .single());
  }

  if (error) {
    console.warn('ensureUserProfile:', error.message);
    return null;
  }
  return data;
}
