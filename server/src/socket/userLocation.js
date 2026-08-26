import { supabase } from '../config/supabase.js';
import { isCustomer, isManager, isRider } from '../middleware/permissions.js';

const LOCATION_TTL_MS = 120_000;
const deliveryLocations = new Map();

function pruneStale() {
  const now = Date.now();
  for (const [deliveryId, users] of deliveryLocations.entries()) {
    for (const [userId, loc] of users.entries()) {
      if (now - new Date(loc.timestamp).getTime() > LOCATION_TTL_MS) {
        users.delete(userId);
      }
    }
    if (users.size === 0) deliveryLocations.delete(deliveryId);
  }
}

async function canAccessDelivery(userId, profile, deliveryId) {
  const { data, error } = await supabase
    .from('delivery_requests')
    .select('customer_id, rider_id, status')
    .eq('id', deliveryId)
    .single();
  if (error || !data) return null;
  if (isManager(profile)) return data;
  if (data.customer_id === userId) return data;
  if (data.rider_id === userId) return data;
  return null;
}

function snapshotForDelivery(deliveryId) {
  const users = deliveryLocations.get(deliveryId);
  if (!users?.size) return [];
  return Array.from(users.values());
}

function snapshotFleet() {
  pruneStale();
  const all = [];
  for (const users of deliveryLocations.values()) {
    for (const loc of users.values()) {
      all.push(loc);
    }
  }
  return all;
}

function broadcastFleetUpdate(io, record) {
  io.to('managers').emit('user:location:fleet', record);
}

function broadcastFleetLeft(io, deliveryId, userId) {
  io.to('managers').emit('user:location:fleet:left', { deliveryId, userId });
}

export function registerUserLocationHandlers(io, socket) {
  socket.on('user:location:join', async ({ deliveryId } = {}) => {
    if (!deliveryId) return;
    const delivery = await canAccessDelivery(socket.userId, socket.profile, deliveryId);
    if (!delivery) return;
    socket.join(`delivery:${deliveryId}`);
    socket.emit('user:location:snapshot', {
      deliveryId,
      locations: snapshotForDelivery(deliveryId).filter((l) => l.userId !== socket.userId),
    });
  });

  socket.on('user:location', async (payload = {}) => {
    const { deliveryId, latitude, longitude, accuracy } = payload;
    if (!deliveryId || latitude == null || longitude == null) return;

    const delivery = await canAccessDelivery(socket.userId, socket.profile, deliveryId);
    if (!delivery) return;
    if (['delivered', 'cancelled'].includes(delivery.status)) return;

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

    socket.join(`delivery:${deliveryId}`);

    const role = socket.profile.role?.name || 'viewer';
    const record = {
      userId: socket.userId,
      deliveryId,
      latitude: lat,
      longitude: lng,
      accuracy: accuracy != null ? Number(accuracy) : null,
      role,
      name: socket.profile.full_name || socket.profile.email || 'User',
      timestamp: new Date().toISOString(),
    };

    if (!deliveryLocations.has(deliveryId)) {
      deliveryLocations.set(deliveryId, new Map());
    }
    deliveryLocations.get(deliveryId).set(socket.userId, record);
    pruneStale();

    io.to(`delivery:${deliveryId}`).emit('user:location', record);
    broadcastFleetUpdate(io, record);
  });

  socket.on('user:location:fleet:join', () => {
    if (!isManager(socket.profile)) return;
    pruneStale();
    socket.emit('user:location:fleet:snapshot', { locations: snapshotFleet() });
  });

  socket.on('user:location:leave', ({ deliveryId } = {}) => {
    if (!deliveryId) return;
    socket.leave(`delivery:${deliveryId}`);
    const users = deliveryLocations.get(deliveryId);
    if (users) {
      users.delete(socket.userId);
      if (users.size === 0) deliveryLocations.delete(deliveryId);
    }
    socket.to(`delivery:${deliveryId}`).emit('user:location:left', {
      deliveryId,
      userId: socket.userId,
    });
    broadcastFleetLeft(io, deliveryId, socket.userId);
  });

  socket.on('disconnect', () => {
    for (const [deliveryId, users] of deliveryLocations.entries()) {
      if (users.delete(socket.userId)) {
        socket.to(`delivery:${deliveryId}`).emit('user:location:left', {
          deliveryId,
          userId: socket.userId,
        });
        broadcastFleetLeft(io, deliveryId, socket.userId);
        if (users.size === 0) deliveryLocations.delete(deliveryId);
      }
    }
  });
}
