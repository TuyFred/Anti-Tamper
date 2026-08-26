import { useState } from 'react';
import { Package, Plus, Pencil, Trash2, MapPin, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { MAP_LABELS } from '../lib/mapConfig';
import { isLocationFresh } from '../lib/geocode';
import Modal from './ui/Modal';
import Badge from './ui/Badge';

const inputCls = 'w-full px-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm focus:border-primary focus:outline-none font-mono';

const EMPTY_FORM = { device_id: '', name: '', description: '' };

function formatCoords(lat, lng) {
  if (lat == null || lng == null) return '—';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default function DeviceRegistry({ token, devices = [], onChanged }) {
  const [showForm, setShowForm] = useState(false);
  const [editDevice, setEditDevice] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditDevice(null);
    setForm({ ...EMPTY_FORM, device_id: 'BOX-', name: 'Smart Box ' });
    setError('');
    setShowForm(true);
  };

  const openEdit = (device) => {
    setEditDevice(device);
    setForm({
      device_id: device.device_id || '',
      name: device.name || '',
      description: device.description || '',
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hardwareId = form.device_id.trim().toUpperCase();
    const name = form.name.trim();
    if (!hardwareId || !name) {
      setError('Hardware ID and name are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editDevice) {
        await api.updateDevice(token, editDevice.id, {
          device_id: hardwareId,
          name,
          description: form.description?.trim() || null,
        });
      } else {
        await api.createDevice(token, {
          device_id: hardwareId,
          name,
          description: form.description?.trim() || null,
        });
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      await onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClearLocation = async (device) => {
    if (!window.confirm(`Clear stored GPS for ${device.device_id}? Map will update when hardware sends new GPS.`)) {
      return;
    }
    setSaving(true);
    try {
      await api.updateDevice(token, device.id, { clear_location: true });
      await onChanged?.();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass-card rounded-xl">
      <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-light" />
            <h3 className="font-semibold text-white">Smart Boxes (register by hardware ID)</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            {MAP_LABELS.registerDeviceHint}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/15 text-primary-light border border-primary/25 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Register box
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="p-10 text-center text-slate-500 text-sm">
          No Smart Boxes yet. Register <span className="font-mono text-slate-400">BOX-001</span> to match your ESP32 firmware.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-border bg-surface/50">
                <th className="px-5 py-3 font-medium">{MAP_LABELS.deviceIdLabel}</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">GPS</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {devices.map((device) => {
                const hasGps = device.latitude != null && device.longitude != null;
                const fresh = hasGps && isLocationFresh(device.last_seen);
                return (
                  <tr key={device.id} className="hover:bg-surface/30">
                    <td className="px-5 py-4 font-mono text-primary-light">{device.device_id}</td>
                    <td className="px-5 py-4 text-white">{device.name}</td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-400">
                      {hasGps ? formatCoords(device.latitude, device.longitude) : MAP_LABELS.noGpsForDevice}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {device.is_online && fresh ? (
                          <Badge variant="success"><Radio className="w-3 h-3 mr-1 inline" />{MAP_LABELS.live}</Badge>
                        ) : hasGps ? (
                          <Badge variant="warning">{MAP_LABELS.lastKnownPosition}</Badge>
                        ) : (
                          <Badge variant="neutral">{MAP_LABELS.offline}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          to="/tracking"
                          className="p-2 rounded-lg text-slate-400 hover:text-primary-light hover:bg-primary/10"
                          title="View on live map"
                        >
                          <MapPin className="w-4 h-4" />
                        </Link>
                        <button type="button" onClick={() => openEdit(device)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-lighter">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {hasGps && (
                          <button
                            type="button"
                            onClick={() => handleClearLocation(device)}
                            disabled={saving}
                            className="p-2 rounded-lg text-slate-400 hover:text-warning hover:bg-warning/10"
                            title="Clear wrong/old GPS"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editDevice ? `Edit ${editDevice.device_id}` : 'Register Smart Box'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">{MAP_LABELS.deviceIdLabel} (firmware must match)</label>
            <input
              type="text"
              value={form.device_id}
              onChange={(e) => setForm({ ...form, device_id: e.target.value.toUpperCase() })}
              placeholder="BOX-001"
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Display name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Smart Box 1"
              className="w-full px-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm focus:border-primary focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Notes (optional)</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm focus:border-primary focus:outline-none"
            />
          </div>
          {error && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">{error}</div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-border text-slate-400 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50">
              {saving ? 'Saving…' : editDevice ? 'Save changes' : 'Register'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
