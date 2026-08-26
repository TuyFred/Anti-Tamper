import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import DashboardHero from '../components/dashboard/DashboardHero';
import ManagerDashboard from '../components/dashboard/ManagerDashboard';
import CustomerDashboard from '../components/dashboard/CustomerDashboard';
import RiderDashboard from '../components/dashboard/RiderDashboard';

export default function Dashboard() {
  const { profile, isManager, isCustomer, isRider } = useAuth();
  const { connected } = useSocket();

  return (
    <div className="dashboard-root">
      <DashboardHero profile={profile} roleName={profile?.role?.name} connected={connected} />
      {isManager && <ManagerDashboard />}
      {isCustomer && <CustomerDashboard />}
      {isRider && <RiderDashboard />}
      {!isManager && !isCustomer && !isRider && (
        <div className="dashboard-panel glass-card rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-sm">Your role does not have a dedicated dashboard yet.</p>
          <p className="text-slate-500 text-xs mt-2">Contact an administrator for access.</p>
        </div>
      )}
    </div>
  );
}
