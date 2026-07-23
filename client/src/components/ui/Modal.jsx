import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  '2xl': 'sm:max-w-5xl',
};

export default function Modal({ open, onClose, title, children, size = 'md', footer }) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${SIZES[size] || SIZES.md} max-h-[92dvh] flex flex-col bg-surface-light border border-border shadow-2xl rounded-t-2xl sm:rounded-2xl overflow-hidden`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-border shrink-0 bg-surface/95">
          <h3 className="font-semibold text-white text-base truncate">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-lighter transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 scrollbar-thin">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-border px-4 sm:px-5 py-3 bg-surface/95 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
