import { useEffect, useState, useMemo } from 'react';
import { Bell, Filter, CheckCircle2, AlertTriangle, List } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../lib/api';
import AlertList from '../components/AlertList';
import StatCard from '../components/ui/StatCard';

const FILTERS = [
  { id: 'all', label: 'All alerts', icon: List },
  { id: 'critical', label: 'Critical', icon: AlertTriangle },
  { id: 'unack', label: 'Unacknowledged', icon: Bell },
  { id: 'ack', label: 'Acknowledged', icon: CheckCircle2 },
];

export default function AlertCenter() {
  const { token } = useAuth();
  const { alerts, setInitialAlerts, acknowledgeAlertLocal } = useSocket();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.getAlerts(token);
        setInitialAlerts(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token, setInitialAlerts]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'critical':
        return alerts.filter((a) => a.severity === 'critical');
      case 'unack':
        return alerts.filter((a) => !a.is_acknowledged);
      case 'ack':
        return alerts.filter((a) => a.is_acknowledged);
      default:
        return alerts;
    }
  }, [alerts, filter]);

  const stats = useMemo(() => ({
    total: alerts.length,
    critical: alerts.filter((a) => !a.is_acknowledged && a.severity === 'critical').length,
    unack: alerts.filter((a) => !a.is_acknowledged).length,
    today: alerts.filter((a) => {
      const d = new Date(a.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length,
  }), [alerts]);

  const handleAcknowledge = async (alertId) => {
    setActionLoading(true);
    try {
      await api.acknowledgeAlert(token, alertId);
      acknowledgeAlertLocal(alertId);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledgeAll = async () => {
    const pending = alerts.filter((a) => !a.is_acknowledged && a.severity === 'critical');
    if (!pending.length || !confirm(`Acknowledge ${pending.length} critical alert(s)?`)) return;
    setActionLoading(true);
    try {
      await Promise.all(pending.map((a) => api.acknowledgeAlert(token, a.id)));
      pending.forEach((a) => acknowledgeAlertLocal(a.id));
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && alerts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Bell} label="Total alerts" value={stats.total} sub="All time" accent="primary" />
        <StatCard icon={AlertTriangle} label="Critical open" value={stats.critical} sub="Needs attention" accent={stats.critical > 0 ? 'danger' : 'success'} />
        <StatCard icon={Filter} label="Unacknowledged" value={stats.unack} sub="Pending review" accent={stats.unack > 0 ? 'warning' : 'success'} />
        <StatCard icon={List} label="Today" value={stats.today} sub="Last 24h events" accent="neutral" />
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary-light" />
              Alert Center
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              All security events — tamper, shock, fall, unauthorized access. Critical alerts trigger email notifications.
            </p>
          </div>
          {stats.critical > 0 && (
            <button
              onClick={handleAcknowledgeAll}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl bg-success/15 text-success border border-success/25 text-sm font-medium hover:bg-success/25 transition disabled:opacity-50"
            >
              Acknowledge all critical
            </button>
          )}
        </div>

        <div className="px-5 py-3 border-b border-border flex gap-2 flex-wrap bg-surface/30">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                  active
                    ? 'bg-primary/15 text-primary-light border-primary/30'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-surface-lighter'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="max-h-[calc(100vh-320px)] min-h-[400px] overflow-y-auto scrollbar-thin">
          <AlertList
            alerts={filtered}
            onAcknowledge={handleAcknowledge}
            loading={actionLoading}
            emptyMessage={
              filter === 'all'
                ? 'No alerts recorded yet'
                : 'No alerts match this filter'
            }
          />
        </div>
      </div>
    </div>
  );
}
