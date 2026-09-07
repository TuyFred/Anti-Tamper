import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { api } from '../lib/api';
import { getSocketBaseUrl } from '../lib/runtimeConfig';
import { appendTrailPoint } from '../lib/mapGeo';
import { isLocationFresh, isValidBoxGps, sanitizeDeviceCoords } from '../lib/geocode';

function seedTrailsFromDevices(devices) {
  let trails = {};
  for (const d of devices || []) {
    if (d.latitude != null && d.longitude != null && isLocationFresh(d.last_seen) && isValidBoxGps(d.latitude, d.longitude)) {
      trails[d.id] = [{ lat: d.latitude, lng: d.longitude, t: Date.now() }];
      if (d.device_id) {
        trails[`hw:${d.device_id}`] = [{ lat: d.latitude, lng: d.longitude, t: Date.now() }];
      }
    }
  }
  return trails;
}

const SocketContext = createContext(null);

const defaultConnectionStatus = {
  state: 'idle',
  label: 'Waiting for sign-in',
  detail: 'The dashboard will connect once your account is ready.',
};

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(defaultConnectionStatus);
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [gpsUpdates, setGpsUpdates] = useState({});
  const [deviceTrails, setDeviceTrails] = useState({});
  const [userLocations, setUserLocations] = useState({});
  const [fleetLocations, setFleetLocations] = useState({});
  const [deliveryUpdateTick, setDeliveryUpdateTick] = useState(0);
  /** Instant unlock codes when admin grants — no customer refresh needed. */
  const [deliveryLivePatches, setDeliveryLivePatches] = useState({});

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
      }
      setSocket(null);
      setConnected(false);
      setDeviceTrails({});
      setUserLocations({});
      setDeliveryLivePatches({});
      setConnectionStatus(defaultConnectionStatus);
      return undefined;
    }

    setConnectionStatus({
      state: 'connecting',
      label: 'Connecting live services',
      detail: 'Linking the dashboard to hardware and alert updates.',
    });

    const socketUrl = getSocketBaseUrl();
    const s = io(socketUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 30,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 20000,
      forceNew: true,
    });

    const handleConnect = () => {
      setConnected(true);
      setConnectionStatus({
        state: 'connected',
        label: 'Hardware connected',
        detail: 'Live updates are flowing between the box and the dashboard.',
      });
    };

    const handleDisconnect = () => {
      setConnected(false);
      setConnectionStatus({
        state: 'reconnecting',
        label: 'Reconnecting',
        detail: 'The dashboard is re-establishing the live connection.',
      });
    };

    const handleConnectError = () => {
      setConnected(false);
      setConnectionStatus({
        state: 'offline',
        label: 'Service offline',
        detail: 'The live service is currently unreachable; the UI will retry automatically.',
      });
    };

    const handleReconnect = (attempt) => {
      setConnectionStatus({
        state: 'reconnecting',
        label: `Reconnecting (${attempt})`,
        detail: 'The dashboard is re-establishing the hardware link.',
      });
    };

    const handleSystemStatus = (payload) => {
      if (!payload?.connected) {
        setConnectionStatus({
          state: 'reconnecting',
          label: 'Hardware syncing',
          detail: payload?.detail || 'Waiting for the hardware link to recover.',
        });
        return;
      }
      setConnectionStatus({
        state: 'connected',
        label: 'Hardware connected',
        detail: payload?.detail || 'Live updates are flowing between the box and the dashboard.',
      });
    };

    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);
    s.on('connect_error', handleConnectError);
    s.on('reconnect', handleReconnect);
    s.on('reconnect_error', handleConnectError);
    s.on('system:status', handleSystemStatus);

    s.on('gps:update', (data) => {
      if (!isValidBoxGps(data.latitude, data.longitude)) return;
      setGpsUpdates((prev) => {
        const next = { ...prev, [data.deviceId]: data };
        if (data.hardwareId) next[`hw:${data.hardwareId}`] = data;
        return next;
      });
      setDevices((prev) =>
        prev.map((d) =>
          d.id === data.deviceId || d.device_id === data.hardwareId
            ? {
              ...d,
              latitude: data.latitude,
              longitude: data.longitude,
              is_online: true,
              last_seen: data.timestamp || d.last_seen,
            }
            : d
        )
      );
      setDeviceTrails((prev) => {
        let next = appendTrailPoint(prev, data.deviceId, data.latitude, data.longitude);
        if (data.hardwareId) {
          next = appendTrailPoint(next, `hw:${data.hardwareId}`, data.latitude, data.longitude);
        }
        return next;
      });
    });

    s.on('device:update', (data) => {
      setDevices((prev) =>
        prev.map((d) => (d.id === data.id ? sanitizeDeviceCoords({ ...d, ...data }) : d))
      );
    });

    s.on('alert:new', (alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 100));
    });

    s.on('alert:notify', (alert) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev].slice(0, 100);
      });
    });

    const applyDeliveryLivePatch = (data) => {
      if (!data?.id) {
        setDeliveryUpdateTick((n) => n + 1);
        return;
      }
      const hasTokenField = Object.prototype.hasOwnProperty.call(data, 'unlock_token')
        || Object.prototype.hasOwnProperty.call(data, 'unlock_code');
      const incomingToken = hasTokenField
        ? (data.unlock_token || data.unlock_code || null)
        : undefined;
      // Ignore token-less manager bumps — never clear an existing live unlock code.
      if (!incomingToken && !data.token_closed_at && !hasTokenField) {
        setDeliveryUpdateTick((n) => n + 1);
        return;
      }
      setDeliveryLivePatches((prev) => {
        const prior = prev[data.id] || {};
        const token_closed_at = data.token_closed_at ?? prior.token_closed_at ?? null;
        // Never wipe a live unlock code with null unless the box was closed / token consumed.
        let unlock_token = prior.unlock_token || null;
        if (incomingToken) {
          unlock_token = incomingToken;
        } else if (token_closed_at || (hasTokenField && incomingToken === null && data.token_closed_at)) {
          unlock_token = null;
        }
        return {
          ...prev,
          [data.id]: {
            ...prior,
            unlock_token,
            unlock_code: unlock_token,
            token_expires_at: data.token_expires_at ?? prior.token_expires_at ?? null,
            token_sent_at: data.token_sent_at ?? prior.token_sent_at ?? null,
            token_closed_at,
            token_requested_at: unlock_token ? null : (prior.token_requested_at ?? null),
            status: data.status ?? prior.status,
            open_permission: unlock_token && !token_closed_at
              ? 'granted'
              : (token_closed_at ? 'used' : (data.open_permission || prior.open_permission || 'waiting')),
            customer_can_open: Boolean(unlock_token) && !token_closed_at,
            rider_can_open: false,
            rider_unlock_granted_at: data.rider_unlock_granted_at ?? prior.rider_unlock_granted_at ?? null,
          },
        };
      });
      setDeliveryUpdateTick((n) => n + 1);
    };
    s.on('delivery:update', applyDeliveryLivePatch);
    s.on('delivery:token-sent', applyDeliveryLivePatch);

    s.on('user:location', (data) => {
      if (!data?.deliveryId || !data?.userId) return;
      setUserLocations((prev) => ({
        ...prev,
        [data.deliveryId]: {
          ...(prev[data.deliveryId] || {}),
          [data.userId]: data,
        },
      }));
    });

    s.on('user:location:snapshot', ({ deliveryId, locations }) => {
      if (!deliveryId || !Array.isArray(locations)) return;
      setUserLocations((prev) => {
        const next = { ...(prev[deliveryId] || {}) };
        for (const loc of locations) {
          if (loc?.userId) next[loc.userId] = loc;
        }
        return { ...prev, [deliveryId]: next };
      });
    });

    s.on('user:location:left', ({ deliveryId, userId }) => {
      if (!deliveryId || !userId) return;
      setUserLocations((prev) => {
        const room = { ...(prev[deliveryId] || {}) };
        delete room[userId];
        return { ...prev, [deliveryId]: room };
      });
    });

    s.on('user:location:fleet:snapshot', ({ locations }) => {
      const next = {};
      for (const loc of locations || []) {
        if (loc?.deliveryId && loc?.userId) {
          next[`${loc.deliveryId}:${loc.userId}`] = loc;
        }
      }
      setFleetLocations(next);
    });

    s.on('user:location:fleet', (record) => {
      if (!record?.deliveryId || !record?.userId) return;
      setFleetLocations((prev) => ({
        ...prev,
        [`${record.deliveryId}:${record.userId}`]: record,
      }));
    });

    s.on('user:location:fleet:left', ({ deliveryId, userId }) => {
      if (!deliveryId || !userId) return;
      setFleetLocations((prev) => {
        const next = { ...prev };
        delete next[`${deliveryId}:${userId}`];
        return next;
      });
    });

    setSocket(s);
    return () => {
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);
      s.off('connect_error', handleConnectError);
      s.off('reconnect', handleReconnect);
      s.off('reconnect_error', handleConnectError);
      s.off('system:status', handleSystemStatus);
      s.off('delivery:update', applyDeliveryLivePatch);
      s.off('delivery:token-sent', applyDeliveryLivePatch);
      s.off('user:location');
      s.off('user:location:snapshot');
      s.off('user:location:left');
      s.off('user:location:fleet:snapshot');
      s.off('user:location:fleet');
      s.off('user:location:fleet:left');
      s.disconnect();
      setSocket(null);
      setConnected(false);
      setUserLocations({});
      setFleetLocations({});
      setDeliveryLivePatches({});
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    if (!token) return () => { cancelled = true; };

    const loadInitialData = async () => {
      try {
        const [deviceData, alertData] = await Promise.all([
          api.getDevices(token),
          api.getAlerts(token),
        ]);
        if (!cancelled) {
          setDevices((deviceData || []).map(sanitizeDeviceCoords));
          setAlerts(alertData || []);
          setDeviceTrails(seedTrailsFromDevices(deviceData));
        }
      } catch (error) {
        console.error('Failed to preload dashboard data:', error);
      }
    };

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const setInitialDevices = useCallback((deviceList) => {
    setDevices((deviceList || []).map(sanitizeDeviceCoords));
    setDeviceTrails((prev) => ({ ...seedTrailsFromDevices(deviceList), ...prev }));
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
        connectionStatus,
        devices,
        alerts,
        gpsUpdates,
        deviceTrails,
        userLocations,
        fleetLocations,
        deliveryUpdateTick,
        deliveryLivePatches,
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
