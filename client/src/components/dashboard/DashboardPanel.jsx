import * as LucideIcons from 'lucide-react';

export function NavIcon({ name, className = 'w-5 h-5' }) {
  const Icon = LucideIcons[name] || LucideIcons.Circle;
  return <Icon className={className} />;
}

export function DashboardPanel({
  title,
  subtitle,
  action,
  children,
  className = '',
  icon,
  accent = 'default',
}) {
  const accents = {
    default: 'border-border/80 bg-surface-light/30',
    primary: 'border-primary/20 bg-primary/5',
    success: 'border-success/20 bg-success/5',
    warning: 'border-warning/20 bg-warning/5',
    danger: 'border-danger/20 bg-danger/5',
  };

  return (
    <section className={`dashboard-panel glass-card rounded-2xl border overflow-hidden ${className}`}>
      {(title || action) && (
        <header className={`dashboard-panel__header ${accents[accent] || accents.default}`}>
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {icon && (
              <span className="dashboard-panel__icon">
                <NavIcon name={icon} className="w-4 h-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h3 className="dashboard-panel__title">{title}</h3>}
              {subtitle && <p className="dashboard-panel__subtitle">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="dashboard-panel__action shrink-0">{action}</div>}
        </header>
      )}
      <div className="dashboard-panel__body">{children}</div>
    </section>
  );
}

export function DashboardEmptyState({ icon: Icon, title, children }) {
  return (
    <div className="dashboard-empty">
      {Icon && (
        <div className="dashboard-empty__icon">
          <Icon className="w-7 h-7 text-slate-500" />
        </div>
      )}
      <p className="dashboard-empty__title">{title}</p>
      {children && <div className="dashboard-empty__hint">{children}</div>}
    </div>
  );
}
