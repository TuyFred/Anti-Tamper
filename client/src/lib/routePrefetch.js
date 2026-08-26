/** Prefetch lazy route chunks on sidebar hover for instant navigation */
export const ROUTE_PREFETCH = {
  '/dashboard': () => import('../pages/Dashboard'),
  '/deliveries': () => import('../pages/Deliveries'),
  '/deliveries/history': () => import('../pages/DeliveryHistory'),
  '/orders': () => import('../pages/Orders'),
  '/orders/history': () => import('../pages/OrderHistory'),
  '/operations': () => import('../pages/Operations'),
  '/operations/opening-requests': () => import('../pages/OpeningRequests'),
  '/operations/tokens': () => import('../pages/OpeningRequests'),
  '/profile': () => import('../pages/Profile'),
  '/rider': () => import('../pages/RiderRoute'),
  '/alerts': () => import('../pages/AlertCenter'),
  '/tracking': () => import('../pages/BoxTracking'),
  '/reports': () => import('../pages/Reports'),
  '/admin': () => import('../pages/AdminPanel'),
  '/admin/videos': () => import('../pages/PromoVideosPage'),
};

export function prefetchRoute(path) {
  const fn = ROUTE_PREFETCH[path];
  if (fn) fn().catch(() => {});
}

export function prefetchAppRoutes() {
  Object.values(ROUTE_PREFETCH).forEach((fn) => fn().catch(() => {}));
}
