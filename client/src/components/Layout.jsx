import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

const pageTitles = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview and quick actions for your role' },
  '/deliveries': { title: 'My Deliveries', subtitle: 'Request deliveries, pay, and unlock your Smart Box' },
  '/operations': { title: 'Operations', subtitle: 'Verify payments, assign riders, and manage deliveries' },
  '/rider': { title: 'My Route', subtitle: 'Assigned deliveries and transit control' },
  '/alerts': { title: 'Alert Center', subtitle: 'Tamper and security notifications' },
  '/tracking': { title: 'Box Tracking', subtitle: 'Live GPS and Smart Box fleet control' },
  '/admin': { title: 'User Management', subtitle: 'Approve accounts and manage roles' },
  '/admin/videos': { title: 'Promo Videos', subtitle: 'Homepage slideshow and broadcast videos' },
};

export default function Layout({ children }) {
  const location = useLocation();
  const page = pageTitles[location.pathname] || pageTitles['/dashboard'];
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-surface">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile app bar */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3.5 border-b border-border bg-surface/95 backdrop-blur-xl pt-[max(0.875rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
            className="p-2.5 rounded-xl bg-surface-lighter border border-border text-white hover:bg-surface-light transition shrink-0"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate leading-tight">{page.title}</h2>
            <p className="text-xs text-slate-400 truncate mt-0.5">{page.subtitle}</p>
          </div>
        </header>

        {/* Desktop page header */}
        <header className="hidden lg:block px-6 py-5 border-b border-border bg-surface-light/50">
          <h2 className="text-xl font-bold text-white">{page.title}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{page.subtitle}</p>
        </header>

        <main className="flex-1 p-4 sm:p-5 lg:p-6 overflow-y-auto overflow-x-hidden max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
