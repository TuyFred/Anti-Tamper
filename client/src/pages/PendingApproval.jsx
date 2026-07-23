import { useState } from 'react';
import { Clock, RefreshCw, LogOut } from 'lucide-react';
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
    <div className="min-h-screen auth-gradient flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center space-y-5 border border-warning/20">
        <div className="w-14 h-14 rounded-2xl bg-warning/15 border border-warning/25 flex items-center justify-center mx-auto">
          <Clock className="w-7 h-7 text-warning" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Pending approval</h1>
          <p className="text-sm text-slate-400 mt-2">{profile?.email}</p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button type="button" onClick={signOut} className="flex items-center justify-center gap-2 px-4 py-3 bg-surface border border-border text-slate-300 rounded-xl text-sm">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
