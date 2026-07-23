import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield, Package, MapPin, Lock, Star, ChevronRight, Menu,
  Smartphone, Building2, Truck, Key, CheckCircle2, MessageCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatPrice } from '../lib/deliveryUtils';
import { DASHBOARD_PATH, TRACKING_PATH, HOME_NAV_LINKS, getHomeAppLinks } from '../lib/navigation';
import RolesPromoSection from '../components/RolesPromoSection';
import SoundOnVideo from '../components/SoundOnVideo';
import WhatsAppButton from '../components/WhatsAppButton';
import { whatsappUrl, WHATSAPP_DISPLAY } from '../lib/whatsapp';
import { NavIcon } from '../components/dashboard/DashboardPanel';
import MobileNavDrawer, { MobileNavSection, MobileNavLink } from '../components/MobileNavDrawer';

const STEPS = [
  {
    step: '01',
    icon: Package,
    image: '/images/steps/step-01-request.png',
    title: 'Request delivery',
    desc: 'Create your account, enter pickup (A) and delivery (B) addresses. Price is calculated instantly.',
  },
  {
    step: '02',
    icon: Smartphone,
    image: '/images/steps/step-02-payment.png',
    title: 'Pay securely',
    desc: 'Pay via MoMo Pay or bank transfer outside the app, then upload your payment proof.',
  },
  {
    step: '03',
    icon: Truck,
    image: '/images/steps/step-03-rider.png',
    title: 'Rider assigned',
    desc: 'Manager verifies payment and assigns a motor rider with a locked Smart Box.',
  },
  {
    step: '04',
    icon: Key,
    image: '/images/steps/step-04-unlock.png',
    title: 'Unlock at delivery',
    desc: 'Receive your unique token. Enter it on your dashboard to unlock the box at delivery.',
  },
  {
    step: '05',
    icon: Star,
    image: '/images/steps/step-05-review.png',
    title: 'Rate & review',
    desc: 'Retrieve your items, box locks again automatically. Leave a star rating and comment.',
  },
];

const FEATURES = [
  { icon: Shield, title: 'Anti-tamper Smart Box', desc: 'Reed switch & motion sensors trigger alarms on unauthorized access.' },
  { icon: MapPin, title: 'Live GPS tracking', desc: 'Real-time location of your delivery box on the map dashboard.' },
  { icon: Lock, title: 'Token-based unlock', desc: 'Only you can open the box with your personal 6-digit token.' },
  { icon: CheckCircle2, title: 'Verified payments', desc: 'Manager confirms MoMo or bank payment before dispatch.' },
];

const RIDER_IMG = '/images/rider-hero.png';
const RIDER_VIDEO = 'https://assets.mixkit.co/videos/preview/mixkit-man-delivering-a-package-on-a-motorcycle-42805-large.mp4';

export default function HomePage() {
  const { session, isCustomer, isRider, isManager } = useAuth();
  const appLink = DASHBOARD_PATH;
  const [menuOpen, setMenuOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [distance, setDistance] = useState('5');
  const [estimate, setEstimate] = useState(null);

  useEffect(() => {
    api.getPublicDeliveryConfig().then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    const km = parseFloat(distance);
    if (!km || km < 1) return;
    api.estimateDeliveryPublic({ distance_km: km }).then(setEstimate).catch(() => {});
  }, [distance]);

  const whatsapp = config?.whatsapp?.number || '250791691817';
  const waDisplay = config?.whatsapp?.display || WHATSAPP_DISPLAY;
  const waHref = whatsappUrl(whatsapp);
  const appLinks = getHomeAppLinks(session, { isCustomer, isRider, isManager });

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-[80] border-b border-border/60 bg-surface/95 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white text-sm sm:text-base truncate">Smart Box Delivery</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm text-slate-400">
            <a href="#rider-video" className="hover:text-white transition whitespace-nowrap">Our riders</a>
            <a href="#how-it-works" className="hover:text-white transition whitespace-nowrap">How it works</a>
            <a href="#pricing" className="hover:text-white transition whitespace-nowrap">Pricing</a>
            <a href="#features" className="hover:text-white transition whitespace-nowrap">Features</a>
            <a href="#roles" className="hover:text-white transition whitespace-nowrap">Roles</a>
          </nav>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            {session ? (
              <div className="flex items-center gap-2">
                <Link
                  to={TRACKING_PATH}
                  className="px-4 py-2.5 border border-border text-slate-300 hover:text-white text-sm font-medium rounded-xl transition"
                >
                  Track box
                </Link>
                <Link
                  to={appLink}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-primary/25"
                >
                  Dashboard
                </Link>
              </div>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition">
                  Sign in
                </Link>
                <Link
                  to="/login?register=1"
                  className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-primary/25"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="md:hidden p-2.5 rounded-xl bg-surface-lighter border border-border text-white hover:bg-surface-light transition shrink-0 touch-manipulation"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      <MobileNavDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        side="right"
        title="Smart Box Delivery"
        subtitle="Explore & account"
        footer={session ? (
          <Link
            to={appLink}
            onClick={() => setMenuOpen(false)}
            className="block w-full text-center px-4 py-3.5 bg-primary text-white text-base font-semibold rounded-xl shadow-lg shadow-primary/25 touch-manipulation"
          >
            Open Dashboard
          </Link>
        ) : (
          <Link
            to="/login?register=1"
            onClick={() => setMenuOpen(false)}
            className="block w-full text-center px-4 py-3.5 bg-primary text-white text-base font-semibold rounded-xl shadow-lg shadow-primary/25 touch-manipulation"
          >
            Get started free
          </Link>
        )}
      >
        <div className="p-4 space-y-5">
          <MobileNavSection title="Explore">
            {HOME_NAV_LINKS.map((item) => (
              <MobileNavLink
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                iconNode={<NavIcon name={item.icon} className="w-5 h-5 text-primary-light shrink-0" />}
                label={item.label}
                trailing={<ChevronRight className="w-5 h-5 text-slate-600 shrink-0" />}
              />
            ))}
          </MobileNavSection>

          <MobileNavSection title={session ? 'Your account' : 'Account'}>
            {appLinks.map((item) => (
              <MobileNavLink
                key={item.to + item.label}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                iconNode={<NavIcon name={item.icon} className="w-5 h-5 text-primary-light shrink-0" />}
                label={item.label}
                trailing={<ChevronRight className="w-5 h-5 text-slate-600 shrink-0" />}
              />
            ))}
          </MobileNavSection>

          <MobileNavSection title="Support">
            <MobileNavLink
              href={waHref}
              onClick={() => setMenuOpen(false)}
              icon={MessageCircle}
              label="WhatsApp"
              accent
              trailing={<ChevronRight className="w-5 h-5 opacity-50 shrink-0" />}
            />
          </MobileNavSection>
        </div>
      </MobileNavDrawer>

      {/* Hero */}
      <section className="relative pt-24 sm:pt-28 pb-16 sm:pb-20 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 auth-gradient opacity-60" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent/15 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/25 text-success text-xs font-medium mb-6">
              <Shield className="w-3.5 h-3.5" />
              Secure document & parcel delivery
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
              Smart Box Delivery
              <span className="block text-xl sm:text-2xl md:text-3xl lg:text-4xl mt-3 font-semibold text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-accent">
                Across Rwanda
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-400 mb-8 max-w-md leading-relaxed">
              MoMo pay · Token unlock · GPS tracked Smart Box across Rwanda.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/login?register=1"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl transition shadow-xl shadow-primary/30"
              >
                Create free account
                <ChevronRight className="w-4 h-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-7 py-3.5 border border-border hover:border-slate-500 text-slate-300 hover:text-white font-medium rounded-xl transition"
              >
                See how we deliver
              </a>
            </div>
            <div className="flex flex-wrap gap-6 mt-10 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success" /> MoMo & bank pay</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success" /> Token unlock</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success" /> 24/7 WhatsApp support</span>
            </div>
          </div>

          <div className="relative">
            <div className="glass-card rounded-2xl overflow-hidden border border-primary/20 shadow-2xl">
              <div className="relative h-48 sm:h-56">
                <img
                  src={RIDER_IMG}
                  alt="Motor rider delivering Smart Box in Rwanda"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/90 text-white text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Rider online
                </div>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">Live route preview</p>
                  <span className="text-xs text-slate-500 font-mono">BOX-001 · Locked</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-2.5 rounded-lg bg-surface">
                    <span className="text-slate-400">From</span>
                    <span className="text-white text-right text-xs max-w-[60%]">Gasabo, Kimironko, KK 15</span>
                  </div>
                  <div className="flex justify-center"><ChevronRight className="w-4 h-4 text-primary-light rotate-90" /></div>
                  <div className="flex justify-between p-2.5 rounded-lg bg-surface">
                    <span className="text-slate-400">To</span>
                    <span className="text-white text-right text-xs max-w-[60%]">Kicukiro, Niboye, Remera</span>
                  </div>
                  <div className="flex justify-between p-3 rounded-xl bg-primary/10 border border-primary/20">
                    <span className="text-slate-400">Price</span>
                    <span className="text-primary-light font-bold">
                      {estimate ? formatPrice(estimate.calculated_price, estimate.currency) : '4,500 RWF'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Motor rider video */}
      <section id="rider-video" className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-xs font-bold text-primary-light uppercase tracking-widest">Our riders</span>
            <h2 className="text-3xl font-bold text-white mt-2 mb-4">Motor delivery in action</h2>
            <p className="text-slate-400 leading-relaxed mb-6">
              Trained motor riders carry your Smart Box through Kigali and across Rwanda.
              Every trip is GPS-tracked. The box stays locked until you enter your personal token.
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Helmet & secure box mounting</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Province → District → Sector → Cell → Village</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> OpenStreetMap pin for exact pickup & delivery</li>
            </ul>
          </div>
          <div className="relative rounded-2xl overflow-hidden border border-border shadow-2xl aspect-video bg-black">
            <SoundOnVideo
              src={RIDER_VIDEO}
              type="video/mp4"
              poster={RIDER_IMG}
              className="w-full h-full object-cover"
              overlayClassName="w-full h-full"
            />
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <Truck className="w-4 h-4" /> Smart Box motor delivery
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How we deliver */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 bg-surface-light/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">How we deliver</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              From your first click to the moment you unlock your Smart Box — every step is secure, transparent, and tracked.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {STEPS.map(({ step, icon: Icon, image, title, desc }) => (
              <div
                key={step}
                className="glass-card rounded-2xl overflow-hidden border border-border group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                <div className="relative h-36 overflow-hidden">
                  <img
                    src={image}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
                  <span className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-primary/90 text-white text-[10px] font-bold tracking-widest">
                    {step}
                  </span>
                  <div className="absolute bottom-3 right-3 w-9 h-9 rounded-xl bg-surface/90 backdrop-blur border border-border flex items-center justify-center">
                    <Icon className="w-4 h-4 text-primary-light" />
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-white text-sm mb-2">{title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Why Smart Box Delivery?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl border border-border bg-surface-light hover:border-primary/30 transition">
                <Icon className="w-8 h-8 text-primary-light mb-4" />
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 bg-surface-light/50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-4">Transparent pricing</h2>
          <p className="text-slate-400 text-center mb-10">No hidden fees. Calculate your delivery cost instantly.</p>

          <div className="glass-card rounded-2xl p-8">
            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="text-xs text-slate-400 block mb-2">Distance (km)</label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  className="w-full px-4 py-3 bg-surface rounded-xl border border-border text-white text-lg font-semibold"
                />
              </div>
              <div className="flex flex-col justify-end">
                <p className="text-xs text-slate-400 mb-1">Your price</p>
                <p className="text-4xl font-bold text-white">
                  {estimate ? formatPrice(estimate.calculated_price, estimate.currency) : '—'}
                </p>
                {config && (
                  <p className="text-xs text-slate-500 mt-1">
                    Base {formatPrice(config.baseFare, config.currency)} + {formatPrice(config.ratePerKm, config.currency)}/km
                  </p>
                )}
              </div>
            </div>

            {config && (
              <div className="grid sm:grid-cols-2 gap-4 pt-6 border-t border-border">
                <div className="p-4 rounded-xl bg-surface">
                  <Smartphone className="w-5 h-5 text-success mb-2" />
                  <p className="text-sm font-medium text-white">MoMo Pay</p>
                  <p className="text-sm font-mono text-slate-300 mt-1">{config.payment.momoNumber}</p>
                </div>
                <div className="p-4 rounded-xl bg-surface">
                  <Building2 className="w-5 h-5 text-primary-light mb-2" />
                  <p className="text-sm font-medium text-white">Bank transfer</p>
                  <p className="text-sm text-slate-300 mt-1">{config.payment.bankName}</p>
                  <p className="text-xs font-mono text-slate-400">{config.payment.bankAccount}</p>
                </div>
              </div>
            )}

            <Link
              to="/login?register=1"
              className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition"
            >
              Order now — create account
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <RolesPromoSection />

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center rounded-3xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/25 p-12">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to deliver securely?</h2>
          <p className="text-slate-400 mb-8 max-w-lg mx-auto">
            Join Smart Box Delivery today. Create your account, get manager approval, and place your first order in minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/login?register=1" className="px-8 py-3.5 bg-primary text-white font-semibold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition">
              Create account
            </Link>
            <Link to="/login" className="px-8 py-3.5 border border-border text-slate-300 hover:text-white rounded-xl transition">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-primary-light" />
              <span className="font-bold text-white">Smart Box Delivery</span>
            </div>
            <p className="text-sm text-slate-500 max-w-xs">
              Professional secure delivery platform with anti-tamper Smart Boxes and live GPS tracking.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-white mb-3">Support</p>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm sm:text-base text-[#25D366] hover:underline"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp Business · {waDisplay}
            </a>
          </div>
          <div className="text-sm text-slate-500">
            © 2026 Smart Box Delivery System
          </div>
        </div>
      </footer>

      <WhatsAppButton className={menuOpen ? 'hidden' : ''} />
    </div>
  );
}
