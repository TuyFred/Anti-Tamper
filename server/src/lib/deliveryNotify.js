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
    const code = delivery.unlock_token || delivery.unlock_code || null;
    const customerPayload = {
      ...base,
      unlock_token: code,
      unlock_code: code,
      open_permission: base.open_granted ? 'granted' : (delivery.token_closed_at ? 'used' : 'waiting'),
      customer_can_open: Boolean(code) && !delivery.token_closed_at,
      rider_unlock_granted_at: delivery.rider_unlock_granted_at || null,
    };
    const room = `user:${delivery.customer_id}`;
    ioInstance.to(room).emit('delivery:token-sent', customerPayload);
    ioInstance.to(room).emit('delivery:update', customerPayload);
    // Second push shortly after in case the client connected mid-grant.
    setTimeout(() => {
      if (!ioInstance) return;
      ioInstance.to(room).emit('delivery:token-sent', customerPayload);
      ioInstance.to(room).emit('delivery:update', customerPayload);
    }, 1200);
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
