import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Navigation, Play, Package, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../lib/api';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import { deliveryStatusMeta } from '../../lib/deliveryUtils';
import { DashboardPanel, DashboardEmptyState } from './DashboardPanel';
import DashboardDeliveryList from './DashboardDeliveryList';
import DashboardQuickActions from './DashboardQuickActions';
import DashboardAddressCard from './DashboardAddressCard';
import DashboardLoading from './DashboardLoading';
import RiderRouteMap from '../RiderRouteMap';

export default function RiderDashboard() {
  const { token } = useAuth();
  const { deliveryUpdateTick, alerts } = useSocket();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setAssignments(await api.getDeliveries(token));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token, deliveryUpdateTick]);

  const active = assignments.filter((d) => !['delivered', 'cancelled'].includes(d.status));
  const inTransit = assignments.filter((d) => d.status === 'in_transit');
  const readyToStart = assignments.filter((d) => d.status === 'rider_assigned');
  const delivered = assignments.filter((d) => d.status === 'delivered');
  const nextJob = readyToStart[0] || inTransit[0] || active[0];
  const unreadAlerts = alerts.filter((a) => !a.is_acknowledged).length;

  if (loading) {
    return <DashboardLoading label="Loading your route…" />;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-stats dashboard-stats--4">
        <StatCard icon={Truck} label="Active jobs" value={active.length} accent={active.length ? 'warning' : 'neutral'} compact />
        <StatCard icon={Navigation} label="In transit" value={inTransit.length} accent={inTransit.length ? 'primary' : 'neutral'} compact />
        <StatCard icon={Play} label="Ready to start" value={readyToStart.length} accent={readyToStart.length ? 'warning' : 'success'} compact />
        <StatCard icon={Package} label="Completed" value={delivered.length} accent="success" compact />
      </div>

      <DashboardQuickActions
        items={[
          { to: '/rider', label: 'My route', hint: 'Start & navigate', icon: 'Truck', highlight: true, badge: active.length },
          { to: '/tracking', label: 'Live map', hint: 'Box GPS', icon: 'Radio' },
          { to: '/alerts', label: 'Alerts', hint: 'Tamper & shock', icon: 'Bell', badge: unreadAlerts },
        ]}
      />

      <div className="dashboard-layout dashboard-layout--rider">
        <div className="dashboard-layout__primary space-y-5">
          <DashboardPanel
            title="Next job"
            subtitle={nextJob ? 'Your current assignment' : 'Waiting for new jobs'}
            icon="Truck"
            accent={nextJob ? 'primary' : 'default'}
            action={nextJob && (
              <Link to="/rider" className="dashboard-btn dashboard-btn--primary">
                Open route <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          >
            {nextJob ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={deliveryStatusMeta(nextJob.status).variant}>
                    {deliveryStatusMeta(nextJob.status).label}
                  </Badge>
                  {nextJob.device?.device_id && (
                    <span className="text-xs font-mono text-primary-light bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                      Box {nextJob.device.device_id}
                    </span>
                  )}
                </div>
                <DashboardAddressCard pickup={nextJob.pickup_address} delivery={nextJob.delivery_address} />
                <Link to="/rider" className="dashboard-btn dashboard-btn--soft w-full sm:w-auto">
                  Go to My Route <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <DashboardEmptyState icon={Truck} title="No jobs assigned">
                <Link to="/rider" className="dashboard-link">Check My Route</Link>
              </DashboardEmptyState>
            )}
          </DashboardPanel>

          {nextJob && nextJob.status === 'in_transit' && (
            <DashboardPanel title="Live map" subtitle="Follow the Smart Box" icon="Radio" accent="success">
              <RiderRouteMap delivery={nextJob} height="min(300px, 42vh)" live />
            </DashboardPanel>
          )}
        </div>

        <DashboardPanel
          title="Active jobs"
          subtitle={`${active.length} assignments`}
          icon="ClipboardList"
          action={(
            <Link to="/rider" className="dashboard-link">
              My route <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        >
          <DashboardDeliveryList
            deliveries={active}
            detailLink="/rider"
            showCustomer
            emptyIcon={Truck}
            emptyTitle="No active jobs"
          />
        </DashboardPanel>
      </div>
    </div>
  );
}
