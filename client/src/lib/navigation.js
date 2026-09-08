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

/**
 * One-line “what do I do?” tip shown under the brand in the sidebar.
 */
export function getRoleGuide({ isManager, isCustomer, isRider, roleName }) {
  if (isCustomer) {
    return {
      title: 'Customer guide',
      steps: '1) Book & pay → 2) Wait for rider → 3) After admin grant, open My deliveries for your unlock code → 4) Open box at B',
    };
  }
  if (isRider) {
    return {
      title: 'Rider guide',
      steps: '1) Open My Route → 2) Start transit → 3) Track on map → 4) Deliver to B (customer opens the box)',
    };
  }
  if (isManager) {
    return {
      title: roleName === 'admin' ? 'Admin guide' : 'Manager guide',
      steps: '1) Verify payment → 2) Assign rider + box → 3) Grant open permission (code goes to customer)',
    };
  }
  return {
    title: 'Account guide',
    steps: 'Use Overview to see your next steps.',
  };
}

/** Full app navigation per role (sidebar + mobile burger). */
export function getAppNavItems({ isManager, isCustomer, isRider }) {
  if (isCustomer) {
    return [
      {
        to: '/dashboard',
        label: 'Overview',
        desc: 'Status & unlock code',
        icon: 'LayoutDashboard',
        section: 'main',
        sectionTitle: 'Start here',
      },
      {
        to: '/deliveries',
        label: 'My deliveries',
        desc: 'Book, pay, open box',
        icon: 'Package',
        section: 'control',
        sectionTitle: 'Deliveries',
      },
      {
        to: '/deliveries/history',
        label: 'History',
        desc: 'Past orders',
        icon: 'History',
        section: 'control',
        sectionTitle: 'Deliveries',
      },
      {
        to: '/tracking',
        label: 'Live tracking',
        desc: 'Box GPS map',
        icon: 'Radio',
        section: 'control',
        sectionTitle: 'Deliveries',
      },
      {
        to: '/alerts',
        label: 'Alerts',
        desc: 'Security notices',
        icon: 'Bell',
        section: 'control',
        sectionTitle: 'Deliveries',
        badgeKey: 'alerts',
      },
      {
        to: '/profile',
        label: 'My profile',
        desc: 'Name, phone, password',
        icon: 'User',
        section: 'account',
        sectionTitle: 'Account',
      },
    ];
  }

  if (isManager) {
    return [
      {
        to: '/dashboard',
        label: 'Overview',
        desc: 'What needs action',
        icon: 'LayoutDashboard',
        section: 'main',
        sectionTitle: 'Start here',
      },
      {
        to: '/orders',
        label: 'Active orders',
        desc: 'All live deliveries',
        icon: 'Package',
        section: 'control',
        sectionTitle: 'Dispatch',
      },
      {
        to: '/orders/history',
        label: 'Order history',
        desc: 'Completed / cancelled',
        icon: 'History',
        section: 'control',
        sectionTitle: 'Dispatch',
      },
      {
        to: '/operations',
        label: 'Operations',
        desc: 'Verify · assign · grant',
        icon: 'ClipboardList',
        section: 'control',
        sectionTitle: 'Dispatch',
      },
      {
        to: '/operations/opening-requests',
        label: 'Opening requests',
        desc: 'Customer asked to re-open',
        icon: 'Unlock',
        section: 'control',
        sectionTitle: 'Dispatch',
      },
      {
        to: '/tracking',
        label: 'Fleet map',
        desc: 'Riders & boxes live',
        icon: 'Radio',
        section: 'tools',
        sectionTitle: 'Tools',
      },
      {
        to: '/alerts',
        label: 'Alerts',
        desc: 'Tamper & device',
        icon: 'Bell',
        section: 'tools',
        sectionTitle: 'Tools',
        badgeKey: 'alerts',
      },
      {
        to: '/reports',
        label: 'Reports',
        desc: 'History & PDFs',
        icon: 'FileText',
        section: 'tools',
        sectionTitle: 'Tools',
      },
      {
        to: '/admin',
        label: 'Users',
        desc: 'Approve & roles',
        icon: 'Users',
        section: 'admin',
        sectionTitle: 'Admin',
      },
      {
        to: '/admin/videos',
        label: 'Videos',
        desc: 'Promo clips',
        icon: 'Video',
        section: 'admin',
        sectionTitle: 'Admin',
      },
      {
        to: '/profile',
        label: 'My profile',
        desc: 'Account settings',
        icon: 'User',
        section: 'account',
        sectionTitle: 'Account',
      },
    ];
  }

  if (isRider) {
    return [
      {
        to: '/dashboard',
        label: 'Overview',
        desc: 'Today’s jobs',
        icon: 'LayoutDashboard',
        section: 'main',
        sectionTitle: 'Start here',
      },
      {
        to: '/rider',
        label: 'My Route',
        desc: 'Assigned deliveries',
        icon: 'Truck',
        section: 'control',
        sectionTitle: 'On the road',
      },
      {
        to: '/tracking',
        label: 'Tracking',
        desc: 'Live map',
        icon: 'Radio',
        section: 'control',
        sectionTitle: 'On the road',
      },
      {
        to: '/alerts',
        label: 'Alerts',
        desc: 'Box warnings',
        icon: 'Bell',
        section: 'control',
        sectionTitle: 'On the road',
        badgeKey: 'alerts',
      },
      {
        to: '/profile',
        label: 'My profile',
        desc: 'Account settings',
        icon: 'User',
        section: 'account',
        sectionTitle: 'Account',
      },
    ];
  }

  return [
    { to: '/dashboard', label: 'Overview', desc: 'Home', icon: 'LayoutDashboard', section: 'main', sectionTitle: 'Start here' },
    { to: '/tracking', label: 'Tracking', desc: 'Map', icon: 'Radio', section: 'control', sectionTitle: 'Tools' },
    { to: '/alerts', label: 'Alerts', desc: 'Notices', icon: 'Bell', section: 'control', sectionTitle: 'Tools', badgeKey: 'alerts' },
    { to: '/profile', label: 'My profile', desc: 'Settings', icon: 'User', section: 'account', sectionTitle: 'Account' },
  ];
}

/** Group nav items by sectionTitle for sidebar rendering. */
export function groupNavBySection(navItems) {
  const groups = [];
  const seen = new Map();
  for (const item of navItems || []) {
    const title = item.sectionTitle || item.section || 'Menu';
    if (!seen.has(title)) {
      seen.set(title, []);
      groups.push({ title, items: seen.get(title) });
    }
    seen.get(title).push(item);
  }
  return groups;
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

/** Customer delivery status → next action copy. */
export function getCustomerNextStep(delivery) {
  if (!delivery) return null;
  const code = delivery.unlock_token || delivery.unlock_code;
  switch (delivery.status) {
    case 'awaiting_payment':
      return { tone: 'warning', title: 'Pay for this delivery', detail: 'Upload MoMo or bank proof on this card.' };
    case 'payment_submitted':
      return { tone: 'warning', title: 'Waiting for admin', detail: 'Admin will verify your payment proof.' };
    case 'payment_verified':
      return { tone: 'info', title: 'Waiting for rider', detail: 'Admin will assign a rider and Smart Box.' };
    case 'rider_assigned':
    case 'in_transit':
      if (code && !delivery.token_closed_at) {
        return {
          tone: 'success',
          title: 'Unlock code ready (from admin)',
          detail: 'Admin granted open permission. Use the code below to open the Smart Box at location B.',
        };
      }
      return {
        tone: 'info',
        title: 'Waiting for open permission',
        detail: 'When admin grants open permission, your unlock code appears here automatically (and by email).',
      };
    case 'delivered':
      return { tone: 'success', title: 'Delivered', detail: 'This order is complete.' };
    default:
      return null;
  }
}
