import { useMemo } from 'react';
import {
  RWANDA_PROVINCES,
  getDistricts,
  getSectors,
  getCells,
  getVillages,
  getRoadOptions,
  resetBelow,
} from '../data/rwandaAdmin';

const inputCls = 'w-full px-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm focus:border-primary focus:outline-none';

function SelectField({ label, value, options, onChange, required, disabled, placeholder }) {
  return (
    <div>
      <label className="text-[11px] text-slate-500 block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        required={required}
        disabled={disabled}
      >
        <option value="">{placeholder || 'Select…'}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

export function RwandaAddressFields({ title, icon: Icon, value, onChange }) {
  const districts = useMemo(() => getDistricts(value.province), [value.province]);
  const sectors = useMemo(
    () => getSectors(value.province, value.district),
    [value.province, value.district],
  );
  const cells = useMemo(
    () => getCells(value.province, value.district, value.sector),
    [value.province, value.district, value.sector],
  );
  const villages = useMemo(
    () => getVillages(value.province, value.district, value.sector, value.cell),
    [value.province, value.district, value.sector, value.cell],
  );
  const roads = useMemo(() => getRoadOptions(value.province), [value.province]);

  const setProvince = (province) => onChange(resetBelow({ ...value, province }, 'province'));
  const setDistrict = (district) => onChange(resetBelow({ ...value, district }, 'district'));
  const setSector = (sector) => onChange(resetBelow({ ...value, sector }, 'sector'));
  const setCell = (cell) => onChange(resetBelow({ ...value, cell }, 'cell'));
  const setVillage = (village) => onChange({ ...value, village });
  const setRoad = (road) => onChange({ ...value, road });
  const setLandmark = (landmark) => onChange({ ...value, landmark });

  const roadIsCustom = value.road && !roads.includes(value.road);

  return (
    <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-3">
      <p className="text-sm font-semibold text-white flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-primary-light" />}
        {title}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SelectField
          label="Province *"
          value={value.province}
          options={RWANDA_PROVINCES}
          onChange={setProvince}
          required
        />
        <SelectField
          label="District *"
          value={value.district}
          options={districts}
          onChange={setDistrict}
          required
          disabled={!value.province}
          placeholder={value.province ? 'Select district' : 'Select province first'}
        />
        <SelectField
          label="Sector *"
          value={value.sector}
          options={sectors}
          onChange={setSector}
          required
          disabled={!value.district}
        />
        <SelectField
          label="Cell *"
          value={value.cell}
          options={cells}
          onChange={setCell}
          required
          disabled={!value.sector}
        />
        <SelectField
          label="Village *"
          value={value.village}
          options={villages}
          onChange={setVillage}
          required
          disabled={!value.cell}
        />
        <SelectField
          label="Road / Street *"
          value={roadIsCustom ? 'Other — type below' : value.road}
          options={roads}
          onChange={(r) => setRoad(r === 'Other — type below' ? '' : r)}
          required={!roadIsCustom}
          disabled={!value.village}
        />
        {(roadIsCustom || value.road === '') && value.village && (
          <div className="sm:col-span-2">
            <label className="text-[11px] text-slate-500 block mb-1">Road / House No. *</label>
            <input
              value={value.road}
              onChange={(e) => setRoad(e.target.value)}
              placeholder="e.g. KK 15 Ave, Plot 42"
              className={inputCls}
              required
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="text-[11px] text-slate-500 block mb-1">Landmark (optional)</label>
          <input
            value={value.landmark}
            onChange={(e) => setLandmark(e.target.value)}
            placeholder="Near MTN center, blue gate…"
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}

export { RWANDA_PROVINCES };
