import { supabase } from '../config/supabase.js';
import { getUserProfile, hasPermission, isAdmin, isManager } from './permissions.js';
import { ensureUserProfile } from '../lib/profile.js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = user;
  req.token = token;
  req.profile = await getUserProfile(user.id);
  next();
}

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

  let profile = await getUserProfile(user.id);
  if (!profile) {
    profile = await ensureUserProfile(user);
  }
  if (!profile) {
    return res.status(403).json({ error: 'Profile not found — try signing out and back in' });
  }

  req.user = user;
  req.profile = profile;
  req.token = token;
  next();
}

export function requireApproved(_req, _res, next) {
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
