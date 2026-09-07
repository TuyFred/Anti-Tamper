import { useMemo, useState } from 'react';
import { Unlock, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDeliveriesCache } from '../hooks/useDeliveriesCache';
import { api } from '../lib/api';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import ContentSkeleton from '../components/ui/ContentSkeleton';
import { usePagination } from '../hooks/usePagination';
import {
  deliveryStatusMeta,
  formatDeliveryDateTime,
  formatDeliveryRef,
} from '../lib/deliveryUtils';

/** Manager — customer requests to open the Smart Box again (separate from payment proofs) */
export default function OpeningRequests() {
  const { token } = useAuth();
  const { deliveries, loading, refresh } = useDeliveriesCache();
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const openingRequests = useMemo(
    () => deliveries
      .filter((d) => d.token_request_pending)
      .sort((a, b) => new Date(b.token_requested_at || b.updated_at) - new Date(a.token_requested_at || a.updated_at)),
    [deliveries],
  );

  const pagination = usePagination(openingRequests);

  const handleApproveOpening = async (id) => {
    setActionId(id);
    setError('');
    setSuccess('');
    try {
      const result = await api.sendDeliveryToken(token, id);
      setSuccess(result?.message || 'Opening approved — unlock code granted.');
      await refresh(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  };

  if (loading && deliveries.length === 0) {
    return <ContentSkeleton rows={3} />;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 bg-danger/10 border border-danger/25 rounded-xl text-sm text-danger">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-success/10 border border-success/25 rounded-xl text-sm text-success">{success}</div>
      )}

      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Unlock className="w-5 h-5 text-warning" />
          Box opening requests
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Approve customer re-open requests, or grant open permission to the assigned rider · {openingRequests.length} pending
        </p>
      </div>

      {openingRequests.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-slate-500 text-sm">
          No pending opening requests. Customers appear here when they ask to open the box again after closing it.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {pagination.slice.map((d) => {
              const meta = deliveryStatusMeta(d.status);
              return (
                <article key={d.id} className="glass-card rounded-xl p-4 sm:p-5 border border-warning/25 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono text-slate-500">{formatDeliveryRef(d.id)}</p>
                      <p className="text-sm font-semibold text-white mt-0.5">
                        {d.customer?.full_name || d.customer?.email || 'Customer'}
                      </p>
                      {d.token_requested_at && (
                        <p className="text-xs text-warning mt-1">
                          Opening requested {formatDeliveryDateTime(d.token_requested_at)}
                        </p>
                      )}
                    </div>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>

                  <p className="text-xs text-slate-400">
                    <span className="text-success font-semibold">A</span> {d.pickup_address}
                    <br />
                    <span className="text-primary-light font-semibold">B</span> {d.delivery_address}
                  </p>

                  <div className="p-3 rounded-xl bg-warning/5 border border-warning/25 text-xs text-slate-300 space-y-2">
                    <p className="font-semibold text-warning flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      Approve opening — send new unlock code
                    </p>
                    <p className="text-slate-400">
                      Sends a new unlock code to the <span className="text-white font-medium">customer</span> so they can open the Smart Box.
                      {d.customer?.email && <> Notify: {d.customer.email}</>}
                      {d.device_id && <> · Box assigned</>}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleApproveOpening(d.id)}
                      disabled={!!actionId || !d.device_id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-warning/15 border border-warning/30 text-warning text-sm font-semibold hover:bg-warning/20 disabled:opacity-50"
                    >
                      {actionId === d.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Unlock className="w-4 h-4" />
                      )}
                      Approve & send code to customer
                    </button>
                    {!d.device_id && (
                      <p className="text-[11px] text-danger">Assign a Smart Box in Operations first.</p>
                    )}
                  </div>
                </article>
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
    </div>
  );
}

