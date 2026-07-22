import { supabase } from '../config/supabase.js';

export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      role:roles (
        id,
        name,
        role_permissions (
          permission:permissions (name)
        )
      )
    `)
    .eq('id', userId)
    .single();

  if (error) return null;
  return data;
}

export function getPermissions(profile) {
  if (!profile?.role?.role_permissions) return [];
  return profile.role.role_permissions.map((rp) => rp.permission.name);
}

export function hasPermission(profile, permissionName) {
  return getPermissions(profile).includes(permissionName);
}

export function isAdmin(profile) {
  return profile?.role?.name === 'admin' && profile?.is_approved === true;
}

export function isManager(profile) {
  if (!profile?.is_approved) return false;
  const role = profile.role?.name;
  return role === 'admin' || role === 'manager';
}

export function isCustomer(profile) {
  return profile?.is_approved && profile?.role?.name === 'customer';
}

export function isRider(profile) {
  return profile?.is_approved && profile?.role?.name === 'motor_rider';
}

export function getRoleName(profile) {
  return profile?.role?.name || 'viewer';
}

export async function canAccessDevice(userId, deviceUuid, requireControl = false) {
  const profile = await getUserProfile(userId);
  if (!profile || !profile.is_approved) return false;

  if (isAdmin(profile) || isManager(profile)) return true;

  if (isRider(profile)) {
    const { data: assignment } = await supabase
      .from('delivery_requests')
      .select('id')
      .eq('rider_id', userId)
      .eq('device_id', deviceUuid)
      .in('status', ['rider_assigned', 'in_transit'])
      .limit(1)
      .maybeSingle();
    if (assignment) return !requireControl;
  }

  const { data } = await supabase
    .from('device_access')
    .select('can_view, can_control')
    .eq('user_id', userId)
    .eq('device_id', deviceUuid)
    .single();

  if (!data) return false;
  return requireControl ? data.can_control : data.can_view;
}

export async function getAccessibleDevices(userId) {
  const profile = await getUserProfile(userId);
  if (!profile || !profile.is_approved) return [];

  if (isAdmin(profile) || isManager(profile)) {
    const { data } = await supabase.from('devices').select('*').order('name');
    return (data || []).map((d) => ({ ...d, can_view: true, can_control: true }));
  }

  if (isRider(profile)) {
    const { data: assignments } = await supabase
      .from('delivery_requests')
      .select('device:devices (*)')
      .eq('rider_id', userId)
      .in('status', ['rider_assigned', 'in_transit'])
      .not('device_id', 'is', null);

    const seen = new Set();
    return (assignments || [])
      .map((row) => row.device)
      .filter((d) => d?.id && !seen.has(d.id) && seen.add(d.id))
      .map((d) => ({ ...d, can_view: true, can_control: false }));
  }

  const { data } = await supabase
    .from('device_access')
    .select('can_view, can_control, device:devices (*)')
    .eq('user_id', userId)
    .eq('can_view', true);

  return (data || [])
    .map((row) => ({
      ...row.device,
      can_view: row.can_view,
      can_control: row.can_control,
    }))
    .filter((d) => d?.id);
}
