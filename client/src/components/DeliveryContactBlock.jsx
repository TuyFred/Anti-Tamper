import { User, Mail, Phone } from 'lucide-react';
import { formatPhoneDisplay, phoneTelHref } from '../lib/contactUtils';

/** Rider / customer contact card on delivery screens */
export default function DeliveryContactBlock({ title, person, variant = 'default' }) {
  if (!person?.full_name && !person?.email && !person?.phone) return null;

  const tel = phoneTelHref(person.phone);
  const accent = variant === 'rider' ? 'border-primary/25 bg-primary/5' : 'border-success/25 bg-success/5';

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${accent}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="flex items-start gap-2 text-sm text-white">
        <User className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <span className="font-medium">{person.full_name || person.email || '—'}</span>
      </div>
      {person.email && (
        <a
          href={`mailto:${person.email}`}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-primary-light transition"
        >
          <Mail className="w-3.5 h-3.5 shrink-0" />
          {person.email}
        </a>
      )}
      {person.phone && (
        tel ? (
          <a href={tel} className="flex items-center gap-2 text-xs text-success hover:underline font-medium">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            {formatPhoneDisplay(person.phone)}
          </a>
        ) : (
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            {person.phone}
          </p>
        )
      )}
    </div>
  );
}
