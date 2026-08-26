import { Loader2 } from 'lucide-react';

export default function DashboardLoading({ label = 'Loading dashboard…' }) {
  return (
    <div className="dashboard-loading" role="status" aria-live="polite">
      <div className="dashboard-loading__spinner">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
      <p className="dashboard-loading__text">{label}</p>
      <div className="dashboard-skeleton-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="dashboard-skeleton-stat" />
        ))}
      </div>
    </div>
  );
}
