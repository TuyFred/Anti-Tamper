import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useGeolocation } from '../hooks/useGeolocation';
import { useLiveLocationShare } from '../hooks/useLiveLocationShare';
import { shouldShareParticipantLocation } from '../lib/boxTracking';
import { useSocket } from '../context/SocketContext';

/**
 * Keep sharing phone GPS for active deliveries while any app page is open
 * (not only when the map is mounted), so admin FleetMap can see riders/customers.
 */
export default function ActiveLocationShare() {
  const { token, roleName, isRider, isCustomer } = useAuth();
  const { deliveryUpdateTick } = useSocket();
  const [deliveries, setDeliveries] = useState([]);
  const {
    position,
    permission,
    startLiveWatch,
    clearWatch,
  } = useGeolocation();

  useEffect(() => {
    if (!token || (!isRider && !isCustomer)) {
      setDeliveries([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await api.getDeliveries(token);
        if (!cancelled) setDeliveries(list || []);
      } catch {
        if (!cancelled) setDeliveries([]);
      }
    })();
    return () => { cancelled = true; };
  }, [token, isRider, isCustomer, deliveryUpdateTick]);

  const activeShareDelivery = useMemo(() => (
    (deliveries || []).find((d) => shouldShareParticipantLocation(d, roleName)) || null
  ), [deliveries, roleName]);

  const shareEnabled = Boolean(activeShareDelivery);

  useEffect(() => {
    if (!shareEnabled) {
      clearWatch();
      return undefined;
    }
    startLiveWatch();
    return () => clearWatch();
  }, [shareEnabled, startLiveWatch, clearWatch]);

  useLiveLocationShare({
    deliveryId: activeShareDelivery?.id,
    enabled: shareEnabled && permission === 'granted',
    position,
  });

  return null;
}
