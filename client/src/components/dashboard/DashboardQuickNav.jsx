import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getPrimaryNav } from '../../lib/navigation';
import { NavIcon } from './DashboardPanel';

export default function DashboardQuickNav({ roleName, excludePath = '' }) {
  const location = useLocation();
  const links = getPrimaryNav(roleName).filter((l) => l.to !== excludePath);

  if (links.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl border border-border p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Menu</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {links.map(({ to, label, icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2.5 p-3 rounded-xl border transition min-h-[48px] ${
                active
                  ? 'bg-primary/10 border-primary/30 text-primary-light'
                  : 'bg-surface-lighter/80 border-border text-slate-300 hover:text-white hover:border-primary/20'
              }`}
            >
              <NavIcon name={icon} className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
