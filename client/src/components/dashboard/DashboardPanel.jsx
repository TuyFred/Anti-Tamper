import * as LucideIcons from 'lucide-react';

export function NavIcon({ name, className = 'w-5 h-5' }) {
  const Icon = LucideIcons[name] || LucideIcons.Circle;
  return <Icon className={className} />;
}

export function DashboardPanel({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`glass-card rounded-2xl border border-border overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="px-4 sm:px-5 py-4 border-b border-border/80 bg-surface-light/40 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h3 className="font-semibold text-white text-base sm:text-lg">{title}</h3>}
            {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function DashboardEmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 sm:py-12 px-4">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-surface-lighter border border-border flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-slate-500" />
        </div>
      )}
      <p className="text-base font-medium text-slate-300 mb-1">{title}</p>
      <div className="text-sm text-slate-500 max-w-sm">{children}</div>
    </div>
  );
}
