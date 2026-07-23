import { Link, useLocation } from 'react-router-dom';
import {
  Shield, LogOut, Wifi, WifiOff, Home,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getAppNavItems } from '../lib/navigation';
import { NavIcon } from './dashboard/DashboardPanel';
import MobileNavDrawer, { MobileNavSection, MobileNavLink } from './MobileNavDrawer';

function NavLinkItem({ item, active, mobile, badgeCount, onNavigate }) {
  return (
    <Link
      to={item.to}
      title={item.label}
      onClick={onNavigate}
      className={`relative flex items-center gap-3 rounded-xl font-medium transition group touch-manipulation ${
        mobile ? 'px-4 py-3.5 text-base min-h-[52px]' : 'px-3 py-2.5 text-sm'
      } ${
        active
          ? 'bg-primary/15 text-primary-light border border-primary/25 shadow-sm shadow-primary/5'
          : 'text-slate-400 hover:text-white hover:bg-surface-lighter border border-transparent'
      }`}
    >
      <NavIcon name={item.icon} className={mobile ? 'w-6 h-6 shrink-0' : 'w-5 h-5 shrink-0'} />
      <div className="flex-1 min-w-0">
        <span className="block truncate">{item.label}</span>
      </div>
      {item.badgeKey === 'alerts' && badgeCount > 0 && (
        <span className="ml-auto px-2 py-0.5 bg-danger text-white text-xs font-bold rounded-full min-w-[22px] text-center shrink-0">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
      {mobile && (
        <ChevronRight className="w-5 h-5 text-slate-600 shrink-0" />
      )}
    </Link>
  );
}

export default function Sidebar({ unreadAlerts = 0, mobileOpen = false, onMobileClose }) {
  const { profile, signOut, isManager, isCustomer, isRider } = useAuth();
  const { connected, alerts } = useSocket();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = getAppNavItems({ isManager, isCustomer, isRider });
  const isMobileDrawer = onMobileClose != null;

  const criticalCount = alerts.filter((a) => !a.is_acknowledged && a.severity === 'critical').length;
  const badgeCount = unreadAlerts || criticalCount;

  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const roleLabel = {
    customer: 'Customer',
    manager: 'Manager',
    motor_rider: 'Motor Rider',
    admin: 'Manager',
    operator: 'Operator',
    viewer: 'Viewer',
  }[profile?.role?.name] || profile?.role?.name;

  const mainItems = navItems.filter((i) => i.section === 'main');
  const controlItems = navItems.filter((i) => i.section === 'control');

  const renderSection = (title, items, mobile) => (
    <>
      <p className={`px-3 pb-2 font-semibold uppercase tracking-wider text-slate-500 ${mobile ? 'pt-2 text-xs' : 'pt-1 text-[10px]'}`}>
        {title}
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <NavLinkItem
            key={item.to}
            item={item}
            active={location.pathname === item.to}
            mobile={mobile}
            badgeCount={badgeCount}
            onNavigate={mobile ? onMobileClose : undefined}
          />
        ))}
      </div>
    </>
  );

  const desktopFooter = (
    <div className="border-t border-border space-y-2 p-3">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${collapsed ? 'justify-center' : ''}`}>
        {connected ? (
          <Wifi className="w-4 h-4 text-success shrink-0" />
        ) : (
          <WifiOff className="w-4 h-4 text-slate-500 shrink-0" />
        )}
        {!collapsed && (
          <span className={`text-xs ${connected ? 'text-success' : 'text-slate-500'}`}>
            {connected ? 'Live' : 'Off'}
          </span>
        )}
      </div>

      <div className={`flex items-center gap-3 px-2 py-2 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border border-primary/20 flex items-center justify-center font-bold text-primary-light shrink-0 text-xs">
          {initials}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate text-sm">{profile?.full_name || 'User'}</p>
            <p className="text-slate-500 text-[11px]">{roleLabel}</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => signOut()}
        title="Sign out"
        className={`flex items-center gap-3 w-full rounded-xl text-slate-400 hover:text-danger hover:bg-danger/10 transition px-3 py-2.5 text-sm ${collapsed ? 'justify-center' : ''}`}
      >
        <LogOut className="w-4 h-4 shrink-0" />
        {!collapsed && <span>Sign out</span>}
      </button>
    </div>
  );

  const mobileDrawerFooter = (
    <>
      <div className="flex items-center gap-3 px-2 py-2 mb-3">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border border-primary/20 flex items-center justify-center font-bold text-primary-light shrink-0 text-sm">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate text-base">{profile?.full_name || 'User'}</p>
          <p className="text-sm text-slate-500">{roleLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {connected ? (
            <Wifi className="w-4 h-4 text-success" />
          ) : (
            <WifiOff className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => { signOut(); onMobileClose?.(); }}
        className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-xl text-danger bg-danger/10 border border-danger/20 font-semibold text-base touch-manipulation"
      >
        <LogOut className="w-5 h-5" />
        Sign out
      </button>
    </>
  );

  return (
    <>
      <aside
        className={`hidden lg:flex sidebar-gradient border-r border-border flex-col transition-all duration-300 ${
          collapsed ? 'w-[72px]' : 'w-72'
        }`}
      >
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Link to="/" className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </Link>
          {!collapsed && (
            <Link to="/" className="flex-1 min-w-0">
              <h1 className="font-bold text-white text-sm leading-tight truncate">Smart Box</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Delivery System</p>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-surface-lighter transition shrink-0"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
          {collapsed ? (
            navItems.map((item) => (
              <NavLinkItem
                key={item.to}
                item={item}
                active={location.pathname === item.to}
                mobile={false}
                badgeCount={badgeCount}
              />
            ))
          ) : (
            <div className="space-y-1">
              {mainItems.length > 0 && renderSection('Overview', mainItems, false)}
              {controlItems.length > 0 && renderSection('Control', controlItems, false)}
            </div>
          )}

          <div className="mt-2">
            <Link
              to="/"
              title="Website home"
              className="flex items-center gap-3 rounded-xl font-medium text-slate-500 hover:text-white hover:bg-surface-lighter border border-transparent transition px-3 py-2.5 text-sm"
            >
              <Home className="w-5 h-5 shrink-0" />
              {!collapsed && <span>Website home</span>}
            </Link>
          </div>
        </nav>

        {desktopFooter}
      </aside>

      {isMobileDrawer && (
        <MobileNavDrawer
          open={mobileOpen}
          onClose={onMobileClose}
          side="left"
          title="Smart Box"
          subtitle={undefined}
          footer={mobileDrawerFooter}
        >
          <div className="p-4 space-y-5">
            {mainItems.length > 0 && (
              <MobileNavSection title="Overview">
                {mainItems.map((item) => (
                  <NavLinkItem
                    key={item.to}
                    item={item}
                    active={location.pathname === item.to}
                    mobile
                    badgeCount={badgeCount}
                    onNavigate={onMobileClose}
                  />
                ))}
              </MobileNavSection>
            )}

            {controlItems.length > 0 && (
              <MobileNavSection title="Control">
                {controlItems.map((item) => (
                  <NavLinkItem
                    key={item.to}
                    item={item}
                    active={location.pathname === item.to}
                    mobile
                    badgeCount={badgeCount}
                    onNavigate={onMobileClose}
                  />
                ))}
              </MobileNavSection>
            )}

            <MobileNavSection title="More">
              <MobileNavLink
                to="/"
                onClick={onMobileClose}
                icon={Home}
                label="Website"
                trailing={<ChevronRight className="w-5 h-5 text-slate-600 shrink-0" />}
              />
            </MobileNavSection>
          </div>
        </MobileNavDrawer>
      )}
    </>
  );
}
