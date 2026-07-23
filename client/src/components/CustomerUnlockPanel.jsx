import { useEffect, useState, useRef } from 'react';
import {
  Key, Lock, Unlock, CheckCircle2, Loader2, Copy,
} from 'lucide-react';
import { api } from '../lib/api';

const AUTO_LOCK_SECONDS = 60;

export default function CustomerUnlockPanel({
  delivery,
  token: authToken,
  onUpdated,
  onError,
  onSuccess,
}) {
  const [tokenInput, setTokenInput] = useState(delivery.unlock_token || '');
  const [unlocking, setUnlocking] = useState(false);
  const [locking, setLocking] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [copied, setCopied] = useState(false);
  const autoLockSent = useRef(false);

  const isReady = ['rider_assigned', 'in_transit'].includes(delivery.status);
  const isUnlocked = Boolean(delivery.token_used_at);
  const deviceLocked = delivery.device?.lock_status !== 'unlocked';
  const canUnlock = isReady && !isUnlocked && delivery.unlock_token;
  const canLock = isReady && isUnlocked && !deviceLocked;
  const canComplete = isReady && isUnlocked;

  useEffect(() => {
    setTokenInput(delivery.unlock_token || '');
  }, [delivery.id, delivery.unlock_token]);

  useEffect(() => {
    if (!isUnlocked || !delivery.token_used_at) {
      setCountdown(null);
      return undefined;
    }
    const usedAt = new Date(delivery.token_used_at).getTime();
    const tick = () => {
      const remaining = Math.max(0, AUTO_LOCK_SECONDS - Math.floor((Date.now() - usedAt) / 1000));
      setCountdown(remaining);
      return remaining;
    };
    tick();
    const interval = setInterval(() => { if (tick() <= 0) clearInterval(interval); }, 1000);
    return () => clearInterval(interval);
  }, [isUnlocked, delivery.token_used_at]);

  useEffect(() => { autoLockSent.current = false; }, [delivery.id, delivery.token_used_at]);

  useEffect(() => {
    if (countdown !== 0 || !isUnlocked || deviceLocked || !authToken || autoLockSent.current) return;
    autoLockSent.current = true;
    (async () => {
      try {
        await api.customerLockDelivery(authToken, delivery.id);
        onSuccess?.('Locked');
        await onUpdated?.();
      } catch { autoLockSent.current = false; }
    })();
  }, [countdown, isUnlocked, deviceLocked, authToken, delivery.id]);

  const handleCopyToken = async () => {
    const value = delivery.unlock_token || tokenInput;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { onError?.('Copy failed'); }
  };

  const handleUnlock = async () => {
    const code = tokenInput.trim().toUpperCase();
    if (!code) { onError?.('Enter token'); return; }
    setUnlocking(true);
    onError?.('');
    try {
      await api.unlockWithToken(authToken, delivery.id, code);
      onSuccess?.('Unlocked');
      await onUpdated?.();
    } catch (err) { onError?.(err.message); }
    finally { setUnlocking(false); }
  };

  const handleLock = async () => {
    setLocking(true);
    onError?.('');
    try {
      await api.customerLockDelivery(authToken, delivery.id);
      onSuccess?.('Locked');
      await onUpdated?.();
    } catch (err) { onError?.(err.message); }
    finally { setLocking(false); }
  };

  const handleComplete = async () => {
    setCompleting(true);
    onError?.('');
    try {
      await api.completeDelivery(authToken, delivery.id);
      onSuccess?.('Completed');
      await onUpdated?.();
    } catch (err) { onError?.(err.message); }
    finally { setCompleting(false); }
  };

  if (!isReady && delivery.status !== 'delivered') return null;

  return (
    <div className="p-4 rounded-xl bg-primary/10 border border-primary/25 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-white">Unlock</p>
        {delivery.device && (
          <span className="text-xs text-slate-400 font-mono">{delivery.device.device_id} · {deviceLocked ? 'Locked' : 'Open'}</span>
        )}
      </div>

      {delivery.unlock_token && (
        <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-surface/80 border border-border">
          <p className="text-2xl font-mono font-bold text-white tracking-widest">{delivery.unlock_token}</p>
          <button type="button" onClick={handleCopyToken} className="text-xs text-primary-light flex items-center gap-1 shrink-0">
            <Copy className="w-3.5 h-3.5" />{copied ? 'OK' : 'Copy'}
          </button>
        </div>
      )}

      {canUnlock && (
        <div className="space-y-2">
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="Token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
            className="w-full px-4 py-3 bg-surface rounded-xl border border-border text-white text-lg font-mono tracking-widest text-center focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={handleUnlock}
            disabled={unlocking || !tokenInput.trim()}
            className="w-full py-3 rounded-xl bg-success text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {unlocking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Unlock className="w-5 h-5" />}
            Unlock
          </button>
        </div>
      )}

      {isUnlocked && (
        <div className="space-y-2">
          <p className="text-sm text-success font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Open
            {countdown != null && countdown > 0 && !deviceLocked && (
              <span className="text-xs text-slate-400 font-mono ml-auto">{countdown}s</span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {canLock && (
              <button type="button" onClick={handleLock} disabled={locking} className="py-2.5 rounded-xl bg-surface border border-border text-sm font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-50">
                {locking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Lock
              </button>
            )}
            {canComplete && (
              <button type="button" onClick={handleComplete} disabled={completing} className="py-2.5 rounded-xl bg-primary text-sm font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-50 col-span-2">
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />} Complete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
