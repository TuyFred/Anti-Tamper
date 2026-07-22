import { useEffect, useState, useMemo } from 'react';
import {
  Users, UserCheck, UserX, Search, Pencil, Trash2,
  Shield, Clock, UserPlus, Mail, Lock, User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import DevicePermissions from '../components/DevicePermissions';

const ROLE_LABELS = {
  admin: 'Manager',
  manager: 'Manager',
  customer: 'Customer',
  motor_rider: 'Motor Rider',
  operator: 'Operator',
  viewer: 'Viewer',
};

const ROLE_VARIANTS = {
  admin: 'primary',
  manager: 'primary',
  customer: 'success',
  motor_rider: 'warning',
  operator: 'success',
  viewer: 'neutral',
};

const EMPTY_ADD_FORM = {
  full_name: '',
  email: '',
  password: '',
  role_id: '',
  is_approved: true,
  grant_device_access: true,
  device_id: '',
  can_control: false,
};

export default function AdminPanel() {
  const { token, profile: currentProfile } = useAuth();
  const [allUsers, setAllUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [addError, setAddError] = useState('');
  const [editForm, setEditForm] = useState({ full_name: '', role_id: '', is_approved: false });

  const loadData = async () => {
    try {
      const [users, rolesList, deviceList] = await Promise.all([
        api.getUsers(token),
        api.getRoles(token),
        api.getDevices(token),
      ]);
      setAllUsers(users);
      setRoles(rolesList);
      setDevices(deviceList);

      if (!addForm.role_id && rolesList.length) {
        const customer = rolesList.find((r) => r.name === 'customer');
        setAddForm((f) => ({ ...f, role_id: customer?.id || rolesList[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const pendingUsers = allUsers.filter((u) => !u.is_approved);
  const approvedUsers = allUsers.filter((u) => u.is_approved);

  const filteredUsers = useMemo(() => {
    let list = allUsers;
    if (filter === 'pending') list = pendingUsers;
    if (filter === 'approved') list = approvedUsers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.email?.toLowerCase().includes(q) ||
          u.full_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allUsers, filter, search, pendingUsers, approvedUsers]);

  const openAddUser = () => {
    const customer = roles.find((r) => r.name === 'customer');
    setAddForm({
      ...EMPTY_ADD_FORM,
      role_id: customer?.id || roles[0]?.id || '',
      device_id: devices[0]?.id || '',
      grant_device_access: false,
    });
    setAddError('');
    setShowAddUser(true);
  };

  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({
      full_name: user.full_name || '',
      role_id: user.role_id || '',
      is_approved: user.is_approved,
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setAddError('');
    setActionLoading('create');

    try {
      await api.createUser(token, addForm);
      await loadData();
      setShowAddUser(false);
      setAddForm(EMPTY_ADD_FORM);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setActionLoading(editUser.id);
    try {
      await api.updateUser(token, editUser.id, editForm);
      await loadData();
      setEditUser(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (userId, roleId) => {
    setActionLoading(userId);
    try {
      await api.approveUser(token, userId, roleId);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId) => {
    if (!window.confirm('Reject this registration request? The account will be removed.')) return;
    setActionLoading(userId);
    try {
      await api.rejectUser(token, userId);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setActionLoading(deleteUser.id);
    try {
      await api.deleteUser(token, deleteUser.id);
      await loadData();
      setDeleteUser(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const customerRole = roles.find((r) => r.name === 'customer');
  const riderRole = roles.find((r) => r.name === 'motor_rider');
  const managerRole = roles.find((r) => r.name === 'manager') || roles.find((r) => r.name === 'admin');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          <StatCard icon={Users} label="Total users" value={allUsers.length} accent="primary" />
          <StatCard icon={Clock} label="Pending" value={pendingUsers.length} sub="Approval required" accent={pendingUsers.length > 0 ? 'warning' : 'success'} />
          <StatCard icon={UserCheck} label="Approved" value={approvedUsers.length} accent="success" />
        </div>
        <button
          onClick={openAddUser}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl transition shadow-lg shadow-primary/20 shrink-0"
        >
          <UserPlus className="w-5 h-5" />
          Add user
        </button>
      </div>

      {pendingUsers.length > 0 && (
        <section className="glass-card rounded-xl overflow-hidden border-warning/20">
          <div className="px-5 py-4 border-b border-border bg-warning/5 flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            <h3 className="font-semibold text-white">Pending requests</h3>
            <Badge variant="warning">{pendingUsers.length}</Badge>
          </div>
          <div className="divide-y divide-border">
            {pendingUsers.map((user) => (
              <div key={user.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-warning/15 border border-warning/25 flex items-center justify-center text-sm font-bold text-warning">
                    {(user.full_name || user.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-white">{user.full_name || '—'}</p>
                    <p className="text-sm text-slate-400">{user.email}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Joined {new Date(user.created_at).toLocaleDateString('en-US')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleApprove(user.id, customerRole?.id)}
                    disabled={actionLoading === user.id || !customerRole}
                    className="flex items-center gap-1.5 px-3 py-2 bg-success/15 text-success hover:bg-success/25 border border-success/25 rounded-lg text-xs font-medium transition disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Customer
                  </button>
                  <button
                    onClick={() => handleApprove(user.id, riderRole?.id)}
                    disabled={actionLoading === user.id || !riderRole}
                    className="flex items-center gap-1.5 px-3 py-2 bg-warning/15 text-warning hover:bg-warning/25 border border-warning/25 rounded-lg text-xs font-medium transition disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Motor Rider
                  </button>
                  <button
                    onClick={() => handleApprove(user.id, managerRole?.id)}
                    disabled={actionLoading === user.id || !managerRole}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary/15 text-primary-light hover:bg-primary/25 border border-primary/25 rounded-lg text-xs font-medium transition disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Manager
                  </button>
                  <button
                    onClick={() => handleReject(user.id)}
                    disabled={actionLoading === user.id}
                    className="flex items-center gap-1.5 px-3 py-2 bg-danger/15 text-danger hover:bg-danger/25 border border-danger/25 rounded-lg text-xs font-medium transition disabled:opacity-50"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-light" />
            <h3 className="font-semibold text-white">All users</h3>
          </div>
          <div className="flex flex-1 gap-3 sm:justify-end">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-surface rounded-lg border border-border text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 bg-surface rounded-lg border border-border text-sm text-white focus:border-primary focus:outline-none"
            >
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-border bg-surface/50">
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isSelf = user.id === currentProfile?.id;
                  const roleName = user.role?.name || 'viewer';
                  return (
                    <tr key={user.id} className="hover:bg-surface/30 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary-light">
                            {(user.full_name || user.email)[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {user.full_name || '—'}
                              {isSelf && <span className="text-xs text-slate-500 ml-2">(you)</span>}
                            </p>
                            <p className="text-xs text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {user.is_approved ? (
                          <Badge variant={ROLE_VARIANTS[roleName] || 'neutral'}>
                            {ROLE_LABELS[roleName] || roleName}
                          </Badge>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {user.is_approved ? (
                          <Badge variant="success">Approved</Badge>
                        ) : (
                          <Badge variant="warning">Pending</Badge>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-400 text-xs">
                        {new Date(user.created_at).toLocaleDateString('en-US', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(user)}
                            className="p-2 rounded-lg text-slate-400 hover:text-primary-light hover:bg-primary/10 transition"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => setDeleteUser(user)}
                              className="p-2 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add User Modal */}
      <Modal open={showAddUser} onClose={() => setShowAddUser(false)} title="Add new user" size="lg">
        <form onSubmit={handleCreateUser} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="John Doe"
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-surface rounded-xl border border-border text-white placeholder-slate-600 focus:border-primary focus:outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  placeholder="user@company.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-surface rounded-xl border border-border text-white placeholder-slate-600 focus:border-primary focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  placeholder="Min. 6 characters"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-surface rounded-xl border border-border text-white placeholder-slate-600 focus:border-primary focus:outline-none"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
              <select
                value={addForm.role_id}
                onChange={(e) => setAddForm({ ...addForm, role_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-surface rounded-xl border border-border text-white focus:border-primary focus:outline-none"
                required
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{ROLE_LABELS[r.name] || r.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border cursor-pointer">
              <input
                type="checkbox"
                checked={addForm.is_approved}
                onChange={(e) => setAddForm({ ...addForm, is_approved: e.target.checked })}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
              />
              <div>
                <p className="text-sm text-white">Approve immediately</p>
                <p className="text-xs text-slate-500">User can log in right away</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border cursor-pointer">
              <input
                type="checkbox"
                checked={addForm.grant_device_access}
                onChange={(e) => setAddForm({ ...addForm, grant_device_access: e.target.checked })}
                disabled={!addForm.is_approved}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30 disabled:opacity-40"
              />
              <div>
                <p className="text-sm text-white">Assign a device</p>
                <p className="text-xs text-slate-500">Link this user to a delivery box</p>
              </div>
            </label>

            {addForm.grant_device_access && addForm.is_approved && (
              <div className="space-y-3 pl-2 border-l-2 border-primary/30 ml-1">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Device</label>
                  <select
                    value={addForm.device_id}
                    onChange={(e) => setAddForm({ ...addForm, device_id: e.target.value })}
                    className="w-full px-4 py-2.5 bg-surface rounded-xl border border-border text-white focus:border-primary focus:outline-none"
                    required
                  >
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.device_id})</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl border border-primary/25 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addForm.can_control}
                    onChange={(e) => setAddForm({ ...addForm, can_control: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <p className="text-sm text-white font-medium">Authorized to unlock</p>
                    <p className="text-xs text-slate-400">Without this, opening the box triggers the reed-switch alarm</p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {addError && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">
              {addError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddUser(false)}
              className="flex-1 py-2.5 rounded-xl border border-border text-slate-400 hover:text-white hover:bg-surface-lighter transition text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading === 'create'}
              className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {actionLoading === 'create' ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create user
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit user">
        {editUser && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary-light">
                {(editUser.full_name || editUser.email)[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-white">{editUser.email}</p>
                <p className="text-xs text-slate-500">ID: {editUser.id.slice(0, 8)}...</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Full name</label>
              <input
                type="text"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full px-4 py-2.5 bg-surface rounded-xl border border-border text-white focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
              <select
                value={editForm.role_id}
                onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-surface rounded-xl border border-border text-white focus:border-primary focus:outline-none"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{ROLE_LABELS[r.name] || r.name}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.is_approved}
                onChange={(e) => setEditForm({ ...editForm, is_approved: e.target.checked })}
                disabled={editUser.id === currentProfile?.id}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
              />
              <div>
                <p className="text-sm text-white">Approved account</p>
                <p className="text-xs text-slate-500">User can access the platform</p>
              </div>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditUser(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-slate-400 hover:text-white hover:bg-surface-lighter transition text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={actionLoading === editUser.id}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {actionLoading === editUser.id ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleteUser} onClose={() => setDeleteUser(null)} title="Delete user" size="sm">
        {deleteUser && (
          <div className="space-y-5">
            <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl">
              <p className="text-sm text-white">
                Are you sure you want to delete <strong>{deleteUser.full_name || deleteUser.email}</strong>?
              </p>
              <p className="text-xs text-slate-400 mt-2">
                This action cannot be undone. The account and all associated data will be permanently removed.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteUser(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-slate-400 hover:text-white transition text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading === deleteUser.id}
                className="flex-1 py-2.5 rounded-xl bg-danger hover:bg-danger/80 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {actionLoading === deleteUser.id ? 'Deleting...' : 'Delete user'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <DevicePermissions token={token} users={allUsers} devices={devices} onUsersChanged={loadData} />
    </div>
  );
}
