import {
  RWANDA_PROVINCES, PACKAGE_TYPES, EMPTY_RWANDA_ADDRESS, formatRwandaAddress,
  haversineKm,
} from '../lib/rwandaAddress';

const inputCls = 'w-full px-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm placeholder-slate-600 focus:border-primary focus:outline-none';

export function RwandaAddressFields({ title, icon: Icon, value, onChange }) {
  const set = (key, v) => onChange({ ...value, [key]: v });

  return (
    <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-3">
      <p className="text-sm font-semibold text-white flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-primary-light" />}
        {title}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">Province *</label>
          <select value={value.province} onChange={(e) => set('province', e.target.value)} className={inputCls} required>
            {RWANDA_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">District *</label>
          <input value={value.district} onChange={(e) => set('district', e.target.value)} placeholder="e.g. Gasabo" className={inputCls} required />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">Sector *</label>
          <input value={value.sector} onChange={(e) => set('sector', e.target.value)} placeholder="e.g. Kimironko" className={inputCls} required />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">Cell *</label>
          <input value={value.cell} onChange={(e) => set('cell', e.target.value)} placeholder="e.g. Kibagabaga" className={inputCls} required />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">Village *</label>
          <input value={value.village} onChange={(e) => set('village', e.target.value)} placeholder="e.g. Ubumwe" className={inputCls} required />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">Road / House No. *</label>
          <input value={value.road} onChange={(e) => set('road', e.target.value)} placeholder="e.g. KK 15 Ave, Plot 42" className={inputCls} required />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] text-slate-500 block mb-1">Landmark (optional)</label>
          <input value={value.landmark} onChange={(e) => set('landmark', e.target.value)} placeholder="Near MTN center, blue gate…" className={inputCls} />
        </div>
      </div>
    </div>
  );
}

export const INITIAL_DELIVERY_FORM = {
  package_type: 'documents',
  is_confidential: false,
  pickup: { ...EMPTY_RWANDA_ADDRESS },
  delivery: { ...EMPTY_RWANDA_ADDRESS },
  pickup_coords: null,
  delivery_coords: null,
  pickup_instructions: '',
  delivery_instructions: '',
  distance_km: '5',
  payment_method: 'momo',
};

export function buildDeliveryPayload(form) {
  const pickup_address = formatRwandaAddress(form.pickup);
  const delivery_address = formatRwandaAddress(form.delivery);
  let distance_km = parseFloat(form.distance_km) || 5;

  if (form.pickup_coords && form.delivery_coords) {
    distance_km = Math.max(1, Math.round(haversineKm(
      form.pickup_coords.lat, form.pickup_coords.lng,
      form.delivery_coords.lat, form.delivery_coords.lng,
    ) * 10) / 10);
  }

  return {
    pickup_address,
    delivery_address,
    distance_km,
    payment_method: form.payment_method,
    package_type: form.package_type,
    is_confidential: form.is_confidential,
    pickup_details: form.pickup,
    delivery_details: form.delivery,
    pickup_latitude: form.pickup_coords?.lat ?? null,
    pickup_longitude: form.pickup_coords?.lng ?? null,
    delivery_latitude: form.delivery_coords?.lat ?? null,
    delivery_longitude: form.delivery_coords?.lng ?? null,
    special_instructions: [form.pickup_instructions, form.delivery_instructions].filter(Boolean).join(' | '),
  };
}

export { PACKAGE_TYPES, formatRwandaAddress };
