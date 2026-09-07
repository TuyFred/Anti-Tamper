import { useEffect, useRef, useState } from 'react';
import { Key } from 'lucide-react';
import Modal from './ui/Modal';

const DISMISS_KEY = 'smartbox:unlock-popup-dismissed';

function readDismissed() {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISS_KEY) || '{}');
  } catch {
    return {};
  }
}

function markDismissed(deliveryId, code) {
  try {
    const prev = readDismissed();
    prev[String(deliveryId)] = String(code);
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(prev));
  } catch {
    // ignore
  }
}

/**
 * Full-screen popup when admin grants an unlock code — customer cannot miss it.
 */
export default function CustomerUnlockCodePopup({ deliveries = [] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);
  const seenRef = useRef(readDismissed());

  useEffect(() => {
    const candidates = (deliveries || []).filter((d) => {
      const code = d.unlock_token || d.unlock_code;
      if (!code || d.token_closed_at) return false;
      if (!['rider_assigned', 'in_transit'].includes(d.status)) return false;
      const dismissed = seenRef.current[String(d.id)];
      return dismissed !== String(code);
    });
    if (!candidates.length) {
      setOpen(false);
      setActive(null);
      return;
    }
    // Prefer newest token_sent_at
    const next = [...candidates].sort((a, b) =>
      new Date(b.token_sent_at || b.updated_at || 0) - new Date(a.token_sent_at || a.updated_at || 0),
    )[0];
    setActive(next);
    setOpen(true);
  }, [deliveries]);

  const code = active ? String(active.unlock_token || active.unlock_code || '').toUpperCase() : '';

  const close = () => {
    if (active?.id && code) {
      markDismissed(active.id, code);
      seenRef.current[String(active.id)] = code;
    }
    setOpen(false);
  };

  if (!active || !code) return null;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Your unlock code"
      size="sm"
      footer={(
        <button
          type="button"
          onClick={close}
          className="w-full py-3 rounded-xl bg-primary text-white font-semibold"
        >
          Got it — open the box
        </button>
      )}
    >
      <div className="space-y-4 text-center">
        <p className="text-sm text-success font-semibold inline-flex items-center gap-1.5 justify-center">
          <Key className="w-4 h-4" />
          Admin granted open permission
        </p>
        <p className="font-mono text-4xl tracking-[0.35em] text-white font-black">
          {code}
        </p>
        <p className="text-xs text-slate-400 leading-relaxed">
          Use this code on My deliveries to open BOX. Do not share it with the rider.
        </p>
        {active.delivery_address && (
          <p className="text-[11px] text-slate-500 truncate">{active.delivery_address}</p>
        )}
      </div>
    </Modal>
  );
}
