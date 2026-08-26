import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';

const MIN_SHARE_INTERVAL_MS = 2000;

/**
 * Share phone/laptop GPS with others on the same delivery (rider ↔ customer ↔ manager).
 */
export function useLiveLocationShare({ deliveryId, enabled, position }) {
  const { socket, connected } = useSocket();
  const lastSent = useRef(0);

  useEffect(() => {
    if (!enabled || !deliveryId || !socket || !connected) return undefined;

    socket.emit('user:location:join', { deliveryId });

    return () => {
      socket.emit('user:location:leave', { deliveryId });
    };
  }, [deliveryId, enabled, socket, connected]);

  useEffect(() => {
    if (!enabled || !deliveryId || !socket || !connected || !position) return;

    const now = Date.now();
    if (now - lastSent.current < MIN_SHARE_INTERVAL_MS) return;
    lastSent.current = now;

    socket.emit('user:location', {
      deliveryId,
      latitude: position.lat,
      longitude: position.lng,
      accuracy: position.accuracy,
    });
  }, [
    deliveryId,
    enabled,
    socket,
    connected,
    position?.lat,
    position?.lng,
    position?.accuracy,
    position?.timestamp,
  ]);
}

export function usePeerLocations(deliveryId, excludeUserId) {
  const { userLocations } = useSocket();
  if (!deliveryId) return [];
  const list = userLocations[deliveryId] || {};
  return Object.values(list).filter((loc) => loc.userId !== excludeUserId);
}
