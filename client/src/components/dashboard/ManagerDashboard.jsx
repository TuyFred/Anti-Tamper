import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Package, CreditCard, Truck, AlertTriangle, ArrowRight, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../lib/api';
import StatCard from '../ui/StatCard';
import { isActiveDelivery, deliveryStatusMeta, formatDeliveryRef } from '../../lib/deliveryUtils';
import { DashboardPanel, DashboardEmptyState } from './DashboardPanel';
import DashboardQuickActions from './DashboardQuickActions';
import DashboardLoading from './DashboardLoading';
import Badge from '../ui/Badge';

export default function ManagerDashboard() {
  const { token } = useAuth();
  const { alerts, deliveryUpdateTick } = useSocket();
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
  }, [token, deliveryUpdateTick]);

  const paymentReview = deliveries.filter((d) => d.status === 'payment_submitted').length;
  const activeOrders = deliveries.filter((d) => isActiveDelivery(d.status));
  const activeOps = deliveries.filter((d) =>
    ['payment_verified', 'rider_assigned', 'in_transit'].includes(d.status),
  );
  const criticalAlerts = alerts.filter((a) => !a.is_acknowledged && a.severity === 'critical').length;
  const unreadAlerts = alerts.filter((a) => !a.is_acknowledged).length;

  if (loading) {
    return <DashboardLoading label="Loading operations overview…" />;
  }

  const urgentActions = [
    paymentReview > 0 && {
      label: 'Review payments',
      count: paymentReview,
      to: '/operations',
      icon: CreditCard,
      tone: 'warning',
      hint: 'Proofs waiting',
    },
    pendingUsers > 0 && {
      label: 'Approve users',
      count: pendingUsers,
      to: '/admin',
      icon: Users,
      tone: 'primary',
      hint: 'Pending sign-ups',
    },
    criticalAlerts > 0 && {
      label: 'Critical alerts',
      count: criticalAlerts,
      to: '/alerts',
      icon: AlertTriangle,
      tone: 'danger',
      hint: 'Needs attention',
    },
  ].filter(Boolean);

  const previewOrders = activeOrders.slice(0, 5);

  return (
    <div className="dashboard-page">
      <div className="dashboard-stats dashboard-stats--5">
        <StatCard icon={Users} label="Pending users" value={pendingUsers} accent={pendingUsers ? 'warning' : 'success'} compact />
        <StatCard icon={CreditCard} label="Payment proofs" value={paymentReview} accent={paymentReview ? 'warning' : 'success'} compact />
        <StatCard icon={Truck} label="In transit" value={activeOps.length} accent="primary" compact />
        <StatCard icon={Package} label="Active orders" value={activeOrders.length} accent="neutral" compact />
        <StatCard icon={AlertTriangle} label="Critical" value={criticalAlerts} accent={criticalAlerts ? 'danger' : 'success'} compact />
      </div>

      <DashboardQuickActions
        items={[
          { to: '/orders', label: 'Orders', hint: 'Active queue', icon: 'Package', badge: activeOrders.length },
          { to: '/operations', label: 'Operations', hint: 'Assign & verify', icon: 'ClipboardList', badge: paymentReview },
          { to: '/tracking', label: 'Tracking', hint: 'Live map', icon: 'Radio' },
          { to: '/admin', label: 'Users', hint: 'Team access', icon: 'Users', badge: pendingUsers },
          { to: '/reports', label: 'Reports', hint: 'History & export', icon: 'FileText' },
          { to: '/alerts', label: 'Alerts', hint: 'Security', icon: 'Bell', badge: unreadAlerts },
        ]}
      />

      <div className="dashboard-layout dashboard-layout--manager">
        <DashboardPanel
          title="Needs attention"
          subtitle="Urgent tasks for today"
          icon="AlertTriangle"
          accent={urgentActions.length ? 'warning' : 'success'}
        >
          {urgentActions.length > 0 ? (
            <div className="dashboard-urgent-grid">
              {urgentActions.map((a) => {
                const Icon = a.icon;
                return (
                  <Link
                    key={a.to}
                    to={a.to}
                    className={`dashboard-urgent-card dashboard-urgent-card--${a.tone}`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{a.label}</p>
                      <p className="text-xs opacity-80">{a.hint}</p>
                    </div>
                    <span className="dashboard-urgent-card__count">{a.count}</span>
                    <ArrowRight className="w-4 h-4 opacity-40 shrink-0" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <DashboardEmptyState icon={CheckCircle2} title="All clear">
              No urgent actions right now.
            </DashboardEmptyState>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Active orders"
          subtitle={`${activeOrders.length} in progress`}
          icon="Package"
          action={(
            <Link to="/orders" className="dashboard-link">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        >
          {previewOrders.length === 0 ? (
            <DashboardEmptyState icon={Package} title="No active orders">
              <Link to="/operations" className="dashboard-link">Go to Operations</Link>
            </DashboardEmptyState>
          ) : (
            <ul className="dashboard-order-preview">
              {previewOrders.map((d) => {
                const meta = deliveryStatusMeta(d.status);
                return (
                  <li key={d.id}>
                    <Link to="/operations" className="dashboard-order-preview__row">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-slate-500">{formatDeliveryRef(d.id)}</p>
                        <p className="text-sm font-medium text-white truncate">
                          {d.customer?.full_name || d.customer?.email || 'Customer'}
                        </p>
                      </div>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}
