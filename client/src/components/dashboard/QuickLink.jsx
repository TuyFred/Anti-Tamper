import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function QuickLink({ to, icon: Icon, title, description, accent = 'primary' }) {
  const accents = {
    primary: 'group-hover:border-primary/40 group-hover:bg-primary/5 text-primary-light',
    success: 'group-hover:border-success/40 group-hover:bg-success/5 text-success',
    warning: 'group-hover:border-warning/40 group-hover:bg-warning/5 text-warning',
    danger: 'group-hover:border-danger/40 group-hover:bg-danger/5 text-danger',
    neutral: 'group-hover:border-slate-500/40 group-hover:bg-surface-lighter text-slate-300',
  };

  return (
    <Link
      to={to}
      className={`group glass-card rounded-xl p-4 flex items-start gap-4 border border-transparent transition-all hover:scale-[1.01] ${accents[accent]}`}
    >
      <div className={`p-2.5 rounded-xl bg-surface-lighter border border-border shrink-0 ${accents[accent]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm group-hover:text-white">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white shrink-0 mt-1 transition" />
    </Link>
  );
}
