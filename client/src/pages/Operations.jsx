import { useEffect, useState } from 'react';
import {
  ClipboardList, CheckCircle2, UserCheck, Lock, Unlock, Truck,
  Loader2, ArrowRight, Eye, Play,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Badge from '../components/ui/Badge';
import { deliveryStatusMeta, formatPrice } from '../lib/deliveryUtils';

export default function Operations() {
  const { token } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [riders, setRiders] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignForms, setAssignForms] = useState({});
  const [actionId, setActionId] = useState(null);

  const load = async () => {
    try {
      const [list, users, devs] = await Promise.all([
        api.getDeliveries(token),
        api.getUsers(token),
        api.getDevices(token),
      ]);
      setDeliveries(list);
      setRiders(users.filter((u) => u.role?.name === 'motor_rider'));
      setDevices(devs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  const runAction = async (fn) => {
    setActionId('busy');
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  };

  const handleVerify = (id) => runAction(() => api.verifyPayment(token, id));

  const handleStartTransit = (id) => runAction(() => api.startTransit(token, id));

  const handleAssign = (id) => {
    const form = assignForms[id];
    if (!form?.rider_id || !form?.device_id) {
      setError('Select both rider and Smart Box');
      return;
    }
    return runAction(() => api.assignRider(token, id, form));
  };

  const handleLock = (id) => runAction(() => api.managerLockDelivery(token, id));
  const handleUnlock = (id) => runAction(() => api.managerUnlockDelivery(token, id));

  const STATUS_ORDER = {
    payment_submitted: 0,
    payment_verified: 1,
    rider_assigned: 2,
    in_transit: 3,
    awaiting_payment: 4,
    delivered: 5,
    cancelled: 6,
  };

  const sortedDeliveries = [...deliveries].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
  );

  const pendingPayments = sortedDeliveries.filter((d) => d.status === 'payment_submitted');

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-danger/10 border border-danger/25 rounded-xl text-sm text-danger">{error}</div>
      )}

      <div className="glass-card rounded-xl p-5">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary-light" />
          Delivery operations
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Review requests → verify payment → assign rider → Smart Box locks automatically
        </p>
      </div>

      {pendingPayments.length > 0 && (
        <div className="p-4 rounded-xl bg-warning/10 border border-warning/25 text-sm text-warning">
          {pendingPayments.length} payment proof{pendingPayments.length > 1 ? 's' : ''} awaiting your verification
        </div>
      )}

      {deliveries.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center text-slate-500 text-sm">
          No delivery requests yet.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDeliveries.map((d) => {
            const meta = deliveryStatusMeta(d.status);
            return (
              <div key={d.id} className="glass-card rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="text-white font-medium">
                      {d.customer?.full_name || d.customer?.email}
                    </p>
                    <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                      {d.pickup_address}
                      <ArrowRight className="w-3.5 h-3.5" />
                      {d.delivery_address}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatPrice(d.calculated_price, d.currency)} · {d.distance_km} km
                    </p>
                  </div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>

                {d.payment_proof_url && (
                  <div className="p-3 rounded-xl bg-surface border border-border">
                    <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> Payment proof
                    </p>
                    {d.payment_proof_url.startsWith('data:image') ? (
                      <img src={d.payment_proof_url} alt="Payment proof" className="max-h-40 rounded-lg border border-border" />
                    ) : (
                      <p className="text-sm text-white break-all">{d.payment_proof_url}</p>
                    )}
                  </div>
                )}

                {d.status === 'payment_submitted' && (
                  <button
                    type="button"
                    onClick={() => handleVerify(d.id)}
                    disabled={actionId}
                    className="flex items-center gap-2 px-4 py-2 bg-success/15 text-success border border-success/25 rounded-lg text-sm font-medium"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm payment
                  </button>
                )}

                {['payment_verified', 'rider_assigned'].includes(d.status) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-surface border border-border">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Assign motor rider</label>
                      <select
                        value={assignForms[d.id]?.rider_id || d.rider_id || ''}
                        onChange={(e) => setAssignForms({
                          ...assignForms,
                          [d.id]: { ...assignForms[d.id], rider_id: e.target.value },
                        })}
                        className="w-full px-3 py-2 bg-surface rounded-lg border border-border text-white text-sm"
                      >
                        <option value="">Select rider</option>
                        {riders.map((r) => (
                          <option key={r.id} value={r.id}>{r.full_name || r.email}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Smart Box</label>
                      <select
                        value={assignForms[d.id]?.device_id || d.device_id || ''}
                        onChange={(e) => setAssignForms({
                          ...assignForms,
                          [d.id]: { ...assignForms[d.id], device_id: e.target.value },
                        })}
                        className="w-full px-3 py-2 bg-surface rounded-lg border border-border text-white text-sm"
                      >
                        <option value="">Select box</option>
                        {devices.map((dev) => (
                          <option key={dev.id} value={dev.id}>{dev.name} ({dev.device_id})</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAssign(d.id)}
                      disabled={actionId}
                      className="sm:col-span-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold"
                    >
                      <UserCheck className="w-4 h-4" />
                      Assign rider & lock box · generate customer token
                    </button>
                  </div>
                )}

                {d.rider && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 flex-wrap">
                    <Truck className="w-3.5 h-3.5" />
                    Rider: <span className="text-white">{d.rider.full_name || d.rider.email}</span>
                    {d.unlock_token && (
                      <span className="ml-2 font-mono text-primary-light">Token: {d.unlock_token}</span>
                    )}
                  </p>
                )}

                {d.status === 'rider_assigned' && (
                  <button
                    type="button"
                    onClick={() => handleStartTransit(d.id)}
                    disabled={actionId}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/15 text-primary-light border border-primary/25 rounded-lg text-sm font-medium"
                  >
                    <Play className="w-4 h-4" />
                    Mark as in transit
                  </button>
                )}

                {d.device && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <span className="text-xs text-slate-500 self-center">
                      Box {d.device.device_id} — {d.device.lock_status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnlock(d.id)}
                      disabled={actionId}
                      className="flex items-center gap-1 px-3 py-1.5 bg-success/10 text-success border border-success/25 rounded-lg text-xs"
                    >
                      <Unlock className="w-3.5 h-3.5" /> Remote unlock
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLock(d.id)}
                      disabled={actionId}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary-light border border-primary/25 rounded-lg text-xs"
                    >
                      <Lock className="w-3.5 h-3.5" /> Remote lock
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
