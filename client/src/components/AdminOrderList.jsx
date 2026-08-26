import { useMemo } from 'react';

import { Link } from 'react-router-dom';

import { Search, Package } from 'lucide-react';

import Badge from '../components/ui/Badge';
import DeliveryContactBlock from '../components/DeliveryContactBlock';
import Pagination from './ui/Pagination';

import ListTabs from './ui/ListTabs';

import { usePagination } from '../hooks/usePagination';

import {

  deliveryStatusMeta,

  formatDeliveryRef,

  formatDeliveryDateTime,

  formatPrice,

  formatLockStatusLabel,

  isActiveDelivery,

  filterDeliverySegment,

  countDeliverySegments,

} from '../lib/deliveryUtils';



function OrderCard({ d }) {

  const meta = deliveryStatusMeta(d.status);

  return (

    <article className="glass-card rounded-xl p-4 border border-border/80">

      <div className="flex flex-wrap items-start justify-between gap-2">

        <div className="min-w-0">

          <p className="font-mono text-xs text-slate-500">{formatDeliveryRef(d.id)}</p>

          <p className="text-sm font-semibold text-white mt-0.5">

            {d.customer?.full_name || d.customer?.email || 'Customer'}

          </p>

          <p className="text-xs text-slate-500 mt-0.5">{formatDeliveryDateTime(d.created_at)}</p>

        </div>

        <div className="text-right shrink-0 space-y-1">

          <Badge variant={meta.variant}>{meta.label}</Badge>

          <p className="text-sm font-bold text-white">{formatPrice(d.calculated_price, d.currency)}</p>

        </div>

      </div>

      <div className="mt-3 text-xs text-slate-400 space-y-2">
        <p><span className="text-success font-semibold">A</span> {d.pickup_address}</p>
        <p><span className="text-primary-light font-semibold">B</span> {d.delivery_address}</p>
        {d.customer && (
          <DeliveryContactBlock title="Customer" person={d.customer} />
        )}
        {d.rider && (
          <DeliveryContactBlock title="Rider" person={d.rider} variant="rider" />
        )}

        {d.device && (

          <p className="text-slate-500">

            Box {d.device.device_id} · {formatLockStatusLabel(d.device.lock_status)}

          </p>

        )}

      </div>

      {isActiveDelivery(d.status) && (

        <Link

          to="/operations"

          className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-primary-light hover:underline"

        >

          <Package className="w-3.5 h-3.5" />

          Manage in Operations

        </Link>

      )}

    </article>

  );

}



export default function AdminOrderList({

  deliveries,

  mode,

  historySegment = 'delivered',

  onHistorySegmentChange,

  search = '',

  onSearchChange,

  dateFrom = '',

  onDateFromChange,

  dateTo = '',

  onDateToChange,

  showFilters = false,

  showHistoryTabs = false,

}) {

  const segments = useMemo(() => countDeliverySegments(deliveries), [deliveries]);



  const filtered = useMemo(() => {

    let list = mode === 'active'

      ? filterDeliverySegment(deliveries, 'active')

      : filterDeliverySegment(deliveries, historySegment);



    const q = search.trim().toLowerCase();

    if (q) {

      list = list.filter((d) => {

        const name = (d.customer?.full_name || d.customer?.email || '').toLowerCase();

        const rider = (d.rider?.full_name || d.rider?.email || '').toLowerCase();

        const ref = formatDeliveryRef(d.id).toLowerCase();

        return name.includes(q) || rider.includes(q) || ref.includes(q)

          || d.pickup_address?.toLowerCase().includes(q)

          || d.delivery_address?.toLowerCase().includes(q);

      });

    }

    if (dateFrom) {

      const from = new Date(`${dateFrom}T00:00:00`);

      list = list.filter((d) => new Date(d.created_at) >= from);

    }

    if (dateTo) {

      const to = new Date(`${dateTo}T23:59:59`);

      list = list.filter((d) => new Date(d.created_at) <= to);

    }

    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  }, [deliveries, mode, historySegment, search, dateFrom, dateTo]);



  const pagination = usePagination(filtered);



  const emptyMessage = mode === 'active'

    ? 'No active orders.'

    : historySegment === 'delivered'

      ? 'No completed deliveries.'

      : 'No cancelled deliveries.';



  return (

    <div className="space-y-4">

      {showHistoryTabs && onHistorySegmentChange && (

        <ListTabs

          active={historySegment}

          onChange={onHistorySegmentChange}

          tabs={[

            { id: 'delivered', label: 'Completed', count: segments.delivered },

            { id: 'cancelled', label: 'Cancelled', count: segments.cancelled },

          ]}

        />

      )}



      {showFilters && (

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          <div className="sm:col-span-1 relative">

            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />

            <input

              type="search"

              placeholder="Search customer name…"

              value={search}

              onChange={(e) => onSearchChange?.(e.target.value)}

              className="w-full pl-9 pr-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm focus:border-primary focus:outline-none"

            />

          </div>

          <input

            type="date"

            value={dateFrom}

            onChange={(e) => onDateFromChange?.(e.target.value)}

            className="w-full px-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm focus:border-primary focus:outline-none"

            aria-label="From date"

          />

          <input

            type="date"

            value={dateTo}

            onChange={(e) => onDateToChange?.(e.target.value)}

            className="w-full px-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm focus:border-primary focus:outline-none"

            aria-label="To date"

          />

        </div>

      )}



      {filtered.length === 0 ? (

        <div className="glass-card rounded-xl p-10 text-center text-slate-500 text-sm">

          {emptyMessage}

        </div>

      ) : (

        <>

          <div className="space-y-2">

            {pagination.slice.map((d) => (

              <OrderCard key={d.id} d={d} />

            ))}

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



export function useAdminOrderCounts(deliveries) {

  return useMemo(() => {

    const segments = countDeliverySegments(deliveries);

    return {

      active: filterDeliverySegment(deliveries, 'active'),

      delivered: filterDeliverySegment(deliveries, 'delivered'),

      cancelled: filterDeliverySegment(deliveries, 'cancelled'),

      history: filterDeliverySegment(deliveries, 'history'),

      activeCount: segments.active,

      deliveredCount: segments.delivered,

      cancelledCount: segments.cancelled,

      historyCount: segments.history,

    };

  }, [deliveries]);

}


