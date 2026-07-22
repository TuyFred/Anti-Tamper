import { useEffect, useState } from 'react';
import {
  Shield, Package, UserPlus, Trash2, Unlock, AlertTriangle, User, Cpu, RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api';
import Badge from './ui/Badge';
import Modal from './ui/Modal';
import UserPicker from './UserPicker';
import DevicePicker from './DevicePicker';

const ACCESS_AUTHORIZED = 'authorized';
const ACCESS_UNAUTHORIZED = 'unauthorized';

const EMPTY_GRANT_FORM = {
  user_id: '',
  device_id: '',
  access_level: ACCESS_UNAUTHORIZED,
};

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

  const assignableUsers = grantUsers.filter((u) => u.role?.name !== 'admin');

  const loadAccess = async () => {
    try {
      const data = await api.getAllDeviceAccess(token);
      setAccessList(data);
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
      const userList = Array.isArray(freshUsers) ? freshUsers : [];
      const deviceList = Array.isArray(freshDevices) ? freshDevices : [];
      setGrantUsers(userList);
      setGrantDevices(deviceList);
      return { freshUsers: userList, freshDevices: deviceList };
    } catch (err) {
      setError(err.message || 'Failed to load users');
      const userList = Array.isArray(users) ? users : [];
      const deviceList = Array.isArray(devices) ? devices : [];
      setGrantUsers(userList);
      setGrantDevices(deviceList);
      return { freshUsers: userList, freshDevices: deviceList };
    } finally {
      setLoadingGrantData(false);
    }
  };

  const openGrant = async () => {
    setError('');
    setSuccessMsg('');
    setShowGrant(true);
    const { freshDevices } = await refreshGrantData();
    setGrantForm({
      user_id: '',
      device_id: freshDevices[0]?.id || devices[0]?.id || '',
      access_level: ACCESS_UNAUTHORIZED,
    });
  };

  const selectUser = (userId) => {
    setGrantForm((prev) => ({ ...prev, user_id: userId }));
    setError('');
  };

  const selectDevice = (deviceId) => {
    setGrantForm((prev) => ({ ...prev, device_id: deviceId }));
    setError('');
  };

  const handleGrant = async (e) => {
    e.preventDefault();
    if (!grantForm.user_id) {
      setError('Please click a user from the list to select them');
      return;
    }
    if (!grantForm.device_id) {
      setError('Please select a device to assign');
      return;
    }

    const isAuthorized = grantForm.access_level === ACCESS_AUTHORIZED;
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
      setSuccessMsg(
        `Access granted to ${picked?.full_name || picked?.email || 'user'} — ${
          isAuthorized ? 'Authorized (can unlock)' : 'View only'
        }`
      );
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (deviceId, userId) => {
    if (!confirm('Remove this user\'s access to the device?')) return;
    try {
      await api.revokeAccess(token, deviceId, userId);
      await loadAccess();
    } catch (err) {
      alert(err.message);
    }
  };

  const selectedUser = grantUsers.find((u) => u.id === grantForm.user_id);
  const selectedDevice = grantDevices.find((d) => d.id === grantForm.device_id);

  return (
    <section className="glass-card rounded-xl">
      <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary-light" />
          <div>
            <h3 className="font-semibold text-white">Device access & permissions</h3>
            <p className="text-xs text-slate-500">
              Select any user you created, assign a device, then choose Authorized or View only
            </p>
          </div>
        </div>
        <button
          onClick={openGrant}
          disabled={devices.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary/15 text-primary-light hover:bg-primary/25 border border-primary/25 rounded-lg text-sm font-medium transition disabled:opacity-40"
        >
          <UserPlus className="w-4 h-4" />
          Grant permission
        </button>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 p-3 bg-success/10 border border-success/30 rounded-xl text-sm text-success">
          {successMsg}
        </div>
      )}

      <div className="overflow-x-auto rounded-b-xl">
        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : accessList.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <Shield className="w-8 h-8 mx-auto mb-3 text-slate-600" />
            No assignments yet. Create users above, then click <strong className="text-slate-400">Grant permission</strong>.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-border bg-surface/50">
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Assigned device</th>
                <th className="px-5 py-3 font-medium">Access level</th>
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
                    <p className="text-white">{row.device?.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{row.device?.device_id}</p>
                  </td>
                  <td className="px-5 py-4">
                    {row.can_control ? (
                      <Badge variant="success">
                        <Unlock className="w-3 h-3 mr-1 inline" />
                        Authorized
                      </Badge>
                    ) : (
                      <Badge variant="warning">
                        <AlertTriangle className="w-3 h-3 mr-1 inline" />
                        View only
                      </Badge>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => handleRevoke(row.device_id, row.user_id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition"
                      title="Revoke access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={showGrant}
        onClose={() => setShowGrant(false)}
        title="Grant permission — select a user you created"
        size="lg"
      >
        <form onSubmit={handleGrant} className="space-y-5">
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border">
            <p className="text-xs text-slate-400">
              List shows <strong className="text-white">all users you created</strong> (operators & viewers)
            </p>
            <button
              type="button"
              onClick={refreshGrantData}
              disabled={loadingGrantData}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-primary-light hover:bg-primary/10 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingGrantData ? 'animate-spin' : ''}`} />
              Refresh list
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary-light text-xs font-bold flex items-center justify-center">1</span>
              <label className="flex items-center gap-1.5 text-sm font-medium text-white">
                <User className="w-4 h-4 text-primary-light" />
                Select user ({assignableUsers.length} in your system)
              </label>
            </div>
            <UserPicker
              users={grantUsers}
              value={grantForm.user_id}
              onChange={selectUser}
              loading={loadingGrantData}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary-light text-xs font-bold flex items-center justify-center">2</span>
              <label className="flex items-center gap-1.5 text-sm font-medium text-white">
                <Cpu className="w-4 h-4 text-primary-light" />
                Assign device
              </label>
            </div>
            <DevicePicker
              devices={grantDevices.length ? grantDevices : devices}
              value={grantForm.device_id}
              onChange={selectDevice}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary-light text-xs font-bold flex items-center justify-center">3</span>
              <label className="text-sm font-medium text-white">Access level</label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition ${
                  grantForm.access_level === ACCESS_AUTHORIZED
                    ? 'bg-success/10 border-success ring-2 ring-success/30'
                    : 'bg-surface border-border hover:border-slate-600'
                }`}
              >
                <input type="radio" name="access_level" value={ACCESS_AUTHORIZED}
                  checked={grantForm.access_level === ACCESS_AUTHORIZED}
                  onChange={(e) => setGrantForm((p) => ({ ...p, access_level: e.target.value }))}
                  className="sr-only" />
                <div className="flex items-center gap-2">
                  <Unlock className="w-5 h-5 text-success" />
                  <p className="text-sm font-bold text-white">Authorized</p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Can unlock from dashboard — reed open within 60s = no tamper alarm</p>
              </label>
              <label
                className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition ${
                  grantForm.access_level === ACCESS_UNAUTHORIZED
                    ? 'bg-warning/10 border-warning ring-2 ring-warning/30'
                    : 'bg-surface border-border hover:border-slate-600'
                }`}
              >
                <input type="radio" name="access_level" value={ACCESS_UNAUTHORIZED}
                  checked={grantForm.access_level === ACCESS_UNAUTHORIZED}
                  onChange={(e) => setGrantForm((p) => ({ ...p, access_level: e.target.value }))}
                  className="sr-only" />
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  <p className="text-sm font-bold text-white">View only</p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Cannot unlock from dashboard. Reed open triggers tamper alarm + buzzer.
                </p>
              </label>
            </div>
          </div>

          {selectedUser && selectedDevice ? (
            <div className="p-4 bg-success/5 rounded-xl border border-success/30">
              <p className="text-xs text-success font-bold uppercase mb-2">Ready to save</p>
              <p className="text-sm text-white">
                <strong>{selectedUser.full_name || selectedUser.email}</strong>
                {' → '}
                <span className="font-mono">{selectedDevice.device_id}</span>
                {' → '}
                <span className={grantForm.access_level === ACCESS_AUTHORIZED ? 'text-success' : 'text-warning'}>
                  {grantForm.access_level === ACCESS_AUTHORIZED ? 'Authorized' : 'View only'}
                </span>
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-surface border border-border text-xs text-slate-500 text-center">
              {!grantForm.user_id ? 'Step 1: Click a user from the list above' : 'Step 2: Click a device'}
            </div>
          )}

          {error && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">{error}</div>
          )}

          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="button" onClick={() => setShowGrant(false)}
              className="flex-1 py-3 rounded-xl border border-border text-slate-400 hover:text-white text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving || !grantForm.user_id || !grantForm.device_id}
              className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  Save permission
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
