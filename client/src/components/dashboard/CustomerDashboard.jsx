import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Clock, CheckCircle2, CreditCard, ArrowRight, Plus, Key,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../lib/api';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import { deliveryStatusMeta, formatPrice, isActiveDelivery } from '../../lib/deliveryUtils';
import { canTrackAssignedBox } from '../../lib/boxTracking';
import CustomerTokenMessage from '../CustomerTokenMessage';
import RiderRouteMap from '../RiderRouteMap';
import { DashboardPanel, DashboardEmptyState } from './DashboardPanel';
import DashboardDeliveryList from './DashboardDeliveryList';
import DashboardQuickActions from './DashboardQuickActions';
import DashboardAddressCard from './DashboardAddressCard';
import DashboardLoading from './DashboardLoading';

export default function CustomerDashboard() {
  const { token, profile } = useAuth();
  const { deliveryUpdateTick, alerts } = useSocket();
  const [deliveries, setDeliveries] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [list, cfg] = await Promise.all([
          api.getDeliveries(token),
          api.getDeliveryConfig(token),
        ]);
        setDeliveries(list);
        setConfig(cfg);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token]);

  useEffect(() => {
    if (token && deliveryUpdateTick > 0) {
      (async () => {
        try {
          setDeliveries(await api.getDeliveries(token));
        } catch (err) {
          console.error(err);
        }
      })();
    }
  }, [deliveryUpdateTick, token]);

  const activeDeliveries = deliveries.filter((d) => isActiveDelivery(d.status));
  const delivered = deliveries.filter((d) => d.status === 'delivered');
  const historyCount = deliveries.length - activeDeliveries.length;
  const awaitingPayment = deliveries.filter((d) =>
    ['awaiting_payment', 'payment_submitted'].includes(d.status),
  );
  const activeTransit = deliveries.find((d) =>
    ['in_transit', 'rider_assigned', 'payment_verified', 'awaiting_payment', 'payment_submitted'].includes(d.status),
  );
  const tokenDelivery = deliveries.find((d) =>
    ['in_transit', 'rider_assigned'].includes(d.status)
    && d.unlock_token
    && !d.token_closed_at
    && !(d.token_expires_at && new Date(d.token_expires_at) < new Date()),
  );
  const needsTokenRequest = deliveries.find((d) =>
    ['in_transit', 'rider_assigned'].includes(d.status)
    && d.device_id
    && (
      d.token_closed_at
      || !d.unlock_token
      || (d.token_expires_at && new Date(d.token_expires_at) < new Date())
    ),
  );
  const unreadAlerts = alerts.filter((a) => !a.is_acknowledged).length;
  const trackableDelivery = deliveries.find((d) => canTrackAssignedBox(d));
  const companyName = config?.company?.name || 'Anti-Tamper Smart Delivery';

  if (loading) {
    return <DashboardLoading label="Loading your deliveries…" />;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-stats dashboard-stats--4">
        <StatCard icon={Package} label="Total orders" value={deliveries.length} accent="primary" compact />
        <StatCard icon={Clock} label="Active" value={activeDeliveries.length} accent={activeDeliveries.length ? 'warning' : 'success'} compact />
        <StatCard icon={CheckCircle2} label="Delivered" value={delivered.length} accent="success" compact />
        <StatCard icon={CreditCard} label="To pay" value={awaitingPayment.length} accent={awaitingPayment.length ? 'warning' : 'neutral'} compact />
      </div>

      <DashboardQuickActions
        items={[
          { to: '/deliveries', label: 'New delivery', hint: 'Book a Smart Box', icon: 'Package', highlight: true },
          { to: '/tracking', label: 'Live tracking', hint: 'Map & GPS', icon: 'Radio' },
          { to: '/deliveries/history', label: 'History', hint: 'Past orders', icon: 'History', badge: historyCount },
          { to: '/alerts', label: 'Alerts', hint: 'Notifications', icon: 'Bell', badge: unreadAlerts },
        ]}
      />

      <div className="dashboard-layout dashboard-layout--customer">
        <div className="dashboard-layout__primary space-y-5">
          <DashboardPanel
            title="Current delivery"
            subtitle={activeTransit ? 'Your latest active order' : 'Start a new delivery anytime'}
            icon="Package"
            accent={activeTransit ? 'primary' : 'default'}
            action={(
              <Link to="/deliveries" className="dashboard-btn dashboard-btn--primary">
                <Plus className="w-4 h-4" /> New
              </Link>
            )}
          >
            {activeTransit ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={deliveryStatusMeta(activeTransit.status).variant}>
                    {deliveryStatusMeta(activeTransit.status).label}
                  </Badge>
                  <p className="text-base font-bold text-white tabular-nums">
                    {formatPrice(activeTransit.calculated_price, activeTransit.currency)}
                  </p>
                </div>
                <DashboardAddressCard
                  pickup={activeTransit.pickup_address}
                  delivery={activeTransit.delivery_address}
                />
                <div className="dashboard-action-row">
                  <Link to="/deliveries" className="dashboard-btn dashboard-btn--soft flex-1">
                    Manage <ArrowRight className="w-4 h-4" />
                  </Link>
                  {['in_transit', 'rider_assigned'].includes(activeTransit.status) && activeTransit.unlock_token && (
                    <Link to="/deliveries" className="dashboard-btn dashboard-btn--warning">
                      <Key className="w-4 h-4" /> Unlock
                    </Link>
                  )}
                  {['in_transit', 'rider_assigned', 'payment_verified'].includes(activeTransit.status) && (
                    <Link to="/tracking" className="dashboard-btn dashboard-btn--success">
                      Track live
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <DashboardEmptyState icon={Package} title="No active delivery">
                <Link to="/deliveries" className="dashboard-link">Create your first delivery</Link>
              </DashboardEmptyState>
            )}
          </DashboardPanel>

          {tokenDelivery && (
            <DashboardPanel title="Unlock code" subtitle="Use at the Smart Box" icon="Key" accent="warning">
              <CustomerTokenMessage
                delivery={tokenDelivery}
                customerName={profile?.full_name}
                customerEmail={profile?.email}
                companyName={companyName}
                compact
              />
              <div className="mt-4">
                <Link to="/deliveries" className="dashboard-btn dashboard-btn--primary">
                  <Key className="w-4 h-4" /> Open & unlock
                </Link>
              </div>
            </DashboardPanel>
          )}

          {!tokenDelivery && needsTokenRequest && (
            <DashboardPanel title="Unlock code" subtitle="Request a new code from your manager" icon="Key" accent="warning">
              <Link to="/deliveries" className="dashboard-btn dashboard-btn--warning">
                <Key className="w-4 h-4" /> Get new unlock code
              </Link>
            </DashboardPanel>
          )}
        </div>

        <div className="dashboard-layout__secondary space-y-5">
          {trackableDelivery && (
            <DashboardPanel title="Live map" subtitle="Box and route in real time" icon="Radio" accent="success">
              <RiderRouteMap delivery={trackableDelivery} height="min(320px, 45vh)" live />
            </DashboardPanel>
          )}

          <DashboardPanel
            title="Active orders"
            subtitle={`${activeDeliveries.length} in progress`}
            icon="ClipboardList"
            action={(
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {historyCount > 0 && (
                  <Link to="/deliveries/history" className="dashboard-link-muted">
                    History ({historyCount})
                  </Link>
                )}
                <Link to="/deliveries" className="dashboard-link">
                  View all <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          >
            <DashboardDeliveryList
              deliveries={activeDeliveries}
              detailLink="/deliveries"
              showRider
              emptyIcon={Package}
              emptyTitle="No active orders"
            />
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}
