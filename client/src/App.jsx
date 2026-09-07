import { lazy, Suspense, useEffect } from 'react';

import { Routes, Route, Navigate } from 'react-router-dom';

import { useAuth } from './context/AuthContext';

import Layout from './components/Layout';
import ActiveLocationShare from './components/ActiveLocationShare';
import CustomerUnlockWatcher from './components/CustomerUnlockWatcher';
import { prefetchAppRoutes } from './lib/routePrefetch';



const Login = lazy(() => import('./pages/Login'));

const HomePage = lazy(() => import('./pages/HomePage'));

const Dashboard = lazy(() => import('./pages/Dashboard'));

const AdminPanel = lazy(() => import('./pages/AdminPanel'));

const AlertCenter = lazy(() => import('./pages/AlertCenter'));

const Deliveries = lazy(() => import('./pages/Deliveries'));

const DeliveryHistory = lazy(() => import('./pages/DeliveryHistory'));

const Operations = lazy(() => import('./pages/Operations'));

const Orders = lazy(() => import('./pages/Orders'));

const OrderHistory = lazy(() => import('./pages/OrderHistory'));

const RiderRoute = lazy(() => import('./pages/RiderRoute'));

const BoxTracking = lazy(() => import('./pages/BoxTracking'));

const PromoVideosPage = lazy(() => import('./pages/PromoVideosPage'));

const OpeningRequests = lazy(() => import('./pages/OpeningRequests'));
const Profile = lazy(() => import('./pages/Profile'));

const Reports = lazy(() => import('./pages/Reports'));



function PageLoader() {

  return (

    <div className="min-h-screen flex items-center justify-center bg-surface">

      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />

    </div>

  );

}



function InlinePageLoader() {

  return (

    <div className="space-y-3 animate-pulse">

      <div className="h-8 w-48 rounded-lg bg-surface-lighter" />

      <div className="glass-card rounded-xl h-24 border border-border/60 bg-surface/40" />

      <div className="glass-card rounded-xl h-24 border border-border/60 bg-surface/40" />

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

  const { loading, session, isManager, isCustomer, isRider } = useAuth();



  if (loading) return <PageLoader />;



  if (!session) return <Navigate to="/login" replace />;

  if (requireManager && !isManager) return <Navigate to="/dashboard" replace />;

  if (requireCustomer && !isCustomer) return <Navigate to="/dashboard" replace />;

  if (requireRider && !isRider && !isManager) return <Navigate to="/dashboard" replace />;



  return children;

}



function AppLayout({ children }) {
  return (
    <Layout>
      <ActiveLocationShare />
      <CustomerUnlockWatcher />
      <Suspense fallback={<InlinePageLoader />}>
        {children}
      </Suspense>
    </Layout>
  );
}



export default function App() {

  const { session } = useAuth();



  useEffect(() => {

    if (session) {

      const t = setTimeout(prefetchAppRoutes, 400);

      return () => clearTimeout(t);

    }

    return undefined;

  }, [session]);



  return (

    <Routes>

      <Route path="/" element={<Suspense fallback={<PageLoader />}><HomePage /></Suspense>} />

      <Route path="/login" element={session ? <DashboardRedirect /> : <Suspense fallback={<PageLoader />}><Login /></Suspense>} />

      <Route path="/app" element={<Navigate to="/dashboard" replace />} />

      <Route

        path="/dashboard"

        element={(

          <ProtectedRoute>

            <AppLayout><Dashboard /></AppLayout>

          </ProtectedRoute>

        )}

      />

      <Route

        path="/deliveries"

        element={(

          <ProtectedRoute requireCustomer>

            <AppLayout><Deliveries /></AppLayout>

          </ProtectedRoute>

        )}

      />

      <Route

        path="/deliveries/history"

        element={(

          <ProtectedRoute requireCustomer>

            <AppLayout><DeliveryHistory /></AppLayout>

          </ProtectedRoute>

        )}

      />

      <Route

        path="/orders"

        element={(

          <ProtectedRoute requireManager>

            <AppLayout><Orders /></AppLayout>

          </ProtectedRoute>

        )}

      />

      <Route

        path="/orders/history"

        element={(

          <ProtectedRoute requireManager>

            <AppLayout><OrderHistory /></AppLayout>

          </ProtectedRoute>

        )}

      />

      <Route

        path="/operations"

        element={(

          <ProtectedRoute requireManager>

            <AppLayout><Operations /></AppLayout>

          </ProtectedRoute>

        )}

      />

      <Route
        path="/operations/opening-requests"
        element={(
          <ProtectedRoute requireManager>
            <AppLayout><OpeningRequests /></AppLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/operations/tokens"
        element={<Navigate to="/operations/opening-requests" replace />}
      />
      <Route
        path="/profile"
        element={(
          <ProtectedRoute>
            <AppLayout><Profile /></AppLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/rider"

        element={(

          <ProtectedRoute requireRider>

            <AppLayout><RiderRoute /></AppLayout>

          </ProtectedRoute>

        )}

      />

      <Route

        path="/alerts"

        element={(

          <ProtectedRoute>

            <AppLayout><AlertCenter /></AppLayout>

          </ProtectedRoute>

        )}

      />

      <Route

        path="/tracking"

        element={(

          <ProtectedRoute>

            <AppLayout><BoxTracking /></AppLayout>

          </ProtectedRoute>

        )}

      />

      <Route

        path="/reports"

        element={(

          <ProtectedRoute requireManager>

            <AppLayout><Reports /></AppLayout>

          </ProtectedRoute>

        )}

      />

      <Route

        path="/admin/videos"

        element={(

          <ProtectedRoute requireManager>

            <AppLayout><PromoVideosPage /></AppLayout>

          </ProtectedRoute>

        )}

      />

      <Route

        path="/admin"

        element={(

          <ProtectedRoute requireManager>

            <AppLayout><AdminPanel /></AppLayout>

          </ProtectedRoute>

        )}

      />

      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>

  );

}


