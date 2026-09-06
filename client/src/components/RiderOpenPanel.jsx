import { useEffect, useState } from 'react';
import {
  Key, Lock, Unlock, ShieldAlert, ShieldCheck, Loader2, Copy, CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDeliveryDateTime, formatLockStatusLabel } from '../lib/deliveryUtils';

/**
 * Rider open panel: track always; open only after admin/manager grants permission + code.
 */
export default function RiderOpenPanel({
  delivery,
  authToken,
  onUpdated,
  onError,
  onSuccess,
}) {
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);

  const permission = delivery.open_permission
    || (delivery.unlock_token && !delivery.token_closed_at ? 'granted' : 'waiting');
  const code = delivery.unlock_token || '';
  const expired = Boolean(delivery.token_expires_at)
    && new Date(delivery.token_expires_at) < new Date();
  const opened = Boolean(delivery.token_used_at) && !delivery.token_closed_at;
  const used = permission === 'used' || Boolean(delivery.token_closed_at);
  const canOpen = permission === 'granted' && code && !opened && !used && !expired;
  const canClose = opened && !used;

  useEffect(() => {
    setCodeInput(code || '');
  }, [delivery.id, code]);

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError?.('Could not copy code');
    }
  };

  const handleOpen = async () => {
    const value = (codeInput || code).trim().toUpperCase();
    if (!value) {
      onError?.('Enter the unlock code from admin');
      return;
    }
    setBusy('open');
    onError?.('');
    try {
      const result = await api.unlockWithToken(authToken, delivery.id, value);
      onSuccess?.(result?.message || 'Smart Box opened');
      await onUpdated?.();
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy('');
    }
  };

  const handleClose = async () => {
    setBusy('close');
    onError?.('');
    try {
      const result = await api.customerLockDelivery(authToken, delivery.id);
      onSuccess?.(result?.message || 'Smart Box closed — code used');
      await onUpdated?.();
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy('');
    }
  };

  if (!['rider_assigned', 'in_transit'].includes(delivery.status)) return null;

  if (permission === 'waiting') {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-surface to-surface p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Waiting for open permission</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              You can track this Smart Box on the map. Opening is locked until an admin or manager
              grants permission and issues your unlock code.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="px-2.5 py-1 rounded-lg bg-success/10 border border-success/25 text-success">Tracking allowed</span>
          <span className="px-2.5 py-1 rounded-lg bg-danger/10 border border-danger/25 text-danger">Open blocked</span>
        </div>
      </div>
    );
  }

  if (used) {
    return (
      <div className="rounded-2xl border border-border bg-surface/80 p-4 space-y-2">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-400" />
          Open code used
        </p>
        <p className="text-xs text-slate-400">
          This unlock code is finished. Ask admin/manager to grant open permission again if you need another opening.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-success/30 bg-gradient-to-br from-success/10 via-surface to-surface p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-success/15 border border-success/30 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-success" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Open permission granted</p>
          <p className="text-xs text-slate-400 mt-1">
            Use the code below at delivery to open the Smart Box.
            {delivery.token_expires_at && (
              <> Valid until {formatDeliveryDateTime(delivery.token_expires_at)}.</>
            )}
          </p>
        </div>
      </div>

      {code && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-primary-light" />
            Your unlock code
          </p>
          <div className="flex items-center gap-2">
            <p className="flex-1 font-mono text-2xl sm:text-3xl tracking-[0.35em] text-white font-bold">
              {code}
            </p>
            <button
              type="button"
              onClick={copyCode}
              className="shrink-0 p-2.5 rounded-lg border border-border text-slate-300 hover:text-white hover:border-primary/40 transition"
              title="Copy code"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {delivery.device && (
        <p className="text-xs text-slate-500">
          Box {delivery.device.device_id} · {formatLockStatusLabel(delivery.device.lock_status)}
        </p>
      )}

      {canOpen && (
        <div className="space-y-2">
          <label className="text-xs text-slate-500 block">Confirm code to open</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              maxLength={8}
              className="flex-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-white font-mono tracking-widest text-sm focus:border-primary outline-none"
              placeholder="Enter code"
            />
            <button
              type="button"
              onClick={handleOpen}
              disabled={!!busy}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-success text-white text-sm font-semibold disabled:opacity-50"
            >
              {busy === 'open' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
              Open Smart Box
            </button>
          </div>
        </div>
      )}

      {canClose && (
        <button
          type="button"
          onClick={handleClose}
          disabled={!!busy}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/15 border border-primary/30 text-primary-light text-sm font-semibold disabled:opacity-50"
        >
          {busy === 'close' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          Close Smart Box
        </button>
      )}

      {expired && (
        <p className="text-xs text-danger">Code expired — ask admin/manager to grant open permission again.</p>
      )}
    </div>
  );
}
