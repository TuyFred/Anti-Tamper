import { Link } from 'react-router-dom';
import { NavIcon } from './DashboardPanel';

export default function DashboardQuickActions({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className="dashboard-quick-actions">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={`dashboard-quick-action ${item.highlight ? 'dashboard-quick-action--highlight' : ''}`}
        >
          <span className={`dashboard-quick-action__icon ${item.accent || ''}`}>
            <NavIcon name={item.icon} className="w-5 h-5" />
          </span>
          <span className="dashboard-quick-action__body">
            <span className="dashboard-quick-action__label">{item.label}</span>
            {item.hint && <span className="dashboard-quick-action__hint">{item.hint}</span>}
          </span>
          {item.badge != null && item.badge > 0 && (
            <span className="dashboard-quick-action__badge">{item.badge > 99 ? '99+' : item.badge}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
