export default function StatCard({ icon: Icon, label, value, sub, accent = 'primary' }) {
  const accents = {
    primary: 'from-primary/20 to-accent/10 text-primary-light',
    success: 'from-success/20 to-success/5 text-success',
    warning: 'from-warning/20 to-warning/5 text-warning',
    danger: 'from-danger/20 to-danger/5 text-danger',
    neutral: 'from-slate-500/20 to-slate-600/5 text-slate-300',
  };

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4 border border-border/80 hover:border-primary/15 transition-colors">
      <div className={`p-2.5 sm:p-3 rounded-xl bg-gradient-to-br shrink-0 ${accents[accent]}`}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold text-white mt-1 tabular-nums">{value}</p>
        {sub && <p className="text-xs sm:text-sm text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}
