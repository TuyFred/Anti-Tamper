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
    paymentReview > 0 && { label: 'Payments', count: paymentReview, to: '/operations', icon: CreditCard, accent: 'border-warning/30 bg-warning/5 hover:bg-warning/10 text-warning' },
    pendingUsers > 0 && { label: 'Users', count: pendingUsers, to: '/admin', icon: Users, accent: 'border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary-light' },
    criticalAlerts > 0 && { label: 'Alerts', count: criticalAlerts, to: '/alerts', icon: AlertTriangle, accent: 'border-danger/30 bg-danger/5 hover:bg-danger/10 text-danger' },
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard icon={Users} label="Users" value={pendingUsers} accent={pendingUsers ? 'warning' : 'success'} />
        <StatCard icon={CreditCard} label="Proofs" value={paymentReview} accent={paymentReview ? 'warning' : 'success'} />
        <StatCard icon={Truck} label="Active" value={activeOps} accent="primary" />
        <StatCard icon={Package} label="Orders" value={deliveries.length} accent="neutral" />
        <StatCard icon={AlertTriangle} label="Alerts" value={criticalAlerts} accent={criticalAlerts ? 'danger' : 'success'} />
      </div>

      <DashboardPanel title="Actions">
        {actions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.to} to={a.to} className={`flex items-center gap-3 p-4 rounded-xl border transition ${a.accent}`}>
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="font-semibold text-sm flex-1">{a.label}</span>
                  <span className="text-lg font-bold tabular-nums">{a.count}</span>
                  <ArrowRight className="w-4 h-4 opacity-40" />
                </Link>
              );
            })}
          </div>
        ) : (
          <DashboardEmptyState icon={CheckCircle2} title="All clear" />
        )}
      </DashboardPanel>
    </div>
  );
}
