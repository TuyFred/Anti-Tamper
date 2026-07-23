import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

const HomePage = lazy(() => import('./pages/HomePage'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AlertCenter = lazy(() => import('./pages/AlertCenter'));
const PendingApproval = lazy(() => import('./pages/PendingApproval'));
const Deliveries = lazy(() => import('./pages/Deliveries'));
const Operations = lazy(() => import('./pages/Operations'));
const RiderRoute = lazy(() => import('./pages/RiderRoute'));
const BoxTracking = lazy(() => import('./pages/BoxTracking'));
const PromoVideosPage = lazy(() => import('./pages/PromoVideosPage'));
const Reports = lazy(() => import('./pages/Reports'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

function DashboardRedirect() {
  const { loading, session } = useAuth();
  if (loading) return <PageLoader />;
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

  if (loading) return <PageLoader />;

  if (!session) return <Navigate to="/login" replace />;
  if (!isApproved) return <PendingApproval />;
  if (requireManager && !isManager) return <Navigate to="/dashboard" replace />;
  if (requireCustomer && !isCustomer) return <Navigate to="/dashboard" replace />;
  if (requireRider && !isRider && !isManager) return <Navigate to="/dashboard" replace />;

  return children;
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) return <PageLoader />;

  return (
    <Suspense fallback={<PageLoader />}>
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
          path="/reports"
          element={
            <ProtectedRoute requireManager>
              <Layout>
                <Reports />
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
    </Suspense>
  );
}
