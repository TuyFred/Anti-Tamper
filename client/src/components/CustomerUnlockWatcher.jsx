import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../lib/api';
import { mergeDeliveriesWithLivePatches } from '../lib/deliveryLivePatch';
import CustomerUnlockCodePopup from './CustomerUnlockCodePopup';

/**
 * Global customer watcher: polls + socket so unlock codes popup on ANY page
 * as soon as admin grants open permission.
 */
export default function CustomerUnlockWatcher() {
  const { token, isCustomer } = useAuth();
  const { deliveryLivePatches, deliveryUpdateTick } = useSocket();
  const [codes, setCodes] = useState([]);

  useEffect(() => {
    if (!token || !isCustomer) {
      setCodes([]);
      return undefined;
    }

    let cancelled = false;
    let authDead = false;

    const pull = async () => {
      if (cancelled || authDead) return;
      try {
        const list = await api.getMyUnlockCodes(token);
        if (!cancelled) setCodes(Array.isArray(list) ? list : []);
      } catch (err) {
        if (err?.status === 401) {
          authDead = true;
          return;
        }
      }
    };

    pull();
    const id = setInterval(pull, 2500);
    const onFocus = () => { pull(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [token, isCustomer, deliveryUpdateTick]);

  const deliveries = useMemo(
    () => mergeDeliveriesWithLivePatches(
      (codes || []).map((c) => ({
        ...c,
        unlock_token: c.unlock_token || c.unlock_code || null,
        status: c.status || 'rider_assigned',
      })),
      deliveryLivePatches,
    ),
    [codes, deliveryLivePatches],
  );

  if (!isCustomer) return null;
  return <CustomerUnlockCodePopup deliveries={deliveries} />;
}
