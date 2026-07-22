import { supabase } from '../config/supabase.js';
import { getUserProfile, hasPermission, isAdmin, isManager } from './permissions.js';

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const profile = await getUserProfile(user.id);
  if (!profile) {
    return res.status(403).json({ error: 'Profile not found' });
  }

  req.user = user;
  req.profile = profile;
  req.token = token;
  next();
}

export function requireApproved(req, res, next) {
  if (!req.profile.is_approved) {
    return res.status(403).json({
      error: 'Account pending admin approval',
      code: 'PENDING_APPROVAL',
    });
  }
  next();
}

export function requirePermission(permissionName) {
  return (req, res, next) => {
    if (!hasPermission(req.profile, permissionName) && !isAdmin(req.profile)) {
      return res.status(403).json({ error: `Permission denied: ${permissionName}` });
    }
    next();
  };
}

export function requireAdmin(req, res, next) {
  if (!isAdmin(req.profile) && !isManager(req.profile)) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
}

export function requireManager(req, res, next) {
  if (!isManager(req.profile)) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
}
