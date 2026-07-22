import { useMemo, useState } from 'react';
import { Search, Cpu, Check, Radio } from 'lucide-react';
import Badge from './ui/Badge';

export default function DevicePicker({ devices = [], value, onChange }) {
  const [search, setSearch] = useState('');

  const selected = useMemo(
    () => devices.find((d) => d.id === value),
    [devices, value],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.device_id?.toLowerCase().includes(q),
    );
  }, [devices, search]);

  if (devices.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-4 text-center">
        No devices registered yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search devices…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-surface rounded-xl border border-border text-white text-sm placeholder-slate-600 focus:border-primary focus:outline-none"
        />
      </div>

      {selected && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/25">
          <Cpu className="w-5 h-5 text-primary-light shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{selected.name}</p>
            <p className="text-xs text-slate-400 font-mono">{selected.device_id}</p>
          </div>
          <Badge variant={selected.is_online ? 'success' : 'neutral'}>
            {selected.is_online ? 'Online' : 'Offline'}
          </Badge>
        </div>
      )}

      <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-border p-1">
        {filtered.map((device) => {
          const active = device.id === value;
          return (
            <button
              key={device.id}
              type="button"
              onClick={() => onChange(device.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition ${
                active
                  ? 'bg-primary/15 border border-primary/25'
                  : 'hover:bg-surface-lighter border border-transparent'
              }`}
            >
              <Radio className={`w-4 h-4 shrink-0 ${active ? 'text-primary-light' : 'text-slate-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{device.name}</p>
                <p className="text-xs text-slate-500 font-mono">{device.device_id}</p>
              </div>
              {active && <Check className="w-4 h-4 text-primary-light shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
