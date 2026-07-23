import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Clock, CheckCircle2, CreditCard, ArrowRight, MapPin, Loader2, Plus, Key,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import { deliveryStatusMeta, formatPrice } from '../../lib/deliveryUtils';
import { DashboardPanel, DashboardEmptyState } from './DashboardPanel';
import BoxTrackingPanel from './BoxTrackingPanel';

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
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Orders" value={deliveries.length} accent="primary" />
        <StatCard icon={Clock} label="Active" value={inProgress.length} accent={inProgress.length ? 'warning' : 'success'} />
        <StatCard icon={CheckCircle2} label="Delivered" value={delivered.length} accent="success" />
        <StatCard icon={CreditCard} label="To pay" value={awaitingPayment.length} accent={awaitingPayment.length ? 'warning' : 'neutral'} />
      </div>

      <DashboardPanel
        title="Latest"
        action={(
          <Link to="/deliveries" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition">
            <Plus className="w-4 h-4" /> New
          </Link>
        )}
      >
        {activeTransit ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant={deliveryStatusMeta(activeTransit.status).variant}>
                {deliveryStatusMeta(activeTransit.status).label}
              </Badge>
              <p className="text-sm font-semibold text-white">{formatPrice(activeTransit.calculated_price, activeTransit.currency)}</p>
            </div>
            <div className="p-3 rounded-xl bg-surface/80 border border-border space-y-2 text-sm">
              <p className="flex gap-2 text-white break-words"><MapPin className="w-4 h-4 text-success shrink-0" /><span><span className="text-success font-semibold">A</span> {activeTransit.pickup_address}</span></p>
              <p className="flex gap-2 text-white break-words"><MapPin className="w-4 h-4 text-primary-light shrink-0" /><span><span className="text-primary-light font-semibold">B</span> {activeTransit.delivery_address}</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/deliveries" className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-primary/15 text-primary-light border border-primary/25 text-sm font-semibold">
                Deliveries <ArrowRight className="w-4 h-4" />
              </Link>
              {['in_transit', 'rider_assigned'].includes(activeTransit.status) && activeTransit.unlock_token && (
                <Link to="/deliveries" className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-warning/10 text-warning border border-warning/25 text-sm font-semibold">
                  <Key className="w-4 h-4" /> Unlock
                </Link>
              )}
              {['in_transit', 'rider_assigned', 'payment_verified'].includes(activeTransit.status) && (
                <Link to="/tracking" className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-success/10 text-success border border-success/25 text-sm font-semibold">
                  Track <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <DashboardEmptyState icon={Package} title="No active delivery">
            <Link to="/deliveries" className="text-primary-light hover:underline font-medium">New delivery</Link>
          </DashboardEmptyState>
        )}
      </DashboardPanel>

      {activeTransit && ['in_transit', 'rider_assigned'].includes(activeTransit.status) && (
        <DashboardPanel title="Live map">
          <BoxTrackingPanel compact showAlerts={false} />
        </DashboardPanel>
      )}
    </div>
  );
}

