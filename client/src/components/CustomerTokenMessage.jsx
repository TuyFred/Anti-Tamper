import { useState } from 'react';
import {
  Mail, Shield, Copy, CheckCircle2, MapPin, Clock, Key, Eye, EyeOff,
} from 'lucide-react';
import {
  formatDeliveryRef, formatDeliveryDateTime,
} from '../lib/deliveryUtils';

function buildShareText(delivery, companyName) {
  const ref = formatDeliveryRef(delivery.id);
  const lines = [
    `${companyName} — Smart Box Unlock Code`,
    '',
    `Order: ${ref}`,
    `Delivery address: ${delivery.delivery_address}`,
    '',
    `Unlock code: ${delivery.unlock_token}`,
    delivery.token_expires_at
      ? `Valid until: ${formatDeliveryDateTime(delivery.token_expires_at)}`
      : '',
    '',
    'Use this code at delivery to open your Smart Box. Do not share with anyone.',
  ];
  return lines.filter(Boolean).join('\n');
}

export default function CustomerTokenMessage({
  delivery,
  customerName,
  customerEmail,
  companyName = 'Anti-Tamper Smart Delivery',
  compact = false,
  onCopyError,
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [revealed, setRevealed] = useState(!compact);

  if (!delivery?.unlock_token) return null;

  const sentAt = delivery.token_sent_at || delivery.updated_at;
  const isExpired = delivery.token_expires_at
    && new Date(delivery.token_expires_at) < new Date();
  const isUsed = Boolean(delivery.token_used_at);
  const recipient = customerName || customerEmail || 'You';

  const copy = async (text, setter) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      onCopyError?.('Copy failed');
    }
  };

  const maskedToken = delivery.unlock_token.replace(/./g, '•');

  return (
    <article className={`relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-surface via-surface to-primary/5 shadow-lg shadow-primary/5 ${compact ? '' : 'ring-1 ring-primary/10'}`}>
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary-light to-success" />

      <header className="px-4 sm:px-5 pt-4 pb-3 border-b border-border/80">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary-light" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary-light">
                Secure delivery message
              </p>
              <h3 className="text-sm sm:text-base font-bold text-white mt-0.5 truncate">
                Your Smart Box unlock code
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                From <span className="text-slate-300">{companyName}</span>
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-success/10 border border-success/20">
            <Shield className="w-3 h-3 text-success" />
            <span className="text-[10px] font-semibold text-success uppercase tracking-wide">Private</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <p className="text-slate-400">
            <span className="text-slate-500">To:</span>{' '}
            <span className="text-slate-200 font-medium">{recipient}</span>
            {customerEmail && customerName && (
              <span className="block text-slate-500 truncate">{customerEmail}</span>
            )}
          </p>
          <p className="text-slate-400 sm:text-right">
            <span className="text-slate-500">Sent:</span>{' '}
            <span className="text-slate-300">{formatDeliveryDateTime(sentAt)}</span>
          </p>
        </div>
      </header>

      <div className={`px-4 sm:px-5 ${compact ? 'py-3' : 'py-4'} space-y-3`}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-slate-400">{formatDeliveryRef(delivery.id)}</span>
          {delivery.device && (
            <span className="px-2 py-0.5 rounded-md bg-surface border border-border text-slate-400 font-mono">
              Box {delivery.device.device_id}
            </span>
          )}
          {isUsed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/10 text-success font-medium">
              <CheckCircle2 className="w-3 h-3" /> Used
            </span>
          )}
          {isExpired && !isUsed && (
            <span className="px-2 py-0.5 rounded-md bg-danger/10 text-danger font-medium">Expired</span>
          )}
        </div>

        <div className="p-3 rounded-xl bg-surface/70 border border-border">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-primary-light" />
            Unlock at delivery address (B)
          </p>
          <p className="text-sm text-slate-200 leading-snug break-words">{delivery.delivery_address}</p>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary-light mb-2 flex items-center justify-center gap-1">
            <Key className="w-3 h-3" />
            Your unlock code
          </p>
          <p className="text-3xl sm:text-4xl font-mono font-bold text-white tracking-[0.35em] select-all">
            {revealed ? delivery.unlock_token : maskedToken}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-slate-300 hover:text-white transition"
            >
              {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {revealed ? 'Hide' : 'Show'}
            </button>
            <button
              type="button"
              onClick={() => copy(delivery.unlock_token, setCopiedCode)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark transition"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedCode ? 'Copied' : 'Copy code'}
            </button>
            {!compact && (
              <button
                type="button"
                onClick={() => copy(buildShareText(delivery, companyName), setCopiedMessage)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-slate-300 hover:text-white transition"
              >
                <Mail className="w-3.5 h-3.5" />
                {copiedMessage ? 'Copied' : 'Copy message'}
              </button>
            )}
          </div>
        </div>

        {delivery.token_expires_at && !isUsed && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5 justify-center">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Valid until {formatDeliveryDateTime(delivery.token_expires_at)}
          </p>
        )}

        {!compact && (
          <p className="text-[11px] text-slate-500 leading-relaxed text-center px-2">
            When your rider arrives at delivery B, enter this code to unlock the Smart Box and collect your items.
            This message is for you only — do not share your code.
          </p>
        )}
      </div>
    </article>
  );
}
