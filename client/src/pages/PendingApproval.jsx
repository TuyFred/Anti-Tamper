import { useState } from 'react';
import { Clock, RefreshCw, Shield, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PendingApproval() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen auth-gradient flex items-center justify-center p-4 sm:p-6">
      <div className="glass-card rounded-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-6 border border-warning/20">
        <div className="w-16 h-16 rounded-2xl bg-warning/15 border border-warning/25 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8 text-warning" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Account pending approval</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Your account{' '}
            <span className="text-white font-medium">{profile?.email}</span>{' '}
            must be approved by a manager before you can request deliveries.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface/50 border border-border text-left text-xs text-slate-400 space-y-2">
          <p className="flex items-center gap-2 text-slate-300">
            <Shield className="w-4 h-4 text-primary-light shrink-0" />
            What happens next
          </p>
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>A manager reviews your registration</li>
            <li>You receive access as Customer, Motor Rider, or Manager</li>
            <li>Click refresh below once approved</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Checking…' : 'Refresh status'}
          </button>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-surface border border-border text-slate-300 rounded-xl font-medium hover:text-white transition"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
