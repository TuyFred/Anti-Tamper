import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Shield } from 'lucide-react';

/**
 * Full-screen mobile navigation drawer (portal → body).
 * Used by app sidebar and homepage navbar for consistent phone UX.
 */
export default function MobileNavDrawer({
  open,
  onClose,
  side = 'left',
  title = 'Menu',
  subtitle,
  logoHref = '/',
  children,
  footer,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const panelSide = side === 'right'
    ? 'right-0 border-l animate-slide-in-right'
    : 'left-0 border-r animate-slide-in-left';

  const closedTransform = side === 'right' ? 'translate-x-full' : '-translate-x-full';

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        className={`fixed inset-y-0 z-[100] w-[min(340px,92vw)] flex flex-col sidebar-gradient shadow-2xl border-border transition-transform duration-300 ease-out lg:hidden ${panelSide} ${
          open ? 'translate-x-0 pointer-events-auto' : `${closedTransform} pointer-events-none`
        }`}
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0 pt-[max(1rem,env(safe-area-inset-top))]">
          <Link
            to={logoHref}
            onClick={onClose}
            className="flex items-center gap-3 min-w-0 flex-1"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-white text-base leading-tight truncate">{title}</h2>
              {subtitle ? (
                <p className="text-xs text-slate-500 truncate">{subtitle}</p>
              ) : null}
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="p-2.5 rounded-xl bg-surface-lighter border border-border text-slate-300 hover:text-white transition shrink-0 touch-manipulation"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </aside>
    </>,
    document.body,
  );
}

export function MobileNavSection({ title, children }) {
  return (
    <div className="mb-5 last:mb-0">
      {title && (
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </p>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function MobileNavLink({
  to,
  href,
  onClick,
  icon: Icon,
  iconNode,
  label,
  desc,
  accent,
  trailing,
}) {
  const cls = `flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium border transition touch-manipulation min-h-[52px] ${
    accent
      ? 'text-[#25D366] hover:bg-[#25D366]/10 border-[#25D366]/20'
      : 'text-slate-200 hover:text-white hover:bg-surface-lighter border-transparent hover:border-border'
  }`;

  const inner = (
    <>
      {iconNode || (Icon && <Icon className={`w-5 h-5 shrink-0 ${accent ? '' : 'text-primary-light'}`} />)}
      <div className="flex-1 min-w-0 text-left">
        <span className="block leading-snug">{label}</span>
        {desc && (
          <span className={`block text-xs font-normal mt-0.5 ${accent ? 'text-[#25D366]/70' : 'text-slate-500'}`}>
            {desc}
          </span>
        )}
      </div>
      {trailing}
    </>
  );

  if (href) {
    return (
      <a href={href} onClick={onClick} className={cls} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}>
        {inner}
      </a>
    );
  }

  return (
    <Link to={to} onClick={onClick} className={cls}>
      {inner}
    </Link>
  );
}
