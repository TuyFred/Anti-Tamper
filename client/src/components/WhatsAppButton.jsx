import { MessageCircle } from 'lucide-react';
import { WHATSAPP_DISPLAY, whatsappUrl } from '../lib/whatsapp';

export default function WhatsAppButton({ className = '' }) {
  return (
    <a
      href={whatsappUrl()}
      target="_blank"
      rel="noopener noreferrer"
      title={`WhatsApp business support ${WHATSAPP_DISPLAY}`}
      aria-label="Contact Smart Box Delivery on WhatsApp"
      className={[
        'fixed z-40 flex items-center justify-center',
        'rounded-full bg-[#25D366] text-white',
        'shadow-lg shadow-[#25D366]/30',
        'hover:bg-[#20bd5a] active:scale-95 transition-all',
        // Mobile: compact icon-only FAB
        'w-11 h-11 sm:w-auto sm:h-auto sm:gap-2 sm:pl-3.5 sm:pr-4 sm:py-2.5',
        'bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(0.875rem,env(safe-area-inset-right))]',
        'sm:bottom-6 sm:right-6',
        className,
      ].join(' ')}
    >
      <MessageCircle className="w-5 h-5 sm:w-[1.125rem] sm:h-[1.125rem] shrink-0" strokeWidth={2.25} />
      <span className="hidden sm:inline text-sm font-semibold whitespace-nowrap">WhatsApp</span>
    </a>
  );
}
