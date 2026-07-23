/** Default landing page after sign-in (overview for every role). */
export const DASHBOARD_PATH = '/dashboard';
export const TRACKING_PATH = '/tracking';

/** Homepage anchor links — keep in sync with HomePage sections. */
export const HOME_NAV_LINKS = [
  { href: '#rider-video', label: 'Our riders', icon: 'Truck' },
  { href: '#how-it-works', label: 'How it works', icon: 'Package' },
  { href: '#features', label: 'Features', icon: 'Shield' },
  { href: '#pricing', label: 'Pricing', icon: 'CreditCard' },
  { href: '#roles', label: 'Roles & promo', icon: 'Users' },
];

/** Full app navigation per role (sidebar + mobile burger). */
export function getAppNavItems({ isManager, isCustomer, isRider }) {
  if (isCustomer) {
    return [
      { to: '/dashboard', label: 'Overview', icon: 'LayoutDashboard', section: 'main' },
      { to: '/deliveries', label: 'Deliveries', icon: 'Package', section: 'control' },
      { to: '/tracking', label: 'Tracking', icon: 'Radio', section: 'control' },
      { to: '/alerts', label: 'Alerts', icon: 'Bell', section: 'control', badgeKey: 'alerts' },
    ];
  }

  if (isManager) {
    return [
      { to: '/dashboard', label: 'Overview', icon: 'LayoutDashboard', section: 'main' },
      { to: '/operations', label: 'Operations', icon: 'ClipboardList', section: 'control' },
      { to: '/reports', label: 'Reports', icon: 'FileText', section: 'control' },
      { to: '/tracking', label: 'Fleet', icon: 'Radio', section: 'control' },
      { to: '/alerts', label: 'Alerts', icon: 'Bell', section: 'control', badgeKey: 'alerts' },
      { to: '/admin', label: 'Users', icon: 'Users', section: 'control' },
      { to: '/admin/videos', label: 'Videos', icon: 'Video', section: 'control' },
    ];
  }

  if (isRider) {
    return [
      { to: '/dashboard', label: 'Overview', icon: 'LayoutDashboard', section: 'main' },
      { to: '/rider', label: 'My Route', icon: 'Truck', section: 'control' },
      { to: '/tracking', label: 'Tracking', icon: 'Radio', section: 'control' },
      { to: '/alerts', label: 'Alerts', icon: 'Bell', section: 'control', badgeKey: 'alerts' },
    ];
  }

  return [
    { to: '/dashboard', label: 'Overview', icon: 'LayoutDashboard', section: 'main' },
    { to: '/tracking', label: 'Tracking', icon: 'Radio', section: 'control' },
    { to: '/alerts', label: 'Alerts', icon: 'Bell', section: 'control', badgeKey: 'alerts' },
  ];
}

export function getPrimaryNav(roleName) {
  const map = {
    customer: getAppNavItems({ isCustomer: true, isManager: false, isRider: false }),
    motor_rider: getAppNavItems({ isCustomer: false, isManager: false, isRider: true }),
    manager: getAppNavItems({ isCustomer: false, isManager: true, isRider: false }),
    admin: getAppNavItems({ isCustomer: false, isManager: true, isRider: false }),
  };
  return (map[roleName] || getAppNavItems({ isCustomer: false, isManager: false, isRider: false }))
    .map(({ to, label, icon }) => ({ to, label, icon }));
}

export function getHomeAppLinks(session, { isCustomer, isRider, isManager }) {
  if (!session) {
    return [
      { to: '/login', label: 'Sign in', icon: 'LogIn' },
      { to: '/login?register=1', label: 'Register', icon: 'UserPlus' },
    ];
  }
  return getAppNavItems({ isManager, isCustomer, isRider }).map(({ to, label, icon }) => ({ to, label, icon }));
}
