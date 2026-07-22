import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminPanel from './pages/AdminPanel';
import AlertCenter from './pages/AlertCenter';
import PendingApproval from './pages/PendingApproval';
import Deliveries from './pages/Deliveries';
import Operations from './pages/Operations';
import RiderRoute from './pages/RiderRoute';
import BoxTracking from './pages/BoxTracking';
import PromoVideosPage from './pages/PromoVideosPage';

function DashboardRedirect() {
  const { loading, session } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to="/dashboard" replace />;
}

function ProtectedRoute({
  children,
  requireManager = false,
  requireCustomer = false,
  requireRider = false,
}) {
  const { loading, session, isApproved, isManager, isCustomer, isRider } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (!isApproved) return <PendingApproval />;
  if (requireManager && !isManager) return <Navigate to="/dashboard" replace />;
  if (requireCustomer && !isCustomer) return <Navigate to="/dashboard" replace />;
  if (requireRider && !isRider && !isManager) return <Navigate to="/dashboard" replace />;

  return children;
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={session ? <DashboardRedirect /> : <Login />} />
      <Route path="/app" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/deliveries"
        element={
          <ProtectedRoute requireCustomer>
            <Layout>
              <Deliveries />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations"
        element={
          <ProtectedRoute requireManager>
            <Layout>
              <Operations />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rider"
        element={
          <ProtectedRoute requireRider>
            <Layout>
              <RiderRoute />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/alerts"
        element={
          <ProtectedRoute>
            <Layout>
              <AlertCenter />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tracking"
        element={
          <ProtectedRoute>
            <Layout>
              <BoxTracking />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/videos"
        element={
          <ProtectedRoute requireManager>
            <Layout>
              <PromoVideosPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireManager>
            <Layout>
              <AdminPanel />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
