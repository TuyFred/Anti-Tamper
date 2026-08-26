import { Link } from 'react-router-dom';
import { ArrowRight, History } from 'lucide-react';
import { useDeliveriesCache } from '../hooks/useDeliveriesCache';
import AdminOrderList, { useAdminOrderCounts } from '../components/AdminOrderList';
import ContentSkeleton from '../components/ui/ContentSkeleton';

export default function Orders() {
  const { deliveries, loading } = useDeliveriesCache();
  const { activeCount, historyCount } = useAdminOrderCounts(deliveries);

  if (loading && deliveries.length === 0) {
    return <ContentSkeleton rows={4} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Active orders</h2>
          <p className="text-sm text-slate-500 mt-0.5">{activeCount} in progress — 10 per page</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {historyCount > 0 && (
            <Link
              to="/orders/history"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface border border-border text-slate-300 hover:text-white text-sm font-semibold rounded-xl transition"
            >
              <History className="w-4 h-4" />
              History ({historyCount})
            </Link>
          )}
          <Link
            to="/operations"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-xl transition"
          >
            Operations <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <AdminOrderList deliveries={deliveries} mode="active" />
    </div>
  );
}
