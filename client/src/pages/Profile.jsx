import { useState, useEffect } from 'react';
import { User, Mail, Phone, Lock, Loader2, Shield, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatDeliveryDateTime } from '../lib/deliveryUtils';
import ContentSkeleton from '../components/ui/ContentSkeleton';

const ROLE_LABELS = {
  customer: 'Customer',
  manager: 'Manager',
  motor_rider: 'Motor Rider',
  admin: 'Administrator',
  viewer: 'Viewer',
};

export default function Profile() {
  const { profile, token, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || '');
    setEmail(profile.email || '');
    setPhone(profile.phone || '');
  }, [profile]);

  if (!profile) {
    return <ContentSkeleton rows={3} />;
  }

  const roleLabel = ROLE_LABELS[profile.role?.name] || profile.role?.name || 'User';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
      };
      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const result = await api.updateMyProfile(token, payload);
      await refreshProfile();
      setSuccess(result.message || 'Profile saved');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-primary-light" />
          My profile
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">Update your name, email, phone, and password</p>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/25 rounded-xl text-sm text-danger">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-success/10 border border-success/25 rounded-xl text-sm text-success">{success}</div>
      )}

      <div className="glass-card rounded-xl p-4 border border-border/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wide">Role</p>
          <p className="text-white font-medium mt-0.5 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-primary-light" />
            {roleLabel}
          </p>
        </div>
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wide">Member since</p>
          <p className="text-white font-medium mt-0.5">
            {profile.created_at ? formatDeliveryDateTime(profile.created_at) : '—'}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-slate-500 text-xs uppercase tracking-wide">Account ID</p>
          <p className="text-slate-400 font-mono text-xs mt-0.5 break-all">{profile.id}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card rounded-xl p-5 sm:p-6 border border-border/80 space-y-5">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Full name</label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm focus:border-primary focus:outline-none"
              autoComplete="name"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm focus:border-primary focus:outline-none"
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Contact phone</label>
          <div className="relative">
            <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+250 7XX XXX XXX"
              className="w-full pl-9 pr-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm focus:border-primary focus:outline-none"
              autoComplete="tel"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-border space-y-4">
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400" />
            Change password
          </p>
          <p className="text-xs text-slate-500 -mt-2">Leave blank to keep your current password</p>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm focus:border-primary focus:outline-none"
              autoComplete="current-password"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm focus:border-primary focus:outline-none"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface rounded-xl border border-border text-white text-sm focus:border-primary focus:outline-none"
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save profile
        </button>
      </form>
    </div>
  );
}
