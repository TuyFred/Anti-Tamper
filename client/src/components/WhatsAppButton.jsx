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
      className={`fixed z-50 flex items-center gap-2.5 pl-4 pr-5 py-3.5 sm:py-4 rounded-full bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-white font-semibold text-sm sm:text-base shadow-xl shadow-[#25D366]/35 transition-all bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] sm:bottom-6 sm:right-6 ${className}`}
    >
      <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
      <span className="max-[380px]:hidden sm:inline">WhatsApp Business</span>
      <span className="hidden max-[380px]:inline">Chat</span>
    </a>
  );
}
