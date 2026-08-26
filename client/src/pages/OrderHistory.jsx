import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useDeliveriesCache } from '../hooks/useDeliveriesCache';
import AdminOrderList, { useAdminOrderCounts } from '../components/AdminOrderList';
import ContentSkeleton from '../components/ui/ContentSkeleton';

export default function OrderHistory() {
  const { deliveries, loading } = useDeliveriesCache();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [historySegment, setHistorySegment] = useState('delivered');

  const { deliveredCount, cancelledCount } = useAdminOrderCounts(deliveries);

  if (loading && deliveries.length === 0) {
    return <ContentSkeleton rows={4} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 text-sm text-primary-light hover:underline mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to active orders
          </Link>
          <h2 className="text-lg font-bold text-white">Order history</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {deliveredCount} completed · {cancelledCount} cancelled — 10 per page
          </p>
        </div>
      </div>

      <AdminOrderList
        deliveries={deliveries}
        mode="history"
        historySegment={historySegment}
        onHistorySegmentChange={setHistorySegment}
        showHistoryTabs
        showFilters
        search={search}
        onSearchChange={setSearch}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
      />
    </div>
  );
}
