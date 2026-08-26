import { useEffect, useState, useMemo, useCallback } from 'react';

import { Package, MapPin, Lock, Loader2 } from 'lucide-react';

import Modal from './ui/Modal';

import LocationMapPicker from './LocationMapPicker';

import {

  RwandaAddressFields,

  PACKAGE_TYPES,

  INITIAL_DELIVERY_FORM,

  buildDeliveryPayload,

  formatRwandaAddress,

  validateDeliveryForm,

} from './DeliveryRequestForm';

import { formatPrice } from '../lib/deliveryUtils';

import { coordsFromRwandaAddress } from '../lib/geocode';
import { fetchRoadRoute, roadKmOrHaversine } from '../lib/roadRouting';



const inputCls = 'w-full px-3 py-2 bg-surface rounded-xl border border-border text-white text-sm placeholder-slate-600 focus:border-primary focus:outline-none';



export function DeliveryRequestForm({
  form, setForm, onSubmit, submitting, error, estimate, computedKm,
  roadLoading = false,
  setDeliveryCoords,
}) {

  return (

    <form onSubmit={onSubmit} className="space-y-5">

      <div>

        <label className="text-xs font-medium text-slate-400 mb-2 block">Package</label>

        <div className="flex flex-wrap gap-2">

          {PACKAGE_TYPES.map((pt) => (

            <label

              key={pt.value}

              className={`px-3 py-2 rounded-lg border text-sm font-medium cursor-pointer transition ${

                form.package_type === pt.value

                  ? 'border-primary bg-primary/10 text-white'

                  : 'border-border bg-surface text-slate-400 hover:border-slate-600'

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

              {pt.label}

            </label>

          ))}

        </div>

        <label className="mt-2 flex items-center gap-2 text-sm text-slate-300 cursor-pointer">

          <input

            type="checkbox"

            checked={form.is_confidential}

            onChange={(e) => setForm({

              ...form,

              is_confidential: e.target.checked,

              package_type: e.target.checked ? 'confidential' : form.package_type,

            })}

            className="w-4 h-4 rounded"

          />

          <Lock className="w-3.5 h-3.5 text-warning" />

          Confidential

        </label>

      </div>



      <div className="space-y-3">

        <p className="text-xs font-semibold uppercase tracking-wide text-success">Pickup</p>

        <RwandaAddressFields title="Address" icon={MapPin} value={form.pickup} onChange={(pickup) => setForm({ ...form, pickup })} />

        <textarea

          value={form.pickup_instructions}

          onChange={(e) => setForm({ ...form, pickup_instructions: e.target.value })}

          placeholder="Pickup notes (optional)"

          className={`${inputCls} min-h-[60px]`}

        />

      </div>



      <div className="space-y-3">

        <p className="text-xs font-semibold uppercase tracking-wide text-primary-light">Delivery</p>

        <RwandaAddressFields title="Address" icon={MapPin} value={form.delivery} onChange={(delivery) => setForm({ ...form, delivery })} />

        <LocationMapPicker label="Pin delivery on map (optional)" position={form.delivery_coords} onChange={setDeliveryCoords} pinColor="#3b82f6" rwandaAddress={form.delivery} />

        <textarea

          value={form.delivery_instructions}

          onChange={(e) => setForm({ ...form, delivery_instructions: e.target.value })}

          placeholder="Delivery notes (optional)"

          className={`${inputCls} min-h-[60px]`}

        />

      </div>



      <p className="text-[11px] text-slate-500 px-1">

        After you submit, choose MoMo or Bank and upload payment proof on your order.

      </p>



      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border text-sm">

        <div className="min-w-0 flex-1">

          <p className="text-slate-500 text-xs truncate">{formatRwandaAddress(form.pickup) || 'Pickup…'}</p>

          <p className="text-white truncate mt-0.5">{formatRwandaAddress(form.delivery) || 'Delivery…'}</p>

        </div>

        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500">
            {roadLoading ? 'Calculating route…' : `${Number(computedKm).toFixed(1)} km`} · by road
          </p>
          <p className="text-lg font-bold text-white">
            {roadLoading ? '…' : estimate ? formatPrice(estimate.calculated_price, estimate.currency) : '—'}
          </p>
        </div>

      </div>



      {error && (

        <div className="p-3 bg-danger/10 border border-danger/25 rounded-xl text-sm text-danger">{error}</div>

      )}



      <button

        type="submit"

        disabled={submitting}

        className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-white rounded-xl font-semibold disabled:opacity-50 touch-manipulation"

      >

        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}

        Submit request

      </button>

    </form>

  );

}



export default function DeliveryBookingModal({ open, onClose, onSubmit, estimateApi, submitting: externalSubmitting }) {

  const [form, setForm] = useState({ ...INITIAL_DELIVERY_FORM });

  const [estimate, setEstimate] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState('');



  const setDeliveryCoords = useCallback((delivery_coords) => {

    setForm((prev) => ({ ...prev, delivery_coords }));

  }, []);



  const [roadKm, setRoadKm] = useState(null);

  const [roadLoading, setRoadLoading] = useState(false);



  const pickupPoint = form.pickup_coords || coordsFromRwandaAddress(form.pickup);

  const deliveryPoint = form.delivery_coords || coordsFromRwandaAddress(form.delivery);



  useEffect(() => {

    if (!pickupPoint || !deliveryPoint) {

      setRoadKm(parseFloat(form.distance_km) || 5);

      return undefined;

    }

    let cancelled = false;

    setRoadLoading(true);

    fetchRoadRoute(pickupPoint, deliveryPoint).then((route) => {

      if (cancelled) return;

      setRoadKm(route?.distanceKm ?? roadKmOrHaversine(pickupPoint, deliveryPoint));

      setRoadLoading(false);

    }).catch(() => {

      if (!cancelled) {

        setRoadKm(roadKmOrHaversine(pickupPoint, deliveryPoint));

        setRoadLoading(false);

      }

    });

    return () => { cancelled = true; };

  }, [pickupPoint?.lat, pickupPoint?.lng, deliveryPoint?.lat, deliveryPoint?.lng, form.distance_km]);



  const computedKm = roadKm ?? (parseFloat(form.distance_km) || 5);



  useEffect(() => {

    if (!open) return;

    estimateApi({ distance_km: computedKm }).then(setEstimate).catch(() => {});

  }, [computedKm, estimateApi, open]);



  useEffect(() => {

    if (!open) {

      setError('');

      return;

    }

    setForm({

      ...INITIAL_DELIVERY_FORM,

      pickup: { ...INITIAL_DELIVERY_FORM.pickup },

      delivery: { ...INITIAL_DELIVERY_FORM.delivery },

    });

  }, [open]);



  const handleSubmit = async (e) => {

    e.preventDefault();

    const validationError = validateDeliveryForm(form);

    if (validationError) {

      setError(validationError);

      return;

    }

    setSubmitting(true);

    setError('');

    try {

      const payload = buildDeliveryPayload({ ...form, distance_km: String(computedKm) });

      await onSubmit(payload);

      onClose();

    } catch (err) {

      setError(err.message);

    } finally {

      setSubmitting(false);

    }

  };



  const busy = submitting || externalSubmitting;



  return (

    <Modal open={open} onClose={onClose} title="New delivery" size="xl">

      <DeliveryRequestForm
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        submitting={busy}
        error={error}
        estimate={estimate}
        computedKm={computedKm}
        roadLoading={roadLoading}
        setDeliveryCoords={setDeliveryCoords}
      />

    </Modal>

  );

}

