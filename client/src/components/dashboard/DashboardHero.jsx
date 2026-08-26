import { Sparkles, CalendarDays } from 'lucide-react';

const ROLE_THEMES = {
  manager: {
    gradient: 'from-primary/35 via-indigo-500/10 to-surface',
    ring: 'ring-primary/20',
    badge: 'bg-primary/20 text-primary-light border-primary/30',
    label: 'Manager',
    tagline: 'Oversee deliveries, Smart Boxes, and your team from one place.',
  },
  admin: {
    gradient: 'from-violet-500/30 via-primary/10 to-surface',
    ring: 'ring-violet-500/20',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
    label: 'Admin',
    tagline: 'Manage users, devices, tokens, and platform operations.',
  },
  customer: {
    gradient: 'from-emerald-500/30 via-primary/10 to-surface',
    ring: 'ring-emerald-500/20',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    label: 'Customer',
    tagline: 'Track orders, pay securely, and unlock your Smart Box at delivery.',
  },
  motor_rider: {
    gradient: 'from-amber-500/30 via-orange-500/10 to-surface',
    ring: 'ring-amber-500/20',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    label: 'Motor Rider',
    tagline: 'View assignments, transport Smart Boxes, and stay connected on the road.',
  },
  default: {
    gradient: 'from-slate-500/15 via-primary/10 to-surface',
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
  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className={`dashboard-hero bg-gradient-to-br ${theme.gradient} ring-1 ${theme.ring}`}>
      <div className="dashboard-hero__glow dashboard-hero__glow--tr" />
      <div className="dashboard-hero__glow dashboard-hero__glow--bl" />

      <div className="dashboard-hero__inner">
        <div className="dashboard-hero__content">
          <div className="dashboard-hero__badges">
            <span className={`dashboard-hero__role ${theme.badge}`}>
              <Sparkles className="w-3.5 h-3.5" />
              {theme.label}
            </span>
            <span className={`dashboard-hero__status ${connected ? 'dashboard-hero__status--live' : ''}`}>
              <span className="dashboard-hero__status-dot" />
              {connected ? 'Live updates' : 'Offline'}
            </span>
            <span className="dashboard-hero__date hidden sm:inline-flex">
              <CalendarDays className="w-3.5 h-3.5" />
              {today}
            </span>
          </div>

          <h1 className="dashboard-hero__title">
            {greeting}, {firstName}
          </h1>
          <p className="dashboard-hero__tagline">{theme.tagline}</p>
        </div>

        <div className="dashboard-hero__avatar" aria-hidden>
          {initials}
        </div>
      </div>
    </header>
  );
}
