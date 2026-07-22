import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Package, CreditCard, Truck, AlertTriangle, Loader2, ArrowRight, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../lib/api';
import StatCard from '../ui/StatCard';
import { DashboardPanel, DashboardEmptyState } from './DashboardPanel';

export default function ManagerDashboard() {
  const { token } = useAuth();
  const { alerts } = useSocket();
  const [deliveries, setDeliveries] = useState([]);
  const [pendingUsers, setPendingUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [list, pending] = await Promise.all([
          api.getDeliveries(token),
          api.getPendingUsers(token),
        ]);
        setDeliveries(list);
        setPendingUsers(pending.length);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token]);

  const paymentReview = deliveries.filter((d) => d.status === 'payment_submitted').length;
  const activeOps = deliveries.filter((d) =>
    ['payment_verified', 'rider_assigned', 'in_transit'].includes(d.status)
  ).length;
  const criticalAlerts = alerts.filter((a) => !a.is_acknowledged && a.severity === 'critical').length;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const actions = [
    paymentReview > 0 && {
      label: 'Verify payments',
      detail: `${paymentReview} proof${paymentReview > 1 ? 's' : ''} waiting`,
      to: '/operations',
      icon: CreditCard,
      accent: 'border-warning/30 bg-warning/5 hover:bg-warning/10 text-warning',
    },
    pendingUsers > 0 && {
      label: 'Approve users',
      detail: `${pendingUsers} registration${pendingUsers > 1 ? 's' : ''} pending`,
      to: '/admin',
      icon: Users,
      accent: 'border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary-light',
    },
    criticalAlerts > 0 && {
      label: 'Critical alerts',
      detail: `${criticalAlerts} need attention`,
      to: '/alerts',
      icon: AlertTriangle,
      accent: 'border-danger/30 bg-danger/5 hover:bg-danger/10 text-danger',
    },
  ].filter(Boolean);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Pending users" value={pendingUsers} sub="Need approval" accent={pendingUsers ? 'warning' : 'success'} />
        <StatCard icon={CreditCard} label="Payments to verify" value={paymentReview} sub="Customer proofs" accent={paymentReview ? 'warning' : 'success'} />
        <StatCard icon={Truck} label="Active deliveries" value={activeOps} sub="In pipeline" accent="primary" />
        <StatCard icon={Package} label="Total orders" value={deliveries.length} sub="All statuses" accent="neutral" />
        <StatCard icon={AlertTriangle} label="Critical alerts" value={criticalAlerts} sub="Unacknowledged" accent={criticalAlerts ? 'danger' : 'success'} />
      </div>

      <DashboardPanel
        title="Action center"
        subtitle={actions.length ? 'Items requiring your attention' : 'Everything is up to date'}
      >
        {actions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.to}
                  to={a.to}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition ${a.accent}`}
                >
                  <div className="p-2 rounded-lg bg-surface/80 border border-border shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{a.label}</p>
                    <p className="text-xs opacity-80 mt-0.5">{a.detail}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 opacity-50 shrink-0 mt-1" />
                </Link>
              );
            })}
          </div>
        ) : (
          <DashboardEmptyState icon={CheckCircle2} title="All clear">
            Operations, users, and alerts are under control. Use the menu to manage the fleet.
          </DashboardEmptyState>
        )}
      </DashboardPanel>
    </div>
  );
}
