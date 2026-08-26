/** Push delivery updates to connected dashboards (customer inbox refresh). */
let ioInstance = null;

export function setDeliveryIo(io) {
  ioInstance = io;
}

export function notifyDeliveryUpdate(delivery) {
  if (!ioInstance || !delivery?.id) return;

  const payload = {
    id: delivery.id,
    customer_id: delivery.customer_id,
    token_sent_at: delivery.token_sent_at || null,
    status: delivery.status,
  };

  ioInstance.to('approved').emit('delivery:update', payload);

  if (delivery.customer_id) {
    ioInstance.to(`user:${delivery.customer_id}`).emit('delivery:token-sent', payload);
  }
}
