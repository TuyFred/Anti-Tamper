import { useEffect, useState } from 'react';
import { Key, Lock, Unlock, CheckCircle2, Loader2, MapPin, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { formatLockStatusLabel, isBoxOpen } from '../lib/deliveryUtils';
import { MAP_LABELS } from '../lib/mapConfig';
import CustomerTokenMessage from './CustomerTokenMessage';
import RiderRouteMap from './RiderRouteMap';

export default function CustomerUnlockPanel({
  delivery,
  token: authToken,
  customerName,
  customerEmail,
  companyName,
  onUpdated,
  onError,
  onSuccess,
}) {
  const [tokenInput, setTokenInput] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [locking, setLocking] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const isReady = ['rider_assigned', 'in_transit'].includes(delivery.status);
  const tokenExpired = Boolean(delivery.token_expires_at)
    && new Date(delivery.token_expires_at) < new Date();
  const tokenConsumed = Boolean(delivery.token_closed_at) || !delivery.unlock_token;
  const boxOpened = Boolean(delivery.token_used_at) && !tokenConsumed && !tokenExpired;
  const canEnterToken = isReady && delivery.unlock_token && !delivery.token_used_at && !tokenConsumed && !tokenExpired;
  const canOpen = canEnterToken;
  const canClose = isReady && Boolean(delivery.token_used_at) && !delivery.token_closed_at;
  const canComplete = isReady && tokenConsumed && !['delivered', 'cancelled'].includes(delivery.status);
  const tokenRequestPending = Boolean(delivery.token_requested_at) && !delivery.unlock_token;
  const canRequestNewToken = isReady
    && delivery.device_id
    && (tokenConsumed || tokenExpired || !delivery.unlock_token)
    && !delivery.token_requested_at;
  const boxIsOpen = delivery.device ? isBoxOpen(delivery.device.lock_status) : false;
  const lockLabel = delivery.device ? formatLockStatusLabel(delivery.device.lock_status) : null;

  useEffect(() => {
    setTokenInput('');
  }, [delivery.id, delivery.unlock_token]);

  const handleOpen = async () => {
    const code = tokenInput.trim().toUpperCase();
    if (!code) {
      onError?.('Enter your unlock code');
      return;
    }
    setUnlocking(true);
    onError?.('');
    try {
      await api.unlockWithToken(authToken, delivery.id, code);
      onSuccess?.('Smart Box opened — press a button on the box or tap Close below when done');
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
      await api.customerLockDelivery(authToken, delivery.id);
      onSuccess?.('Smart Box closed — your code is used. Request a new code from manager if you need to open again.');
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
      onSuccess?.(result?.message || 'Opening request sent — manager will approve so you can open the box again');
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
      {delivery.unlock_token && !tokenConsumed && !tokenExpired && (
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
          Box GPS and your location on the same map.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-white">Smart Box controls</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Open with your code. Close with either button on the box, or tap Close below.
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
                Tap Request box opening — a manager will approve and send a new code.
              </p>
            </div>
          </div>
        )}

        {tokenConsumed && !tokenRequestPending && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/25 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-success">Unlock code used</p>
              <p className="text-xs text-slate-400 mt-1">
                Need to open again? Request a new code — manager will confirm first.
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
                You asked to open the Smart Box again. A manager will approve and send a new code to your dashboard.
              </p>
            </div>
          </div>
        )}

        {canRequestNewToken && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleRequestToken}
              disabled={requesting}
              className="w-full py-3 rounded-xl bg-warning/15 border border-warning/30 text-warning font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Request box opening
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              Separate from payment — manager approves opening the Smart Box again.
            </p>
          </div>
        )}

        {canOpen && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              Step 2 — Enter your code and open
            </p>
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
              Step 3 — Press either button on the box to lock, or tap Close below.
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
