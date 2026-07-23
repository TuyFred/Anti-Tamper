import { useEffect, useState, useMemo } from 'react';
import {
  ClipboardList, CheckCircle2, UserCheck, Lock, Unlock, Truck,
  Loader2, Eye, Play, XCircle, Ban,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Badge from '../components/ui/Badge';
import PaymentProofModal from '../components/PaymentProofModal';
import {
  deliveryStatusMeta, formatPrice, formatDeliveryRef, formatDeliveryDate,
  paymentMethodLabel,
} from '../lib/deliveryUtils';

const TABS = [
  { id: 'payments', label: 'Payment proofs' },
  { id: 'all', label: 'All deliveries' },
];

function AddressBlock({ label, address, accent }) {
  return (
    <div className="flex gap-2 min-w-0">
      <span className={`shrink-0 w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
        accent === 'a' ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary-light'
      }`}>{label}</span>
      <p className="text-xs text-slate-300 leading-snug break-words">{address}</p>
    </div>
  );
}

export default function Operations() {
  const { token } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [riders, setRiders] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('payments');
  const [assignForms, setAssignForms] = useState({});
  const [actionId, setActionId] = useState(null);
  const [proofView, setProofView] = useState(null);

  const load = async () => {
    try {
      const [list, users, devs] = await Promise.all([
        api.getDeliveries(token),
        api.getUsers(token),
        api.getDevices(token),
      ]);
      setDeliveries(list);
      setRiders(users.filter((u) => u.role?.name === 'motor_rider' && u.is_approved));
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

  const runAction = async (fn, id) => {
    setActionId(id || 'busy');
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

  const pendingPayments = useMemo(
    () => deliveries.filter((d) => d.status === 'payment_submitted'),
    [deliveries],
  );

  const list = tab === 'payments' ? pendingPayments : deliveries;

  const handleVerify = (id) => runAction(() => api.verifyPayment(token, id), id);
  const handleRejectPayment = (id) => runAction(() => api.rejectPayment(token, id), id);
  const handleCancel = (id) => {
    if (!window.confirm('Cancel this delivery?')) return;
    runAction(() => api.cancelDelivery(token, id), id);
  };
  const handleStartTransit = (id) => runAction(() => api.startTransit(token, id), id);
  const handleAssign = (id) => {
    const form = assignForms[id];
    if (!form?.rider_id || !form?.device_id) {
      setError('Select rider and box');
      return;
    }
    return runAction(() => api.assignRider(token, id, form), id);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 bg-danger/10 border border-danger/25 rounded-xl text-sm text-danger">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary-light" />
          Operations
        </h3>
        {pendingPayments.length > 0 && (
          <span className="text-sm text-warning font-medium">{pendingPayments.length} pending</span>
        )}
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id ? 'bg-primary text-white' : 'bg-surface border border-border text-slate-400'
            }`}
          >
            {t.label}
            {t.id === 'payments' && pendingPayments.length > 0 && (
              <span className="ml-1.5 opacity-80">({pendingPayments.length})</span>
            )}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-slate-500 text-sm">
          {tab === 'payments' ? 'No payment proofs pending.' : 'No deliveries.'}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((d) => {
            const meta = deliveryStatusMeta(d.status);
            const isPending = d.status === 'payment_submitted';

            return (
              <div key={d.id} className="glass-card rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono text-slate-500">{formatDeliveryRef(d.id)} · {formatDeliveryDate(d.created_at)}</p>
                    <p className="text-sm font-medium text-white mt-0.5">{d.customer?.full_name || d.customer?.email}</p>
                  </div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>

                <div className="space-y-2 p-3 rounded-xl bg-surface/60 border border-border">
                  <AddressBlock label="A" address={d.pickup_address} accent="a" />
                  <AddressBlock label="B" address={d.delivery_address} accent="b" />
                </div>

                <p className="text-xs text-slate-500">
                  {formatPrice(d.calculated_price, d.currency)} · {d.distance_km} km
                  {d.payment_method && ` · ${paymentMethodLabel(d.payment_method)}`}
                </p>

                {isPending && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {d.payment_proof_url && (
                      <button
                        type="button"
                        onClick={() => setProofView({ url: d.payment_proof_url, ref: formatDeliveryRef(d.id) })}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border text-sm text-white hover:bg-surface-lighter transition"
                      >
                        <Eye className="w-4 h-4" />
                        View proof
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleVerify(d.id)}
                      disabled={!!actionId}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success/15 text-success border border-success/25 text-sm font-semibold disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectPayment(d.id)}
                      disabled={!!actionId}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-warning/10 text-warning border border-warning/25 text-sm font-medium disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancel(d.id)}
                      disabled={!!actionId}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-danger/10 text-danger border border-danger/25 text-sm font-medium disabled:opacity-50"
                    >
                      <Ban className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                )}

                {tab === 'all' && !['delivered', 'cancelled'].includes(d.status) && !isPending && (
                  <button
                    type="button"
                    onClick={() => handleCancel(d.id)}
                    disabled={!!actionId}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-danger border border-danger/20 hover:bg-danger/10 transition disabled:opacity-50"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Cancel delivery
                  </button>
                )}

                {['payment_verified', 'rider_assigned'].includes(d.status) && tab === 'all' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-surface border border-border">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Rider</label>
                      <select
                        value={assignForms[d.id]?.rider_id || d.rider_id || ''}
                        onChange={(e) => setAssignForms({ ...assignForms, [d.id]: { ...assignForms[d.id], rider_id: e.target.value } })}
                        className="w-full px-3 py-2 bg-surface rounded-lg border border-border text-white text-sm"
                      >
                        <option value="">Select rider</option>
                        {riders.map((r) => (
                          <option key={r.id} value={r.id}>{r.full_name || r.email}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Smart Box</label>
                      <select
                        value={assignForms[d.id]?.device_id || d.device_id || ''}
                        onChange={(e) => setAssignForms({ ...assignForms, [d.id]: { ...assignForms[d.id], device_id: e.target.value } })}
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
                      disabled={!!actionId}
                      className="sm:col-span-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      <UserCheck className="w-4 h-4" />
                      Assign & token
                    </button>
                  </div>
                )}

                {d.rider && tab === 'all' && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 flex-wrap">
                    <Truck className="w-3.5 h-3.5" />
                    {d.rider.full_name || d.rider.email}
                    {d.device && ` · Box ${d.device.device_id}`}
                  </p>
                )}

                {d.status === 'rider_assigned' && tab === 'all' && (
                  <button
                    type="button"
                    onClick={() => handleStartTransit(d.id)}
                    disabled={!!actionId}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-primary/15 text-primary-light border border-primary/25 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    Start transit
                  </button>
                )}

                {d.device && tab === 'all' && ['rider_assigned', 'in_transit'].includes(d.status) && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <span className="text-xs text-slate-500 self-center">{d.device.lock_status}</span>
                    <button type="button" onClick={() => runAction(() => api.managerUnlockDelivery(token, d.id), d.id)} disabled={!!actionId} className="px-2 py-1 text-xs text-success border border-success/25 rounded-lg">
                      <Unlock className="w-3 h-3 inline" /> Unlock
                    </button>
                    <button type="button" onClick={() => runAction(() => api.managerLockDelivery(token, d.id), d.id)} disabled={!!actionId} className="px-2 py-1 text-xs text-primary-light border border-primary/25 rounded-lg">
                      <Lock className="w-3 h-3 inline" /> Lock
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PaymentProofModal
        open={!!proofView}
        onClose={() => setProofView(null)}
        proofUrl={proofView?.url}
        title={proofView ? `Proof · ${proofView.ref}` : 'Payment proof'}
      />
    </div>
  );
}
