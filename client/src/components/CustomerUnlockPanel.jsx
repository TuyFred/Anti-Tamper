import { useEffect, useMemo, useState } from 'react';
import {
  Key, Lock, Unlock, CheckCircle2, Loader2, MapPin, AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { useSocket } from '../context/SocketContext';
import { mergeDeliveriesWithLivePatches } from '../lib/deliveryLivePatch';
import { formatLockStatusLabel, isBoxOpen } from '../lib/deliveryUtils';
import CustomerTokenMessage from './CustomerTokenMessage';
import RiderRouteMap from './RiderRouteMap';

function sameId(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

function unlockCacheKey(deliveryId) {
  return `smartbox:unlock:${deliveryId}`;
}

function readCachedUnlock(deliveryId) {
  try {
    const raw = sessionStorage.getItem(unlockCacheKey(deliveryId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.unlock_token || parsed.token_closed_at) return null;
    if (parsed.token_expires_at && new Date(parsed.token_expires_at) < new Date()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedUnlock(deliveryId, payload) {
  try {
    if (!payload?.unlock_token || payload.token_closed_at) {
      sessionStorage.removeItem(unlockCacheKey(deliveryId));
      return;
    }
    sessionStorage.setItem(unlockCacheKey(deliveryId), JSON.stringify({
      id: deliveryId,
      unlock_token: payload.unlock_token,
      token_expires_at: payload.token_expires_at || null,
      token_sent_at: payload.token_sent_at || null,
      token_closed_at: null,
      open_permission: 'granted',
    }));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Customer open/close: after admin grant, show code and open/close — no waiting banner.
 */
export default function CustomerUnlockPanel({
  delivery: deliveryProp,
  token: authToken,
  customerName,
  customerEmail,
  companyName,
  onUpdated,
  onError,
  onSuccess,
}) {
  const { socket, deliveryLivePatches } = useSocket();
  const [liveGrant, setLiveGrant] = useState(() => readCachedUnlock(deliveryProp?.id));
  const [tokenInput, setTokenInput] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [locking, setLocking] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const delivery = useMemo(() => {
    const [merged] = mergeDeliveriesWithLivePatches([deliveryProp], deliveryLivePatches);
    if (!liveGrant || !sameId(liveGrant.id, deliveryProp.id)) return merged;
    return {
      ...merged,
      unlock_token: liveGrant.unlock_token || merged.unlock_token,
      token_expires_at: liveGrant.token_expires_at || merged.token_expires_at,
      token_sent_at: liveGrant.token_sent_at || merged.token_sent_at,
      token_closed_at: liveGrant.token_closed_at ?? merged.token_closed_at,
      token_requested_at: liveGrant.unlock_token ? null : merged.token_requested_at,
      open_permission: (liveGrant.unlock_token && !liveGrant.token_closed_at)
        ? 'granted'
        : (liveGrant.open_permission || merged.open_permission),
      customer_can_open: Boolean(liveGrant.unlock_token || merged.unlock_token)
        && !(liveGrant.token_closed_at || merged.token_closed_at),
      rider_unlock_granted_at: liveGrant.rider_unlock_granted_at || merged.rider_unlock_granted_at,
    };
  }, [deliveryProp, deliveryLivePatches, liveGrant]);

  const applyStatusPayload = (data, { notifyParent } = {}) => {
    if (!data || !sameId(data.id, deliveryProp.id)) return;
    if (!data.unlock_token && !data.token_closed_at && data.open_permission !== 'granted') return;
    const next = {
      id: data.id,
      unlock_token: data.unlock_token || null,
      token_expires_at: data.token_expires_at || null,
      token_sent_at: data.token_sent_at || null,
      token_closed_at: data.token_closed_at || null,
      open_permission: data.open_permission || null,
      rider_unlock_granted_at: data.rider_unlock_granted_at || null,
    };
    setLiveGrant(next);
    if (next.unlock_token) writeCachedUnlock(deliveryProp.id, next);
    if (data.token_closed_at) writeCachedUnlock(deliveryProp.id, null);
    if (notifyParent && data.unlock_token) onUpdated?.();
  };

  useEffect(() => {
    if (!socket || !deliveryProp?.id) return undefined;
    const onGrant = (data) => applyStatusPayload(data, { notifyParent: true });
    socket.on('delivery:token-sent', onGrant);
    socket.on('delivery:update', onGrant);
    return () => {
      socket.off('delivery:token-sent', onGrant);
      socket.off('delivery:update', onGrant);
    };
  }, [socket, deliveryProp?.id, onUpdated]);

  // Keep pulling the customer unlock code from the API until it appears.
  useEffect(() => {
    if (!authToken || !deliveryProp?.id) return undefined;
    if (deliveryProp.token_closed_at) return undefined;

    const cached = readCachedUnlock(deliveryProp.id);
    if (cached?.unlock_token) {
      setLiveGrant(cached);
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const status = await api.getDeliveryOpenStatus(authToken, deliveryProp.id);
        if (cancelled) return;
        applyStatusPayload(status, { notifyParent: Boolean(status?.unlock_token) });
      } catch {
        try {
          const list = await api.getDeliveries(authToken);
          if (cancelled) return;
          const row = (list || []).find((d) => sameId(d.id, deliveryProp.id));
          if (row) applyStatusPayload(row, { notifyParent: Boolean(row.unlock_token) });
        } catch {
          // ignore
        }
      }
    };

    poll();
    const id = setInterval(poll, 1200);
    const onFocus = () => { poll(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [authToken, deliveryProp?.id, deliveryProp?.token_closed_at, onUpdated]);

  // Stop needing cache once parent list has the code from API.
  useEffect(() => {
    if (deliveryProp?.unlock_token && !deliveryProp.token_closed_at) {
      writeCachedUnlock(deliveryProp.id, deliveryProp);
    }
  }, [deliveryProp?.id, deliveryProp?.unlock_token, deliveryProp?.token_closed_at]);

  const isReady = ['rider_assigned', 'in_transit'].includes(delivery.status);
  const tokenExpired = Boolean(delivery.token_expires_at)
    && new Date(delivery.token_expires_at) < new Date();
  const hasCode = Boolean(delivery.unlock_token) && !delivery.token_closed_at && !tokenExpired;
  const tokenConsumed = Boolean(delivery.token_closed_at)
    || (!delivery.unlock_token && Boolean(delivery.token_used_at));
  const canOpen = isReady
    && !tokenConsumed
    && !tokenExpired
    && (!delivery.token_used_at || delivery.device?.lock_status === 'locked');
  const canClose = isReady && Boolean(delivery.token_used_at) && !delivery.token_closed_at;
  const canComplete = isReady && tokenConsumed && !['delivered', 'cancelled'].includes(delivery.status);
  const tokenRequestPending = Boolean(delivery.token_requested_at) && !delivery.unlock_token && !hasCode;
  const canRequestNewToken = isReady
    && delivery.device_id
    && (tokenConsumed || tokenExpired)
    && !delivery.token_requested_at;
  const boxIsOpen = delivery.device ? isBoxOpen(delivery.device.lock_status) : false;
  const lockLabel = delivery.device ? formatLockStatusLabel(delivery.device.lock_status) : null;

  useEffect(() => {
    if (hasCode) {
      setTokenInput(String(delivery.unlock_token).toUpperCase());
    }
  }, [delivery.id, delivery.unlock_token, hasCode]);

  const handleOpen = async () => {
    const code = (tokenInput || delivery.unlock_token || '').trim().toUpperCase();
    if (!code) {
      onError?.('Enter your unlock code');
      return;
    }
    setUnlocking(true);
    onError?.('');
    try {
      const result = await api.unlockWithToken(authToken, delivery.id, code);
      onSuccess?.(result?.message || 'Smart Box opened — collect your items, then Close');
      await onUpdated?.();
    } catch (err) {
      onError?.(err.message);
    } finally {
      setUnlocking(false);
    }
  };

  const handleClose = async () => {
    setLocking(true);
    onError?.('');
    try {
      const result = await api.customerLockDelivery(authToken, delivery.id);
      onSuccess?.(result?.message || 'Smart Box closed — unlock code used');
      setLiveGrant(null);
      writeCachedUnlock(delivery.id, null);
      await onUpdated?.();
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLocking(false);
    }
  };

  const handleRequestToken = async () => {
    setRequesting(true);
    onError?.('');
    try {
      const result = await api.requestDeliveryToken(authToken, delivery.id);
      onSuccess?.(result?.message || 'Opening request sent — wait for admin approval');
      await onUpdated?.();
    } catch (err) {
      onError?.(err.message);
    } finally {
      setRequesting(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    onError?.('');
    try {
      await api.completeDelivery(authToken, delivery.id);
      onSuccess?.('Delivery completed');
      await onUpdated?.();
    } catch (err) {
      onError?.(err.message);
    } finally {
      setCompleting(false);
    }
  };

  if (!isReady && delivery.status !== 'delivered') return null;

  return (
    <div className="space-y-4">
      {hasCode && (
        <CustomerTokenMessage
          delivery={delivery}
          customerName={customerName}
          customerEmail={customerEmail}
          companyName={companyName}
          onCopyError={onError}
        />
      )}

      <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-primary-light flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          Step 1 — Go to delivery location (B)
        </p>
        <p className="text-sm text-slate-200 leading-snug break-words">{delivery.delivery_address}</p>
        {delivery.delivery_latitude != null && delivery.delivery_longitude != null && (
          <div className="rounded-xl overflow-hidden border border-border">
            <RiderRouteMap delivery={delivery} height="min(240px, 42vh)" live />
          </div>
        )}
        <p className="text-[11px] text-slate-500">
          Follow the map to point B. Open the box only after you arrive and have your unlock code.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-white">Smart Box — open & close</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              1) Code · 2) Open · 3) Close · 4) Confirm receipt
            </p>
          </div>
          {delivery.device && lockLabel && (
            <span className={`text-xs font-mono shrink-0 ${boxIsOpen ? 'text-success' : 'text-slate-400'}`}>
              {delivery.device.device_id}
              {' · '}
              {lockLabel}
            </span>
          )}
        </div>

        {tokenExpired && !tokenConsumed && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/25 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">Unlock code expired</p>
              <p className="text-xs text-slate-400 mt-1">
                Request opening again — admin will send a new code.
              </p>
            </div>
          </div>
        )}

        {tokenConsumed && !tokenRequestPending && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/25 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-success">Box closed — code used</p>
              <p className="text-xs text-slate-400 mt-1">
                Confirm receipt below. Need to open again? Request a new code.
              </p>
            </div>
          </div>
        )}

        {tokenRequestPending && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/25 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">Opening request pending</p>
              <p className="text-xs text-slate-400 mt-1">
                Admin will approve and your new unlock code will appear here.
              </p>
            </div>
          </div>
        )}

        {canRequestNewToken && (
          <button
            type="button"
            onClick={handleRequestToken}
            disabled={requesting}
            className="w-full py-3 rounded-xl bg-warning/15 border border-warning/30 text-warning font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            Request box opening
          </button>
        )}

        {canOpen && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              Step 2 — Unlock code & open
            </p>
            {!hasCode && (
              <p className="text-[11px] text-slate-500">
                Enter the customer code from admin (Operations), or wait a moment — it loads here automatically.
              </p>
            )}
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="Unlock code"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-surface rounded-xl border border-border text-white text-lg font-mono tracking-widest text-center focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={handleOpen}
              disabled={unlocking || !tokenInput.trim()}
              className="w-full py-3.5 rounded-xl bg-success text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {unlocking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Unlock className="w-5 h-5" />}
              Open Smart Box
            </button>
          </div>
        )}

        {canClose && (
          <div className="space-y-3">
            <p className="text-sm text-success font-semibold flex items-center gap-2">
              <Unlock className="w-4 h-4" />
              Box is open — collect your items
            </p>
            <p className="text-xs text-slate-400 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Step 3 — Press a button on the box, or tap Close below.
            </p>
            <button
              type="button"
              onClick={handleClose}
              disabled={locking}
              className="w-full py-3.5 rounded-xl bg-surface border-2 border-warning/40 text-warning font-bold flex items-center justify-center gap-2 hover:bg-warning/10 disabled:opacity-50"
            >
              {locking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
              Close Smart Box
            </button>
          </div>
        )}

        {canComplete && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs font-semibold text-slate-300">Step 4 — Confirm receipt</p>
            <button
              type="button"
              onClick={handleComplete}
              disabled={completing}
              className="w-full py-3 rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirm delivery received
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
