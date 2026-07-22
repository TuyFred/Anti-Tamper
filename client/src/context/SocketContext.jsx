import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function SocketProvider({ children }) {
  const { token, isApproved } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [gpsUpdates, setGpsUpdates] = useState({});

  useEffect(() => {
    if (!token || !isApproved) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    s.on('gps:update', (data) => {
      setGpsUpdates((prev) => ({ ...prev, [data.deviceId]: data }));
      setDevices((prev) =>
        prev.map((d) =>
          d.id === data.deviceId
            ? { ...d, latitude: data.latitude, longitude: data.longitude, is_online: true }
            : d
        )
      );
    });

    s.on('device:update', (data) => {
      setDevices((prev) =>
        prev.map((d) => (d.id === data.id ? { ...d, ...data } : d))
      );
    });

    s.on('alert:new', (alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 100));
    });

    setSocket(s);
    return () => s.disconnect();
  }, [token, isApproved]);

  const setInitialDevices = useCallback((deviceList) => {
    setDevices(deviceList);
  }, []);

  const setInitialAlerts = useCallback((alertList) => {
    setAlerts(alertList);
  }, []);

  const acknowledgeAlertLocal = useCallback((alertId) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId ? { ...a, is_acknowledged: true } : a
      )
    );
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        devices,
        alerts,
        gpsUpdates,
        setInitialDevices,
        setInitialAlerts,
        acknowledgeAlertLocal,
        setDevices,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
