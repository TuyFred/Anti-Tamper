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
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Quick navigation</p>
        <p className="text-sm text-slate-400 mt-1">Jump to any section — same as the menu</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
        {links.map(({ to, label, icon, desc }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 p-3 sm:p-4 rounded-xl border transition min-h-[56px] ${
                active
                  ? 'bg-primary/10 border-primary/30 text-primary-light'
                  : 'bg-surface-lighter/80 border-border text-slate-300 hover:text-white hover:border-primary/20'
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${active ? 'bg-primary/20' : 'bg-surface border border-border'}`}>
                <NavIcon name={icon} className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold truncate">{label}</p>
                {desc && <p className="text-[11px] text-slate-500 truncate mt-0.5">{desc}</p>}
              </div>
              <ChevronRight className="w-4 h-4 opacity-40 shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
