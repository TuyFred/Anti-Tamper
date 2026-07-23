import { useEffect, useState, useRef } from 'react';
import {
  Key, Lock, Unlock, CheckCircle2, Loader2, Copy, Shield,
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
      const elapsed = Math.floor((Date.now() - usedAt) / 1000);
      const remaining = Math.max(0, AUTO_LOCK_SECONDS - elapsed);
      setCountdown(remaining);
      return remaining;
    };

    tick();
    const interval = setInterval(() => {
      const remaining = tick();
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [isUnlocked, delivery.token_used_at]);

  useEffect(() => {
    autoLockSent.current = false;
  }, [delivery.id, delivery.token_used_at]);

  useEffect(() => {
    if (countdown !== 0 || !isUnlocked || deviceLocked || !authToken || autoLockSent.current) return;

    autoLockSent.current = true;
    (async () => {
      try {
        await api.customerLockDelivery(authToken, delivery.id);
        onSuccess?.('Smart Box auto-locked after unlock window.');
        await onUpdated?.();
      } catch {
        autoLockSent.current = false;
      }
    })();
  }, [countdown, isUnlocked, deviceLocked, authToken, delivery.id]);

  const handleCopyToken = async () => {
    const value = delivery.unlock_token || tokenInput;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError?.('Could not copy token');
    }
  };

  const handleUnlock = async () => {
    const code = tokenInput.trim().toUpperCase();
    if (!code) {
      onError?.('Enter your unlock token');
      return;
    }

    setUnlocking(true);
    onError?.('');
    try {
      const result = await api.unlockWithToken(authToken, delivery.id, code);
      onSuccess?.(result.message || 'Smart Box unlocked — open within 60 seconds.');
      await onUpdated?.();
    } catch (err) {
      onError?.(err.message);
    } finally {
      setUnlocking(false);
    }
  };

  const handleLock = async () => {
    setLocking(true);
    onError?.('');
    try {
      const result = await api.customerLockDelivery(authToken, delivery.id);
      onSuccess?.(result.message || 'Smart Box locked.');
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
      onSuccess?.('Delivery completed — Smart Box locked. Please leave a review!');
      await onUpdated?.();
    } catch (err) {
      onError?.(err.message);
    } finally {
      setCompleting(false);
    }
  };

  if (!isReady && delivery.status !== 'delivered') return null;

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-primary/10 to-success/5 border border-primary/25 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-primary-light" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Smart Box unlock</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Enter your token and tap unlock at delivery. Box auto-locks when closed or after 60s.
          </p>
          {delivery.device && (
            <p className="text-xs mt-1 font-medium">
              Box: <span className="text-white">{delivery.device.name || delivery.device.device_id}</span>
              {' · '}
              <span className={deviceLocked ? 'text-success' : 'text-warning'}>
                {deviceLocked ? 'Locked' : 'Unlocked'}
              </span>
            </p>
          )}
        </div>
      </div>

      {delivery.unlock_token && (
        <div className="p-3 rounded-xl bg-surface/80 border border-border">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs text-slate-500 uppercase font-semibold">Your token</p>
            <button
              type="button"
              onClick={handleCopyToken}
              className="inline-flex items-center gap-1 text-xs text-primary-light hover:text-white transition"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-[0.2em] break-all">
            {delivery.unlock_token}
          </p>
        </div>
      )}

      {canUnlock && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-400 mb-1.5 block">Enter unlock token</span>
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="e.g. ABC123"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-surface rounded-xl border border-border text-white text-lg font-mono tracking-widest text-center placeholder-slate-600 focus:border-primary focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={handleUnlock}
            disabled={unlocking || !tokenInput.trim()}
            className="w-full min-h-[52px] flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-success hover:bg-success/90 active:scale-[0.98] text-white text-base font-bold shadow-lg shadow-success/25 transition disabled:opacity-50 touch-manipulation"
          >
            {unlocking ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Unlock className="w-5 h-5" />
            )}
            {unlocking ? 'Unlocking…' : 'Tap to unlock Smart Box'}
          </button>
        </div>
      )}

      {isUnlocked && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-success/10 border border-success/30">
            <p className="text-sm text-success font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Box unlocked — open the lid and take your items
            </p>
            {countdown != null && countdown > 0 && deviceLocked === false && (
              <p className="text-xs text-slate-400 mt-2">
                Auto-lock in <span className="text-white font-mono font-bold">{countdown}s</span>
                {' '}(or when you close the box)
              </p>
            )}
            {deviceLocked && (
              <p className="text-xs text-slate-400 mt-2">Box is locked again — safe to complete delivery.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {canLock && (
              <button
                type="button"
                onClick={handleLock}
                disabled={locking}
                className="min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface border border-border text-white text-sm font-semibold hover:bg-surface-lighter transition disabled:opacity-50 touch-manipulation"
              >
                {locking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {locking ? 'Locking…' : 'Lock box now'}
              </button>
            )}
            {canComplete && (
              <button
                type="button"
                onClick={handleComplete}
                disabled={completing}
                className="min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition disabled:opacity-50 touch-manipulation sm:col-span-2"
              >
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                {completing ? 'Completing…' : 'I received my items — complete delivery'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
