import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList, CheckCircle2, UserCheck, Lock, Unlock, Truck,
  Loader2, Eye, Play, XCircle, Ban, Key, FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, downloadReportPdf } from '../lib/api';
import Badge from '../components/ui/Badge';
import PaymentProofModal from '../components/PaymentProofModal';
import DeliveryContactBlock from '../components/DeliveryContactBlock';
import Pagination from '../components/ui/Pagination';
import ContentSkeleton from '../components/ui/ContentSkeleton';
import { useDeliveriesCache } from '../hooks/useDeliveriesCache';
import { usePagination } from '../hooks/usePagination';
import {
  deliveryStatusMeta, formatPrice, formatDeliveryRef, formatDeliveryDate,
  formatDeliveryDateTime, paymentMethodLabel, formatLockStatusLabel,
  isActiveDelivery,
} from '../lib/deliveryUtils';

const TABS = [
  { id: 'payments', label: 'Payment proofs' },
  { id: 'active', label: 'Active deliveries' },
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
  const { deliveries, loading: deliveriesLoading, refresh } = useDeliveriesCache();
  const [riders, setRiders] = useState([]);
  const [devices, setDevices] = useState([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('payments');
  const [assignForms, setAssignForms] = useState({});
  const [actionId, setActionId] = useState(null);
  const [proofView, setProofView] = useState(null);

  const loadMeta = async () => {
    try {
      const [users, devs] = await Promise.all([
        api.getUsers(token),
        api.getDevices(token),
      ]);
      setRiders(users.filter((u) => u.role?.name === 'motor_rider' && u.is_approved));
      setDevices(devs);
    } catch (err) {
      setError(err.message);
    } finally {
      setMetaLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadMeta();
  }, [token]);

  const load = async () => {
    await refresh(true);
    await loadMeta();
  };

  const runAction = async (fn, id) => {
    setActionId(id || 'busy');
    setError('');
    setSuccess('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  };

  const pendingPaymentCount = useMemo(
    () => deliveries.filter((d) => d.status === 'payment_submitted').length,
    [deliveries],
  );

  const tokenRequestCount = useMemo(
    () => deliveries.filter((d) => d.token_request_pending).length,
    [deliveries],
  );

  const list = useMemo(() => {
    if (tab === 'payments') {
      return deliveries.filter((d) => d.status === 'payment_submitted');
    }
    return deliveries.filter((d) => isActiveDelivery(d.status));
  }, [deliveries, tab]);

  const pagination = usePagination(list);

  const loading = deliveriesLoading && deliveries.length === 0 && metaLoading;

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
      setError('Select rider and Smart Box for the route');
      return;
    }
    return runAction(async () => {
      const result = await api.assignRider(token, id, form);
      if (result?.message) setSuccess(result.message);
      return result;
    }, id);
  };

  const handleSendToken = (id) => runAction(async () => {
    const result = await api.sendDeliveryToken(token, id);
    setSuccess(result?.message || 'Unlock code issued.');
    return result;
  }, id);

  const handleGrantOpen = (id) => runAction(async () => {
    const result = await api.grantDeliveryOpen(token, id);
    const code = result?.unlock_token || result?.token_delivery?.unlock_token;
    const email = result?.customer_email || result?.customer?.email;
    setSuccess(
      code
        ? `Code ${code} sent to customer${email ? ` (${email})` : ''} — tell them to open My deliveries`
        : (result?.message || 'Open permission granted — customer can now open the box.'),
    );
    return result;
  }, id);

  if (loading) {
    return <ContentSkeleton rows={4} />;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 bg-danger/10 border border-danger/25 rounded-xl text-sm text-danger">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-success/10 border border-success/25 rounded-xl text-sm text-success">{success}</div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary-light" />
            Operations
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Flow: Verify payment → Assign rider + Smart Box → Grant open (code goes to customer)
          </p>
        </div>
        {pendingPaymentCount > 0 && (
          <span className="text-sm text-warning font-medium">{pendingPaymentCount} pending</span>
        )}
        {tokenRequestCount > 0 && (
          <Link
            to="/operations/opening-requests"
            className="text-sm font-medium text-warning hover:underline"
          >
            {tokenRequestCount} box opening request{tokenRequestCount !== 1 ? 's' : ''} →
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-xs text-slate-300 leading-relaxed">
        <span className="text-primary-light font-semibold">Assign rider:</span> customer can track, rider delivers — no unlock yet.
        {' '}
        <span className="text-success font-semibold">Grant open permission:</span> unlock code is sent to the customer (app popup + email). Rider never sees the code.
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition touch-manipulation ${
              tab === t.id ? 'bg-primary text-white' : 'bg-surface border border-border text-slate-400'
            }`}
          >
            {t.label}
            {t.id === 'payments' && pendingPaymentCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-warning/20 text-warning text-xs">
                {pendingPaymentCount}
              </span>
            )}
          </button>
        ))}
        <Link
          to="/operations/opening-requests"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition touch-manipulation border ${
            tokenRequestCount > 0
              ? 'bg-warning/10 border-warning/30 text-warning'
              : 'bg-surface border-border text-slate-400'
          }`}
        >
          Opening requests
          {tokenRequestCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-warning/20 text-warning text-xs">
              {tokenRequestCount}
            </span>
          )}
        </Link>
      </div>

      {tab === 'payments' && pendingPaymentCount === 0 && (
        <div className="glass-card rounded-xl p-8 text-center text-slate-400 text-sm">
          No payment proofs pending.
        </div>
      )}

      {list.length === 0 && tab === 'active' ? (
        <div className="glass-card rounded-xl p-10 text-center text-slate-500 text-sm">
          No active deliveries.
        </div>
      ) : list.length > 0 && (
        <>
        <div className="space-y-3">
          {pagination.slice.map((d) => {
            const meta = deliveryStatusMeta(d.status);
            const isPending = d.status === 'payment_submitted';

            return (
              <div key={d.id} className="glass-card rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono text-slate-500">{formatDeliveryRef(d.id)} · {formatDeliveryDate(d.created_at)}</p>
                    <p className="text-sm font-medium text-white mt-0.5">{d.customer?.full_name || d.customer?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title="Download delivery PDF report"
                      onClick={() => runAction(() => downloadReportPdf(token, `delivery/${d.id}`, {}), `${d.id}-pdf`)}
                      disabled={!!actionId}
                      className="p-2 rounded-lg border border-border text-slate-400 hover:text-primary-light hover:border-primary/30 disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                </div>

                <div className="space-y-2 p-3 rounded-xl bg-surface/60 border border-border">
                  <AddressBlock label="A" address={d.pickup_address} accent="a" />
                  <AddressBlock label="B" address={d.delivery_address} accent="b" />
                </div>

                {d.customer && (
                  <DeliveryContactBlock title="Customer contact" person={d.customer} />
                )}

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

                {tab === 'active' && !['delivered', 'cancelled'].includes(d.status) && !isPending && (
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

                {['payment_verified', 'rider_assigned'].includes(d.status) && tab === 'active' && (
                  <div className="p-3 rounded-xl bg-surface border border-border space-y-3">
                    <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-primary-light" />
                      Assign rider to route (A → B)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Rider · pickup A → delivery B</label>
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
                        <label className="text-xs text-slate-500 block mb-1">Smart Box (transport)</label>
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
                        Assign rider to route
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 flex items-start gap-1.5 pt-1 border-t border-border/60">
                      <Key className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-300" />
                      After assign, the rider tracks the box only. Use “Grant open permission” to send the unlock code to the <span className="text-white font-medium">customer</span> so they can open.
                    </p>
                  </div>
                )}

                {d.rider && tab === 'active' && (
                  <div className="space-y-2">
                    <DeliveryContactBlock title="Assigned rider" person={d.rider} variant="rider" />
                    {d.device && (
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5" />
                        Smart Box: {d.device.device_id}
                      </p>
                    )}
                    {d.token_request_pending && (
                      <Link
                        to="/operations/opening-requests"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning hover:underline"
                      >
                        <Key className="w-3.5 h-3.5" />
                        Customer requested box opening — review in Opening requests
                      </Link>
                    )}
                    {d.device_id && ['rider_assigned', 'in_transit'].includes(d.status) && (
                      <div className={`p-3 rounded-xl border space-y-2 ${
                        d.rider_open_granted || d.open_permission === 'granted'
                          ? 'bg-success/5 border-success/25'
                          : 'bg-amber-500/5 border-amber-500/25'
                      }`}
                      >
                        <p className={`text-xs font-semibold flex items-center gap-1.5 ${
                          d.rider_open_granted || d.open_permission === 'granted' ? 'text-success' : 'text-amber-300'
                        }`}
                        >
                          <Key className="w-3.5 h-3.5" />
                          {d.open_permission === 'used'
                            ? 'Open code used — grant again if needed'
                            : (d.rider_open_granted || d.open_permission === 'granted')
                              ? 'Open permission granted — customer has the unlock code'
                              : 'Open permission pending — customer waiting for code'}
                        </p>
                        {(d.token_delivery?.unlock_token || d.unlock_token) && (d.rider_open_granted || d.open_permission === 'granted') && (
                          <p className="text-sm font-mono tracking-widest text-white bg-surface/80 border border-success/30 rounded-lg px-3 py-2">
                            Customer code: {d.token_delivery?.unlock_token || d.unlock_token}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          After grant, only the customer sees the unlock code on Dashboard / Deliveries and can Open then Close the box. Rider tracks only.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleGrantOpen(d.id)}
                          disabled={!!actionId || !d.device_id || !d.rider_id}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success/15 border border-success/30 text-success text-xs font-semibold disabled:opacity-50"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          {(d.rider_open_granted || d.open_permission === 'granted')
                            ? 'Re-issue open code to customer'
                            : 'Grant open permission'}
                        </button>
                        {!d.token_request_pending && (
                          <button
                            type="button"
                            onClick={() => handleSendToken(d.id)}
                            disabled={!!actionId || !d.device_id}
                            className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-slate-300 text-xs font-medium disabled:opacity-50"
                          >
                            <Key className="w-3.5 h-3.5" />
                            Send / refresh code
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {d.status === 'rider_assigned' && tab === 'active' && (
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

                {d.device && tab === 'active' && ['rider_assigned', 'in_transit'].includes(d.status) && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <span className="text-xs text-slate-500 self-center">
                      {formatLockStatusLabel(d.device.lock_status)}
                    </span>
                    <button type="button" onClick={() => runAction(async () => {
                      const result = await api.managerUnlockDelivery(token, d.id);
                      setSuccess(result?.message || 'Box unlocked — you can open it');
                      return result;
                    }, d.id)} disabled={!!actionId || d.device.lock_status === 'unlocked'} className="px-2 py-1 text-xs text-success border border-success/25 rounded-lg disabled:opacity-40">
                      <Unlock className="w-3 h-3 inline" /> Unlock
                    </button>
                    <button type="button" onClick={() => runAction(async () => {
                      const result = await api.managerLockDelivery(token, d.id);
                      setSuccess(result?.message || 'Box locked — secured');
                      return result;
                    }, d.id)} disabled={!!actionId || d.device.lock_status === 'locked'} className="px-2 py-1 text-xs text-primary-light border border-primary/25 rounded-lg disabled:opacity-40">
                      <Lock className="w-3 h-3 inline" /> Lock
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          total={pagination.total}
          rangeStart={pagination.rangeStart}
          rangeEnd={pagination.rangeEnd}
          hasPrev={pagination.hasPrev}
          hasNext={pagination.hasNext}
        />
        </>
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
