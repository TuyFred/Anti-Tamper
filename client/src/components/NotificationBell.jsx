import { Bell } from 'lucide-react';

export default function NotificationBell({ count, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative p-2.5 rounded-xl border transition ${
        active
          ? 'bg-primary/15 border-primary/30 text-primary-light'
          : 'bg-surface border-border text-slate-400 hover:text-white hover:border-slate-600'
      }`}
      title="View all alerts"
      aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
    >
      <Bell className={`w-5 h-5 ${count > 0 ? 'animate-pulse-alert' : ''}`} />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center bg-danger text-white text-[10px] font-bold rounded-full border-2 border-[#0d1526]">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
