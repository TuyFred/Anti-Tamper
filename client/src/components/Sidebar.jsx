import { Link, useLocation } from 'react-router-dom';
import {
  Shield, LogOut, Wifi, WifiOff, Home, X,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getAppNavItems } from '../lib/navigation';
import { NavIcon } from './dashboard/DashboardPanel';

function NavLinkItem({ item, active, mobile, badgeCount, onNavigate }) {
  return (
    <Link
      to={item.to}
      title={item.desc || item.label}
      onClick={onNavigate}
      className={`relative flex items-center gap-3 rounded-xl font-medium transition group ${
        mobile ? 'px-4 py-3.5 text-base' : 'px-3 py-2.5 text-sm'
      } ${
        active
          ? 'bg-primary/15 text-primary-light border border-primary/25 shadow-sm shadow-primary/5'
          : 'text-slate-400 hover:text-white hover:bg-surface-lighter border border-transparent'
      }`}
    >
      <NavIcon name={item.icon} className={mobile ? 'w-6 h-6 shrink-0' : 'w-5 h-5 shrink-0'} />
      <div className={`flex-1 min-w-0 ${mobile ? '' : ''}`}>
        <span className="block truncate">{item.label}</span>
        {mobile && item.desc && (
          <span className="block text-xs text-slate-500 truncate mt-0.5 font-normal">{item.desc}</span>
        )}
      </div>
      {item.badgeKey === 'alerts' && badgeCount > 0 && (
        <span className="ml-auto px-2 py-0.5 bg-danger text-white text-xs font-bold rounded-full min-w-[22px] text-center shrink-0">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
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

  const navContent = (mobile = false) => (
    <>
      <nav className={`flex-1 overflow-y-auto scrollbar-thin ${mobile ? 'p-4' : 'p-3 space-y-1'}`}>
        {collapsed && !mobile ? (
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
          <div className={mobile ? 'space-y-4' : 'space-y-1'}>
            {mainItems.length > 0 && renderSection('Overview', mainItems, mobile)}
            {controlItems.length > 0 && renderSection('Control', controlItems, mobile)}
          </div>
        )}

        <div className={mobile ? 'mt-5 pt-4 border-t border-border' : 'mt-2'}>
          <Link
            to="/"
            title="Website home"
            onClick={mobile ? onMobileClose : undefined}
            className={`flex items-center gap-3 rounded-xl font-medium text-slate-500 hover:text-white hover:bg-surface-lighter border border-transparent transition ${
              mobile ? 'px-4 py-3.5 text-base' : 'px-3 py-2.5 text-sm'
            }`}
          >
            <Home className={mobile ? 'w-6 h-6 shrink-0' : 'w-5 h-5 shrink-0'} />
            {(!collapsed || mobile) && <span>Website home</span>}
          </Link>
        </div>
      </nav>

      <div className={`border-t border-border space-y-2 ${mobile ? 'p-4 pb-[max(1rem,env(safe-area-inset-bottom))]' : 'p-3'}`}>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${collapsed && !mobile ? 'justify-center' : ''}`}>
          {connected ? (
            <Wifi className={`text-success shrink-0 ${mobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
          ) : (
            <WifiOff className={`text-slate-500 shrink-0 ${mobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
          )}
          {(!collapsed || mobile) && (
            <span className={`${mobile ? 'text-sm' : 'text-xs'} ${connected ? 'text-success' : 'text-slate-500'}`}>
              {connected ? 'Real-time active' : 'Disconnected'}
            </span>
          )}
        </div>

        <div className={`flex items-center gap-3 px-2 py-2 ${collapsed && !mobile ? 'justify-center' : ''}`}>
          <div className={`rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border border-primary/20 flex items-center justify-center font-bold text-primary-light shrink-0 ${mobile ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs'}`}>
            {initials}
          </div>
          {(!collapsed || mobile) && (
            <div className="flex-1 min-w-0">
              <p className={`font-medium text-white truncate ${mobile ? 'text-base' : 'text-sm'}`}>{profile?.full_name || 'User'}</p>
              <p className={`text-slate-500 ${mobile ? 'text-sm' : 'text-[11px]'}`}>{roleLabel}</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => { signOut(); onMobileClose?.(); }}
          title="Sign out"
          className={`flex items-center gap-3 w-full rounded-xl text-slate-400 hover:text-danger hover:bg-danger/10 transition ${
            mobile ? 'px-4 py-3.5 text-base' : `px-3 py-2.5 text-sm ${collapsed ? 'justify-center' : ''}`
          }`}
        >
          <LogOut className={`shrink-0 ${mobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
          {(!collapsed || mobile) && <span>Sign out</span>}
        </button>
      </div>
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
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        {navContent(false)}
      </aside>

      {isMobileDrawer && mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {isMobileDrawer && (
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[min(340px,92vw)] flex flex-col sidebar-gradient border-r border-border shadow-2xl transform transition-transform duration-300 ease-out lg:hidden ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
          }`}
          aria-hidden={!mobileOpen}
        >
          <div className="flex items-center justify-between gap-3 p-4 border-b border-border pt-[max(1rem,env(safe-area-inset-top))]">
            <Link to="/" onClick={onMobileClose} className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-white text-base leading-tight truncate">Smart Box</h1>
                <p className="text-xs text-slate-500">All navigation</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close menu"
              className="p-2.5 rounded-xl bg-surface-lighter border border-border text-slate-300 hover:text-white transition shrink-0"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          {navContent(true)}
        </aside>
      )}
    </>
  );
}
