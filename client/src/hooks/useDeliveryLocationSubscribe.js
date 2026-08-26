import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

/** Join delivery room to receive rider/customer GPS (no upload). */
export function useDeliveryLocationSubscribe(deliveryId, enabled) {
  const { socket, connected } = useSocket();

  useEffect(() => {
    if (!enabled || !deliveryId || !socket || !connected) return undefined;
    socket.emit('user:location:join', { deliveryId });
    return () => {
      socket.emit('user:location:leave', { deliveryId });
    };
  }, [deliveryId, enabled, socket, connected]);
}
