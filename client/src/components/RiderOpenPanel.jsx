import { MapPin, ShieldCheck, Truck } from 'lucide-react';
import { formatLockStatusLabel } from '../lib/deliveryUtils';

/**
 * Rider panel: track delivery only. Customer receives the unlock code and opens the box.
 */
export default function RiderOpenPanel({ delivery }) {
  if (!['rider_assigned', 'in_transit'].includes(delivery.status)) return null;

  const permission = delivery.open_permission
    || (delivery.customer_open_granted ? 'granted' : 'waiting');
  const customerCanOpen = permission === 'granted';
  const used = permission === 'used' || Boolean(delivery.token_closed_at);

  return (
    <div className="rounded-2xl border border-border bg-surface/80 p-4 sm:p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
          <Truck className="w-5 h-5 text-primary-light" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Your job — deliver & track</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Take the Smart Box to the delivery address. The customer receives the unlock code
            from admin and opens the box themselves.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="px-2.5 py-1 rounded-lg bg-success/10 border border-success/25 text-success inline-flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          Tracking allowed
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-slate-500/10 border border-slate-500/25 text-slate-300">
          Open code → customer only
        </span>
      </div>

      {customerCanOpen && !used && (
        <div className="rounded-xl border border-success/25 bg-success/5 p-3 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-success shrink-0 mt-0.5" />
          <p className="text-xs text-slate-300 leading-relaxed">
            Admin granted open permission. The customer now has the unlock code and can open the box.
          </p>
        </div>
      )}

      {used && (
        <p className="text-xs text-slate-400">
          Customer already used the unlock code for this delivery.
        </p>
      )}

      {!customerCanOpen && !used && (
        <p className="text-xs text-amber-200/90">
          Waiting for admin to grant open permission to the customer.
        </p>
      )}

      {delivery.device && (
        <p className="text-xs text-slate-500 font-mono">
          Box {delivery.device.device_id} · {formatLockStatusLabel(delivery.device.lock_status)}
        </p>
      )}
    </div>
  );
}
