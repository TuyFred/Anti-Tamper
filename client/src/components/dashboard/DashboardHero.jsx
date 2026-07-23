import { Sparkles, CalendarDays } from 'lucide-react';

const ROLE_THEMES = {
  manager: {
    gradient: 'from-primary/30 via-accent/15 to-surface-light',
    ring: 'ring-primary/25',
    badge: 'bg-primary/20 text-primary-light border-primary/30',
    label: 'Manager',
    tagline: 'Oversee deliveries, Smart Boxes, and your team from one place.',
  },
  admin: {
    gradient: 'from-primary/30 via-accent/15 to-surface-light',
    ring: 'ring-primary/25',
    badge: 'bg-primary/20 text-primary-light border-primary/30',
    label: 'Manager',
    tagline: 'Oversee deliveries, Smart Boxes, and your team from one place.',
  },
  customer: {
    gradient: 'from-emerald-500/25 via-primary/10 to-surface-light',
    ring: 'ring-emerald-500/25',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    label: 'Customer',
    tagline: 'Track your orders, pay securely, and unlock your Smart Box at delivery.',
  },
  motor_rider: {
    gradient: 'from-amber-500/25 via-orange-500/10 to-surface-light',
    ring: 'ring-amber-500/25',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    label: 'Motor Rider',
    tagline: 'View assignments, transport Smart Boxes, and stay connected on the road.',
  },
  default: {
    gradient: 'from-slate-500/15 via-primary/10 to-surface-light',
    ring: 'ring-border',
    badge: 'bg-surface-lighter text-slate-300 border-border',
    label: 'Dashboard',
    tagline: 'Your Smart Box Delivery overview.',
  },
};

export default function DashboardHero({ profile, roleName, connected }) {
  const theme = ROLE_THEMES[roleName] || ROLE_THEMES.default;
  const firstName = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${theme.gradient} p-5 sm:p-8 ring-1 ${theme.ring}`}>
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="space-y-3 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${theme.badge}`}>
              <Sparkles className="w-3.5 h-3.5" />
              {theme.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              connected
                ? 'bg-success/10 text-success border-success/25'
                : 'bg-surface-lighter text-slate-500 border-border'
            }`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-slate-600'}`} />
              {connected ? 'Live updates' : 'Offline'}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-slate-400 border border-border bg-surface/50">
              <CalendarDays className="w-3.5 h-3.5" />
              {today}
            </span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              {greeting}, {firstName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary/40 to-accent/30 border border-white/10 flex items-center justify-center text-lg sm:text-xl font-bold text-white shadow-xl">
            {(profile?.full_name || profile?.email || '?')
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}
