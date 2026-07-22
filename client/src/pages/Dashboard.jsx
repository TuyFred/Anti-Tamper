import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import DashboardHero from '../components/dashboard/DashboardHero';
import DashboardQuickNav from '../components/dashboard/DashboardQuickNav';
import ManagerDashboard from '../components/dashboard/ManagerDashboard';
import CustomerDashboard from '../components/dashboard/CustomerDashboard';
import RiderDashboard from '../components/dashboard/RiderDashboard';

export default function Dashboard() {
  const { profile, roleName, isManager, isCustomer, isRider } = useAuth();
  const { connected } = useSocket();

  return (
    <div className="space-y-5 sm:space-y-7 max-w-7xl">
      <DashboardHero profile={profile} roleName={roleName} connected={connected} />
      {isManager && <ManagerDashboard />}
      {isCustomer && <CustomerDashboard />}
      {isRider && <RiderDashboard />}
      {(isManager || isCustomer || isRider) && (
        <DashboardQuickNav roleName={roleName} excludePath="/dashboard" />
      )}
      {!isManager && !isCustomer && !isRider && (
        <div className="glass-card rounded-xl p-12 text-center text-slate-500 text-sm">
          Your role does not have a dedicated dashboard yet. Contact an administrator.
        </div>
      )}
    </div>
  );
}
