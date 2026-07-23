import { Link } from 'react-router-dom';
import {
  CreditCard, Smartphone, Building2, Upload, Clock, CheckCircle2,
  Truck, Loader2, Radio, MapPin,
} from 'lucide-react';
import { formatPrice } from '../lib/deliveryUtils';

const STEPS = [
  { key: 'awaiting_payment', label: 'Pay', icon: CreditCard },
  { key: 'payment_submitted', label: 'Proof', icon: Upload },
  { key: 'payment_verified', label: 'Paid', icon: CheckCircle2 },
  { key: 'in_transit', label: 'Track', icon: Truck },
  { key: 'delivered', label: 'Done', icon: CheckCircle2 },
];

function stepIndex(status) {
  if (status === 'awaiting_payment') return 0;
  if (status === 'payment_submitted') return 1;
  if (status === 'payment_verified') return 2;
  if (status === 'rider_assigned') return 2;
  if (status === 'in_transit') return 3;
  if (status === 'delivered') return 4;
  return 0;
}

export function DeliveryProgressBar({ status }) {
  const current = stepIndex(status);
  const isRiderAssigned = status === 'rider_assigned';

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STEPS.map((step, i) => {
        const done = i < current || (i === 2 && isRiderAssigned && current >= 2);
        const active = i === current || (i === 2 && isRiderAssigned);
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center gap-1 shrink-0">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide ${
              done ? 'bg-success/15 text-success' : active ? 'bg-primary/15 text-primary-light' : 'bg-surface text-slate-600'
            }`}>
              <Icon className="w-3 h-3" />
              {step.label}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-4 h-0.5 rounded ${done ? 'bg-success/40' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DeliveryPaymentStep({
  delivery,
  config,
  paymentMethod,
  onPaymentMethodChange,
  proofFile,
  onProofFileChange,
  onSubmitProof,
  uploading,
}) {
  const method = paymentMethod || delivery.payment_method || 'momo';
  const isAwaiting = delivery.status === 'awaiting_payment';
  const isSubmitted = delivery.status === 'payment_submitted';
  const isPaid = ['payment_verified', 'rider_assigned', 'in_transit', 'delivered'].includes(delivery.status);

  if (isPaid) {
    return (
      <div className="p-3 rounded-xl bg-success/10 border border-success/30 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-success flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Paid
        </p>
        {['payment_verified', 'rider_assigned', 'in_transit'].includes(delivery.status) && (
          <Link to="/tracking" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-light hover:underline">
            <Radio className="w-3.5 h-3.5" />
            Track
          </Link>
        )}
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="p-3 rounded-xl bg-warning/10 border border-warning/30">
        <p className="text-sm font-semibold text-warning flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Pending
        </p>
      </div>
    );
  }

  if (!isAwaiting || !config) return null;

  return (
    <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
      <p className="text-sm font-semibold text-white">
        Pay {formatPrice(delivery.calculated_price, delivery.currency)}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPaymentMethodChange('momo')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition ${
            method === 'momo' ? 'border-success bg-success/10 text-white' : 'border-border text-slate-400'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          MoMo
        </button>
        <button
          type="button"
          onClick={() => onPaymentMethodChange('bank')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition ${
            method === 'bank' ? 'border-primary bg-primary/10 text-white' : 'border-border text-slate-400'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Bank
        </button>
      </div>

      {method === 'momo' && (
        <div className="p-3 rounded-lg bg-success/5 border border-success/25">
          <p className="text-lg font-mono font-bold text-white">{config.payment.momoNumber}</p>
          <p className="text-xs text-slate-400 mt-0.5">{config.payment.momoName}</p>
        </div>
      )}

      {method === 'bank' && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/25 text-sm">
          <p className="text-white">{config.payment.bankName}</p>
          <p className="font-mono font-bold text-white">{config.payment.bankAccount}</p>
          <p className="text-xs text-slate-400">{config.payment.bankAccountName}</p>
        </div>
      )}

      <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 cursor-pointer transition">
        <Upload className="w-5 h-5 text-slate-500" />
        <span className="text-xs text-slate-400">{proofFile ? proofFile.name : 'Upload payment proof'}</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onProofFileChange(e.target.files?.[0] || null)} />
      </label>

      <button
        type="button"
        onClick={onSubmitProof}
        disabled={uploading || !proofFile}
        className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? 'Uploading…' : 'Submit proof'}
      </button>
    </div>
  );
}

export function DeliveryArrivedBanner({ delivery }) {
  if (!['rider_assigned', 'in_transit'].includes(delivery.status)) return null;

  return (
    <div className="p-3 rounded-xl bg-primary/10 border border-primary/25 flex items-start gap-2">
      <MapPin className="w-4 h-4 text-primary-light shrink-0 mt-0.5" />
      <p className="text-xs text-slate-300">{delivery.delivery_address}</p>
    </div>
  );
}
