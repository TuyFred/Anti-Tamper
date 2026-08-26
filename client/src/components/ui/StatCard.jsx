export default function StatCard({ icon: Icon, label, value, sub, accent = 'primary', compact = false }) {
  const accents = {
    primary: 'from-primary/25 to-accent/10 text-primary-light ring-primary/20',
    success: 'from-success/25 to-success/5 text-success ring-success/20',
    warning: 'from-warning/25 to-warning/5 text-warning ring-warning/20',
    danger: 'from-danger/25 to-danger/5 text-danger ring-danger/20',
    neutral: 'from-slate-500/20 to-slate-600/5 text-slate-300 ring-slate-500/15',
  };

  return (
    <div className={`dashboard-stat ${compact ? 'dashboard-stat--compact' : ''}`}>
      <div className={`dashboard-stat__icon bg-gradient-to-br ring-1 ${accents[accent]}`}>
        <Icon className="w-5 h-5 sm:w-[1.35rem] sm:h-[1.35rem]" />
      </div>
      <div className="dashboard-stat__content">
        <p className="dashboard-stat__label">{label}</p>
        <p className="dashboard-stat__value">{value}</p>
        {sub && <p className="dashboard-stat__sub">{sub}</p>}
      </div>
    </div>
  );
}
