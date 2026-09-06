import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../lib/api';

let memoryCache = { token: null, data: null };

/** Shared deliveries list — instant sidebar navigation from cache */
export function useDeliveriesCache() {
  const { token } = useAuth();
  const { deliveryUpdateTick } = useSocket();
  const [deliveries, setDeliveries] = useState(() => (
    token && memoryCache.token === token && memoryCache.data ? memoryCache.data : []
  ));
  const [loading, setLoading] = useState(() => (
    !(token && memoryCache.token === token && memoryCache.data)
  ));
  const [refreshing, setRefreshing] = useState(false);
  const tickRef = useRef(deliveryUpdateTick);

  const refresh = useCallback(async (silent = false) => {
    if (!token) return [];
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const list = await api.getDeliveries(token);
      memoryCache = { token, data: list || [] };
      setDeliveries(memoryCache.data);
      return memoryCache.data;
    } catch (err) {
      if (err?.status === 401) {
        memoryCache = { token: null, data: null };
        setDeliveries([]);
        return [];
      }
      console.error(err);
      return memoryCache.data || [];
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setDeliveries([]);
      setLoading(false);
      return;
    }
    if (memoryCache.token === token && memoryCache.data) {
      setDeliveries(memoryCache.data);
      setLoading(false);
      return;
    }
    refresh(false);
  }, [token, refresh]);

  useEffect(() => {
    if (!token || deliveryUpdateTick === tickRef.current) return;
    tickRef.current = deliveryUpdateTick;
    refresh(true);
  }, [deliveryUpdateTick, token, refresh]);

  return {
    deliveries,
    loading,
    refreshing,
    refresh,
    setDeliveries: (next) => {
      if (token) memoryCache = { token, data: next };
      setDeliveries(next);
    },
  };
}

export function invalidateDeliveriesCache() {
  memoryCache = { token: memoryCache.token, data: null };
}
