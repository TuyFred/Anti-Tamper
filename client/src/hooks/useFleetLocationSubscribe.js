import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

/** Admin/manager — receive live GPS from all riders & customers on active deliveries. */
export function useFleetLocationSubscribe(enabled) {
  const { socket, connected } = useSocket();

  useEffect(() => {
    if (!enabled || !socket) return undefined;

    const join = () => {
      socket.emit('user:location:fleet:join');
    };

    if (connected) join();
    socket.on('connect', join);

    return () => {
      socket.off('connect', join);
    };
  }, [enabled, socket, connected]);
}
