import PromoVideoSlideshow from './PromoVideoSlideshow';

const ROLES = [
  { title: 'Customer', desc: 'Register, order delivery, pay, unlock box, leave reviews.' },
  { title: 'Manager', desc: 'Approve accounts, verify payments, assign riders, control boxes.' },
  { title: 'Motor Rider', desc: 'Receive assignments and deliver Smart Boxes securely.' },
];

export default function RolesPromoSection() {
  return (
    <section id="roles" className="relative py-20 px-4 sm:px-6 overflow-hidden">
      <div className="absolute inset-0 auth-gradient opacity-40 pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto">
        <div className="mb-10">
          <PromoVideoSlideshow />
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {ROLES.map(({ title, desc }) => (
            <div
              key={title}
              className="text-center p-6 rounded-2xl border border-border bg-surface-light/80 backdrop-blur-sm hover:border-primary/30 hover:bg-surface-lighter/50 transition"
            >
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
