import { useEffect, useState, useMemo } from 'react';
import {
  Package, MapPin, ArrowRight, Shield, Lock, Loader2, Info, Truck,
} from 'lucide-react';
import LocationMapPicker from './LocationMapPicker';
import {
  RwandaAddressFields,
  PACKAGE_TYPES,
  INITIAL_DELIVERY_FORM,
  buildDeliveryPayload,
  formatRwandaAddress,
} from './DeliveryRequestForm';
import { formatPrice } from '../lib/deliveryUtils';
import { haversineKm } from '../lib/rwandaAddress';

export default function DeliveryRequestFormSection({ onSubmit, estimateApi }) {
  const [form, setForm] = useState({ ...INITIAL_DELIVERY_FORM });
  const [estimate, setEstimate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const computedKm = useMemo(() => {
    if (form.pickup_coords && form.delivery_coords) {
      return Math.max(1, Math.round(haversineKm(
        form.pickup_coords.lat, form.pickup_coords.lng,
        form.delivery_coords.lat, form.delivery_coords.lng,
      ) * 10) / 10);
    }
    return parseFloat(form.distance_km) || 5;
  }, [form.pickup_coords, form.delivery_coords, form.distance_km]);

  useEffect(() => {
    estimateApi({ distance_km: computedKm }).then(setEstimate).catch(() => {});
  }, [computedKm, estimateApi]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = buildDeliveryPayload({ ...form, distance_km: String(computedKm) });
      await onSubmit(payload);
      setForm({ ...INITIAL_DELIVERY_FORM, pickup: { ...INITIAL_DELIVERY_FORM.pickup }, delivery: { ...INITIAL_DELIVERY_FORM.delivery } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="glass-card rounded-xl p-6 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-primary-light" />
          Request a delivery
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Tell us what you send, where we pick up (A), and where we deliver (B). Rwanda full address + OpenStreetMap pin.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex gap-3">
        <Info className="w-5 h-5 text-primary-light shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 leading-relaxed">
          <strong className="text-white">How we deliver:</strong> Your item goes inside a locked anti-tamper Smart Box.
          A motor rider carries it with live GPS. You pay via MoMo or bank, manager verifies, then you receive a token to unlock at delivery.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Package type */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-white">What are you sending? *</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {PACKAGE_TYPES.map((pt) => (
              <label
                key={pt.value}
                className={`p-3 rounded-xl border-2 cursor-pointer transition ${
                  form.package_type === pt.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-surface hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="package_type"
                  value={pt.value}
                  checked={form.package_type === pt.value}
                  onChange={(e) => setForm({ ...form, package_type: e.target.value })}
                  className="sr-only"
                />
                <p className="text-sm font-semibold text-white">{pt.label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{pt.desc}</p>
              </label>
            ))}
          </div>
          <label className="flex items-center gap-3 p-3 rounded-xl bg-warning/5 border border-warning/20 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_confidential}
              onChange={(e) => setForm({ ...form, is_confidential: e.target.checked, package_type: e.target.checked ? 'confidential' : form.package_type })}
              className="w-4 h-4 rounded"
            />
            <div>
              <p className="text-sm text-white flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-warning" />
                Confidential / secret shipment
              </p>
              <p className="text-xs text-slate-500">Extra security — sealed Smart Box, tamper alarm if opened</p>
            </div>
          </label>
        </div>

        {/* Pickup A */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-success flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Pickup — Location A (where we collect)
          </h4>
          <RwandaAddressFields
            title="Pickup address (Rwanda administrative format)"
            icon={MapPin}
            value={form.pickup}
            onChange={(pickup) => setForm({ ...form, pickup })}
          />
          <LocationMapPicker
            label="Pin pickup on map"
            position={form.pickup_coords}
            onChange={(pickup_coords) => setForm({ ...form, pickup_coords })}
            pinColor="#10b981"
          />
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">Pickup instructions</label>
            <textarea
              value={form.pickup_instructions}
              onChange={(e) => setForm({ ...form, pickup_instructions: e.target.value })}
              placeholder="Contact person, gate code, best time to collect…"
              className="w-full px-3 py-2 bg-surface rounded-xl border border-border text-white text-sm min-h-[70px]"
            />
          </div>
        </div>

        <div className="flex justify-center">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border text-xs text-slate-400">
            <Truck className="w-4 h-4 text-primary-light" />
            Smart Box secured in transit
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Delivery B */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-primary-light flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Delivery — Location B (where customer receives)
          </h4>
          <RwandaAddressFields
            title="Delivery address (Rwanda administrative format)"
            icon={MapPin}
            value={form.delivery}
            onChange={(delivery) => setForm({ ...form, delivery })}
          />
          <LocationMapPicker
            label="Pin delivery on map"
            position={form.delivery_coords}
            onChange={(delivery_coords) => setForm({ ...form, delivery_coords })}
            pinColor="#3b82f6"
          />
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">Delivery instructions</label>
            <textarea
              value={form.delivery_instructions}
              onChange={(e) => setForm({ ...form, delivery_instructions: e.target.value })}
              placeholder="Who receives, phone number, building floor…"
              className="w-full px-3 py-2 bg-surface rounded-xl border border-border text-white text-sm min-h-[70px]"
            />
          </div>
        </div>

        {/* Payment method */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-white">How will you pay? *</label>
          <div className="flex flex-wrap gap-3">
            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition ${
              form.payment_method === 'momo' ? 'border-success bg-success/10' : 'border-border bg-surface'
            }`}>
              <input
                type="radio"
                name="payment_method"
                value="momo"
                checked={form.payment_method === 'momo'}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="sr-only"
              />
              <span className="text-sm text-white">MoMo Pay</span>
            </label>
            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition ${
              form.payment_method === 'bank' ? 'border-primary bg-primary/10' : 'border-border bg-surface'
            }`}>
              <input
                type="radio"
                name="payment_method"
                value="bank"
                checked={form.payment_method === 'bank'}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="sr-only"
              />
              <span className="text-sm text-white">Bank transfer</span>
            </label>
          </div>
        </div>

        {/* Summary + price */}
        <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl bg-surface border border-border">
          <div>
            <p className="text-xs text-slate-500 mb-1">Route summary</p>
            <p className="text-sm text-white">{formatRwandaAddress(form.pickup) || '—'}</p>
            <ArrowRight className="w-4 h-4 text-slate-600 my-1" />
            <p className="text-sm text-white">{formatRwandaAddress(form.delivery) || '—'}</p>
          </div>
          <div className="flex flex-col justify-center items-start sm:items-end">
            <p className="text-xs text-slate-500">Distance · {computedKm} km</p>
            <p className="text-2xl font-bold text-white mt-1">
              {estimate ? formatPrice(estimate.calculated_price, estimate.currency) : '—'}
            </p>
            {form.is_confidential && (
              <span className="text-xs text-warning flex items-center gap-1 mt-1">
                <Shield className="w-3 h-3" /> Confidential handling
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/25 rounded-xl text-sm text-danger">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-primary text-white rounded-xl font-semibold disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
          Submit delivery request
        </button>
      </form>
    </section>
  );
}
