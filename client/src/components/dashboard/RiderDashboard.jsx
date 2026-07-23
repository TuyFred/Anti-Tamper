import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Navigation, Play, Package, Loader2, ArrowRight, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import { deliveryStatusMeta } from '../../lib/deliveryUtils';
import { DashboardPanel, DashboardEmptyState } from './DashboardPanel';

export default function RiderDashboard() {
  const { token } = useAuth();
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
  }, [token]);

  const active = assignments.filter((d) => !['delivered', 'cancelled'].includes(d.status));
  const inTransit = assignments.filter((d) => d.status === 'in_transit');
  const readyToStart = assignments.filter((d) => d.status === 'rider_assigned');
  const delivered = assignments.filter((d) => d.status === 'delivered');
  const nextJob = readyToStart[0] || inTransit[0] || active[0];

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
        <StatCard icon={Truck} label="Active" value={active.length} accent="warning" />
        <StatCard icon={Navigation} label="Transit" value={inTransit.length} accent={inTransit.length ? 'primary' : 'neutral'} />
        <StatCard icon={Play} label="Ready" value={readyToStart.length} accent={readyToStart.length ? 'warning' : 'success'} />
        <StatCard icon={Package} label="Done" value={delivered.length} accent="success" />
      </div>

      <DashboardPanel
        title="Next job"
        action={nextJob && (
          <Link to="/rider" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition">
            Route <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      >
        {nextJob ? (
          <div className="space-y-3">
            <Badge variant={deliveryStatusMeta(nextJob.status).variant}>{deliveryStatusMeta(nextJob.status).label}</Badge>
            {nextJob.device && <span className="text-xs text-slate-400 font-mono ml-2">Box {nextJob.device.device_id}</span>}
            <div className="p-3 rounded-xl bg-surface/80 border border-border space-y-2 text-sm">
              <p className="flex gap-2 text-white break-words"><MapPin className="w-4 h-4 text-success shrink-0" />{nextJob.pickup_address}</p>
              <p className="flex gap-2 text-white break-words"><MapPin className="w-4 h-4 text-primary-light shrink-0" />{nextJob.delivery_address}</p>
            </div>
          </div>
        ) : (
          <DashboardEmptyState icon={Truck} title="No jobs">
            <Link to="/rider" className="text-primary-light hover:underline">My Route</Link>
          </DashboardEmptyState>
        )}
      </DashboardPanel>
    </div>
  );
}
