/** Segmented tabs for list pages (completed / cancelled / etc.) */
export default function ListTabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition touch-manipulation border ${
              isActive
                ? 'bg-primary text-white border-primary'
                : 'bg-surface text-slate-400 border-border hover:text-white hover:bg-surface-lighter'
            }`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                isActive ? 'bg-white/20 text-white' : 'bg-surface-lighter text-slate-400'
              }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
