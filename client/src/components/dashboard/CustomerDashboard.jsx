import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Clock, CheckCircle2, CreditCard, ArrowRight, MapPin, Loader2, Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import { deliveryStatusMeta, formatPrice } from '../../lib/deliveryUtils';
import { DashboardPanel, DashboardEmptyState } from './DashboardPanel';

export default function CustomerDashboard() {
  const { token } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setDeliveries(await api.getDeliveries(token));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token]);

  const inProgress = deliveries.filter((d) => !['delivered', 'cancelled'].includes(d.status));
  const delivered = deliveries.filter((d) => d.status === 'delivered');
  const awaitingPayment = deliveries.filter((d) =>
    ['awaiting_payment', 'payment_submitted'].includes(d.status)
  );
  const activeTransit = deliveries.find((d) =>
    ['in_transit', 'rider_assigned', 'payment_verified', 'awaiting_payment', 'payment_submitted'].includes(d.status)
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Package} label="Total orders" value={deliveries.length} sub="All time" accent="primary" />
        <StatCard icon={Clock} label="In progress" value={inProgress.length} sub="Active deliveries" accent={inProgress.length ? 'warning' : 'success'} />
        <StatCard icon={CheckCircle2} label="Delivered" value={delivered.length} sub="Completed" accent="success" />
        <StatCard icon={CreditCard} label="Awaiting payment" value={awaitingPayment.length} sub="Action needed" accent={awaitingPayment.length ? 'warning' : 'neutral'} />
      </div>

      <DashboardPanel
        title="Latest delivery"
        subtitle={activeTransit ? 'Your most recent active order' : 'No active orders right now'}
        action={(
          <Link
            to="/deliveries"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition"
          >
            <Plus className="w-4 h-4" />
            New request
          </Link>
        )}
      >
        {activeTransit ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Badge variant={deliveryStatusMeta(activeTransit.status).variant}>
                {deliveryStatusMeta(activeTransit.status).label}
              </Badge>
              <p className="text-sm font-semibold text-white">
                {formatPrice(activeTransit.calculated_price, activeTransit.currency)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface/80 border border-border space-y-2">
              <p className="text-sm text-white flex items-start gap-2">
                <MapPin className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <span className="break-words">{activeTransit.pickup_address}</span>
              </p>
              <div className="flex justify-center">
                <ArrowRight className="w-4 h-4 text-slate-600 rotate-90" />
              </div>
              <p className="text-sm text-white flex items-start gap-2">
                <MapPin className="w-4 h-4 text-primary-light shrink-0 mt-0.5" />
                <span className="break-words">{activeTransit.delivery_address}</span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                to="/deliveries"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary/15 text-primary-light border border-primary/25 text-sm font-semibold hover:bg-primary/25 transition"
              >
                Manage delivery <ArrowRight className="w-4 h-4" />
              </Link>
              {['in_transit', 'rider_assigned', 'payment_verified'].includes(activeTransit.status) && (
                <Link
                  to="/tracking"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-success/10 text-success border border-success/25 text-sm font-semibold hover:bg-success/20 transition"
                >
                  Track live <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <DashboardEmptyState icon={Package} title="No active deliveries">
            <Link to="/deliveries" className="text-primary-light hover:underline font-medium">
              Request your first delivery
            </Link>
            {' '}— documents, parcels, and confidential items across Rwanda.
          </DashboardEmptyState>
        )}
      </DashboardPanel>
    </div>
  );
}
