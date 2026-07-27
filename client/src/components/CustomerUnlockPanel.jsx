import { useEffect, useState } from 'react';
import {
  Key, Lock, Unlock, CheckCircle2, Loader2, MapPin, AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { googleMapsDirectionsUrl } from '../lib/mapConfig';
import CustomerTokenMessage from './CustomerTokenMessage';

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

  const isReady = ['rider_assigned', 'in_transit'].includes(delivery.status);
  const tokenConsumed = Boolean(delivery.token_closed_at) || !delivery.unlock_token;
  const boxOpened = Boolean(delivery.token_used_at) && !tokenConsumed;
  const canEnterToken = isReady && delivery.unlock_token && !delivery.token_used_at && !tokenConsumed;
  const canOpen = canEnterToken;
  const canClose = isReady && boxOpened;
  const canComplete = isReady && tokenConsumed && !['delivered', 'cancelled'].includes(delivery.status);
  const deviceLocked = delivery.device?.lock_status !== 'unlocked';

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
      onSuccess?.('Smart Box opened');
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
      onSuccess?.('Smart Box closed — code used');
      await onUpdated?.();
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLocking(false);
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

  const mapsUrl = delivery.delivery_latitude != null
    ? googleMapsDirectionsUrl(delivery.delivery_latitude, delivery.delivery_longitude)
    : null;

  return (
    <div className="space-y-4">
      {/* Step 1 — Token message from manager */}
      {delivery.unlock_token && !tokenConsumed && (
        <CustomerTokenMessage
          delivery={delivery}
          customerName={customerName}
          customerEmail={customerEmail}
          companyName={companyName}
          onCopyError={onError}
        />
      )}

      {/* Where to open */}
      <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-primary-light flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          Step 1 — Go to delivery location (B)
        </p>
        <p className="text-sm text-slate-200 leading-snug break-words">{delivery.delivery_address}</p>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-xs font-medium text-primary-light hover:underline"
          >
            Open directions in Google Maps
          </a>
        )}
      </div>

      {/* Open / close controls */}
      <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-white">Smart Box controls</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              One-time code — open once, close when done, code expires after close
            </p>
          </div>
          {delivery.device && (
            <span className="text-xs text-slate-400 font-mono shrink-0">
              {delivery.device.device_id}
              {' · '}
              {deviceLocked ? 'Locked' : 'Open'}
            </span>
          )}
        </div>

        {tokenConsumed && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/25 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-success">Unlock code used</p>
              <p className="text-xs text-slate-400 mt-1">
                You closed the Smart Box. This code cannot be used again (one-time only).
              </p>
            </div>
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
              Step 3 — When finished, close the box. Your code will expire and cannot be reused.
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
