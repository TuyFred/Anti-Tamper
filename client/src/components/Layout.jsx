import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Shield } from 'lucide-react';
import Sidebar from './Sidebar';

const pageTitles = {
  '/dashboard': { title: 'Dashboard' },
  '/deliveries': { title: 'Deliveries' },
  '/operations': { title: 'Operations' },
  '/rider': { title: 'My Route' },
  '/alerts': { title: 'Alerts' },
  '/tracking': { title: 'Tracking' },
  '/admin': { title: 'Users' },
  '/admin/videos': { title: 'Promo Videos' },
};

export default function Layout({ children }) {
  const location = useLocation();
  const page = pageTitles[location.pathname] || pageTitles['/dashboard'];
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-surface">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile app bar */}
        <header className="lg:hidden sticky top-0 z-[80] flex items-center gap-3 px-4 py-3 border-b border-border bg-surface/95 backdrop-blur-xl pt-[max(0.875rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
            className="p-2.5 rounded-xl bg-surface-lighter border border-border text-white hover:bg-surface-light transition shrink-0 touch-manipulation"
          >
            <Menu className="w-6 h-6" />
          </button>

          <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
          </Link>

          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white truncate leading-tight">{page.title}</h2>
          </div>
        </header>

        {/* Desktop page header */}
        <header className="hidden lg:block px-6 py-4 border-b border-border bg-surface-light/50">
          <h2 className="text-xl font-bold text-white">{page.title}</h2>
        </header>

        <main className="flex-1 p-4 sm:p-5 lg:p-6 overflow-y-auto overflow-x-hidden max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
