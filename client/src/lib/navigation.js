/** Default landing page after sign-in (overview for every role). */
export const DASHBOARD_PATH = '/dashboard';
export const TRACKING_PATH = '/tracking';

/** Homepage anchor links — keep in sync with HomePage sections. */
export const HOME_NAV_LINKS = [
  { href: '#rider-video', label: 'Our riders', icon: 'Truck', desc: 'Motor delivery in action' },
  { href: '#how-it-works', label: 'How it works', icon: 'Package', desc: '5-step secure process' },
  { href: '#features', label: 'Features', icon: 'Shield', desc: 'Anti-tamper & GPS' },
  { href: '#pricing', label: 'Pricing', icon: 'CreditCard', desc: 'Instant quote calculator' },
  { href: '#roles', label: 'Roles & promo', icon: 'Users', desc: 'Customer, rider, manager' },
];

/** Full app navigation per role (sidebar + mobile burger). */
export function getAppNavItems({ isManager, isCustomer, isRider }) {
  if (isCustomer) {
    return [
      { to: '/dashboard', label: 'Overview', icon: 'LayoutDashboard', section: 'main', desc: 'Your delivery summary' },
      { to: '/deliveries', label: 'My Deliveries', icon: 'Package', section: 'control', desc: 'Request & track orders' },
      { to: '/tracking', label: 'Track Box', icon: 'Radio', section: 'control', desc: 'Live GPS on map' },
      { to: '/alerts', label: 'Alerts', icon: 'Bell', section: 'control', desc: 'Security notifications', badgeKey: 'alerts' },
    ];
  }

  if (isManager) {
    return [
      { to: '/dashboard', label: 'Overview', icon: 'LayoutDashboard', section: 'main', desc: 'Operations at a glance' },
      { to: '/operations', label: 'Operations', icon: 'ClipboardList', section: 'control', desc: 'Verify & assign deliveries' },
      { to: '/tracking', label: 'Smart Box Fleet', icon: 'Radio', section: 'control', desc: 'Fleet map & control' },
      { to: '/alerts', label: 'Alert Center', icon: 'Bell', section: 'control', desc: 'Tamper & security', badgeKey: 'alerts' },
      { to: '/admin', label: 'User Management', icon: 'Users', section: 'control', desc: 'Approve accounts & roles' },
      { to: '/admin/videos', label: 'Promo Videos', icon: 'Video', section: 'control', desc: 'Homepage slideshow' },
    ];
  }

  if (isRider) {
    return [
      { to: '/dashboard', label: 'Overview', icon: 'LayoutDashboard', section: 'main', desc: 'Your job summary' },
      { to: '/rider', label: 'My Route', icon: 'Truck', section: 'control', desc: 'Assignments & transit' },
      { to: '/tracking', label: 'Box Tracking', icon: 'Radio', section: 'control', desc: 'Live box GPS' },
      { to: '/alerts', label: 'Alerts', icon: 'Bell', section: 'control', desc: 'Security alerts', badgeKey: 'alerts' },
    ];
  }

  return [
    { to: '/dashboard', label: 'Overview', icon: 'LayoutDashboard', section: 'main', desc: 'Platform overview' },
    { to: '/tracking', label: 'Box Tracking', icon: 'Radio', section: 'control', desc: 'Device map' },
    { to: '/alerts', label: 'Alert Center', icon: 'Bell', section: 'control', desc: 'Notifications', badgeKey: 'alerts' },
  ];
}

/** Quick-access links on dashboard (all control items + overview). */
export function getPrimaryNav(roleName) {
  const map = {
    customer: getAppNavItems({ isCustomer: true, isManager: false, isRider: false }),
    motor_rider: getAppNavItems({ isCustomer: false, isManager: false, isRider: true }),
    manager: getAppNavItems({ isCustomer: false, isManager: true, isRider: false }),
    admin: getAppNavItems({ isCustomer: false, isManager: true, isRider: false }),
  };
  return (map[roleName] || getAppNavItems({ isCustomer: false, isManager: false, isRider: false }))
    .map(({ to, label, icon, desc }) => ({ to, label, icon, desc }));
}

/** Extra links shown in homepage mobile menu when logged in. */
export function getHomeAppLinks(session, { isCustomer, isRider, isManager }) {
  if (!session) {
    return [
      { to: '/login', label: 'Sign in', icon: 'LogIn', desc: 'Access your account' },
      { to: '/login?register=1', label: 'Create account', icon: 'UserPlus', desc: 'Register as customer' },
    ];
  }

  return getAppNavItems({ isManager, isCustomer, isRider }).map(({ to, label, icon, desc }) => ({
    to, label, icon, desc,
  }));
}
