import { useEffect, useState } from 'react';
import { Shield, Package, UserPlus, Trash2, Unlock, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import Badge from './ui/Badge';
import Modal from './ui/Modal';

const EMPTY_GRANT_FORM = {
  user_id: '',
  device_id: '',
  access_level: 'view',
};

const inputCls = 'w-full px-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm focus:border-primary focus:outline-none';

export default function DevicePermissions({ token, users = [], devices = [], onUsersChanged }) {
  const [accessList, setAccessList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGrant, setShowGrant] = useState(false);
  const [grantForm, setGrantForm] = useState(EMPTY_GRANT_FORM);
  const [grantUsers, setGrantUsers] = useState([]);
  const [grantDevices, setGrantDevices] = useState([]);
  const [loadingGrantData, setLoadingGrantData] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAccess = async () => {
    try {
      setAccessList(await api.getAllDeviceAccess(token));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadAccess();
  }, [token]);

  const refreshGrantData = async () => {
    setLoadingGrantData(true);
    try {
      const [freshUsers, freshDevices] = await Promise.all([
        api.getUsers(token),
        api.getDevices(token),
      ]);
      setGrantUsers(Array.isArray(freshUsers) ? freshUsers.filter((u) => u.is_approved) : []);
      setGrantDevices(Array.isArray(freshDevices) ? freshDevices : []);
    } catch (err) {
      setError(err.message);
      setGrantUsers(Array.isArray(users) ? users.filter((u) => u.is_approved) : []);
      setGrantDevices(Array.isArray(devices) ? devices : []);
    } finally {
      setLoadingGrantData(false);
    }
  };

  const openGrant = async () => {
    setError('');
    setSuccessMsg('');
    setShowGrant(true);
    await refreshGrantData();
    setGrantForm({ ...EMPTY_GRANT_FORM, device_id: devices[0]?.id || '' });
  };

  const handleGrant = async (e) => {
    e.preventDefault();
    if (!grantForm.user_id || !grantForm.device_id) {
      setError('Select user and device');
      return;
    }

    const isAuthorized = grantForm.access_level === 'unlock';
    setSaving(true);
    setError('');
    try {
      await api.grantAccess(token, grantForm.device_id, {
        user_id: grantForm.user_id,
        can_view: true,
        can_control: isAuthorized,
      });
      await loadAccess();
      if (onUsersChanged) await onUsersChanged();
      setShowGrant(false);
      const picked = grantUsers.find((u) => u.id === grantForm.user_id);
      setSuccessMsg(`Permission saved for ${picked?.full_name || picked?.email || 'user'}`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (deviceId, userId) => {
    if (!confirm('Remove access?')) return;
    try {
      await api.revokeAccess(token, deviceId, userId);
      await loadAccess();
    } catch (err) {
      alert(err.message);
    }
  };

  const roleLabel = (name) => ({
    customer: 'Customer',
    motor_rider: 'Rider',
    manager: 'Manager',
    admin: 'Admin',
  }[name] || name);

  return (
    <section className="glass-card rounded-xl">
      <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary-light" />
          <h3 className="font-semibold text-white">Box permissions</h3>
        </div>
        <button
          type="button"
          onClick={openGrant}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/15 text-primary-light border border-primary/25 rounded-lg text-sm font-medium transition"
        >
          <UserPlus className="w-4 h-4" />
          Grant permission
        </button>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 p-3 bg-success/10 border border-success/30 rounded-xl text-sm text-success">{successMsg}</div>
      )}

      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : accessList.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">No permissions yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-border bg-surface/50">
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Device</th>
                <th className="px-5 py-3 font-medium">Access</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {accessList.map((row) => (
                <tr key={row.id} className="hover:bg-surface/30">
                  <td className="px-5 py-4">
                    <p className="text-white">{row.user?.full_name || '—'}</p>
                    <p className="text-xs text-slate-400">{row.user?.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-white font-mono text-xs">{row.device?.device_id}</p>
                  </td>
                  <td className="px-5 py-4">
                    {row.can_control ? (
                      <Badge variant="success"><Unlock className="w-3 h-3 mr-1 inline" />Can unlock</Badge>
                    ) : (
                      <Badge variant="warning"><AlertTriangle className="w-3 h-3 mr-1 inline" />View only</Badge>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button type="button" onClick={() => handleRevoke(row.device_id, row.user_id)} className="p-2 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showGrant} onClose={() => setShowGrant(false)} title="Grant permission" size="md">
        <form onSubmit={handleGrant} className="space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={refreshGrantData} disabled={loadingGrantData} className="flex items-center gap-1 text-xs text-primary-light">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingGrantData ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">User</label>
            <select
              value={grantForm.user_id}
              onChange={(e) => setGrantForm({ ...grantForm, user_id: e.target.value })}
              className={inputCls}
              required
            >
              <option value="">Select user</option>
              {grantUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email} — {roleLabel(u.role?.name)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Smart Box</label>
            <select
              value={grantForm.device_id}
              onChange={(e) => setGrantForm({ ...grantForm, device_id: e.target.value })}
              className={inputCls}
              required
            >
              <option value="">Select device</option>
              {(grantDevices.length ? grantDevices : devices).map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.device_id})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Permission</label>
            <select
              value={grantForm.access_level}
              onChange={(e) => setGrantForm({ ...grantForm, access_level: e.target.value })}
              className={inputCls}
            >
              <option value="view">View only</option>
              <option value="unlock">Can unlock</option>
            </select>
          </div>

          {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">{error}</div>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowGrant(false)} className="flex-1 py-2.5 rounded-xl border border-border text-slate-400 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Shield className="w-4 h-4" />}
              Save
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
