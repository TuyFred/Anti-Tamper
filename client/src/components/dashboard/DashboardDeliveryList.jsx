import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import Badge from '../ui/Badge';
import Pagination from '../ui/Pagination';
import { usePagination } from '../../hooks/usePagination';
import {
  deliveryStatusMeta,
  formatAddressShort,
  formatDeliveryDate,
  formatDeliveryRef,
  formatPrice,
} from '../../lib/deliveryUtils';
import { formatPhoneDisplay } from '../../lib/contactUtils';
import { DashboardEmptyState } from './DashboardPanel';

function DeliveryRow({ delivery, detailLink, showCustomer, showRider }) {
  const meta = deliveryStatusMeta(delivery.status);
  const customerName = delivery.customer?.full_name || delivery.customer?.email;
  const riderName = delivery.rider?.full_name || delivery.rider?.email;
  const customerPhone = delivery.customer?.phone ? formatPhoneDisplay(delivery.customer.phone) : null;
  const riderPhone = delivery.rider?.phone ? formatPhoneDisplay(delivery.rider.phone) : null;

  return (
    <Link to={detailLink} className="dashboard-delivery-row group">
      <div className="dashboard-delivery-row__main">
        <div className="dashboard-delivery-row__meta">
          <span className="dashboard-delivery-row__ref">{formatDeliveryRef(delivery.id)}</span>
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {delivery.device?.device_id && (
            <span className="dashboard-delivery-row__device">{delivery.device.device_id}</span>
          )}
        </div>
        <div className="dashboard-delivery-row__route">
          <p className="dashboard-delivery-row__line">
            <MapPin className="w-3.5 h-3.5 text-success shrink-0" />
            <span className="truncate">{formatAddressShort(delivery.pickup_address)}</span>
          </p>
          <p className="dashboard-delivery-row__line">
            <MapPin className="w-3.5 h-3.5 text-primary-light shrink-0" />
            <span className="truncate">{formatAddressShort(delivery.delivery_address)}</span>
          </p>
        </div>
        {(showCustomer && customerName) || (showRider && riderName) ? (
          <p className="dashboard-delivery-row__people">
            {showCustomer && customerName && <>Customer: {customerName}{customerPhone ? ` · ${customerPhone}` : ''}</>}
            {showCustomer && customerName && showRider && riderName && ' · '}
            {showRider && riderName && <>Rider: {riderName}{riderPhone ? ` · ${riderPhone}` : ''}</>}
          </p>
        ) : null}
      </div>
      <div className="dashboard-delivery-row__aside">
        <p className="dashboard-delivery-row__price">{formatPrice(delivery.calculated_price, delivery.currency)}</p>
        <p className="dashboard-delivery-row__date">{formatDeliveryDate(delivery.created_at)}</p>
        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-primary-light group-hover:translate-x-0.5 transition" />
      </div>
    </Link>
  );
}

export default function DashboardDeliveryList({
  deliveries,
  detailLink = '/deliveries',
  showCustomer = false,
  showRider = false,
  emptyIcon,
  emptyTitle = 'No items',
}) {
  const sorted = useMemo(
    () => [...deliveries].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [deliveries],
  );

  const pagination = usePagination(sorted);

  if (sorted.length === 0) {
    return <DashboardEmptyState icon={emptyIcon} title={emptyTitle} />;
  }

  return (
    <div className="dashboard-delivery-list">
      {pagination.slice.map((delivery) => (
        <DeliveryRow
          key={delivery.id}
          delivery={delivery}
          detailLink={detailLink}
          showCustomer={showCustomer}
          showRider={showRider}
        />
      ))}
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
    </div>
  );
}
