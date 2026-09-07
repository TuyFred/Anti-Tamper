/** Push delivery updates to connected dashboards (customer inbox refresh). */
let ioInstance = null;

export function setDeliveryIo(io) {
  ioInstance = io;
}

export function notifyDeliveryUpdate(delivery) {
  if (!ioInstance || !delivery?.id) return;

  const base = {
    id: delivery.id,
    customer_id: delivery.customer_id,
    rider_id: delivery.rider_id || null,
    token_sent_at: delivery.token_sent_at || null,
    token_expires_at: delivery.token_expires_at || null,
    token_closed_at: delivery.token_closed_at || null,
    status: delivery.status,
    open_granted: Boolean(delivery.unlock_token) && !delivery.token_closed_at,
  };

  // Managers only — customers must not receive token-less bumps on the shared room.
  ioInstance.to('managers').emit('delivery:update', base);

  // Customer receives the unlock code after admin grant (customer opens the box).
  if (delivery.customer_id) {
    const customerPayload = {
      ...base,
      unlock_token: delivery.unlock_token || null,
      open_permission: base.open_granted ? 'granted' : (delivery.token_closed_at ? 'used' : 'waiting'),
      customer_can_open: Boolean(delivery.unlock_token) && !delivery.token_closed_at,
      rider_unlock_granted_at: delivery.rider_unlock_granted_at || null,
    };
    ioInstance.to(`user:${delivery.customer_id}`).emit('delivery:token-sent', customerPayload);
    ioInstance.to(`user:${delivery.customer_id}`).emit('delivery:update', customerPayload);
  }

  // Rider: status only — never the unlock code (customer opens).
  if (delivery.rider_id) {
    ioInstance.to(`user:${delivery.rider_id}`).emit('delivery:update', {
      ...base,
      open_permission: base.open_granted ? 'granted' : (delivery.token_closed_at ? 'used' : 'waiting'),
      customer_open_granted: base.open_granted,
      rider_can_open: false,
    });
  }
}
